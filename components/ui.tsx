"use client";
import { useEffect, useRef, type ButtonHTMLAttributes, type InputHTMLAttributes, type ReactNode, type SelectHTMLAttributes } from "react";

export const cx = (...c: (string | false | null | undefined)[]) => c.filter(Boolean).join(" ");

const btn = "inline-flex items-center justify-center gap-2 rounded-lg px-3.5 py-2 text-sm font-medium transition duration-150 active:scale-[0.97] disabled:opacity-50 disabled:pointer-events-none";
const variants = {
  primary: "bg-primary text-primary-fg hover:opacity-90",
  ghost: "border border-border bg-card hover:bg-border/40",
  danger: "bg-expense text-white hover:opacity-90",
  plain: "hover:bg-border/50",
} as const;
/** `loading` disables the button, marks it busy and shows a spinner in front of its label. */
export function Button({ variant = "primary", className, loading, disabled, children, ...p }: ButtonHTMLAttributes<HTMLButtonElement> & { variant?: keyof typeof variants; loading?: boolean }) {
  return (
    <button {...p} disabled={disabled || loading} aria-busy={loading || undefined} className={cx(btn, variants[variant], className)}>
      {loading && <Spinner />}{children}
    </button>
  );
}

export const Spinner = ({ className }: { className?: string }) => (
  <svg aria-hidden viewBox="0 0 24 24" fill="none" className={cx("spinner size-4 shrink-0", className)}>
    <circle cx="12" cy="12" r="9" stroke="currentColor" strokeOpacity="0.25" strokeWidth="3" />
    <path d="M21 12a9 9 0 0 0-9-9" stroke="currentColor" strokeWidth="3" strokeLinecap="round" />
  </svg>
);

export const Card = ({ className, ...p }: React.HTMLAttributes<HTMLDivElement>) => <div {...p} className={cx("rounded-2xl border border-border bg-card p-4 shadow-sm transition-[box-shadow,border-color,opacity] duration-200", className)} />;

const field = "w-full rounded-lg border border-border bg-bg px-3 py-2 text-sm outline-none focus:border-primary focus:ring-2 focus:ring-[var(--ring)]";
export const Input = ({ className, ...p }: InputHTMLAttributes<HTMLInputElement>) => <input {...p} className={cx(field, className)} />;
export const Select = ({ className, ...p }: SelectHTMLAttributes<HTMLSelectElement>) => <select {...p} className={cx(field, className)} />;
export function Field({ label, hint, children }: { label: string; hint?: string; children: ReactNode }) {
  return (
    <label className="block space-y-1">
      <span className="text-xs font-medium text-muted">{label}</span>
      {children}
      {hint && <span className="block text-xs text-muted">{hint}</span>}
    </label>
  );
}

export function Segmented<T extends string>({ value, onChange, options }: { value: T; onChange: (v: T) => void; options: { value: T; label: string; tone?: "income" | "expense" }[] }) {
  return (
    <div role="radiogroup" className="inline-flex rounded-lg border border-border bg-bg p-0.5">
      {options.map((o) => (
        <button key={o.value} type="button" role="radio" aria-checked={value === o.value} onClick={() => onChange(o.value)}
          className={cx("rounded-md px-3 py-1.5 text-sm font-medium transition duration-200", value === o.value ? (o.tone === "income" ? "bg-income text-white" : o.tone === "expense" ? "bg-expense text-white" : "bg-primary text-primary-fg") : "text-muted hover:text-fg")}>
          {o.label}
        </button>
      ))}
    </div>
  );
}

export function Modal({ open, onClose, title, children }: { open: boolean; onClose: () => void; title: string; children: ReactNode }) {
  const ref = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    const d = ref.current;
    if (!d) return;
    if (open && !d.open) d.showModal();
    if (!open && d.open) d.close();
  }, [open]);
  return (
    <dialog ref={ref} onClose={onClose} onClick={(e) => e.target === ref.current && onClose()} aria-label={title}
      className="m-auto w-[min(32rem,calc(100vw-2rem))] rounded-2xl border border-border bg-card p-0 text-fg shadow-xl">
      {open && (
        <div className="p-5">
          <div className="mb-4 flex items-center justify-between">
            <h2 className="text-lg font-semibold">{title}</h2>
            <button type="button" onClick={onClose} aria-label="Close" className="rounded-md p-1 text-muted hover:bg-border/50">✕</button>
          </div>
          {children}
        </div>
      )}
    </dialog>
  );
}

