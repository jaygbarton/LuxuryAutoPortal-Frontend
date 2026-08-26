import { describe, it, expect } from "vitest";

// Regression test for the fourth instance of the "unset percent read as a
// real 0%" bug class (see 8b7cf92, b947f61, fb76f26).
//
// IncomeExpenseTable.tsx's calculateCarManagementTotalExpenses (~2008) and
// calculateCarOwnerTotalExpenses (~2039) derived the split percent with:
//     Number(getMonthValue(data.incomeExpenses, month, "carOwnerSplit")) || 0
// getMonthValue collapses a missing row / null / undefined to 0, so `|| 0`
// made an UNSET percent indistinguishable from a genuinely stored 0%. The
// SPLIT rows in the same file already used the correct `!= null` fallback
// (lines ~1450, ~1817) — only these two expense-total helpers lagged.
//
// Only the 50:50 branch is affected: in 30:70 mode neither function uses a
// percent at all, so mode 70 was always correct.
//
// Reachable in production: ensureAllMonths synthesizes placeholder months
// whose createEmpty template omits carManagementSplit/carOwnerSplit, and
// 229 of 826 car/year combos have fewer than 12 rows.

function getMonthValue(arr: any[], month: number, field: string): number {
  if (!arr || !Array.isArray(arr)) return 0;
  const item = arr.find((x) => x && x.month === month);
  if (!item) return 0;
  const value = item[field];
  if (value === null || value === undefined) return 0;
  const numValue = Number(value);
  return isNaN(numValue) ? 0 : numValue;
}

// Pre-fix expression, kept only to prove the two diverge.
function percentBuggy(rows: any[], month: number, field: string): number {
  return Number(getMonthValue(rows, month, field)) || 0;
}

// Mirrors the fixed expression, and the pattern already used by the split
// rows in the same file.
function percentFixed(
  rows: any[],
  month: number,
  field: string,
  defaultPct: number | undefined,
): number {
  const monthRow = rows?.find((x: any) => x && x.month === month);
  const rawStored = monthRow?.[field];
  return rawStored != null ? Number(rawStored) : (defaultPct ?? 50);
}

const DEFAULT_PCT = 50;
const DD = 380;
const COGS = 640;
const REIMBURSED = 210;

// The 50:50 formulas the two helpers implement.
const ownerTotal = (pct: number) => (DD + COGS) * (pct / 100);
const mgmtTotal = (pct: number) => REIMBURSED + (DD + COGS) * (pct / 100);

describe("IncomeExpenseTable expense-total split-percent fallback", () => {
  it("owner total uses the car default when the month is synthesized", () => {
    const rows = [{ month: 3, rentalIncome: 4200 }]; // no split fields
    expect(percentFixed(rows, 3, "carOwnerSplit", DEFAULT_PCT)).toBe(50);
    expect(percentBuggy(rows, 3, "carOwnerSplit")).toBe(0);
    expect(ownerTotal(percentFixed(rows, 3, "carOwnerSplit", DEFAULT_PCT))).toBe(510);
    expect(ownerTotal(percentBuggy(rows, 3, "carOwnerSplit"))).toBe(0);
  });

  it("management total uses the car default when the month is synthesized", () => {
    const rows = [{ month: 3, rentalIncome: 4200 }];
    expect(mgmtTotal(percentFixed(rows, 3, "carManagementSplit", DEFAULT_PCT))).toBe(720);
    // Pre-fix this collapsed to just the reimbursed bills.
    expect(mgmtTotal(percentBuggy(rows, 3, "carManagementSplit"))).toBe(210);
  });

  it("uses the car default when there is no row for that month at all", () => {
    const rows = [{ month: 1, carOwnerSplit: 70 }];
    expect(percentFixed(rows, 9, "carOwnerSplit", DEFAULT_PCT)).toBe(50);
    expect(percentBuggy(rows, 9, "carOwnerSplit")).toBe(0);
  });

  it("uses the car default for an explicit null", () => {
    const rows = [{ month: 4, carOwnerSplit: null, carManagementSplit: null }];
    expect(percentFixed(rows, 4, "carOwnerSplit", DEFAULT_PCT)).toBe(50);
    expect(percentBuggy(rows, 4, "carOwnerSplit")).toBe(0);
  });

  it("still honours a genuinely stored 0%", () => {
    const rows = [{ month: 5, carOwnerSplit: 0, carManagementSplit: 0 }];
    expect(percentFixed(rows, 5, "carOwnerSplit", DEFAULT_PCT)).toBe(0);
    expect(percentFixed(rows, 5, "carManagementSplit", DEFAULT_PCT)).toBe(0);
    expect(ownerTotal(percentFixed(rows, 5, "carOwnerSplit", DEFAULT_PCT))).toBe(0);
  });

  it("passes a real stored percent through unchanged", () => {
    const rows = [{ month: 6, carOwnerSplit: 70 }, { month: 8, carOwnerSplit: "50.00" }];
    expect(percentFixed(rows, 6, "carOwnerSplit", DEFAULT_PCT)).toBe(70);
    expect(percentFixed(rows, 8, "carOwnerSplit", DEFAULT_PCT)).toBe(50);
  });

  it("falls back to 50 when the car has no configured default", () => {
    expect(percentFixed([{ month: 2 }], 2, "carOwnerSplit", undefined)).toBe(50);
  });

  it("agrees with the pre-fix form whenever a percent is actually stored", () => {
    const rows = [{ month: 7, carOwnerSplit: 70, carManagementSplit: 30 }];
    for (const f of ["carOwnerSplit", "carManagementSplit"]) {
      expect(percentFixed(rows, 7, f, DEFAULT_PCT)).toBe(percentBuggy(rows, 7, f));
    }
  });
});
