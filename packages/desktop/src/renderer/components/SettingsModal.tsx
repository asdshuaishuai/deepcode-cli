import { useState, type JSX } from "react";
import type {
  EditableMcpServer,
  EditableSettings,
  PermissionDecision,
  PermissionScope,
  ReasoningEffort,
} from "../../shared/ipc";
import { useI18n, type MessageKey } from "../i18n";

type Props = {
  initial: EditableSettings;
  onSave: (next: EditableSettings) => void;
  onClose: () => void;
};

type Tab = "connection" | "model" | "permissions" | "mcp";

const TABS: { id: Tab; labelKey: MessageKey }[] = [
  { id: "connection", labelKey: "settings.tab.connection" },
  { id: "model", labelKey: "settings.tab.model" },
  { id: "permissions", labelKey: "settings.tab.permissions" },
  { id: "mcp", labelKey: "settings.tab.mcp" },
];

const PERMISSION_SCOPES: PermissionScope[] = [
  "read-in-cwd",
  "read-out-cwd",
  "write-in-cwd",
  "write-out-cwd",
  "delete-in-cwd",
  "delete-out-cwd",
  "query-git-log",
  "mutate-git-log",
  "network",
  "mcp",
];

const DECISIONS: PermissionDecision[] = ["default", "allow", "ask", "deny"];

const REASONING_OPTIONS: ReasoningEffort[] = ["max", "high"];

function emptyServer(): EditableMcpServer {
  return { name: "", command: "", args: "", env: "" };
}

