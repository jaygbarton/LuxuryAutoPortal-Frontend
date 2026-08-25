import { test, expect, type Page } from "@playwright/test";
import { loginAs } from "./helpers/auth";

// Flow 4: Open a payment in AddEditPaymentModal and verify the owner-split
// total matches the same car's row in the Income & Expenses table.
//
// Both UIs now READ the server-computed `computedCarOwnerSplit` field from
// GET /api/income-expense/:carId/:year (computeCarMonthSplits in
// incomeExpenseService-raw-sql.ts is the sole remaining implementation of
// the formula) rather than each independently recomputing it — this test
// guards against a UI regression that reads the wrong field/month, not
// against formula drift (there is only one formula left to drift from).
//
// Formula CORRECTNESS (branch coverage for both split modes, all ski-racks
// sub-branches, and the negative-balance carryover chain) is covered by
// backend unit tests: backend/src/services/__tests__/computeCarMonthSplits.test.ts.
// This spec's job is narrower: confirm the two UIs actually display what the
// server computed, end to end through a real browser session.
//
// Requires an E2E_TEST_CAR_ID env var pointing at a real, active car this
// test account can view payments + income-expense for. See e2e/README.md.
const CAR_ID = process.env.E2E_TEST_CAR_ID;
test.skip(!CAR_ID, "E2E_TEST_CAR_ID env var not set — see e2e/README.md");

// Reads computedCarOwnerSplit directly from the API for a given car/year/month
// — the server-side ground truth both UIs are expected to display verbatim.
async function readServerComputedSplit(page: Page, carId: string, year: number, month: number): Promise<number | undefined> {
  const response = await page.request.get(`/api/income-expense/${carId}/${year}`);
  const json = await response.json();
  const monthRow = json?.data?.incomeExpenses?.find((m: any) => m?.month === month);
  return typeof monthRow?.computedCarOwnerSplit === "number" ? monthRow.computedCarOwnerSplit : undefined;
}

// Reads the auto-calculated owner split from AddEditPaymentModal for a given
// car/yearMonth. Closes the modal without saving.
async function readModalSplit(page: Page, carId: string, yearMonth: string): Promise<string> {
  await page.goto(`/admin/cars/${carId}/payments`);
  await page.getByRole("button", { name: "Add Payment" }).click();
  await expect(page.getByRole("dialog")).toBeVisible();

  await page.locator("#yearMonth").fill(yearMonth);

  // #payable is intentionally always readOnly/disabled (it's an auto-calculated
  // field, never hand-edited) — wait for the async I&E fetch behind it to
  // populate a real (non-"0") value instead of checking enabled-state.
  //
  // Timeout is generous (45s, not the usual ~20s) because /api/income-expense
  // shares a MySQL connection pool with the Bouncie/Turo background cron jobs,
  // which periodically starve it for 15-20s+ under this dev environment's
  // known load pattern (see backend log: "Query execution timeout after 30
  // seconds" / "Previous sync still running"). The endpoint itself is not
  // slow by design — this only absorbs pre-existing environment contention.
  const payableInput = page.locator("#payable");
  await expect(async () => {
    const val = await payableInput.inputValue();
    expect(val).toMatch(/^\d+\.\d{2}$/);
  }).toPass({ timeout: 45_000 });
  const modalSplit = await payableInput.inputValue();

  // Close without saving — this test only reads figures, it doesn't create a payment.
  await page.keyboard.press("Escape");
  return modalSplit;
}

