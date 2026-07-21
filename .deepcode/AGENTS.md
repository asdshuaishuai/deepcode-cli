# Repository Guidelines

## Project Structure & Module Organization

This is an **npm workspaces monorepo**. Packages live under `packages/`.

```
packages/
├── core/src/               # LLM session, tool execution, shared utilities
│   ├── common/             # File I/O, permissions, telemetry, OpenAI client, shell utils, error handling, etc.
│   ├── tools/              # 7 built-in handlers (bash, read, write, edit, ask-user-question, update-plan, web-search)
│   ├── mcp/                # MCP client & manager (JSON-RPC lifecycle)
│   ├── session.ts          # SessionManager — LLM loop, compaction, tool orchestration
│   ├── prompt.ts           # System prompt builder & tool definitions
│   └── settings.ts         # Settings resolution from ~/.deepcode/settings.json
├── cli/src/                # Terminal UI (Ink/React)
│   ├── cli.tsx             # Entry point — renders AppContainer
│   ├── cli-args.ts         # CLI argument parsing (yargs: -p, -r, -v, -h)
│   ├── ui/                 # Views, components, hooks, contexts, statusline, core (prompt buffer, slash commands)
│   └── tests/              # UI-focused tests with run-tests.mjs runner
├── desktop/                # Electron GUI client built on top of the core engine
└── vscode-ide-companion/   # VSCode extension companion
docs/                       # User-facing documentation (configuration, MCP, permissions, plan-mode, etc.)
scripts/                    # Build, release, and packaging scripts
```

Bundled CLI output: `packages/cli/dist/cli.js` (single file, gitignored). Templates and bundled skills are copied from `packages/core/templates/` to `packages/cli/dist/` during build.

## Build, Test, and Development Commands

All commands run from the repo root.

| Command | What it does |
|---|---|
| `npm run typecheck` | TypeScript type checking across all workspaces |
| `npm run lint` | ESLint across `packages/*/src/**/*.{ts,tsx}` + `scripts/*.js` |
| `npm run format` | Prettier on all source files |
| `npm run check` | Runs typecheck + lint + format:check together |
| `npm run build` | Builds core, rewrites ESM imports, then bundles CLI (scripts/build.js) |
| `npm run bundle` | Generates git commit info + esbuild bundle + copies bundled assets |
| `npm test` | Runs all workspace tests |
| `npm run start` | Runs the locally built CLI (scripts/start.js) |
| `npm run build-and-start` | Builds then starts the CLI |
| `npm run clean` | Removes generated files and dist directories |
| `npm run generate` | Generates build-time git commit info |
| `npm run desktop:build` | Builds the Electron desktop package |
| `npm run desktop:dev` | Runs the desktop package in development mode |
| `npm run release:version` | Bumps version across all packages |

Run a single test file: `node packages/<name>/src/tests/run-tests.mjs packages/<name>/src/tests/<file>.test.ts`

Run the CLI locally: `node packages/cli/dist/cli.js` (after `npm run bundle`).

## Coding Style & Naming Conventions

- **Indentation**: 2 spaces, no tabs. **Quotes**: Double. **Semicolons**: Required.
- **Trailing commas**: `es5`. **Line width**: 120. **Line endings**: LF.
- **TypeScript**: Strict mode (`strict: true`). Use `import type` for type-only imports. Target ES2022, module ESNext with bundler resolution. JSX is `react-jsx`.
- **File naming**: `kebab-case.ts` for modules, `kebab-case.tsx` for React/Ink components. Test files: `*.test.ts`.
- **Formatting/Linting**: Prettier + ESLint (typescript-eslint, react-hooks). Run `npm run check` before pushing. On commit, Husky + lint-staged auto-formats staged `*.{ts,tsx,js,mjs,cjs,jsx}` and `*.json` files.

## Testing Guidelines

