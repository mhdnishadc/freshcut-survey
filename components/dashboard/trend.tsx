"use client";

import { useMemo, useRef, useState } from "react";

type Point = { date: string; count: number };

const W = 600;
const H = 150;
const PAD_Y = 12;

/**
 * Interviews per day. A line chart hides the values between ticks, so unlike
 * the bar lists this one carries a real crosshair + tooltip.
 *
 * Strokes use `vector-effect="non-scaling-stroke"` so the 2px line stays 2px
 * at any container width, and the axis labels are HTML outside the SVG so they
 * never scale with the viewBox.
 */
export function TrendChart({ points }: { points: Point[] }) {
  const svgRef = useRef<SVGSVGElement>(null);
  const [active, setActive] = useState<number | null>(null);

  const max = Math.max(...points.map((p) => p.count), 1);

  const coords = useMemo(
    () =>
      points.map((point, index) => ({
        ...point,
        x: points.length === 1 ? W / 2 : (index / (points.length - 1)) * W,
        y: H - PAD_Y - (point.count / max) * (H - PAD_Y * 2),
      })),
    [points, max],
  );

  if (points.length === 0) {
    return <p className="py-6 text-center text-[13px] text-faint">No interviews yet</p>;
  }

  const line = coords.map((c, i) => `${i === 0 ? "M" : "L"}${c.x} ${c.y}`).join(" ");
  const area = `${line} L${coords[coords.length - 1].x} ${H} L${coords[0].x} ${H} Z`;
  const last = coords[coords.length - 1];
  const hovered = active !== null ? coords[active] : null;

  function onMove(event: React.PointerEvent<SVGSVGElement>) {
    const rect = svgRef.current?.getBoundingClientRect();
    if (!rect || coords.length === 0) return;
    const ratio = (event.clientX - rect.left) / rect.width;
    const index = Math.round(ratio * (coords.length - 1));
    setActive(Math.min(Math.max(index, 0), coords.length - 1));
  }

  return (
    <div className="relative">
      <svg
        ref={svgRef}
        viewBox={`0 0 ${W} ${H}`}
        preserveAspectRatio="none"
        className="h-[150px] w-full touch-none"
        role="img"
        aria-label={`Interviews per day, ${points.length} days, peak ${max} in a day`}
        onPointerMove={onMove}
        onPointerLeave={() => setActive(null)}
      >
        {/* Hairline gridlines, solid and recessive. */}
        {[0, 0.5, 1].map((t) => (
          <line
            key={t}
            x1={0}
            x2={W}
            y1={PAD_Y + t * (H - PAD_Y * 2)}
            y2={PAD_Y + t * (H - PAD_Y * 2)}
            className="stroke-chart-grid"
            strokeWidth={1}
            vectorEffect="non-scaling-stroke"
          />
        ))}

        <path d={area} className="fill-chart-fill opacity-10" />
        <path
          d={line}
          className="stroke-chart-fill"
          strokeWidth={2}
          fill="none"
          strokeLinecap="round"
          strokeLinejoin="round"
          vectorEffect="non-scaling-stroke"
        />

        {hovered ? (
          <line
            x1={hovered.x}
            x2={hovered.x}
            y1={0}
            y2={H}
            className="stroke-chart-axis"
            strokeWidth={1}
            vectorEffect="non-scaling-stroke"
          />
        ) : null}

        {/* End marker carries a 2px surface ring so it stays legible on the line. */}
        <circle
          cx={last.x}
          cy={last.y}
          r={5}
          className="fill-chart-fill stroke-surface"
          strokeWidth={2}
          vectorEffect="non-scaling-stroke"
        />
        {hovered && hovered !== last ? (
          <circle
            cx={hovered.x}
            cy={hovered.y}
            r={5}
            className="fill-chart-fill stroke-surface"
            strokeWidth={2}
            vectorEffect="non-scaling-stroke"
          />
        ) : null}
      </svg>

      {hovered ? (
        <div
          className="pointer-events-none absolute -top-1 z-10 -translate-x-1/2 rounded-lg border border-border bg-surface px-2.5 py-1.5 text-[12px] shadow-sm"
          style={{ left: `${(hovered.x / W) * 100}%` }}
        >
          <span className="font-semibold tabular-nums">{hovered.count}</span>
          <span className="text-muted">
            {" "}
            on{" "}
            {new Date(hovered.date).toLocaleDateString("en-IN", {
              day: "numeric",
              month: "short",
            })}
          </span>
        </div>
      ) : null}

      <div className="mt-1.5 flex justify-between text-[12px] text-faint">
        <span>{formatDay(points[0].date)}</span>
        <span>{formatDay(points[points.length - 1].date)}</span>
      </div>
    </div>
  );
}

function formatDay(iso: string): string {
  return new Date(iso).toLocaleDateString("en-IN", { day: "numeric", month: "short" });
}
