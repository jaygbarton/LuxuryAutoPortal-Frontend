import { test, expect } from "@playwright/test";
import { loginAs } from "./helpers/auth";

// Flow 3: Submit a form (parking ticket) and see it appear in My Submissions.
//
// NOTE: the "Submit a Parking Ticket" section is only shown to Admin and
// Client roles in forms.tsx (parkingTicketSubmitItem is absent from the
// plain-Employee section list) — an Employee cannot reach this flow as
// literally described. Per prior discussion, this is tested as a Client
// login instead, which is the role the feature is actually built for.
//
// Requires the e2e-client fixture (see e2e/README.md): a `client` row whose
// client_email matches CREDENTIALS.client.email (case/whitespace-insensitive,
// per getClientIdFromSession), with at least one car whose car_client_id
// points at that client and car_status is not 'offboarded'/'deleted'.
test("client can submit a parking ticket and see it in My Submissions", async ({ page }) => {
  await loginAs(page, "client");

  await page.goto("/admin/forms?section=parking-ticket-forms");
  await page.getByText("Submit a Parking Ticket", { exact: true }).click();

  const amount = (Math.random() * 90 + 10).toFixed(2);

  await page.locator("#pt_car_id").click();
  await page.getByRole("option").first().click();

  await page.locator("#pt_amount").fill(amount);
  // Date of Receipt left at its default (today), set by the component itself.

  const [response] = await Promise.all([
    page.waitForResponse((r) => r.url().includes("/api/parking-tickets") && r.request().method() === "POST"),
    page.getByRole("button", { name: "Submit Parking Ticket" }).click(),
  ]);
  expect(response.status()).toBe(200);

  await expect(page.getByText("Parking Ticket Submitted Successfully")).toBeVisible();

  // Reset the submission form back to show My Submissions below it.
  await page.getByRole("button", { name: "Submit Another" }).click();

  const submissionsTable = page.locator("table").filter({ hasText: "Date of Receipt" });
  const newRow = submissionsTable.locator("tr", { hasText: "New" }).first();
  await expect(newRow).toBeVisible({ timeout: 10_000 });
  await expect(newRow).toContainText(`$${amount}`);
});
