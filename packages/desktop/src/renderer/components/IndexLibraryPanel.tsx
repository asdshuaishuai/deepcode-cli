import { useCallback, useEffect, useRef, useState, type JSX } from "react";
import type { CodegraphIndexEntry, CodegraphProgressEvent } from "../../shared/ipc";
import { api } from "../api";
import { useI18n } from "../i18n";
import { Button, IconButton } from "../ui/index";

/**
 * Left-panel index library (item 7): every known workspace with its CodeGraph
 * state and a reset button that runs `init` with live output visualization.
 */
export function IndexLibraryPanel(): JSX.Element {
  const { t } = useI18n();
  const [entries, setEntries] = useState<CodegraphIndexEntry[]>([]);
  const [busy, setBusy] = useState<string | null>(null);
  const [logLines, setLogLines] = useState<string[]>([]);
  const [logRoot, setLogRoot] = useState<string | null>(null);
  const logEndRef = useRef<HTMLDivElement | null>(null);

  const reload = useCallback(async () => {
    setEntries(await api.codegraphList());
  }, []);

  useEffect(() => {
    void reload();
  }, [reload]);

  // Subscribe to streaming codegraph progress events.
  useEffect(() => {
    const off = api.onCodegraphProgress((event: CodegraphProgressEvent) => {
      if (event.done) {
        setBusy(null);
        setLogLines((prev) => {
          const suffix = event.exitCode === 0 ? t("index.done") : `${t("index.failed")} (exit ${event.exitCode})`;
          return [...prev, `\n✓ ${suffix}`];
        });
        void reload();
        return;
      }
      setLogRoot(event.root);
      setLogLines((prev) => {
        const text = event.chunk.replace(/\n$/, "");
        if (!text) return prev;
        const lines = text.split("\n");
        const next = [...prev, ...lines];
        // Cap at 200 lines to avoid unbounded growth.
        return next.length > 200 ? next.slice(next.length - 200) : next;
      });
    });
    return off;
  }, [reload, t]);

  // Auto-scroll log to bottom on new lines.
  useEffect(() => {
    logEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [logLines]);

  const reindex = useCallback(async (root: string) => {
    setBusy(root);
    setLogRoot(root);
    setLogLines([`$ codegraph init ${root}`]);
    try {
      await api.codegraphReindex(root);
    } finally {
      // busy is cleared by the progress event handler (done=true)
    }
  }, []);

  const showLog = logRoot !== null && logLines.length > 0;

  return (
    <div className="ui-side-panel">
      <div className="ui-side-panel-head">
        <span>{t("index.title")}</span>
        <IconButton onClick={() => void reload()} title={t("scm.refresh")} aria-label={t("scm.refresh")}>
          ⟳
        </IconButton>
      </div>
      <div className="ui-side-panel-body">
        {entries.length === 0 ? (
          <div className="ui-side-panel-empty">{t("index.empty")}</div>
        ) : (
          entries.map((entry) => (
            <div key={entry.root} className="ui-index-row" title={entry.root}>
              <div className="ui-index-main">
                <div className="ui-index-name">{entry.label}</div>
                <div className={`ui-index-state${entry.initialized ? " on" : ""}`}>
                  {entry.initialized ? t("index.indexed") : t("index.uninitialized")}
                </div>
              </div>
              <Button size="sm" variant="subtle" disabled={busy !== null} onClick={() => void reindex(entry.root)}>
                {busy === entry.root ? t("index.reindexing") : entry.initialized ? t("index.reindex") : t("index.init")}
              </Button>
            </div>
          ))
        )}

        {showLog && (
          <div className="ui-index-log">
            <div className="ui-index-log-head">
              <span>{logRoot}</span>
              <IconButton
                onClick={() => {
                  setLogRoot(null);
                  setLogLines([]);
                }}
                title="✕"
                aria-label="close"
              >
                ✕
              </IconButton>
            </div>
            <pre className="ui-index-log-body">
              {logLines.join("\n")}
              <div ref={logEndRef} />
            </pre>
          </div>
        )}
      </div>
    </div>
  );
}
