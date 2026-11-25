"use client";
import { useState } from "react";
import { authCall, call, client } from "@/lib/api/client";
import { useMe, useMutate } from "@/lib/api/hooks";
import { Button, Card, ErrorNote, Field, Input } from "./ui";

export function ChangePasswordCard() {
  const { data: me } = useMe();
  const [error, setError] = useState<string | null>(null);
  const [formKey, setFormKey] = useState(0);
  const save = useMutate((b: { currentPassword: string; newPassword: string }) => call(client.POST("/me/password", { body: b })), async () => {}, "Password changed. Other devices were signed out.");

  async function submit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault(); setError(null);
    const f = new FormData(e.currentTarget);
    const currentPassword = String(f.get("current")), newPassword = String(f.get("next"));
    if (newPassword !== String(f.get("repeat"))) { setError("The new passwords don't match"); return; }
    try {
      await save.mutateAsync({ currentPassword, newPassword });
      // The change revokes every session, this one included: sign straight back in so this tab keeps working.
      if (me) await authCall("login", { email: me.email, password: newPassword }).catch(() => window.location.assign("/login"));
      setFormKey((k) => k + 1);
    } catch (err) { setError(err instanceof Error ? err.message : "Failed"); }
  }
  return (
    <Card>
      <h2 className="mb-3 text-sm font-semibold">Password</h2>
      <form key={formKey} onSubmit={submit} className="grid gap-3 sm:grid-cols-3">
        <Field label="Current password"><Input name="current" type="password" required autoComplete="current-password" /></Field>
        <Field label="New password" hint="At least 8 characters"><Input name="next" type="password" required minLength={8} maxLength={128} autoComplete="new-password" /></Field>
        <Field label="Repeat new password"><Input name="repeat" type="password" required minLength={8} maxLength={128} autoComplete="new-password" /></Field>
        {error && <div className="sm:col-span-3"><ErrorNote error={new Error(error)} /></div>}
        <div className="sm:col-span-3"><Button type="submit" loading={save.isPending}>{save.isPending ? "Saving…" : "Change password"}</Button></div>
      </form>
    </Card>
  );
}
