"use client";
import { catchError, type ErrorInfo } from "next/error";
import type { ReactNode } from "react";
import { ApiError } from "@/lib/api/client";
import { Button, Card, ErrorNote, Skeleton, cx } from "./ui";

function Fallback(props: { title: string; children?: ReactNode }, { error, retry }: ErrorInfo) {
  console.error(`[widget:${props.title}]`, error);
  return (
    <div role="alert" className="space-y-2 text-sm">
      <p className="font-medium text-expense">“{props.title}” couldn’t be shown.</p>
      <p className="text-muted">Something unexpected happened while drawing this section. The rest of the page is fine.</p>
      <Button variant="ghost" onClick={() => retry()}>Try again</Button>
    </div>
  );
}
const Boundary = catchError(Fallback);

/**
 * A dashboard card with its own error boundary and query-state handling, so one broken chart or one failed
 * request never takes the whole page down: loading → skeleton, failed → inline retryable message, crash → boundary.
 */
export function Widget({ title, action, className, children, state }: {
  title: string;
  action?: ReactNode;
  className?: string;
  children: ReactNode;
  state?: { isPending: boolean; error: unknown; refetch: () => unknown };
}) {
  return (
    <Card className={cx("min-w-0", className)}>
      <div className="mb-3 flex items-center justify-between gap-2">
        <h2 className="text-sm font-semibold">{title}</h2>
        {action}
      </div>
      <Boundary title={title}>
        {state?.error ? <ErrorNote error={state.error instanceof ApiError || state.error instanceof Error ? state.error : new Error("Failed to load")} retry={() => state.refetch()} />
          : state?.isPending ? <Skeleton className="h-40" /> : children}
      </Boundary>
    </Card>
  );
}
