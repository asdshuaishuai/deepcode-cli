import { useEffect, useState, type JSX } from "react";
import type {
  EditableSettings,
  PermissionDecision,
  PermissionScope,
  ReasoningEffort,
  SerializableSessionEntry,
  WorkspaceSessions,
} from "../../shared/ipc";
import { api } from "../api";
import { useI18n, type Locale, type MessageKey } from "../i18n";
import { Button, Checkbox, Field, Input, Select } from "../ui/index";
import { availableThemes, type Theme } from "../lib/appearance";
import {
  aggregateByTimeWindow,
  aggregateByWorkspace,
  aggregateUsage,
  cacheHitRate,
  formatExact,
  formatTokens,
} from "../lib/token-usage";

type Props = {
  initial: EditableSettings;
  initialTab?: string;
  sessions: SerializableSessionEntry[];
  onSave: (next: EditableSettings) => void;
  onClose: () => void;
  /** Platform string (e.g. "win32") — scopes which themes are offered. */
  platform: string;
  /** Currently active theme. */
  theme: Theme;
  /** Called when the user picks a theme in the General tab. */
  onSelectTheme: (theme: Theme) => void;
};

type Tab = "connection" | "language" | "model" | "permissions" | "tokens";

const TABS: { id: Tab; labelKey: MessageKey }[] = [
  { id: "connection", labelKey: "settings.tab.connection" },
  { id: "language", labelKey: "settings.general" },
  { id: "model", labelKey: "settings.tab.model" },
  { id: "permissions", labelKey: "settings.tab.permissions" },
  { id: "tokens", labelKey: "settings.tab.tokens" },
];

const TAB_ICONS: Record<Tab, string> = {
  connection: "🔗",
  language: "🌐",
  model: "✦",
  permissions: "🔒",
  tokens: "📊",
};

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

const LOCALE_OPTIONS: Locale[] = ["zh", "zh-TW", "zh-HK", "en", "ja", "ko"];

