import { Suspense } from "react";
import { TransfersView } from "@/components/transfers-view";
import { Skeleton } from "@/components/ui";

export const metadata = { title: "Transfers · MoneyMgr" };
export default function Page() {
  return <Suspense fallback={<Skeleton className="h-96" />}><TransfersView /></Suspense>;
}
