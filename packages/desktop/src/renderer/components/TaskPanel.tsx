import { useMemo, type JSX } from "react";
import type { SessionMessage } from "../../shared/ipc";
import { useI18n } from "../i18n";
import { buildToolSummary, getPlanLines } from "../lib/messages";
import { renderMarkdown } from "../markdown";

type Props = {
  messages: SessionMessage[];
};

/** Extract the markdown plan from the newest UpdatePlan tool message, if any. */
function findLatestPlan(messages: SessionMessage[]): string | null {
  for (let i = messages.length - 1; i >= 0; i -= 1) {
    const message = messages[i];
    if (!message || message.role !== "tool") {
      continue;
    }
    const summary = buildToolSummary(message);
    const lines = getPlanLines(summary);
    if (lines.length > 0) {
      return lines.join("\n");
    }
  }
  return null;
}

/** Left-panel Task view: renders the current session's latest plan checklist. */
export function TaskPanel({ messages }: Props): JSX.Element {
  const { t } = useI18n();
  const plan = useMemo(() => findLatestPlan(messages), [messages]);

  return (
    <div className="ui-side-panel">
      <div className="ui-side-panel-head">
        <span>{t("task.title")}</span>
      </div>
      <div className="ui-side-panel-body">
        {plan ? (
          <div className="ui-task-plan ui-markdown" dangerouslySetInnerHTML={{ __html: renderMarkdown(plan) }} />
        ) : (
          <div className="ui-side-panel-empty">{t("task.empty")}</div>
        )}
      </div>
    </div>
  );
}
