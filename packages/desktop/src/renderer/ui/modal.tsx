import { useEffect, useRef, type JSX, type ReactNode } from "react";
import { cx } from "./class-names";

type ModalProps = {
  /** Called on Esc key or backdrop click. */
  onClose: () => void;
  /** Wider layout for tabbed/settings modals. */
  wide?: boolean;
  title?: ReactNode;
  subtitle?: ReactNode;
  /** Footer action row (rendered right-aligned). */
  actions?: ReactNode;
  children?: ReactNode;
  className?: string;
};

/** Overlay dialog with backdrop-click + Esc close and initial focus capture. */
export function Modal({
  onClose,
  wide = false,
  title,
  subtitle,
  actions,
  children,
  className,
}: ModalProps): JSX.Element {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    ref.current?.focus();
    function onKey(e: KeyboardEvent): void {
      if (e.key === "Escape") {
        e.stopPropagation();
        onClose();
      }
    }
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [onClose]);

  return (
    <div className="ui-modal-overlay" onClick={onClose}>
      <div
        ref={ref}
        tabIndex={-1}
        className={cx("ui-modal", wide && "ui-modal--wide", className)}
        onClick={(e) => e.stopPropagation()}
      >
        {title ? <h2>{title}</h2> : null}
        {subtitle ? <div className="ui-modal-sub">{subtitle}</div> : null}
        {children}
        {actions ? <div className="ui-modal-actions">{actions}</div> : null}
      </div>
    </div>
  );
}
