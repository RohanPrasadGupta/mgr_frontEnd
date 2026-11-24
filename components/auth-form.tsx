"use client";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { authCall } from "@/lib/api/client";
import { Button, Card, Field, Input } from "./ui";

export function AuthForm({ mode }: { mode: "login" | "register" }) {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const register = mode === "register";

  async function submit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);
    setBusy(true);
    const f = new FormData(e.currentTarget);
    try {
      await authCall(mode, register
        ? { email: f.get("email"), password: f.get("password"), name: f.get("name"), baseCurrency: String(f.get("baseCurrency") || "THB").toUpperCase(), timezone: Intl.DateTimeFormat().resolvedOptions().timeZone }
        : { email: f.get("email"), password: f.get("password") });
      router.replace("/");
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed");
      setBusy(false);
    }
  }

  return (
    <main className="grid min-h-screen place-items-center p-4">
      <Card className="w-full max-w-sm space-y-4 p-6">
        <div>
          <h1 className="text-xl font-semibold">MoneyMgr</h1>
          <p className="text-sm text-muted">{register ? "Create your account" : "Sign in to continue"}</p>
        </div>
        <form onSubmit={submit} className="space-y-3">
          {register && <Field label="Name"><Input name="name" required maxLength={80} autoComplete="name" /></Field>}
          <Field label="Email"><Input name="email" type="email" required autoComplete="email" /></Field>
          <Field label="Password" hint={register ? "At least 8 characters" : undefined}><Input name="password" type="password" required minLength={register ? 8 : 1} autoComplete={register ? "new-password" : "current-password"} /></Field>
          {register && <Field label="Base currency" hint="All totals are shown in this currency"><Input name="baseCurrency" defaultValue="THB" maxLength={3} required className="uppercase" /></Field>}
          {error && <p role="alert" className="text-sm text-expense">{error}</p>}
          <Button type="submit" disabled={busy} className="w-full">{busy ? "Please wait…" : register ? "Create account" : "Sign in"}</Button>
        </form>
        <p className="text-center text-sm text-muted">
          {register ? "Have an account? " : "New here? "}
          <Link href={register ? "/login" : "/register"} className="text-primary underline">{register ? "Sign in" : "Create an account"}</Link>
        </p>
      </Card>
    </main>
  );
}
