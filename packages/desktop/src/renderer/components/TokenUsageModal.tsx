import { useMemo, type JSX } from "react";
import type { SerializableSessionEntry } from "../../shared/ipc";
import { useI18n } from "../i18n";
import { Button, Divider, EmptyState, Modal } from "../ui/index";
import { aggregateUsage, cacheHitRate, formatExact, formatTokens } from "../lib/token-usage";

type Props = {
  sessions: SerializableSessionEntry[];
  activeId: string | null;
  onClose: () => void;
};

/**
 * Token consumption panel: rolls every session's usage into workspace totals,
 * a per-model breakdown, and the active session's live context size. Reads
 * straight from the already-loaded `sessions` state — no extra IPC round trip.
 */
export function TokenUsageModal({ sessions, activeId, onClose }: Props): JSX.Element {
  const { t } = useI18n();
  const aggregate = useMemo(() => aggregateUsage(sessions), [sessions]);
  const activeSession = useMemo(
    () => (activeId ? (sessions.find((s) => s.id === activeId) ?? null) : null),
    [activeId, sessions]
  );

  const { totals, perModel, sessionCount } = aggregate;
  const hasUsage = totals.total > 0 || perModel.length > 0;
  const hasCache = totals.cacheHit > 0 || totals.cacheMiss > 0;

  return (
    <Modal
      wide
      onClose={onClose}
      title={t("tokens.title")}
      subtitle={t("tokens.subtitle")}
      actions={
        <Button size="sm" onClick={onClose}>
          {t("common.close")}
        </Button>
      }
    >
      {!hasUsage ? (
        <EmptyState icon="📊" title={t("tokens.emptyTitle")}>
          {t("tokens.emptyHint")}
        </EmptyState>
      ) : (
        <>
          <div className="ui-usage-grid">
            <Stat label={t("tokens.total")} value={formatTokens(totals.total)} exact={formatExact(totals.total)} />
            <Stat label={t("tokens.prompt")} value={formatTokens(totals.prompt)} exact={formatExact(totals.prompt)} />
            <Stat
              label={t("tokens.completion")}
              value={formatTokens(totals.completion)}
              exact={formatExact(totals.completion)}
            />
            <Stat label={t("tokens.requests")} value={formatExact(totals.reqs)} />
          </div>

          <div className="ui-usage-context">
            <span className="ui-usage-context-label">
              {activeSession ? t("tokens.activeContext") : t("tokens.noActive")}
            </span>
            {activeSession ? (
              <span className="ui-usage-context-value">
                {t("tokens.tokensUnit", { n: formatExact(activeSession.activeTokens) })}
              </span>
            ) : null}
            <span className="ui-usage-context-meta">{t("tokens.sessionsCounted", { n: sessionCount })}</span>
            {hasCache ? (
              <span className="ui-usage-context-meta">{t("tokens.cacheHitRate", { n: cacheHitRate(totals) })}</span>
            ) : null}
          </div>

          <Divider />

          <div className="ui-usage-section-title">{t("tokens.perModel")}</div>
          <table className="ui-usage-table">
            <thead>
              <tr>
                <th>{t("tokens.colModel")}</th>
                <th className="num">{t("tokens.colPrompt")}</th>
                <th className="num">{t("tokens.colCompletion")}</th>
                <th className="num">{t("tokens.colTotal")}</th>
                <th className="num">{t("tokens.colReqs")}</th>
              </tr>
            </thead>
            <tbody>
              {perModel.map((row) => (
                <tr key={row.model}>
                  <td className="ui-mono">{row.model}</td>
                  <td className="num" title={formatExact(row.prompt)}>
                    {formatTokens(row.prompt)}
                  </td>
                  <td className="num" title={formatExact(row.completion)}>
                    {formatTokens(row.completion)}
                  </td>
                  <td className="num" title={formatExact(row.total)}>
                    {formatTokens(row.total)}
                  </td>
                  <td className="num">{formatExact(row.reqs)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </>
      )}
    </Modal>
  );
}

function Stat({ label, value, exact }: { label: string; value: string; exact?: string }): JSX.Element {
  return (
    <div className="ui-stat" title={exact}>
      <div className="ui-stat-value">{value}</div>
      <div className="ui-stat-label">{label}</div>
    </div>
  );
}
