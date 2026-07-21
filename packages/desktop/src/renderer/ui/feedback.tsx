import type { HTMLAttributes, JSX, ReactNode } from "react";
import { cx } from "./class-names";

type StatusDotProps = HTMLAttributes<HTMLSpanElement> & {
  /** Session/tool status name; maps to a token-driven color modifier. */
  status?: string;
};

/** Small colored status indicator. */
export function StatusDot({ status, className, ...rest }: StatusDotProps): JSX.Element {
  return <span className={cx("ui-status-dot", status && `ui-status-dot--${status}`, className)} {...rest} />;
}

type TooltipProps = {
  /** Tooltip text surfaced via the native title attribute. */
  label: string;
  children: ReactNode;
  className?: string;
};

/**
 * Lightweight title-based tooltip wrapper. Renders an inline element carrying
 * the `title`, keeping accessibility + zero runtime cost.
 */
export function Tooltip({ label, children, className }: TooltipProps): JSX.Element {
  return (
    <span className={cx("ui-tooltip", className)} title={label}>
      {children}
    </span>
  );
}
