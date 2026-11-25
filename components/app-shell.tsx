"use client";
import AccountBalanceWalletOutlined from "@mui/icons-material/AccountBalanceWalletOutlined";
import AddRounded from "@mui/icons-material/AddRounded";
import AutorenewRounded from "@mui/icons-material/AutorenewRounded";
import AssessmentOutlined from "@mui/icons-material/AssessmentOutlined";
import FlagOutlined from "@mui/icons-material/FlagOutlined";
import HandshakeOutlined from "@mui/icons-material/HandshakeOutlined";
import StickyNote2Outlined from "@mui/icons-material/StickyNote2Outlined";
import CategoryOutlined from "@mui/icons-material/CategoryOutlined";
import DashboardOutlined from "@mui/icons-material/DashboardOutlined";
import DonutSmallOutlined from "@mui/icons-material/DonutSmallOutlined";
import LogoutRounded from "@mui/icons-material/LogoutRounded";
import MenuOpenRounded from "@mui/icons-material/MenuOpenRounded";
import MenuRounded from "@mui/icons-material/MenuRounded";
import SettingsOutlined from "@mui/icons-material/SettingsOutlined";
import SwapHorizRounded from "@mui/icons-material/SwapHorizRounded";
import SwapVertRounded from "@mui/icons-material/SwapVertRounded";
import TrendingUpRounded from "@mui/icons-material/TrendingUpRounded";
import UploadFileOutlined from "@mui/icons-material/UploadFileOutlined";
import Drawer from "@mui/material/Drawer";
import SpeedDial from "@mui/material/SpeedDial";
import SpeedDialAction from "@mui/material/SpeedDialAction";
import SpeedDialIcon from "@mui/material/SpeedDialIcon";
import Tooltip from "@mui/material/Tooltip";
import Link, { useLinkStatus } from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useState, useSyncExternalStore, type ReactNode } from "react";
import { useMe } from "@/lib/api/hooks";
import { useOnline } from "@/lib/use-online";
import { TransactionForm } from "./transaction-form";
import { TransferDialog } from "./transfer-dialog";
import { VerifyBanner } from "./verify-banner";
import { ActivityBar } from "./activity-bar";
import { Spinner, cx } from "./ui";
import { Mark, Wordmark } from "./brand";

const NAV = [
  { href: "/", label: "Dashboard", icon: DashboardOutlined },
  { href: "/transactions", label: "Transactions", icon: SwapVertRounded },
  { href: "/transfers", label: "Transfers", icon: SwapHorizRounded },
  { href: "/budgets", label: "Budgets", icon: DonutSmallOutlined },
  { href: "/investments", label: "Investments", icon: TrendingUpRounded },
  { href: "/goals", label: "Goals", icon: FlagOutlined },
  { href: "/debts", label: "Debts", icon: HandshakeOutlined },
  { href: "/reports", label: "Reports", icon: AssessmentOutlined },
  { href: "/recurring", label: "Recurring", icon: AutorenewRounded },
  { href: "/accounts", label: "Accounts", icon: AccountBalanceWalletOutlined },
  { href: "/categories", label: "Categories & tags", icon: CategoryOutlined },
  { href: "/notes", label: "Notes", icon: StickyNote2Outlined },
  { href: "/import", label: "Import & export", icon: UploadFileOutlined },
  { href: "/settings", label: "Settings", icon: SettingsOutlined },
] as const;

const QUICK = ["/", "/transactions", "/budgets", "/investments"];
const STORE = "mm_nav";
const navListeners = new Set<() => void>();
const subscribeNav = (l: () => void) => { navListeners.add(l); return () => { navListeners.delete(l); }; };
const readNav = () => { try { return localStorage.getItem(STORE) === "1"; } catch { return false; } };
const writeNav = (v: boolean) => { try { localStorage.setItem(STORE, v ? "1" : "0"); } catch { /* storage blocked */ } navListeners.forEach((l) => l()); };

