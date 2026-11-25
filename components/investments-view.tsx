"use client";
import Link from "next/link";
import { useState } from "react";
import { call, client } from "@/lib/api/client";
import { invalidateInvestments, useCurrencies, useMe, useMutate, usePortfolio } from "@/lib/api/hooks";
import type { AssetClass, Body, CostMethod, Holding } from "@/lib/api/types";
import { CLASS_DOT, CLASS_LABEL, defaultTracking } from "@/lib/investments";
import { formatMoney, formatPct, formatQty } from "@/lib/money";
import { Button, Card, Empty, ErrorNote, Field, Input, Modal, PageSkeleton, Select, cx } from "./ui";

const tone = (n: number | null) => (n === null || n === 0 ? "" : n > 0 ? "text-income" : "text-expense");

export function InvestmentsView() {
  const portfolio = usePortfolio();
  const [adding, setAdding] = useState(false);
  const p = portfolio.data;
  const base = p?.baseCurrency ?? "THB";

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-2xl font-semibold">Investments</h1>
        <div className="flex gap-2">
          <Link href="/investments/calculator" className="inline-flex items-center rounded-lg border border-border bg-card px-3.5 py-2 text-sm font-medium hover:bg-border/40">SIP calculator</Link>
          <Button onClick={() => setAdding(true)}>+ Add asset</Button>
        </div>
      </div>

      {portfolio.isPending ? <PageSkeleton /> : portfolio.error ? <ErrorNote error={portfolio.error} retry={() => portfolio.refetch()} /> : (
        <>
          <section aria-label="Portfolio summary" className="grid grid-cols-2 gap-3 lg:grid-cols-4">
            <Stat label="Portfolio value" value={formatMoney(p!.marketValueMinor, base)} />
            <Stat label="Invested (cost)" value={formatMoney(p!.investedMinor, base)} />
            <Stat label="Unrealised P/L" value={formatMoney(p!.unrealisedPnlMinor, base, { sign: true })} cls={tone(p!.unrealisedPnlMinor)} />
            <Stat label="Realised P/L" value={formatMoney(p!.realisedPnlMinor, base, { sign: true })} cls={tone(p!.realisedPnlMinor)} sub={p!.dividendsMinor ? `+ ${formatMoney(p!.dividendsMinor, base)} dividends` : undefined} />
          </section>
          <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-muted">
            <span>Annualised return (XIRR): <b className={cx("text-fg", tone(p!.xirrPct))}>{formatPct(p!.xirrPct, true)}</b></span>
            {p!.approximate && <span>Approximate: converted at today&apos;s FX rate{!p!.pricedAll && "; holdings without a price are counted at cost"}.</span>}
          </div>
          {p!.excluded.length > 0 && (
            <div role="status" className="rounded-xl border border-warn/40 bg-warn/10 p-3 text-sm text-warn">
              Not included in the totals: {p!.excluded.map((e) => `${e.symbol} (${e.reason})`).join(", ")}.
            </div>
          )}

          {p!.holdings.length === 0 ? (
            <Empty>No investments yet. Add an asset (a stock, a SIP fund, SSF…) then record trades or contributions.</Empty>
          ) : (
            <div className="grid gap-4 lg:grid-cols-[1fr_18rem]">
              <Card className="overflow-hidden p-0">
                <ul className="stagger divide-y divide-border">
                  {p!.holdings.map((h) => <HoldingRow key={h.asset.id} h={h} />)}
                </ul>
              </Card>
              <Card>
                <h2 className="mb-3 text-sm font-semibold">Allocation</h2>
                <ul className="stagger space-y-2.5">
                  {p!.allocation.map((a) => (
                    <li key={a.class}>
                      <div className="flex justify-between text-sm"><span className="flex items-center gap-2"><span className={cx("size-2.5 rounded-full", CLASS_DOT[a.class])} />{CLASS_LABEL[a.class]}</span><span className="tabular-nums text-muted">{a.pct.toFixed(0)}%</span></div>
                      <div className="mt-1 h-1.5 overflow-hidden rounded-full bg-border"><div className={cx("bar-fill h-full rounded-full", CLASS_DOT[a.class])} style={{ width: `${Math.max(2, a.pct)}%` }} /></div>
                      <div className="mt-0.5 text-xs tabular-nums text-muted">{formatMoney(a.valueMinor, base)}</div>
                    </li>
                  ))}
                </ul>
              </Card>
            </div>
          )}
        </>
      )}
      <AssetDialog open={adding} onClose={() => setAdding(false)} />
    </div>
  );
}

