import { test } from "node:test";
import assert from "node:assert/strict";
import * as fs from "fs";
import * as os from "os";
import * as path from "path";
import {
  buildCodegraphMcpServerConfig,
  CODEGRAPH_DIR_NAME,
  CODEGRAPH_MCP_SERVER_NAME,
  CODEGRAPH_PACKAGE,
  CODEGRAPH_VENDOR_ENTRY,
  configureCodegraphVendorRoot,
  hasCodegraphProject,
  resolveCodegraphExecutable,
  runCodegraphSync,
} from "../common/codegraph";

function makeTempProject(withCodegraphDir: boolean): string {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "codegraph-test-"));
  if (withCodegraphDir) {
    fs.mkdirSync(path.join(root, CODEGRAPH_DIR_NAME));
  }
  return root;
}

/** Create a fake vendored CodeGraph checkout with a compiled CLI entry file. */
function makeVendorRoot(): string {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "codegraph-vendor-"));
  const entry = path.join(root, CODEGRAPH_VENDOR_ENTRY);
  fs.mkdirSync(path.dirname(entry), { recursive: true });
  fs.writeFileSync(entry, "#!/usr/bin/env node\n");
  return root;
}

type FakeChild = {
  onceCalls: string[];
  unrefCalled: boolean;
  once(event: string, listener: (error: NodeJS.ErrnoException) => void): FakeChild;
  unref(): void;
};

function makeFakeSpawn(): {
  spawn: (command: string, args: string[], options: unknown) => FakeChild;
  calls: Array<{ command: string; args: string[]; options: unknown }>;
} {
  const calls: Array<{ command: string; args: string[]; options: unknown }> = [];
  const spawn = (command: string, args: string[], options: unknown): FakeChild => {
    calls.push({ command, args, options });
    const child: FakeChild = {
      onceCalls: [],
      unrefCalled: false,
      once(event: string) {
        this.onceCalls.push(event);
        return this;
      },
      unref() {
        this.unrefCalled = true;
      },
    };
    return child;
  };
  return { spawn, calls };
}

test("hasCodegraphProject detects the project-local .codegraph directory", () => {
  const withDir = makeTempProject(true);
  const withoutDir = makeTempProject(false);
  try {
    assert.equal(hasCodegraphProject(withDir), true);
    assert.equal(hasCodegraphProject(withoutDir), false);
    assert.equal(hasCodegraphProject(path.join(withoutDir, "does-not-exist")), false);
  } finally {
    fs.rmSync(withDir, { recursive: true, force: true });
    fs.rmSync(withoutDir, { recursive: true, force: true });
  }
});

test("resolveCodegraphExecutable falls back to npx when no vendored build is configured", () => {
  configureCodegraphVendorRoot(null);
  const exe = resolveCodegraphExecutable();
  assert.equal(exe.command, "npx");
  assert.ok(exe.prefixArgs.includes(CODEGRAPH_PACKAGE), "npx fallback should reference the package");
  assert.ok(exe.prefixArgs.includes("-y"), "npx fallback should be non-interactive");
});

test("resolveCodegraphExecutable prefers a vendored build and runs it through Node", () => {
  const vendorRoot = makeVendorRoot();
  try {
    configureCodegraphVendorRoot(vendorRoot);
    const exe = resolveCodegraphExecutable();
    assert.equal(exe.command, process.execPath);
    assert.equal(exe.prefixArgs.length, 1);
    assert.equal(exe.prefixArgs[0], path.resolve(vendorRoot, CODEGRAPH_VENDOR_ENTRY));
  } finally {
    configureCodegraphVendorRoot(null);
    fs.rmSync(vendorRoot, { recursive: true, force: true });
  }
});

test("buildCodegraphMcpServerConfig pins cwd and uses the resolved executable (npx fallback)", () => {
  configureCodegraphVendorRoot(null);
  const root = "/tmp/some-project";
  const config = buildCodegraphMcpServerConfig(root);
  assert.equal(config.command, "npx");
  assert.deepEqual(config.args, ["-y", CODEGRAPH_PACKAGE, "serve", "--mcp"]);
  assert.equal(config.cwd, root);
});

test("buildCodegraphMcpServerConfig uses the vendored entry when configured", () => {
  const vendorRoot = makeVendorRoot();
  try {
    configureCodegraphVendorRoot(vendorRoot);
    const config = buildCodegraphMcpServerConfig("/tmp/proj");
    assert.equal(config.command, process.execPath);
    assert.ok(config.args, "config should carry args");
    assert.equal(config.args![0], path.resolve(vendorRoot, CODEGRAPH_VENDOR_ENTRY));
    assert.deepEqual(config.args!.slice(1), ["serve", "--mcp"]);
    assert.equal(config.cwd, "/tmp/proj");
  } finally {
    configureCodegraphVendorRoot(null);
    fs.rmSync(vendorRoot, { recursive: true, force: true });
  }
});

test("runCodegraphSync no-ops when the project is not CodeGraph-enabled", () => {
  configureCodegraphVendorRoot(null);
  const root = makeTempProject(false);
  const { spawn, calls } = makeFakeSpawn();
  try {
    runCodegraphSync(root, spawn);
    assert.equal(calls.length, 0);
  } finally {
    fs.rmSync(root, { recursive: true, force: true });
  }
});

test("runCodegraphSync spawns `codegraph sync <root>` for an enabled project", () => {
  configureCodegraphVendorRoot(null);
  const root = makeTempProject(true);
  const { spawn, calls } = makeFakeSpawn();
  try {
    runCodegraphSync(root, spawn);
    assert.equal(calls.length, 1);
    const call = calls[0]!;
    // On Windows createMcpSpawnSpec folds args into the command string, so assert
    // on the flattened invocation to stay cross-platform.
    const flattened = `${call.command} ${call.args.join(" ")}`;
    assert.ok(flattened.includes(CODEGRAPH_PACKAGE), "should invoke the codegraph package");
    assert.ok(flattened.includes("sync"), "should run the sync subcommand");
    assert.ok(flattened.includes(root), "should target the project root");
    assert.equal((call.options as { cwd?: string }).cwd, root);
  } finally {
    fs.rmSync(root, { recursive: true, force: true });
  }
});

test("CodeGraph constants are stable", () => {
  assert.equal(CODEGRAPH_MCP_SERVER_NAME, "codegraph");
  assert.equal(CODEGRAPH_DIR_NAME, ".codegraph");
  assert.equal(CODEGRAPH_PACKAGE, "@colbymchenry/codegraph");
  assert.equal(CODEGRAPH_VENDOR_ENTRY, path.join("dist", "bin", "codegraph.js"));
});
