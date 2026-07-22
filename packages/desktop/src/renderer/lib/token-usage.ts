// Token-usage aggregation for the consumption panel.
//
// Every session already carries its `usage` (grand total) and `usagePerModel`
// breakdown from the core engine, serialized straight through IPC. This module
// rolls those per-session records up into workspace totals + a per-model table,
// plus small formatters — all pure so it can be unit-tested and memoized.

import type { ModelUsage, SerializableSessionEntry } from "../../shared/ipc";

/** Flat token counters accumulated from one or many `ModelUsage` records. */
export type UsageTotals = {
  prompt: number;
  completion: number;
  total: number;
  reqs: number;
  cacheHit: number;
  cacheMiss: number;
};

/** A single model's rolled-up usage row. */
export type ModelUsageRow = UsageTotals & { model: string };

/** The full aggregate surfaced to the panel. */
export type UsageAggregate = {
  totals: UsageTotals;
  perModel: ModelUsageRow[];
  /** Sessions that contributed any usage. */
  sessionCount: number;
};

function emptyTotals(): UsageTotals {
  return { prompt: 0, completion: 0, total: 0, reqs: 0, cacheHit: 0, cacheMiss: 0 };
}

function num(value: unknown): number {
  return typeof value === "number" && Number.isFinite(value) ? value : 0;
}

/** Add a single `ModelUsage` record into a totals accumulator (in place). */
function addUsage(into: UsageTotals, usage: ModelUsage | null | undefined): void {
  if (!usage) return;
  into.prompt += num(usage.prompt_tokens);
  into.completion += num(usage.completion_tokens);
  into.total += num(usage.total_tokens);
  into.reqs += num(usage.total_reqs);
  into.cacheHit += num(usage.prompt_cache_hit_tokens);
  into.cacheMiss += num(usage.prompt_cache_miss_tokens);
}

/** Roll every session's usage up into workspace totals + a per-model table. */
export function aggregateUsage(sessions: SerializableSessionEntry[]): UsageAggregate {
  const totals = emptyTotals();
  const perModel = new Map<string, ModelUsageRow>();
  let sessionCount = 0;

  for (const session of sessions) {
    if (session.usage) {
      addUsage(totals, session.usage);
      sessionCount += 1;
    }
    if (session.usagePerModel) {
      for (const [model, usage] of Object.entries(session.usagePerModel)) {
        const name = model.trim() || "unknown";
        let row = perModel.get(name);
        if (!row) {
          row = { model: name, ...emptyTotals() };
          perModel.set(name, row);
        }
        addUsage(row, usage);
      }
    }
  }

  const rows = [...perModel.values()].sort((a, b) => b.total - a.total);
  return { totals, perModel: rows, sessionCount };
}

/** Compact token count for headline stats: 1234 → "1.2k", 2_500_000 → "2.5M". */
export function formatTokens(value: number): string {
  const n = num(value);
  if (n < 1000) return String(n);
  if (n < 1_000_000) return `${(n / 1000).toFixed(1)}k`;
  return `${(n / 1_000_000).toFixed(2)}M`;
}

/** Exact, locale-grouped integer for tables/tooltips: 1234567 → "1,234,567". */
export function formatExact(value: number): string {
  return num(value).toLocaleString();
}

/** Percentage of prompt tokens served from cache, 0 when unknown. */
export function cacheHitRate(totals: UsageTotals): number {
  const denom = totals.cacheHit + totals.cacheMiss;
  return denom > 0 ? Math.round((totals.cacheHit / denom) * 100) : 0;
}
