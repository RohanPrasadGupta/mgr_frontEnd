/** Pure helpers behind the SVG charts (kept free of React so they can be unit-tested). */

/** A "nice" axis maximum and tick step so gridlines land on round numbers. Handles all-zero data. */
export function niceScale(max: number, ticks = 4): { max: number; step: number } {
  if (!(max > 0)) return { max: ticks, step: 1 };
  const raw = max / ticks;
  const pow = 10 ** Math.floor(Math.log10(raw));
  const f = raw / pow;
  const step = (f <= 1 ? 1 : f <= 2 ? 2 : f <= 2.5 ? 2.5 : f <= 5 ? 5 : 10) * pow;
  return { max: Math.ceil(max / step) * step, step };
}

/** Axis range that includes zero and negative values (net / cumulative lines). */
export function niceRange(min: number, max: number, ticks = 4): { min: number; max: number; step: number } {
  const lo = Math.min(0, min), hi = Math.max(0, max);
  if (lo === 0 && hi === 0) return { min: 0, max: ticks, step: 1 };
  const span = hi - lo;
  const { step } = niceScale(span, ticks);
  return { min: Math.floor(lo / step) * step, max: Math.ceil(hi / step) * step, step };
}

export const ticksFor = (min: number, max: number, step: number) => { const out: number[] = []; for (let v = min; v <= max + step / 1e6; v += step) out.push(Number(v.toFixed(10))); return out; };

/** 1.2k / 3.4M style label for axis ticks (value in major units). */
export function compact(v: number): string {
  const a = Math.abs(v);
  const trim = (n: number) => String(Math.round(n * 10) / 10).replace(/\.0$/, "");
  const s = a >= 1e9 ? `${trim(a / 1e9)}B` : a >= 1e6 ? `${trim(a / 1e6)}M` : a >= 1e3 ? `${trim(a / 1e3)}k` : trim(a);
  return v < 0 ? `−${s}` : s;
}

export interface Slice { label: string; value: number; color: string; pct: number }
/** Largest `max` slices, the rest folded into "Other". Percentages sum to 100 (within rounding). Zero/negative values are dropped. */
export function toSlices(items: { label: string; value: number }[], colors: string[], max = 6): Slice[] {
  const pos = items.filter((i) => i.value > 0).sort((a, b) => b.value - a.value);
  const total = pos.reduce((s, i) => s + i.value, 0);
  if (total === 0) return [];
  const head = pos.slice(0, pos.length > max ? max - 1 : max);
  const rest = pos.slice(head.length);
  const merged = rest.length ? [...head, { label: "Other", value: rest.reduce((s, i) => s + i.value, 0) }] : head;
  return merged.map((i, idx) => ({ ...i, color: i.label === "Other" && rest.length ? "var(--muted)" : colors[idx % colors.length]!, pct: (i.value / total) * 100 }));
}

/** SVG path for a polyline through points (x,y), skipping nothing. */
export const linePath = (pts: [number, number][]) => pts.map(([x, y], i) => `${i ? "L" : "M"}${x.toFixed(1)} ${y.toFixed(1)}`).join(" ");
/**
 * A smooth line through every point (monotone cubic, Fritsch–Carlson): it curves between points but never
 * overshoots them, so a flat stretch stays flat and a line never dips past a value that wasn't there.
 */
export function smoothPath(pts: [number, number][]): string {
  const n = pts.length;
  if (n < 3) return linePath(pts);
  const f = (v: number) => v.toFixed(1);
  const dx: number[] = [], m: number[] = [];
  for (let i = 0; i < n - 1; i++) { dx.push(pts[i + 1]![0] - pts[i]![0]); m.push((pts[i + 1]![1] - pts[i]![1]) / (dx[i] || 1)); }
  const t: number[] = [m[0]!];
  for (let i = 1; i < n - 1; i++) t.push(m[i - 1]! * m[i]! <= 0 ? 0 : (3 * (dx[i - 1]! + dx[i]!)) / ((2 * dx[i]! + dx[i - 1]!) / m[i - 1]! + (dx[i]! + 2 * dx[i - 1]!) / m[i]!));
  t.push(m[n - 2]!);
  let d = `M${f(pts[0]![0])} ${f(pts[0]![1])}`;
  for (let i = 0; i < n - 1; i++) {
    const [x0, y0] = pts[i]!, [x1, y1] = pts[i + 1]!, h = dx[i]! / 3;
    d += ` C${f(x0 + h)} ${f(y0 + t[i]! * h)} ${f(x1 - h)} ${f(y1 - t[i + 1]! * h)} ${f(x1)} ${f(y1)}`;
  }
  return d;
}
export const areaPath = (pts: [number, number][], baseY: number) => pts.length ? `${smoothPath(pts)} L${pts[pts.length - 1]![0].toFixed(1)} ${baseY} L${pts[0]![0].toFixed(1)} ${baseY} Z` : "";

/** Which x-axis labels to draw so they never overlap: every n-th label that fits `minGap` pixels apart. */
export function labelStep(count: number, width: number, minGap = 36): number {
  if (count <= 1) return 1;
  const perLabel = width / count;
  return Math.max(1, Math.ceil(minGap / Math.max(perLabel, 1)));
}

/** Semicircle gauge: angle in degrees (0 = far left, 180 = far right) for a percentage clamped to 0–100. */
export const gaugeAngle = (pct: number) => (Math.max(0, Math.min(100, pct)) / 100) * 180;
