import { useCallback, useEffect, useRef, useState, type JSX } from "react";
import type { FileMatch } from "../../shared/ipc";
import { api } from "../api";

type Props = {
  /** Whether the menu is visible (based on @ token detection). */
  open: boolean;
  /** The current partial query after @. */
  query: string;
  /** Called when a file/directory is selected. */
  onSelect: (item: FileMatch) => void;
  /** Called to close the menu. */
  onClose: () => void;
  /** Cursor position for placement. */
  anchorRect?: DOMRect | null;
};

export function FileMentionMenu({ open, query, onSelect, onClose, anchorRect }: Props): JSX.Element | null {
  const [items, setItems] = useState<FileMatch[]>([]);
  const [activeIndex, setActiveIndex] = useState(0);
  const [loading, setLoading] = useState(false);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Fetch files when query changes (debounced)
  useEffect(() => {
    if (!open || !query.trim()) {
      setItems([]);
      return;
    }

    setLoading(true);
    if (debounceRef.current) clearTimeout(debounceRef.current);

    debounceRef.current = setTimeout(async () => {
      try {
        const results = await api.scanFiles(query);
        setItems(results);
        setActiveIndex(0);
      } catch {
        setItems([]);
      } finally {
        setLoading(false);
      }
    }, 150);

    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, [open, query]);

  const handleSelect = useCallback(
    (item: FileMatch) => {
      onSelect(item);
      onClose();
    },
    [onSelect, onClose]
  );

  // Keyboard navigation (handled by parent Composer)
  // Exposed for parent to call via ref if needed
  if (!open) return null;

  return (
    <div
      className="ui-file-mention-menu"
      style={anchorRect ? { maxHeight: Math.min(240, window.innerHeight - anchorRect.bottom - 20) } : undefined}
    >
      {loading ? (
        <div className="ui-file-mention-loading">Scanning…</div>
      ) : items.length === 0 ? (
        <div className="ui-file-mention-empty">{query ? "No matching files" : "Type to search files…"}</div>
      ) : (
        items.map((item, i) => (
          <button
            key={item.path}
            className={`ui-file-mention-option${i === activeIndex ? " active" : ""}`}
            onMouseDown={(e) => {
              e.preventDefault();
              handleSelect(item);
            }}
            onMouseEnter={() => setActiveIndex(i)}
          >
            <span className="ui-file-mention-icon">{item.type === "directory" ? "📁" : "📄"}</span>
            <span className="ui-file-mention-path">{item.path}</span>
          </button>
        ))
      )}
    </div>
  );
}
