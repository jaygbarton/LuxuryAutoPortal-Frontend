/**
 * Annual split percentage for the four I&E split rows — single source of truth.
 *
 * The Total column of the Co-Host / GLA / Car Management / Car Owner Split rows
 * renders "$X (Y%)". Y used to be
 *
 *     percentageValues.reduce((sum, val) => sum + (val || 0), 0) / 12
 *
 * — a mean of the twelve per-month percentages with a hardcoded denominator of
 * 12, regardless of how many months actually have data. A car onboarded in
 * October at a flat 50/50 showed 13% (150 / 12), not 50%: the nine empty months
 * each contributed a 0 to the numerator while still counting in the divisor.
 *
 * The replacement is dollar-weighted: total split dollars over total rental
 * income. That is the figure a P&L would report, it needs no active-month
 * count, and it is immune to the two ways a month-counting denominator gets it
 * wrong — it neither drops a legitimately stored 0% month nor divides by zero
 * on a GLA-owned car whose management row is 0% all year.
 *
 * Rental income is the denominator for ALL FOUR rows, so the four percentages
 * are comparable side by side and Co-Host does not inherit a dash whenever
 * management happens to be unavailable.
 */

/** Rendered wherever a figure could not be computed. Never a number. */
export const ANNUAL_PERCENT_UNAVAILABLE = null;

/**
 * Why an annual split percentage could not be computed.
 *
 * The two reasons render identically (an em dash) but mean different things,
 * and a future reader should not take either for a redundant restatement of
 * the other:
 *
 *  • "no-denominator" — total rental income is 0, so there is no base to take a
 *    percentage OF. The split dollars may be perfectly well known. Arithmetic
 *    would yield 0/0 = NaN, or a bogus 0% if someone "helpfully" guarded it.
 *
 *  • "incomplete-numerator" — at least one month's split dollars are unknown
 *    (the backend flagged `splitsUnavailable`, so `getComputedMgmtSplitFromApi`
 *    returned undefined). The denominator is fine; it is the sum on top that
 *    cannot be completed. Summing only the months that did compute would
 *    understate the percentage while looking authoritative — the same
 *    hide-the-failure bug that commit 6c08a49 fixed for row and year totals.
 *
 * They are kept as distinct values so the tooltip can say which one applied.
 */
export type AnnualPercentUnavailableReason =
  | "no-denominator"
  | "incomplete-numerator";

export interface AnnualSplitPercentResult {
  /** The dollar-weighted percentage (0-100), or null when unavailable. */
  percent: number | null;
  /** Set only when `percent` is null. */
  reason: AnnualPercentUnavailableReason | null;
}

/**
 * Dollar-weighted annual split percentage: Σ split $ / Σ rental income × 100.
 *
 * @param monthlySplitAmounts 12 entries; `null`/`undefined` marks a month whose
 *   split the backend could not compute (NOT a zero).
 * @param monthlyRentalIncome 12 entries. These come from `getMonthValue`, which
 *   collapses an absent row or field to 0, so an entry is always a number and a
 *   zero here means "no rental income", not "unknown".
 *
 * Precedence note: the incomplete numerator is reported even when rental income
 * is also 0. Both are true in that case, but an unknown split is the more
 * specific fact about the data and the more useful thing to surface — a car
 * with no income at all is unremarkable, whereas a failed computation is a
 * defect worth seeing.
 */
export function computeAnnualSplitPercent(
  monthlySplitAmounts: readonly (number | null | undefined)[],
  monthlyRentalIncome: readonly number[],
): AnnualSplitPercentResult {
  const hasUnknownMonth = monthlySplitAmounts.some(
    (amount) => amount == null || (typeof amount === "number" && isNaN(amount)),
  );
  if (hasUnknownMonth) {
    return { percent: null, reason: "incomplete-numerator" };
  }

  const totalRentalIncome = monthlyRentalIncome.reduce(
    (sum, amount) => sum + (typeof amount === "number" && !isNaN(amount) ? amount : 0),
    0,
  );
  // A zero denominator is not a 0% split — there is simply nothing to take a
  // percentage of. Never render 0%, never render NaN%.
  if (totalRentalIncome === 0) {
    return { percent: null, reason: "no-denominator" };
  }

  const totalSplit = (monthlySplitAmounts as readonly number[]).reduce(
    (sum, amount) => sum + amount,
    0,
  );
  return {
    percent: (totalSplit / totalRentalIncome) * 100,
    reason: null,
  };
}

/** Tooltip text naming which of the two conditions produced the dash. */
export function annualSplitPercentTooltip(
  reason: AnnualPercentUnavailableReason,
): string {
  return reason === "no-denominator"
    ? "Annual percentage unavailable — total rental income is $0.00, so there is no base to take a percentage of. This is not a 0% split."
    : "Annual percentage unavailable — at least one month's split could not be computed. Averaging only the months that did compute would hide the failure.";
}
