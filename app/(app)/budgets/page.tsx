import { Suspense } from "react";
import { BudgetsView } from "@/components/budgets-view";
import { Skeleton } from "@/components/ui";

export const metadata = { title: "Budgets · MoneyMgr" };
export default function Page() {
  return <Suspense fallback={<Skeleton className="h-96" />}><BudgetsView /></Suspense>;
}
