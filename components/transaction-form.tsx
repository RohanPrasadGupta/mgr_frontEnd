"use client";
import { useQueryClient } from "@tanstack/react-query";
import { useEffect, useMemo, useState } from "react";
import { call, client, uploadAttachment } from "@/lib/api/client";
import { invalidateLedger, useAccounts, useCategories, useMe, useMutate } from "@/lib/api/hooks";
import type { Body, Transaction } from "@/lib/api/types";
import { minorUnit, pad, toMajor, toMinor } from "@/lib/money";
import { Button, ErrorNote, Field, Input, Modal, Segmented, Select } from "./ui";
import { useConfirm } from "./feedback";
import { AttachmentsPanel, PendingAttachments } from "./attachments-panel";
import { TagPicker } from "./tag-picker";
import { toast } from "@/lib/toast";

const localInput = (d: Date) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;

export function TransactionForm({ open, onClose, tx }: { open: boolean; onClose: () => void; tx?: Transaction | null }) {
  const confirm = useConfirm();
  const qc = useQueryClient();
  const accounts = useAccounts();
  const categories = useCategories();
  const { data: me } = useMe();
  const editing = !!tx;
  const transfer = tx?.kind === "transfer_in" || tx?.kind === "transfer_out";

  const [kind, setKind] = useState<"income" | "expense">("expense");
  const [amount, setAmount] = useState("");
  const [accountId, setAccountId] = useState("");
  const [categoryId, setCategoryId] = useState("");
  const [when, setWhen] = useState(localInput(new Date()));
  const [note, setNote] = useState("");
  const [fx, setFx] = useState("");
  const [tagIds, setTagIds] = useState<string[]>([]);
  const [files, setFiles] = useState<File[]>([]);
  const [error, setError] = useState<string | null>(null);

  // Reset the fields when the dialog opens (or switches to another transaction) — never when background data refreshes,
  // which would wipe what the user is typing.
  useEffect(() => {
    if (!open) return;
    setError(null);
    if (tx) {
      setKind(tx.kind === "income" ? "income" : "expense");
      setAmount(String(toMajor(tx.amountMinor, tx.currency)));
      setAccountId(tx.accountId);
      setCategoryId(tx.categoryId ?? "");
      setWhen(localInput(new Date(tx.occurredAt)));
      setNote(tx.note ?? "");
      setTagIds(tx.tagIds ?? []);
    } else {
      setKind("expense"); setAmount(""); setCategoryId(""); setWhen(localInput(new Date())); setNote(""); setFx(""); setAccountId(""); setTagIds([]); setFiles([]);
    }
  }, [open, tx]);

  // New transactions default to the first active account as soon as accounts are available.
  useEffect(() => {
    if (!open || tx || accountId) return;
    const first = accounts.data?.find((a) => !a.archived)?.id;
    if (first) setAccountId(first);
  }, [open, tx, accountId, accounts.data]);

  const account = accounts.data?.find((a) => a.id === accountId);
  const cats = useMemo(() => (categories.data ?? []).filter((c) => c.kind === kind && !c.archived), [categories.data, kind]);
  const foreign = !!account && !!me && account.currency !== me.baseCurrency && !editing;

  const save = useMutate(async () => {
    const major = Number(amount);
    if (!editing && !(major > 0)) throw new Error("Enter an amount greater than 0");
    const occurredAt = new Date(when).toISOString();
    if (editing) {
      if (!transfer && !(major > 0)) throw new Error("Enter an amount greater than 0");
      const body: Body<"/transactions/{id}", "patch"> = { occurredAt, note: note || null, tagIds, ...(transfer ? {} : { amountMinor: toMinor(major, tx!.currency), categoryId: categoryId || null }) };
      return call(client.PATCH("/transactions/{id}", { params: { path: { id: tx!.id } }, body }));
    }
    if (!account) throw new Error("Choose an account");
    return call(client.POST("/transactions", { body: { accountId, kind, amountMinor: toMinor(major, account.currency), categoryId: categoryId || undefined, occurredAt, note: note || undefined, fxRate: fx ? Number(fx) : undefined, clientId: crypto.randomUUID(), tagIds } }));
  }, invalidateLedger, editing ? (transfer ? "Transfer updated" : "Transaction updated") : "Transaction added");
  const del = useMutate(() => call(client.DELETE("/transactions/{id}", { params: { path: { id: tx!.id } } })), invalidateLedger, transfer ? "Transfer deleted" : "Transaction deleted");

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    let saved;
    try { saved = await save.mutateAsync(undefined as never); } catch (err) { setError(err instanceof Error ? err.message : "Failed"); return; }
    // Files picked before the transaction existed are uploaded now that it has an id.
    if (!editing && files.length && saved && "data" in saved) {
      for (const f of files) await uploadAttachment(saved.data.id, f).catch((e) => toast.error(`${f.name}: ${e instanceof Error ? e.message : "upload failed"}`));
      void qc.invalidateQueries({ queryKey: ["transactions"] }); // the list was refreshed before the uploads: show the paperclip count
    }
    onClose();
  }
  async function remove() {
    if (!(await confirm({ message: transfer ? "Delete this transfer (both sides)?" : "Delete this transaction?", destructive: true }))) return;
    try { await del.mutateAsync(undefined as never); onClose(); } catch (err) { setError(err instanceof Error ? err.message : "Failed"); }
  }

  return (
    <Modal open={open} onClose={onClose} title={editing ? (transfer ? "Edit transfer" : "Edit transaction") : "Add transaction"}>
      <form onSubmit={submit} className="space-y-3">
        {!editing && <Segmented value={kind} onChange={(k) => { setKind(k); setCategoryId(""); }} options={[{ value: "expense", label: "Expense", tone: "expense" }, { value: "income", label: "Income", tone: "income" }]} />}
        {!transfer && (
          <Field label={`Amount${account ? ` (${account.currency})` : ""}`}>
            <Input inputMode="decimal" type="number" step={minorUnit(account?.currency ?? "THB") === 0 ? "1" : "0.01"} min="0" required value={amount} onChange={(e) => setAmount(e.target.value)} autoFocus />
          </Field>
        )}
        {!editing && (
          <Field label="Account">
            <Select value={accountId} onChange={(e) => setAccountId(e.target.value)} required>
              {accounts.data?.filter((a) => !a.archived).map((a) => <option key={a.id} value={a.id}>{a.name} ({a.currency})</option>)}
            </Select>
          </Field>
        )}
        {foreign && <Field label={`FX rate ${account!.currency} → ${me!.baseCurrency}`} hint="Leave empty to use the stored daily rate"><Input type="number" step="any" min="0" value={fx} onChange={(e) => setFx(e.target.value)} /></Field>}
        {!transfer && (
          <Field label="Category">
            <Select value={categoryId} onChange={(e) => setCategoryId(e.target.value)}>
              <option value="">Uncategorised</option>
              {cats.map((c) => <option key={c.id} value={c.id}>{c.icon ? `${c.icon} ` : ""}{c.name}</option>)}
            </Select>
          </Field>
        )}
        <Field label="Date & time"><Input type="datetime-local" required value={when} onChange={(e) => setWhen(e.target.value)} /></Field>
        <Field label="Note"><Input maxLength={500} value={note} onChange={(e) => setNote(e.target.value)} placeholder="Optional" /></Field>
        <div className="space-y-1"><span className="text-xs font-medium text-muted">Tags</span><TagPicker value={tagIds} onChange={setTagIds} /></div>
        <div className="space-y-1">
          <span className="text-xs font-medium text-muted">Receipts</span>
          {editing ? <AttachmentsPanel transactionId={tx!.id} /> : <PendingAttachments files={files} onChange={setFiles} />}
        </div>
        {error && <ErrorNote error={new Error(error)} />}
        <div className="flex items-center justify-between pt-2">
          {editing ? <Button type="button" variant="danger" onClick={remove} loading={del.isPending}>Delete</Button> : <span />}
          <div className="flex gap-2">
            <Button type="button" variant="ghost" onClick={onClose}>Cancel</Button>
            <Button type="submit" loading={save.isPending}>{save.isPending ? "Saving…" : "Save"}</Button>
          </div>
        </div>
      </form>
    </Modal>
  );
}
