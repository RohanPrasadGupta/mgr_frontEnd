import { describe, expect, it } from "vitest";
import { TYPES_FOR, defaultTracking, isInflow } from "./investments";

describe("investments helpers", () => {
  it("tracks market instruments by units and pooled money by value (mirrors the API)", () => {
    for (const c of ["stock", "crypto", "gold"] as const) expect(defaultTracking(c)).toBe("units");
    for (const c of ["fund", "retirement", "fixed_deposit", "other"] as const) expect(defaultTracking(c)).toBe("value");
  });
  it("offers only valid trade types per tracking mode", () => {
    expect(TYPES_FOR.units.map((t) => t.value)).toEqual(["buy", "sell", "bonus", "dividend", "fee"]);
    expect(TYPES_FOR.value.map((t) => t.value)).toEqual(["contribution", "withdrawal", "dividend", "fee"]);
  });
  it("treats money back to the investor as inflow", () => {
    expect(["sell", "dividend", "withdrawal"].every((t) => isInflow(t as never))).toBe(true);
    expect(["buy", "contribution", "fee", "bonus"].some((t) => isInflow(t as never))).toBe(false);
  });
});
