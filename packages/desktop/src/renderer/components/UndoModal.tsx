import { useEffect, useState, type JSX } from "react";
import type { UndoTarget } from "../../shared/ipc";
import { api } from "../api";
import { useI18n } from "../i18n";

type Props = {
  sessionId: string | null;
  onClose: () => void;
  /** Called after a successful restore so the parent can reload messages. */
  onRestored: () => void;
};

function preview(target: UndoTarget): string {
  const raw = (target.message.content ?? "").replace(/\s+/g, " ").trim();
  if (!raw) return "(empty)";
  return raw.length > 96 ? `${raw.slice(0, 96)}…` : raw;
}

export function UndoModal({ sessionId, onClose, onRestored }: Props): JSX.Element {
  const { t } = useI18n();
  const [targets, setTargets] = useState<UndoTarget[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);

  useEffect(() => {
    let disposed = false;
    void (async () => {
      if (!sessionId) {
        setLoading(false);
        return;
      }
      try {
        const list = await api.listUndoTargets(sessionId);
        if (!disposed) setTargets(list);
      } finally {
        if (!disposed) setLoading(false);
      }
    })();
    return () => {
      disposed = true;
    };
  }, [sessionId]);

  const restore = async (target: UndoTarget, mode: "conversation" | "code-and-conversation"): Promise<void> => {
    if (!sessionId) return;
    setBusyId(target.message.id);
    setError(null);
    try {
      const result = await api.restoreUndo(sessionId, target.message.id, mode);
      if (result.ok) {
        onRestored();
        onClose();
      } else {
        setError(result.error ?? t("undo.failed"));
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setBusyId(null);
    }
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal undo-modal" onClick={(e) => e.stopPropagation()}>
        <h2>{t("undo.title")}</h2>
        <div className="modal-sub">{t("undo.subtitle")}</div>
        {error ? <div className="undo-error">{error}</div> : null}
        <div className="undo-list">
          {!sessionId ? (
            <div className="undo-empty">{t("undo.needSession")}</div>
          ) : loading ? (
            <div className="undo-empty">…</div>
          ) : targets.length === 0 ? (
            <div className="undo-empty">{t("undo.none")}</div>
          ) : (
            targets.map((target) => (
              <div className="undo-item" key={target.message.id}>
                <div className="undo-preview">
                  <span className="undo-index">#{target.index + 1}</span> {preview(target)}
                </div>
                {target.canRestoreCode ? <div className="undo-label">{t("undo.codeAvailable")}</div> : null}
                <div className="undo-mode">
                  <button disabled={busyId !== null} onClick={() => void restore(target, "conversation")}>
                    {t("undo.restoreConversation")}
                  </button>
                  {target.canRestoreCode ? (
                    <button disabled={busyId !== null} onClick={() => void restore(target, "code-and-conversation")}>
                      {t("undo.restoreBoth")}
                    </button>
                  ) : null}
                </div>
              </div>
            ))
          )}
        </div>
        <div className="modal-actions">
          <button className="ghost" onClick={onClose}>
            {t("common.close")}
          </button>
        </div>
      </div>
    </div>
  );
}
