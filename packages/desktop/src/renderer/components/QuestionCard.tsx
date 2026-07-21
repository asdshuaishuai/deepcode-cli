import { useState, type JSX } from "react";
import type { AskUserQuestionAnswers, AskUserQuestionItem } from "../lib/ask-question";
import { useI18n } from "../i18n";

type Props = {
  questions: AskUserQuestionItem[];
  onSubmit: (answers: AskUserQuestionAnswers) => void;
  onCancel: () => void;
};

/**
 * Renders the AskUserQuestion tool call as selectable option groups. Supports
 * single- and multi-select questions, then emits a { question: answer } map.
 */
export function QuestionCard({ questions, onSubmit, onCancel }: Props): JSX.Element {
  const { t } = useI18n();
  const [selections, setSelections] = useState<Record<number, Set<string>>>({});

  function toggle(qIndex: number, label: string, multi: boolean): void {
    setSelections((prev) => {
      const next = { ...prev };
      const current = new Set(next[qIndex] ?? []);
      if (multi) {
        if (current.has(label)) {
          current.delete(label);
        } else {
          current.add(label);
        }
      } else {
        current.clear();
        current.add(label);
      }
      next[qIndex] = current;
      return next;
    });
  }

  const answered = questions.every((_, i) => (selections[i]?.size ?? 0) > 0);

  function submit(): void {
    const answers: AskUserQuestionAnswers = {};
    questions.forEach((q, i) => {
      const picked = Array.from(selections[i] ?? []);
      if (picked.length > 0) {
        answers[q.question] = picked.join(", ");
      }
    });
    onSubmit(answers);
  }

  return (
    <div className="card">
      <div className="card-title">{t("question.title")}</div>
      {questions.map((q, qIndex) => (
        <div key={qIndex} className="q-block">
          <div className="q-text">
            {q.question}
            {q.multiSelect ? (
              <span style={{ color: "var(--text-faint)", fontWeight: 400 }}>{t("question.selectAny")}</span>
            ) : null}
          </div>
          <div className="opt-row">
            {q.options.map((opt) => {
              const selected = selections[qIndex]?.has(opt.label) ?? false;
              return (
                <button
                  key={opt.label}
                  className={`opt${selected ? " selected" : ""}`}
                  onClick={() => toggle(qIndex, opt.label, q.multiSelect === true)}
                >
                  {opt.label}
                  {opt.description ? <span className="opt-desc">{opt.description}</span> : null}
                </button>
              );
            })}
          </div>
        </div>
      ))}
      <div className="card-actions">
        <button className="primary" onClick={submit} disabled={!answered}>
          {t("common.submit")}
        </button>
        <button onClick={onCancel}>{t("common.skip")}</button>
      </div>
    </div>
  );
}
