import type { CSSProperties, HTMLAttributes, JSX, ReactNode } from "react";
import { cx } from "./class-names";

type Gap = 0 | 1 | 2 | 3 | 4 | 5 | 6;

function gapStyle(gap?: Gap): CSSProperties | undefined {
  return gap === undefined ? undefined : { gap: `var(--ui-space-${gap})` };
}

type StackProps = HTMLAttributes<HTMLDivElement> & {
  gap?: Gap;
  align?: CSSProperties["alignItems"];
  justify?: CSSProperties["justifyContent"];
};

/** Vertical flex column. */
export function Stack({ gap = 3, align, justify, style, className, ...rest }: StackProps): JSX.Element {
  return (
    <div
      className={cx("ui-stack", className)}
      style={{ ...gapStyle(gap), alignItems: align, justifyContent: justify, ...style }}
      {...rest}
    />
  );
}

type RowProps = StackProps;

/** Horizontal flex row. */
export function Row({ gap = 2, align = "center", justify, style, className, ...rest }: RowProps): JSX.Element {
  return (
    <div
      className={cx("ui-row", className)}
      style={{ ...gapStyle(gap), alignItems: align, justifyContent: justify, ...style }}
      {...rest}
    />
  );
}

type GridProps = HTMLAttributes<HTMLDivElement> & { gap?: Gap; columns?: number | string };

/** CSS grid container. */
export function Grid({ gap = 3, columns, style, className, ...rest }: GridProps): JSX.Element {
  const gridTemplateColumns =
    typeof columns === "number" ? `repeat(${columns}, 1fr)` : typeof columns === "string" ? columns : undefined;
  return (
    <div className={cx("ui-grid", className)} style={{ ...gapStyle(gap), gridTemplateColumns, ...style }} {...rest} />
  );
}

/** Flexible spacer that pushes siblings apart. */
export function Spacer(): JSX.Element {
  return <div className="ui-spacer" />;
}

/** Thin rule; pass `vertical` for a column separator. */
export function Divider({ vertical = false, className }: { vertical?: boolean; className?: string }): JSX.Element {
  return <hr className={cx("ui-divider", vertical && "ui-divider--vertical", className)} />;
}

type ScrollAreaProps = HTMLAttributes<HTMLDivElement> & { children?: ReactNode };

/** Overflow-scrolling region. */
export function ScrollArea({ className, ...rest }: ScrollAreaProps): JSX.Element {
  return <div className={cx("ui-scroll", className)} {...rest} />;
}
