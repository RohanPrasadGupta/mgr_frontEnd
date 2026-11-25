import { PageSkeleton } from "@/components/ui";

// Shown instantly while a route's code or first render streams in, so a click never looks ignored.
export default function Loading() {
  return <PageSkeleton />;
}
