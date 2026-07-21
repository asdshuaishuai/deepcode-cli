import type { JSX } from "react";
import type { SettingsSummary } from "../../shared/ipc";
import { api } from "../api";
import { useI18n } from "../i18n";
import { Pill } from "../ui/index";

type Props = {
  platform: string;
  projectRoot: string;
  settings: SettingsSummary | null;
  onPickFolder: () => void;
  onOpenModel: () => void;
  onOpenSettings: () => void;
};

function tail(path: string): string {
  const parts = path.split(/[\\/]/).filter(Boolean);
  if (parts.length <= 2) {
    return path;
  }
  return `…/${parts.slice(-2).join("/")}`;
}

/** Slim draggable window bar: platform controls + brand + folder/model pills + status. */
export function TopBar({
  platform,
  projectRoot,
  settings,
  onPickFolder,
  onOpenModel,
  onOpenSettings,
}: Props): JSX.Element {
  const { t } = useI18n();
  return (
    <div className="ui-window-bar">
      {platform === "win32" ? (
        <div className="ui-window-controls">
          <button
            className="ui-win-ctrl min"
            aria-label={t("window.minimize")}
            title={t("window.minimize")}
            onClick={() => void api.minimizeWindow()}
          >
            &#x2014;
          </button>
          <button
            className="ui-win-ctrl max"
            aria-label={t("window.zoom")}
            title={t("window.zoom")}
            onClick={() => void api.toggleMaximizeWindow()}
          >
            &#x25A1;
          </button>
          <button
            className="ui-win-ctrl close"
            aria-label={t("window.close")}
            title={t("window.close")}
            onClick={() => void api.closeWindow()}
          >
            &#x2715;
          </button>
        </div>
      ) : (
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
      )}

      <span className="ui-brand-label">
        Deep Code <span className="dim">{t("topbar.desktop")}</span>
      </span>

      <Pill onClick={onPickFolder} title={projectRoot}>
        📁 {tail(projectRoot)}
      </Pill>

      <div className="ui-window-bar-spacer" />

      {settings && !settings.hasApiKey ? (
        <Pill warn onClick={onOpenSettings} title={t("topbar.configureApiKey")}>
          {t("topbar.noApiKey")}
        </Pill>
      ) : null}
      <Pill onClick={onOpenModel} title={t("topbar.modelTitle")}>
        {settings?.model ?? t("topbar.model")}
        {settings?.thinkingEnabled ? (
          <span style={{ marginLeft: 6, opacity: 0.7 }}>◇ {settings.reasoningEffort}</span>
        ) : null}
      </Pill>
    </div>
  );
}
