import { describe, it, expect } from "vitest";
import { formatAmount } from "../formatAmount";

describe("formatAmount", () => {
  it("adds thousands separators and two decimals", () => {
    expect(formatAmount(1238313.37)).toBe("1,238,313.37");
    expect(formatAmount(9285)).toBe("9,285.00");
    expect(formatAmount(0.5)).toBe("0.50");
    expect(formatAmount(-5264.81)).toBe("-5,264.81");
  });

  it("shows 0.00 for empty values", () => {
    expect(formatAmount(null)).toBe("0.00");
    expect(formatAmount(undefined)).toBe("0.00");
    expect(formatAmount(NaN)).toBe("0.00");
  });
});