export function SettingsModal({ initial, onSave, onClose }: Props): JSX.Element {
  const { t, locale, setLocale } = useI18n();
  const [s, setS] = useState<EditableSettings>(initial);
  const [tab, setTab] = useState<Tab>("connection");
  const [showKey, setShowKey] = useState(false);

  function patch(partial: Partial<EditableSettings>): void {
    setS((prev) => ({ ...prev, ...partial }));
  }

  function setPermission(scope: PermissionScope, decision: PermissionDecision): void {
    setS((prev) => {
      const permissions = { ...prev.permissions };
      if (decision === "default") {
        delete permissions[scope];
      } else {
        permissions[scope] = decision;
      }
      return { ...prev, permissions };
    });
  }

  function updateServer(index: number, partial: Partial<EditableMcpServer>): void {
    setS((prev) => {
      const mcpServers = prev.mcpServers.map((server, i) => (i === index ? { ...server, ...partial } : server));
      return { ...prev, mcpServers };
    });
  }

  function addServer(): void {
    setS((prev) => ({ ...prev, mcpServers: [...prev.mcpServers, emptyServer()] }));
  }

  function removeServer(index: number): void {
    setS((prev) => ({ ...prev, mcpServers: prev.mcpServers.filter((_, i) => i !== index) }));
  }

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal modal-wide" onClick={(e) => e.stopPropagation()}>
        <h2>{t("settings.title")}</h2>
        <div className="settings-target">
          {t("settings.savingTo")} <code>{s.saveTargetPath}</code> (
          {s.saveTarget === "project" ? t("settings.target.project") : t("settings.target.user")})
        </div>

        <div className="settings-tabs">
          {TABS.map((item) => (
            <button
              key={item.id}
              className={`settings-tab${tab === item.id ? " active" : ""}`}
              onClick={() => setTab(item.id)}
            >
              {t(item.labelKey)}
            </button>
          ))}
        </div>

        <div className="settings-body">
          {tab === "connection" ? (
            <>
              <div className="field">
                <label>{t("settings.apiKey")}</label>
                <div className="row-inline">
                  <input
                    type={showKey ? "text" : "password"}
                    value={s.apiKey}
                    placeholder="sk-…"
                    autoComplete="off"
                    onChange={(e) => patch({ apiKey: e.target.value })}
                  />
                  <button className="ghost" onClick={() => setShowKey((v) => !v)}>
                    {showKey ? t("common.hide") : t("common.show")}
                  </button>
                </div>
                {s.hasEnvApiKey ? <div className="hint warn">{t("settings.envOverride")}</div> : null}
              </div>

              <div className="field">
                <label>{t("settings.baseUrl")}</label>
                <input
                  type="text"
                  value={s.baseURL}
                  placeholder="https://api.deepseek.com"
                  onChange={(e) => patch({ baseURL: e.target.value })}
                />
                <div className="hint">{t("settings.baseUrlHint")}</div>
              </div>

              <div className="field">
                <label>{t("settings.model")}</label>
                <input
                  type="text"
                  value={s.model}
                  placeholder="deepseek-v4-pro"
                  onChange={(e) => patch({ model: e.target.value })}
                />
              </div>

              <div className="field">
                <label>{t("settings.temperature")}</label>
                <input
                  type="text"
                  value={s.temperature}
                  placeholder={t("settings.temperaturePlaceholder")}
                  onChange={(e) => patch({ temperature: e.target.value })}
                />
                <div className="hint">{t("settings.temperatureHint")}</div>
              </div>

              <div className="field">
                <label>{t("settings.language")}</label>
                <select value={locale} onChange={(e) => setLocale(e.target.value as "en" | "zh")}>
                  <option value="zh">中文</option>
                  <option value="en">English</option>
                </select>
              </div>
            </>
          ) : null}

          {tab === "model" ? (
            <>
              <div className="field">
                <label className="check">
                  <input
                    type="checkbox"
                    checked={s.thinkingEnabled}
                    onChange={(e) => patch({ thinkingEnabled: e.target.checked })}
                  />
                  {t("settings.thinkingMode")}
                </label>
              </div>

              {s.thinkingEnabled ? (
                <div className="field">
                  <label>{t("settings.reasoningEffort")}</label>
                  <select
                    value={s.reasoningEffort}
                    onChange={(e) => patch({ reasoningEffort: e.target.value as ReasoningEffort })}
                  >
                    {REASONING_OPTIONS.map((r) => (
                      <option key={r} value={r}>
                        {r}
                      </option>
                    ))}
                  </select>
                </div>
              ) : null}

              <div className="field">
                <label className="check">
                  <input
                    type="checkbox"
                    checked={s.telemetryEnabled}
                    onChange={(e) => patch({ telemetryEnabled: e.target.checked })}
                  />
                  {t("settings.telemetry")}
                </label>
              </div>

              <div className="field">
                <label className="check">
                  <input
                    type="checkbox"
                    checked={s.debugLogEnabled}
                    onChange={(e) => patch({ debugLogEnabled: e.target.checked })}
                  />
                  {t("settings.debugLog")}
                </label>
              </div>
            </>
          ) : null}

          {tab === "permissions" ? (
            <>
              <div className="field">
                <label>{t("settings.defaultMode")}</label>
                <select
                  value={s.permissionDefaultMode}
                  onChange={(e) =>
                    patch({ permissionDefaultMode: e.target.value as EditableSettings["permissionDefaultMode"] })
                  }
                >
                  <option value="allowAll">{t("settings.allowAll")}</option>
                  <option value="askAll">{t("settings.askAll")}</option>
                </select>
                <div className="hint">{t("settings.permHint")}</div>
              </div>

              {PERMISSION_SCOPES.map((scope) => (
                <div className="perm-row" key={scope}>
                  <div className="perm-label">
                    <div>{t(`permScope.${scope}.label` as MessageKey)}</div>
                    <div className="hint">{t(`permScope.${scope}.hint` as MessageKey)}</div>
                  </div>
                  <select
                    value={s.permissions[scope] ?? "default"}
                    onChange={(e) => setPermission(scope, e.target.value as PermissionDecision)}
                  >
                    {DECISIONS.map((d) => (
                      <option key={d} value={d}>
                        {t(`decision.${d}` as MessageKey)}
                      </option>
                    ))}
                  </select>
                </div>
              ))}
            </>
          ) : null}

          {tab === "mcp" ? (
            <>
              {s.mcpServers.length === 0 ? <div className="hint">{t("settings.mcpNone")}</div> : null}
              {s.mcpServers.map((server, i) => (
                <div className="mcp-editor" key={i}>
                  <div className="row-inline">
                    <input
                      type="text"
                      value={server.name}
                      placeholder={t("settings.serverName")}
                      onChange={(e) => updateServer(i, { name: e.target.value })}
                    />
                    <button className="ghost danger" onClick={() => removeServer(i)}>
                      {t("common.remove")}
                    </button>
                  </div>
                  <input
                    type="text"
                    value={server.command}
                    placeholder={t("settings.command")}
                    onChange={(e) => updateServer(i, { command: e.target.value })}
                  />
                  <input
                    type="text"
                    value={server.args}
                    placeholder={t("settings.args")}
                    onChange={(e) => updateServer(i, { args: e.target.value })}
                  />
                  <textarea
                    value={server.env}
                    placeholder={t("settings.envLines")}
                    rows={2}
                    onChange={(e) => updateServer(i, { env: e.target.value })}
                  />
                </div>
              ))}
              <button className="ghost" onClick={addServer}>
                {t("settings.addServer")}
              </button>
            </>
          ) : null}
        </div>

        <div className="card-actions">
          <button className="primary" onClick={() => onSave(s)}>
            {t("common.save")}
          </button>
          <button onClick={onClose}>{t("common.cancel")}</button>
        </div>
      </div>
    </div>
  );
}
