"use client";
import { keepPreviousData, useInfiniteQuery, useMutation, useQuery, useQueryClient, type QueryClient } from "@tanstack/react-query";
import { call, client } from "./client";
import type { Transaction } from "./types";

/** For filter-driven queries (month, search, status): keep showing the last result, dimmed, while the next one
 *  loads, instead of flashing back to a skeleton on every click. */
const keep = { placeholderData: keepPreviousData } as const;

// Query keys always start with the resource so a write can invalidate by prefix.
export const qk = {
  me: ["me"] as const,
  accounts: ["accounts"] as const,
  categories: ["categories"] as const,
  currencies: ["currencies"] as const,
  tx: (f: object) => ["transactions", f] as const,
  insights: (kind: string, f: object) => ["insights", kind, f] as const,
  tags: ["tags"] as const,
  goals: ["goals"] as const,
  debts: ["debts"] as const,
  notes: ["notes"] as const,
  reports: ["reports"] as const,
};

export const useMe = () => useQuery({ queryKey: qk.me, queryFn: async () => (await call(client.GET("/me"))).data, staleTime: 5 * 60_000 });
export const useAccounts = () => useQuery({ queryKey: qk.accounts, queryFn: async () => (await call(client.GET("/accounts"))).data, staleTime: 30_000 });
export const useCategories = () => useQuery({ queryKey: qk.categories, queryFn: async () => (await call(client.GET("/categories"))).data, staleTime: 60_000 });
export const useCurrencies = () => useQuery({ queryKey: qk.currencies, queryFn: async () => (await call(client.GET("/currencies"))).data, staleTime: 3600_000 });

export interface TxFilter { from?: string; to?: string; accountId?: string; kind?: "income" | "expense" | ""; q?: string; tagId?: string }
/** Empty-string filters mean "not set" in the UI; the API wants them absent. */
const clean = <T extends object>(o: T) => Object.fromEntries(Object.entries(o).filter(([, v]) => v !== "" && v !== undefined)) as { [K in keyof T]?: Exclude<T[K], ""> };

export const useTransactions = (f: TxFilter) =>
  useInfiniteQuery({
    queryKey: qk.tx(f),
    initialPageParam: undefined as string | undefined,
    queryFn: ({ pageParam }) => call(client.GET("/transactions", { params: { query: { ...clean(f), limit: 100, cursor: pageParam } } })),
    getNextPageParam: (last) => last.meta.nextCursor ?? undefined,
    ...keep, staleTime: 15_000,
  });

/** Newest transaction overall (used to open the dashboard on a month that actually has data). */
export const useLatestTransaction = () => useQuery({ queryKey: ["transactions", "latest"] as const, queryFn: async () => (await call(client.GET("/transactions", { params: { query: { limit: 1 } } }))).data[0] ?? null, staleTime: 60_000 });
export const useSummary = (from: string, to: string) => useQuery({ queryKey: qk.insights("summary", { from, to }), queryFn: async () => (await call(client.GET("/insights/summary", { params: { query: { from, to } } }))).data, ...keep, staleTime: 30_000 });
export const useByCategory = (from: string, to: string, kind: "income" | "expense") => useQuery({ queryKey: qk.insights("by-category", { from, to, kind }), queryFn: async () => (await call(client.GET("/insights/by-category", { params: { query: { from, to, kind } } }))).data, ...keep, staleTime: 30_000 });
export const useDaily = (from: string, to: string) => useQuery({ queryKey: qk.insights("daily", { from, to }), queryFn: async () => (await call(client.GET("/insights/daily", { params: { query: { from, to } } }))).data, ...keep, staleTime: 30_000 });
export const useTrend = (year: number) => useQuery({ queryKey: qk.insights("trend", { year }), queryFn: async () => (await call(client.GET("/insights/trend", { params: { query: { year } } }))).data, ...keep, staleTime: 30_000 });

/** `date` omitted = today in the user's timezone (decided by the API). */
export const useBudgetStatus = (date?: string) => useQuery({ queryKey: ["budgets", "status", { date }] as const, queryFn: async () => (await call(client.GET("/budgets/status", { params: { query: { date } } }))).data, ...keep, staleTime: 15_000 });
export const useRecurring = () => useQuery({ queryKey: ["recurring"] as const, queryFn: async () => (await call(client.GET("/recurring"))).data, staleTime: 30_000 });