// Reads the Car Owner Split cell from the I&E table for a given car/year/month.
async function readTableSplit(page: Page, carId: string, year: number, month: number): Promise<string> {
  await page.goto(`/admin/cars/${carId}/income-expense`);
  const yearTrigger = page.getByRole("combobox").filter({ hasText: /^\d{4}$/ });
  // Same shared-DB-pool contention as the waits below — this combobox can't
  // render until the page's own /api/income-expense fetch resolves, which
  // can take longer than Playwright's default actionability timeout under
  // the known cron-induced load pattern.
  await yearTrigger.waitFor({ state: "visible", timeout: 45_000 });
  const currentYear = await yearTrigger.textContent();
  if (currentYear?.trim() !== String(year)) {
    await yearTrigger.click();
    await page.getByRole("option", { name: String(year), exact: true }).click();
  }

  const splitRow = page.locator("tr", { hasText: "Car Owner Split" }).first();
  await splitRow.scrollIntoViewIfNeeded();
  await expect(splitRow).toBeVisible({ timeout: 10_000 });

  // Column 0 is the sticky label cell; months are 1-indexed after it.
  const monthCell = splitRow.locator("td").nth(month);
  // While the I&E fetch is in flight the cell shows a "…" loading placeholder
  // (not a real $0.00) — wait for the async calculation to resolve to an
  // actual dollar figure before parsing it.
  // See the matching comment in readModalSplit above — same shared-DB-pool
  // contention applies here, so this uses the same generous 45s timeout.
  let cellText: string | null = null;
  let match: RegExpMatchArray | null | undefined = null;
  await expect(async () => {
    cellText = await monthCell.textContent();
    match = cellText?.match(/\$([\d,]+\.\d{2})/);
    expect(match, `Could not parse a dollar amount from I&E cell text: "${cellText}"`).not.toBeNull();
  }).toPass({ timeout: 45_000 });
  return match![1].replace(/,/g, "");
}

test("payment modal owner split matches the Income & Expenses table for the same car+month", async ({ page }) => {
  // Two 45s-capable waits (modal + table) can exceed the global 90s test
  // timeout under the same DB-pool contention noted above; give this test
  // more headroom rather than raising the timeout for every spec.
  test.setTimeout(150_000);
  await loginAs(page, "admin");

  // Use a month we know already has I&E data: the previous calendar month,
  // so the golden path exercises real (not zeroed) figures.
  const now = new Date();
  const prevMonth = new Date(now.getFullYear(), now.getMonth() - 1, 1);
  const year = prevMonth.getFullYear();
  const month = prevMonth.getMonth() + 1; // 1-12
  const yearMonth = `${year}-${String(month).padStart(2, "0")}`;

  const modalSplit = await readModalSplit(page, CAR_ID!, yearMonth);
  const tableSplit = await readTableSplit(page, CAR_ID!, year, month);
  const serverSplit = await readServerComputedSplit(page, CAR_ID!, year, month);

  expect(tableSplit).toBe(modalSplit);
  if (serverSplit !== undefined) {
    expect(modalSplit).toBe(serverSplit.toFixed(2));
  }
});

// Dedicated 70/30-mode case with a known-correct expected dollar value, so a
// regression that breaks ONLY the mode-70 branch (e.g. drops
// totalParkingFeeLabor, or re-applies ownerPercent to it) can't hide behind
// a modal-equals-table comparison where both sides are wrong the same way.
// The equivalent branch (and every other formula branch) is ALSO covered
// directly in backend/src/services/__tests__/computeCarMonthSplits.test.ts —
// this UI-level case stays because it additionally proves both frontend
// call sites actually surface the server value correctly end to end.
//
// Car 816, June 2026: mode 70 (30:70 split), car_owner_split=70%,
// rentalIncome=2617, deliveryIncome=150, totalCogs=140 (carInsurance, fixed
// field only — no approved form submissions in this category/month),
// totalDirectDelivery=0, totalParkingFeeLabor=125 (glaParkingFee=100 +
// laborCleaning=25 — the field this test specifically exercises, since it
// only applies in 70:30 months), negativeBalanceCarryOver=0, no ski racks
// income. Verified 2026-08-25 against the backend's own precomputed
// `computedCarOwnerSplit` field on GET /api/income-expense/816/2026 (=
// 1461.9) and confirmed live through both the modal and the I&E table.
test("payment modal owner split matches the I&E table for a 70:30-mode car+month with a known dollar value", async ({ page }) => {
  test.setTimeout(150_000);
  await loginAs(page, "admin");

  const CAR_816 = "816";
  const YEAR = 2026;
  const MONTH = 6;
  const EXPECTED_SPLIT = "1461.90";

  const modalSplit = await readModalSplit(page, CAR_816, `${YEAR}-0${MONTH}`);
  const tableSplit = await readTableSplit(page, CAR_816, YEAR, MONTH);
  const serverSplit = await readServerComputedSplit(page, CAR_816, YEAR, MONTH);

  expect(modalSplit).toBe(EXPECTED_SPLIT);
  expect(tableSplit).toBe(EXPECTED_SPLIT);
  expect(serverSplit).toBe(1461.9);
});
