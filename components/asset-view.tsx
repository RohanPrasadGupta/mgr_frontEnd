"use client";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { useState } from "react";
import { useResetOn } from "@/lib/use-reset";
import { call, client } from "@/lib/api/client";
import { invalidateInvestments, useAssetPrices, useAssetTrades, useHolding, useMutate } from "@/lib/api/hooks";
import type { Body, CostMethod, Holding, Trade, TradeType } from "@/lib/api/types";
import { CLASS_LABEL, TYPES_FOR, TYPE_LABEL, isInflow } from "@/lib/investments";
import { formatMoney, formatPct, formatQty, formatUnitPrice, minorUnit, pad, toMajor, toMinor } from "@/lib/money";
import { Button, Card, Empty, ErrorNote, Field, Input, ListSkeleton, Modal, PageSkeleton, Select, cx } from "./ui";
import { useConfirm } from "./feedback";

const tone = (n: number | null) => (n === null || n === 0 ? "" : n > 0 ? "text-income" : "text-expense");
const today = () => { const d = new Date(); return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`; };
const fmtDate = (d: string) => new Date(`${d}T00:00:00Z`).toLocaleDateString("en", { day: "numeric", month: "short", year: "numeric", timeZone: "UTC" });

export function AssetView() {
  const confirm = useConfirm();
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const holding = useHolding(id);
  const trades = useAssetTrades(id);
  const [dialog, setDialog] = useState<{ trade?: Trade } | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const patch = useMutate((body: Body<"/investments/assets/{id}", "patch">) => call(client.PATCH("/investments/assets/{id}", { params: { path: { id } }, body })), invalidateInvestments, "Asset updated");
  const remove = useMutate(() => call(client.DELETE("/investments/assets/{id}", { params: { path: { id } } })), invalidateInvestments, "Asset deleted");

  if (holding.isPending) return <PageSkeleton />;
  if (holding.error) return <div className="space-y-3"><Link href="/investments" className="text-sm text-primary underline">← Investments</Link><ErrorNote error={holding.error} retry={() => holding.refetch()} /></div>;
  const h = holding.data;
  const a = h.asset;
  const units = a.tracking === "units";
  const cur = a.currency;

  async function act(fn: () => Promise<unknown>) { setActionError(null); try { await fn(); } catch (e) { setActionError(e instanceof Error ? e.message : "Something went wrong"); } }

  return (
    <div className="space-y-5">
      <Link href="/investments" className="text-sm text-primary underline">← Investments</Link>
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold">{a.symbol}</h1>
          <p className="text-sm text-muted">{a.name} · {CLASS_LABEL[a.class]} · {cur}{a.archived && " · archived"}</p>
        </div>
        <Button onClick={() => setDialog({})} disabled={a.archived}>+ Add {units ? "trade" : "entry"}</Button>
      </div>

      <section aria-label="Position" className="grid grid-cols-2 gap-3 md:grid-cols-4">
        {units ? (<>
          <Stat label="Units held" value={h.closed ? "0 (closed)" : formatQty(h.quantity)} />
          <Stat label={a.costMethod === "manual" ? "Avg price (selected buys)" : "Avg cost / unit"} value={h.avgCostMinor === null ? "—" : formatUnitPrice(h.avgCostMinor, cur)} />
          <Stat label="Cost of holding" value={formatMoney(h.remainingCostMinor, cur)} />
          <Stat label="Market value" value={h.marketValueMinor === null ? "Set a price" : formatMoney(h.marketValueMinor, cur)} />
          <Stat label="Unrealised P/L" value={h.unrealisedPnlMinor === null ? "—" : formatMoney(h.unrealisedPnlMinor, cur, { sign: true })} cls={tone(h.unrealisedPnlMinor)} />
          <Stat label="Realised P/L" value={formatMoney(h.realisedPnlMinor, cur, { sign: true })} cls={tone(h.realisedPnlMinor)} />
          <Stat label="Return" value={formatPct(h.returnPct, true)} cls={tone(h.returnPct)} sub={`XIRR ${formatPct(h.xirrPct, true)}`} />
          <Stat label="Dividends / fees" value={formatMoney(h.dividendsMinor, cur)} sub={`fees ${formatMoney(h.feesMinor, cur)}`} />
        </>) : (<>
          <Stat label="Contributed" value={formatMoney(h.contributedMinor, cur)} />
          <Stat label="Withdrawn" value={formatMoney(h.withdrawnMinor, cur)} />
          <Stat label="Net invested" value={formatMoney(h.remainingCostMinor, cur)} />
          <Stat label="Current value" value={h.marketValueMinor === null ? "Set a value" : formatMoney(h.marketValueMinor, cur)} />
          <Stat label="Gain / loss" value={h.unrealisedPnlMinor === null ? "—" : formatMoney(h.unrealisedPnlMinor, cur, { sign: true })} cls={tone(h.unrealisedPnlMinor)} />
          <Stat label="Return" value={formatPct(h.returnPct, true)} cls={tone(h.returnPct)} sub={`XIRR ${formatPct(h.xirrPct, true)}`} />
          <Stat label="Dividends / interest" value={formatMoney(h.dividendsMinor, cur)} />
          <Stat label="Fees" value={formatMoney(h.feesMinor, cur)} />
        </>)}
      </section>

      {actionError && <ErrorNote error={new Error(actionError)} />}
      <PriceCard h={h} />

      <Card>
        <h2 className="mb-2 text-sm font-semibold">{units ? "Trades" : "Contributions & withdrawals"}</h2>
        {trades.isPending ? <ListSkeleton rows={3} /> : trades.error ? <ErrorNote error={trades.error} /> : trades.data.length === 0 ? <Empty>Nothing recorded yet.</Empty> : (
          <ul className="divide-y divide-border">
            {trades.data.map((t) => (
              <li key={t.id}>
                <button onClick={() => setDialog({ trade: t })} className="flex w-full items-center gap-3 rounded-lg px-2 py-2.5 text-left hover:bg-border/40">
                  <span className="w-20 shrink-0 text-xs text-muted">{fmtDate(t.tradedOn)}</span>
                  <span className="min-w-0 flex-1">
                    <span className="block text-sm font-medium">{TYPE_LABEL[t.type]}{t.quantity !== null && <span className="font-normal text-muted"> · {formatQty(t.quantity)}{t.priceMinor !== null && ` × ${formatUnitPrice(t.priceMinor, cur)}`}</span>}</span>
                    <span className="block truncate text-xs text-muted">{[t.note, t.feeMinor ? `fee ${formatMoney(t.feeMinor, cur)}` : null, a.costMethod === "manual" && t.type === "buy" && t.includeInAvg ? "in average" : null].filter(Boolean).join(" · ")}</span>
                  </span>
                  <span className={cx("text-sm font-semibold tabular-nums", t.type === "bonus" ? "text-muted" : isInflow(t.type) ? "text-income" : "")}>{t.type === "bonus" ? "free" : `${isInflow(t.type) ? "+" : "−"}${formatMoney(t.amountMinor, cur)}`}</span>
                </button>
              </li>
            ))}
          </ul>
        )}
      </Card>

      <Card className="flex flex-wrap items-center gap-3 text-sm">
        {units && (
          <label className="flex items-center gap-2">
            <span className="text-muted">Cost method</span>
            <Select value={a.costMethod} onChange={(e) => act(() => patch.mutateAsync({ costMethod: e.target.value as CostMethod }))} className="w-auto">
              <option value="wavg">Weighted average</option><option value="fifo">FIFO</option><option value="manual">Selected buys</option>
            </Select>
          </label>
        )}
        <button className="text-muted underline" onClick={() => act(() => patch.mutateAsync({ archived: !a.archived }))}>{a.archived ? "Unarchive" : "Archive"}</button>
        <button className="text-muted underline hover:text-expense" onClick={async () => (await confirm({ message: `Delete ${a.symbol}? Assets with trades can only be archived.`, destructive: true })) && act(async () => { await remove.mutateAsync(undefined as never); router.replace("/investments"); })}>Delete asset</button>
      </Card>

      <TradeDialog open={dialog !== null} holding={h} trade={dialog?.trade} onClose={() => setDialog(null)} />
    </div>
  );
}

function Stat({ label, value, cls, sub }: { label: string; value: string; cls?: string; sub?: string }) {
  return (
    <Card className="p-3">
      <div className="text-xs text-muted">{label}</div>
      <div className={cx("mt-0.5 text-lg font-semibold tabular-nums", cls)}>{value}</div>
      {sub && <div className="text-xs text-muted">{sub}</div>}
    </Card>
  );
}

function PriceCard({ h }: { h: Holding }) {
  const a = h.asset;
  const prices = useAssetPrices(a.id);
  const [price, setPrice] = useState("");
  const [date, setDate] = useState(today);
  const [error, setError] = useState<string | null>(null);
  const save = useMutate((body: Body<"/investments/assets/{id}/prices", "post">) => call(client.POST("/investments/assets/{id}/prices", { params: { path: { id: a.id } }, body })), invalidateInvestments, "Price saved");
  const units = a.tracking === "units";

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    const v = Number(price);
    if (!(v > 0)) return setError("Enter a value greater than 0");
    try { await save.mutateAsync({ asOn: date, priceMinor: Number((v * 10 ** minorUnit(a.currency)).toFixed(6)) }); setPrice(""); } catch (err) { setError(err instanceof Error ? err.message : "Failed"); }
  }
  return (
    <Card>
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h2 className="text-sm font-semibold">{units ? "Current price" : "Current total value"}</h2>
          <p className="text-sm text-muted">{h.latestPrice ? `${units ? formatUnitPrice(h.latestPrice.priceMinor, a.currency) : formatMoney(h.latestPrice.priceMinor, a.currency)} as of ${fmtDate(h.latestPrice.asOn)}` : "Not set — enter it to see market value and P/L."}</p>
        </div>
        <form onSubmit={submit} className="flex flex-wrap items-end gap-2">
          <Field label={units ? `Price per unit (${a.currency})` : `Total value (${a.currency})`}><Input type="number" step="any" min="0" required value={price} onChange={(e) => setPrice(e.target.value)} className="w-40" /></Field>
          <Field label="As of"><Input type="date" required value={date} onChange={(e) => setDate(e.target.value)} /></Field>
          <Button type="submit" loading={save.isPending}>Update</Button>
        </form>
      </div>
      {error && <div className="mt-2"><ErrorNote error={new Error(error)} /></div>}
      {prices.data && prices.data.length > 1 && <p className="mt-2 text-xs text-muted">{prices.data.length} price points recorded.</p>}
    </Card>
  );
}

function TradeDialog({ open, holding, trade, onClose }: { open: boolean; holding: Holding; trade?: Trade; onClose: () => void }) {
  const confirm = useConfirm();
  const a = holding.asset;
  const units = a.tracking === "units";
  const options = TYPES_FOR[a.tracking];
  const [type, setType] = useState<TradeType>(options[0]!.value);
  const [qty, setQty] = useState("");
  const [price, setPrice] = useState("");
  const [amount, setAmount] = useState("");
  const [fee, setFee] = useState("");
  const [date, setDate] = useState(today());
  const [note, setNote] = useState("");
  const [inAvg, setInAvg] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const unit = 10 ** minorUnit(a.currency);

  useResetOn(open ? (trade?.id ?? "new") : null, () => {
    setError(null);
    if (trade) {
      setType(trade.type); setQty(trade.quantity === null ? "" : String(trade.quantity));
      setPrice(trade.priceMinor === null ? "" : String(trade.priceMinor / unit));
      setAmount(String(toMajor(trade.amountMinor, a.currency))); setFee(trade.feeMinor ? String(toMajor(trade.feeMinor, a.currency)) : "");
      setDate(trade.tradedOn); setNote(trade.note ?? ""); setInAvg(trade.includeInAvg);
    } else { setType(options[0]!.value); setQty(""); setPrice(""); setAmount(""); setFee(""); setDate(today()); setNote(""); setInAvg(true); }
  });

  const qtyType = type === "buy" || type === "sell" || type === "bonus";
  const priced = type === "buy" || type === "sell";
  const total = priced && Number(qty) > 0 && Number(price) > 0 ? Math.round(Number(qty) * Number(price) * unit) : null;

  const save = useMutate(async () => {
    const body: Body<"/investments/trades/{id}", "patch"> = { tradedOn: date, note: note || null, feeMinor: fee ? toMinor(Number(fee), a.currency) : 0 };
    if (qtyType) { if (!(Number(qty) > 0)) throw new Error("Enter a quantity greater than 0"); body.quantity = Number(qty); }
    if (priced) { if (!(Number(price) > 0)) throw new Error("Enter a price greater than 0"); body.priceMinor = Number((Number(price) * unit).toFixed(6)); }
    if (!qtyType) { if (!(Number(amount) > 0)) throw new Error("Enter an amount greater than 0"); body.amountMinor = toMinor(Number(amount), a.currency); }
    if (a.costMethod === "manual" && type === "buy") body.includeInAvg = inAvg;
    return trade
      ? call(client.PATCH("/investments/trades/{id}", { params: { path: { id: trade.id } }, body }))
      : call(client.POST("/investments/trades", { body: { ...body, note: note || undefined, assetId: a.id, type, clientId: crypto.randomUUID() } }));
  }, invalidateInvestments, trade ? "Entry updated" : "Entry added");
  const del = useMutate(() => call(client.DELETE("/investments/trades/{id}", { params: { path: { id: trade!.id } } })), invalidateInvestments, "Entry deleted");

  async function submit(e: React.FormEvent) { e.preventDefault(); setError(null); try { await save.mutateAsync(undefined as never); onClose(); } catch (err) { setError(err instanceof Error ? err.message : "Failed"); } }
  async function remove() { if (!(await confirm({ message: "Delete this entry?", destructive: true }))) return; try { await del.mutateAsync(undefined as never); onClose(); } catch (err) { setError(err instanceof Error ? err.message : "Failed"); } }

  return (
    <Modal open={open} onClose={onClose} title={trade ? `Edit ${TYPE_LABEL[trade.type].toLowerCase()}` : units ? "Add trade" : "Add entry"}>
      <form onSubmit={submit} className="space-y-3">
        {!trade && <Field label="Type"><Select value={type} onChange={(e) => setType(e.target.value as TradeType)}>{options.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}</Select></Field>}
        {qtyType && <Field label="Quantity"><Input type="number" step="any" min="0" required value={qty} onChange={(e) => setQty(e.target.value)} autoFocus /></Field>}
        {priced && <Field label={`Price per unit (${a.currency})`} hint={total === null ? undefined : `Total ${formatMoney(total, a.currency)}`}><Input type="number" step="any" min="0" required value={price} onChange={(e) => setPrice(e.target.value)} /></Field>}
        {!qtyType && <Field label={`Amount (${a.currency})`}><Input type="number" step="0.01" min="0" required value={amount} onChange={(e) => setAmount(e.target.value)} autoFocus /></Field>}
        {type !== "bonus" && type !== "fee" && <Field label={`Fee / charge (${a.currency})`} hint="Optional"><Input type="number" step="0.01" min="0" value={fee} onChange={(e) => setFee(e.target.value)} /></Field>}
        <Field label="Date"><Input type="date" required value={date} onChange={(e) => setDate(e.target.value)} /></Field>
        <Field label="Note"><Input maxLength={500} value={note} onChange={(e) => setNote(e.target.value)} placeholder="Optional" /></Field>
        {a.costMethod === "manual" && type === "buy" && (
          <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={inAvg} onChange={(e) => setInAvg(e.target.checked)} />Use this buy for the displayed average price</label>
        )}
        {error && <ErrorNote error={new Error(error)} />}
        <div className="flex items-center justify-between pt-2">
          {trade ? <Button type="button" variant="danger" onClick={remove} loading={del.isPending}>Delete</Button> : <span />}
          <div className="flex gap-2"><Button type="button" variant="ghost" onClick={onClose}>Cancel</Button><Button type="submit" loading={save.isPending}>{save.isPending ? "Saving…" : "Save"}</Button></div>
        </div>
      </form>
    </Modal>
  );
}
