"use client";
import { useMemo } from "react";
import { useFxQuote } from "@/lib/api/hooks";
import { lastFxRate } from "@/lib/fx-memory";
import { formatMoney, toMinor } from "@/lib/money";
import { Field, Input } from "./ui";

const fmtRate = (r: number) => (r >= 100 ? r.toFixed(2) : r >= 1 ? r.toFixed(4) : r.toPrecision(4));

/**
 * Exchange-rate input for a foreign-currency amount. Shows the stored daily rate that applies when left empty (or that
 * none exists), previews the converted amount, and offers the last rate this user typed for the pair.
 */
export function FxField({ from, to, date, value, onChange, amount }: { from: string; to: string; date: string; value: string; onChange: (v: string) => void; amount?: number }) {
  const quote = useFxQuote(from, to, date);
  const last = useMemo(() => lastFxRate(from, to), [from, to]);
  const typed = Number(value) > 0 ? Number(value) : null;
  const effective = typed ?? quote.data?.rate ?? null;
  const converted = effective && amount && amount > 0 ? formatMoney(toMinor(amount * effective, to), to) : null;

  const stored = quote.isPending ? "Looking up the stored rate…"
    : quote.data ? `Empty = stored rate 1 ${from} = ${fmtRate(quote.data.rate)} ${to} (${quote.data.approximate ? "approximate, " : ""}as of ${quote.data.asOf})`
      : `No stored ${from}→${to} rate for this date — enter the rate you got.`;
  return (
    <div className="space-y-1.5">
      <Field label={`Exchange rate ${from} → ${to}`} hint={stored}>
        <Input type="number" step="any" min="0" value={value} onChange={(e) => onChange(e.target.value)} placeholder={quote.data ? fmtRate(quote.data.rate) : "e.g. 0.25"} aria-describedby="fx-preview" />
      </Field>
      <div className="flex flex-wrap items-center gap-2 text-xs">
        {last && String(last) !== value && <button type="button" onClick={() => onChange(String(last))} className="rounded-full border border-border px-2 py-0.5 text-muted hover:border-primary hover:text-primary">Use last: {fmtRate(last)}</button>}
        {quote.data && value && <button type="button" onClick={() => onChange("")} className="rounded-full border border-border px-2 py-0.5 text-muted hover:border-primary hover:text-primary">Use stored rate</button>}
        {converted && <span id="fx-preview" className="text-muted">≈ <strong className="text-fg tabular-nums">{converted}</strong>{typed ? " at your rate" : " at the stored rate"}</span>}
      </div>
    </div>
  );
}
