import { useState, type JSX } from "react";
import type { McpServerStatus, SkillInfo } from "../../shared/ipc";
import { useI18n, type MessageKey } from "../i18n";

type Props = {
  servers: McpServerStatus[];
  skills: SkillInfo[];
  selectedSkills: string[];
  onToggleSkill: (name: string) => void;
  onReconnect: (name: string) => void;
  onClose: () => void;
};

type Tab = "skills" | "mcp";

const STATUS_COLOR: Record<string, string> = {
  ready: "var(--green)",
  starting: "var(--yellow)",
  reconnecting: "var(--yellow)",
  failed: "var(--red)",
};

function McpDetailList({
  label,
  items,
  cssClass,
}: {
  label: string;
  items: string[];
  cssClass: string;
}): JSX.Element | null {
  if (items.length === 0) return null;
  return (
    <div className="mcp-detail-section">
      <h4>
        {label} ({items.length})
      </h4>
      <div>
        {items.map((name) => (
          <span key={name} className={`mcp-tag ${cssClass}`}>
            {name}
          </span>
        ))}
      </div>
    </div>
  );
}

export function PluginCenterModal({
  servers,
  skills,
  selectedSkills,
  onToggleSkill,
  onReconnect,
  onClose,
}: Props): JSX.Element {
  const { t } = useI18n();
  const [tab, setTab] = useState<Tab>("skills");

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal modal-wide" onClick={(e) => e.stopPropagation()}>
        <h2>{t("plugins.title")}</h2>

        <div className="settings-tabs plugin-tabs">
          <button className={`settings-tab${tab === "skills" ? " active" : ""}`} onClick={() => setTab("skills")}>
            {t("plugins.tab.skills")}
            {skills.length > 0 ? <span className="pill-badge">{skills.length}</span> : null}
          </button>
          <button className={`settings-tab${tab === "mcp" ? " active" : ""}`} onClick={() => setTab("mcp")}>
            {t("plugins.tab.mcp")}
            {servers.length > 0 ? <span className="pill-badge">{servers.length}</span> : null}
          </button>
        </div>

        <div className="settings-body">
          {tab === "skills" ? (
            <>
              {skills.length === 0 ? (
                <div className="plugin-empty">{t("plugins.skills.none")}</div>
              ) : (
                skills.map((skill) => {
                  const isSelected = selectedSkills.includes(skill.name);
                  return (
                    <div key={skill.name} className="plugin-item">
                      <div className="plugin-item-main">
                        <div className="plugin-item-header">
                          <span className="plugin-item-name">
                            {skill.isLoaded ? "⚡ " : ""}
                            {skill.name}
                          </span>
                          {skill.isLoaded ? (
                            <span className="plugin-item-status">{t("plugins.skills.loaded")}</span>
                          ) : null}
                        </div>
                        {skill.description ? <div className="skill-desc">{skill.description}</div> : null}
                        {skill.path ? <div className="skill-path">{skill.path}</div> : null}
                      </div>
                      <label className="plugin-toggle" title={t("plugins.skills.attach")}>
                        <input type="checkbox" checked={isSelected} onChange={() => onToggleSkill(skill.name)} />
                        <span className="toggle-track" />
                      </label>
                    </div>
                  );
                })
              )}
            </>
          ) : null}

          {tab === "mcp" ? (
            <>
              {servers.length === 0 ? (
                <div className="plugin-empty">{t("mcp.none")}</div>
              ) : (
                servers.map((server) => (
                  <div key={server.name} className="plugin-item mcp-item">
                    <div className="plugin-item-main">
                      <div className="row">
                        <span style={{ fontWeight: 600 }}>
                          <span
                            className="status-dot"
                            style={{ background: STATUS_COLOR[server.status] ?? "var(--text-faint)", marginRight: 8 }}
                          />
                          {server.name}
                        </span>
                        <button
                          className="ghost"
                          onClick={() => onReconnect(server.name)}
                          disabled={server.status === "starting" || server.status === "reconnecting"}
                        >
                          {t("mcp.reconnect")}
                        </button>
                      </div>
                      <div className="mcp-tools">
                        {t(`mcpStatus.${server.status}` as MessageKey)}
                        {server.connected ? ` · ${t("mcp.toolsCount", { n: server.toolCount })}` : ""}
                        {server.error ? <span style={{ color: "var(--red)" }}> · {server.error}</span> : null}
                      </div>
                      <McpDetailList label="Tools" items={server.tools} cssClass="tool" />
                      <McpDetailList label="Prompts" items={server.prompts} cssClass="prompt" />
                      <McpDetailList label="Resources" items={server.resources} cssClass="resource" />
                    </div>
                  </div>
                ))
              )}
            </>
          ) : null}
        </div>

        <div className="card-actions">
          <button onClick={onClose}>{t("common.close")}</button>
        </div>
      </div>
    </div>
  );
}
