"use client";
import { useEffect, useRef, useState, type ReactNode } from "react";
import { areaPath, compact, gaugeAngle, labelStep, linePath, niceRange, niceScale, ticksFor, type Slice } from "@/lib/chart-utils";
import { cx } from "./ui";

/**
 * Hand-rolled SVG charts. They measure their own container and draw at real pixel size, so axis text stays
 * readable on a 320px phone and the plot uses the full width on a 4K monitor (a fixed viewBox would shrink text).
 */
export function useChartWidth(fallback = 560): [React.RefObject<HTMLDivElement | null>, number] {
  const ref = useRef<HTMLDivElement | null>(null);
  const [w, setW] = useState(fallback);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const read = () => setW(Math.max(160, Math.floor(el.getBoundingClientRect().width)));
    read();
    if (typeof ResizeObserver === "undefined") return;
    const ro = new ResizeObserver(read);
    ro.observe(el);
    return () => ro.disconnect();
  }, []);
  return [ref, w];
}

function Caption({ children }: { children: ReactNode }) {
  return <div role="status" aria-live="polite" className="mb-2 min-h-5 text-xs text-muted tabular-nums">{children}</div>;
}
export const NoData = ({ children = "No data for this period." }: { children?: ReactNode }) => (
  <div className="grid h-40 place-items-center rounded-xl border border-dashed border-border text-sm text-muted">{children}</div>
);

const M = { left: 46, right: 8, top: 8, bottom: 24 };
const Y_LABEL = "fill-muted text-[11px]";

interface Series { name: string; values: number[]; className: string; stroke?: string }
interface XYProps {
  labels: string[];
  series: Series[];
  /** full-precision label for the caption/tooltip */
  format: (v: number) => string;
  /** short label for the y axis */
  axis: (v: number) => string;
  ariaLabel: string;
  height?: number;
  minLabelGap?: number;
}

export function GroupedBarChart({ labels, series, format, axis, ariaLabel, height = 220, minLabelGap = 30 }: XYProps) {
  const [ref, w] = useChartWidth();
  const [active, setActive] = useState<number | null>(null);
  const all = series.flatMap((s) => s.values);
  if (all.every((v) => v === 0)) return <NoData />;
  const { max, step } = niceScale(Math.max(...all));
  const plotW = w - M.left - M.right, plotH = height - M.top - M.bottom;
  const group = plotW / labels.length;
  const bw = Math.max(3, Math.min(18, (group * 0.7) / series.length));
  const y = (v: number) => M.top + plotH - (v / max) * plotH;
  const every = labelStep(labels.length, plotW, minLabelGap);
  return (
    <div ref={ref}>
      <Caption>{active !== null ? <><b className="text-fg">{labels[active]}</b>{series.map((s) => <span key={s.name} className="ml-3">{s.name}: {format(s.values[active]!)}</span>)}</> : "Tap or hover a bar for details"}</Caption>
      <svg width={w} height={height} role="img" aria-label={ariaLabel} onPointerLeave={() => setActive(null)}>
        {ticksFor(0, max, step).map((t) => (
          <g key={t}><line x1={M.left} x2={w - M.right} y1={y(t)} y2={y(t)} className="stroke-border" strokeWidth={1} /><text x={M.left - 6} y={y(t) + 4} textAnchor="end" className={Y_LABEL}>{axis(t)}</text></g>
        ))}
        {labels.map((l, i) => {
          const cx0 = M.left + group * i + group / 2;
          return (
            <g key={i}>
              {series.map((s, j) => {
                const h = Math.max(0, (s.values[i]! / max) * plotH);
                const x = cx0 - (bw * series.length) / 2 + j * bw;
                return <rect key={`${s.name}:${s.values[i]}`} x={x} y={M.top + plotH - h} width={bw - 1} height={h} rx={2} style={{ animationDelay: `${Math.min(i, 24) * 18}ms` }} className={cx("chart-bar", s.className, active !== null && active !== i && "opacity-40")} />;
              })}
              {i % every === 0 && <text x={cx0} y={height - 6} textAnchor="middle" className={Y_LABEL}>{l}</text>}
              <rect x={M.left + group * i} y={M.top} width={group} height={plotH} fill="transparent" tabIndex={0} aria-label={`${l}: ${series.map((s) => `${s.name} ${format(s.values[i]!)}`).join(", ")}`}
                onPointerEnter={() => setActive(i)} onPointerDown={() => setActive(i)} onFocus={() => setActive(i)} onBlur={() => setActive(null)} className="outline-none focus-visible:stroke-primary" />
            </g>
          );
        })}
      </svg>
      <Legend items={series.map((s) => ({ label: s.name, className: s.className.replace("fill-", "bg-") }))} />
    </div>
  );
}

