import { useEffect, useState, type JSX } from "react";
import type { DiffPayload } from "../../shared/ipc";
import { api } from "../api";
import { useI18n } from "../i18n";

/** A universal diff target: git working tree, agent change, or a whole commit. */
export type DiffTarget =
  | { kind: "git"; file: string; staged: boolean }
  | { kind: "agent"; sessionId: string; file: string }
  | { kind: "commit"; hash: string; subject?: string };

type DiffRow = {
  text: string;
  kind: "added" | "removed" | "hunk" | "meta" | "context";
  oldNo?: number;
  newNo?: number;
};

function classifyDiff(diff: string): DiffRow[] {
  let oldLine = 0;
  let newLine = 0;
  return diff.split("\n").map((line): DiffRow => {
    // Parse hunk headers to track line numbers
    const hunkMatch = line.match(/^@@ -(\d+)/);
    if (hunkMatch) {
      oldLine = parseInt(hunkMatch[1] ?? "0", 10);
      const newMatch = line.match(/\+(\d+)/);
      newLine = parseInt(newMatch?.[1] ?? "0", 10);
      return { text: line, kind: "hunk" };
    }
    if (line.startsWith("+++") || line.startsWith("---") || line.startsWith("diff ") || line.startsWith("index ")) {
      return { text: line, kind: "meta" };
    }
    if (line.startsWith("+")) {
      return { text: line, kind: "added", newNo: newLine++ };
    }
    if (line.startsWith("-")) {
      return { text: line, kind: "removed", oldNo: oldLine++ };
    }
    // Context line
    return { text: line, kind: "context", oldNo: oldLine++, newNo: newLine++ };
  });
}

async function loadDiff(target: DiffTarget): Promise<DiffPayload> {
  if (target.kind === "git") return api.gitDiff(target.file, target.staged);
  if (target.kind === "agent") return api.agentChangesDiff(target.sessionId, target.file);
  return api.gitCommitDiff(target.hash);
}

/**
 * A large secondary overlay used everywhere a diff is viewed — source control
 * files, agent file changes, and whole commits all render through this panel.
 */
export function DiffOverlay({ target, onClose }: { target: DiffTarget; onClose: () => void }): JSX.Element {
  const { t } = useI18n();
  const [payload, setPayload] = useState<DiffPayload | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    void (async () => {
      const p = await loadDiff(target);
      if (!cancelled) {
        setPayload(p);
        setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [target]);

  useEffect(() => {
    function onKey(e: KeyboardEvent): void {
      if (e.key === "Escape") onClose();
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  const title = target.kind === "commit" ? (target.subject ?? target.hash) : (payload?.file ?? "");
  const rows = payload && !payload.binary ? classifyDiff(payload.diff) : [];
  const addedCount = rows.filter((r) => r.kind === "added").length;
  const removedCount = rows.filter((r) => r.kind === "removed").length;

  return (
    <div className="ui-diff-overlay" onClick={onClose}>
      <div className="ui-diff-overlay-panel" onClick={(e) => e.stopPropagation()}>
        <div className="ui-diff-overlay-head">
          <span className="ui-diff-overlay-title" title={title}>
            {title || t("diff.title")}
          </span>
          {rows.length > 0 ? (
            <span className="ui-diff-stats">
              <span className="ui-diff-stat-add">+{addedCount}</span>
              <span className="ui-diff-stat-del">-{removedCount}</span>
            </span>
          ) : null}
          <button
            className="ui-diff-overlay-close"
            onClick={onClose}
            aria-label={t("common.close")}
            title={t("common.close")}
          >
            ✕
          </button>
        </div>
        <div className="ui-diff-overlay-body">
          {loading ? (
            <div className="ui-diff-empty ui-diff-loading">
              <span className="ui-spinner" /> {t("diff.loading") || "Loading…"}
            </div>
          ) : !payload ? (
            <div className="ui-diff-empty">{t("diff.selectFile")}</div>
          ) : payload.binary ? (
            <div className="ui-diff-empty">{t("diff.binary")}</div>
          ) : !payload.diff.trim() ? (
            <div className="ui-diff-empty">{t("diff.noDiff")}</div>
          ) : (
            <pre className="ui-diff-body">
              {rows.map((row, i) => (
                <div key={i} className={`ui-diff-line ${row.kind}`}>
                  <span className="ui-diff-ln">{row.oldNo ?? ""}</span>
                  <span className="ui-diff-ln">{row.newNo ?? ""}</span>
                  <span className="ui-diff-text">{row.text || " "}</span>
                </div>
              ))}
            </pre>
          )}
        </div>
      </div>
    </div>
  );
}
