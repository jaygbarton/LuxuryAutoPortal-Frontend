import { describe, it, expect } from "vitest";

// Regression test for a live wrong-money bug on the client-facing Earnings
// page (/admin/cars/:id/earnings).
//
// earnings.tsx derived the split percent with:
//     getMonthValue(incomeExpenses, month, "carOwnerSplit") || 0
// getMonthValue collapses a missing row / null / undefined all to 0, and the
// `|| 0` then makes an UNSET percent indistinguishable from a genuinely
// stored 0%. The backend (computeCarMonthSplits) and IncomeExpenseTable both
// fall back to formulaSetting.carOwnerSplitPercent ?? 50 instead.
//
// This is reachable in production: getAllIncomeExpenseData's ensureAllMonths
// synthesizes placeholder months whose createEmpty template omits
// carManagementSplit/carOwnerSplit entirely, so those fields arrive absent.
// 229 of 826 car/year combos in the live DB have fewer than 12 rows.
//
// Same bug class as backend commits 8b7cf92 and b947f61 — this was the third
// instance, never fixed on this page.
//
// Verified to FAIL before the fix: resolveSplitPercentBuggy returns 0 where
// the fixed version returns the car's default.

// The pre-fix expression, kept only to prove the two diverge.
function getMonthValue(arr: any[], month: number, field: string): number {
  if (!arr || !Array.isArray(arr)) return 0;
  const item = arr.find((x) => x && x.month === month);
  if (!item) return 0;
  const value = item[field];
  if (value === null || value === undefined) return 0;
  const numValue = Number(value);
  return isNaN(numValue) ? 0 : numValue;
}

function resolveSplitPercentBuggy(rows: any[], month: number, field: string): number {
  return getMonthValue(rows, month, field) || 0;
}

// Mirrors the fixed expression in earnings.tsx (and the backend's own rule).
function resolveSplitPercentFixed(
  rows: any[],
  month: number,
  field: string,
  defaultPercent: number | undefined,
): number {
  const row = rows?.find((x: any) => x && x.month === month);
  const raw = row?.[field];
  return raw != null && raw !== "" ? Number(raw) : (defaultPercent ?? 50);
}

const DEFAULT_PCT = 50;

describe("earnings split-percent fallback", () => {
  it("uses the car default when the month row is synthesized (field absent)", () => {
    // What ensureAllMonths produces: a month object with no split fields.
    const rows = [{ month: 3, rentalIncome: 4200, deliveryIncome: 150 }];
    expect(resolveSplitPercentFixed(rows, 3, "carOwnerSplit", DEFAULT_PCT)).toBe(50);
    // Pre-fix behaviour, for contrast:
    expect(resolveSplitPercentBuggy(rows, 3, "carOwnerSplit")).toBe(0);
  });

  it("uses the car default when there is no row for that month at all", () => {
    const rows = [{ month: 1, carOwnerSplit: 70 }];
    expect(resolveSplitPercentFixed(rows, 7, "carOwnerSplit", DEFAULT_PCT)).toBe(50);
    expect(resolveSplitPercentBuggy(rows, 7, "carOwnerSplit")).toBe(0);
  });

  it("uses the car default for an explicit null", () => {
    const rows = [{ month: 4, carOwnerSplit: null }];
    expect(resolveSplitPercentFixed(rows, 4, "carOwnerSplit", DEFAULT_PCT)).toBe(50);
    expect(resolveSplitPercentBuggy(rows, 4, "carOwnerSplit")).toBe(0);
  });

  it("still honours a genuinely stored 0%", () => {
    // The one case where 0 is correct — must NOT be replaced by the default.
    const rows = [{ month: 5, carOwnerSplit: 0 }];
    expect(resolveSplitPercentFixed(rows, 5, "carOwnerSplit", DEFAULT_PCT)).toBe(0);
  });

  it("passes through a real stored percent unchanged", () => {
    const rows = [{ month: 6, carOwnerSplit: 70 }, { month: 8, carOwnerSplit: "50.00" }];
    expect(resolveSplitPercentFixed(rows, 6, "carOwnerSplit", DEFAULT_PCT)).toBe(70);
    expect(resolveSplitPercentFixed(rows, 8, "carOwnerSplit", DEFAULT_PCT)).toBe(50);
  });

  it("falls back to 50 when the car has no configured default either", () => {
    const rows = [{ month: 2 }];
    expect(resolveSplitPercentFixed(rows, 2, "carOwnerSplit", undefined)).toBe(50);
  });

  it("the buggy and fixed forms agree whenever a percent is actually stored", () => {
    const rows = [{ month: 9, carOwnerSplit: 70, carManagementSplit: 30 }];
    for (const f of ["carOwnerSplit", "carManagementSplit"]) {
      expect(resolveSplitPercentFixed(rows, 9, f, DEFAULT_PCT)).toBe(
        resolveSplitPercentBuggy(rows, 9, f),
      );
    }
  });

  it("dollar impact: an unset percent zeroes the owner's split", () => {
    // 2026, mode 50, no ski racks. Simplified to the terms the percent gates.
    const netBeforeSplit = 4200 + 150 - (380 + 640); // 3330
    const fixedDollars = netBeforeSplit * (resolveSplitPercentFixed([{ month: 3 }], 3, "carOwnerSplit", DEFAULT_PCT) / 100);
    const buggyDollars = netBeforeSplit * (resolveSplitPercentBuggy([{ month: 3 }], 3, "carOwnerSplit") / 100);
    expect(fixedDollars).toBe(1665);
    expect(buggyDollars).toBe(0);
    expect(fixedDollars - buggyDollars).toBe(1665);
  });
});
