import { useEffect, useMemo, useRef, useState, type JSX, type ReactNode } from "react";
import { cx } from "./class-names";

export type CommandItem = {
  id: string;
  label: string;
  description?: string;
  icon?: ReactNode;
  /** Extra searchable text (aliases, command names). */
  keywords?: string;
  run: () => void;
};

type CommandPaletteProps = {
  open: boolean;
  items: CommandItem[];
  placeholder?: string;
  emptyLabel?: string;
  onClose: () => void;
};

/** ⌘K command palette: fuzzy-ish filter + keyboard navigation over actions. */
export function CommandPalette({
  open,
  items,
  placeholder,
  emptyLabel,
  onClose,
}: CommandPaletteProps): JSX.Element | null {
  const [query, setQuery] = useState("");
  const [index, setIndex] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (open) {
      setQuery("");
      setIndex(0);
      // Focus after mount.
      requestAnimationFrame(() => inputRef.current?.focus());
    }
  }, [open]);

  const matches = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return items;
    return items.filter((item) =>
      `${item.label} ${item.description ?? ""} ${item.keywords ?? ""}`.toLowerCase().includes(q)
    );
  }, [items, query]);

  useEffect(() => {
    setIndex((prev) => Math.min(prev, Math.max(0, matches.length - 1)));
  }, [matches.length]);

  if (!open) return null;

  function runAt(i: number): void {
    const item = matches[i];
    if (item) {
      item.run();
      onClose();
    }
  }

  function onKeyDown(e: React.KeyboardEvent): void {
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setIndex((i) => (matches.length === 0 ? 0 : (i + 1) % matches.length));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setIndex((i) => (matches.length === 0 ? 0 : (i - 1 + matches.length) % matches.length));
    } else if (e.key === "Enter") {
      e.preventDefault();
      runAt(index);
    } else if (e.key === "Escape") {
      e.preventDefault();
      onClose();
    }
  }

  return (
    <div className="ui-command-overlay" onClick={onClose}>
      <div className="ui-command" onClick={(e) => e.stopPropagation()}>
        <input
          ref={inputRef}
          className="ui-command-input"
          placeholder={placeholder}
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onKeyDown={onKeyDown}
        />
        <div className="ui-command-list">
          {matches.length === 0 ? (
            <div className="ui-command-empty">{emptyLabel}</div>
          ) : (
            matches.map((item, i) => (
              <button
                key={item.id}
                type="button"
                className={cx("ui-command-option", i === index && "active")}
                onMouseEnter={() => setIndex(i)}
                onClick={() => runAt(i)}
              >
                {item.icon ? <span className="ui-command-option-icon">{item.icon}</span> : null}
                <span className="ui-command-option-label">{item.label}</span>
                {item.description ? <span className="ui-command-option-desc">{item.description}</span> : null}
              </button>
            ))
          )}
        </div>
      </div>
    </div>
  );
}
