import { Suspense } from "react";
import { Dashboard } from "@/components/dashboard";
import { PageSkeleton } from "@/components/ui";

export const metadata = { title: "Dashboard · MoneyMgr" };
// Dashboard reads the current date (request-time value), so it streams in behind a boundary.
export default function Page() {
  return <Suspense fallback={<PageSkeleton />}><Dashboard /></Suspense>;
}
