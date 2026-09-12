import type { ReactNode } from "react";
import { cn } from "~/lib/cn";

/**
 * Minimal, elegant SVG charts — no chart library, token colors only.
 * All charts are labelled via aria-label/role="img" (no canvas text to read).
 */

export type BarDatum = { label: string; value: number };

export type BarChartProps = {
  data: BarDatum[];
  /** viewBox height in units (default 40). */
  height?: number;
  /** Tailwind fill class for bars, e.g. "fill-brand-600". */
  barClass?: string;
  /** Optional index of the bar to emphasize. */
  highlightIndex?: number;
  ariaLabel: string;
  className?: string;
};

export function BarChart({
  data,
  height = 40,
  barClass = "fill-brand-600",
  highlightIndex,
  ariaLabel,
  className,
}: BarChartProps) {
  const n = data.length;
  const slot = 100 / n;
  const barW = Math.max(3, Math.min(10, slot * 0.55));
  const max = Math.max(...data.map((d) => d.value), 1);
  const inner = height - 4;
  const gridY = [0.25, 0.5, 0.75].map((f) => 2 + inner * f);

  return (
    <div role="img" aria-label={ariaLabel} className={className}>
      <svg viewBox={`0 0 100 ${height}`} className="h-auto w-full" preserveAspectRatio="none">
        {gridY.map((y) => (
          <line
            key={y}
            x1="0"
            x2="100"
            y1={y}
            y2={y}
            className="stroke-line opacity-50"
            strokeWidth={0.35}
          />
        ))}
        {data.map((d, i) => {
          const h = Math.max(0.75, (d.value / max) * inner);
          const x = i * slot + (slot - barW) / 2;
          const y = height - 2 - h;
          return (
            <rect
              key={d.label}
              x={x}
              y={y}
              width={barW}
              height={h}
              rx={barW / 3.2}
              className={cn(barClass, highlightIndex === i && "opacity-100", highlightIndex !== undefined && highlightIndex !== i && "opacity-30")}
            >
              <title>{`${d.label}: ${d.value} cents`}</title>
            </rect>
          );
        })}
      </svg>
    </div>
  );
}

export type DonutChartProps = {
  /** Progress value (integer minor units preferred). */
  value: number;
  max: number;
  size?: number;
  thickness?: number;
  fillClass?: string;
  trackClass?: string;
  ariaLabel: string;
  /** Rendered in the center of the ring, e.g. a Money amount. */
  children?: ReactNode;
  className?: string;
};

export function DonutChart({
  value,
  max,
  size = 132,
  thickness = 11,
  fillClass = "stroke-brand-600",
  trackClass = "stroke-line",
  ariaLabel,
  children,
  className,
}: DonutChartProps) {
  const r = (size - thickness) / 2;
  const circumference = 2 * Math.PI * r;
  const ratio = max > 0 ? Math.min(1, Math.max(0, value / max)) : 0;
  const c = size / 2;
  return (
    <div
      role="img"
      aria-label={ariaLabel}
      className={cn("relative inline-grid place-items-center", className)}
      style={{ width: size, height: size }}
    >
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} className="-rotate-90">
        <circle
          cx={c}
          cy={c}
          r={r}
          fill="none"
          strokeWidth={thickness}
          className={trackClass}
        />
        <circle
          cx={c}
          cy={c}
          r={r}
          fill="none"
          strokeWidth={thickness}
          strokeLinecap="round"
          strokeDasharray={`${circumference * ratio} ${circumference}`}
          className={fillClass}
        />
      </svg>
      <div className="absolute inset-0 grid place-items-center">{children}</div>
    </div>
  );
}

export type LineChartProps = {
  points: number[];
  /** Optional labels rendered under the x-axis (one per point). */
  labels?: string[];
  height?: number;
  strokeClass?: string;
  fillClass?: string;
  showDots?: boolean;
  ariaLabel: string;
  className?: string;
};

export function LineChart({
  points,
  labels,
  height = 40,
  strokeClass = "stroke-brand-600",
  fillClass = "fill-brand-600/12",
  showDots = false,
  ariaLabel,
  className,
}: LineChartProps) {
  const W = 100;
  const safe = points.length > 0 ? points : [0];
  const lo = Math.min(...safe);
  const hi = Math.max(...safe);
  const span = hi - lo || 1;
  const pad = span * 0.15;
  const min = lo - pad;
  const max = hi + pad;

  const xs =
    safe.length === 1
      ? [W / 2]
      : safe.map((_, i) => (W / (safe.length - 1)) * i);
  const ys = safe.map((v) => 1 + ((max - v) / (max - min)) * (height - 2));

  const line = xs
    .map((x, i) => `${i === 0 ? "M" : "L"}${x.toFixed(2)} ${ys[i].toFixed(2)}`)
    .join(" ");
  const area = `${line} L${xs[xs.length - 1].toFixed(2)} ${height} L${xs[0].toFixed(2)} ${height} Z`;

  return (
    <div className={className}>
      <svg
        role="img"
        aria-label={ariaLabel}
        viewBox={`0 0 ${W} ${height}`}
        preserveAspectRatio="none"
        className="h-auto w-full overflow-visible"
      >
        <path d={area} className={fillClass} />
        <path
          d={line}
          fill="none"
          strokeWidth={1.5}
          strokeLinecap="round"
          strokeLinejoin="round"
          vectorEffect="non-scaling-stroke"
          className={strokeClass}
        />
        {showDots
          ? safe.map((_, i) => (
              <circle
                key={i}
                cx={xs[i]}
                cy={ys[i]}
                r={1.1}
                vectorEffect="non-scaling-stroke"
                strokeWidth={0.9}
                stroke="var(--sw-surface-raised)"
                className={strokeClass}
              />
            ))
          : null}
      </svg>
      {labels ? (
        <div className="mt-1.5 flex justify-between text-caption text-ink-faint">
          {labels.map((l, i) => (
            <span key={`${l}-${i}`}>{l}</span>
          ))}
        </div>
      ) : null}
    </div>
  );
}