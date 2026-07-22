import { useCallback, useEffect, useMemo, useState, type JSX } from "react";
import type { SerializableSessionEntry, WorkspaceSessions } from "../../shared/ipc";
import { api } from "../api";
import { useI18n, type MessageKey, type Translate } from "../i18n";
import { Button, IconButton, Input, StatusDot } from "../ui/index";
import { aggregateByWorkspace, aggregateUsage, formatTokens } from "../lib/token-usage";

type Props = {
  activeId: string | null;
  currentRoot: string;
  /** Bumped by the parent to force a reload of the workspace tree. */
  refreshKey: number;
  /** Current workspace sessions (used for the token summary footer). */
  sessions: SerializableSessionEntry[];
  onSelectSession: (root: string, id: string) => void;
  onDelete: (id: string) => void;
  onRename: (id: string, summary: string) => void;
  onArchive: (id: string) => void;
  onUnarchive: (id: string) => void;
  onCollapse: () => void;
  onNewWorkspace: () => void;
  onNewSessionInWorkspace: (root: string) => void;
  onOpenTokens: () => void;
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

const EMPTY: WorkspaceSessions = { workspaces: [], archived: [] };

function matchesQuery(entry: SerializableSessionEntry, q: string): boolean {
  if (!q) return true;
  return (
    (entry.summary ?? "").toLowerCase().includes(q) ||
    entry.id.toLowerCase().includes(q) ||
    entry.status.toLowerCase().includes(q)
  );
}

export function Sidebar({
  activeId,
  currentRoot,
  refreshKey,
  sessions,
  onSelectSession,
  onDelete,
  onRename,
  onArchive,
  onUnarchive,
  onCollapse,
  onNewWorkspace,
  onNewSessionInWorkspace,
  onOpenTokens,
}: Props): JSX.Element {
  const { t } = useI18n();
  const [tree, setTree] = useState<WorkspaceSessions>(EMPTY);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [draft, setDraft] = useState("");
  const [searchQuery, setSearchQuery] = useState("");
  const [collapsed, setCollapsed] = useState<Set<string>>(() => new Set());
  const [archivedOpen, setArchivedOpen] = useState(false);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      const data = await api.listWorkspaceSessions();
      if (!cancelled) setTree(data);
    })();
    return () => {
      cancelled = true;
    };
  }, [refreshKey]);

  const q = searchQuery.trim().toLowerCase();

  const toggleCollapse = useCallback((root: string) => {
    setCollapsed((prev) => {
      const next = new Set(prev);
      if (next.has(root)) next.delete(root);
      else next.add(root);
      return next;
    });
  }, []);

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

  const workspaces = useMemo(
    () =>
      tree.workspaces
        .map((w) => ({ ...w, sessions: w.sessions.filter((s) => matchesQuery(s, q)) }))
        .filter((w) => !q || w.sessions.length > 0),
    [tree.workspaces, q]
  );

  const archived = useMemo(() => tree.archived.filter((a) => matchesQuery(a.session, q)), [tree.archived, q]);

  // Token summary footer figures: current workspace total + all workspaces.
  const currentTotal = useMemo(() => aggregateUsage(sessions).totals.total, [sessions]);
  const overallTotal = useMemo(() => aggregateByWorkspace(tree).reduce((sum, row) => sum + row.total, 0), [tree]);

  function renderSession(root: string, entry: SerializableSessionEntry): JSX.Element {
    const isActive = entry.id === activeId;
    return (
      <div
        key={entry.id}
        className={`ui-session-item ui-tree-session${isActive ? " active" : ""}`}
        onClick={() => onSelectSession(root, entry.id)}
      >
        {editingId === entry.id ? (
          <Input
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
          />
        ) : (
          <div className="ui-session-title">
            <span className="ui-tree-icon">💬</span>
            {entry.summary || t("sidebar.untitled")}
          </div>
        )}
        <div className="ui-session-meta">
          <StatusDot status={entry.status} />
          <span>{statusLabel(entry.status, t)}</span>
        </div>
        {isActive && editingId !== entry.id ? (
          <div className="ui-session-actions" onClick={(e) => e.stopPropagation()}>
            <Button size="sm" variant="subtle" onClick={() => beginRename(entry)}>
              {t("sidebar.rename")}
            </Button>
            <Button size="sm" variant="subtle" onClick={() => onArchive(entry.id)}>
              {t("workspace.archive")}
            </Button>
            <Button size="sm" variant="subtle" onClick={() => onDelete(entry.id)}>
              {t("sidebar.delete")}
            </Button>
          </div>
        ) : null}
      </div>
    );
  }

  return (
    <div className="ui-session-panel">
      <div className="ui-session-panel-head">
        <span>{t("sidebar.sessions")}</span>
        <div className="ui-session-panel-head-actions">
          <IconButton onClick={onNewWorkspace} title={t("sidebar.newWorkspace")} aria-label={t("sidebar.newWorkspace")}>
            ＋
          </IconButton>
          <IconButton onClick={onCollapse} title={t("sessionPanel.collapse")} aria-label={t("sessionPanel.collapse")}>
            ⟨
          </IconButton>
        </div>
      </div>

      <div className="ui-session-search">
        <Input
          type="text"
          placeholder={t("sidebar.search")}
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
        />
      </div>

      <div className="ui-session-list">
        {workspaces.length === 0 && archived.length === 0 ? (
          <div className="ui-session-empty">{searchQuery ? t("sidebar.noResults") : t("sidebar.none")}</div>
        ) : null}

        {workspaces.map((w) => {
          const isOpen = q ? true : !collapsed.has(w.root);
          const isCurrent = w.root === currentRoot;
          return (
            <div key={w.root} className="ui-tree-workspace">
              <div
                className={`ui-tree-ws-head${isCurrent ? " current" : ""}`}
                onClick={() => toggleCollapse(w.root)}
                title={w.root}
              >
                <span className="ui-tree-caret">{isOpen ? "▾" : "▸"}</span>
                <span className="ui-tree-icon">📁</span>
                <span className="ui-tree-ws-label">{w.label}</span>
                <span className="ui-tree-count">{w.sessions.length}</span>
                <IconButton
                  className="ui-tree-ws-new"
                  title={t("workspace.newSession")}
                  aria-label={t("workspace.newSession")}
                  onClick={(e) => {
                    e.stopPropagation();
                    onNewSessionInWorkspace(w.root);
                  }}
                >
                  ＋
                </IconButton>
              </div>
              {isOpen ? (
                <div className="ui-tree-children">
                  {w.sessions.length === 0 ? (
                    <div className="ui-session-empty">{t("workspace.empty")}</div>
                  ) : (
                    w.sessions.map((s) => renderSession(w.root, s))
                  )}
                </div>
              ) : null}
            </div>
          );
        })}

        {archived.length > 0 ? (
          <div className="ui-tree-workspace ui-tree-archived">
            <div className="ui-tree-ws-head" onClick={() => setArchivedOpen((v) => !v)}>
              <span className="ui-tree-caret">{archivedOpen || q ? "▾" : "▸"}</span>
              <span className="ui-tree-icon">🗄</span>
              <span className="ui-tree-ws-label">{t("workspace.archivedGroup")}</span>
              <span className="ui-tree-count">{archived.length}</span>
            </div>
            {archivedOpen || q ? (
              <div className="ui-tree-children">
                {archived.map(({ root, session }) => (
                  <div key={session.id} className="ui-session-item ui-tree-session archived">
                    <div className="ui-session-title">
                      <span className="ui-tree-icon">💬</span>
                      {session.summary || t("sidebar.untitled")}
                    </div>
                    <div className="ui-session-actions" onClick={(e) => e.stopPropagation()}>
                      <Button size="sm" variant="subtle" onClick={() => onUnarchive(session.id)}>
                        {t("workspace.unarchive")}
                      </Button>
                      <Button size="sm" variant="subtle" onClick={() => onDelete(session.id)}>
                        {t("sidebar.delete")}
                      </Button>
                    </div>
                    <div className="ui-tree-ws-path" title={root}>
                      {root}
                    </div>
                  </div>
                ))}
              </div>
            ) : null}
          </div>
        ) : null}
      </div>

      <button className="ui-session-tokens" onClick={onOpenTokens} title={t("topbar.tokenPanelTitle")}>
        <span className="ui-session-tokens-part">
          <span className="ui-session-tokens-label">{t("tokens.workspaceTotal")}</span>
          <span className="ui-session-tokens-value">{formatTokens(currentTotal)}</span>
        </span>
        <span className="ui-session-tokens-part">
          <span className="ui-session-tokens-label">{t("tokens.overall")}</span>
          <span className="ui-session-tokens-value">{formatTokens(overallTotal)}</span>
        </span>
      </button>
    </div>
  );
}