export const usePortfolio = () => useQuery({ queryKey: ["investments", "portfolio"] as const, queryFn: async () => (await call(client.GET("/investments/portfolio"))).data, staleTime: 30_000 });
export const useHolding = (id: string) => useQuery({ queryKey: ["investments", "asset", id] as const, queryFn: async () => (await call(client.GET("/investments/assets/{id}", { params: { path: { id } } }))).data, staleTime: 15_000 });
/** Every entry across assets for the investments board (the API returns at most 500, newest first). */
export const useAllTrades = () => useQuery({ queryKey: ["investments", "trades", "all"] as const, queryFn: async () => (await call(client.GET("/investments/trades", { params: { query: { limit: 500 } } }))).data, staleTime: 15_000 });
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
    ...keep, staleTime: 15_000,
    queryFn: async (): Promise<TransferPair[]> => {
      const [outs, ins] = await Promise.all([allOfKind("transfer_out", from, to), allOfKind("transfer_in", from, to)]);
      const inBy = new Map(ins.map((t) => [t.transferGroupId, t]));
      return outs.filter((t) => t.transferGroupId).map((t) => ({ groupId: t.transferGroupId!, out: t, in: inBy.get(t.transferGroupId) ?? null }));
    },
  });

// ── tags / attachments ──
export const useTags = () => useQuery({ queryKey: qk.tags, queryFn: async () => (await call(client.GET("/tags"))).data, staleTime: 60_000 });
export const useAttachments = (transactionId?: string | null) =>
  useQuery({ queryKey: ["transactions", "attachments", transactionId] as const, enabled: !!transactionId, queryFn: async () => (await call(client.GET("/transactions/{id}/attachments", { params: { path: { id: transactionId! } } }))).data });

// ── goals / debts / notes / reports ──
export const useGoals = (archived = false) => useQuery({ queryKey: [...qk.goals, { archived }] as const, queryFn: async () => (await call(client.GET("/goals", { params: { query: { archived: archived ? "true" : "false" } } }))).data, ...keep, staleTime: 30_000 });
export const useGoal = (id?: string | null) => useQuery({ queryKey: [...qk.goals, "detail", id] as const, enabled: !!id, queryFn: async () => (await call(client.GET("/goals/{id}", { params: { path: { id: id! } } }))).data });
export const useDebts = (status: "open" | "settled" | "all") => useQuery({ queryKey: [...qk.debts, { status }] as const, queryFn: async () => (await call(client.GET("/debts", { params: { query: { status } } }))).data, ...keep, staleTime: 30_000 });
export const useDebtSummary = () => useQuery({ queryKey: [...qk.debts, "summary"] as const, queryFn: async () => (await call(client.GET("/debts/summary"))).data, staleTime: 30_000 });
export const useDebt = (id?: string | null) => useQuery({ queryKey: [...qk.debts, "detail", id] as const, enabled: !!id, queryFn: async () => (await call(client.GET("/debts/{id}", { params: { path: { id: id! } } }))).data });
export const useNotes = (q: string) => useQuery({ queryKey: [...qk.notes, { q }] as const, queryFn: async () => (await call(client.GET("/notes", { params: { query: q ? { q } : {} } }))).data, ...keep, staleTime: 30_000 });
export const useReport = (period: "month" | "year" | "all", year: number, month?: number) =>
  useQuery({ queryKey: [...qk.reports, period === "all" ? { period } : { period, year, month }] as const, queryFn: async () => (await call(client.GET("/reports", { params: { query: { period, ...(period === "all" ? {} : { year }), ...(period === "month" ? { month } : {}) } } }))).data, ...keep, staleTime: 30_000 });

export const invalidateTags = (qc: QueryClient) => Promise.all([qc.invalidateQueries({ queryKey: qk.tags }), qc.invalidateQueries({ queryKey: ["transactions"] })]);
export const invalidateGoals = (qc: QueryClient) => qc.invalidateQueries({ queryKey: qk.goals });
export const invalidateDebts = (qc: QueryClient) => qc.invalidateQueries({ queryKey: qk.debts });
export const invalidateNotes = (qc: QueryClient) => qc.invalidateQueries({ queryKey: qk.notes });

/** The stored daily rate the API will use for `from`→`to` on `date` (null when none is stored). */
export const useFxQuote = (from?: string, to?: string, date?: string) =>
  useQuery({
    queryKey: ["fx", { from, to, date }] as const,
    enabled: !!from && !!to && from !== to,
    staleTime: 3600_000,
    retry: false,
    queryFn: async () => {
      const res = await client.GET("/fx", { params: { query: { from: from!, to: to!, date } } });
      if (res.response.status === 404) return null; // no stored rate for this pair
      return (await call(Promise.resolve(res))).data;
    },
  });

/** Portfolio value and invested amount at each month end (replayed from trades + manual prices, base currency). */
/** `months: "all"` = from the first entry to today; `currency` omitted = the base currency. */
export const usePortfolioHistory = (months: number | "all", currency?: string) =>
  useQuery({
    ...keep, queryKey: ["investments", "history", { months, currency: currency ?? null }] as const, staleTime: 60_000,
    queryFn: async () => (await call(client.GET("/investments/portfolio/history", { params: { query: months === "all" ? { all: "true", currency } : { months, currency } } }))).data,
  });
