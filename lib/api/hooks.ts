"use client";
import { useInfiniteQuery, useMutation, useQuery, useQueryClient, type QueryClient } from "@tanstack/react-query";
import { call, client } from "./client";
import type { Transaction } from "./types";

// Query keys always start with the resource so a write can invalidate by prefix.
export const qk = {
  me: ["me"] as const,
  accounts: ["accounts"] as const,
  categories: ["categories"] as const,
  currencies: ["currencies"] as const,
  tx: (f: object) => ["transactions", f] as const,
  insights: (kind: string, f: object) => ["insights", kind, f] as const,
};

export const useMe = () => useQuery({ queryKey: qk.me, queryFn: async () => (await call(client.GET("/me"))).data, staleTime: 5 * 60_000 });
export const useAccounts = () => useQuery({ queryKey: qk.accounts, queryFn: async () => (await call(client.GET("/accounts"))).data, staleTime: 30_000 });
export const useCategories = () => useQuery({ queryKey: qk.categories, queryFn: async () => (await call(client.GET("/categories"))).data, staleTime: 60_000 });
export const useCurrencies = () => useQuery({ queryKey: qk.currencies, queryFn: async () => (await call(client.GET("/currencies"))).data, staleTime: 3600_000 });

export interface TxFilter { from?: string; to?: string; accountId?: string; kind?: "income" | "expense" | ""; q?: string }
/** Empty-string filters mean "not set" in the UI; the API wants them absent. */
const clean = <T extends object>(o: T) => Object.fromEntries(Object.entries(o).filter(([, v]) => v !== "" && v !== undefined)) as { [K in keyof T]?: Exclude<T[K], ""> };

export const useTransactions = (f: TxFilter) =>
  useInfiniteQuery({
    queryKey: qk.tx(f),
    initialPageParam: undefined as string | undefined,
    queryFn: ({ pageParam }) => call(client.GET("/transactions", { params: { query: { ...clean(f), limit: 100, cursor: pageParam } } })),
    getNextPageParam: (last) => last.meta.nextCursor ?? undefined,
    staleTime: 15_000,
  });

/** Newest transaction overall (used to open the dashboard on a month that actually has data). */
export const useLatestTransaction = () => useQuery({ queryKey: ["transactions", "latest"] as const, queryFn: async () => (await call(client.GET("/transactions", { params: { query: { limit: 1 } } }))).data[0] ?? null, staleTime: 60_000 });
export const useSummary = (from: string, to: string) => useQuery({ queryKey: qk.insights("summary", { from, to }), queryFn: async () => (await call(client.GET("/insights/summary", { params: { query: { from, to } } }))).data, staleTime: 30_000 });
export const useByCategory = (from: string, to: string, kind: "income" | "expense") => useQuery({ queryKey: qk.insights("by-category", { from, to, kind }), queryFn: async () => (await call(client.GET("/insights/by-category", { params: { query: { from, to, kind } } }))).data, staleTime: 30_000 });
export const useDaily = (from: string, to: string) => useQuery({ queryKey: qk.insights("daily", { from, to }), queryFn: async () => (await call(client.GET("/insights/daily", { params: { query: { from, to } } }))).data, staleTime: 30_000 });
export const useTrend = (year: number) => useQuery({ queryKey: qk.insights("trend", { year }), queryFn: async () => (await call(client.GET("/insights/trend", { params: { query: { year } } }))).data, staleTime: 30_000 });

/** `date` omitted = today in the user's timezone (decided by the API). */
export const useBudgetStatus = (date?: string) => useQuery({ queryKey: ["budgets", "status", { date }] as const, queryFn: async () => (await call(client.GET("/budgets/status", { params: { query: { date } } }))).data, staleTime: 15_000 });
export const useRecurring = () => useQuery({ queryKey: ["recurring"] as const, queryFn: async () => (await call(client.GET("/recurring"))).data, staleTime: 30_000 });

export const usePortfolio = () => useQuery({ queryKey: ["investments", "portfolio"] as const, queryFn: async () => (await call(client.GET("/investments/portfolio"))).data, staleTime: 30_000 });
export const useHolding = (id: string) => useQuery({ queryKey: ["investments", "asset", id] as const, queryFn: async () => (await call(client.GET("/investments/assets/{id}", { params: { path: { id } } }))).data, staleTime: 15_000 });
export const useAssetTrades = (id: string) => useQuery({ queryKey: ["investments", "trades", id] as const, queryFn: async () => (await call(client.GET("/investments/trades", { params: { query: { assetId: id, limit: 500 } } }))).data, staleTime: 15_000 });
export const useAssetPrices = (id: string) => useQuery({ queryKey: ["investments", "prices", id] as const, queryFn: async () => (await call(client.GET("/investments/assets/{id}/prices", { params: { path: { id } } }))).data, staleTime: 30_000 });
export const invalidateInvestments = (qc: QueryClient) => qc.invalidateQueries({ queryKey: ["investments"] });

/** Ledger writes change balances, insights and budget progress, so refresh all of them together. */
export const invalidateLedger = (qc: QueryClient) => Promise.all(["transactions", "accounts", "insights", "budgets"].map((k) => qc.invalidateQueries({ queryKey: [k] })));
export const invalidateBudgets = (qc: QueryClient) => qc.invalidateQueries({ queryKey: ["budgets"] });
export const invalidateRecurring = (qc: QueryClient) => qc.invalidateQueries({ queryKey: ["recurring"] });

/** `success` is shown as a toast when the write succeeds; failures always toast (see Providers' MutationCache). */
export function useMutate<TVars, TOut = unknown>(fn: (v: TVars) => Promise<TOut>, invalidate: (qc: QueryClient) => Promise<unknown>, success?: string) {
  const qc = useQueryClient();
  return useMutation({ mutationFn: fn, onSuccess: () => invalidate(qc), meta: { success } });
}

export interface TransferPair { groupId: string; out: Transaction; in: Transaction | null }

async function allOfKind(kind: "transfer_out" | "transfer_in", from: string, to: string) {
  const rows: Transaction[] = [];
  let cursor: string | undefined;
  do {
    const page = await call(client.GET("/transactions", { params: { query: { kind, from, to, limit: 200, cursor } } }));
    rows.push(...page.data);
    cursor = page.meta.nextCursor ?? undefined;
  } while (cursor);
  return rows;
}

/** Each transfer is two ledger rows sharing a transferGroupId; present them as one. */
export const useTransfers = (from: string, to: string) =>
  useQuery({
    queryKey: ["transactions", "transfers", { from, to }] as const,
    staleTime: 15_000,
    queryFn: async (): Promise<TransferPair[]> => {
      const [outs, ins] = await Promise.all([allOfKind("transfer_out", from, to), allOfKind("transfer_in", from, to)]);
      const inBy = new Map(ins.map((t) => [t.transferGroupId, t]));
      return outs.filter((t) => t.transferGroupId).map((t) => ({ groupId: t.transferGroupId!, out: t, in: inBy.get(t.transferGroupId) ?? null }));
    },
  });
