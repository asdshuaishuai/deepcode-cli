import type { JSX } from "react";
import type { ModelConfigSelection, ReasoningEffort, SettingsSummary } from "../../shared/ipc";
import { api } from "../api";
import { useI18n, type MessageKey } from "../i18n";
import { Pill, Select } from "../ui/index";
import { formatTokens } from "../lib/token-usage";

type Props = {
  platform: string;
  projectRoot: string;
  settings: SettingsSummary | null;
  branch: string;
  branches: string[];
  onSwitchBranch: (branch: string) => void;
  onSetModel: (selection: ModelConfigSelection) => void;
  onOpenModel: () => void;
  onOpenSettings: () => void;
  onOpenTokens: () => void;
  activeTokens: number;
  totalTokens: number;
};

const MODELS = ["deepseek-v4-pro", "deepseek-v4-flash"];

type ThinkingOption = {
  key: string;
  labelKey: MessageKey;
  thinkingEnabled: boolean;
  reasoningEffort?: ReasoningEffort;
};
const THINKING_OPTIONS: ThinkingOption[] = [
  { key: "max", labelKey: "model.thinkingMax", thinkingEnabled: true, reasoningEffort: "max" },
  { key: "high", labelKey: "model.thinkingHigh", thinkingEnabled: true, reasoningEffort: "high" },
  { key: "off", labelKey: "model.noThinking", thinkingEnabled: false },
];

function projectName(path: string): string {
  const parts = path.split(/[\\/]/).filter(Boolean);
  return parts.length > 0 ? parts[parts.length - 1]! : path;
}

function currentThinkingKey(s: SettingsSummary): string {
  if (!s.thinkingEnabled) return "off";
  return s.reasoningEffort === "high" ? "high" : "max";
}

// Window caption glyphs as inline SVG (Windows 11 Fluent style). 1.5px stroke
// at 12px render size gives a crisp 1.5px line; `currentColor` lets the
// theme dictate the foreground via the existing --ui-text-dim / --ui-text /
// --ui-danger palette.
const ICON_MIN = (
  <svg viewBox="0 0 12 12" width="12" height="12" aria-hidden="true" focusable="false">
    <line x1="2" y1="6" x2="10" y2="6" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
  </svg>
);
const ICON_MAX_RESTORE = (
  <svg viewBox="0 0 12 12" width="12" height="12" aria-hidden="true" focusable="false">
    <rect x="2.5" y="2.5" width="7" height="7" fill="none" stroke="currentColor" strokeWidth="1.5" />
  </svg>
);
const ICON_CLOSE = (
  <svg viewBox="0 0 12 12" width="12" height="12" aria-hidden="true" focusable="false">
    <line x1="3" y1="3" x2="9" y2="9" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
    <line x1="9" y1="3" x2="3" y2="9" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
  </svg>
);

