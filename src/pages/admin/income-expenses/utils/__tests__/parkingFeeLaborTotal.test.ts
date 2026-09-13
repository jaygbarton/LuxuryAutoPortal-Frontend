import { describe, it, expect } from "vitest";
import { buildIncomeExpenseCSV } from "../exportImportUtils";

/**
 * Operator precedence in the exported "Total Parking Fee & Labor Cleaning" row.
 *
 * The line read:
 *
 *   Number(getMonthValue(..., "glaParkingFee")) || 0 +
 *   Number(getMonthValue(..., "laborCleaning")) || 0
 *
 * `+` binds tighter than `||`, so JS parsed that as
 * `a || (0 + b) || 0` — not `(a || 0) + (b || 0)`. Whenever glaParkingFee was
 * non-zero it short-circuited and **laborCleaning was dropped from the export
 * entirely**; the labor term only showed up when glaParkingFee happened to be 0,
 * which is exactly when the bug is invisible.
 *
 * Verified in node against the pre-fix expression:
 *   Number(5) || 0 + Number(7) || 0   === 5    (labor dropped)
 *   (Number(5)||0) + (Number(7)||0)   === 12   (intended)
 */

/** Minimal IncomeExpenseData with only the parkingFeeLabor month we care about. */
function makeData(month: number, glaParkingFee: number, laborCleaning: number): any {
  const empty = () => [] as any[];
  return {
    incomeExpenses: empty(),
    directDelivery: empty(),
    cogs: empty(),
    parkingFeeLabor: [{ month, glaParkingFee, laborCleaning }],
    reimbursedBills: empty(),
    officeSupport: empty(),
    history: empty(),
    parkingAirportQB: empty(),
    formulaSetting: { carManagementSplitPercent: 50, carOwnerSplitPercent: 50 },
    approvedFormTotals: [],
  };
}

/** Pull the 12 monthly dollar cells from the Parking Fee & Labor Cleaning row. */
function parkingTotalCells(csv: string): number[] {
  const row = csv
    .split("\n")
    .find((l) => l.startsWith("Total Parking Fee & Labor Cleaning,"));
  if (!row) throw new Error("Total Parking Fee & Labor Cleaning row not found");
  return row
    .split(",")
    .slice(1, 13)
    .map((c) => Number(c.replace(/[$"]/g, "")));
}

const build = (data: any) =>
  buildIncomeExpenseCSV(data, { car_make: "Test", car_specs: "Car" }, "2026", {});

describe("Total Parking Fee & Labor Cleaning — both terms are summed", () => {
  it("includes laborCleaning when glaParkingFee is NON-ZERO (the bug)", () => {
    // Pre-fix this emitted 5.00 — the labor term was short-circuited away.
    const cells = parkingTotalCells(build(makeData(1, 5, 7)));
    expect(cells[0]).toBe(12);
  });

  it("still includes laborCleaning when glaParkingFee is 0", () => {
    // The one case the old code got right, so it must not regress.
    const cells = parkingTotalCells(build(makeData(1, 0, 7)));
    expect(cells[0]).toBe(7);
  });

  it("handles glaParkingFee alone", () => {
    const cells = parkingTotalCells(build(makeData(1, 5, 0)));
    expect(cells[0]).toBe(5);
  });

  it("is 0 when both are 0", () => {
    const cells = parkingTotalCells(build(makeData(1, 0, 0)));
    expect(cells[0]).toBe(0);
  });

  it("sums decimals correctly", () => {
    const cells = parkingTotalCells(build(makeData(3, 12.5, 7.25)));
    expect(cells[2]).toBeCloseTo(19.75, 2);
  });

  it("treats a missing month as 0 without disturbing other months", () => {
    const cells = parkingTotalCells(build(makeData(2, 100, 50)));
    expect(cells[0]).toBe(0);    // Jan has no row
    expect(cells[1]).toBe(150);  // Feb has both terms
  });

  it("diverges from the pre-fix expression exactly where it matters", () => {
    // Kept beside the fix to prove this is a real change, not a tautology.
    const buggy = (a: number, b: number) => Number(a) || 0 + Number(b) || 0;
    const fixed = (a: number, b: number) => (Number(a) || 0) + (Number(b) || 0);

    expect(buggy(5, 7)).toBe(5);   // labor dropped
    expect(fixed(5, 7)).toBe(12);

    // They agree only when glaParkingFee is 0 — why this survived so long.
    expect(buggy(0, 7)).toBe(fixed(0, 7));
  });
});
