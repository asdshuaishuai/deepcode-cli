import type { JSX } from "react";
import { useI18n } from "../i18n";
import { compactTokenThreshold, formatTokens } from "../lib/token-usage";

type Props = {
  /** Active session context tokens (the size that triggers compaction). */
  activeTokens: number;
  /** Current model — decides the compaction threshold. */
  model: string;
};

/**
 * Slim gauge under the composer showing how full the active context is relative
 * to the model's automatic-compaction threshold. Hidden until a session has
 * accumulated context, and tints amber as it nears compaction.
 */
export function ContextProgress({ activeTokens, model }: Props): JSX.Element | null {
  const { t } = useI18n();
  if (activeTokens <= 0) return null;

  const threshold = compactTokenThreshold(model);
  const pct = Math.min(100, Math.round((activeTokens / threshold) * 100));
  const near = pct >= 80;

  return (
    <div className="ui-context-progress" title={`${formatTokens(activeTokens)} / ${formatTokens(threshold)}`}>
      <div className="ui-context-progress-head">
        <span className="ui-context-progress-label">{t("context.compaction")}</span>
        <span className="ui-context-progress-value">{pct}%</span>
      </div>
      <div className="ui-context-progress-track">
        <div className={`ui-context-progress-fill${near ? " near" : ""}`} style={{ width: `${pct}%` }} />
      </div>
    </div>
  );
}
