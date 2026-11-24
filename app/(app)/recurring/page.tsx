import { Suspense } from "react";
import { RecurringView } from "@/components/recurring-view";
import { Skeleton } from "@/components/ui";

export const metadata = { title: "Recurring · MoneyMgr" };
export default function Page() {
  return <Suspense fallback={<Skeleton className="h-96" />}><RecurringView /></Suspense>;
}
