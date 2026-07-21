import type { ButtonHTMLAttributes, HTMLAttributes, InputHTMLAttributes, JSX, ReactNode } from "react";
import { cx } from "./class-names";

type ButtonVariant = "primary" | "ghost" | "subtle" | "danger" | "default";
type ButtonSize = "sm" | "md";

type ButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: ButtonVariant;
  size?: ButtonSize;
  /** Render as a square icon-only button. */
  icon?: boolean;
};

/** Primary action button with variants + sizes. */
export function Button({
  variant = "default",
  size = "md",
  icon = false,
  className,
  type = "button",
  ...rest
}: ButtonProps): JSX.Element {
  return (
    <button
      type={type}
      className={cx(
        "ui-btn",
        variant !== "default" && `ui-btn--${variant}`,
        size === "sm" && "ui-btn--sm",
        icon && "ui-btn--icon",
        className
      )}
      {...rest}
    />
  );
}

/** Borderless square icon button (rail/toolbar affordance). */
export function IconButton({
  className,
  type = "button",
  ...rest
}: ButtonHTMLAttributes<HTMLButtonElement>): JSX.Element {
  return <button type={type} className={cx("ui-icon-btn", className)} {...rest} />;
}

/** Rounded pill button/label. */
export function Pill({
  warn = false,
  className,
  type = "button",
  ...rest
}: ButtonProps & { warn?: boolean }): JSX.Element {
  return <button type={type} className={cx("ui-pill", warn && "ui-pill--warn", className)} {...rest} />;
}

/** Monospace inline tag. */
export function Tag({ className, ...rest }: HTMLAttributes<HTMLSpanElement>): JSX.Element {
  return <span className={cx("ui-tag", className)} {...rest} />;
}

/** Small count badge. */
export function Badge({ className, ...rest }: HTMLAttributes<HTMLSpanElement>): JSX.Element {
  return <span className={cx("ui-badge", className)} {...rest} />;
}

type SwitchProps = Omit<InputHTMLAttributes<HTMLInputElement>, "type"> & { label?: ReactNode };

/** On/off toggle switch. */
export function Switch({ label, className, title, ...rest }: SwitchProps): JSX.Element {
  return (
    <label className={cx("ui-switch", className)} title={title}>
      <input type="checkbox" {...rest} />
      <span className="ui-switch-track" />
      {label}
    </label>
  );
}

type CheckboxProps = Omit<InputHTMLAttributes<HTMLInputElement>, "type"> & { label?: ReactNode };

/** Labeled checkbox. */
export function Checkbox({ label, className, ...rest }: CheckboxProps): JSX.Element {
  return (
    <label className={cx("ui-checkbox", className)}>
      <input type="checkbox" {...rest} />
      {label}
    </label>
  );
}

type SegmentedOption<T extends string> = { value: T; label: ReactNode };

type SegmentedProps<T extends string> = {
  options: SegmentedOption<T>[];
  value: T;
  onChange: (value: T) => void;
  className?: string;
};

/** Segmented control (mutually exclusive tabs). */
export function Segmented<T extends string>({ options, value, onChange, className }: SegmentedProps<T>): JSX.Element {
  return (
    <div className={cx("ui-segmented", className)}>
      {options.map((opt) => (
        <button
          key={opt.value}
          type="button"
          className={cx("ui-segmented-option", opt.value === value && "active")}
          onClick={() => onChange(opt.value)}
        >
          {opt.label}
        </button>
      ))}
    </div>
  );
}
