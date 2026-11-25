"use client";
import { useState } from "react";

const UNSET = Symbol("unset");

/**
 * Runs `reset` during render whenever `key` changes to a non-null value (and on the first render with one) —
 * React's "adjust state when a prop changes" pattern. Unlike an effect it never paints a frame with stale fields,
 * and it doesn't re-run when unrelated data refetches, so it can't wipe what the user is typing.
 */
export function useResetOn(key: string | null, reset: () => void) {
  const [seen, setSeen] = useState<string | null | typeof UNSET>(UNSET);
  if (seen !== key) {
    setSeen(key);
    if (key !== null) reset();
  }
}
