"use client";
import { useQueryClient } from "@tanstack/react-query";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { call, client } from "@/lib/api/client";
import { Button, Card, ErrorNote, Field, Input, Modal } from "./ui";

const CONFIRM_WORD = "DELETE";

export function DeleteAccountCard() {
  const router = useRouter();
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);
  const [password, setPassword] = useState("");
  const [typed, setTyped] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  function close() { setOpen(false); setPassword(""); setTyped(""); setError(null); }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (typed !== CONFIRM_WORD) return;
    setError(null); setBusy(true);
    try {
      await call(client.DELETE("/me", { body: { password } }));
      await fetch("/api/auth/logout", { method: "POST" }).catch(() => null); // clears the session cookies
      qc.clear(); // nothing of the old account may linger in memory
      router.replace("/login");
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not delete the account");
      setBusy(false);
    }
  }

  return (
    <Card className="border-expense/40">
      <h2 className="text-sm font-semibold text-expense">Delete account</h2>
      <p className="mt-1 text-sm text-muted">
        Permanently erases your account and everything in it — transactions, accounts, categories, budgets, recurring rules and investments. This cannot be undone.{" "}
        <Link href="/import" className="text-primary underline">Download your transactions first</Link>.
      </p>
      <Button variant="danger" className="mt-3" onClick={() => setOpen(true)}>Delete my account…</Button>

      <Modal open={open} onClose={close} title="Delete your account?">
        <form onSubmit={submit} className="space-y-3">
          <p className="text-sm">All of your data will be permanently deleted immediately. We cannot recover it afterwards.</p>
          <Field label="Your password"><Input type="password" required autoComplete="current-password" value={password} onChange={(e) => setPassword(e.target.value)} autoFocus /></Field>
          <Field label={`Type ${CONFIRM_WORD} to confirm`}><Input value={typed} onChange={(e) => setTyped(e.target.value)} autoComplete="off" /></Field>
          {error && <ErrorNote error={new Error(error)} />}
          <div className="flex justify-end gap-2 pt-2">
            <Button type="button" variant="ghost" onClick={close}>Cancel</Button>
            <Button type="submit" variant="danger" disabled={busy || !password || typed !== CONFIRM_WORD}>{busy ? "Deleting…" : "Delete everything"}</Button>
          </div>
        </form>
      </Modal>
    </Card>
  );
}
