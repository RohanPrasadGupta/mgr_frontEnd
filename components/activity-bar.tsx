"use client";
import { useIsFetching, useIsMutating } from "@tanstack/react-query";
import { useEffect, useState } from "react";

/**
 * A thin bar along the top of the viewport while anything is loading or saving. It only appears when work takes
 * longer than ~250 ms (quick cache hits never flash it) and stays up at least ~300 ms so it never flickers.
 */
export function ActivityBar() {
  const busy = useIsFetching() + useIsMutating() > 0;
  const [show, setShow] = useState(false);
  useEffect(() => {
    const t = setTimeout(() => setShow(busy), busy ? 250 : 300);
    return () => clearTimeout(t);
  }, [busy]);
  return (
    <div aria-hidden className={`pointer-events-none fixed inset-x-0 top-0 z-[1400] h-0.5 overflow-hidden transition-opacity duration-300 print:hidden ${show ? "opacity-100" : "opacity-0"}`}>
      {show && <div className="indeterminate h-full w-2/5 rounded-full bg-gradient-to-r from-transparent via-primary to-transparent" />}
    </div>
  );
}
