import { expect, test } from "@playwright/test";
const car = {
  id: 7,
  name: "Toyota Sienna 2020",
  plate: "ABC123",
  vin: "5TDDZ3DCXLS239196",
  photo: null,
};
const m = {
  scope: "Current open reports; history within the selected period.",
  openIssueGroups: 1,
  originalOpenReports: 9,
  repeatedIssueGroups: 1,
  scheduledReports: 0,
  overdueServices: 1,
  dueSoonServices: 0,
  historyRecordsInPeriod: 1,
  undatedHistoryRecords: 1,
  historyWithFiles: 1,
  lastServiced: "2025-10-01",
  mileage: {
    miles: null,
    state: "unavailable",
    warning: "Current mileage is unknown.",
  },
  attention: [
    {
      id: "oil",
      label: "Oil change",
      status: "overdue",
      dueDate: "2025-10-01",
      milesRemaining: null,
    },
  ],
  repeatedReports: [{ id: 9, issues: ["Battery"], reports: 9, trips: 3 }],
  limits: { attentionOmitted: 0, repeatedGroupsOmitted: 0 },
  source: "/admin/operations?tab=service-due&car=7",
  notes: ["Do not add repeated history amounts."],
};
const f = {
  recordedIncome: 1000,
  recordedExpenses: 200,
  recordedCarProfit: 800,
  managementSplit: 300,
  ownerSplit: 500,
  missingIncomeMonths: [2],
  formula: "Income less recorded expenses.",
  notes: ["Income coverage is incomplete."],
  source:
    "/admin/cars/7/totals?filter=Month&from=2025&to=2025&fromMonth=1&toMonth=2",
};
for (const width of [390, 1280])
  test(`AI Hub reports and receipts at ${width}px`, async ({ page }) => {
    await page.setViewportSize({ width, height: 900 });
    const requests: URL[] = [];
    const errors: string[] = [];
    page.on("pageerror", (e) => errors.push(e.message));
    await page.route(
      (url) => url.pathname.startsWith("/api/"),
      async (route) => {
        const url = new URL(route.request().url());
        requests.push(url);
        let data: any = {
          success: true,
          data: [],
          notifications: [],
          unreadCount: 0,
        };
        if (url.pathname === "/api/auth/me")
          data = {
            user: {
              id: 41,
              name: "Andy",
              fullname: "Andy",
              isAdmin: true,
              isEmployee: false,
              roleName: "Admin",
              tourCompleted: true,
              effectiveTimezone: "America/Denver",
            },
          };
        if (url.pathname === "/api/ai-hub/cars")
          data = { cars: [car], nextOffset: null, canReadFinancials: true };
        if (url.pathname === "/api/ai-hub/cars/7/report")
          data = {
            schemaVersion: 1,
            generatedAt: "2026-10-21T18:00:00Z",
            aiCreditsUsed: 0,
            status: "partial",
            vehicle: car,
            period: {
              from: "2025-01-01",
              to: "2025-02-28",
              timezone: "America/Denver",
            },
            sections: {
              ...(url.searchParams.get("topic") !== "profitability"
                ? {
                    maintenance: { status: "ready", data: m },
                    lateReturns: {
                      status: "unavailable",
                      error: "Alert data could not be verified.",
                    },
                  }
                : {}),
              ...(url.searchParams.get("topic") !== "maintenance"
                ? { profitability: { status: "ready", data: f } }
                : {}),
            },
          };
        if (url.pathname === "/api/ai-hub/cars/7/history")
          data = {
            total: 1,
            nextOffset: null,
            records: [
              {
                id: "receipt:1",
                label: "Oil change",
                date: url.searchParams.get("undated") ? "" : "2025-01-01",
                dateBasis: "receipt_submission_date",
                status: "approved",
                amount: 90,
                notes: "Original service record.",
                files: [
                  "/api/service-workspace/cars/7/receipts/receipt%3A1/hash",
                ],
                filesOmitted: 0,
                reportCount: 1,
              },
            ],
          };
        await route.fulfill({ json: data });
      },
    );
    await page.goto("/admin/ai-hub");
    await expect(
      page.getByRole("heading", { name: "AI Hub", exact: true }),
    ).toBeVisible();
    await page.getByLabel("Year", { exact: true }).selectOption("2025");
    await page.getByLabel("To month", { exact: true }).selectOption("2");
    await page.getByLabel("Vehicle", { exact: true }).selectOption("7");
    await expect(
      page.getByRole("region", { name: "Maintenance", exact: true }),
    ).toContainText("9 reports across 3 linked trips");
    await expect(
      page.getByRole("region", { name: "Recorded financial results" }),
    ).toContainText("$800.00");
    await expect(page.getByRole("alert")).toContainText(
      "Alert data could not be verified",
    );
    await page
      .getByRole("button", { name: "Show service history and receipts" })
      .click();
    await expect(page.getByText("Original service record.")).toBeVisible();
    await expect(
      page.getByRole("link", { name: "Receipt / file 1" }),
    ).toHaveAttribute("href", /service-workspace.*receipts/);
    await page.getByLabel("Show undated records instead").check();
    await expect
      .poll(() =>
        requests.some(
          (u) =>
            u.pathname.endsWith("/history") &&
            u.searchParams.get("undated") === "1",
        ),
      )
      .toBe(true);
    await page.getByRole("button", { name: "Refresh report" }).click();
    await expect
      .poll(() => requests.some((u) => u.searchParams.get("refresh") === "1"))
      .toBe(true);
    const downloadPromise = page.waitForEvent("download");
    await page
      .getByRole("button", { name: "Download report", exact: true })
      .click();
    const download = await downloadPromise;
    expect(download.suggestedFilename()).toMatch(/^GLA-7-.*\.json$/);
    await page
      .getByRole("button", { name: "Profitability", exact: true })
      .click();
    await expect(
      page.getByRole("region", { name: "Maintenance", exact: true }),
    ).toHaveCount(0);
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= window.innerWidth + 1,
      ),
    ).toBe(true);
    await page.screenshot({
      path: `test-results/ai-hub-${width}.png`,
      fullPage: true,
    });
    await page.getByRole("link", { name: "Open source Totals" }).click();
    await expect
      .poll(() =>
        requests.some(
          (u) =>
            u.pathname === "/api/cars/7/totals" &&
            u.searchParams.get("from") === "2025" &&
            u.searchParams.get("toMonth") === "2" &&
            u.searchParams.get("filter") === "Month",
        ),
      )
      .toBe(true);
    expect(errors).toEqual([]);
  });