export function LineChart({ labels, series, format, axis, ariaLabel, height = 220, minLabelGap = 30 }: XYProps) {
  const [ref, w] = useChartWidth();
  const [active, setActive] = useState<number | null>(null);
  const all = series.flatMap((s) => s.values);
  if (all.every((v) => v === 0)) return <NoData />;
  const r = niceRange(Math.min(...all), Math.max(...all));
  const plotW = w - M.left - M.right, plotH = height - M.top - M.bottom;
  const x = (i: number) => M.left + (labels.length === 1 ? plotW / 2 : (plotW * i) / (labels.length - 1));
  const y = (v: number) => M.top + plotH - ((v - r.min) / (r.max - r.min)) * plotH;
  const every = labelStep(labels.length, plotW, minLabelGap);
  const step = labels.length === 1 ? plotW : plotW / (labels.length - 1);
  return (
    <div ref={ref}>
      <Caption>{active !== null ? <><b className="text-fg">{labels[active]}</b>{series.map((s) => <span key={s.name} className="ml-3">{s.name}: {format(s.values[active]!)}</span>)}</> : "Tap or hover the chart for details"}</Caption>
      <svg width={w} height={height} role="img" aria-label={ariaLabel} onPointerLeave={() => setActive(null)}>
        {ticksFor(r.min, r.max, r.step).map((t) => (
          <g key={t}><line x1={M.left} x2={w - M.right} y1={y(t)} y2={y(t)} className={t === 0 ? "stroke-muted" : "stroke-border"} strokeWidth={1} strokeDasharray={t === 0 ? "0" : "3 3"} /><text x={M.left - 6} y={y(t) + 4} textAnchor="end" className={Y_LABEL}>{axis(t)}</text></g>
        ))}
        {series.map((s) => {
          const pts = s.values.map((v, i) => [x(i), y(v)] as [number, number]);
          // keyed by the values so a new month/year redraws the line instead of snapping
          return <g key={`${s.name}:${s.values.join(",")}`}>{s.stroke === "area" && <path d={areaPath(pts, y(0))} className={cx("chart-area", s.className.replace("stroke-", "fill-"), "opacity-15")} />}<path d={linePath(pts)} pathLength={1} fill="none" strokeWidth={2} strokeLinejoin="round" strokeLinecap="round" className={cx("chart-line", s.className)} /></g>;
        })}
        {active !== null && <line x1={x(active)} x2={x(active)} y1={M.top} y2={M.top + plotH} className="stroke-muted" strokeDasharray="3 3" />}
        {active !== null && series.map((s) => <circle key={s.name} cx={x(active)} cy={y(s.values[active]!)} r={4} className={cx(s.className.replace("stroke-", "fill-"), "stroke-card")} strokeWidth={2} />)}
        {labels.map((l, i) => (
          <g key={i}>
            {i % every === 0 && <text x={x(i)} y={height - 6} textAnchor="middle" className={Y_LABEL}>{l}</text>}
            <rect x={x(i) - step / 2} y={M.top} width={step} height={plotH} fill="transparent" tabIndex={0} aria-label={`${l}: ${series.map((s) => `${s.name} ${format(s.values[i]!)}`).join(", ")}`}
              onPointerEnter={() => setActive(i)} onPointerDown={() => setActive(i)} onFocus={() => setActive(i)} onBlur={() => setActive(null)} className="outline-none" />
          </g>
        ))}
      </svg>
      <Legend items={series.map((s) => ({ label: s.name, className: s.className.replace("stroke-", "bg-") }))} />
    </div>
  );
}

