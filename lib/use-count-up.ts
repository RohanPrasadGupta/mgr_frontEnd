"use client";
import { useEffect, useRef, useState } from "react";

const motionOk = () => typeof window !== "undefined" && typeof window.matchMedia === "function" && window.matchMedia("(prefers-reduced-motion: no-preference)").matches;

/**
 * Tweens a number from its previous value to `target` (ease-out, ~600 ms) so totals roll to their new value instead
 * of snapping. Returns `target` unchanged when motion is reduced, unsupported (tests, SSR) or there is no number yet.
 */
export function useCountUp(target: number | undefined, duration = 600): number | undefined {
  // `frame` only holds an in-between value while a tween runs; otherwise the target is returned as is.
  const [frame, setFrame] = useState<number | null>(null);
  const from = useRef<number | undefined>(undefined);
  useEffect(() => {
    const a = from.current ?? 0;
    from.current = target;
    if (target === undefined || a === target || !motionOk()) return;
    const start = performance.now();
    let raf = requestAnimationFrame(function tick(t) {
      const k = Math.min(1, (t - start) / duration), eased = 1 - (1 - k) ** 3;
      setFrame(k < 1 ? Math.round(a + (target - a) * eased) : null);
      if (k < 1) raf = requestAnimationFrame(tick);
    });
    return () => { cancelAnimationFrame(raf); setFrame(null); };
  }, [target, duration]);
  return target === undefined ? undefined : (frame ?? target);
}
