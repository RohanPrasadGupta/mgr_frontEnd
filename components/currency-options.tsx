"use client";
import { useCurrencies, useMe } from "@/lib/api/hooks";

/**
 * Options for a currency <select>: the user's own currencies first, every other currency below. Picking one from
 * "Other currencies" is enough to add it to the user's list — the API remembers it when the item is saved.
 * `current` keeps a value visible even before the lists load (or if it is in neither list).
 */
export function CurrencyOptions({ current, names = false }: { current?: string; names?: boolean }) {
  const { data: me } = useMe();
  const { data: all } = useCurrencies();
  if (!all || !me) return current ? <option value={current}>{current}</option> : null;
  const mine = new Set(me.currencies);
  const label = (c: { code: string; name: string }) => (names ? `${c.code} — ${c.name}` : c.code);
  const byCode = new Map(all.map((c) => [c.code, c]));
  const yours = me.currencies.map((code) => byCode.get(code) ?? { code, name: code });
  const others = all.filter((c) => !mine.has(c.code)).sort((a, b) => a.code.localeCompare(b.code));
  return (
    <>
      <optgroup label="Your currencies">{yours.map((c) => <option key={c.code} value={c.code}>{label(c)}</option>)}</optgroup>
      <optgroup label="Other currencies">{others.map((c) => <option key={c.code} value={c.code}>{label(c)}</option>)}</optgroup>
    </>
  );
}
