"use client";
import Link from "next/link";
import { useEffect } from "react";

// Catches errors below the root layout (outside the signed-in shell, e.g. the login page).
export default function RootError({ error, retry }: { error: unknown; retry: () => void }) {
  useEffect(() => { console.error(error); }, [error]);
  return (
    <main className="grid min-h-screen place-items-center p-6">
      <div className="max-w-sm space-y-3 text-center">
        <h1 className="text-xl font-semibold">Something went wrong</h1>
        <p className="text-sm text-muted">An unexpected error stopped this page from loading. Your data is safe.</p>
        <div className="flex justify-center gap-2">
          <button onClick={() => retry()} className="rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-fg">Try again</button>
          <Link href="/" className="rounded-lg border border-border bg-card px-4 py-2 text-sm font-medium">Go to dashboard</Link>
        </div>
      </div>
    </main>
  );
}
