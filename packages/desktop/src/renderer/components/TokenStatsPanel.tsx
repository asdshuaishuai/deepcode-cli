import { useMemo, type JSX } from "react";
import type { SerializableSessionEntry } from "../../shared/ipc";
import { useI18n } from "../i18n";
import { aggregateByTimeWindow, aggregateUsage, cacheHitRate, formatExact, formatTokens } from "../lib/token-usage";

type Props = {
  /** Current workspace sessions. */
  sessions: SerializableSessionEntry[];
};

/** Inline left-panel token analytics for the current workspace (item 4). */
export function TokenStatsPanel({ sessions }: Props): JSX.Element {
  const { t } = useI18n();
  const agg = useMemo(() => aggregateUsage(sessions), [sessions]);
  const windows = useMemo(() => aggregateByTimeWindow(sessions), [sessions]);
  const modelMax = Math.max(1, ...agg.perModel.map((m) => m.total));
  const timeMax = Math.max(1, windows.last5h.total, windows.today.total, windows.thisWeek.total);

  const timeRows = [
    { label: t("tokens.last5h"), value: windows.last5h.total },
    { label: t("tokens.today"), value: windows.today.total },
    { label: t("tokens.thisWeek"), value: windows.thisWeek.total },
  ];

  return (
    <div className="ui-side-panel">
      <div className="ui-side-panel-head">
        <span>{t("tokens.title")}</span>
      </div>
      <div className="ui-side-panel-body ui-token-stats">
        <div className="ui-token-hero">
          <div className="ui-token-hero-value" title={formatExact(agg.totals.total)}>
            {formatTokens(agg.totals.total)}
          </div>
          <div className="ui-token-hero-label">{t("tokens.currentWorkspace")}</div>
          <div className="ui-token-hero-sub">
            {t("tokens.sessionsCounted", { n: agg.sessionCount })} ·{" "}
            {t("tokens.cacheHitRate", { n: cacheHitRate(agg.totals) })}
          </div>
        </div>

        <div className="ui-token-metrics">
          <div className="ui-token-metric">
            <span title={formatExact(agg.totals.prompt)}>{formatTokens(agg.totals.prompt)}</span>
            <label>{t("tokens.prompt")}</label>
          </div>
          <div className="ui-token-metric">
            <span title={formatExact(agg.totals.completion)}>{formatTokens(agg.totals.completion)}</span>
            <label>{t("tokens.completion")}</label>
          </div>
          <div className="ui-token-metric">
            <span>{formatExact(agg.totals.reqs)}</span>
            <label>{t("tokens.requests")}</label>
          </div>
        </div>

        <div className="ui-usage-section-title">{t("tokens.byTime")}</div>
        <div className="ui-token-bars">
          {timeRows.map((row) => (
            <div key={row.label} className="ui-token-bar-row">
              <span className="ui-token-bar-label">{row.label}</span>
              <span className="ui-token-bar-track">
                <span className="ui-token-bar-fill" style={{ width: `${(row.value / timeMax) * 100}%` }} />
              </span>
              <span className="ui-token-bar-value">{formatTokens(row.value)}</span>
            </div>
          ))}
        </div>

        <div className="ui-usage-section-title">{t("tokens.perModel")}</div>
        {agg.perModel.length === 0 ? (
          <div className="ui-side-panel-empty">{t("tokens.emptyHint")}</div>
        ) : (
          <div className="ui-token-bars">
            {agg.perModel.map((m) => (
              <div key={m.model} className="ui-token-bar-row" title={formatExact(m.total)}>
                <span className="ui-token-bar-label" title={m.model}>
                  {m.model}
                </span>
                <span className="ui-token-bar-track">
                  <span className="ui-token-bar-fill model" style={{ width: `${(m.total / modelMax) * 100}%` }} />
                </span>
                <span className="ui-token-bar-value">{formatTokens(m.total)}</span>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
