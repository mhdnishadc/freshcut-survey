import type { ReactNode } from "react";

import { Card, cx } from "@/components/ui";
import type { Slice } from "@/lib/analytics/aggregate";

/**
 * The chart vocabulary for this dashboard: a horizontal bar list, a split bar,
 * and a stat tile. Every chart is single-series in one hue, so magnitude is
 * carried by bar length and never by colour identity — there is no categorical
 * palette here to get colour-vision wrong.
 *
 * These are Server Components: no chart library ships to the phone.
 */

// ---------------------------------------------------------------------------

export function ChartCard({
  title,
  hint,
  children,
  footnote,
}: {
  title: string;
  hint?: string;
  children: ReactNode;
  footnote?: string;
}) {
  return (
    <Card className="flex flex-col">
      <div className="mb-4">
        <h3 className="text-[15px] leading-snug font-semibold text-foreground">{title}</h3>
        {hint ? <p className="mt-0.5 text-[13px] leading-snug text-muted">{hint}</p> : null}
      </div>
      <div className="flex-1">{children}</div>
      {footnote ? <p className="mt-3 text-[12px] text-faint">{footnote}</p> : null}
    </Card>
  );
}

// ---------------------------------------------------------------------------

type BarListProps = {
  items: Slice[];
  /** How the value at the bar tip reads. Defaults to the raw count. */
  format?: (item: Slice) => string;
  /** Show the ordinal ramp instead of one solid fill — for ordered scales. */
  ordinal?: boolean;
  /** Longest list before the tail is folded away. */
  limit?: number;
  emptyLabel?: string;
};

/**
 * Horizontal bars, longest first. Rows are a definition list rather than a
 * canvas, so a screen reader reads "Onion, 24" and the values are selectable
 * text. Every bar is direct-labelled at the tip, so no value is hidden behind
 * a hover — which is why there is no tooltip layer here.
 */
export function BarList({
  items,
  format = (item) => String(item.count),
  ordinal = false,
  limit,
  emptyLabel = "No answers yet",
}: BarListProps) {
  const visible = limit ? items.slice(0, limit) : items;
  const hidden = limit ? items.length - visible.length : 0;
  const max = Math.max(...items.map((i) => i.count), 1);

  if (items.length === 0 || items.every((i) => i.count === 0)) {
    return <p className="py-6 text-center text-[13px] text-faint">{emptyLabel}</p>;
  }

  return (
    <>
      <dl className="space-y-2.5">
        {visible.map((item, index) => (
          <div key={item.value}>
            <div className="mb-1 flex items-baseline justify-between gap-3">
              <dt className="min-w-0 truncate text-[13px] text-muted">{item.label}</dt>
              <dd className="shrink-0 text-[13px] font-semibold tabular-nums text-foreground">
                {format(item)}
              </dd>
            </div>
            {/* Track is one step off the surface; hairline, never a border. */}
            <div className="h-2.5 w-full overflow-hidden rounded-full bg-chart-grid">
              <div
                className={cx("h-full rounded-r-full", ordinal ? rampClass(index, visible.length) : "bg-chart-fill")}
                style={{ width: `${Math.max((item.count / max) * 100, item.count > 0 ? 2 : 0)}%` }}
              />
            </div>
          </div>
        ))}
      </dl>
      {hidden > 0 ? (
        <p className="mt-3 text-[12px] text-faint">+ {hidden} more not shown</p>
      ) : null}
    </>
  );
}

/**
 * Maps a row to a step of the validated ordinal ramp. Ordered scales run
 * light (low) to dark (high) in light mode and the reverse in dark mode — the
 * tokens handle that, so position is all this needs to know.
 */
function rampClass(index: number, count: number): string {
  const steps = ["bg-chart-1", "bg-chart-2", "bg-chart-3", "bg-chart-4", "bg-chart-5"];
  if (count <= 1) return steps[4];
  const position = Math.round((index / (count - 1)) * (steps.length - 1));
  return steps[position];
}

// ---------------------------------------------------------------------------

/**
 * One stacked bar for an ordered part-to-whole (yes / maybe / no). Segments are
 * separated by a 2px gap in the surface colour rather than a stroke, and each
 * is named in the key below — colour never carries the meaning alone.
 */
export function SplitBar({ items }: { items: Slice[] }) {
  const present = items.filter((i) => i.count > 0);
  const totalCount = present.reduce((acc, i) => acc + i.count, 0);

  if (totalCount === 0) {
    return <p className="py-6 text-center text-[13px] text-faint">No answers yet</p>;
  }

  const steps = ["bg-chart-5", "bg-chart-3", "bg-chart-1"];

  return (
    <div>
      <div className="flex h-6 w-full gap-0.5 overflow-hidden rounded-full">
        {present.map((item, index) => (
          <div
            key={item.value}
            className={cx("h-full first:rounded-l-full last:rounded-r-full", steps[index % steps.length])}
            style={{ width: `${(item.count / totalCount) * 100}%` }}
          />
        ))}
      </div>
      <dl className="mt-3 space-y-1.5">
        {present.map((item, index) => (
          <div key={item.value} className="flex items-baseline gap-2">
            <span
              aria-hidden
              className={cx("mt-1 size-2.5 shrink-0 rounded-full", steps[index % steps.length])}
            />
            <dt className="min-w-0 flex-1 truncate text-[13px] text-muted">{item.label}</dt>
            <dd className="shrink-0 text-[13px] font-semibold tabular-nums text-foreground">
              {Math.round(item.share)}% · {item.count}
            </dd>
          </div>
        ))}
      </dl>
    </div>
  );
}

// ---------------------------------------------------------------------------

/**
 * Stat tile: label, big value, optional supporting line. Values use the font's
 * proportional figures — tabular digits look loose at this size.
 */
export function Stat({
  label,
  value,
  sub,
  hero = false,
}: {
  label: string;
  value: string;
  sub?: string;
  hero?: boolean;
}) {
  return (
    <Card className={cx(hero && "bg-brand-soft")}>
      <p className="text-[13px] leading-snug text-muted">{label}</p>
      <p
        className={cx(
          "mt-1 font-semibold tracking-tight text-foreground",
          hero ? "text-4xl" : "text-2xl",
        )}
      >
        {value}
      </p>
      {sub ? <p className="mt-1 text-[12px] leading-snug text-faint">{sub}</p> : null}
    </Card>
  );
}
