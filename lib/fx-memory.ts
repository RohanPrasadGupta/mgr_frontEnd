// Remembers the last exchange rate the user typed for each currency pair (this browser only), so a repeat entry is one tap.
const key = (from: string, to: string) => `mm_fx_${from}_${to}`;
export function lastFxRate(from: string, to: string): number | null {
  try { const v = Number(localStorage.getItem(key(from, to))); return v > 0 ? v : null; } catch { return null; }
}
export function rememberFxRate(from: string, to: string, rate: number) {
  if (!(rate > 0)) return;
  try { localStorage.setItem(key(from, to), String(rate)); } catch { /* storage blocked */ }
}
