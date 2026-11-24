// Types come from the generated OpenAPI schema (lib/api/schema.d.ts) — nothing here is hand-maintained.
import type { components } from "./schema";

type S = components["schemas"];
export type User = S["User"];
export type Account = S["Account"];
export type Category = S["Category"];
export type Currency = S["Currency"];
export type Transaction = S["Transaction"];
export type Summary = S["Summary"];
export type ByCategory = S["ByCategory"];
export type Trend = S["Trend"];
export type Budget = S["Budget"];
export type BudgetStatus = S["BudgetStatus"];
export type BudgetStatusItem = S["BudgetStatusItem"];
export type RecurringRule = S["RecurringRule"];
export type RunReport = S["RunReport"];
export type ImportReport = S["ImportReport"];
export type InvestmentImportReport = S["InvestmentImportReport"];
export type Asset = S["Asset"];
export type Holding = S["Holding"];
export type Portfolio = S["Portfolio"];
export type Trade = S["Trade"];
export type PricePoint = S["PricePoint"];
export type SipResult = S["SipResult"];

export type AccountType = Account["type"];
export type TxKind = Transaction["kind"];
export type BudgetPeriod = Budget["period"];
export type Frequency = RecurringRule["frequency"];
export type AssetClass = Asset["class"];
export type CostMethod = Asset["costMethod"];
export type TradeType = Trade["type"];
export type Page<T> = { data: T[]; meta: { nextCursor: string | null } };

import type { paths } from "./schema";
/** JSON request body type of an operation, e.g. `Body<"/accounts", "post">`. */
export type Body<P extends keyof paths, M extends "post" | "patch"> = NonNullable<paths[P][M]> extends { requestBody: { content: { "application/json": infer B } } } ? B : never;
