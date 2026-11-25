import { Suspense } from "react";
import { DebtsView } from "@/components/debts-view";
import { PageSkeleton } from "@/components/ui";

export const metadata = { title: "Debts · MoneyMgr" };
export default function Page() {
  return <Suspense fallback={<PageSkeleton />}><DebtsView /></Suspense>;
}
