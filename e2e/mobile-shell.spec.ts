import { expect, test, type Page } from "@playwright/test";
async function fixture(page: Page, role: "Employee" | "Admin" | "Client" | "CoHost" = "Employee", viewAsClient = false, clockedIn = false) {
  const errors: string[] = [];
  page.on("pageerror", error => errors.push(error.message));
  await page.route(url => url.pathname.startsWith("/api/"), async route => {
    const path = new URL(route.request().url()).pathname;
    let result: any = { success: true, data: [], total: 0, notifications: [], unreadCount: 0 };
    if (path === "/api/auth/me") result = { user: { id: 7, firstName: "Jordan", lastName: "Worker", roleName: role, isAdmin: role === "Admin" || role === "CoHost", isEmployee: role === "Employee", isClient: role === "Client", isCoHost: role === "CoHost", isSuperAdmin: false, effectiveTimezone: "America/Denver", ...(viewAsClient ? { viewAsClient: { clientId: 12 } } : {}) } };
    if (path === "/api/me/time-sheet/last") result = { success: true, data: { isClockedIn: clockedIn, openSession: clockedIn ? { time_aid: 1, time_in: "2026-10-18 14:00:00" } : null, lastRecord: null } };
    if (path === "/api/me/time-sheet/sessions") result = { success: true, data: { hourlyRate: 20, sessions: [] } };
    if (path === "/api/operations/day-schedule") result = { date: "2026-10-18", events: [], work_shifts: [] };
    if (path === "/api/me/preferences/day-schedule") result = { myTasksFirst: true, employeeId: 41 };
    if (path === "/api/expense-form-submissions/options") result = { data: { currentEmployeeId: 41, employees: [{ id: 41, name: "Jordan Worker" }], cars: [], categoryFields: {} } };
    await route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify(result) });
  });
  return errors;
}
for (const width of [360, 390, 430, 768]) test(`employee navigation fits ${width}px and keeps drawer focus contained`, async ({ page }) => {
  await page.setViewportSize({ width, height: 844 });
  const errors = await fixture(page);
  await page.goto("/admin/operations?tab=day-schedule&date=2026-10-18");
  const quick = page.getByRole("navigation", { name: "Quick navigation" });
  await expect(quick).toBeVisible();
  await expect(page.locator(".staff-app-shell")).toHaveCount(1);
  await expect(quick.getByRole("link", { name: "Schedule", exact: true })).toHaveAttribute("aria-current", "page");
  expect(await quick.getByRole("link", { name: "Home", exact: true }).getAttribute("href")).toBe("/staff/dashboard");
  await expect(quick.getByRole("link")).toHaveText(["Home", "Schedule", "Time Clock", "Forms"]);
  await expect(quick.getByRole("link", { name: "Time Clock", exact: true })).toHaveAttribute("href", "/staff/time");
  for (const link of await quick.locator("a,button").all()) {
    const rect = (await link.boundingBox())!;
    expect(rect.height).toBeGreaterThanOrEqual(44);
    expect(rect.x).toBeGreaterThanOrEqual(0);
    expect(rect.x + rect.width).toBeLessThanOrEqual(width);
  }
  const main = await page.locator("main").boundingBox(), bar = await quick.boundingBox();
  expect(main!.y + main!.height).toBeLessThanOrEqual(bar!.y + 1);
  await quick.getByRole("button", { name: "More navigation" }).click();
  const drawer = page.getByRole("dialog", { name: "Workspace navigation" });
  await expect(drawer).toBeVisible();
  await expect(drawer.getByRole("button", { name: "Close navigation" })).toBeFocused();
  await expect(page.locator('[data-testid="link-admin-developer"]')).toHaveCount(0);
  for (let i = 0; i < 7; i++) await page.keyboard.press("Tab");
  expect(await drawer.evaluate(el => el.contains(document.activeElement))).toBe(true);
  await page.keyboard.press("Escape");
  await expect(drawer).toHaveCount(0);
  await expect(quick.getByRole("button", { name: "More navigation" })).toBeFocused();
  await quick.getByRole("link", { name: "Forms", exact: true }).click();
  await expect(page).toHaveURL(/\/staff\/forms$/);
  await expect(quick.getByRole("link", { name: "Forms", exact: true })).toHaveAttribute("aria-current", "page");
  await expect(page.locator(".staff-app-shell")).toHaveCount(1);
  expect(errors).toEqual([]);
});

test("admin shortcuts retain admin home/forms; desktop keeps the sidebar", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await fixture(page, "Admin");
  await page.goto("/admin/operations?tab=day-schedule");
  const quick = page.getByRole("navigation", { name: "Quick navigation" });
  await expect(quick.getByRole("link", { name: "Home", exact: true })).toHaveAttribute("href", "/dashboard");
  await expect(quick.getByRole("link", { name: "Forms", exact: true })).toHaveAttribute("href", "/admin/forms");
  await page.setViewportSize({ width: 1280, height: 900 });
  await expect(quick).not.toBeVisible();
  await expect(page.getByRole("complementary", { name: "Workspace navigation" })).toBeVisible();
  await expect(page.locator("aside")).not.toHaveAttribute("inert");
  await expect(page.getByRole("button", { name: "Collapse navigation" })).toBeVisible();
});
for (const impersonating of [false, true]) test(`client has no employee shortcuts (impersonation ${impersonating})`, async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await fixture(page, impersonating ? "Admin" : "Client", impersonating);
  await page.goto("/admin/forms");
  await expect(page.getByRole("button", { name: "Open navigation" })).toBeVisible();
  await expect(page.getByRole("navigation", { name: "Quick navigation" })).toHaveCount(0);
  await page.getByRole("button", { name: "Open navigation" }).click();
  await expect(page.getByRole("dialog", { name: "Workspace navigation" })).toBeVisible();
  await expect(page.locator('[data-testid="link-admin-operations"]')).toHaveCount(0);
});

for (const role of ["Employee", "Admin", "CoHost"] as const) for (const clockedIn of [false, true]) {
  test(`${role} Time Clock opens the authorized clock ${clockedIn ? "out" : "in"} area`, async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    const errors = await fixture(page, role, false, clockedIn);
    const clockWrites: string[] = [];
    page.on("request", request => {
      if (request.method() === "POST" && /\/time-sheet\/clock-(in|out)/.test(request.url())) clockWrites.push(request.url());
    });
    await page.goto("/admin/operations?tab=day-schedule");
    const quick = page.getByRole("navigation", { name: "Quick navigation" });
    await expect(quick.getByRole("link")).toHaveText(["Home", "Schedule", "Time Clock", "Forms"]);
    await quick.getByRole("link", { name: "Time Clock", exact: true }).click();
    await expect(page).toHaveURL(new RegExp(role === "Employee" ? "/staff/time$" : "/admin/hr/time$"));
    await expect(quick.getByRole("link", { name: "Time Clock", exact: true })).toHaveAttribute("aria-current", "page");
    await expect(page.getByRole("button", { name: clockedIn ? "Clock out" : "Clock in", exact: true })).toBeVisible();
    await expect(quick.getByRole("link", { name: "Time Clock", exact: true })).toBeInViewport();
    if (!clockedIn) await page.screenshot({ path: `/private/tmp/gla-time-clock-update/${role.toLowerCase()}-time-clock.png` });
    expect(clockWrites).toEqual([]);
    expect(errors).toEqual([]);
  });
}
