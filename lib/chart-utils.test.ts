import { describe, expect, it } from "vitest";
import { areaPath, compact, gaugeAngle, labelStep, linePath, niceRange, niceScale, ticksFor, toSlices, smoothPath } from "./chart-utils";

describe("niceScale", () => {
  it("rounds the axis up to friendly numbers", () => {
    expect(niceScale(870)).toEqual({ max: 1000, step: 250 });
    expect(niceScale(12_345)).toEqual({ max: 15_000, step: 5_000 });
    expect(niceScale(7)).toEqual({ max: 8, step: 2 });
  });
  it("never divides by zero for empty data", () => {
    expect(niceScale(0)).toEqual({ max: 4, step: 1 });
    expect(niceScale(-5)).toEqual({ max: 4, step: 1 });
  });
  it("always covers the data maximum", () => {
    for (const m of [1, 3, 99, 101, 4999, 5001, 1e6 + 1, 0.37]) expect(niceScale(m).max).toBeGreaterThanOrEqual(m);
  });
});

describe("niceRange / ticks", () => {
  it("includes zero and negatives", () => {
    const r = niceRange(-300, 900);
    expect(r.min).toBeLessThanOrEqual(-300);
    expect(r.max).toBeGreaterThanOrEqual(900);
    expect(ticksFor(r.min, r.max, r.step)).toContain(0);
  });
  it("handles all-zero and all-negative series", () => {
    expect(niceRange(0, 0)).toEqual({ min: 0, max: 4, step: 1 });
    const r = niceRange(-500, -100);
    expect(r.max).toBe(0);
    expect(r.min).toBeLessThanOrEqual(-500);
  });
  it("builds inclusive tick lists without float noise", () => {
    expect(ticksFor(0, 1, 0.25)).toEqual([0, 0.25, 0.5, 0.75, 1]);
  });
});

describe("compact", () => {
  it("shortens big numbers for axis labels", () => {
    expect(compact(950)).toBe("950");
    expect(compact(1_000)).toBe("1k");
    expect(compact(12_500)).toBe("12.5k");
    expect(compact(3_400_000)).toBe("3.4M");
    expect(compact(-2_000)).toBe("−2k");
    expect(compact(0)).toBe("0");
  });
});

describe("toSlices", () => {
  const colors = ["a", "b", "c"];
  it("sorts by size, drops non-positive values, and percentages add up to 100", () => {
    const s = toSlices([{ label: "x", value: 10 }, { label: "y", value: 30 }, { label: "z", value: 0 }, { label: "n", value: -5 }], colors);
    expect(s.map((i) => i.label)).toEqual(["y", "x"]);
    expect(s.reduce((a, i) => a + i.pct, 0)).toBeCloseTo(100);
  });
  it("folds the tail into 'Other' when there are too many categories", () => {
    const items = Array.from({ length: 9 }, (_, i) => ({ label: `c${i}`, value: 90 - i * 10 }));
    const s = toSlices(items, colors, 5);
    expect(s).toHaveLength(5);
    expect(s[4]!.label).toBe("Other");
    expect(s[4]!.value).toBe(items.slice(4).reduce((a, i) => a + i.value, 0));
    expect(s.reduce((a, i) => a + i.pct, 0)).toBeCloseTo(100);
  });
  it("returns nothing for empty or all-zero data", () => {
    expect(toSlices([], colors)).toEqual([]);
    expect(toSlices([{ label: "a", value: 0 }], colors)).toEqual([]);
  });
});

describe("paths and labels", () => {
  it("builds line and area paths", () => {
    expect(linePath([[0, 10], [5, 20]])).toBe("M0.0 10.0 L5.0 20.0");
    expect(areaPath([[0, 10], [5, 20]], 50)).toBe("M0.0 10.0 L5.0 20.0 L5.0 50 L0.0 50 Z");
    expect(areaPath([], 50)).toBe("");
  });
  it("thins x labels so they never overlap", () => {
    expect(labelStep(12, 600)).toBe(1);
    expect(labelStep(12, 240)).toBe(2);
    expect(labelStep(31, 300)).toBe(4);
    expect(labelStep(1, 10)).toBe(1);
  });
  it("clamps the gauge angle", () => {
    expect(gaugeAngle(0)).toBe(0);
    expect(gaugeAngle(50)).toBe(90);
    expect(gaugeAngle(150)).toBe(180);
    expect(gaugeAngle(-20)).toBe(0);
  });
});

describe("smoothPath", () => {
  it("curves through every point and keeps flat stretches flat", () => {
    expect(smoothPath([[0, 10], [10, 20]])).toBe("M0.0 10.0 L10.0 20.0"); // two points: a straight line
    const d = smoothPath([[0, 50], [10, 50], [20, 10], [30, 10]]);
    expect(d.startsWith("M0.0 50.0 C")).toBe(true);
    expect(d).toContain(" 10.0 50.0 C"); // passes through each point
    // a flat segment's control points stay on the line: no bump above or below a value that wasn't there
    expect(d.split(" C")[1]).toBe("3.3 50.0 6.7 50.0 10.0 50.0");
  });
});
