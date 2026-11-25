import type { Account, Category, Currency, User } from "@/lib/api/types";

export const me: User = { id: "u1", email: "me@example.com", name: "Me", baseCurrency: "THB", timezone: "Asia/Bangkok", locale: "en", weekStart: 1, emailVerified: true };
const acct = (id: string, name: string, currency: string, balanceMinor: number, extra: Partial<Account> = {}): Account =>
  ({ id, userId: "u1", name, type: "bank", currency, openingBalanceMinor: 0, balanceMinor, includeInNetWorth: true, archived: false, icon: null, color: null, sort: 0, createdAt: "2025-01-01T00:00:00.000Z", updatedAt: "2025-01-01T00:00:00.000Z", deletedAt: null, ...extra });
export const cash = acct("a-cash", "Cash", "THB", 100_000, { type: "cash" });
export const bank = acct("a-bank", "Bank", "THB", 50_000);
export const npr = acct("a-npr", "NPR wallet", "NPR", 0, { type: "wallet" });
export const usd = acct("a-usd", "USD card", "USD", 0, { type: "card" });
export const accounts: Account[] = [cash, bank, npr, usd];
const cat = (id: string, name: string, kind: Category["kind"], icon: string | null = null): Category => ({ id, userId: "u1", name, kind, parentId: null, icon, color: null, archived: false, createdAt: "2025-01-01T00:00:00.000Z", deletedAt: null });
export const categories: Category[] = [cat("c-food", "Food", "expense", "🍜"), cat("c-rent", "Rent", "expense"), cat("c-salary", "Salary", "income")];
export const currencies: Currency[] = ["THB", "NPR", "USD", "EUR"].map((code) => ({ code, name: code, symbol: code, minorUnit: 2 }));

/** The read endpoints most screens need. */
export const baseRoutes = {
  "GET /me": { data: me },
  "GET /accounts": { data: accounts },
  "GET /categories": { data: categories },
  "GET /currencies": { data: currencies },
  "GET /tags": { data: [] },
};

export const T0 = { userId: "u1", tagIds: [] as string[], attachmentCount: 0, clientId: null, createdAt: "2025-01-01T00:00:00.000Z", updatedAt: "2025-01-01T00:00:00.000Z", deletedAt: null, version: 1 } as const;
