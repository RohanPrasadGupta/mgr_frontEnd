"use client";
import { useState } from "react";
import { usePortfolioHistory } from "@/lib/api/hooks";
import { compact } from "@/lib/chart-utils";
import { formatMoney, toMajor } from "@/lib/money";
import { LineChart } from "./charts";
import { Widget } from "./widget";
import { Segmented } from "./ui";

const RANGES = [{ value: "6", label: "6M" }, { value: "12", label: "1Y" }, { value: "36", label: "3Y" }, { value: "60", label: "5Y" }] as const;
type Range = (typeof RANGES)[number]["value"];
const MONTH = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

/** "Nov 26" for month ends (or "Jan" when the range is a single year) — compact enough for 60 points. */
const label = (date: string, withYear: boolean) => { const [y, m] = date.split("-"); return withYear ? `${MONTH[Number(m) - 1]} ${y!.slice(2)}` : MONTH[Number(m) - 1]!; };

/** Portfolio value vs money still invested, month by month, from the user's own trades and the prices they entered. */
export function PortfolioChart() {
  const [range, setRange] = useState<Range>("12");
  const history = usePortfolioHistory(Number(range));
  const h = history.data;
  const cur = h?.baseCurrency ?? "THB";
  const pts = h?.points ?? [];
  const withYear = pts.length > 0 && pts[0]!.date.slice(0, 4) !== pts[pts.length - 1]!.date.slice(0, 4);
  // Growth in value is mostly new money, so the headline is the gain over what is still invested (today's point).
  const last = pts[pts.length - 1];
  const gain = last ? last.valueMinor - last.investedMinor : 0;
  const gainPct = last && last.investedMinor > 0 ? (gain / last.investedMinor) * 100 : null;
  return (
    <Widget title="Portfolio value" state={history} className="min-w-0"
      action={<Segmented value={range} onChange={setRange} options={RANGES.map((r) => ({ value: r.value, label: r.label }))} />}>
      {pts.length < 2 ? (
        <p className="py-8 text-center text-sm text-muted">{pts.length === 0 ? "Record a trade or contribution to start the history." : "The chart appears once there are two months of history."}</p>
      ) : (
        <>
          {gainPct !== null && <p className="mb-1 text-xs text-muted">Now <b className={gain >= 0 ? "text-income" : "text-expense"}>{formatMoney(gain, cur, { sign: true })} ({gain >= 0 ? "+" : ""}{gainPct.toFixed(1)}%)</b> {gain >= 0 ? "above" : "below"} what you&apos;ve put in</p>}
          <LineChart labels={pts.map((p) => label(p.date, withYear))} ariaLabel={`Portfolio value and invested amount, last ${pts.length} months`}
            format={(v) => formatMoney(v, cur)} axis={(v) => compact(toMajor(v, cur))}
            series={[{ name: "Value", values: pts.map((p) => p.valueMinor), className: "stroke-primary", stroke: "area" }, { name: "Invested", values: pts.map((p) => p.investedMinor), className: "stroke-muted" }]} />
          <p className="mt-2 text-xs text-muted">From your trades and the prices you enter (no market data). Holdings without a price count at cost.{h!.excluded.length > 0 && ` Not included: ${h!.excluded.map((e) => e.symbol).join(", ")} (no exchange rate).`}</p>
        </>
      )}
    </Widget>
  );
}
