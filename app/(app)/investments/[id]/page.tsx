import { Suspense } from "react";
import { AssetView } from "@/components/asset-view";
import { PageSkeleton } from "@/components/ui";

export const metadata = { title: "Asset · MoneyMgr" };
// The asset id is read on the client (useParams), so the shell is static and the content streams in.
export default function Page() {
  return <Suspense fallback={<PageSkeleton />}><AssetView /></Suspense>;
}
