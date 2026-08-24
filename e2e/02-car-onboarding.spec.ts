import { test, expect } from "@playwright/test";
import { loginAs } from "./helpers/auth";

// Flow 2: Complete car onboarding for a new car.
//
// KNOWN BLOCKER (not modified — see task instructions): the "Add New Car"
// dialog in src/pages/admin/CarOnboarding.tsx is unreachable through the UI.
// `isAddDialogOpen` (line 88) is only ever set to `false` (lines 197, 608,
// the Cancel button) — no button, icon, or handler anywhere in the file
// calls `setIsAddDialogOpen(true)`. The `Plus` icon imported at line 43 is
// never rendered. A real user cannot open this dialog today.
//
// This test documents the intended golden path and is expected to fail at
// the "open dialog" step until that trigger is wired up. Once it is, this
// test starts exercising the real flow end-to-end with no changes needed.
test("admin can onboard a new car via the Car On-boarding dialog", async ({ page }) => {
  await loginAs(page, "admin");

  await page.goto("/admin/forms?section=car-on");
  await page.getByText("Car On-boarding", { exact: true }).click();

  // BLOCKED: no known trigger opens this dialog today (see comment above).
  // If/when a trigger is added, replace this line with the real interaction,
  // e.g.: await page.getByRole("button", { name: /add new car/i }).click();
  await expect(
    page.getByRole("button", { name: /add new car/i }),
  ).toBeVisible({ timeout: 5_000 });

  await expect(page.getByRole("dialog")).toBeVisible({ timeout: 5_000 });

  const carLabel = `E2E Test Car ${Date.now()}`;

  await page.getByLabel("Name").fill("E2E Test Client");
  await page.getByLabel("Car Make/Model (Year)").fill(carLabel);
  await page.getByLabel("Plate #").fill("E2ETEST");

  const [response] = await Promise.all([
    page.waitForResponse((r) => r.url().includes("/api/cars/onboard") && r.request().method() === "POST"),
    page.getByRole("button", { name: "Confirm" }).click(),
  ]);
  expect(response.status()).toBe(200);

  await expect(page.getByText("New car added successfully")).toBeVisible();

  // The new car should now appear in the onboarding table (query
  // invalidation in CarOnboarding.tsx onSuccess, line 192).
  await expect(page.getByRole("cell", { name: carLabel })).toBeVisible({ timeout: 10_000 });
});
