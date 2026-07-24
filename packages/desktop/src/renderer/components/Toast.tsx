import { useCallback, useRef, useState, type JSX } from "react";

export type ToastKind = "info" | "success" | "error";
export type Toast = { id: number; kind: ToastKind; text: string };

let nextId = 1;

/**
 * Lightweight toast notification hook + renderer. Call `push(kind, text)`
 * to show a transient notification that auto-dismisses after 3.5s.
 */
export function useToasts(): { toasts: Toast[]; push: (kind: ToastKind, text: string) => void } {
  const [toasts, setToasts] = useState<Toast[]>([]);
  const timersRef = useRef<Map<number, ReturnType<typeof setTimeout>>>(new Map());

  const push = useCallback((kind: ToastKind, text: string) => {
    const id = nextId++;
    setToasts((prev) => [...prev.slice(-4), { id, kind, text }]);
    const timer = setTimeout(() => {
      setToasts((prev) => prev.filter((t) => t.id !== id));
      timersRef.current.delete(id);
    }, 3500);
    timersRef.current.set(id, timer);
  }, []);

  return { toasts, push };
}

export function ToastContainer({ toasts }: { toasts: Toast[] }): JSX.Element | null {
  if (toasts.length === 0) return null;
  return (
    <div className="ui-toast-container">
      {toasts.map((toast) => (
        <div key={toast.id} className={`ui-toast ui-toast--${toast.kind}`}>
          <span className="ui-toast-icon">{toast.kind === "success" ? "✓" : toast.kind === "error" ? "✗" : "ℹ"}</span>
          <span className="ui-toast-text">{toast.text}</span>
        </div>
      ))}
    </div>
  );
}
