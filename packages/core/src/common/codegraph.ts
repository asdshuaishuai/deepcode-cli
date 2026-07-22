import { spawn, type SpawnOptions } from "child_process";
import * as fs from "fs";
import * as path from "path";
import { createMcpSpawnSpec } from "../mcp/mcp-client";
import type { McpServerConfig } from "../settings";

/**
 * CodeGraph integration.
 *
 * CodeGraph (https://github.com/colbymchenry/codegraph) is a local-first code
 * knowledge graph. It stores its index in a project-local `.codegraph/` directory
 * and exposes an MCP server (`codegraph serve --mcp`) plus an incremental index
 * updater (`codegraph sync <path>`).
 *
 * CodeGraph ships as a Node/TypeScript package: its CLI entry compiles to
 * `dist/bin/codegraph.js` and runs on plain Node (tree-sitter via WASM), so it can
 * be *vendored* — checked out from source and compiled alongside our own build —
 * and then invoked directly instead of relying on a host-global install. The
 * desktop client vendors CodeGraph under its package (see `scripts/vendor-codegraph.js`)
 * and points the resolver at it via {@link configureCodegraphVendorRoot}. When no
 * vendored build is present we fall back to `npx @colbymchenry/codegraph`, so the
 * feature degrades gracefully rather than breaking.
 *
 * The integration is deliberately *project-scoped*: nothing is registered as a
 * host-global binary or environment variable, and a project only participates when
 * it already contains a `.codegraph/` directory (created once via `codegraph init`),
 * so the index and knowledge base always follow the project.
 */

/** npm package that provides the `codegraph` CLI + MCP server. Used for the npx fallback. */
export const CODEGRAPH_PACKAGE = "@colbymchenry/codegraph";

/** Name under which the CodeGraph MCP server is registered. */
export const CODEGRAPH_MCP_SERVER_NAME = "codegraph";

/** Project-local directory that holds the CodeGraph index (SQLite + FTS5). */
export const CODEGRAPH_DIR_NAME = ".codegraph";

/** Relative path, inside a vendored CodeGraph checkout, to the compiled CLI entry. */
export const CODEGRAPH_VENDOR_ENTRY = path.join("dist", "bin", "codegraph.js");

/**
 * Absolute path of the vendored CodeGraph checkout, or `null` when unset. The
 * desktop client sets this at boot to the copy it ships; other hosts leave it unset
 * and rely on the npx fallback.
 */
let configuredVendorRoot: string | null = null;

/** Point the resolver at a vendored CodeGraph checkout (or clear it with `null`). */
export function configureCodegraphVendorRoot(root: string | null): void {
  configuredVendorRoot = root ? path.resolve(root) : null;
}

/** The currently configured vendored CodeGraph root, if any. */
export function getCodegraphVendorRoot(): string | null {
  return configuredVendorRoot;
}

/**
 * How to spawn CodeGraph: the executable plus any args that must precede the
 * subcommand (e.g. the JS entry when running through Node), and extra env vars.
 */
export type CodegraphExecutable = {
  command: string;
  prefixArgs: string[];
  env?: Record<string, string>;
};

/** Resolve the compiled CLI entry inside the configured vendor root, if it exists. */
function resolveVendorEntry(): string | null {
  if (!configuredVendorRoot) {
    return null;
  }
  const entry = path.join(configuredVendorRoot, CODEGRAPH_VENDOR_ENTRY);
  try {
    return fs.statSync(entry).isFile() ? entry : null;
  } catch {
    return null;
  }
}

/**
 * Decide how to invoke CodeGraph. Prefers the vendored build (run through the
 * current Node/Electron binary); otherwise falls back to `npx`, which resolves the
 * published package from the registry / local cache without a global install.
 */
export function resolveCodegraphExecutable(): CodegraphExecutable {
  const entry = resolveVendorEntry();
  if (entry) {
    const env: Record<string, string> = {};
    if (process.versions.electron) {
      // Make the Electron binary behave like plain Node so it can run the JS entry.
      env.ELECTRON_RUN_AS_NODE = "1";
    }
    return { command: process.execPath, prefixArgs: [entry], env };
  }
  return { command: "npx", prefixArgs: ["-y", CODEGRAPH_PACKAGE] };
}

/**
 * Per-root opt-out for the built-in CodeGraph MCP server. Hosts (e.g. the desktop
 * plugin module) may disable the built-in without uninstalling it; the disabled
 * flag is consulted by the session's builtin augmentation so a disabled root never
 * auto-registers CodeGraph. Persistence, if any, is the host's concern.
 */
const disabledCodegraphRoots = new Set<string>();

/** Enable or disable the built-in CodeGraph MCP server for a project root. */
export function setCodegraphDisabled(projectRoot: string, disabled: boolean): void {
  const key = path.resolve(projectRoot);
  if (disabled) {
    disabledCodegraphRoots.add(key);
  } else {
    disabledCodegraphRoots.delete(key);
  }
}

