import { test, expect } from "@playwright/test";
import { loginAs } from "./helpers/auth";

// Flow 4: Open a payment in AddEditPaymentModal and verify the owner-split
// total matches the same car's row in the Income & Expenses table.
//
// Both UIs independently reimplement the same calculateCarOwnerSplit formula
// (AddEditPaymentModal.tsx and IncomeExpenseTable.tsx) — this test guards
// against exactly the kind of drift already seen once between them.
//
// Requires an E2E_TEST_CAR_ID env var pointing at a real, active car this
// test account can view payments + income-expense for. See e2e/README.md.
const CAR_ID = process.env.E2E_TEST_CAR_ID;
test.skip(!CAR_ID, "E2E_TEST_CAR_ID env var not set — see e2e/README.md");

test("payment modal owner split matches the Income & Expenses table for the same car+month", async ({ page }) => {
  await loginAs(page, "admin");

  // Use a month we know already has I&E data: the previous calendar month,
  // so the golden path exercises real (not zeroed) figures.
  const now = new Date();
  const prevMonth = new Date(now.getFullYear(), now.getMonth() - 1, 1);
  const year = prevMonth.getFullYear();
  const month = prevMonth.getMonth() + 1; // 1-12
  const yearMonth = `${year}-${String(month).padStart(2, "0")}`;

  // --- Step A: read the owner split from AddEditPaymentModal ---
  await page.goto(`/admin/cars/${CAR_ID}/payments`);
  await page.getByRole("button", { name: "Add Payment" }).click();
  await expect(page.getByRole("dialog")).toBeVisible();

  await page.locator("#yearMonth").fill(yearMonth);

  const payableInput = page.locator("#payable");
  await expect(payableInput).toBeEnabled({ timeout: 10_000 });
  const modalSplit = await payableInput.inputValue();
  expect(modalSplit).toMatch(/^\d+\.\d{2}$/);

  // Close without saving — this test only reads figures, it doesn't create a payment.
  await page.keyboard.press("Escape");

  // --- Step B: read the same car+month's Car Owner Split from the I&E table ---
  await page.goto(`/admin/cars/${CAR_ID}/income-expense`);
  await page.getByRole("combobox", { name: /year/i }).click();
  await page.getByRole("option", { name: String(year), exact: true }).click();

  const splitRow = page.locator("tr", { hasText: "Car Owner Split" }).first();
  await expect(splitRow).toBeVisible({ timeout: 10_000 });

  // Column 0 is the sticky label cell; months are 1-indexed after it.
  const monthCell = splitRow.locator("td").nth(month);
  const cellText = await monthCell.textContent();
  const match = cellText?.match(/\$([\d,]+\.\d{2})/);
  expect(match, `Could not parse a dollar amount from I&E cell text: "${cellText}"`).not.toBeNull();
  const tableSplit = match![1].replace(/,/g, "");

  expect(tableSplit).toBe(modalSplit);
});
