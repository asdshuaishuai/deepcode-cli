import { useState, type JSX } from "react";
import type {
  EditableMcpServer,
  EditableSettings,
  PermissionDecision,
  PermissionScope,
  ReasoningEffort,
} from "../../shared/ipc";
import { useI18n, type MessageKey } from "../i18n";
import { Button, Checkbox, Field, Input, Modal, Select, TextArea } from "../ui/index";

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
    <Modal
      onClose={onClose}
      wide
      title={t("settings.title")}
      actions={
        <>
          <Button variant="primary" size="sm" onClick={() => onSave(s)}>
            {t("common.save")}
          </Button>
          <Button size="sm" onClick={onClose}>
            {t("common.cancel")}
          </Button>
        </>
      }
    >
      <div className="ui-settings-target">
        {t("settings.savingTo")} <code>{s.saveTargetPath}</code> (
        {s.saveTarget === "project" ? t("settings.target.project") : t("settings.target.user")})
      </div>

      <div className="ui-tabs">
        {TABS.map((item) => (
          <button key={item.id} className={`ui-tab${tab === item.id ? " active" : ""}`} onClick={() => setTab(item.id)}>
            {t(item.labelKey)}
          </button>
        ))}
      </div>

      <div className="ui-settings-body">
        {tab === "connection" ? (
          <>
            <Field label={t("settings.apiKey")} hint={s.hasEnvApiKey ? t("settings.envOverride") : undefined} hintWarn>
              <div className="ui-row-inline">
                <Input
                  type={showKey ? "text" : "password"}
                  value={s.apiKey}
                  placeholder="sk-…"
                  autoComplete="off"
                  onChange={(e) => patch({ apiKey: e.target.value })}
                />
                <Button variant="ghost" size="sm" onClick={() => setShowKey((v) => !v)}>
                  {showKey ? t("common.hide") : t("common.show")}
                </Button>
              </div>
            </Field>

            <Field label={t("settings.baseUrl")} hint={t("settings.baseUrlHint")}>
              <Input
                type="text"
                value={s.baseURL}
                placeholder="https://api.deepseek.com"
                onChange={(e) => patch({ baseURL: e.target.value })}
              />
            </Field>

            <Field label={t("settings.model")}>
              <Input
                type="text"
                value={s.model}
                placeholder="deepseek-v4-pro"
                onChange={(e) => patch({ model: e.target.value })}
              />
            </Field>

            <Field label={t("settings.temperature")} hint={t("settings.temperatureHint")}>
              <Input
                type="text"
                value={s.temperature}
                placeholder={t("settings.temperaturePlaceholder")}
                onChange={(e) => patch({ temperature: e.target.value })}
              />
            </Field>

            <Field label={t("settings.language")}>
              <Select value={locale} onChange={(e) => setLocale(e.target.value as "en" | "zh")}>
                <option value="zh">中文</option>
                <option value="en">English</option>
              </Select>
            </Field>
          </>
        ) : null}

        {tab === "model" ? (
          <>
            <Field>
              <Checkbox
                checked={s.thinkingEnabled}
                onChange={(e) => patch({ thinkingEnabled: e.target.checked })}
                label={t("settings.thinkingMode")}
              />
            </Field>

            {s.thinkingEnabled ? (
              <Field label={t("settings.reasoningEffort")}>
                <Select
                  value={s.reasoningEffort}
                  onChange={(e) => patch({ reasoningEffort: e.target.value as ReasoningEffort })}
                >
                  {REASONING_OPTIONS.map((r) => (
                    <option key={r} value={r}>
                      {r}
                    </option>
                  ))}
                </Select>
              </Field>
            ) : null}

            <Field>
              <Checkbox
                checked={s.telemetryEnabled}
                onChange={(e) => patch({ telemetryEnabled: e.target.checked })}
                label={t("settings.telemetry")}
              />
            </Field>

            <Field>
              <Checkbox
                checked={s.debugLogEnabled}
                onChange={(e) => patch({ debugLogEnabled: e.target.checked })}
                label={t("settings.debugLog")}
              />
            </Field>
          </>
        ) : null}

        {tab === "permissions" ? (
          <>
            <Field label={t("settings.defaultMode")} hint={t("settings.permHint")}>
              <Select
                value={s.permissionDefaultMode}
                onChange={(e) =>
                  patch({ permissionDefaultMode: e.target.value as EditableSettings["permissionDefaultMode"] })
                }
              >
                <option value="allowAll">{t("settings.allowAll")}</option>
                <option value="askAll">{t("settings.askAll")}</option>
              </Select>
            </Field>

            {PERMISSION_SCOPES.map((scope) => (
              <div className="ui-perm-row" key={scope}>
                <div className="ui-perm-label">
                  <div>{t(`permScope.${scope}.label` as MessageKey)}</div>
                  <div className="ui-field-hint">{t(`permScope.${scope}.hint` as MessageKey)}</div>
                </div>
                <Select
                  value={s.permissions[scope] ?? "default"}
                  onChange={(e) => setPermission(scope, e.target.value as PermissionDecision)}
                >
                  {DECISIONS.map((d) => (
                    <option key={d} value={d}>
                      {t(`decision.${d}` as MessageKey)}
                    </option>
                  ))}
                </Select>
              </div>
            ))}
          </>
        ) : null}

        {tab === "mcp" ? (
          <>
            {s.mcpServers.length === 0 ? <div className="ui-field-hint">{t("settings.mcpNone")}</div> : null}
            {s.mcpServers.map((server, i) => (
              <div className="ui-mcp-editor" key={i}>
                <div className="ui-row-inline">
                  <Input
                    type="text"
                    value={server.name}
                    placeholder={t("settings.serverName")}
                    onChange={(e) => updateServer(i, { name: e.target.value })}
                  />
                  <Button variant="danger" size="sm" onClick={() => removeServer(i)}>
                    {t("common.remove")}
                  </Button>
                </div>
                <Input
                  type="text"
                  value={server.command}
                  placeholder={t("settings.command")}
                  onChange={(e) => updateServer(i, { command: e.target.value })}
                />
                <Input
                  type="text"
                  value={server.args}
                  placeholder={t("settings.args")}
                  onChange={(e) => updateServer(i, { args: e.target.value })}
                />
                <TextArea
                  value={server.env}
                  placeholder={t("settings.envLines")}
                  rows={2}
                  onChange={(e) => updateServer(i, { env: e.target.value })}
                />
              </div>
            ))}
            <Button variant="ghost" size="sm" onClick={addServer}>
              {t("settings.addServer")}
            </Button>
          </>
        ) : null}
      </div>
    </Modal>
  );
}
