import { Suspense } from "react";
import { Dashboard } from "@/components/dashboard";
import { Skeleton } from "@/components/ui";

export const metadata = { title: "Dashboard · MoneyMgr" };
// Dashboard reads the current date (request-time value), so it streams in behind a boundary.
export default function Page() {
  return <Suspense fallback={<Skeleton className="h-96" />}><Dashboard /></Suspense>;
}
