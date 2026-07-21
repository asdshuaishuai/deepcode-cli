import { useState, type JSX } from "react";
import type { McpServerStatus, SkillInfo } from "../../shared/ipc";
import { useI18n, type MessageKey } from "../i18n";
import { Badge, Button, Modal, Row, StatusDot, Switch } from "../ui/index";

type Props = {
  servers: McpServerStatus[];
  skills: SkillInfo[];
  selectedSkills: string[];
  onToggleSkill: (name: string) => void;
  onReconnect: (name: string) => void;
  onClose: () => void;
};

type Tab = "skills" | "mcp";

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
    <div className="ui-mcp-detail-section">
      <h4>
        {label} ({items.length})
      </h4>
      <div>
        {items.map((name) => (
          <span key={name} className={`ui-mcp-tag ${cssClass}`}>
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
    <Modal
      onClose={onClose}
      wide
      title={t("plugins.title")}
      actions={
        <Button size="sm" onClick={onClose}>
          {t("common.close")}
        </Button>
      }
    >
      <div className="ui-tabs">
        <button className={`ui-tab${tab === "skills" ? " active" : ""}`} onClick={() => setTab("skills")}>
          {t("plugins.tab.skills")}
          {skills.length > 0 ? <Badge>{skills.length}</Badge> : null}
        </button>
        <button className={`ui-tab${tab === "mcp" ? " active" : ""}`} onClick={() => setTab("mcp")}>
          {t("plugins.tab.mcp")}
          {servers.length > 0 ? <Badge>{servers.length}</Badge> : null}
        </button>
      </div>

      <div className="ui-settings-body">
        {tab === "skills" ? (
          <>
            {skills.length === 0 ? (
              <div className="ui-plugin-empty">{t("plugins.skills.none")}</div>
            ) : (
              skills.map((skill) => {
                const isSelected = selectedSkills.includes(skill.name);
                return (
                  <div key={skill.name} className="ui-plugin-item">
                    <div className="ui-plugin-item-main">
                      <div className="ui-plugin-item-header">
                        <span className="ui-plugin-item-name">
                          {skill.isLoaded ? "⚡ " : ""}
                          {skill.name}
                        </span>
                        {skill.isLoaded ? (
                          <span className="ui-plugin-item-status">{t("plugins.skills.loaded")}</span>
                        ) : null}
                      </div>
                      {skill.description ? <div className="ui-skill-desc">{skill.description}</div> : null}
                      {skill.path ? <div className="ui-skill-path">{skill.path}</div> : null}
                    </div>
                    <Switch
                      checked={isSelected}
                      onChange={() => onToggleSkill(skill.name)}
                      title={t("plugins.skills.attach")}
                    />
                  </div>
                );
              })
            )}
          </>
        ) : null}

        {tab === "mcp" ? (
          <>
            {servers.length === 0 ? (
              <div className="ui-plugin-empty">{t("mcp.none")}</div>
            ) : (
              servers.map((server) => (
                <div key={server.name} className="ui-plugin-item">
                  <div className="ui-plugin-item-main">
                    <Row justify="space-between">
                      <span style={{ fontWeight: 600, display: "inline-flex", alignItems: "center", gap: 8 }}>
                        <StatusDot status={server.status} />
                        {server.name}
                      </span>
                      <Button
                        size="sm"
                        onClick={() => onReconnect(server.name)}
                        disabled={server.status === "starting" || server.status === "reconnecting"}
                      >
                        {t("mcp.reconnect")}
                      </Button>
                    </Row>
                    <div className="ui-skill-desc">
                      {t(`mcpStatus.${server.status}` as MessageKey)}
                      {server.connected ? ` · ${t("mcp.toolsCount", { n: server.toolCount })}` : ""}
                      {server.error ? <span style={{ color: "var(--ui-danger)" }}> · {server.error}</span> : null}
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
    </Modal>
  );
}
