"use client";
import { useState } from "react";
import { useMe, usePortfolioHistory } from "@/lib/api/hooks";
import { compact } from "@/lib/chart-utils";
import { formatMoney, toMajor } from "@/lib/money";
import { LineChart } from "./charts";
import { Widget } from "./widget";
import { Segmented, Select, cx } from "./ui";

const RANGES = [{ value: "6", label: "6M" }, { value: "12", label: "1Y" }, { value: "36", label: "3Y" }, { value: "60", label: "5Y" }, { value: "all", label: "All" }] as const;
type Range = (typeof RANGES)[number]["value"];
const MONTH = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

/** "Nov 26" for month ends (or "Jan" when the range is a single year) — compact enough for 60 points. */
const label = (date: string, withYear: boolean) => { const [y, m] = date.split("-"); return withYear ? `${MONTH[Number(m) - 1]} ${y!.slice(2)}` : MONTH[Number(m) - 1]!; };

/** Portfolio value vs money still invested, month by month, from the user's own trades and the prices they entered. */
export function PortfolioChart() {
  const [range, setRange] = useState<Range>("12");
  const { data: me } = useMe();
  const [picked, setPicked] = useState<string | null>(null); // null = the base currency
  const base = me?.baseCurrency;
  const shown = picked && picked !== base ? picked : undefined;
  const history = usePortfolioHistory(range === "all" ? "all" : Number(range), shown);
  const h = history.data;
  const cur = h?.currency ?? h?.baseCurrency ?? "THB";
  const options = base ? [base, ...(me?.currencies ?? []).filter((c) => c !== base)] : [];
  const pts = h?.points ?? [];
  const withYear = pts.length > 0 && pts[0]!.date.slice(0, 4) !== pts[pts.length - 1]!.date.slice(0, 4);
  // Growth in value is mostly new money, so the headline is the gain over what is still invested (today's point).
  const last = pts[pts.length - 1];
  const gain = last ? last.valueMinor - last.investedMinor : 0;
  const gainPct = last && last.investedMinor > 0 ? (gain / last.investedMinor) * 100 : null;
  return (
    <Widget title="Portfolio value" state={history} className="min-w-0"
      action={
        <div className="flex flex-wrap items-center justify-end gap-2">
          {options.length > 1 && (
            <div className="w-24">
              <Select aria-label="Show in currency" value={shown ?? base} onChange={(e) => setPicked(e.target.value)} className="py-1.5">
                {options.map((c) => <option key={c} value={c}>{c}</option>)}
              </Select>
            </div>
          )}
          <Segmented value={range} onChange={setRange} options={RANGES.map((r) => ({ value: r.value, label: r.label }))} />
        </div>
      }>
      {pts.length < 2 ? (
        <p className="py-8 text-center text-sm text-muted">{pts.length === 0 ? "Record a trade or contribution to start the history." : "The chart appears once there are two months of history."}</p>
      ) : (
        <>
          {last && (
            <dl className="mb-2 flex flex-wrap gap-x-5 gap-y-1 text-xs text-muted">
              <div><dt className="inline">Value now </dt><dd className="inline font-semibold text-fg tabular-nums">{formatMoney(last.valueMinor, cur)}</dd></div>
              <div><dt className="inline">Put in </dt><dd className="inline font-semibold text-fg tabular-nums">{formatMoney(last.investedMinor, cur)}</dd></div>
              <div><dt className="inline">Gain </dt><dd className={cx("inline font-semibold tabular-nums", gain > 0 ? "text-income" : gain < 0 ? "text-expense" : "text-fg")}>{formatMoney(gain, cur, { sign: true })}{gainPct !== null ? ` (${gain >= 0 ? "+" : ""}${gainPct.toFixed(1)}%)` : ""}</dd></div>
              {gain === 0 && <div>— add current prices on your assets to see gains; without a price, a holding counts at what it cost.</div>}
            </dl>
          )}
          <LineChart labels={pts.map((p) => label(p.date, withYear))} ariaLabel={`Portfolio value and invested amount in ${cur}, ${range === "all" ? "all time" : `last ${pts.length} months`}`}
            format={(v) => formatMoney(v, cur)} axis={(v) => compact(toMajor(v, cur))}
            series={[{ name: "Value", values: pts.map((p) => p.valueMinor), className: "stroke-primary", stroke: "area" }, { name: "Invested", values: pts.map((p) => p.investedMinor), className: "stroke-chart-2" }]} />
          <p className="mt-2 text-xs text-muted">From your trades and the prices you enter (no market data). Holdings without a price count at cost.{shown && ` Converted to ${cur} with your conversion rates, or the stored exchange rate for each month.`}{h!.excluded.length > 0 && ` Not included: ${h!.excluded.map((e) => e.symbol).join(", ")} (no exchange rate).`}</p>
        </>
      )}
    </Widget>
  );
}
