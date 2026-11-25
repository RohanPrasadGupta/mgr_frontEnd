import { Suspense } from "react";
import { ReportsView } from "@/components/reports-view";
import { PageSkeleton } from "@/components/ui";

export const metadata = { title: "Reports · MoneyMgr" };
export default function Page() {
  return <Suspense fallback={<PageSkeleton />}><ReportsView /></Suspense>;
}