/** The clicked link's icon turns into a spinner until the new page is ready, so a slow route never looks ignored. */
function NavIcon({ icon: Icon }: { icon: (typeof NAV)[number]["icon"] }) {
  const { pending } = useLinkStatus();
  return pending ? <Spinner className="size-5" /> : <Icon fontSize="small" aria-hidden />;
}

function NavLinks({ active, collapsed, onNavigate }: { active: (h: string) => boolean; collapsed?: boolean; onNavigate?: () => void }) {
  return (
    <nav className="flex-1 space-y-1 overflow-y-auto px-3 py-2" aria-label="Main">
      {NAV.map(({ href, label, icon: Icon }) => {
        const on = active(href);
        const link = (
          <Link key={href} href={href} onClick={onNavigate} aria-current={on ? "page" : undefined} aria-label={collapsed ? label : undefined}
            className={cx("relative flex items-center gap-3 rounded-xl py-2.5 text-sm font-medium transition-colors duration-200 active:scale-[0.98]", collapsed ? "justify-center px-0" : "px-3",
              on ? "bg-primary/12 text-primary before:absolute before:inset-y-1.5 before:left-0 before:w-1 before:rounded-full before:bg-primary" : "text-muted hover:bg-border/50 hover:text-fg")}>
            <NavIcon icon={Icon} />{!collapsed && <span className="anim-fade truncate">{label}</span>}
          </Link>
        );
        return collapsed ? <Tooltip key={href} title={label} placement="right" arrow>{link}</Tooltip> : link;
      })}
    </nav>
  );
}

function UserBar({ compact, name, email, onLogout }: { compact: boolean; name?: string; email?: string; onLogout: () => void }) {
  const initials = (name ?? "").split(/\s+/).map((w) => w[0]).slice(0, 2).join("").toUpperCase() || "·";
  return (
    <div className={cx("border-t border-border p-3", compact ? "flex flex-col items-center gap-2" : "")}>
      <div className={cx("flex items-center gap-3", compact && "flex-col gap-2")}>
        <span aria-hidden className="grid size-9 shrink-0 place-items-center rounded-full bg-primary/15 text-xs font-semibold text-primary">{initials}</span>
        {!compact && <div className="min-w-0 flex-1 text-sm"><div className="truncate font-medium">{name ?? " "}</div><div className="truncate text-xs text-muted">{email}</div></div>}
        <Tooltip title="Sign out" placement={compact ? "right" : "top"}>
          <button type="button" onClick={onLogout} aria-label="Sign out" className="grid size-8 shrink-0 place-items-center rounded-lg text-muted hover:bg-border/50 hover:text-expense"><LogoutRounded fontSize="small" /></button>
        </Tooltip>
      </div>
    </div>
  );
}

