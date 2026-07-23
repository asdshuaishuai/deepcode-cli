import { useCallback, useEffect, useMemo, useState, type JSX } from "react";
import type { BuiltinPluginInfo, PluginMcpServer, SkillInfo } from "../../shared/ipc";
import { api } from "../api";
import { useI18n } from "../i18n";
import { renderMarkdown } from "../markdown";
import { Button, StatusDot, Switch } from "../ui/index";

/** Which plugin the workspace detail pane is showing. */
export type PluginSelection = { kind: "mcp" | "skill" | "plugin"; name: string };

type Props = {
  selection: PluginSelection | null;
  skills: SkillInfo[];
  selectedSkills: string[];
  onToggleSkill: (name: string) => void;
  onBack: () => void;
};

/** Derived provenance for an MCP server, inferred from its launch command. */
type McpSource = {
  label: string;
  registryUrl?: string;
  repoUrl?: string;
  author?: string;
};

// Curated repo/author metadata for well-known package scopes. MCP stdio configs
// carry no authorship, so we only claim it where the scope is unambiguous.
const KNOWN_SCOPES: Record<string, { repoUrl: string; author: string }> = {
  "@modelcontextprotocol": {
    repoUrl: "https://github.com/modelcontextprotocol/servers",
    author: "Anthropic · Model Context Protocol",
  },
};

function firstPackageArg(args: string): string | undefined {
  for (const tok of args.split(/\s+/).filter(Boolean)) {
    if (tok.startsWith("-")) continue;
    return tok;
  }
  return undefined;
}

/** Best-effort provenance from `command`/`args` — npm, PyPI, or a local binary. */
function deriveMcpSource(command: string, args: string): McpSource {
  const base = (command.trim().split(/[\\/]/).pop() ?? command).toLowerCase();

  if (["npx", "npm", "pnpm", "bunx", "node"].includes(base)) {
    const pkg = firstPackageArg(args);
    if (pkg && !/\.(m?js|cjs|ts)$/.test(pkg)) {
      const scope = pkg.startsWith("@") ? pkg.slice(0, pkg.indexOf("/")) : undefined;
      const known = scope ? KNOWN_SCOPES[scope] : undefined;
      return {
        label: `npm · ${pkg}`,
        registryUrl: `https://www.npmjs.com/package/${pkg}`,
        repoUrl: known?.repoUrl,
        author: known?.author,
      };
    }
  }

  if (["uvx", "uv", "pipx", "python", "python3"].includes(base)) {
    const pkg = firstPackageArg(args);
    if (pkg) return { label: `PyPI · ${pkg}`, registryUrl: `https://pypi.org/project/${pkg}/` };
  }

  if (command.includes("/") || command.includes("\\") || command.startsWith(".")) {
    return { label: command };
  }
  return { label: command };
}

/** Human label for where a skill's SKILL.md lives, from its display path. */
function skillSourceLabel(path: string): string {
  if (path.startsWith("bundled:")) return "Bundled";
  if (path.startsWith("~/") || path.startsWith("~\\")) return "Home (~)";
  if (path.startsWith("./") || path.startsWith(".\\")) return "Project";
  return path;
}

/** Drop the YAML frontmatter block so only the readable body is rendered. */
function stripFrontmatter(md: string): string {
  if (!md.startsWith("---")) return md;
  const end = md.indexOf("\n---", 3);
  if (end === -1) return md;
  const after = md.indexOf("\n", end + 1);
  return after === -1 ? "" : md.slice(after + 1);
}

/**
 * VSCode-style plugin detail pane (item 3): the left list carries basic info,
 * this workspace pane carries the full picture. Skills render their SKILL.md;
 * MCP servers show meta/capabilities/source with author + repo when derivable.
 */
