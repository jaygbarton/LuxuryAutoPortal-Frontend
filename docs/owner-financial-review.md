# Owner reports and financial definitions

Reviewed November 3, 2026. Existing customer/car/employee IDs and accounting formulas are unchanged.

## Evidence and limits

The repository contains `backend/src/services/__tests__/statementContractSplit.test.ts`, transcribed from the owner's October 2026 reference statement for a 2025 year with a 50/50 contract in January–June and 70/30 from July. This is a useful customer-statement fixture, not an independently retrieved current production statement. No current private statement or ledger was available for a fresh end-to-end financial reconciliation.

The fixture's December printed $477 base/$333.90 owner share conflicts with its component rows: $627 minus $150 delivery minus $150 insurance equals $327, with a 70% share of $228.90. Difference: $150 in the base and $105 in the share. The existing formula is retained; reproducing a printed discrepancy would hide it. The fixture verifies the two contract periods separately, January–June net $6,208.41, and July–December owner split $2,464.70.

## Definitions to preserve

- Rental income, delivery/add-on income, reimbursements, vehicle costs and owner/management split are distinct categories. A receipt amount is evidence of a transaction; it is not automatically profit or another expense on top of an existing posted cell.
- Contract percentages are effective by month. A statement spanning different contracts uses separate blocks without leaking months from one block into another.
- Owner split/income is not the same as cash paid to the owner. Payment history, retained balances and expense allocation must be checked separately before calling a number profit or amount due.
- Service history deliberately does not sum every record into a total: a completed task, service-date override and receipt can describe one repair. Month-only records must not imply an exact service day.
- Missing rental figures remain unknown. The earlier unresolved question about “Days Rented” (charged rental days versus nights) is not decided by this release.

## Navigation repairs

- Owner dashboard/report links now reach **Vehicle service history**, **Records & files**, income/expenses, receipts and totals for the selected vehicle. Historical/off-fleet cars remain available in owner history; operational fleet filtering remains separate.
- Legacy owner-split, direct-delivery, COGS, income/expense-summary, financial-history and rental-value links retain the original car ID and valid year/month query context and open the corresponding report section. The year selector honors a valid requested year; the view remains an annual report.
- Office support is an all-cars report in the current software and routes to that aggregate view, not a nonexistent individual-car section. Section shortcuts respect the employee section whitelist.
- Failed history loads are errors with Retry; an empty successful response alone shows “no records.” File access verifies ownership before reading storage.

## Next financial sign-off

With a designated current customer statement, compare the same car ID/year/month against source income, approved form amounts, expenses, effective contract, owner share, reimbursements and actual payments. Resolve the $150 reference discrepancy with the business owner before changing formulas. No claim is made that local fixture checks certify every production statement.
