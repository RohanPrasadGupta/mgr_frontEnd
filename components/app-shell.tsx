"use client";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useState, type ReactNode } from "react";
import { useMe } from "@/lib/api/hooks";
import { cx } from "./ui";

const NAV = [
  { href: "/", label: "Dashboard", short: "Home", icon: "▦" },
  { href: "/transactions", label: "Transactions", short: "Activity", icon: "⇅" },
  { href: "/transfers", label: "Transfers", short: "Transfers", icon: "⇄" },
  { href: "/budgets", label: "Budgets", short: "Budgets", icon: "◔" },
  { href: "/investments", label: "Investments", short: "Invest", icon: "↗" },
  { href: "/recurring", label: "Recurring", short: "Recurring", icon: "↻" },
  { href: "/accounts", label: "Accounts", short: "Accounts", icon: "▤" },
  { href: "/categories", label: "Categories", short: "Categories", icon: "◈" },
  { href: "/import", label: "Import & export", short: "Import", icon: "⇪" },
  { href: "/settings", label: "Settings", short: "Settings", icon: "⚙" },
];

const PRIMARY = ["/", "/transactions", "/budgets", "/investments"];
const MORE = NAV.filter((n) => !PRIMARY.includes(n.href));

export function AppShell({ children }: { children: ReactNode }) {
  const path = usePathname();
  const router = useRouter();
  const { data: me } = useMe();
  const active = (href: string) => (href === "/" ? path === "/" : path.startsWith(href));
  const [moreOpen, setMoreOpen] = useState(false);
  useEffect(() => setMoreOpen(false), [path]);
  const moreActive = MORE.some((n) => active(n.href));

  async function logout() {
    await fetch("/api/auth/logout", { method: "POST" });
    router.replace("/login");
    router.refresh();
  }

  return (
    <div className="min-h-screen md:grid md:grid-cols-[14rem_1fr]">
      <aside className="hidden border-r border-border bg-card p-4 md:flex md:flex-col">
        <div className="mb-6 px-2 text-lg font-semibold">MoneyMgr</div>
        <nav className="flex-1 space-y-1" aria-label="Main">
          {NAV.map((n) => (
            <Link key={n.href} href={n.href} aria-current={active(n.href) ? "page" : undefined}
              className={cx("flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium", active(n.href) ? "bg-primary/10 text-primary" : "text-muted hover:bg-border/50 hover:text-fg")}>
              <span aria-hidden className="w-4 text-center">{n.icon}</span>{n.label}
            </Link>
          ))}
        </nav>
        <div className="border-t border-border pt-3 text-sm">
          <div className="truncate font-medium">{me?.name ?? " "}</div>
          <div className="truncate text-xs text-muted">{me?.email}</div>
          <button onClick={logout} className="mt-2 text-xs text-muted underline hover:text-fg">Sign out</button>
        </div>
      </aside>
      <div className="min-w-0 pb-20 md:pb-0">
        <header className="flex items-center justify-between border-b border-border bg-card px-4 py-3 md:hidden">
          <span className="font-semibold">MoneyMgr</span>
          <button onClick={logout} className="text-xs text-muted underline">Sign out</button>
        </header>
        <main className="mx-auto w-full max-w-5xl p-4 md:p-8">{children}</main>
      </div>
      {moreOpen && (
        <div className="fixed inset-x-0 bottom-[3.75rem] z-10 border-t border-border bg-card p-2 shadow-lg md:hidden">
          {MORE.map((n) => (
            <Link key={n.href} href={n.href} aria-current={active(n.href) ? "page" : undefined}
              className={cx("flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium", active(n.href) ? "bg-primary/10 text-primary" : "text-fg")}>
              <span aria-hidden className="w-4 text-center">{n.icon}</span>{n.label}
            </Link>
          ))}
        </div>
      )}
      <nav aria-label="Main" className="fixed inset-x-0 bottom-0 z-20 grid grid-cols-5 border-t border-border bg-card md:hidden">
        {NAV.filter((n) => PRIMARY.includes(n.href)).map((n) => (
          <Link key={n.href} href={n.href} aria-current={active(n.href) ? "page" : undefined}
            className={cx("flex flex-col items-center gap-0.5 py-2 text-[10px] font-medium", active(n.href) ? "text-primary" : "text-muted")}>
            <span aria-hidden className="text-base">{n.icon}</span>{n.short}
          </Link>
        ))}
        <button type="button" aria-expanded={moreOpen} onClick={() => setMoreOpen((v) => !v)}
          className={cx("flex flex-col items-center gap-0.5 py-2 text-[10px] font-medium", moreActive || moreOpen ? "text-primary" : "text-muted")}>
          <span aria-hidden className="text-base">⋯</span>More
        </button>
      </nav>
    </div>
  );
}
