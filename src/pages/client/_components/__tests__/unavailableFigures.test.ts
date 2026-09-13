import { describe, it, expect } from "vitest";
import { fmt, UNAVAILABLE } from "../utils";

/**
 * A figure the backend could not compute must render as an em dash, never as
 * a number — and any total or average that includes such a month must dash too.
 *
 * The backend marks a month whose split computation threw with
 * `splitsUnavailable: true` (admin-routes.ts, commit 15110fa). Before this
 * change the client did `Number(ieRow?.computedCarOwnerSplit ?? 0)`, so the
 * failure rendered as $0.00 — indistinguishable from a genuinely zero month.
 * The zeros then flowed into the year totals, the monthly averages, and
 * Math.min/Math.max, so Worst/Best month cash flow also read $0.00.
 *
 * `fmt` is imported from the real module: it is the single formatter behind
 * every summary card and table cell on the client dashboard, so its null
 * behaviour is what actually decides whether a dash appears on screen.
 */

describe("fmt renders an unavailable figure as a dash", () => {
  it("null becomes an em dash, not $0.00", () => {
    // Pre-fix: fmt(null) === "$0.00" — the whole bug in one call.
    expect(fmt(null)).toBe(UNAVAILABLE);
    expect(fmt(null)).not.toBe("$0.00");
  });

  it("undefined becomes an em dash too", () => {
    expect(fmt(undefined)).toBe(UNAVAILABLE);
  });

  it("a genuine zero still renders $0.00", () => {
    // The distinction the whole change exists to preserve.
    expect(fmt(0)).toBe("$0.00");
    expect(fmt("0")).toBe("$0.00");
  });

  it("ordinary amounts are unchanged", () => {
    expect(fmt(1234.5)).toBe("$1,234.50");
    expect(fmt(-99)).toBe("$-99.00");
    expect(fmt("2500")).toBe("$2,500.00");
  });
});

/**
 * The propagation rule, mirroring dashboard.tsx: a total or average that
 * includes an unavailable month is itself unavailable. Summing only the
 * months that computed would silently re-hide the failure.
 */
const sumOrNull = (vals: (number | null)[]): number | null =>
  vals.some((v) => v === null) ? null : vals.reduce<number>((a, b) => a + (b as number), 0);

/** Pre-fix behaviour, kept to prove the two diverge. */
const sumCoercing = (vals: (number | null)[]): number =>
  vals.reduce<number>((a, b) => a + Number(b ?? 0), 0);

describe("totals and averages propagate unavailability", () => {
  const withGap = [100, 200, null, 400];
  const complete = [100, 200, 300, 400];

  it("a total including an unavailable month is null", () => {
    expect(sumOrNull(withGap)).toBeNull();
    expect(fmt(sumOrNull(withGap))).toBe(UNAVAILABLE);
  });

  it("the pre-fix sum silently under-reported instead", () => {
    // $700 looks like a real total; it is three quarters of one.
    expect(sumCoercing(withGap)).toBe(700);
    expect(fmt(sumCoercing(withGap))).toBe("$700.00");
  });

  it("a complete set still totals normally", () => {
    expect(sumOrNull(complete)).toBe(1000);
    expect(sumOrNull(complete)).toBe(sumCoercing(complete));
  });

  it("an average over an incomplete set is null, not a smaller number", () => {
    const s = sumOrNull(withGap);
    const avg = s === null ? null : s / withGap.length;
    expect(avg).toBeNull();
    expect(fmt(avg)).toBe(UNAVAILABLE);
  });

  it("min/max over an incomplete set is null, not 0", () => {
    // The compounding bug: `?? 0` zeros made Math.min return 0, so Worst
    // Month Cash Flow read $0.00 whenever any month failed.
    const profits = withGap;
    const incomplete = profits.some((p) => p === null);
    const worst = incomplete ? null : Math.min(...(profits as number[]));
    expect(worst).toBeNull();
    expect(fmt(worst)).toBe(UNAVAILABLE);

    const coercedWorst = Math.min(...profits.map((p) => Number(p ?? 0)));
    expect(coercedWorst).toBe(0); // pre-fix
  });

  it("a real zero month does NOT make the total unavailable", () => {
    expect(sumOrNull([100, 0, 200])).toBe(300);
    expect(fmt(sumOrNull([100, 0, 200]))).toBe("$300.00");
  });
});
