import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { toSlices } from "@/lib/chart-utils";
import { DailyBars, DonutChart, Gauge, GroupedBarChart, LineChart } from "./charts";

const fmt = (v: number) => `฿${v}`;
const axis = (v: number) => String(v);
const rects = (el: Element, cls: string) => [...el.querySelectorAll(`rect.${cls}`)];
const h = (r: Element) => Number(r.getAttribute("height"));

describe("GroupedBarChart", () => {
  const props = { labels: ["Jan", "Feb", "Mar"], format: fmt, axis, ariaLabel: "Income and expense" };
  const series = [{ name: "Income", values: [100, 50, 0], className: "fill-income" }, { name: "Expense", values: [20, 80, 10], className: "fill-expense" }];

  it("draws one bar per value with heights proportional to the data", () => {
    const { container } = render(<GroupedBarChart {...props} series={series} />);
    const income = rects(container, "fill-income");
    expect(income).toHaveLength(3);
    expect(h(income[0]!)).toBeGreaterThan(h(income[1]!));
    expect(h(income[1]!) / h(income[0]!)).toBeCloseTo(0.5, 1);
    expect(h(income[2]!)).toBe(0);
    expect(screen.getByRole("img", { name: "Income and expense" })).toBeInTheDocument();
  });

  it("shows the exact values for a bar group on hover, and resets on leave", () => {
    const { container } = render(<GroupedBarChart {...props} series={series} />);
    expect(screen.getByRole("status")).toHaveTextContent("Tap or hover");
    fireEvent.pointerEnter(container.querySelector('rect[aria-label^="Feb"]')!);
    expect(screen.getByRole("status")).toHaveTextContent("Feb");
    expect(screen.getByRole("status")).toHaveTextContent("Income: ฿50");
    expect(screen.getByRole("status")).toHaveTextContent("Expense: ฿80");
    fireEvent.pointerLeave(screen.getByRole("img"));
    expect(screen.getByRole("status")).toHaveTextContent("Tap or hover");
  });

  it("is keyboard reachable: each group is focusable with a full description", () => {
    const { container } = render(<GroupedBarChart {...props} series={series} />);
    const first = container.querySelector('rect[aria-label^="Jan"]') as SVGElement;
    expect(first.getAttribute("tabindex")).toBe("0");
    expect(first.getAttribute("aria-label")).toBe("Jan: Income ฿100, Expense ฿20");
    fireEvent.focus(first);
    expect(screen.getByRole("status")).toHaveTextContent("Jan");
  });

  it("shows an empty state instead of a blank axis when everything is zero", () => {
    render(<GroupedBarChart {...props} series={series.map((s) => ({ ...s, values: [0, 0, 0] }))} />);
    expect(screen.getByText("No data for this period.")).toBeInTheDocument();
    expect(screen.queryByRole("img")).not.toBeInTheDocument();
  });
});

describe("LineChart", () => {
  const base = { labels: ["A", "B", "C"], format: fmt, axis, ariaLabel: "Net" };
  it("draws a path per series and a distinct zero line when values go negative", () => {
    const { container } = render(<LineChart {...base} series={[{ name: "Net", values: [10, -20, 30], className: "stroke-primary", stroke: "area" }, { name: "Total", values: [10, -10, 20], className: "stroke-warn" }]} />);
    expect(container.querySelectorAll("path.stroke-primary, path.stroke-warn")).toHaveLength(2);
    expect(container.querySelectorAll("path.fill-primary")).toHaveLength(1); // area under Net only
    expect(container.querySelector("line.stroke-muted")).toBeTruthy();
    expect([...container.querySelectorAll("text")].map((t) => t.textContent)).toContain("0");
  });
  it("copes with a single data point and with all zeros", () => {
    const one = render(<LineChart {...base} labels={["A"]} series={[{ name: "Net", values: [5], className: "stroke-primary" }]} />);
    expect(one.container.querySelector("svg")).toBeTruthy();
    one.unmount();
    render(<LineChart {...base} series={[{ name: "Net", values: [0, 0, 0], className: "stroke-primary" }]} />);
    expect(screen.getByText("No data for this period.")).toBeInTheDocument();
  });
  it("reports values on hover", () => {
    const { container } = render(<LineChart {...base} series={[{ name: "Net", values: [10, -20, 30], className: "stroke-primary" }]} />);
    fireEvent.pointerEnter(container.querySelector('rect[aria-label^="B"]')!);
    expect(screen.getByRole("status")).toHaveTextContent("Net: ฿-20");
  });
});

