import { describe, it, expect } from "vitest";
import { displaysAsZeroCurrency } from "../displaysAsZeroCurrency";

describe("displaysAsZeroCurrency (Totals: hide $0.00 rows for clients)", () => {
  it("treats anything shown as $0.00 as zero", () => {
    for (const v of [0, -0, "0", "0.00", 0.004, -0.004, null, undefined, "", NaN]) {
      expect(displaysAsZeroCurrency(v), String(v)).toBe(true);
    }
  });
  it("keeps any amount that shows a cent or more, positive or negative", () => {
    for (const v of [0.005, 0.01, -0.01, 12.5, "-3.20", 1000]) {
      expect(displaysAsZeroCurrency(v), String(v)).toBe(false);
    }
  });
});
