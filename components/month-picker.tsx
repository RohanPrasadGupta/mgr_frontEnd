"use client";
import { monthLabel, shiftMonth } from "@/lib/money";
import { Button } from "./ui";

export function MonthPicker({ year, month, onChange }: { year: number; month: number; onChange: (y: number, m: number) => void }) {
  const go = (d: number) => { const n = shiftMonth(year, month, d); onChange(n.year, n.month); };
  return (
    <div className="inline-flex items-center gap-1">
      <Button variant="ghost" onClick={() => go(-1)} aria-label="Previous month">‹</Button>
      <span className="min-w-36 text-center text-sm font-semibold tabular-nums">{monthLabel(year, month)}</span>
      <Button variant="ghost" onClick={() => go(1)} aria-label="Next month">›</Button>
    </div>
  );
}
