"use client";
import Link from "next/link";
import { useEffect, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { call, client } from "@/lib/api/client";
import { useMe } from "@/lib/api/hooks";
import type { SipResult } from "@/lib/api/types";
import { formatMoney, toMinor } from "@/lib/money";
import { Card, ErrorNote, Field, Input, Skeleton } from "./ui";

export function SipCalculator() {
  const { data: me } = useMe();
  const cur = me?.baseCurrency ?? "THB";
  const [monthly, setMonthly] = useState("5000");
  const [rate, setRate] = useState("12");
  const [years, setYears] = useState("10");
  const [debounced, setDebounced] = useState({ monthly, rate, years });
  useEffect(() => { const t = setTimeout(() => setDebounced({ monthly, rate, years }), 300); return () => clearTimeout(t); }, [monthly, rate, years]);

  const m = Number(debounced.monthly), r = Number(debounced.rate), y = Number(debounced.years);
  const valid = m > 0 && r >= 0 && r <= 100 && y > 0 && y <= 80;
  const calc = useQuery({
    queryKey: ["calc", "sip", m, r, y],
    enabled: valid,
    queryFn: async () => (await call(client.POST("/calc/sip", { body: { monthly: m, annualRatePct: r, years: y } }))).data,
    staleTime: Infinity,
  });
  const money = (v: number) => formatMoney(toMinor(v, cur), cur);
  const d = calc.data;

  return (
    <div className="space-y-5">
      <Link href="/investments" className="text-sm text-primary underline">← Investments</Link>
      <h1 className="text-2xl font-semibold">SIP calculator</h1>
      <p className="text-sm text-muted">Projects a monthly investment growing at a fixed annual return, with each instalment invested at the start of the month.</p>
      <Card className="grid gap-3 sm:grid-cols-3">
        <Field label={`Monthly amount (${cur})`}><Input type="number" min="0" step="any" value={monthly} onChange={(e) => setMonthly(e.target.value)} /></Field>
        <Field label="Expected return (% per year)"><Input type="number" min="0" max="100" step="any" value={rate} onChange={(e) => setRate(e.target.value)} /></Field>
        <Field label="Years"><Input type="number" min="1" max="80" step="any" value={years} onChange={(e) => setYears(e.target.value)} /></Field>
      </Card>
      {!valid ? <p className="text-sm text-muted">Enter a monthly amount above 0, a rate between 0 and 100, and 1–80 years.</p> : calc.error ? <ErrorNote error={calc.error} /> : !d ? <Skeleton className="h-64" /> : (
        <>
          <section className="grid grid-cols-1 gap-3 sm:grid-cols-3" aria-label="Result">
            <Card><div className="text-xs text-muted">Total invested</div><div className="mt-1 text-xl font-semibold tabular-nums">{money(d.totalInvested)}</div></Card>
            <Card><div className="text-xs text-muted">Estimated returns</div><div className="mt-1 text-xl font-semibold tabular-nums text-income">{money(d.estimatedReturns)}</div></Card>
            <Card><div className="text-xs text-muted">Maturity value</div><div className="mt-1 text-xl font-semibold tabular-nums">{money(d.maturityValue)}</div></Card>
          </section>
          <Card>
            <h2 className="mb-2 text-sm font-semibold">Invested vs returns by year</h2>
            <Bars rows={d.yearlyBreakdown} money={money} />
          </Card>
        </>
      )}
    </div>
  );
}

function Bars({ rows, money }: { rows: SipResult["yearlyBreakdown"]; money: (v: number) => string }) {
  const max = Math.max(1, ...rows.map((r) => r.total));
  const W = 600, H = 190, base = 160, gap = W / rows.length, bw = Math.min(28, gap * 0.6);
  return (
    <svg viewBox={`0 0 ${W} ${H}`} role="img" aria-label="Invested amount and returns per year" className="w-full">
      {rows.map((r, i) => {
        const x = i * gap + gap / 2;
        const hi = (r.invested / max) * (base - 10), hr = (r.returns / max) * (base - 10);
        return (
          <g key={r.year}>
            <title>{`Year ${r.year}: invested ${money(r.invested)}, returns ${money(r.returns)}, total ${money(r.total)}`}</title>
            <rect x={x - bw / 2} y={base - hi} width={bw} height={hi} className="fill-primary" />
            <rect x={x - bw / 2} y={base - hi - hr} width={bw} height={hr} rx={2} className="fill-income" />
            {(rows.length <= 12 || i % 2 === 0) && <text x={x} y={H - 8} textAnchor="middle" className="fill-muted text-[11px]">{r.year}</text>}
          </g>
        );
      })}
    </svg>
  );
}
