import type { JSX } from "react";
import type { PlanImplementationChoice } from "../lib/plan";
import { useI18n, type MessageKey } from "../i18n";

type Props = {
  onSelect: (choice: PlanImplementationChoice) => void;
};

const CHOICES: Array<{ value: PlanImplementationChoice; labelKey: MessageKey; descKey: MessageKey }> = [
  { value: "implement", labelKey: "plan.implement.label", descKey: "plan.implement.desc" },
  { value: "stay", labelKey: "plan.stay.label", descKey: "plan.stay.desc" },
  { value: "default", labelKey: "plan.default.label", descKey: "plan.default.desc" },
];

/** Shown once the assistant emits a complete <proposed_plan> while in Plan mode. */
export function PlanCard({ onSelect }: Props): JSX.Element {
  const { t } = useI18n();
  return (
    <div className="card warn">
      <div className="card-title">{t("plan.ready")}</div>
      <div style={{ color: "var(--text-dim)", fontSize: 12.5 }}>{t("plan.chooseNext")}</div>
      <div className="opt-row">
        {CHOICES.map((choice) => (
          <button key={choice.value} className="opt" onClick={() => onSelect(choice.value)}>
            {t(choice.labelKey)}
            <span className="opt-desc">{t(choice.descKey)}</span>
          </button>
        ))}
      </div>
    </div>
  );
}
