import type { JSX } from "react";
import type { SettingsSummary } from "../../shared/ipc";
import { api } from "../api";
import { useI18n } from "../i18n";

type Props = {
  projectRoot: string;
  settings: SettingsSummary | null;
  mcpCount: number;
  onPickFolder: () => void;
  onOpenModel: () => void;
  onOpenMcp: () => void;
  onOpenSettings: () => void;
};

function tail(path: string): string {
  const parts = path.split(/[\\/]/).filter(Boolean);
  if (parts.length <= 2) {
    return path;
  }
  return `…/${parts.slice(-2).join("/")}`;
}

export function TopBar({
  projectRoot,
  settings,
  mcpCount,
  onPickFolder,
  onOpenModel,
  onOpenMcp,
  onOpenSettings,
}: Props): JSX.Element {
  const { t, locale, setLocale } = useI18n();
  return (
    <div className="topbar">
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
      <span className="brand">
        Deep Code <span className="dim">{t("topbar.desktop")}</span>
      </span>
      <button className="folder" onClick={onPickFolder} title={projectRoot}>
        📁 {tail(projectRoot)}
      </button>
      <div className="spacer" />
      {settings && !settings.hasApiKey ? (
        <button className="badge-warn" onClick={onOpenSettings} title={t("topbar.configureApiKey")}>
          {t("topbar.noApiKey")}
        </button>
      ) : null}
      <button
        className="model-pill"
        onClick={() => setLocale(locale === "zh" ? "en" : "zh")}
        title={t("topbar.languageTitle")}
      >
        {locale === "zh" ? "中" : "EN"}
      </button>
      <button className="model-pill" onClick={onOpenMcp} title={t("topbar.mcpTitle")}>
        🔌 MCP{mcpCount > 0 ? ` (${mcpCount})` : ""}
      </button>
      <button className="model-pill" onClick={onOpenModel} title={t("topbar.modelTitle")}>
        {settings?.model ?? t("topbar.model")}
        {settings?.thinkingEnabled ? <span className="think">◇ {settings.reasoningEffort}</span> : null}
      </button>
      <button className="model-pill" onClick={onOpenSettings} title={t("topbar.settingsTitle")}>
        ⚙
      </button>
    </div>
  );
}
