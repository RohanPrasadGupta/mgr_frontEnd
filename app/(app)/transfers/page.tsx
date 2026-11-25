import { Suspense } from "react";
import { TransfersView } from "@/components/transfers-view";
import { PageSkeleton } from "@/components/ui";

export const metadata = { title: "Transfers · MoneyMgr" };
export default function Page() {
  return <Suspense fallback={<PageSkeleton />}><TransfersView /></Suspense>;
}
