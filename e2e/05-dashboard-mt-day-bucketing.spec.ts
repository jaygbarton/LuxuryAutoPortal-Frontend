import { test, expect, Page } from "@playwright/test";
import { loginAs, logout } from "./helpers/auth";

// Flow 5: Load a dashboard section and verify rows appear under the correct
// Mountain-Time day.
//
// CarBlockedOffSection.tsx has no visible MT-day column — it's a client-side
// filter that HIDES any block-off whose dropoff_date or block_off_end_date,
// converted to a Mountain-Time calendar day, is strictly before today's MT
// day (src/components/admin/dashboard/CarBlockedOffSection.tsx:132-147). A
// bug here would most likely be a UTC-instant comparison that hides a
// "planned end = today" block-off too early in the MT evening. We prove the
// boundary is handled correctly by submitting two real block-offs as a
// client (through the actual Car Block Off form) and checking which one the
// admin dashboard shows:
//   - plannedEnd = yesterday 23:00 MT  -> must be HIDDEN (already ended)
//   - plannedEnd = today 23:00 MT      -> must be VISIBLE (ends later today)
//
// Cleanup: clients cannot delete their own block-off submissions (DELETE
// /api/car-block-off/submissions/:id is requireAdmin-only), so teardown logs
// in as admin to remove the two test rows via the same UI the admin already
// uses for this (Trash icon in the Submissions table on the same page).

function toMtOffsetDateTimeLocal(daysFromToday: number, hour: number): string {
  // Build a wall-clock datetime-local string for America/Denver without
  // relying on the test runner's own timezone.
  const nowMt = new Date(
    new Date().toLocaleString("en-US", { timeZone: "America/Denver" }),
  );
  nowMt.setDate(nowMt.getDate() + daysFromToday);
  nowMt.setHours(hour, 0, 0, 0);
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${nowMt.getFullYear()}-${pad(nowMt.getMonth() + 1)}-${pad(nowMt.getDate())}T${pad(nowMt.getHours())}:00`;
}

async function submitBlockOff(page: Page, opts: { pickupDaysFromToday: number; plannedEndDaysFromToday: number; pickupLocation: string }) {
  await page.goto("/admin/car-block-off");
  await page.getByText("Select a car...").click();
  await page.getByRole("option").first().click();

  // The end date's native `min` = the pickup date/time (CarBlockOff.tsx:636),
  // so pickup must be <= planned end or the browser blocks submission.
  //
  // pickupLocation is the marker we assert on later: CarBlockedOffSection.tsx
  // only ever passes r.pickup_location to DashboardRecordCard (line 201) — a
  // drop-off/planned-end location is captured by the form but never rendered
  // on this card, so it can't be used as a visible test marker.
  const pickupDate = toMtOffsetDateTimeLocal(opts.pickupDaysFromToday, 9);
  const dateTimeInputs = page.locator('input[type="datetime-local"]');
  await dateTimeInputs.nth(0).fill(pickupDate);
  await page.getByPlaceholder("Address or description").first().fill(opts.pickupLocation);

  const endDate = toMtOffsetDateTimeLocal(opts.plannedEndDaysFromToday, 23);
  await dateTimeInputs.nth(1).fill(endDate);
  await page.getByPlaceholder("Address or description").nth(1).fill("E2E Test Drop Off Location");

  await page.getByRole("button", { name: "Personal Use" }).click();

  const [response] = await Promise.all([
    page.waitForResponse((r) => r.url().includes("/api/car-block-off/submit-pickup") && r.request().method() === "POST"),
    page.getByRole("button", { name: "Submit Car Block Off" }).click(),
  ]);
  expect(response.status()).toBe(200);
}

test("dashboard Car Blocked Off section shows only block-offs that haven't ended in Mountain Time", async ({ page }) => {
  const endedLocation = `E2E Ended PickUp ${Date.now()}`;
  const activeLocation = `E2E Active PickUp ${Date.now()}`;

  await loginAs(page, "client");
  // Picked up and ended entirely yesterday (MT) -> must be hidden from the dashboard.
  await submitBlockOff(page, { pickupDaysFromToday: -1, plannedEndDaysFromToday: -1, pickupLocation: endedLocation });
  // Picked up today, ends later today (MT) -> must remain visible all day today.
  await submitBlockOff(page, { pickupDaysFromToday: 0, plannedEndDaysFromToday: 0, pickupLocation: activeLocation });

  await logout(page);
  await loginAs(page, "admin");
  await page.goto("/dashboard");

  const sectionHeading = page.getByRole("heading", { name: "CAR BLOCKED OFF" });
  await sectionHeading.scrollIntoViewIfNeeded();
  await expect(sectionHeading).toBeVisible({ timeout: 20_000 });

  // Both locations are unique random test strings, so a page-wide check is
  // unambiguous even without scoping to the section container's DOM subtree.
  await expect(page.getByText(activeLocation)).toBeVisible({ timeout: 15_000 });
  await expect(page.getByText(endedLocation)).not.toBeVisible();

  // --- Cleanup: delete both test submissions (admin-only capability) ---
  await page.goto("/admin/car-block-off");
  for (const location of [endedLocation, activeLocation]) {
    const row = page.locator("tr", { hasText: location });
    await expect(row.first()).toBeVisible({ timeout: 10_000 });
    await row.first().getByRole("button").last().click();
    await expect(page.getByRole("alertdialog")).toBeVisible({ timeout: 5_000 });
    const [deleteResponse] = await Promise.all([
      page.waitForResponse((r) => /\/api\/car-block-off\/submissions\/\d+$/.test(r.url()) && r.request().method() === "DELETE"),
      page.getByRole("alertdialog").getByRole("button", { name: "Delete" }).click(),
    ]);
    expect(deleteResponse.status(), `Failed to delete test block-off "${location}"`).toBe(200);
    await expect(row).toHaveCount(0, { timeout: 10_000 });
  }
});
