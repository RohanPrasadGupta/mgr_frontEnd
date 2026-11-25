"use client";
import CheckCircleRounded from "@mui/icons-material/CheckCircleRounded";
import CloseRounded from "@mui/icons-material/CloseRounded";
import RadioButtonUncheckedRounded from "@mui/icons-material/RadioButtonUncheckedRounded";
import Link from "next/link";
import { useState, type ReactNode } from "react";
import { call, client } from "@/lib/api/client";
import { useAccounts, useBudgetStatus, useGoals, useLatestTransaction, useMe, useMutate } from "@/lib/api/hooks";
import { TransactionForm } from "./transaction-form";
import { Button, Card, cx } from "./ui";

const KEY = (userId: string) => `mm_get_started_hidden_${userId}`;
const isHidden = (userId: string) => { try { return localStorage.getItem(KEY(userId)) === "1"; } catch { return false; } };

interface Step { id: string; title: string; why: string; done: boolean; action: ReactNode }

/**
 * First-run checklist on the dashboard. Every step is derived from the user's real data (no separate "onboarding state"),
 * so it ticks itself off however the user gets there, and disappears once everything is done or the user hides it.
 */
export function GetStarted() {
  const { data: me } = useMe();
  const accounts = useAccounts();
  const latest = useLatestTransaction();
  const budgets = useBudgetStatus();
  const goals = useGoals();
  const [adding, setAdding] = useState(false);
  const [hidden, setHidden] = useState(() => (typeof window !== "undefined" && me ? isHidden(me.id) : false));
  const resend = useMutate(() => call(client.POST("/me/resend-verification")), async () => {}, "Verification email sent — check your inbox");

  const loaded = me && accounts.data && latest.data !== undefined && budgets.data && goals.data;
  if (!loaded || hidden || isHidden(me.id)) return null;

  const hasAccount = accounts.data.some((a) => !a.archived);
  const steps: Step[] = [
    { id: "account", title: "Add an account", why: "Cash, a bank account or a card — balances are tracked per account.", done: hasAccount,
      action: <Link href="/accounts" className="text-sm font-medium text-primary underline">Add account</Link> },
    { id: "transaction", title: "Record your first transaction", why: "Or bring in your history from a spreadsheet export.", done: !!latest.data,
      action: <span className="flex flex-wrap gap-3"><button type="button" onClick={() => setAdding(true)} disabled={!hasAccount} className="text-sm font-medium text-primary underline disabled:no-underline disabled:opacity-50">Add transaction</button><Link href="/import" className="text-sm font-medium text-primary underline">Import a spreadsheet</Link></span> },
    { id: "budget", title: "Set a monthly budget", why: "Get warned before you overspend a category.", done: budgets.data.items.length > 0,
      action: <Link href="/budgets" className="text-sm font-medium text-primary underline">Create budget</Link> },
    { id: "goal", title: "Add a savings goal", why: "A trip, a laptop or an emergency fund — see how much to save each month.", done: goals.data.length > 0,
      action: <Link href="/goals" className="text-sm font-medium text-primary underline">Add goal</Link> },
    { id: "email", title: "Confirm your email", why: "So you can reset your password if you forget it.", done: me.emailVerified,
      action: <button type="button" onClick={() => resend.mutate(undefined as never)} disabled={resend.isPending || resend.isSuccess} className="text-sm font-medium text-primary underline disabled:no-underline disabled:opacity-60">{resend.isSuccess ? "Email sent" : "Resend email"}</button> },
  ];
  const done = steps.filter((s) => s.done).length;
  if (done === steps.length) return null;
  const hide = () => { try { localStorage.setItem(KEY(me.id), "1"); } catch { /* storage blocked: hide for this visit */ } setHidden(true); };

  return (
    <Card className="anim-rise space-y-3" aria-labelledby="get-started-title">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h2 id="get-started-title" className="text-base font-semibold">Get started{me.name ? `, ${me.name.split(" ")[0]}` : ""}</h2>
          <p className="text-sm text-muted">{done} of {steps.length} done — a few minutes to set things up.</p>
        </div>
        <button type="button" onClick={hide} aria-label="Hide the get started checklist" className="grid size-8 shrink-0 place-items-center rounded-lg text-muted hover:bg-border/50 hover:text-fg"><CloseRounded fontSize="small" /></button>
      </div>
      <div className="h-1.5 overflow-hidden rounded-full bg-border" role="progressbar" aria-valuemin={0} aria-valuemax={steps.length} aria-valuenow={done} aria-label="Setup progress">
        <div className="bar-fill h-full rounded-full bg-primary" style={{ width: `${(done / steps.length) * 100}%` }} />
      </div>
      <ol className="stagger divide-y divide-border">
        {steps.map((s) => (
          <li key={s.id} className="flex items-start gap-3 py-2.5">
            {s.done ? <CheckCircleRounded className="mt-0.5 text-income" fontSize="small" aria-hidden /> : <RadioButtonUncheckedRounded className="mt-0.5 text-muted" fontSize="small" aria-hidden />}
            <div className="min-w-0 flex-1">
              <p className={cx("text-sm font-medium", s.done && "text-muted line-through")}>{s.title}<span className="sr-only">{s.done ? " (done)" : ""}</span></p>
              {!s.done && <p className="text-xs text-muted">{s.why}</p>}
            </div>
            {!s.done && <div className="shrink-0">{s.action}</div>}
          </li>
        ))}
      </ol>
      {done === 0 && <p className="text-xs text-muted">Tip: <Link href="/import" className="underline">importing your Money Manager export</Link> creates the accounts and categories for you.</p>}
      <div className="flex justify-end"><Button variant="plain" className="text-xs text-muted" onClick={hide}>I&apos;ll do this later</Button></div>
      <TransactionForm open={adding} onClose={() => setAdding(false)} />
    </Card>
  );
}
