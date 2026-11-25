"use client";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useEffect, useRef, useState, type ReactNode } from "react";
import { publicAuth } from "@/lib/api/client";
import { Button, Card, Field, Input } from "./ui";
import { Wordmark } from "./brand";

const Shell = ({ title, subtitle, children }: { title: string; subtitle?: string; children: ReactNode }) => (
  <main className="grid min-h-screen place-items-center p-4">
    <Card className="w-full max-w-sm space-y-4 p-6">
      <Wordmark height={26} />
      <div><h1 className="text-xl font-semibold">{title}</h1>{subtitle && <p className="text-sm text-muted">{subtitle}</p>}</div>
      {children}
    </Card>
  </main>
);
const msg = (e: unknown) => (e instanceof Error ? e.message : "Something went wrong");

/** Tokens arrive in the URL; take them out of the address bar (and so out of history/Referer) as soon as we have read them. */
function useUrlToken() {
  const params = useSearchParams();
  const [token] = useState(() => params.get("token") ?? "");
  useEffect(() => { if (token) window.history.replaceState(null, "", window.location.pathname); }, [token]);
  return token;
}

export function ForgotPasswordForm() {
  const [sent, setSent] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  async function submit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault(); setError(null); setBusy(true);
    const email = String(new FormData(e.currentTarget).get("email") ?? "");
    try { await publicAuth("forgot-password", { email }); setSent(email); } catch (err) { setError(msg(err)); } finally { setBusy(false); }
  }
  if (sent) return (
    <Shell title="Check your email">
      <p className="text-sm">If an account exists for <strong>{sent}</strong>, we&apos;ve sent a link to reset its password. It works once and expires in 1 hour.</p>
      <p className="text-sm text-muted">Nothing arrived? Check spam, or try again in a minute.</p>
      <Link href="/login" className="block text-center text-sm text-primary underline">Back to sign in</Link>
    </Shell>
  );
  return (
    <Shell title="Forgot your password?" subtitle="Enter your email and we'll send you a reset link.">
      <form onSubmit={submit} className="space-y-3">
        <Field label="Email"><Input name="email" type="email" required autoComplete="email" autoFocus /></Field>
        {error && <p role="alert" className="text-sm text-expense">{error}</p>}
        <Button type="submit" loading={busy} className="w-full">{busy ? "Sending…" : "Send reset link"}</Button>
      </form>
      <Link href="/login" className="block text-center text-sm text-primary underline">Back to sign in</Link>
    </Shell>
  );
}

export function ResetPasswordForm() {
  const token = useUrlToken();
  const router = useRouter();
  const [done, setDone] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  async function submit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault(); setError(null);
    const f = new FormData(e.currentTarget);
    const password = String(f.get("password")), confirmPw = String(f.get("confirm"));
    if (password !== confirmPw) { setError("The two passwords don't match"); return; }
    setBusy(true);
    try {
      await publicAuth("reset-password", { token, password });
      await fetch("/api/auth/logout", { method: "POST" }).catch(() => null); // every session was revoked server-side; drop this browser's too
      setDone(true);
    } catch (err) { setError(msg(err)); } finally { setBusy(false); }
  }
  if (!token) return <Shell title="Link incomplete"><p className="text-sm">This reset link is missing its token. Open the link from the email again, or request a new one.</p><Link href="/forgot-password" className="block text-center text-sm text-primary underline">Request a new link</Link></Shell>;
  if (done) return (
    <Shell title="Password changed">
      <p className="text-sm">Your password has been reset and every device was signed out. Sign in with your new password.</p>
      <Button className="w-full" onClick={() => router.replace("/login")}>Sign in</Button>
    </Shell>
  );
  return (
    <Shell title="Choose a new password">
      <form onSubmit={submit} className="space-y-3">
        <Field label="New password" hint="At least 8 characters"><Input name="password" type="password" required minLength={8} maxLength={128} autoComplete="new-password" autoFocus /></Field>
        <Field label="Repeat new password"><Input name="confirm" type="password" required minLength={8} maxLength={128} autoComplete="new-password" /></Field>
        {error && <p role="alert" className="text-sm text-expense">{error}</p>}
        <Button type="submit" loading={busy} className="w-full">{busy ? "Saving…" : "Reset password"}</Button>
      </form>
      {error && /expired|invalid/i.test(error) && <Link href="/forgot-password" className="block text-center text-sm text-primary underline">Request a new link</Link>}
    </Shell>
  );
}

export function VerifyEmail() {
  const token = useUrlToken();
  const [state, setState] = useState<"working" | "ok" | "error">(token ? "working" : "error");
  const [error, setError] = useState(token ? "" : "This verification link is missing its token.");
  const ran = useRef(false);
  useEffect(() => {
    if (!token || ran.current) return; // the token is single-use: never send it twice (Strict Mode double effects)
    ran.current = true;
    publicAuth("verify-email", { token }).then(() => setState("ok"), (e) => { setError(msg(e)); setState("error"); });
  }, [token]);
  return (
    <Shell title={state === "ok" ? "Email confirmed" : state === "working" ? "Confirming…" : "Couldn't confirm your email"}>
      {state === "working" && <p className="text-sm text-muted" role="status">One moment…</p>}
      {state === "ok" && <p className="text-sm">Thanks — your email address is confirmed.</p>}
      {state === "error" && <p role="alert" className="text-sm text-expense">{error}</p>}
      {state !== "working" && <Link href="/" className="block text-center text-sm text-primary underline">Go to MoneyMgr</Link>}
    </Shell>
  );
}
