import { describe, it, expect } from "vitest";

/**
 * graphs-charts.tsx charted the car/year DEFAULT split, never the per-month one.
 *
 * calculateCarManagementSplit (~:131) read only
 *     incomeExpenseData?.formulaSetting?.carManagementSplitPercent ?? 50
 * and never looked at the month row's own carManagementSplit. Any month whose
 * split differs from the car's default — a 30/70 month on a 50/50 car, or a
 * 100/0 GLA-owned car — was charted at the wrong percentage, and
 * calculateCarOwnerSplit derives from it (rental − mgmt), so both series moved.
 *
 * Captured pre-fix, March stored 30/70 on a 50/50 car with $10,000 rental:
 *     PRE-FIX  mgmt $5000.00  owner $5000.00   (the 50% default)
 *     FIXED    mgmt $3000.00  owner $7000.00   (the stored 30%)
 * The owner's line was understated by $2,000 in that month alone. The page is
 * routed RequireRole {isAdmin, isClient}, so car owners see these charts.
 *
 * There is no `|| 0` anywhere in the buggy code — the defect is a MISSING
 * per-month read, which is why a token sweep for fallback operators missed it.
 *
 * The fix adopts the reader IncomeExpenseTable.tsx already uses (~:1818):
 * per-month raw, `!= null`, else the configured default, else 50.
 */

interface IEData {
  formulaSetting?: { carManagementSplitPercent?: number; carOwnerSplitPercent?: number };
  incomeExpenses?: any[];
}

/** Verbatim from graphs-charts.tsx — collapses a missing row/field to 0. */
function getMonthValue(arr: any[] = [], month: number, field: string): number {
  if (!arr || arr.length === 0) return 0;
  const m = arr.find((x: any) => Number(x.month) === Number(month));
  return m ? Number(m[field] || 0) : 0;
}

/** Pre-fix: consults only the car/year default. Kept to prove divergence. */
function mgmtSplitBuggy(data: IEData, month: number): number {
  const percent = data?.formulaSetting?.carManagementSplitPercent ?? 50;
  return getMonthValue(data?.incomeExpenses || [], month, "rentalIncome") * (percent / 100);
}

/** Fixed: per-month first, then the configured default, then 50. */
function mgmtSplitFixed(data: IEData, month: number): number {
  const monthRow = data?.incomeExpenses?.find(
    (x: any) => x && Number(x.month) === Number(month),
  );
  const rawStored = monthRow?.carManagementSplit;
  const percent =
    rawStored != null
      ? Number(rawStored)
      : (data?.formulaSetting?.carManagementSplitPercent ?? 50);
  return getMonthValue(data?.incomeExpenses || [], month, "rentalIncome") * (percent / 100);
}

const ownerSplit = (
  fn: (d: IEData, m: number) => number,
  data: IEData,
  month: number,
) => getMonthValue(data?.incomeExpenses || [], month, "rentalIncome") - fn(data, month);

/** 50/50 car; March overridden to 30/70; April left to the default. */
const DATA: IEData = {
  formulaSetting: { carManagementSplitPercent: 50, carOwnerSplitPercent: 50 },
  incomeExpenses: [
    { month: 3, rentalIncome: 10000, carManagementSplit: 30, carOwnerSplit: 70 },
    { month: 4, rentalIncome: 8000 },
  ],
};

describe("graphs-charts management split honours the per-month percent", () => {
  it("uses the month's stored 30% rather than the car's 50% default", () => {
    expect(mgmtSplitFixed(DATA, 3)).toBe(3000);
    expect(ownerSplit(mgmtSplitFixed, DATA, 3)).toBe(7000);
  });

  it("still uses the car default for a month with no stored split", () => {
    expect(mgmtSplitFixed(DATA, 4)).toBe(4000);
    expect(ownerSplit(mgmtSplitFixed, DATA, 4)).toBe(4000);
  });

  it("honours a stored 0% — the GLA-owned 100/0 arrangement", () => {
    // car_management_split = 0 is real (1,109 rows), not a synonym for unset:
    // GLA takes nothing and the owner takes the whole payout.
    const glaOwned: IEData = {
      formulaSetting: { carManagementSplitPercent: 50 },
      incomeExpenses: [{ month: 1, rentalIncome: 5000, carManagementSplit: 0, carOwnerSplit: 100 }],
    };
    expect(mgmtSplitFixed(glaOwned, 1)).toBe(0);
    expect(ownerSplit(mgmtSplitFixed, glaOwned, 1)).toBe(5000);
  });

  it("falls back to 50 when the car has no formula row at all", () => {
    const noFormula: IEData = { incomeExpenses: [{ month: 1, rentalIncome: 1000 }] };
    expect(mgmtSplitFixed(noFormula, 1)).toBe(500);
  });

  it("returns 0 for a month with no data", () => {
    expect(mgmtSplitFixed(DATA, 7)).toBe(0);
  });

  it("differs from the pre-fix reader exactly where the month overrides", () => {
    // March: the whole bug — $2,000 of the owner's income charted as GLA's.
    expect(mgmtSplitBuggy(DATA, 3)).toBe(5000);
    expect(mgmtSplitFixed(DATA, 3)).toBe(3000);
    expect(ownerSplit(mgmtSplitBuggy, DATA, 3)).toBe(5000);
    expect(ownerSplit(mgmtSplitFixed, DATA, 3)).toBe(7000);

    // A 100/0 car was charted as if GLA took half.
    const glaOwned: IEData = {
      formulaSetting: { carManagementSplitPercent: 50 },
      incomeExpenses: [{ month: 1, rentalIncome: 5000, carManagementSplit: 0 }],
    };
    expect(mgmtSplitBuggy(glaOwned, 1)).toBe(2500);
    expect(mgmtSplitFixed(glaOwned, 1)).toBe(0);
  });

  it("agrees with the pre-fix reader when no month overrides the default", () => {
    expect(mgmtSplitFixed(DATA, 4)).toBe(mgmtSplitBuggy(DATA, 4));
    expect(mgmtSplitFixed(DATA, 7)).toBe(mgmtSplitBuggy(DATA, 7));
  });
});