- **Framework**: Node.js native test runner (`node:test`) with `tsx` for TypeScript.
- **Assertions**: `node:assert/strict`.
- **Coverage**: Target meaningful unit tests for session management, tool handlers, settings resolution, permissions, MCP client, and telemetry.
- **Test naming**: `describe`/`test` blocks with descriptive names.
- Run all tests with `npm test`. Each package has its own `run-tests.mjs` cross-platform runner.

## Commit & Pull Request Guidelines

**Commit messages** follow [conventional commits](https://www.conventionalcommits.org/):

- `feat:` — new feature (e.g., `feat: add /model command`)
- `fix:` — bug fix (e.g., `fix(mcp): fix Windows MCP spawn double-quoting`)
- `chore:` — tooling, deps, hooks (e.g., `chore: add husky + lint-staged`)
- `refactor:` — code restructuring (e.g., `refactor(ui): optimize App hooks`)
- `style:`, `test:`, `docs:`, `perf:`, `build:` — formatting, tests, documentation, performance, build system

**Pull requests** should include:
- Clear description of what changed and why
- Link to related issue(s) if applicable
- Screenshots or terminal recordings for UI changes
- All checks passing (`npm run check && npm test`)
- No unintended changes to `package-lock.json` without justification

## Architecture Overview

The CLI (`@vegamo/deepcode-cli`) renders a terminal UI using [Ink](https://github.com/vadimdemedes/ink) (React for terminals). `SessionManager` (in `@vegamo/deepcode-core`) drives the LLM interaction loop: it builds system prompts, sends user messages with optional skills/images, streams responses, executes tool calls via `ToolExecutor`, and compacts context when token thresholds are exceeded. OpenAI client connectivity is managed by `createOpenAIClient()` with a 180-second keep-alive timeout.

Seven built-in tools are available to the LLM: `bash`, `read`, `write`, `edit`, `AskUserQuestion`, `UpdatePlan`, and `WebSearch`. The `read` tool returns a `snippet_id` required by subsequent `edit` calls. A **permission system** controls tool execution scopes (read/write/delete/network/git-log) with configurable allow/deny/ask decisions. A **file history system** provides undo/checkpoint support via lightweight Git branches.

**Plan Mode** (`/plan` or `Shift+Tab`): Restricts the agent to read-only operations on the first turn, requiring a task plan via `<proposed_plan>` for user approval before any writes, deletions, or git mutations.

**Slash commands**: `/skills`, `/model`, `/plan`, `/new`, `/init`, `/resume`, `/continue`, `/undo`, `/mcp`, `/raw`, `/exit`, plus dynamic `/skill-name` for each loaded skill.

**Key UI features**: `@` file mentions, `Ctrl+O` to view live process stdout, `Ctrl+V` to paste images, `Ctrl+X` to clear images, Shift+Enter for newlines, pluggable statusline, MCP server status display, undo selector, and permission prompts.

**CLI flags**: `-p <prompt>` / `--prompt`, `-r [sessionId]` / `--resume`, `-v` / `--version`, `-h` / `--help`.

## Agent-Specific Instructions

- **AGENTS.md loading**: The CLI loads agent instructions from `./AGENTS.md`, `./.deepcode/AGENTS.md`, or `~/.deepcode/AGENTS.md` (first found wins).
- **Skills**: Place skill definitions in `~/.agents/skills/<name>/SKILL.md` (user-level) or `./.agents/skills/<name>/SKILL.md` (project-level). Legacy path `./.deepcode/skills/` is also supported. Each SKILL.md uses YAML frontmatter with `name` and `description` fields.
- **Built-in skills**: Three bundled skills ship with the CLI — `deepcode-self-refer` (Deep Code CLI documentation), `skill-digester` (digest & install skills), and `skill-writer` (create & debug skills). Additionally, `karpathy-guidelines` is injected as a default skill template.
- **Prompt file references**: Use `@path/to/file` syntax in prompts to load file contents through the read tool.
