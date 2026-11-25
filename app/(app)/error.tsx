"use client";
import { useEffect } from "react";

// Catches a crash inside any signed-in page while keeping the navigation shell usable.
export default function AppError({ error, retry }: { error: unknown; retry: () => void }) {
  useEffect(() => { console.error(error); }, [error]);
  return (
    <div role="alert" className="mx-auto max-w-md space-y-3 rounded-2xl border border-border bg-card p-6 text-center">
      <h1 className="text-lg font-semibold">This page hit a problem</h1>
      <p className="text-sm text-muted">Something unexpected happened. Nothing was lost — you can try again or use the menu to go elsewhere.</p>
      <button onClick={() => retry()} className="rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-fg">Try again</button>
    </div>
  );
}