export function PluginDetail({ selection, skills, selectedSkills, onToggleSkill, onBack }: Props): JSX.Element {
  const { t } = useI18n();
  const [servers, setServers] = useState<PluginMcpServer[]>([]);
  const [doc, setDoc] = useState<string>("");
  const [docError, setDocError] = useState(false);

  const reloadServers = useCallback(async () => setServers(await api.pluginMcpList()), []);

  useEffect(() => {
    void reloadServers();
    return api.onMcpStatusChanged(() => void reloadServers());
  }, [reloadServers]);

  const skill = useMemo(
    () => (selection?.kind === "skill" ? (skills.find((s) => s.name === selection.name) ?? null) : null),
    [selection, skills]
  );

  useEffect(() => {
    if (!skill) {
      setDoc("");
      setDocError(false);
      return;
    }
    let cancelled = false;
    setDoc("");
    setDocError(false);
    api
      .pluginReadSkillDoc(skill.path)
      .then((md) => {
        if (!cancelled) setDoc(md);
      })
      .catch(() => {
        if (!cancelled) setDocError(true);
      });
    return () => {
      cancelled = true;
    };
  }, [skill]);

  if (!selection) {
    return (
      <div className="ui-plugin-detail">
        <div className="ui-plugin-detail-empty">{t("plugins.detail.empty")}</div>
      </div>
    );
  }

  if (selection.kind === "skill") {
    if (!skill) {
      return (
        <div className="ui-plugin-detail">
          <div className="ui-plugin-detail-empty">{t("plugins.detail.empty")}</div>
        </div>
      );
    }
    const attached = selectedSkills.includes(skill.name);
    return (
      <div className="ui-plugin-detail">
        <header className="ui-plugin-detail-head">
          <div className="ui-plugin-detail-title">
            <span className="ui-plugin-detail-name">{skill.name}</span>
            {skill.isLoaded ? <span className="ui-mcp-badge">{t("plugins.skills.loaded")}</span> : null}
          </div>
          <div className="ui-plugin-detail-actions">
            <label className="ui-plugin-detail-toggle">
              <span>{t("plugins.skills.attach")}</span>
              <Switch checked={attached} onChange={() => onToggleSkill(skill.name)} />
            </label>
          </div>
        </header>

        {skill.description ? <p className="ui-plugin-detail-lead">{skill.description}</p> : null}

        <section className="ui-plugin-detail-section">
          <h3>{t("plugins.detail.source")}</h3>
          <dl className="ui-plugin-meta">
            <dt>{skillSourceLabel(skill.path)}</dt>
            <dd className="ui-plugin-mono">{skill.path}</dd>
          </dl>
        </section>

        <section className="ui-plugin-detail-section">
          <h3>{t("plugins.detail.doc")}</h3>
          {docError ? (
            <div className="ui-plugin-detail-empty">{t("plugins.detail.docError")}</div>
          ) : (
            <div className="ui-md" dangerouslySetInnerHTML={{ __html: renderMarkdown(stripFrontmatter(doc)) }} />
          )}
        </section>
      </div>
    );
  }

  // ── Built-in plugin detail ─────────────────────────────────────────────────
  if (selection.kind === "plugin") {
    return <BuiltinPluginDetail name={selection.name} />;
  }

  const server = servers.find((s) => s.name === selection.name) ?? null;
  if (!server) {
    return (
      <div className="ui-plugin-detail">
        <div className="ui-plugin-detail-empty">{t("plugins.detail.empty")}</div>
      </div>
    );
  }

  const source = deriveMcpSource(server.command, server.args);
  const status = server.status;
  const hasCaps =
    !!status &&
    ((status.tools?.length ?? 0) > 0 || (status.prompts?.length ?? 0) > 0 || (status.resources?.length ?? 0) > 0);

  const setEnabled = async (enabled: boolean) => {
    await api.pluginSetMcpEnabled(server.name, enabled);
    await reloadServers();
  };
  const remove = async () => {
    await api.pluginRemoveMcpServer(server.name);
    await reloadServers();
    onBack();
  };

  return (
    <div className="ui-plugin-detail">
      <header className="ui-plugin-detail-head">
        <div className="ui-plugin-detail-title">
          {status ? <StatusDot status={status.status} /> : <StatusDot />}
          <span className="ui-plugin-detail-name">{server.name}</span>
          {server.builtin ? <span className="ui-mcp-badge">{t("mcp.builtin")}</span> : null}
        </div>
        <div className="ui-plugin-detail-actions">
          <label className="ui-plugin-detail-toggle">
            <span>{t("mcp.enableTitle")}</span>
            <Switch checked={server.enabled} onChange={() => void setEnabled(!server.enabled)} />
          </label>
          {server.builtin ? null : (
            <Button size="sm" variant="subtle" onClick={() => void remove()} title={t("mcp.removeTitle")}>
              {t("common.remove")}
            </Button>
          )}
        </div>
      </header>

      <section className="ui-plugin-detail-section">
        <h3>{t("plugins.detail.overview")}</h3>
        <dl className="ui-plugin-meta">
          <dt>{t("mcp.command")}</dt>
          <dd className="ui-plugin-mono">
            {server.command} {server.args}
          </dd>
          {server.env.trim() ? (
            <>
              <dt>{t("mcp.env")}</dt>
              <dd className="ui-plugin-mono">{server.env}</dd>
            </>
          ) : null}
        </dl>
      </section>

      <section className="ui-plugin-detail-section">
        <h3>{t("plugins.detail.source")}</h3>
        <dl className="ui-plugin-meta">
          <dt>{source.label}</dt>
          {source.registryUrl ? <dd className="ui-plugin-mono">{source.registryUrl}</dd> : null}
          {source.repoUrl ? (
            <>
              <dt>{t("plugins.detail.repository")}</dt>
              <dd className="ui-plugin-mono">{source.repoUrl}</dd>
            </>
          ) : null}
          {source.author ? (
            <>
              <dt>{t("plugins.detail.author")}</dt>
              <dd>{source.author}</dd>
            </>
          ) : null}
        </dl>
      </section>

      <section className="ui-plugin-detail-section">
        <h3>{t("plugins.detail.capabilities")}</h3>
        {hasCaps ? (
          <div className="ui-plugin-caps">
            {status!.tools?.length ? (
              <div className="ui-plugin-cap-group">
                <span className="ui-plugin-cap-label">
                  {t("plugins.detail.tools")} · {status!.tools.length}
                </span>
                <div className="ui-plugin-cap-list">
                  {status!.tools.map((tool) => (
                    <span key={tool} className="ui-plugin-cap-chip">
                      {tool}
                    </span>
                  ))}
                </div>
              </div>
            ) : null}
            {status!.prompts?.length ? (
              <div className="ui-plugin-cap-group">
                <span className="ui-plugin-cap-label">
                  {t("plugins.detail.prompts")} · {status!.prompts.length}
                </span>
                <div className="ui-plugin-cap-list">
                  {status!.prompts.map((p) => (
                    <span key={p} className="ui-plugin-cap-chip">
                      {p}
                    </span>
                  ))}
                </div>
              </div>
            ) : null}
            {status!.resources?.length ? (
              <div className="ui-plugin-cap-group">
                <span className="ui-plugin-cap-label">
                  {t("plugins.detail.resources")} · {status!.resources.length}
                </span>
                <div className="ui-plugin-cap-list">
                  {status!.resources.map((r) => (
                    <span key={r} className="ui-plugin-cap-chip">
                      {r}
                    </span>
                  ))}
                </div>
              </div>
            ) : null}
          </div>
        ) : (
          <div className="ui-plugin-detail-empty">{t("plugins.detail.noCapabilities")}</div>
        )}
      </section>
    </div>
  );
}

