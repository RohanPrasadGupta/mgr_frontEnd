"use client";
import { useEffect, useRef, type ButtonHTMLAttributes, type InputHTMLAttributes, type ReactNode, type SelectHTMLAttributes } from "react";

export const cx = (...c: (string | false | null | undefined)[]) => c.filter(Boolean).join(" ");

const btn = "inline-flex items-center justify-center gap-2 rounded-lg px-3.5 py-2 text-sm font-medium transition disabled:opacity-50 disabled:pointer-events-none";
const variants = {
  primary: "bg-primary text-primary-fg hover:opacity-90",
  ghost: "border border-border bg-card hover:bg-border/40",
  danger: "bg-expense text-white hover:opacity-90",
  plain: "hover:bg-border/50",
} as const;
export function Button({ variant = "primary", className, ...p }: ButtonHTMLAttributes<HTMLButtonElement> & { variant?: keyof typeof variants }) {
  return <button {...p} className={cx(btn, variants[variant], className)} />;
}

export const Card = ({ className, ...p }: React.HTMLAttributes<HTMLDivElement>) => <div {...p} className={cx("rounded-2xl border border-border bg-card p-4 shadow-sm", className)} />;

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
          className={cx("rounded-md px-3 py-1.5 text-sm font-medium transition", value === o.value ? (o.tone === "income" ? "bg-income text-white" : o.tone === "expense" ? "bg-expense text-white" : "bg-primary text-primary-fg") : "text-muted hover:text-fg")}>
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

export const Skeleton = ({ className }: { className?: string }) => <div className={cx("animate-pulse rounded-lg bg-border/60", className)} />;
export const ErrorNote = ({ error, retry }: { error: unknown; retry?: () => void }) => (
  <div role="alert" className="rounded-xl border border-expense/40 bg-expense/10 p-3 text-sm text-expense">
    {error instanceof Error ? error.message : "Something went wrong"}
    {retry && <button onClick={retry} className="ml-3 underline">Retry</button>}
  </div>
);
export const Empty = ({ children }: { children: ReactNode }) => <div className="rounded-xl border border-dashed border-border p-8 text-center text-sm text-muted">{children}</div>;