export interface Day { date: string; value: number }
/** One bar per day with the period average as a dashed line; today is highlighted. */
export function DailyBars({ days, today, format, axis, ariaLabel, height = 200 }: { days: Day[]; today?: string; format: (v: number) => string; axis: (v: number) => string; ariaLabel: string; height?: number }) {
  const [ref, w] = useChartWidth();
  const [active, setActive] = useState<number | null>(null);
  if (days.every((d) => d.value === 0)) return <NoData>No spending in this period.</NoData>;
  const { max, step } = niceScale(Math.max(...days.map((d) => d.value)));
  const plotW = w - M.left - M.right, plotH = height - M.top - M.bottom;
  const slot = plotW / days.length;
  const bw = Math.max(2, Math.min(16, slot * 0.7));
  const y = (v: number) => M.top + plotH - (v / max) * plotH;
  const avg = days.reduce((s, d) => s + d.value, 0) / days.length;
  const every = labelStep(days.length, plotW, 28);
  return (
    <div ref={ref}>
      <Caption>{active !== null ? <><b className="text-fg">{days[active]!.date}</b><span className="ml-3">{format(days[active]!.value)}</span></> : `Average per day: ${format(avg)}`}</Caption>
      <svg width={w} height={height} role="img" aria-label={ariaLabel} onPointerLeave={() => setActive(null)}>
        {ticksFor(0, max, step).map((t) => (<g key={t}><line x1={M.left} x2={w - M.right} y1={y(t)} y2={y(t)} className="stroke-border" /><text x={M.left - 6} y={y(t) + 4} textAnchor="end" className={Y_LABEL}>{axis(t)}</text></g>))}
        {days.map((d, i) => {
          const cx0 = M.left + slot * i + slot / 2;
          const h = (d.value / max) * plotH;
          return (
            <g key={d.date}>
              <rect x={cx0 - bw / 2} y={M.top + plotH - h} width={bw} height={h} rx={Math.min(2, bw / 2)} style={{ animationDelay: `${Math.min(i, 31) * 12}ms` }} className={cx("chart-bar", d.date === today ? "fill-primary" : "fill-expense", active !== null && active !== i && "opacity-40")} />
              {i % every === 0 && <text x={cx0} y={height - 6} textAnchor="middle" className={Y_LABEL}>{Number(d.date.slice(8))}</text>}
              <rect x={M.left + slot * i} y={M.top} width={slot} height={plotH} fill="transparent" tabIndex={0} aria-label={`${d.date}: ${format(d.value)}`} onPointerEnter={() => setActive(i)} onPointerDown={() => setActive(i)} onFocus={() => setActive(i)} onBlur={() => setActive(null)} className="outline-none" />
            </g>
          );
        })}
        <line x1={M.left} x2={w - M.right} y1={y(avg)} y2={y(avg)} className="stroke-warn" strokeDasharray="5 4" strokeWidth={1.5} />
      </svg>
      <Legend items={[{ label: "Spent per day", className: "bg-expense" }, { label: "Average", className: "bg-warn" }]} />
    </div>
  );
}

export function DonutChart({ slices, centerLabel, centerValue, format, ariaLabel }: { slices: Slice[]; centerLabel: string; centerValue: string; format: (v: number) => string; ariaLabel: string }) {
  const [active, setActive] = useState<number | null>(null);
  if (slices.length === 0) return <NoData />;
  const R = 15.9155; // circumference = 100, so dash lengths are literally percentages
  // each slice starts where the previous ones end (25 = 12 o'clock on the 100-unit circle)
  const offsets = slices.map((_, i) => 25 - slices.slice(0, i).reduce((t, x) => t + x.pct, 0));
  const a = active !== null ? slices[active]! : null;
  return (
    // Layout follows the card's own width (container query), not the viewport: a narrow column stacks the legend under the ring.
    <div className="@container w-full" onPointerLeave={() => setActive(null)}>
    <div className="flex flex-col items-center gap-4 @sm:flex-row @sm:items-center">
      <div className="relative size-40 shrink-0">
        <svg viewBox="0 0 42 42" className="size-full -rotate-0" role="img" aria-label={ariaLabel}>
          <circle cx="21" cy="21" r={R} fill="none" className="stroke-border" strokeWidth={5} />
          {slices.map((s, i) => {
            const dash = Math.max(0.0001, s.pct - (slices.length > 1 ? 0.6 : 0)); // small gap between slices
            const offset = offsets[i];
            return <circle key={`${s.label}:${s.pct.toFixed(2)}`} cx="21" cy="21" r={R} fill="none" style={{ stroke: s.color }} strokeWidth={active === i ? 6.5 : 5} strokeDasharray={`${dash} ${100 - dash}`} strokeDashoffset={offset} onPointerEnter={() => setActive(i)} onPointerDown={() => setActive(i)} className="chart-slice" opacity={active !== null && active !== i ? 0.45 : 1}><title>{`${s.label}: ${format(s.value)} (${s.pct.toFixed(1)}%)`}</title></circle>;
          })}
        </svg>
        <div className="pointer-events-none absolute inset-0 grid place-items-center text-center">
          <div className="max-w-[6.5rem]"><div className="truncate text-[11px] text-muted">{a ? a.label : centerLabel}</div><div className="break-words text-xs font-semibold leading-tight tabular-nums">{a ? format(a.value) : centerValue}</div>{a && <div className="text-xs text-muted">{a.pct.toFixed(1)}%</div>}</div>
        </div>
      </div>
      <ul className="w-full min-w-0 flex-1 space-y-1.5">
        {slices.map((s, i) => (
          <li key={s.label}>
            <button type="button" onPointerEnter={() => setActive(i)} onFocus={() => setActive(i)} onBlur={() => setActive(null)} className={cx("flex w-full items-center gap-2 rounded-md px-1 py-0.5 text-left text-sm", active === i && "bg-border/50")}>
              <span className="size-2.5 shrink-0 rounded-full" style={{ background: s.color }} />
              <span className="min-w-0 flex-1 truncate">{s.label}</span>
              <span className="shrink-0 tabular-nums text-muted">{s.pct.toFixed(0)}%</span>
            </button>
          </li>
        ))}
      </ul>
    </div>
    </div>
  );
}

