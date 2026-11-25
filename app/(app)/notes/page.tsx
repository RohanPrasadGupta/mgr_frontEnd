import { Suspense } from "react";
import { NotesView } from "@/components/notes-view";
import { PageSkeleton } from "@/components/ui";

export const metadata = { title: "Notes · MoneyMgr" };
export default function Page() {
  return <Suspense fallback={<PageSkeleton />}><NotesView /></Suspense>;
}
