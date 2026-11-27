"use client";
import { useState } from "react";
import { call, client } from "@/lib/api/client";
import { qk, useAccounts, useMe, useMutate } from "@/lib/api/hooks";
import type { Account, AccountType, Body } from "@/lib/api/types";
import { formatMoney, toMinor } from "@/lib/money";
import { TransferDialog } from "./transfer-dialog";
import { Button, Card, Empty, ErrorNote, Field, Input, ListSkeleton, Modal, Select, cx } from "./ui";
import { useConfirm } from "./feedback";
import { CurrencySelect } from "./currency-options";

const TYPES: AccountType[] = ["cash", "bank", "wallet", "card", "loan", "investment"];
const refresh = (qc: import("@tanstack/react-query").QueryClient) => qc.invalidateQueries({ queryKey: qk.accounts });

export function AccountsView() {
  const confirm = useConfirm();
  const accounts = useAccounts();
  const { data: me } = useMe();
  const [open, setOpen] = useState(false);
  const [transferFrom, setTransferFrom] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const [type, setType] = useState<AccountType>("bank");

  const create = useMutate((body: Body<"/accounts", "post">) => call(client.POST("/accounts", { body })), async (qc) => { await refresh(qc); await qc.invalidateQueries({ queryKey: qk.me }); }, "Account added");
  const update = useMutate(({ id, body }: { id: string; body: Body<"/accounts/{id}", "patch"> }) => call(client.PATCH("/accounts/{id}", { params: { path: { id } }, body })), refresh, "Account updated");
  const remove = useMutate((id: string) => call(client.DELETE("/accounts/{id}", { params: { path: { id } } })), refresh, "Account deleted");

  async function submit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);
    const f = new FormData(e.currentTarget);
    const currency = String(f.get("currency"));
    try {
      await create.mutateAsync({ name: String(f.get("name")).trim(), type, currency, openingBalanceMinor: toMinor(Number(f.get("opening") || 0), currency) });
      setOpen(false);
    } catch (err) { setError(err instanceof Error ? err.message : "Failed"); }
  }
  async function act(fn: () => Promise<unknown>) { setActionError(null); try { await fn(); } catch (err) { setActionError(err instanceof Error ? err.message : "Something went wrong"); } }

  const visible = accounts.data ?? [];
  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold">Accounts</h1>
        <div className="flex gap-2">
          <Button variant="ghost" onClick={() => setTransferFrom("")}>⇄ Transfer</Button>
          <Button onClick={() => { setError(null); setType("bank"); setOpen(true); }}>+ Add account</Button>
        </div>
      </div>
      {actionError && <ErrorNote error={new Error(actionError)} />}
      {accounts.isPending ? <ListSkeleton rows={4} /> : accounts.error ? <ErrorNote error={accounts.error} retry={() => accounts.refetch()} /> : visible.length === 0 ? <Empty>No accounts yet.</Empty> : (
        <div className="stagger grid gap-3 sm:grid-cols-2">
          {visible.map((a: Account) => (
            <Card key={a.id} className={cx(a.archived && "opacity-60")}>
              <div className="flex items-start justify-between">
                <div><div className="font-medium">{a.name}</div><div className="text-xs capitalize text-muted">{a.type} · {a.currency}{a.archived && " · archived"}</div></div>
                <div className={cx("text-lg font-semibold tabular-nums", a.balanceMinor < 0 && "text-expense")}>{formatMoney(a.balanceMinor, a.currency)}</div>
              </div>
              <div className="mt-3 flex gap-3 text-xs text-muted">
                {!a.archived && <button className="underline" onClick={() => setTransferFrom(a.id)}>Transfer</button>}
                <button className="underline" onClick={() => act(() => update.mutateAsync({ id: a.id, body: { archived: !a.archived } }))}>{a.archived ? "Unarchive" : "Archive"}</button>
                <button className="underline hover:text-expense" onClick={async () => (await confirm({ message: `Delete "${a.name}"? Accounts with transactions can only be archived.`, destructive: true })) && act(() => remove.mutateAsync(a.id))}>Delete</button>
              </div>
            </Card>
          ))}
        </div>
      )}
      <TransferDialog open={transferFrom !== null} defaultFrom={transferFrom || undefined} onClose={() => setTransferFrom(null)} />
      <Modal open={open} onClose={() => setOpen(false)} title="Add account">
        <form onSubmit={submit} className="space-y-3">
          <Field label="Name"><Input name="name" required maxLength={60} autoFocus /></Field>
          <Field label="Type"><Select value={type} onChange={(e) => setType(e.target.value as AccountType)}>{TYPES.map((t) => <option key={t} value={t} className="capitalize">{t}</option>)}</Select></Field>
          <Field label="Currency"><CurrencySelect name="currency" defaultValue={me?.baseCurrency ?? "THB"} current={me?.baseCurrency} names /></Field>
          <Field label="Opening balance"><Input name="opening" type="number" step="0.01" defaultValue="0" /></Field>
          {error && <ErrorNote error={new Error(error)} />}
          <div className="flex justify-end gap-2 pt-2"><Button type="button" variant="ghost" onClick={() => setOpen(false)}>Cancel</Button><Button type="submit" loading={create.isPending}>Add</Button></div>
        </form>
      </Modal>
    </div>
  );
}