test("employee hub omits profitability and shows retry on request failure", async ({
  page,
}) => {
  let fail = true;
  await page.route(
    (url) => url.pathname.startsWith("/api/"),
    async (route) => {
      const path = new URL(route.request().url()).pathname;
      let data: any = { success: true, data: [] };
      if (path === "/api/auth/me")
        data = {
          user: {
            id: 20,
            name: "Employee",
            isEmployee: true,
            isAdmin: false,
            roleName: "Employee",
            tourCompleted: true,
          },
        };
      if (path === "/api/ai-hub/cars")
        data = { cars: [car], canReadFinancials: false, nextOffset: null };
      if (path === "/api/ai-hub/cars/7/report") {
        if (fail)
          return route.fulfill({
            status: 503,
            json: { error: "AI Hub data could not be loaded. Please retry." },
          });
        data = {
          generatedAt: "2026-10-21T18:00:00Z",
          status: "ready",
          vehicle: car,
          period: {
            from: "2025-01-01",
            to: "2025-02-28",
            timezone: "America/Denver",
          },
          sections: { maintenance: { status: "ready", data: m } },
        };
      }
      await route.fulfill({ json: data });
    },
  );
  await page.goto("/admin/ai-hub?car=7");
  await expect(
    page.getByRole("button", { name: "Profitability", exact: true }),
  ).toHaveCount(0);
  await expect(page.getByRole("alert")).toContainText("could not be loaded");
  fail = false;
  await page.getByRole("button", { name: "Retry report" }).click();
  await expect(
    page.getByRole("region", { name: "Maintenance", exact: true }),
  ).toBeVisible();
});
