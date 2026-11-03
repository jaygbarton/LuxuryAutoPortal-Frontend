import { expect, test, type Page } from "@playwright/test";
async function fixture(page: Page, admin = false) {
  let historyError = true,
    uploads = 0,
    creates = 0;
  await page.route("**/*", async (route) => {
    const url = new URL(route.request().url()),
      path = url.pathname;
    if (!["localhost", "127.0.0.1"].includes(url.hostname))
      return route.abort();
    if (!path.startsWith("/api/")) return route.continue();
    let status = 200,
      data: any = {
        success: true,
        data: [],
        total: 0,
        notifications: [],
        unreadCount: 0,
      };
    if (path === "/api/auth/me")
      data = {
        user: {
          id: 41,
          firstName: "Fixture",
          lastName: "Owner",
          email: "owner@example.test",
          isClient: !admin,
          isAdmin: admin,
          isSuperAdmin: admin,
          isEmployee: false,
          roleName: admin ? "Admin" : "Client",
          tourCompleted: true,
        },
      };
    if (path === "/api/public-page-status") data = { isPublic: true };
    if (path === "/api/client/profile")
      data = { success: true, data: { cars: [{ id: 55 }] } };
    if (path === "/api/client/vehicle-history")
      data = {
        cars: [
          {
            id: 55,
            make: "Toyota",
            model: "Sienna",
            year: "2020",
            plate: "TEST55",
            status: "off_fleet",
          },
        ],
      };
    if (path === "/api/client/vehicle-history/55") {
      if (historyError) {
        status = 503;
        data = { error: "History unavailable" };
      } else
        data = {
          history: [
            {
              id: "receipt:71",
              carId: 55,
              label: "Oil change",
              date: "2026-10-01",
              dateBasis: "receipt_submission_date",
              status: "approved",
              amount: 80,
              source: "Approved receipt",
              files: [
                "/api/client/vehicle-history/55/files/receipt%3A71/" +
                  "a".repeat(64),
              ],
              unavailableFiles: 0,
            },
          ],
        };
    }
    if (path === "/api/employees" && route.request().method() === "POST") {
      creates++;
      data = {
        success: true,
        data: { employeeId: 902 },
        passwordEmail: { status: "sent" },
      };
    }
    if (path === "/api/employees/902/upload-documents") {
      uploads++;
      status = uploads === 1 ? 503 : 200;
      data =
        uploads === 1 ? { error: "Storage unavailable" } : { success: true };
    }
    return route.fulfill({ status, json: data });
  });
  return {
    recover: () => {
      historyError = false;
    },
    counts: () => ({ creates, uploads }),
  };
}
test("owner history distinguishes a load failure from empty records and preserves the selected vehicle in reports", async ({
  page,
}) => {
  await page.setViewportSize({ width: 390, height: 844 });
  const state = await fixture(page);
  await page.goto("/client/maintenance-history?car=55");
  await expect(
    page
      .getByRole("alert")
      .filter({ hasText: "Service history could not be loaded" }),
  ).toBeVisible();
  await expect(
    page.getByText(
      "No completed service records or approved receipts are available for this vehicle yet.",
    ),
  ).toHaveCount(0);
  state.recover();
  await page.getByRole("button", { name: "Retry history" }).click();
  await expect(
    page.getByRole("heading", { name: "Oil change", exact: true }),
  ).toBeVisible();
  await expect(
    page.getByRole("link", { name: "Receipt / file 1" }),
  ).toHaveAttribute("href", /\/api\/client\/vehicle-history\/55\/files\//);
  await expect(
    page
      .getByRole("navigation", { name: "Vehicle reports" })
      .getByRole("link", { name: "Records & files" }),
  ).toHaveAttribute("href", "/admin/cars/55/records");
  expect(
    await page.evaluate(() => document.documentElement.scrollWidth),
  ).toBeLessThanOrEqual(390);
});
test("employee document retry reuses the saved employee and selected files after closing the dialog", async ({
  page,
}) => {
  const state = await fixture(page, true);
  await page.goto("/admin/hr/employees");
  await page.getByRole("button", { name: "Add", exact: true }).click();
  const form = page.getByRole("dialog");
  const values: Record<string, string> = {
    firstName: "Fixture",
    lastName: "Employee",
    workEmail: "employee@example.test",
    phoneNumber: "8010000000",
    street: "Test street",
    city: "Salt Lake City",
    state: "UT",
    country: "USA",
    zipCode: "84116",
    emergencyContactName: "Fixture contact",
    emergencyContactPhoneNumber: "8010000001",
    ssnEin: "000001234",
  };
  for (const [key, value] of Object.entries(values))
    await form.locator(`input[name="${key}"]`).fill(value);
  await form
    .locator("#driver-license-upload")
    .setInputFiles({
      name: "license.png",
      mimeType: "image/png",
      buffer: Buffer.from("fixture document"),
    });
  await form.getByRole("button", { name: "Save", exact: true }).click();
  await expect(
    form.getByRole("button", { name: "Retry documents" }),
  ).toBeVisible();
  expect(state.counts()).toEqual({ creates: 1, uploads: 1 });
  await expect(form.locator('input[name="firstName"]')).toBeDisabled();
  await form.getByRole("button", { name: "Cancel", exact: true }).click();
  await page.getByRole("button", { name: "Add", exact: true }).click();
  await expect(form.getByText("license.png", { exact: true })).toBeVisible();
  await form.getByRole("button", { name: "Retry documents" }).click();
  await expect(form).toHaveCount(0);
  expect(state.counts()).toEqual({ creates: 1, uploads: 2 });
});
