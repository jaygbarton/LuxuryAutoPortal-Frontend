import { describe, it, expect } from "vitest";
import {
  computeAnnualSplitPercent,
  annualSplitPercentTooltip,
} from "../annualSplitPercent";

/**
 * The annual split percentage divided by 12 regardless of active months.
 *
 * IncomeExpenseTable.tsx's CategoryRow.formatTotal read:
 *
 *     const avgPercentage =
 *       percentageValues.reduce((sum, val) => sum + (val || 0), 0) / 12;
 *     return `$${total.toFixed(2)} (${avgPercentage.toFixed(0)}%)`;
 *
 * Every month with no data contributed a 0 to the numerator while still
 * counting in the denominator, so the Total column understated the split
 * percentage on any car that was not active all twelve months.
 *
 * Captured pre-fix (node, against the expression above):
 *     3-month car @ flat 50/50 ........ PRE-FIX 13%   DOLLAR-WEIGHTED 50%
 *     full-year @ 50/50 ............... PRE-FIX 50%   DOLLAR-WEIGHTED 50%
 *     2 months, 50% of $90k + 30% of $10k
 *                                       PRE-FIX  7%   DOLLAR-WEIGHTED 48%
 *     zero rental income .............. PRE-FIX  0%   DOLLAR-WEIGHTED dash
 *
 * Note the uneven case: the pre-fix mean said 7%, and even a "fixed" mean over
 * only the ACTIVE months would say 40%. The dollar-weighted figure is 48%,
 * because the 50% month carries nine times the dollars of the 30% month. That
 * is why the denominator is rental income rather than a month count.
 *
 * A month-counting denominator would also be wrong twice over: it drops a
 * legitimately stored 0% month (car_management_split = 0 is real — 1,109 rows,
 * the GLA-owned 100/0 arrangement) and divides by zero on a GLA-owned car
 * whose management row is 0% for the whole year.
 */

const z = (n: number) => Array(n).fill(0) as number[];

/** Pre-fix expression, kept beside the fix to prove divergence. */
const preFixMean = (pcts: number[]) =>
  pcts.reduce((sum, val) => sum + (val || 0), 0) / 12;