export function AppShell({ children }: { children: ReactNode }) {
  const path = usePathname();
  const router = useRouter();
  const { data: me } = useMe();
  const online = useOnline();
  const active = (href: string) => (href === "/" ? path === "/" : path.startsWith(href));

  // The saved sidebar width lives in localStorage; the server snapshot is "expanded" so hydration matches.
  const collapsed = useSyncExternalStore(subscribeNav, () => readNav(), () => false);
  const [drawer, setDrawer] = useState(false);
  const [adding, setAdding] = useState(false);
  const [transferring, setTransferring] = useState(false);
  // Navigating closes the mobile drawer.
  const [drawerPath, setDrawerPath] = useState(path);
  if (drawerPath !== path) { setDrawerPath(path); setDrawer(false); }
  const toggle = () => writeNav(!collapsed);

  async function logout() {
    await fetch("/api/auth/logout", { method: "POST" });
    router.replace("/login");
    router.refresh();
  }

  const quick = [
    { icon: <AddRounded />, name: "Add transaction", run: () => setAdding(true) },
    { icon: <SwapHorizRounded />, name: "New transfer", run: () => setTransferring(true) },
    ...NAV.filter((n) => QUICK.includes(n.href)).map((n) => ({ icon: <n.icon />, name: n.label, run: () => router.push(n.href) })).reverse(),
    { icon: <MenuRounded />, name: "All pages", run: () => setDrawer(true) },
  ];

  return (
    <div className="flex min-h-screen">
      <ActivityBar />
      {/* Desktop/tablet: sticky sidebar that stays put while the page scrolls; the burger toggles icons-only ↔ icons + labels. */}
      <aside className={cx("sticky top-0 hidden h-screen print:!hidden shrink-0 flex-col border-r border-border bg-card transition-[width] duration-300 ease-[cubic-bezier(0.2,0.8,0.2,1)] md:flex", collapsed ? "w-[4.5rem]" : "w-60")} data-collapsed={collapsed}>
        <div className={cx("flex items-center gap-2 px-3", collapsed ? "flex-col justify-center py-3" : "h-16 justify-between")}>
          <Link href="/" aria-label="MoneyMgr home" className={cx("anim-fade", !collapsed && "pl-2")}>{collapsed ? <Mark size={34} /> : <Wordmark height={26} priority />}</Link>
          <button type="button" onClick={toggle} aria-label={collapsed ? "Expand sidebar" : "Collapse sidebar"} aria-expanded={!collapsed}
            className="grid size-9 shrink-0 place-items-center rounded-lg text-muted hover:bg-border/50 hover:text-fg">{collapsed ? <MenuRounded /> : <MenuOpenRounded />}</button>
        </div>
        <NavLinks active={active} collapsed={collapsed} />
        <UserBar compact={collapsed} name={me?.name} email={me?.email} onLogout={logout} />
      </aside>

      <div className="min-w-0 flex-1 pb-24 md:pb-0">
        <header className="sticky top-0 z-30 flex print:hidden items-center gap-2 border-b border-border bg-card/95 px-3 py-2 backdrop-blur md:hidden">
          <button type="button" onClick={() => setDrawer(true)} aria-label="Open menu" className="grid size-9 place-items-center rounded-lg text-muted hover:bg-border/50"><MenuRounded /></button>
          <Link href="/" aria-label="MoneyMgr home"><Wordmark height={22} priority /></Link>
        </header>
        <VerifyBanner />
        {!online && <div role="status" className="anim-rise border-b border-warn/40 bg-warn/10 px-4 py-2 text-center text-sm text-warn">You’re offline — changes can’t be saved until your connection is back.</div>}
        <main className="mx-auto w-full max-w-6xl p-4 md:p-8 2xl:max-w-[88rem]">{children}</main>
      </div>

      <Drawer open={drawer} onClose={() => setDrawer(false)} sx={{ display: { md: "none" } }} slotProps={{ paper: { sx: { width: 280, maxWidth: "85vw" } } }}>
        <div className="flex h-14 items-center justify-between px-4">
          <Wordmark height={24} />
          <button type="button" onClick={() => setDrawer(false)} aria-label="Close menu" className="grid size-9 place-items-center rounded-lg text-muted hover:bg-border/50"><MenuOpenRounded /></button>
        </div>
        <NavLinks active={active} onNavigate={() => setDrawer(false)} />
        <UserBar compact={false} name={me?.name} email={me?.email} onLogout={logout} />
      </Drawer>

      {/* Phones/small tablets: one thumb-reachable speed dial, bottom-left, replaces the old bottom tab bar. */}
      <div className="md:hidden print:hidden">
        <SpeedDial ariaLabel="Quick actions" icon={<SpeedDialIcon />} direction="up" sx={{ position: "fixed", bottom: 16, left: 16 }}>
          {quick.map((a) => <SpeedDialAction key={a.name} icon={a.icon} onClick={a.run} slotProps={{ tooltip: { title: a.name, open: true, placement: "right" } }} />)}
        </SpeedDial>
      </div>

      <TransactionForm open={adding} onClose={() => setAdding(false)} />
      <TransferDialog open={transferring} onClose={() => setTransferring(false)} />
    </div>
  );
}
