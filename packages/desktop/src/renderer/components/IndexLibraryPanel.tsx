import { useCallback, useEffect, useState, type JSX } from "react";
import type { CodegraphIndexEntry } from "../../shared/ipc";
import { api } from "../api";
import { useI18n } from "../i18n";
import { Button, IconButton } from "../ui/index";

/**
 * Left-panel index library (item 7): every known workspace with its CodeGraph
 * state and a reset button that runs `index` when initialized, else `init`.
 */
export function IndexLibraryPanel(): JSX.Element {
  const { t } = useI18n();
  const [entries, setEntries] = useState<CodegraphIndexEntry[]>([]);
  const [busy, setBusy] = useState<string | null>(null);

  const reload = useCallback(async () => {
    setEntries(await api.codegraphList());
  }, []);

  useEffect(() => {
    void reload();
  }, [reload]);

  const reindex = useCallback(
    async (root: string) => {
      setBusy(root);
      try {
        await api.codegraphReindex(root);
        await reload();
      } finally {
        setBusy(null);
      }
    },
    [reload]
  );

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
              <Button
                size="sm"
                variant="subtle"
                disabled={busy === entry.root}
                onClick={() => void reindex(entry.root)}
              >
                {busy === entry.root ? t("index.reindexing") : t("index.reindex")}
              </Button>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
