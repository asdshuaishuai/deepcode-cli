import { useState, type JSX } from "react";
import type { ModelConfigSelection, ReasoningEffort, SettingsSummary } from "../../shared/ipc";
import { useI18n, type MessageKey } from "../i18n";

type Props = {
  settings: SettingsSummary;
  onApply: (selection: ModelConfigSelection) => void;
  onClose: () => void;
};

const MODELS = ["deepseek-v4-pro", "deepseek-v4-flash"];

type ThinkingOption = { labelKey: MessageKey; thinkingEnabled: boolean; reasoningEffort?: ReasoningEffort };
const THINKING_OPTIONS: ThinkingOption[] = [
  { labelKey: "model.thinkingMax", thinkingEnabled: true, reasoningEffort: "max" },
  { labelKey: "model.thinkingHigh", thinkingEnabled: true, reasoningEffort: "high" },
  { labelKey: "model.noThinking", thinkingEnabled: false },
];

function currentThinkingIndex(s: SettingsSummary): number {
  const i = THINKING_OPTIONS.findIndex((o) =>
    !s.thinkingEnabled ? !o.thinkingEnabled : o.thinkingEnabled && o.reasoningEffort === s.reasoningEffort
  );
  return i >= 0 ? i : 0;
}

export function ModelModal({ settings, onApply, onClose }: Props): JSX.Element {
  const { t } = useI18n();
  const modelKnown = MODELS.includes(settings.model);
  const [model, setModel] = useState(modelKnown ? settings.model : MODELS[0]!);
  const [customModel, setCustomModel] = useState(modelKnown ? "" : settings.model);
  const [useCustom, setUseCustom] = useState(!modelKnown);
  const [thinkingIndex, setThinkingIndex] = useState(currentThinkingIndex(settings));

  function apply(): void {
    const option = THINKING_OPTIONS[thinkingIndex] ?? THINKING_OPTIONS[0]!;
    const resolvedModel = (useCustom ? customModel.trim() : model) || settings.model;
    onApply({
      model: resolvedModel,
      thinkingEnabled: option.thinkingEnabled,
      reasoningEffort: option.reasoningEffort ?? settings.reasoningEffort,
    });
  }

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal" onClick={(e) => e.stopPropagation()}>
        <h2>{t("model.title")}</h2>

        <div className="field">
          <label>{t("model.model")}</label>
          <select
            value={useCustom ? "__custom__" : model}
            onChange={(e) => {
              if (e.target.value === "__custom__") {
                setUseCustom(true);
              } else {
                setUseCustom(false);
                setModel(e.target.value);
              }
            }}
          >
            {MODELS.map((m) => (
              <option key={m} value={m}>
                {m}
              </option>
            ))}
            <option value="__custom__">{t("model.custom")}</option>
          </select>
        </div>

        {useCustom ? (
          <div className="field">
            <label>{t("model.customName")}</label>
            <input
              type="text"
              value={customModel}
              placeholder="e.g. gpt-4o-mini"
              onChange={(e) => setCustomModel(e.target.value)}
            />
          </div>
        ) : null}

        <div className="field">
          <label>{t("model.thinking")}</label>
          <select value={thinkingIndex} onChange={(e) => setThinkingIndex(Number(e.target.value))}>
            {THINKING_OPTIONS.map((o, i) => (
              <option key={o.labelKey} value={i}>
                {t(o.labelKey)}
              </option>
            ))}
          </select>
        </div>

        <div className="field" style={{ color: "var(--text-faint)", fontSize: 12 }}>
          {t("model.baseUrlKey", {
            url: settings.baseURL,
            status: settings.hasApiKey ? t("model.configured") : t("model.missing"),
          })}
        </div>

        <div className="card-actions">
          <button className="primary" onClick={apply}>
            {t("common.apply")}
          </button>
          <button onClick={onClose}>{t("common.cancel")}</button>
        </div>
      </div>
    </div>
  );
}
