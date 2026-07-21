import type { InputHTMLAttributes, JSX, ReactNode, SelectHTMLAttributes, TextareaHTMLAttributes } from "react";
import { cx } from "./class-names";

type FieldProps = {
  label?: ReactNode;
  hint?: ReactNode;
  /** Render the hint in the warning color. */
  hintWarn?: boolean;
  children: ReactNode;
  className?: string;
};

/** Labeled form field wrapper (label + control + optional hint). */
export function Field({ label, hint, hintWarn = false, children, className }: FieldProps): JSX.Element {
  return (
    <div className={cx("ui-field", className)}>
      {label ? <label className="ui-field-label">{label}</label> : null}
      {children}
      {hint ? <div className={cx("ui-field-hint", hintWarn && "warn")}>{hint}</div> : null}
    </div>
  );
}

/** Single-line text input. */
export function Input({ className, ...rest }: InputHTMLAttributes<HTMLInputElement>): JSX.Element {
  return <input className={cx("ui-input", className)} {...rest} />;
}

/** Multi-line text input. */
export function TextArea({ className, ...rest }: TextareaHTMLAttributes<HTMLTextAreaElement>): JSX.Element {
  return <textarea className={cx("ui-textarea", className)} {...rest} />;
}

/** Native select. */
export function Select({ className, children, ...rest }: SelectHTMLAttributes<HTMLSelectElement>): JSX.Element {
  return (
    <select className={cx("ui-select", className)} {...rest}>
      {children}
    </select>
  );
}
