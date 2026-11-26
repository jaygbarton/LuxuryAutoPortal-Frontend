import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

// Earnings: income and expenses laid out like the Statement of Account, CAR
// OWNER SPLIT kept above, no GLA Payment or Balance (Cathy, 2026-11-26).
const src = readFileSync(resolve(__dirname, "../../../earnings.tsx"), "utf8");

describe("Earnings in the Statement of Account layout", () => {
  it("loads the statement rows for the selected year", () => {
    expect(src).toContain("/api/cars/${carId}/statement-of-account/data?year=${selectedYear}");
  });

  it("keeps CAR OWNER SPLIT above the statement sections", () => {
    expect(src.indexOf('title="CAR OWNER SPLIT"')).toBeLessThan(src.indexOf("statementBlocks.map("));
  });

  it("shows the statement sections in the statement's order", () => {
    const order = ["`INCOME (", '"OPERATING EXPENSES (Direct Delivery)"', '"OPERATING EXPENSES (COGS Per Vehicle)"', '"GLA PARKING FEE & LABOR CLEANING"', "block.negativeBalanceCarryOver", "block.totalPayout"];
    const at = order.map((s) => src.indexOf(s));
    at.forEach((i) => expect(i).toBeGreaterThan(-1));
    expect([...at].sort((a, b) => a - b)).toEqual(at);
  });

  it("does not show GLA Payment or Balance", () => {
    expect(src).not.toContain("glaPayment");
    expect(src).not.toMatch(/block\.balance/);
  });
});
