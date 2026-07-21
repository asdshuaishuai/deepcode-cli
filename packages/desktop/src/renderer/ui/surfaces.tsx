import type { HTMLAttributes, JSX, ReactNode } from "react";
import { cx } from "./class-names";

type DivProps = HTMLAttributes<HTMLDivElement>;

/** Bordered flat surface. */
export function Panel({ className, ...rest }: DivProps): JSX.Element {
  return <div className={cx("ui-panel", className)} {...rest} />;
}

/** Elevated content card. Pass `warn` for the attention border. */
export function Card({ warn = false, className, ...rest }: DivProps & { warn?: boolean }): JSX.Element {
  return <div className={cx("ui-card", warn && "ui-card--warn", className)} {...rest} />;
}

/** Card title row. */
export function CardHeader({ className, ...rest }: DivProps): JSX.Element {
  return <div className={cx("ui-card-header", className)} {...rest} />;
}

/** Card content body. */
export function CardBody({ className, ...rest }: DivProps): JSX.Element {
  return <div className={cx("ui-card-body", className)} {...rest} />;
}

type EmptyStateProps = {
  icon?: ReactNode;
  title?: ReactNode;
  children?: ReactNode;
  className?: string;
};

/** Centered placeholder for empty regions. */
export function EmptyState({ icon, title, children, className }: EmptyStateProps): JSX.Element {
  return (
    <div className={cx("ui-empty", className)}>
      {icon ? <div className="ui-empty-icon">{icon}</div> : null}
      {title ? <div className="ui-empty-title">{title}</div> : null}
      {children}
    </div>
  );
}
