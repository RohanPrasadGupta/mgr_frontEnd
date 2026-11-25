"use client";
import { useEffect, useState } from "react";
import { call, client } from "@/lib/api/client";
import { invalidateLedger, useAccounts, useMe, useMutate } from "@/lib/api/hooks";
import { formatMoney, minorUnit, pad, toMinor } from "@/lib/money";
import { Button, ErrorNote, Field, Input, Modal, Select } from "./ui";

const localInput = (d: Date) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;

export function TransferDialog({ open, onClose, defaultFrom }: { open: boolean; onClose: () => void; defaultFrom?: string }) {
  const accounts = useAccounts();
  const { data: me } = useMe();
  const active = (accounts.data ?? []).filter((a) => !a.archived);
  const [fromId, setFromId] = useState("");
  const [toId, setToId] = useState("");
  const [amount, setAmount] = useState("");
  const [received, setReceived] = useState("");
  const [fx, setFx] = useState("");
  const [when, setWhen] = useState(localInput(new Date()));
  const [note, setNote] = useState("");
  const [error, setError] = useState<string | null>(null);

  // Reset the form each time it opens.
  useEffect(() => {
    if (!open) return;
    setError(null); setAmount(""); setReceived(""); setFx(""); setNote(""); setWhen(localInput(new Date()));
    setFromId(""); setToId("");
  }, [open]);

  // Pick sensible accounts once the list is available (it may load after the dialog opens or refetch while open).
  useEffect(() => {
    if (!open || active.length === 0) return;
    const valid = (id: string) => active.some((a) => a.id === id);
    const from = valid(fromId) ? fromId : defaultFrom && valid(defaultFrom) ? defaultFrom : active[0]!.id;
    if (from !== fromId) setFromId(from);
    if (!valid(toId) || toId === from) setToId(active.find((a) => a.id !== from)?.id ?? "");
  }, [open, active, fromId, toId, defaultFrom]);

  const from = active.find((a) => a.id === fromId);
  const to = active.find((a) => a.id === toId);
  const cross = !!from && !!to && from.currency !== to.currency;
  const base = me?.baseCurrency;
  // The API only accepts an explicit rate when exactly one side is non-base; otherwise it uses stored daily rates.
  const showFx = !!from && !!to && !!base && ((from.currency !== base) !== (to.currency !== base));
  const impliedRate = cross && Number(amount) > 0 && Number(received) > 0 ? Number(received) / Number(amount) : null;
  const short = !!from && Number(amount) > 0 && toMinor(Number(amount), from.currency) > from.balanceMinor;

  const save = useMutate(async () => {
    if (!from || !to) throw new Error("Choose both accounts");
    if (from.id === to.id) throw new Error("Choose two different accounts");
    const amountMinor = toMinor(Number(amount), from.currency);
    if (!(amountMinor > 0)) throw new Error("Enter an amount greater than 0");
    let toAmountMinor: number | undefined;
    if (cross) {
      toAmountMinor = toMinor(Number(received), to.currency);
      if (!(toAmountMinor > 0)) throw new Error(`Enter how much ${to.currency} arrives`);
    }
    return call(client.POST("/transfers", { body: { fromAccountId: from.id, toAccountId: to.id, amountMinor, toAmountMinor, occurredAt: new Date(when).toISOString(), note: note.trim() || undefined, fxRate: showFx && fx ? Number(fx) : undefined } }));
  }, invalidateLedger, "Transfer completed");

  async function submit(e: React.FormEvent) { e.preventDefault(); setError(null); try { await save.mutateAsync(undefined as never); onClose(); } catch (err) { setError(err instanceof Error ? err.message : "Failed"); } }
  const opt = (a: (typeof active)[number]) => <option key={a.id} value={a.id}>{a.name} ({a.currency}) · {formatMoney(a.balanceMinor, a.currency)}</option>;

  return (
    <Modal open={open} onClose={onClose} title="New transfer">
      {active.length < 2 ? <p className="text-sm text-muted">You need at least two active accounts to transfer between them. Add another account first.</p> : (
        <form onSubmit={submit} className="space-y-3">
          <div className="grid grid-cols-[1fr_auto_1fr] items-end gap-2">
            <Field label="From"><Select value={fromId} onChange={(e) => { const v = e.target.value; setFromId(v); if (v === toId) setToId(active.find((a) => a.id !== v)?.id ?? ""); }}>{active.map(opt)}</Select></Field>
            <button type="button" onClick={() => { setFromId(toId); setToId(fromId); }} aria-label="Swap accounts" className="mb-0.5 rounded-lg border border-border p-2 text-muted hover:bg-border/50">⇄</button>
            <Field label="To"><Select value={toId} onChange={(e) => setToId(e.target.value)}>{active.filter((a) => a.id !== fromId).map(opt)}</Select></Field>
          </div>
          <Field label={`Amount sent${from ? ` (${from.currency})` : ""}`} hint={short ? "This is more than the account's current balance." : undefined}>
            <Input type="number" min="0" step={minorUnit(from?.currency ?? "THB") === 0 ? "1" : "0.01"} required value={amount} onChange={(e) => setAmount(e.target.value)} autoFocus />
          </Field>
          {cross && (
            <Field label={`Amount received (${to!.currency})`} hint={impliedRate ? `Implied rate: 1 ${from!.currency} = ${impliedRate.toFixed(4)} ${to!.currency}` : "Different currencies: enter what actually arrives."}>
              <Input type="number" min="0" step={minorUnit(to!.currency) === 0 ? "1" : "0.01"} required value={received} onChange={(e) => setReceived(e.target.value)} />
            </Field>
          )}
          {showFx && <Field label={`FX rate to ${base}`} hint="Optional — leave empty to use the stored daily rate"><Input type="number" min="0" step="any" value={fx} onChange={(e) => setFx(e.target.value)} /></Field>}
          <Field label="Date & time"><Input type="datetime-local" required value={when} onChange={(e) => setWhen(e.target.value)} /></Field>
          <Field label="Note"><Input maxLength={500} value={note} onChange={(e) => setNote(e.target.value)} placeholder="Optional" /></Field>
          {error && <ErrorNote error={new Error(error)} />}
          <div className="flex justify-end gap-2 pt-2"><Button type="button" variant="ghost" onClick={onClose}>Cancel</Button><Button type="submit" loading={save.isPending}>{save.isPending ? "Transferring…" : "Transfer"}</Button></div>
        </form>
      )}
    </Modal>
  );
}
