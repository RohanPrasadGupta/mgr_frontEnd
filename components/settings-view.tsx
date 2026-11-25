"use client";
import { useEffect, useMemo, useState } from "react";
import { call, client } from "@/lib/api/client";
import type { Body } from "@/lib/api/types";
import { qk, useCurrencies, useMe, useMutate } from "@/lib/api/hooks";
import { DeleteAccountCard } from "./delete-account";
import { Button, Card, ErrorNote, Field, Input, Segmented, Select, Skeleton } from "./ui";
import { useConfirm } from "./feedback";

type Theme = "system" | "light" | "dark";
const DAYS = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];

function applyTheme(t: Theme) {
  try { if (t === "system") localStorage.removeItem("mm_theme"); else localStorage.setItem("mm_theme", t); } catch { /* storage blocked: still apply for this visit */ }
  if (t === "system") delete document.documentElement.dataset.theme; else document.documentElement.dataset.theme = t;
}

export function SettingsView() {
  const confirm = useConfirm();
  const { data: me, isPending, error } = useMe();
  const currencies = useCurrencies();
  const [theme, setTheme] = useState<Theme>("system");
  const [name, setName] = useState("");
  const [baseCurrency, setBaseCurrency] = useState("");
  const [timezone, setTimezone] = useState("");
  const [weekStart, setWeekStart] = useState(1);
  const [msg, setMsg] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => { try { const t = localStorage.getItem("mm_theme"); if (t === "light" || t === "dark") setTheme(t); } catch { /* ignore */ } }, []);
  useEffect(() => { if (me) { setName(me.name); setBaseCurrency(me.baseCurrency); setTimezone(me.timezone); setWeekStart(me.weekStart); } }, [me]);

  const zones = useMemo(() => {
    const list: string[] = typeof Intl.supportedValuesOf === "function" ? Intl.supportedValuesOf("timeZone") : [];
    const set = new Set(["UTC", ...list]);
    if (me?.timezone) set.add(me.timezone);
    return [...set].sort();
  }, [me?.timezone]);

  const save = useMutate((body: Body<"/me", "patch">) => call(client.PATCH("/me", { body })), (qc) => qc.invalidateQueries({ queryKey: qk.me }), "Settings saved");

  if (isPending) return <Skeleton className="h-96" />;
  if (error) return <ErrorNote error={error} />;
  const currencyChanged = baseCurrency !== me!.baseCurrency;
  const dirty = name.trim() !== me!.name || currencyChanged || timezone !== me!.timezone || weekStart !== me!.weekStart;

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setMsg(null); setErr(null);
    if (currencyChanged && !(await confirm({ title: "Change base currency?", confirmLabel: "Change currency", message: `Change your base currency to ${baseCurrency}?\n\nTotals, budgets and charts are calculated from amounts stored in the old base currency (${me!.baseCurrency}) for past transactions, so they will mix currencies until those are re-entered. Only change this if you are just starting out.` }))) return;
    try {
      await save.mutateAsync({ name: name.trim(), baseCurrency, timezone, weekStart });
      setMsg("Saved.");
    } catch (e2) { setErr(e2 instanceof Error ? e2.message : "Failed"); }
  }

  return (
    <div className="max-w-2xl space-y-5">
      <h1 className="text-2xl font-semibold">Settings</h1>

      <Card>
        <h2 className="mb-3 text-sm font-semibold">Appearance</h2>
        <Segmented value={theme} onChange={(t) => { setTheme(t); applyTheme(t); }} options={[{ value: "system", label: "System" }, { value: "light", label: "Light" }, { value: "dark", label: "Dark" }]} />
      </Card>

      <Card>
        <h2 className="mb-3 text-sm font-semibold">Profile & preferences</h2>
        <form onSubmit={submit} className="space-y-3">
          <Field label="Email"><Input value={me!.email} readOnly disabled /></Field>
          <Field label="Name"><Input value={name} onChange={(e) => setName(e.target.value)} required maxLength={80} /></Field>
          <Field label="Base currency" hint="Totals and charts are shown in this currency.">
            <Select value={baseCurrency} onChange={(e) => setBaseCurrency(e.target.value)}>
              {currencies.data?.map((c) => <option key={c.code} value={c.code}>{c.code} — {c.name}</option>)}
              {!currencies.data && <option value={baseCurrency}>{baseCurrency}</option>}
            </Select>
          </Field>
          {currencyChanged && <p role="alert" className="rounded-lg bg-warn/10 p-2 text-xs text-warn">Changing the base currency does not convert your existing transactions, so past totals will mix currencies.</p>}
          <Field label="Time zone" hint="Decides which day and month a transaction belongs to."><Select value={timezone} onChange={(e) => setTimezone(e.target.value)}>{zones.map((z) => <option key={z} value={z}>{z}</option>)}</Select></Field>
          <Field label="Week starts on"><Select value={weekStart} onChange={(e) => setWeekStart(Number(e.target.value))}>{DAYS.map((d, i) => <option key={d} value={i}>{d}</option>)}</Select></Field>
          {err && <ErrorNote error={new Error(err)} />}
          {msg && <p role="status" className="text-sm text-income">{msg}</p>}
          <Button type="submit" disabled={!dirty || save.isPending}>{save.isPending ? "Saving…" : "Save changes"}</Button>
        </form>
      </Card>

      <DeleteAccountCard />
    </div>
  );
}