/** Settings surface rendered inline in the main area (no modal shell). */
export function SettingsPanel({
  initial,
  initialTab,
  sessions,
  onSave,
  onClose,
  platform,
  theme,
  onSelectTheme,
}: Props): JSX.Element {
  const { t, locale, setLocale } = useI18n();
  const [s, setS] = useState<EditableSettings>(initial);
  const isTab = (v: string | undefined): v is Tab => TABS.some((item) => item.id === v);
  const [tab, setTab] = useState<Tab>(isTab(initialTab) ? initialTab : "connection");
  const [showKey, setShowKey] = useState(false);
  const [tree, setTree] = useState<WorkspaceSessions | null>(null);

  // Load the full workspace tree for the token analytics tab (all workspaces).
  useEffect(() => {
    if (tab !== "tokens" || tree) return;
    let cancelled = false;
    void (async () => {
      const data = await api.listWorkspaceSessions();
      if (!cancelled) setTree(data);
    })();
    return () => {
      cancelled = true;
    };
  }, [tab, tree]);

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

  return (
    <div className="ui-settings-panel">
      <div className="ui-settings-panel-head">
        <span className="ui-settings-panel-title">{t("settings.title")}</span>
        <div className="ui-settings-panel-actions">
          <Button variant="primary" size="sm" onClick={() => onSave(s)}>
            {t("common.save")}
          </Button>
          <Button size="sm" onClick={onClose}>
            {t("common.close")}
          </Button>
        </div>
      </div>

      <div className="ui-settings-layout">
        <nav className="ui-settings-nav" aria-label={t("settings.title")}>
          {TABS.map((item) => (
            <button
              key={item.id}
              type="button"
              className={`ui-settings-nav-item${tab === item.id ? " active" : ""}`}
              aria-current={tab === item.id ? "page" : undefined}
              onClick={() => setTab(item.id)}
            >
              <span className="ui-settings-nav-icon" aria-hidden="true">
                {TAB_ICONS[item.id]}
              </span>
              <span>{t(item.labelKey)}</span>
            </button>
          ))}
        </nav>

        <div className="ui-settings-main">
          <div className="ui-settings-target">
            {t("settings.savingTo")} <code>{s.saveTargetPath}</code> (
            {s.saveTarget === "project" ? t("settings.target.project") : t("settings.target.user")})
          </div>

          <div className="ui-settings-body">
            {tab === "connection" ? (
              <>
                <section className="ui-settings-section">
                  <div className="ui-settings-section-title">{t("settings.tab.connection")}</div>
                  <Field
                    label={t("settings.apiKey")}
                    hint={s.hasEnvApiKey ? t("settings.envOverride") : undefined}
                    hintWarn
                  >
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
                </section>
              </>
            ) : null}

            {tab === "language" ? (
              <>
                <section className="ui-settings-section">
                  <div className="ui-settings-section-title">{t("settings.language")}</div>
                  <div className="ui-lang-grid" role="radiogroup" aria-label={t("settings.language")}>
                    {LOCALE_OPTIONS.map((code) => (
                      <button
                        key={code}
                        type="button"
                        role="radio"
                        aria-checked={locale === code}
                        className={`ui-lang-chip${locale === code ? " active" : ""}`}
                        onClick={() => setLocale(code)}
                      >
                        {t(`lang.${code}` as MessageKey)}
                      </button>
                    ))}
                  </div>
                </section>

                <section className="ui-settings-section">
                  <div className="ui-settings-section-title">{t("settings.theme")}</div>
                  <div className="ui-lang-grid" role="radiogroup" aria-label={t("settings.theme")}>
                    {availableThemes(platform).map((id) => (
                      <button
                        key={id}
                        type="button"
                        role="radio"
                        aria-checked={theme === id}
                        className={`ui-lang-chip${theme === id ? " active" : ""}`}
                        onClick={() => onSelectTheme(id)}
                      >
                        {t(`theme.${id}` as MessageKey)}
                      </button>
                    ))}
                  </div>
                </section>
              </>
            ) : null}

            {tab === "model" ? (
              <section className="ui-settings-section">
                <div className="ui-settings-section-title">{t("settings.tab.model")}</div>
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
              </section>
            ) : null}

            {tab === "permissions" ? (
              <section className="ui-settings-section">
                <div className="ui-settings-section-title">{t("settings.tab.permissions")}</div>
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

                <div className="ui-perm-list">
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
                </div>
              </section>
            ) : null}

            {tab === "tokens" ? <TokenAnalytics tree={tree} fallbackSessions={sessions} /> : null}
          </div>
        </div>
      </div>
    </div>
  );
}

function TokenBars({
  rows,
  max,
}: {
  rows: { label: string; value: number; model?: boolean }[];
  max: number;
}): JSX.Element {
  return (
    <div className="ui-token-bars">
      {rows.map((row) => (
        <div key={row.label} className="ui-token-bar-row" title={formatExact(row.value)}>
          <span className="ui-token-bar-label" title={row.label}>
            {row.label}
          </span>
          <span className="ui-token-bar-track">
            <span
              className={`ui-token-bar-fill${row.model ? " model" : ""}`}
              style={{ width: `${(row.value / max) * 100}%` }}
            />
          </span>
          <span className="ui-token-bar-value">{formatTokens(row.value)}</span>
        </div>
      ))}
    </div>
  );
}

/**
 * Token analytics: a bento-style grid (headline total + prompt/completion/reqs
 * metrics, a time-dimension breakdown and a model-dimension breakdown), plus a
 * per-workspace table underneath.
 */
