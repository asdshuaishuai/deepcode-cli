import { useMemo, useState, type JSX } from "react";
import type { SerializableSessionEntry } from "../../shared/ipc";
import { useI18n, type MessageKey, type Translate } from "../i18n";

type Props = {
  sessions: SerializableSessionEntry[];
  activeId: string | null;
  onSelect: (id: string) => void;
  onNew: () => void;
  onDelete: (id: string) => void;
  onRename: (id: string, summary: string) => void;
};

const KNOWN_STATUSES = new Set([
  "running",
  "completed",
  "error",
  "interrupted",
  "ask_permission",
  "waiting_for_user",
  "compacting",
  "idle",
]);

function statusLabel(status: string, t: Translate): string {
  return KNOWN_STATUSES.has(status) ? t(`status.${status}` as MessageKey) : status;
}

function relativeTime(iso: string, t: Translate): string {
  const then = new Date(iso).getTime();
  if (Number.isNaN(then)) {
    return "";
  }
  const diff = Date.now() - then;
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return t("time.justNow");
  if (mins < 60) return t("time.minutesAgo", { n: mins });
  const hours = Math.floor(mins / 60);
  if (hours < 24) return t("time.hoursAgo", { n: hours });
  return t("time.daysAgo", { n: Math.floor(hours / 24) });
}

function highlightText(text: string, query: string): JSX.Element {
  if (!query.trim()) return <>{text}</>;
  const escaped = query.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const parts = text.split(new RegExp(`(${escaped})`, "gi"));
  return (
    <>
      {parts.map((part, i) =>
        part.toLowerCase() === query.toLowerCase() ? (
          <mark
            key={i}
            style={{ background: "var(--yellow)", color: "var(--text)", borderRadius: 3, padding: "0 2px" }}
          >
            {part}
          </mark>
        ) : (
          part
        )
      )}
    </>
  );
}

export function Sidebar({ sessions, activeId, onSelect, onNew, onDelete, onRename }: Props): JSX.Element {
  const { t } = useI18n();
  const [editingId, setEditingId] = useState<string | null>(null);
  const [draft, setDraft] = useState("");
  const [searchQuery, setSearchQuery] = useState("");

  const filteredSessions = useMemo(() => {
    if (!searchQuery.trim()) return sessions;
    const q = searchQuery.toLowerCase();
    return sessions.filter(
      (s) =>
        (s.summary ?? "").toLowerCase().includes(q) ||
        s.id.toLowerCase().includes(q) ||
        s.status.toLowerCase().includes(q)
    );
  }, [sessions, searchQuery]);

  function beginRename(entry: SerializableSessionEntry): void {
    setEditingId(entry.id);
    setDraft(entry.summary ?? "");
  }

  function commitRename(id: string): void {
    const value = draft.trim();
    if (value) {
      onRename(id, value);
    }
    setEditingId(null);
  }

  return (
    <div className="sidebar">
      <div className="sidebar-head">
        <span>{t("sidebar.sessions")}</span>
        <button className="btn-new gel" onClick={onNew}>
          {t("sidebar.new")}
        </button>
      </div>

      {/* Search input */}
      <div className="sidebar-search">
        <input
          type="text"
          placeholder={t("sidebar.search") || "Search sessions…"}
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
        />
      </div>

      <div className="session-list">
        {filteredSessions.length === 0 ? (
          <div style={{ padding: "8px 10px", color: "var(--text-faint)", fontSize: 12 }}>
            {searchQuery ? t("sidebar.noResults") || "No matching sessions." : t("sidebar.none")}
          </div>
        ) : null}
        {filteredSessions.map((entry) => (
          <div
            key={entry.id}
            className={`session-item${entry.id === activeId ? " active" : ""}`}
            onClick={() => onSelect(entry.id)}
          >
            {editingId === entry.id ? (
              <input
                type="text"
                autoFocus
                value={draft}
                onChange={(e) => setDraft(e.target.value)}
                onClick={(e) => e.stopPropagation()}
                onBlur={() => commitRename(entry.id)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") commitRename(entry.id);
                  if (e.key === "Escape") setEditingId(null);
                }}
                style={{
                  width: "100%",
                  background: "var(--bg)",
                  border: "1px solid var(--accent)",
                  color: "var(--text)",
                  borderRadius: 6,
                  padding: "4px 6px",
                  fontSize: 13,
                }}
              />
            ) : (
              <div className="session-title">
                {searchQuery
                  ? highlightText(entry.summary || t("sidebar.untitled"), searchQuery)
                  : entry.summary || t("sidebar.untitled")}
              </div>
            )}
            <div className="session-meta">
              <span className={`status-dot ${entry.status}`} />
              <span>{statusLabel(entry.status, t)}</span>
              <span>· {relativeTime(entry.updateTime, t)}</span>
            </div>
            {entry.id === activeId && editingId !== entry.id ? (
              <div className="session-actions" onClick={(e) => e.stopPropagation()}>
                <button onClick={() => beginRename(entry)}>{t("sidebar.rename")}</button>
                <button onClick={() => onDelete(entry.id)}>{t("sidebar.delete")}</button>
              </div>
            ) : null}
          </div>
        ))}
      </div>
    </div>
  );
}