describe("DailyBars", () => {
  const days = Array.from({ length: 5 }, (_, i) => ({ date: `2025-08-0${i + 1}`, value: [0, 100, 0, 300, 100][i]! }));
  it("highlights today, draws the average line, and reports the average by default", () => {
    const { container } = render(<DailyBars days={days} today="2025-08-04" format={fmt} axis={axis} ariaLabel="Daily" />);
    expect(rects(container, "fill-primary")).toHaveLength(1);
    expect(rects(container, "fill-expense")).toHaveLength(4);
    expect(container.querySelector("line.stroke-warn")).toBeTruthy();
    expect(screen.getByRole("status")).toHaveTextContent("Average per day: ฿100");
  });
  it("shows a specific day on hover", () => {
    const { container } = render(<DailyBars days={days} format={fmt} axis={axis} ariaLabel="Daily" />);
    fireEvent.pointerEnter(container.querySelector('rect[aria-label^="2025-08-04"]')!);
    expect(screen.getByRole("status")).toHaveTextContent("2025-08-04");
    expect(screen.getByRole("status")).toHaveTextContent("฿300");
  });
  it("has a specific empty message", () => {
    render(<DailyBars days={days.map((d) => ({ ...d, value: 0 }))} format={fmt} axis={axis} ariaLabel="Daily" />);
    expect(screen.getByText("No spending in this period.")).toBeInTheDocument();
  });
});

describe("DonutChart", () => {
  const slices = toSlices([{ label: "Food", value: 60 }, { label: "Rent", value: 30 }, { label: "Fun", value: 10 }], ["red", "green", "blue"]);
  const props = { slices, centerLabel: "Expenses", centerValue: "฿100", format: fmt, ariaLabel: "By category" };
  it("draws one arc per slice whose dash lengths are the percentages, and lists them", () => {
    const { container } = render(<DonutChart {...props} />);
    const arcs = [...container.querySelectorAll("circle[stroke-dasharray]")];
    expect(arcs).toHaveLength(3);
    expect(parseFloat(arcs[0]!.getAttribute("stroke-dasharray")!)).toBeCloseTo(60 - 0.6, 1);
    expect(screen.getAllByRole("listitem").map((l) => l.textContent)).toEqual(["Food60%", "Rent30%", "Fun10%"]);
    expect(screen.getByText("Expenses")).toBeInTheDocument();
    expect(screen.getByText("฿100")).toBeInTheDocument();
  });
  it("shows the hovered slice in the centre", () => {
    render(<DonutChart {...props} />);
    fireEvent.pointerEnter(screen.getByRole("button", { name: /Rent/ }));
    expect(screen.getByText("฿30")).toBeInTheDocument();
    expect(screen.getByText("30.0%")).toBeInTheDocument();
  });
  it("renders a single-slice donut without a gap, and an empty state for no data", () => {
    const one = toSlices([{ label: "Only", value: 5 }], ["red"]);
    const { container, unmount } = render(<DonutChart {...props} slices={one} />);
    expect(parseFloat(container.querySelector("circle[stroke-dasharray]")!.getAttribute("stroke-dasharray")!)).toBeCloseTo(100, 1);
    unmount();
    render(<DonutChart {...props} slices={[]} />);
    expect(screen.getByText("No data for this period.")).toBeInTheDocument();
  });
});

describe("Gauge", () => {
  it("describes the savings rate for screen readers and draws the value arc", () => {
    const { container } = render(<Gauge pct={35.4} band="healthy" label="Healthy savings" />);
    expect(screen.getByRole("img", { name: "Savings rate 35.4%, Healthy savings" })).toBeInTheDocument();
    expect(container.querySelectorAll("path")).toHaveLength(2);
    expect(screen.getByText("35%")).toBeInTheDocument();
  });
  it("shows a dash and no value arc without income, and clamps absurd values", () => {
    const { container, unmount } = render(<Gauge pct={null} band="none" label="No income" />);
    expect(screen.getByRole("img", { name: "Savings rate: no income" })).toBeInTheDocument();
    expect(container.querySelectorAll("path")).toHaveLength(1);
    unmount();
    const hi = render(<Gauge pct={999} band="healthy" label="x" />);
    expect(hi.container.querySelectorAll("path")).toHaveLength(2);
    hi.unmount();
  });
  it("turns the whole dial red when spending exceeds income, instead of looking empty", () => {
    const neg = render(<Gauge pct={-85} band="overspending" label="Spending more than earned" />);
    expect(screen.getByRole("img", { name: "Savings rate -85.0%, Spending more than earned" })).toBeInTheDocument();
    const arc = neg.getByTestId("gauge-overspent");
    expect(arc.getAttribute("style")).toContain("var(--expense)");
    expect(neg.container.querySelectorAll("path")).toHaveLength(2);
    expect(screen.getByText("-85%").getAttribute("class")).toContain("fill-expense");
  });
});
