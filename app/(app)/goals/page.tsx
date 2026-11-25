import { Suspense } from "react";
import { GoalsView } from "@/components/goals-view";
import { PageSkeleton } from "@/components/ui";

export const metadata = { title: "Goals · MoneyMgr" };
export default function Page() {
  return <Suspense fallback={<PageSkeleton />}><GoalsView /></Suspense>;
}