/** Detail pane for an Orca built-in plugin (non-removable). */
function BuiltinPluginDetail({ name }: { name: string }): JSX.Element {
  const { t } = useI18n();
  const [info, setInfo] = useState<BuiltinPluginInfo | null>(null);
  const [doc, setDoc] = useState("");
  const [docError, setDocError] = useState(false);

  // Load plugin metadata first.
  useEffect(() => {
    let cancelled = false;
    api
      .pluginBuiltinList()
      .then((list) => {
        if (!cancelled) setInfo(list.find((p) => p.name === name) ?? null);
      })
      .catch(() => {
        /* noop – info stays null */
      });
    return () => {
      cancelled = true;
    };
  }, [name]);

  // Once info is available, derive the directory name from `path` (format:
  // "builtin-plugin:<dirName>") so the doc read is correct even when the
  // manifest name differs from the folder name.
  useEffect(() => {
    if (!info) return;
    let cancelled = false;
    const dirName = info.path.replace(/^builtin-plugin:/, "");
    setDoc("");
    setDocError(false);
    api
      .pluginBuiltinReadDoc(dirName)
      .then((md) => {
        if (!cancelled) setDoc(md);
      })
      .catch(() => {
        if (!cancelled) setDocError(true);
      });
    return () => {
      cancelled = true;
    };
  }, [info]);

  return (
    <div className="ui-plugin-detail">
      <header className="ui-plugin-detail-head">
        <div className="ui-plugin-detail-title">
          <span className="ui-plugin-detail-name">{name}</span>
          <span className="ui-mcp-badge builtin">{t("plugins.builtin.badge")}</span>
        </div>
      </header>

      {info?.description ? <p className="ui-plugin-detail-lead">{info.description}</p> : null}

      <section className="ui-plugin-detail-section">
        <h3>{t("plugins.detail.source")}</h3>
        <dl className="ui-plugin-meta">
          <dt>{t("plugins.builtin.badge")}</dt>
          <dd className="ui-plugin-mono">{info ? `v${info.version} · ${info.category}` : ""}</dd>
        </dl>
      </section>

      <section className="ui-plugin-detail-section">
        <h3>{t("plugins.detail.doc")}</h3>
        {docError ? (
          <div className="ui-plugin-detail-empty">{t("plugins.detail.docError")}</div>
        ) : doc ? (
          <div className="ui-md" dangerouslySetInnerHTML={{ __html: renderMarkdown(doc) }} />
        ) : null}
      </section>
    </div>
  );
}
