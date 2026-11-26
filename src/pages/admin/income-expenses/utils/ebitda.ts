/**
 * EBITDA for the All Cars view of Income & Expenses — fleet-wide, every car
 * as if GLA owned it (owner payouts are not an expense here).
 *
 *   Total Income   = Rental Income + the additional income rows that sit
 *                    OUTSIDE Rental Income (Other Credit, Gas Reimbursement,
 *                    On-/Post-Trip Charging). Guest Cancellation is inside
 *                    Rental Income (carved out like Miles), so it is not
 *                    added again. Their costs
 *                    (e.g. Gas – Charged to Guest) are already in expenses.
 *   Total Expenses = Car Management + Car Owner car expenses + Office Support
 *                    − Car Payment. A car payment is loan principal (not an
 *                    expense) plus loan interest, which EBITDA excludes; the
 *                    interest belongs on the Interest row.
 *   EBITDA         = Total Income − Total Expenses
 *   Net Income     = EBITDA − (Interest + Taxes + Depreciation + Amortization)
 *   EBITDA Margin  = EBITDA / Total Income
 */
export const EBITDA_ADDITIONAL_INCOME_FIELDS = [
  "otherCreditIncome",
  "gasReimbursementIncome",
  "onTripChargingIncome",
  "postTripChargingIncome",
] as const;

const num = (v: unknown): number => {
  const n = Number(v);
  return Number.isFinite(n) ? n : 0;
};

export function ebitdaIncome(incomeRow: Record<string, unknown> | undefined): number {
  return (
    num(incomeRow?.rentalIncome) +
    EBITDA_ADDITIONAL_INCOME_FIELDS.reduce((sum, f) => sum + num(incomeRow?.[f]), 0)
  );
}

export function ebitdaExpenses(
  incomeRow: Record<string, unknown> | undefined,
  cogsRow: Record<string, unknown> | undefined,
  officeSupportTotal: number,
): number {
  return (
    num(incomeRow?.carManagementTotalExpenses) +
    num(incomeRow?.carOwnerTotalExpenses) +
    num(officeSupportTotal) -
    num(cogsRow?.carPayment)
  );
}
