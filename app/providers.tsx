"use client";
import { AppRouterCacheProvider } from "@mui/material-nextjs/v16-appRouter";
import { MutationCache, QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { useState, type ReactNode } from "react";
import { ApiError } from "@/lib/api/client";
import { toast } from "@/lib/toast";
import { FeedbackProvider } from "@/components/feedback";
import { MuiTheme } from "@/components/mui-theme";

/** Retry only what can succeed on a second try: network failures and 5xx. Never retry 4xx (bad input, auth, not found, conflicts). */
export function shouldRetry(failureCount: number, error: unknown): boolean {
  if (error instanceof ApiError) return (error.status === 0 || error.status >= 500) && failureCount < 2;
  return failureCount < 1;
}

export function Providers({ children }: { children: ReactNode }) {
  const [client] = useState(() => new QueryClient({
    // Every write reports its outcome: a success toast when the call site names one, and ALWAYS a failure toast.
    mutationCache: new MutationCache({
      onSuccess: (_d, _v, _c, m) => { const msg = m.meta?.success; if (typeof msg === "string") toast.success(msg); },
      onError: (e, _v, _c, m) => { if (!m.meta?.silent) toast.error(e instanceof Error ? e.message : "Something went wrong"); },
    }),
    defaultOptions: {
      queries: { retry: shouldRetry, retryDelay: (n) => Math.min(1000 * 2 ** n, 8000), refetchOnWindowFocus: false, refetchOnReconnect: true },
      mutations: { retry: false }, // writes are never repeated automatically
    },
  }));
  return (
    <AppRouterCacheProvider>
      <MuiTheme>
        <QueryClientProvider client={client}><FeedbackProvider>{children}</FeedbackProvider></QueryClientProvider>
      </MuiTheme>
    </AppRouterCacheProvider>
  );
}
