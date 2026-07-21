import type { JSX } from "react";
import type { SettingsSummary } from "../../shared/ipc";
import type { Appearance, ReasoningMode } from "../lib/appearance";
import { api } from "../api";
import { useI18n } from "../i18n";

type Props = {
  platform: string;
  projectRoot: string;
  settings: SettingsSummary | null;
  mcpCount: number;
  skillCount: number;
  appearance: Appearance;
  reasoningMode: ReasoningMode;
  onPickFolder: () => void;
  onOpenModel: () => void;
  onOpenPlugins: () => void;
  onOpenSettings: () => void;
  onToggleAppearance: () => void;
  onCycleReasoning: () => void;
  onOpenUndo: () => void;
};

function tail(path: string): string {
  const parts = path.split(/[\\/]/).filter(Boolean);
  if (parts.length <= 2) {
    return path;
  }
  return `…/${parts.slice(-2).join("/")}`;
}

export function TopBar({
  platform,
  projectRoot,
  settings,
  mcpCount,
  skillCount,
  appearance,
  reasoningMode,
  onPickFolder,
  onOpenModel,
  onOpenPlugins,
  onOpenSettings,
  onToggleAppearance,
  onCycleReasoning,
  onOpenUndo,
}: Props): JSX.Element {
  const { t } = useI18n();
  const pluginCount = mcpCount + skillCount;
  const reasoningIcon = reasoningMode === "hidden" ? "◌" : reasoningMode === "expanded" ? "◉" : "◎";
  const reasoningTitle =
    reasoningMode === "hidden"
      ? t("topbar.reasoningHidden")
      : reasoningMode === "expanded"
        ? t("topbar.reasoningExpanded")
        : t("topbar.reasoningNormal");
  return (
    <div className="topbar">
      {/* ── Left zone: window controls + brand ── */}
      <div className="topbar-left">
        {platform === "win32" ? (
          <div className="window-controls win">
            <button
              className="win-ctrl min"
              aria-label={t("window.minimize")}
              title={t("window.minimize")}
              onClick={() => void api.minimizeWindow()}
            >
              &#x2014;
            </button>
            <button
              className="win-ctrl max"
              aria-label={t("window.zoom")}
              title={t("window.zoom")}
              onClick={() => void api.toggleMaximizeWindow()}
            >
              &#x25A1;
            </button>
            <button
              className="win-ctrl close"
              aria-label={t("window.close")}
              title={t("window.close")}
              onClick={() => void api.closeWindow()}
            >
              &#x2715;
            </button>
          </div>
        ) : (
          <div className="window-controls">
            <button
              className="gumdrop close"
              aria-label={t("window.close")}
              title={t("window.close")}
              onClick={() => void api.closeWindow()}
            />
            <button
              className="gumdrop min"
              aria-label={t("window.minimize")}
              title={t("window.minimize")}
              onClick={() => void api.minimizeWindow()}
            />
            <button
              className="gumdrop zoom"
              aria-label={t("window.zoom")}
              title={t("window.zoom")}
              onClick={() => void api.toggleMaximizeWindow()}
            />
          </div>
        )}
        <span className="brand">
          Deep Code <span className="dim">{t("topbar.desktop")}</span>
        </span>
      </div>

      {/* ── Center zone: folder path ── */}
      <div className="topbar-center">
        <button className="folder" onClick={onPickFolder} title={projectRoot}>
          📁 {tail(projectRoot)}
        </button>
      </div>

      {/* ── Right zone: tools ── */}
      <div className="topbar-right">
        {settings && !settings.hasApiKey ? (
          <button className="badge-warn" onClick={onOpenSettings} title={t("topbar.configureApiKey")}>
            {t("topbar.noApiKey")}
          </button>
        ) : null}
        <button className="model-pill" onClick={onOpenModel} title={t("topbar.modelTitle")}>
          {settings?.model ?? t("topbar.model")}
          {settings?.thinkingEnabled ? <span className="think">◇ {settings.reasoningEffort}</span> : null}
        </button>
        <span className="topbar-divider" />
        <button
          className="model-pill icon-pill"
          onClick={onOpenUndo}
          title={t("topbar.undoTitle")}
          aria-label={t("topbar.undoTitle")}
        >
          ↺
        </button>
        <button
          className="model-pill icon-pill"
          onClick={onCycleReasoning}
          title={reasoningTitle}
          aria-label={reasoningTitle}
        >
          {reasoningIcon}
        </button>
        <button
          className="model-pill icon-pill"
          onClick={onToggleAppearance}
          title={appearance === "dark" ? t("topbar.appearanceDark") : t("topbar.appearanceLight")}
          aria-label={appearance === "dark" ? t("topbar.appearanceDark") : t("topbar.appearanceLight")}
        >
          {appearance === "dark" ? "☾" : "☀"}
        </button>
        <button className="model-pill" onClick={onOpenPlugins} title={t("topbar.pluginsTitle")}>
          🧩 {t("topbar.plugins")}
          {pluginCount > 0 ? <span className="pill-badge">{pluginCount}</span> : null}
        </button>
        <button className="model-pill" onClick={onOpenSettings} title={t("topbar.settingsTitle")}>
          ⚙
        </button>
      </div>
    </div>
  );
}