/** Slim draggable window bar: window controls + project/branch + dual model selectors + token mini. */
export function TopBar({
  platform,
  projectRoot,
  settings,
  branch,
  branches,
  onSwitchBranch,
  onSetModel,
  onOpenModel,
  onOpenSettings,
  onOpenTokens,
  activeTokens,
  totalTokens,
}: Props): JSX.Element {
  const { t } = useI18n();
  const isMac = platform === "darwin";

  // macOS traffic-light gumdrops sit at the far left (system convention).
  const macControls = (
    <div className="ui-window-controls mac">
      <button
        className="ui-gumdrop close"
        aria-label={t("window.close")}
        title={t("window.close")}
        onClick={() => void api.closeWindow()}
      />
      <button
        className="ui-gumdrop min"
        aria-label={t("window.minimize")}
        title={t("window.minimize")}
        onClick={() => void api.minimizeWindow()}
      />
      <button
        className="ui-gumdrop zoom"
        aria-label={t("window.zoom")}
        title={t("window.zoom")}
        onClick={() => void api.toggleMaximizeWindow()}
      />
    </div>
  );

  // Windows controls sit at the far right (system convention): min / max / close.
  const winControls = (
    <div className="ui-window-controls win">
      <button
        className="ui-win-ctrl min"
        aria-label={t("window.minimize")}
        title={t("window.minimize")}
        onClick={() => void api.minimizeWindow()}
      >
        {ICON_MIN}
      </button>
      <button
        className="ui-win-ctrl max"
        aria-label={t("window.zoom")}
        title={t("window.zoom")}
        onClick={() => void api.toggleMaximizeWindow()}
      >
        {ICON_MAX_RESTORE}
      </button>
      <button
        className="ui-win-ctrl close"
        aria-label={t("window.close")}
        title={t("window.close")}
        onClick={() => void api.closeWindow()}
      >
        {ICON_CLOSE}
      </button>
    </div>
  );

  const modelKnown = settings ? MODELS.includes(settings.model) : true;
  const modelSelectValue = settings ? (modelKnown ? settings.model : "__custom__") : MODELS[0]!;

  return (
    <div className="ui-window-bar">
      {isMac ? macControls : null}

      {/* Project / branch: "项目名 / 分支名" */}
      <div className="ui-topbar-project" title={projectRoot}>
        <span className="ui-topbar-project-name">{projectName(projectRoot) || t("topbar.desktop")}</span>
        {branches.length > 0 ? (
          <>
            <span className="ui-topbar-sep">/</span>
            <Select
              className="ui-topbar-branch"
              value={branch}
              title={t("topbar.branch")}
              onChange={(e) => onSwitchBranch(e.target.value)}
            >
              {branches.map((b) => (
                <option key={b} value={b}>
                  {b}
                </option>
              ))}
            </Select>
          </>
        ) : branch ? (
          <>
            <span className="ui-topbar-sep">/</span>
            <span className="ui-topbar-branch-static">{branch}</span>
          </>
        ) : null}
      </div>

      <div className="ui-window-bar-spacer" />

      {/* Dual model selectors: model + thinking model */}
      {settings ? (
        <div className="ui-topbar-models">
          <Select
            className="ui-topbar-model"
            value={modelSelectValue}
            title={t("topbar.model")}
            onChange={(e) => {
              const v = e.target.value;
              if (v === "__custom__") {
                onOpenModel();
                return;
              }
              onSetModel({
                model: v,
                thinkingEnabled: settings.thinkingEnabled,
                reasoningEffort: settings.reasoningEffort,
              });
            }}
          >
            {MODELS.map((m) => (
              <option key={m} value={m}>
                {m}
              </option>
            ))}
            {!modelKnown ? <option value={settings.model}>{settings.model}</option> : null}
            <option value="__custom__">{t("model.custom")}</option>
          </Select>
          <Select
            className="ui-topbar-thinking"
            value={currentThinkingKey(settings)}
            title={t("topbar.thinkingModel")}
            onChange={(e) => {
              const opt = THINKING_OPTIONS.find((o) => o.key === e.target.value) ?? THINKING_OPTIONS[0]!;
              onSetModel({
                model: settings.model,
                thinkingEnabled: opt.thinkingEnabled,
                reasoningEffort: opt.reasoningEffort ?? settings.reasoningEffort,
              });
            }}
          >
            {THINKING_OPTIONS.map((o) => (
              <option key={o.key} value={o.key}>
                {t(o.labelKey)}
              </option>
            ))}
          </Select>
        </div>
      ) : null}

      {/* Compact token mini-panel */}
      <button className="ui-topbar-tokens" onClick={onOpenTokens} title={t("topbar.tokenPanelTitle")}>
        <span className="ui-topbar-token-part">
          <span className="ui-topbar-token-label">{t("topbar.contextTokens")}</span>
          <span className="ui-topbar-token-value">{formatTokens(activeTokens)}</span>
        </span>
        <span className="ui-topbar-token-part">
          <span className="ui-topbar-token-label">{t("topbar.workspaceTokens")}</span>
          <span className="ui-topbar-token-value">{formatTokens(totalTokens)}</span>
        </span>
      </button>

      {settings && !settings.hasApiKey ? (
        <Pill warn onClick={onOpenSettings} title={t("topbar.configureApiKey")}>
          {t("topbar.noApiKey")}
        </Pill>
      ) : null}

      {isMac ? null : winControls}
    </div>
  );
}