export const Skeleton = ({ className }: { className?: string }) => <div aria-hidden className={cx("skeleton rounded-lg", className)} />;

/** Placeholder shaped like the list it stands in for (icon · two lines · amount), so the page doesn't jump when data lands. */
export function ListSkeleton({ rows = 5, className }: { rows?: number; className?: string }) {
  return (
    <div role="status" aria-label="Loading" className={cx("rounded-2xl border border-border bg-card p-3", className)}>
      {Array.from({ length: rows }, (_, i) => (
        <div key={i} className="flex items-center gap-3 px-1 py-2.5" style={{ opacity: 1 - i * (0.6 / rows) }}>
          <Skeleton className="size-9 rounded-full" />
          <div className="flex-1 space-y-1.5"><Skeleton className="h-3 w-2/5" /><Skeleton className="h-2.5 w-1/4" /></div>
          <Skeleton className="h-3.5 w-16" />
        </div>
      ))}
    </div>
  );
}

/** Placeholder for a grid of cards (goals, debts, notes, KPI rows). */
export function CardsSkeleton({ count = 3, className }: { count?: number; className?: string }) {
  return (
    <div role="status" aria-label="Loading" className={cx("grid gap-3 sm:grid-cols-2 lg:grid-cols-3", className)}>
      {Array.from({ length: count }, (_, i) => (
        <div key={i} className="space-y-3 rounded-2xl border border-border bg-card p-4">
          <Skeleton className="h-4 w-1/2" /><Skeleton className="h-6 w-1/3" /><Skeleton className="h-1.5 w-full rounded-full" />
        </div>
      ))}
    </div>
  );
}

/** Generic page placeholder: title row, a KPI strip and two panels. Used while a route's code or first data loads. */
export function PageSkeleton() {
  return (
    <div role="status" aria-label="Loading page" className="space-y-5">
      <div className="flex items-center justify-between"><Skeleton className="h-8 w-48" /><Skeleton className="h-9 w-40" /></div>
      <div className="grid grid-cols-2 gap-3 xl:grid-cols-4">{Array.from({ length: 4 }, (_, i) => <Skeleton key={i} className="h-24 rounded-2xl" />)}</div>
      <div className="grid gap-4 lg:grid-cols-2"><Skeleton className="h-64 rounded-2xl" /><Skeleton className="h-64 rounded-2xl" /></div>
    </div>
  );
}
export const ErrorNote = ({ error, retry }: { error: unknown; retry?: () => void }) => (
  <div role="alert" className="anim-rise rounded-xl border border-expense/40 bg-expense/10 p-3 text-sm text-expense">
    {error instanceof Error ? error.message : "Something went wrong"}
    {retry && <button onClick={retry} className="ml-3 underline">Retry</button>}
  </div>
);
export const Empty = ({ children }: { children: ReactNode }) => <div className="anim-fade rounded-xl border border-dashed border-border p-8 text-center text-sm text-muted">{children}</div>;

/** On/off switch (role="switch"): "use for average price", "repeat every month"… */
export function Switch({ checked, onChange, label, disabled }: { checked: boolean; onChange: (on: boolean) => void; label: string; disabled?: boolean }) {
  return (
    <button type="button" role="switch" aria-checked={checked} aria-label={label} title={label} disabled={disabled} onClick={() => onChange(!checked)}
      className={cx("relative inline-flex h-5 w-9 shrink-0 items-center rounded-full transition disabled:opacity-50", checked ? "bg-primary" : "bg-border")}>
      <span className={cx("inline-block size-4 rounded-full bg-card shadow transition", checked ? "translate-x-4.5" : "translate-x-0.5")} />
    </button>
  );
}

