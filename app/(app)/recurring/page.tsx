import { Suspense } from "react";
import { RecurringView } from "@/components/recurring-view";
import { PageSkeleton } from "@/components/ui";

export const metadata = { title: "Recurring · MoneyMgr" };
export default function Page() {
  return <Suspense fallback={<PageSkeleton />}><RecurringView /></Suspense>;
}