/** Semicircle gauge for the savings rate; the tick marks the 20% "healthy" threshold. */
export function Gauge({ pct, label, band }: { pct: number | null; label: string; band: "healthy" | "low" | "overspending" | "none" }) {
  const color = band === "healthy" ? "var(--income)" : band === "low" ? "var(--warn)" : band === "overspending" ? "var(--expense)" : "var(--muted)";
  const R = 40, C = 50, angle = gaugeAngle(pct ?? 0);
  const pt = (deg: number, r = R): [number, number] => { const rad = Math.PI - (deg * Math.PI) / 180; return [C + r * Math.cos(rad), C - r * Math.sin(rad)]; };
  const [sx, sy] = pt(0), [ex, ey] = pt(180), [vx, vy] = pt(angle);
  const [t1x, t1y] = pt(gaugeAngle(20), R + 6), [t2x, t2y] = pt(gaugeAngle(20), R - 6);
  return (
    <div className="mx-auto w-full max-w-[16rem]">
      <svg viewBox="0 0 100 58" className="w-full" role="img" aria-label={pct === null ? "Savings rate: no income" : `Savings rate ${pct.toFixed(1)}%, ${label}`}>
        <path d={`M${sx} ${sy} A${R} ${R} 0 0 1 ${ex} ${ey}`} fill="none" className="stroke-border" strokeWidth={9} strokeLinecap="round" />
        {pct !== null && pct > 0 && <path key={angle} d={`M${sx} ${sy} A${R} ${R} 0 ${angle > 180 ? 1 : 0} 1 ${vx} ${vy}`} pathLength={1} className="chart-line" fill="none" style={{ stroke: color }} strokeWidth={9} strokeLinecap="round" />}
        {/* Below zero there is no point on a 0–100 dial: the whole track turns red so overspending is impossible to miss. */}
        {pct !== null && pct < 0 && <path key={`neg:${pct.toFixed(1)}`} data-testid="gauge-overspent" d={`M${sx} ${sy} A${R} ${R} 0 0 1 ${ex} ${ey}`} pathLength={1} className="chart-line" fill="none" style={{ stroke: color, opacity: 0.45 }} strokeWidth={9} strokeLinecap="round" />}
        <line x1={t1x} y1={t1y} x2={t2x} y2={t2y} className="stroke-muted" strokeWidth={1.2} />
        <text x={C} y={C - 4} textAnchor="middle" className={cx("text-[14px] font-semibold", pct !== null && pct < 0 ? "fill-expense" : "fill-fg")}>{pct === null ? "—" : `${pct.toFixed(0)}%`}</text>
        <text x={C} y={C + 6} textAnchor="middle" className="fill-muted text-[5px]">{label}</text>
      </svg>
      <div className="flex justify-between px-3 text-[10px] text-muted"><span>0%</span><span>20% healthy</span><span>100%</span></div>
    </div>
  );
}

function Legend({ items }: { items: { label: string; className: string }[] }) {
  return <ul className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted">{items.map((i) => <li key={i.label} className="flex items-center gap-1.5"><span className={cx("size-2.5 rounded-sm", i.className)} />{i.label}</li>)}</ul>;
}

export { compact };
