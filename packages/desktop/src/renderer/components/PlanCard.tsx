import type { JSX } from "react";
import type { PlanImplementationChoice } from "../lib/plan";
import { useI18n, type MessageKey } from "../i18n";
import { Card, CardHeader } from "../ui/index";

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
    <Card warn>
      <CardHeader>{t("plan.ready")}</CardHeader>
      <div style={{ color: "var(--ui-text-dim)", fontSize: 12.5 }}>{t("plan.chooseNext")}</div>
      <div className="ui-opt-row">
        {CHOICES.map((choice) => (
          <button key={choice.value} className="ui-opt" onClick={() => onSelect(choice.value)}>
            {t(choice.labelKey)}
            <span className="ui-opt-desc">{t(choice.descKey)}</span>
          </button>
        ))}
      </div>
    </Card>
  );
}
