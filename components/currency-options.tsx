"use client";
import { useCurrencies, useMe } from "@/lib/api/hooks";
import { Select, type Choice, type ValueChange } from "./ui";

/**
 * A currency drop-down: the user's own currencies first, every other currency below. Picking one from
 * "Other currencies" is enough to add it to the user's list — the API remembers it when the item is saved.
 * `current` keeps a value visible even before the lists load (or if it is in neither list); `empty` adds a
 * first "nothing chosen" entry (value "").
 */
export function CurrencySelect({ current, names = false, empty, ...p }: {
  current?: string; names?: boolean; empty?: string;
  name?: string; value?: string; defaultValue?: string; onChange?: (e: ValueChange) => void; required?: boolean; disabled?: boolean; className?: string; "aria-label"?: string;
}) {
  const { data: me } = useMe();
  const { data: all } = useCurrencies();
  const head: Choice[] = empty !== undefined ? [{ value: "", label: empty }] : [];
  let options: Choice[];
  if (!all || !me) options = [...head, ...(current ? [{ value: current, label: current }] : [])];
  else {
    const mine = new Set(me.currencies);
    const label = (c: { code: string; name: string }) => (names ? `${c.code} — ${c.name}` : c.code);
    const byCode = new Map(all.map((c) => [c.code, c]));
    const yours = me.currencies.map((code) => byCode.get(code) ?? { code, name: code });
    const others = all.filter((c) => !mine.has(c.code)).sort((a, b) => a.code.localeCompare(b.code));
    options = [...head, { group: "Your currencies" }, ...yours.map((c) => ({ value: c.code, label: label(c) })), { group: "Other currencies" }, ...others.map((c) => ({ value: c.code, label: label(c) }))];
  }
  return <Select {...p} options={options} />;
}
