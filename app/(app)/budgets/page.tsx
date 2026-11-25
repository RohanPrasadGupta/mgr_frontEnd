import { Suspense } from "react";
import { BudgetsView } from "@/components/budgets-view";
import { PageSkeleton } from "@/components/ui";

export const metadata = { title: "Budgets · MoneyMgr" };
export default function Page() {
  return <Suspense fallback={<PageSkeleton />}><BudgetsView /></Suspense>;
}
