// Vendor CodeGraph (https://github.com/colbymchenry/codegraph) into the desktop app.
//
// CodeGraph is a Node/TypeScript package: `npm run build` (tsc) compiles its CLI to
// `dist/bin/codegraph.js`, which runs on plain Node (tree-sitter via WASM — no Rust
// toolchain required). This script checks out the latest `main`, compiles it, and
// copies the runtime files + production dependencies into
// `packages/desktop/vendor/codegraph`, so the desktop client can invoke a built-in
// copy directly (see packages/core/src/common/codegraph.ts) instead of relying on a
// host-global install.
//
// Requirements at build time: `git`, `npm`, network access. Nothing is installed
// globally; the vendored copy lives entirely inside the repo (and is gitignored).
//
// Usage:
//   node scripts/vendor-codegraph.js            # vendor if missing
//   node scripts/vendor-codegraph.js --force    # re-vendor even if present
//
// Env overrides:
//   CODEGRAPH_REPO  (default https://github.com/colbymchenry/codegraph.git)
//   CODEGRAPH_REF   (default main)

import { execFileSync } from "node:child_process";
import { cpSync, existsSync, mkdirSync, mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const repoRoot = resolve(__dirname, "..");
const targetDir = join(repoRoot, "packages", "desktop", "vendor", "codegraph");
const entryFile = join(targetDir, "dist", "bin", "codegraph.js");

const REPO = process.env.CODEGRAPH_REPO || "https://github.com/colbymchenry/codegraph.git";
const REF = process.env.CODEGRAPH_REF || "main";
const force = process.argv.includes("--force");
const isWindows = process.platform === "win32";

function log(message) {
  console.log(`[vendor-codegraph] ${message}`);
}

function run(command, args, cwd) {
  // npm is a .cmd shim on Windows, so it needs a shell there.
  const needsShell = isWindows && command === "npm";
  execFileSync(command, args, { cwd, stdio: "inherit", shell: needsShell });
}

function main() {
  if (existsSync(entryFile) && !force) {
    log(`already vendored → ${entryFile} (use --force to rebuild)`);
    return;
  }

  const work = mkdtempSync(join(tmpdir(), "codegraph-src-"));
  try {
    log(`cloning ${REPO} @ ${REF} …`);
    run("git", ["clone", "--depth", "1", "--branch", REF, REPO, work]);

    log("installing build dependencies …");
    run("npm", ["install", "--no-audit", "--no-fund"], work);

    log("compiling (npm run build) …");
    run("npm", ["run", "build"], work);

    log(`copying runtime files → ${targetDir}`);
    rmSync(targetDir, { recursive: true, force: true });
    mkdirSync(targetDir, { recursive: true });
    for (const name of ["dist", "scripts", "package.json", "package-lock.json", "README.md"]) {
      const src = join(work, name);
      if (existsSync(src)) {
        cpSync(src, join(targetDir, name), { recursive: true });
      }
    }

    log("installing production dependencies in vendor dir …");
    run("npm", ["install", "--omit=dev", "--no-audit", "--no-fund", "--ignore-scripts"], targetDir);

    log(`done → ${entryFile}`);
  } finally {
    rmSync(work, { recursive: true, force: true });
  }
}

try {
  main();
} catch (error) {
  console.error(`[vendor-codegraph] failed: ${error instanceof Error ? error.message : String(error)}`);
  process.exit(1);
}
