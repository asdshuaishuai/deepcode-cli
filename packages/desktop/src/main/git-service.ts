// Minimal Git source-control service for the desktop client. Shells out to the
// system `git` via `execFile` (no third-party deps) and returns structured,
// JSON-safe results. Every operation is scoped to a workspace `cwd` and fails
// soft: a non-repo or missing git yields `isRepo:false` / `{ ok:false, error }`.

import { execFile } from "node:child_process";
import { promisify } from "node:util";
import type { DiffPayload, GitLogEntry, GitStatus, GitStatusFile } from "../shared/ipc.js";

const run = promisify(execFile);

type RunResult = { stdout: string; stderr: string };

/** Execute a git subcommand in `cwd`, returning stdout or throwing on failure. */
async function git(cwd: string, args: string[]): Promise<RunResult> {
  return run("git", args, { cwd, windowsHide: true, maxBuffer: 32 * 1024 * 1024 });
}

function toError(err: unknown): string {
  if (err && typeof err === "object" && "stderr" in err && typeof (err as { stderr: unknown }).stderr === "string") {
    const stderr = (err as { stderr: string }).stderr.trim();
    if (stderr) {
      return stderr;
    }
  }
  return err instanceof Error ? err.message : String(err);
}

/** True when `cwd` sits inside a git work tree. */
async function isInsideRepo(cwd: string): Promise<boolean> {
  try {
    const { stdout } = await git(cwd, ["rev-parse", "--is-inside-work-tree"]);
    return stdout.trim() === "true";
  } catch {
    return false;
  }
}

/** Resolve the current branch, falling back to a short HEAD sha when detached. */
export async function currentBranch(cwd: string): Promise<string> {
  try {
    const { stdout } = await git(cwd, ["symbolic-ref", "--short", "HEAD"]);
    const branch = stdout.trim();
    if (branch) {
      return branch;
    }
  } catch {
    // Detached HEAD → fall through to short sha.
  }
  try {
    const { stdout } = await git(cwd, ["rev-parse", "--short", "HEAD"]);
    return stdout.trim();
  } catch {
    return "";
  }
}

/** List local branch names (current first). Soft-fails to `[]` off-repo. */
export async function listBranches(cwd: string): Promise<string[]> {
  if (!(await isInsideRepo(cwd))) {
    return [];
  }
  try {
    const { stdout } = await git(cwd, ["branch", "--format=%(refname:short)"]);
    const branches = stdout
      .split(/\r?\n/)
      .map((line) => line.trim())
      .filter(Boolean);
    const current = await currentBranch(cwd);
    // Surface the current branch first for a stable default in the dropdown.
    return current && branches.includes(current) ? [current, ...branches.filter((b) => b !== current)] : branches;
  } catch {
    return [];
  }
}

/** Check out an existing branch. Surfaces git's stderr (e.g. dirty tree). */
export async function checkout(cwd: string, branch: string): Promise<{ ok: boolean; error?: string }> {
  const trimmed = branch.trim();
  if (!trimmed) {
    return { ok: false, error: "Empty branch name" };
  }
  try {
    await git(cwd, ["checkout", trimmed]);
    return { ok: true };
  } catch (err) {
    return { ok: false, error: toError(err) };
  }
}

/** Parse one `git status --porcelain=v1` line into a structured file entry. */
function parsePorcelainLine(line: string): GitStatusFile | null {
  if (line.length < 4) {
    return null;
  }
  const index = line[0] ?? " ";
  const work = line[1] ?? " ";
  let file = line.slice(3);
  // Renames are reported as "old -> new"; surface the new path.
  const arrow = file.indexOf(" -> ");
  if (arrow >= 0) {
    file = file.slice(arrow + 4);
  }
  // Porcelain quotes paths with special chars; strip the wrapping quotes.
  if (file.startsWith('"') && file.endsWith('"')) {
    file = file.slice(1, -1);
  }
  const staged = index !== " " && index !== "?";
  return { path: file, index, work, staged };
}

