# AGENTS.md — Deep Code CLI workspace

Concise workspace guide for AI agents editing this repo. For deeper context also see
`.deepcode/AGENTS.md` (the project's own contributor guide) and `docs/` (architecture,
configuration, MCP, permissions, plan-mode, session-persistence, statusline).

## What this repo is

`@vegamo/deepcode` — an npm **workspaces monorepo** for "Deep Code", a coding-agent
harness tuned for DeepSeek models. Ships as a terminal CLI, an Electron desktop GUI,
and a VSCode companion, all driven by one shared core engine.

Packages (under `packages/`):

| Package | Scope npm name | Role |
|---|---|---|
| `core/` | `@vegamo/deepcode-core` | Engine: LLM session loop, 7 built-in tools, MCP client, permissions, settings. No UI deps. |
| `cli/` | `@vegamo/deepcode-cli` | Terminal UI built with Ink (React-for-terminals). Depends on core. |
| `desktop/` | `@vegamo/deepcode-desktop` | Electron GUI built on the core engine (new). Depends on core. |
| `vscode-ide-companion/` | — | VSCode extension companion. |

`docs/` = user-facing docs. `scripts/` = build/release/packaging JS. `.deepcode/` =
the product's own config dir (settings, plugins, skills, in-repo AGENTS.md).

## Layer rules (important)

- **`core` must stay UI-free.** It must not import `ink`, `react`, `electron`, or
  anything terminal/GUI-specific. UI layers (`cli`, `desktop`) depend on core, never
  the reverse.
- **Built-in tools are deliberately minimal:** `bash`, `read`, `write`, `edit`,
  `AskUserQuestion`, `UpdatePlan`, `WebSearch`. External capabilities come via MCP —
  do not add new built-in tools lightly.
- **Snippet editing contract:** the `read` tool returns a `snippet_id`; the `edit`
  tool *requires* that `snippet_id` and only searches within the snippet. Preserve
  this when touching `packages/core/src/tools/read-handler.ts` / `edit-handler.ts`.
- **Desktop IPC:** the contract lives in `packages/desktop/src/shared/ipc.ts`
  (type-only, dependency-free so both sides can bundle it). `main/` owns the engine,
  `preload/` runs under contextIsolation and exposes a typed `window.deepcode`,
  `renderer/` is a browser bundle with no Node/Electron access. Edit the contract in
  `shared/ipc.ts` and wire both ends; do not ad-hoc `ipcRenderer` calls in the renderer.
- **bash tool needs a POSIX shell.** On Windows, `setShellIfWindows()` (core) points
  it at Git Bash. Keep this working — don't assume `cmd`/PowerShell will do.

## Commands (run from repo root)

| Command | Purpose |
|---|---|
| `npm run typecheck` | `tsc --noEmit` across all workspaces |
| `npm run lint` / `npm run lint:fix` | ESLint on `packages/*/src/**/*.{ts,tsx}` + `scripts/*.js` |
| `npm run format` / `npm run format:check` | Prettier |
| `npm run check` | typecheck + lint + format:check (run before pushing) |
| `npm run build` | core tsc → rewrite ESM imports → bundle CLI |
| `npm run bundle` | git-commit info + esbuild bundle + copy assets |
| `npm test` | run every workspace's tests |
| `npm run start` | run the locally built CLI |
| `npm run desktop:build` / `desktop:dev` / `desktop:start` | Electron app build / dev / build+run |
| `npm run build:vscode` | build the VSCode companion |
| `npm run release:version` | bump version across all packages |
| `npm run clean` | remove generated files and `dist/` |

Single test file: `node packages/<pkg>/src/tests/run-tests.mjs packages/<pkg>/src/tests/<file>.test.ts`
(tests use Node's native runner `node:test` + `node:assert/strict`, executed via `tsx`).

Run the CLI locally after bundling: `node packages/cli/dist/cli.js`.

## Toolchain & conventions

- **Node ≥ 22** (`.nvmrc` = 22), **npm 10.9.4** (`packageManager`). ESM only
  (`"type": "module"`). Target ES2022, module ESNext, `moduleResolution: "bundler"`.
- **TypeScript is strict** and `verbatimModuleSyntax: true` → always use
  `import type` for type-only imports (a runtime import will fail the build).
- **Prettier:** 2 spaces, double quotes, semicolons, trailing commas `es5`,
  width 120, LF endings. **File names:** `kebab-case.ts(.tsx)`; tests `*.test.ts`.
- **Core ESM gotcha:** `tsc` emits extensionless relative imports; Node ESM needs
  `.js`. `scripts/rewrite-esm-imports.js` fixes this in `core/dist/` after build.
  When adding files to core, write source imports *without* extensions (the script
  adds them) — match existing core files.
- **Lint:** `no-console` is off (CLI project). Unused vars/params may be `_`-prefixed.
  `@typescript-eslint/consistent-type-imports` is on (warn) — reinforces `import type`.
- **Pre-commit:** Husky runs `lint-staged` (eslint --fix + prettier --write on
  staged `*.{ts,tsx,js,mjs,cjs,jsx}` and `*.json`). Format before building to avoid
  surprises.

## Generated / gitignored (do not edit by hand)

- `packages/cli/src/generated/`, `packages/core/src/generated/` — build-time output
  (e.g. git-commit info via `scripts/generate-git-commit-info.js`).
- `dist/`, `out/`, `*.tsbuildinfo` — build artifacts.
- `.deepcode/settings.json`, `.env`, `.env.local` — local secrets/config.

## Commits

Conventional Commits (`feat:`, `fix:`, `chore:`, `refactor:`, `style:`, `test:`,
`docs:`, `perf:`, `build:`), scope optional e.g. `fix(mcp): …`. PRs should pass
`npm run check && npm test`; justify any `package-lock.json` churn.

## Areas that need extra care

Before changing these, read the corresponding doc first:
- Session/compaction, prompt layout, cache ordering → `docs/architecture.md` +
  `docs/session-persistence.md`.
- Tool permission scopes → `docs/permission.md` + `packages/core/src/common/permissions.ts`.
- MCP lifecycle → `docs/mcp.md` + `packages/core/src/mcp/`.
- Plan Mode (read-only first turn, `<proposed_plan>` approval) → `docs/plan-mode.md`.
- Skills discovery/loading → `docs/agent-skills.md`.
