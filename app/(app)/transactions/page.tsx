import { Suspense } from "react";
import { TransactionsView } from "@/components/transactions-view";
import { PageSkeleton } from "@/components/ui";

export const metadata = { title: "Transactions · MoneyMgr" };
export default function Page() {
  return <Suspense fallback={<PageSkeleton />}><TransactionsView /></Suspense>;
}