describe("computeAnnualSplitPercent — dollar-weighted, not a /12 mean", () => {
  it("reports 50% for a 3-month car at a flat 50/50 (pre-fix: 13%)", () => {
    const rental = [...z(9), 10000, 10000, 10000];
    const split = [...z(9), 5000, 5000, 5000];
    const { percent, reason } = computeAnnualSplitPercent(split, rental);

    expect(percent).toBeCloseTo(50, 10);
    expect(reason).toBeNull();
    // The bug: nine empty months dragged the mean down to 13%.
    expect(preFixMean([...z(9), 50, 50, 50])).toBeCloseTo(12.5, 10);
    expect(Math.round(preFixMean([...z(9), 50, 50, 50]))).toBe(13);
  });

  it("agrees with the pre-fix mean for a full twelve active months", () => {
    // The one case the old code got right — why this survived so long.
    const { percent } = computeAnnualSplitPercent(
      Array(12).fill(5000),
      Array(12).fill(10000),
    );
    expect(percent).toBeCloseTo(50, 10);
    expect(preFixMean(Array(12).fill(50))).toBeCloseTo(50, 10);
  });

  it("weights by dollars, not by month — differs from any mean", () => {
    // 50% of a $90,000 month + 30% of a $10,000 month.
    const rental = [...z(10), 90000, 10000];
    const split = [...z(10), 45000, 3000];
    const { percent } = computeAnnualSplitPercent(split, rental);

    // 48,000 / 100,000 = 48%.
    expect(percent).toBeCloseTo(48, 10);
    // Pre-fix /12 mean.
    expect(Math.round(preFixMean([...z(10), 50, 30]))).toBe(7);
    // Even a mean over only the active months would be wrong here.
    const activeMonthMean = (50 + 30) / 2;
    expect(activeMonthMean).toBe(40);
    expect(percent).not.toBeCloseTo(activeMonthMean, 5);
  });

  it("honours a genuine 0% split across the whole year (GLA-owned 100/0)", () => {
    // car_management_split = 0 is a real arrangement, not a synonym for unset.
    // A month-counting denominator would divide by zero here; this returns 0%.
    const { percent, reason } = computeAnnualSplitPercent(
      z(12),
      Array(12).fill(8000),
    );
    expect(percent).toBe(0);
    expect(reason).toBeNull();
  });

  describe("the two dash conditions are distinct", () => {
    it("zero rental income → no-denominator (never 0%, never NaN%)", () => {
      const { percent, reason } = computeAnnualSplitPercent(z(12), z(12));
      expect(percent).toBeNull();
      expect(reason).toBe("no-denominator");
      // Pre-fix this rendered a confident, wrong "0%".
      expect(Math.round(preFixMean(z(12)))).toBe(0);
    });

    it("zero rental income with known nonzero split is still no-denominator", () => {
      // The split dollars are known; there is simply no base. 0/0 would be NaN.
      const split = [...z(11), 500];
      const { percent, reason } = computeAnnualSplitPercent(split, z(12));
      expect(percent).toBeNull();
      expect(reason).toBe("no-denominator");
      expect(Number.isNaN(percent as unknown as number)).toBe(false);
    });

    it("an unknown month → incomplete-numerator, even though a sum is possible", () => {
      // March's split could not be computed (backend splitsUnavailable).
      const rental = Array(12).fill(10000);
      const split: (number | null)[] = Array(12).fill(5000);
      split[2] = null;

      const { percent, reason } = computeAnnualSplitPercent(split, rental);
      expect(percent).toBeNull();
      expect(reason).toBe("incomplete-numerator");

      // Summing only the months that DID compute would look authoritative and
      // understate the split — the hide-the-failure bug 6c08a49 fixed for
      // row/year totals. 55,000 / 120,000 = 45.83%, not the true 50%.
      const sumWhatComputed =
        (split.reduce<number>((s, v) => s + (v ?? 0), 0) /
          rental.reduce((s, v) => s + v, 0)) *
        100;
      expect(sumWhatComputed).toBeCloseTo(45.83, 2);
      expect(percent).not.toBe(sumWhatComputed);
    });

    it("treats undefined and NaN the same as null (unknown, not zero)", () => {
      const rental = Array(12).fill(1000);
      const withUndefined: (number | undefined)[] = Array(12).fill(500);
      withUndefined[5] = undefined;
      expect(computeAnnualSplitPercent(withUndefined, rental).reason).toBe(
        "incomplete-numerator",
      );

      const withNaN = Array(12).fill(500);
      withNaN[7] = NaN;
      expect(computeAnnualSplitPercent(withNaN, rental).reason).toBe(
        "incomplete-numerator",
      );
    });

    it("reports the unknown month when BOTH conditions hold", () => {
      // A failed computation is the more specific fact about the data, and the
      // more useful one to surface; a car with no income at all is unremarkable.
      const split: (number | null)[] = z(12);
      split[0] = null;
      const { percent, reason } = computeAnnualSplitPercent(split, z(12));
      expect(percent).toBeNull();
      expect(reason).toBe("incomplete-numerator");
    });

    it("gives the two conditions different tooltips", () => {
      const a = annualSplitPercentTooltip("no-denominator");
      const b = annualSplitPercentTooltip("incomplete-numerator");
      expect(a).not.toBe(b);
      expect(a).toMatch(/rental income/i);
      expect(a).toMatch(/not a 0% split/i);
      expect(b).toMatch(/could not be computed/i);
      expect(b).toMatch(/hide the failure/i);
    });
  });

  it("handles negative split dollars (a refund month) without dashing", () => {
    const rental = [...z(10), 10000, 10000];
    const split = [...z(10), 6000, -1000];
    const { percent, reason } = computeAnnualSplitPercent(split, rental);
    expect(percent).toBeCloseTo(25, 10);
    expect(reason).toBeNull();
  });

  it("ignores a non-numeric rental entry rather than producing NaN", () => {
    // getMonthValue never returns null today, but the reducer must not be the
    // thing that breaks if that ever changes.
    const rental = [...z(11), 10000] as unknown as number[];
    (rental as unknown as (number | null)[])[0] = null;
    const split = [...z(11), 5000];
    const { percent } = computeAnnualSplitPercent(split, rental);
    expect(percent).toBeCloseTo(50, 10);
  });
});