/** Full working-tree status: branch + changed files split by stage state. */
export async function status(cwd: string): Promise<GitStatus> {
  if (!(await isInsideRepo(cwd))) {
    return { isRepo: false, branch: "", files: [] };
  }
  const branch = await currentBranch(cwd);
  try {
    const { stdout } = await git(cwd, ["status", "--porcelain=v1"]);
    const files: GitStatusFile[] = [];
    for (const line of stdout.split(/\r?\n/)) {
      if (!line.trim()) {
        continue;
      }
      const parsed = parsePorcelainLine(line);
      if (parsed) {
        files.push(parsed);
      }
    }
    return { isRepo: true, branch, files };
  } catch {
    return { isRepo: true, branch, files: [] };
  }
}

/** Stage a single file (`git add -- <file>`). */
export async function stage(cwd: string, file: string): Promise<{ ok: boolean; error?: string }> {
  try {
    await git(cwd, ["add", "--", file]);
    return { ok: true };
  } catch (err) {
    return { ok: false, error: toError(err) };
  }
}

/** Unstage a single file (`git reset -q HEAD -- <file>`). */
export async function unstage(cwd: string, file: string): Promise<{ ok: boolean; error?: string }> {
  try {
    await git(cwd, ["reset", "-q", "HEAD", "--", file]);
    return { ok: true };
  } catch (err) {
    return { ok: false, error: toError(err) };
  }
}

/** Discard working-tree changes for a file (`git checkout -- <file>`). */
export async function discard(cwd: string, file: string): Promise<{ ok: boolean; error?: string }> {
  try {
    await git(cwd, ["checkout", "--", file]);
    return { ok: true };
  } catch (err) {
    return { ok: false, error: toError(err) };
  }
}

/** Commit the staged changes with `message`. */
export async function commit(cwd: string, message: string): Promise<{ ok: boolean; error?: string }> {
  const trimmed = message.trim();
  if (!trimmed) {
    return { ok: false, error: "Empty commit message" };
  }
  try {
    await git(cwd, ["commit", "-m", trimmed]);
    return { ok: true };
  } catch (err) {
    return { ok: false, error: toError(err) };
  }
}

/** Diff for a single file: working tree (`git diff`) or staged (`git diff --cached`). */
export async function diff(cwd: string, file: string, staged: boolean): Promise<DiffPayload> {
  const args = staged ? ["diff", "--cached", "--", file] : ["diff", "--", file];
  try {
    const { stdout } = await git(cwd, args);
    return { file, diff: stdout, binary: /^Binary files /m.test(stdout) };
  } catch (err) {
    return { file, diff: `# ${toError(err)}`, binary: false };
  }
}

/** Recent commit history (newest first). Soft-fails to `[]` off-repo. */
export async function log(cwd: string, limit = 50): Promise<GitLogEntry[]> {
  if (!(await isInsideRepo(cwd))) {
    return [];
  }
  // Unit-separator (%x1f) between fields, record-separator (%x1e) between commits.
  const format = ["%H", "%h", "%an", "%ad", "%s"].join("%x1f") + "%x1e";
  try {
    const { stdout } = await git(cwd, [
      "log",
      `--max-count=${Math.max(1, Math.min(limit, 500))}`,
      "--date=short",
      `--pretty=format:${format}`,
    ]);
    const entries: GitLogEntry[] = [];
    for (const record of stdout.split("\x1e")) {
      const line = record.replace(/^[\r\n]+/, "");
      if (!line.trim()) {
        continue;
      }
      const [hash, shortHash, author, date, subject] = line.split("\x1f");
      if (!hash) {
        continue;
      }
      entries.push({
        hash,
        shortHash: shortHash ?? hash.slice(0, 7),
        author: author ?? "",
        date: date ?? "",
        subject: subject ?? "",
      });
    }
    return entries;
  } catch {
    return [];
  }
}

/** Combined diff for a single commit (`git show <hash>`). */
export async function commitDiff(cwd: string, hash: string): Promise<DiffPayload> {
  const trimmed = hash.trim();
  if (!trimmed) {
    return { file: "", diff: "", binary: false };
  }
  try {
    const { stdout } = await git(cwd, ["show", "--no-color", trimmed]);
    return { file: trimmed, diff: stdout, binary: /^Binary files /m.test(stdout) };
  } catch (err) {
    return { file: trimmed, diff: `# ${toError(err)}`, binary: false };
  }
}
