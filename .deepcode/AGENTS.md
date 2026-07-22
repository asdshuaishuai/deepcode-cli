# Repository Guidelines

## Project Structure & Module Organization

This is an **npm workspaces monorepo**. Packages live under `packages/`.

```
packages/
├── core/src/               # LLM session, tool execution, shared utilities
│   ├── common/             # File I/O, permissions, telemetry, OpenAI client, shell utils, error handling
│   ├── tools/              # 7 built-in handlers (bash, read, write, edit, ask-user-question, update-plan, web-search)
│   ├── mcp/                # MCP client & manager (JSON-RPC lifecycle)
│   ├── session.ts          # SessionManager — LLM loop, compaction, tool orchestration
│   ├── prompt.ts           # System prompt builder & tool definitions
│   └── settings.ts         # Settings resolution from ~/.deepcode/settings.json
├── cli/src/                # Terminal UI (Ink/React)
│   ├── cli.tsx             # Entry point — renders AppContainer
│   ├── cli-args.ts         # CLI argument parsing (yargs)
│   ├── ui/                 # Views, components, hooks, contexts, statusline, core (prompt buffer, slash commands)
│   └── tests/              # UI-focused tests with run-tests.mjs runner
├── desktop/                # Electron GUI client — React renderer, Metro/Fluent theme, IPC bridge, plugin manager
│   ├── src/main/           # Main process (engine session, file scanner, plugin manager)
│   ├── src/renderer/       # React renderer (components, UI primitives, i18n, Metro theme CSS)
│   ├── src/preload/        # Context-isolated preload with typed window.deepcode API
│   └── src/shared/         # Type-only IPC contract (dependency-free)
└── vscode-ide-companion/   # VSCode extension companion
docs/                       # User-facing documentation (configuration, MCP, permissions, plan-mode, etc.)
docs/superpowers/           # Design specs and implementation plans (Metro/Fluent theme, etc.)
scripts/                    # Build, release, and packaging scripts (build.js, esbuild.config.js, etc.)
```

Bundled CLI output: `packages/cli/dist/cli.js` (single file, gitignored). Templates and bundled skills are copied from `packages/core/templates/` to `packages/cli/dist/` during build. The root `AGENTS.md` (for Qoder agent) contains detailed architecture flows and layer rules.

## Build, Test, and Development Commands

All commands run from the repo root.

| Command | What it does |
|---|---|
| `npm run typecheck` | TypeScript type checking across all workspaces |
| `npm run lint` | ESLint on `packages/*/src/**/*.{ts,tsx}` + `scripts/*.js` |
| `npm run format` | Prettier on all source files |
| `npm run check` | Runs typecheck + lint + format:check together |
| `npm run build` | Builds core (tsc), rewrites ESM imports, then bundles CLI (esbuild) |
| `npm run bundle` | Generates git commit info + esbuild bundle + copies bundled assets |
| `npm test` | Runs all workspace tests |
| `npm run start` | Runs the locally built CLI |
| `npm run build-and-start` | Builds then starts the CLI |
| `npm run desktop:build` / `desktop:dev` / `desktop:start` | Build / dev / build+run the Electron desktop app |
| `npm run generate` | Generates build-time git commit info |

Single test: `node packages/<name>/src/tests/run-tests.mjs packages/<name>/src/tests/<file>.test.ts`

## Coding Style & Naming Conventions

- **Indentation**: 2 spaces, no tabs. **Quotes**: Double. **Semicolons**: Required.
- **Trailing commas**: `es5`. **Line width**: 120. **Line endings**: LF.
- **TypeScript**: Strict mode (`strict: true`). Use `import type` for type-only imports (`verbatimModuleSyntax`). Target ES2022, module ESNext with bundler resolution.
- **File naming**: `kebab-case.ts` for modules, `kebab-case.tsx` for React/Ink components. Test files: `*.test.ts`.
- **Formatting**: Prettier + ESLint (typescript-eslint, react-hooks). Husky + lint-staged auto-formats staged files on commit.
- **ESM note**: Core emits extensionless imports; `scripts/rewrite-esm-imports.js` adds `.js` after build.

## Testing Guidelines

- **Framework**: Node.js native test runner (`node:test`) with `tsx` for TypeScript. Assertions via `node:assert/strict`.
- **Coverage**: Unit tests for session management, tool handlers, permissions, MCP client, settings, telemetry.
- **Naming**: `describe`/`test` blocks with descriptive names.

## Commit & Pull Request Guidelines

**Commit messages** follow [conventional commits](https://www.conventionalcommits.org/): `feat:`, `fix:`, `chore:`, `refactor:`, `style:`, `test:`, `docs:`, `perf:`, `build:`. Scope optional, e.g. `fix(mcp): ...`.

**PRs** should include: clear description of what changed and why, link to related issues, screenshots for UI changes, all checks passing (`npm run check && npm test`), and justification for `package-lock.json` changes.

## Architecture Overview

The CLI (`@vegamo/deepcode-cli`) uses [Ink](https://github.com/vadimdemedes/ink) (React for terminals). `SessionManager` (in `@vegamo/deepcode-core`) drives the LLM loop: builds system prompts, streams responses, executes 7 built-in tools via `ToolExecutor`, and compacts context on token threshold exceedance.

**Plan Mode** (`/plan` or `Shift+Tab`): First turn is read-only; agent must produce `<proposed_plan>` for user approval before writes, deletions, or git mutations.

**Slash commands**: `/skills`, `/model`, `/plan`, `/new`, `/init`, `/resume`, `/continue`, `/undo`, `/mcp`, `/raw`, `/exit`, plus dynamic `/skill-name` for each loaded skill.

**CLI flags**: `-p <prompt>` / `--prompt`, `-r [sessionId]` / `--resume`, `-v` / `--version`, `-h` / `--help`.

## Agent-Specific Instructions

- **AGENTS.md loading**: Loaded from `./AGENTS.md`, `./.deepcode/AGENTS.md`, or `~/.deepcode/AGENTS.md` (first found wins). The root `./AGENTS.md` targets Qoder and contains detailed architecture flows — consult it for deep dives on session lifecycle, MCP, permissions, skills discovery, and IPC contracts.
- **Skills**: Place skill definitions in `~/.agents/skills/<name>/SKILL.md` (user-level) or `./.agents/skills/<name>/SKILL.md` (project-level). Legacy path `./.deepcode/skills/` also supported. Each SKILL.md uses YAML frontmatter with `name` and `description`.
- **Built-in skills**: Three bundled — `deepcode-self-refer` (CLI docs), `skill-digester` (install skills), `skill-writer` (create/debug skills). `karpathy-guidelines` is injected as a default skill template.
- **Prompt file references**: Use `@path/to/file` syntax to load file contents via the read tool.