function TokenAnalytics({
  tree,
  fallbackSessions,
}: {
  tree: WorkspaceSessions | null;
  fallbackSessions: SerializableSessionEntry[];
}): JSX.Element {
  const { t } = useI18n();
  const allSessions = tree ? tree.workspaces.flatMap((w) => w.sessions) : fallbackSessions;
  const agg = aggregateUsage(allSessions);
  const windows = aggregateByTimeWindow(allSessions);
  const wsRows = tree ? aggregateByWorkspace(tree) : [];
  const timeMax = Math.max(1, windows.last5h.total, windows.today.total, windows.thisWeek.total);
  const modelMax = Math.max(1, ...agg.perModel.map((m) => m.total));

  const timeRows = [
    { label: t("tokens.last5h"), value: windows.last5h.total },
    { label: t("tokens.today"), value: windows.today.total },
    { label: t("tokens.thisWeek"), value: windows.thisWeek.total },
  ];
  const modelRows = agg.perModel.map((m) => ({ label: m.model, value: m.total, model: true }));

  return (
    <>
      <div className="ui-token-note">{t("tokens.approxNote")}</div>

      <div className="ui-bento">
        <div className="ui-bento-cell ui-bento-hero">
          <div className="ui-bento-hero-value" title={formatExact(agg.totals.total)}>
            {formatTokens(agg.totals.total)}
          </div>
          <div className="ui-bento-hero-label">{t("tokens.colTotal")}</div>
          <div className="ui-bento-hero-sub">{t("tokens.cacheHitRate", { n: cacheHitRate(agg.totals) })}</div>
        </div>
        <div className="ui-bento-cell">
          <div className="ui-bento-metric" title={formatExact(agg.totals.prompt)}>
            {formatTokens(agg.totals.prompt)}
          </div>
          <div className="ui-bento-metric-label">{t("tokens.prompt")}</div>
        </div>
        <div className="ui-bento-cell">
          <div className="ui-bento-metric" title={formatExact(agg.totals.completion)}>
            {formatTokens(agg.totals.completion)}
          </div>
          <div className="ui-bento-metric-label">{t("tokens.completion")}</div>
        </div>
        <div className="ui-bento-cell">
          <div className="ui-bento-metric">{formatExact(agg.totals.reqs)}</div>
          <div className="ui-bento-metric-label">{t("tokens.requests")}</div>
        </div>

        <div className="ui-bento-cell ui-bento-wide">
          <div className="ui-bento-cell-title">{t("tokens.byTime")}</div>
          <TokenBars rows={timeRows} max={timeMax} />
        </div>

        <div className="ui-bento-cell ui-bento-wide">
          <div className="ui-bento-cell-title">{t("tokens.perModel")}</div>
          {modelRows.length === 0 ? (
            <div className="ui-field-hint">{t("tokens.emptyHint")}</div>
          ) : (
            <TokenBars rows={modelRows} max={modelMax} />
          )}
        </div>
      </div>

      <div className="ui-usage-section-title">{t("tokens.byWorkspace")}</div>
      {wsRows.length === 0 ? (
        <div className="ui-field-hint">{t("tokens.emptyHint")}</div>
      ) : (
        <table className="ui-usage-table">
          <thead>
            <tr>
              <th>{t("tokens.colWorkspace")}</th>
              <th className="num">{t("tokens.colPrompt")}</th>
              <th className="num">{t("tokens.colCompletion")}</th>
              <th className="num">{t("tokens.colTotal")}</th>
              <th className="num">{t("tokens.colReqs")}</th>
            </tr>
          </thead>
          <tbody>
            {wsRows.map((row) => (
              <tr key={row.root}>
                <td className="ui-mono" title={row.root}>
                  {row.label}
                </td>
                <td className="num" title={formatExact(row.prompt)}>
                  {formatTokens(row.prompt)}
                </td>
                <td className="num" title={formatExact(row.completion)}>
                  {formatTokens(row.completion)}
                </td>
                <td className="num" title={formatExact(row.total)}>
                  {formatTokens(row.total)}
                </td>
                <td className="num">{formatExact(row.reqs)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </>
  );
}
