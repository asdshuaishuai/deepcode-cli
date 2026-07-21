import { useEffect, useRef, type JSX } from "react";
import type { SkillInfo } from "../../shared/ipc";
import { useI18n } from "../i18n";

type Props = {
  value: string;
  onChange: (value: string) => void;
  onSend: () => void;
  onStop: () => void;
  busy: boolean;
  disabled: boolean;
  planMode: boolean;
  onTogglePlan: () => void;
  skills: SkillInfo[];
  selectedSkills: string[];
  onToggleSkill: (name: string) => void;
  statusText: string | null;
  errorText: string | null;
};

export function Composer(props: Props): JSX.Element {
  const {
    value,
    onChange,
    onSend,
    onStop,
    busy,
    disabled,
    planMode,
    onTogglePlan,
    skills,
    selectedSkills,
    onToggleSkill,
    statusText,
    errorText,
  } = props;
  const { t } = useI18n();
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  // Auto-grow the textarea up to the CSS max-height.
  useEffect(() => {
    const el = textareaRef.current;
    if (!el) {
      return;
    }
    el.style.height = "auto";
    el.style.height = `${el.scrollHeight}px`;
  }, [value]);

  function handleKeyDown(e: React.KeyboardEvent<HTMLTextAreaElement>): void {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      if (!busy && !disabled && value.trim()) {
        onSend();
      }
    }
  }

  const canSend = !busy && !disabled && value.trim().length > 0;

  return (
    <div className="composer">
      <div className="composer-inner">
        <div className="status-strip">
          {busy ? <span className="spinner" /> : null}
          {errorText ? <span className="err-strip">{errorText}</span> : statusText ? <span>{statusText}</span> : null}
        </div>

        {skills.length > 0 ? (
          <div className="skill-chips">
            {skills.map((skill) => {
              const on = selectedSkills.includes(skill.name);
              const cls = skill.isLoaded ? "chip loaded" : on ? "chip on" : "chip";
              return (
                <button
                  key={skill.name}
                  className={cls}
                  title={skill.description}
                  onClick={() => onToggleSkill(skill.name)}
                >
                  {skill.isLoaded ? "⚡ " : on ? "✓ " : ""}
                  {skill.name}
                </button>
              );
            })}
          </div>
        ) : null}

        <div className="input-row">
          <textarea
            ref={textareaRef}
            className="prompt"
            rows={1}
            placeholder={disabled ? t("composer.respondAbove") : t("composer.askPlaceholder")}
            value={value}
            disabled={disabled}
            onChange={(e) => onChange(e.target.value)}
            onKeyDown={handleKeyDown}
          />
          {busy ? (
            <button className="stop-btn" onClick={onStop}>
              {t("composer.stop")}
            </button>
          ) : (
            <button className="send-btn" onClick={onSend} disabled={!canSend}>
              {t("composer.send")}
            </button>
          )}
        </div>

        <div className="composer-hints">
          <label className={`toggle${planMode ? " plan-on" : ""}`}>
            <input type="checkbox" checked={planMode} onChange={onTogglePlan} />
            {t("composer.planMode")}
          </label>
          <span>{t("composer.hint")}</span>
        </div>
      </div>
    </div>
  );
}