function Stat({ label, value, cls, sub }: { label: string; value: string; cls?: string; sub?: string }) {
  return (
    <Card>
      <div className="text-xs text-muted">{label}</div>
      <div className={cx("mt-1 text-xl font-semibold tabular-nums sm:text-2xl", cls)}>{value}</div>
      {sub && <div className="mt-0.5 text-xs text-muted">{sub}</div>}
    </Card>
  );
}

function HoldingRow({ h }: { h: Holding }) {
  const a = h.asset;
  const units = a.tracking === "units";
  const value = h.marketValueMinor ?? h.remainingCostMinor;
  return (
    <li>
      <Link href={`/investments/${a.id}`} className="flex items-center gap-3 px-4 py-3 hover:bg-border/30">
        <span className={cx("size-2.5 shrink-0 rounded-full", CLASS_DOT[a.class])} aria-hidden />
        <span className="min-w-0 flex-1">
          <span className="block truncate text-sm font-medium">{a.symbol} <span className="font-normal text-muted">· {a.name}</span></span>
          <span className="block truncate text-xs text-muted">
            {CLASS_LABEL[a.class]} · {a.currency}
            {units && !h.closed && <> · {formatQty(h.quantity)} units</>}
            {h.closed && " · closed"}
            {h.marketValueMinor === null && h.tradeCount > 0 && " · no price set"}
          </span>
        </span>
        <span className="text-right">
          <span className="block text-sm font-semibold tabular-nums">{formatMoney(value, a.currency)}</span>
          <span className={cx("block text-xs tabular-nums", tone(h.unrealisedPnlMinor ?? h.realisedPnlMinor))}>
            {h.unrealisedPnlMinor !== null ? `${formatMoney(h.unrealisedPnlMinor, a.currency, { sign: true })} · ${formatPct(h.returnPct, true)}` : h.realisedPnlMinor ? `${formatMoney(h.realisedPnlMinor, a.currency, { sign: true })} realised` : "—"}
          </span>
        </span>
      </Link>
    </li>
  );
}

const CLASSES = Object.keys(CLASS_LABEL) as AssetClass[];
export function AssetDialog({ open, onClose }: { open: boolean; onClose: () => void }) {
  const { data: me } = useMe();
  const currencies = useCurrencies();
  const [cls, setCls] = useState<AssetClass>("stock");
  const [error, setError] = useState<string | null>(null);
  const create = useMutate((body: Body<"/investments/assets", "post">) => call(client.POST("/investments/assets", { body })), invalidateInvestments, "Asset added");
  const units = defaultTracking(cls) === "units";

  async function submit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);
    const f = new FormData(e.currentTarget);
    try {
      await create.mutateAsync({ symbol: String(f.get("symbol")).trim(), name: String(f.get("name")).trim(), class: cls, currency: String(f.get("currency")), costMethod: (String(f.get("costMethod") || "wavg") as CostMethod) });
      onClose();
    } catch (err) { setError(err instanceof Error ? err.message : "Failed"); }
  }
  return (
    <Modal open={open} onClose={onClose} title="Add asset">
      {open && (
        <form onSubmit={submit} className="space-y-3">
          <Field label="Type"><Select value={cls} onChange={(e) => setCls(e.target.value as AssetClass)}>{CLASSES.map((c) => <option key={c} value={c}>{CLASS_LABEL[c]}</option>)}</Select></Field>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Symbol / short name"><Input name="symbol" required maxLength={30} placeholder={units ? "NABIL" : "NIC-SIP"} autoFocus /></Field>
            <Field label="Currency"><Select name="currency" defaultValue={me?.baseCurrency ?? "THB"}>{currencies.data?.map((c) => <option key={c.code} value={c.code}>{c.code}</option>)}</Select></Field>
          </div>
          <Field label="Name"><Input name="name" required maxLength={100} placeholder={units ? "Nabil Bank Ltd." : "NIC Asia Growth Fund"} /></Field>
          {units ? (
            <Field label="Cost method" hint="Weighted average is the default. “Selected buys” uses only buys you flag for the displayed average (your v1 “Use for avg”).">
              <Select name="costMethod" defaultValue="wavg"><option value="wavg">Weighted average</option><option value="fifo">FIFO</option><option value="manual">Selected buys (manual)</option></Select>
            </Field>
          ) : <p className="text-xs text-muted">Tracked by value: you record contributions and withdrawals, and update the current total value yourself.</p>}
          {error && <ErrorNote error={new Error(error)} />}
          <div className="flex justify-end gap-2 pt-2"><Button type="button" variant="ghost" onClick={onClose}>Cancel</Button><Button type="submit" loading={create.isPending}>Add</Button></div>
        </form>
      )}
    </Modal>
  );
}
