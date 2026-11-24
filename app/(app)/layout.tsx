import { Suspense } from "react";
import { AppShell } from "@/components/app-shell";

// The shell reads the current path (usePathname); on dynamic routes like /investments/[id] that is a
// request-time value, so it streams in behind a boundary instead of blocking the prerender.
export default function Layout({ children }: LayoutProps<"/">) {
  return <Suspense fallback={<div className="min-h-screen" />}><AppShell>{children}</AppShell></Suspense>;
}
