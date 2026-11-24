import { Suspense } from "react";
import { TransactionsView } from "@/components/transactions-view";
import { Skeleton } from "@/components/ui";

export const metadata = { title: "Transactions · MoneyMgr" };
export default function Page() {
  return <Suspense fallback={<Skeleton className="h-96" />}><TransactionsView /></Suspense>;
}