/** True when the built-in CodeGraph MCP server has been disabled for a project root. */
export function isCodegraphDisabled(projectRoot: string): boolean {
  return disabledCodegraphRoots.has(path.resolve(projectRoot));
}

/**
 * True when the given project root has been initialized with CodeGraph
 * (i.e. it contains a `.codegraph/` directory). This is the gate that keeps the
 * integration project-scoped — projects opt in by running `codegraph init`.
 */
export function hasCodegraphProject(projectRoot: string): boolean {
  try {
    return fs.statSync(path.join(projectRoot, CODEGRAPH_DIR_NAME)).isDirectory();
  } catch {
    return false;
  }
}

/**
 * Build the MCP server configuration for CodeGraph. The command comes from
 * {@link resolveCodegraphExecutable} (vendored build or npx fallback). The `cwd` is
 * pinned to the project root so the server always targets the right project's
 * `.codegraph/` index, even when the host process (e.g. Electron main) runs from a
 * different working directory.
 */
export function buildCodegraphMcpServerConfig(projectRoot: string): McpServerConfig {
  const exe = resolveCodegraphExecutable();
  const config: McpServerConfig = {
    command: exe.command,
    args: [...exe.prefixArgs, "serve", "--mcp"],
    cwd: projectRoot,
  };
  if (exe.env && Object.keys(exe.env).length > 0) {
    config.env = exe.env;
  }
  return config;
}

type CodegraphChild = {
  once(event: string, listener: (error: NodeJS.ErrnoException) => void): unknown;
  unref(): void;
};

type CodegraphSpawn = (
  command: string,
  args: string[],
  options: Pick<SpawnOptions, "cwd" | "detached" | "env" | "stdio" | "shell" | "windowsHide">
) => CodegraphChild;

/** Spawn a CodeGraph subcommand as a detached, output-ignoring child. Throws on spawn failure. */
function spawnCodegraph(projectRoot: string, subcommand: string[], spawnProcess: CodegraphSpawn): CodegraphChild {
  const exe = resolveCodegraphExecutable();
  const spec = createMcpSpawnSpec(exe.command, [...exe.prefixArgs, ...subcommand]);
  const env = exe.env && Object.keys(exe.env).length > 0 ? { ...process.env, ...exe.env } : process.env;
  const options = {
    cwd: projectRoot,
    detached: process.platform !== "win32",
    env,
    stdio: "ignore" as const,
    shell: spec.shell,
    windowsHide: spec.windowsHide,
  };
  return spawnProcess(spec.command, spec.args, options);
}

/**
 * Run an arbitrary CodeGraph subcommand (e.g. `["init"]`) as a fire-and-forget
 * subprocess. Failures are swallowed — a missing/broken CodeGraph install must never
 * break the session loop.
 */
export function runCodegraphCommand(
  projectRoot: string,
  subcommand: string[],
  spawnProcess: CodegraphSpawn = spawn as unknown as CodegraphSpawn
): void {
  try {
    const child = spawnCodegraph(projectRoot, subcommand, spawnProcess);
    child.once("error", () => {
      // Ignore — best-effort background command.
    });
    child.unref();
  } catch {
    // Ignore spawn failures.
  }
}

/**
 * Run `codegraph init` for a project as a fire-and-forget subprocess. `init` creates
 * the `.codegraph/` directory and builds the full graph.
 */
export function runCodegraphInit(
  projectRoot: string,
  spawnProcess: CodegraphSpawn = spawn as unknown as CodegraphSpawn
): void {
  runCodegraphCommand(projectRoot, ["init"], spawnProcess);
}

const inFlightSyncs = new Set<string>();

/**
 * Run `codegraph sync <projectRoot>` as a fire-and-forget subprocess to update the
 * incremental index after code changes. No-ops when the project is not CodeGraph
 * enabled, and coalesces overlapping syncs per project so at most one runs at a
 * time. Failures are swallowed.
 */
export function runCodegraphSync(
  projectRoot: string,
  spawnProcess: CodegraphSpawn = spawn as unknown as CodegraphSpawn
): void {
  if (!hasCodegraphProject(projectRoot)) {
    return;
  }
  const key = path.resolve(projectRoot);
  if (inFlightSyncs.has(key)) {
    return;
  }

  try {
    inFlightSyncs.add(key);
    const child = spawnCodegraph(projectRoot, ["sync", projectRoot], spawnProcess);
    const clear = () => inFlightSyncs.delete(key);
    child.once("error", clear);
    // Best-effort cleanup once the process settles; ignore if unsupported.
    (child as unknown as { once?: (event: string, cb: () => void) => void }).once?.("exit", clear);
    child.unref();
  } catch {
    inFlightSyncs.delete(key);
    // Ignore sync failures.
  }
}
