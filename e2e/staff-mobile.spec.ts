import { expect, test, type Page } from "@playwright/test";

async function fixture(page: Page) {
  const calls: { path: string; body: any }[] = [], errors: string[] = [];
  const tasks = [{ task_timer_aid: 19, task_timer_name: "Prepare Mercedes-Benz Sprinter for airport delivery", task_timer_car_name: "2023 Mercedes-Benz Sprinter — 4DNM4", task_timer_emp_list: '[{"id":41,"name":"Test Worker"}]', task_timer_status: 0, task_timer_date_end: "2026-10-18", task_timer_start_time: "14:30", task_timer_goal: "Operations Manager", task_timer_description: "Check the vehicle and bring the keys to the office.", task_timer_created: "2026-10-17" }];
  const employee = { employee_aid: 41, employee_first_name: "Test", employee_last_name: "Worker", employee_job_pay_job_title_name: "Operations", employee_job_pay_department_name: "Fleet", employee_email: "staff@example.test", employee_number: "E041" };
  page.on("pageerror", e => errors.push(e.message));
  await page.route(url => url.pathname.startsWith("/api/"), async route => {
    const request = route.request(), path = new URL(request.url()).pathname;
    const write = request.method() !== "GET" && request.method() !== "OPTIONS";
    const body = write && request.headers()["content-type"]?.includes("application/json") ? request.postDataJSON() : null;
    if (write) calls.push({ path, body });
    let result: any = { success: true, data: [], total: 0, notifications: [], unreadCount: 0 };
    if (path === "/api/auth/me") result = { user: { id: 7, name: "Test Worker", roleName: "Employee", isAdmin: false, isSuperAdmin: false, isEmployee: true, isClient: false, effectiveTimezone: "America/Denver" } };
    else if (path === "/api/me/employee") result = { success: true, data: employee };
    else if (path === "/api/news-media/dashboard") result = { success: true, slot1: [], slot2: [] };
    else if (path === "/api/me/time-sheet/last") result = { success: true, data: { isClockedIn: true, openSession: { time_aid: 1, time_in: "2026-10-18 14:00:00" }, lastRecord: null } };
    else if (path === "/api/me/time-sheet/sessions") result = { success: true, data: { hourlyRate: 20, sessions: [{ time_aid: 1, time_in: "2026-10-17 14:00:00", time_out: "2026-10-17 22:00:00", time_end_reason: "shift_end", time_form_details: "[]" }] } };
    else if (path === "/api/staff/leave") result = { success: true, total: 1, data: [{ leave_aid: 1, leave_is_status: 0, leave_date: "2026-10-20", leave_type: "day off", leave_hour: 8, leave_minute: 0, leave_remarks: "Family appointment" }] };
    else if (path === "/api/staff/task-management") result = { success: true, total: tasks.length, data: tasks };
    else if (path.endsWith("/task-management/19/status") && write) tasks[0].task_timer_status = body.task_timer_status;
    else if (path === "/api/expense-form-submissions/options") result = { data: { currentEmployeeId: 41, employees: [{ id: 41, name: "Test Worker" }], cars: [{ id: 101, name: "2023 Mercedes-Benz Sprinter" }], categoryFields: { reimbursedBills: [{ value: "gasReimbursed", label: "Gas Reimbursed" }] } } };
    await route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify(result) });
  });
  return { calls, errors };
}
async function noOverflow(page: Page) {
  const sizes = await page.evaluate(() => ({ width: innerWidth, body: document.body.scrollWidth, html: document.documentElement.scrollWidth }));
  expect(sizes.body).toBeLessThanOrEqual(sizes.width + 1);
  expect(sizes.html).toBeLessThanOrEqual(sizes.width + 1);
}

for (const width of [360, 390, 430]) test(`employee screens fit ${width}px with readable record cards and working task controls`, async ({ page }) => {
  await page.setViewportSize({ width, height: 844 });
  const state = await fixture(page);
  await page.goto("/staff/task-management");
  const tasks = page.locator("[data-staff-task-list]");
  await expect(tasks).toBeVisible(); await noOverflow(page);
  if (width === 390) await page.screenshot({ path: "/tmp/gla-staff-tasks-mobile.png", fullPage: true });
  const taskSummary = tasks.getByRole("button", { name: /^Task: Prepare Mercedes-Benz/ });
  await expect(taskSummary).toHaveAttribute("aria-expanded", "false");
  await expect(tasks.getByRole("combobox")).toHaveCount(0);
  await expect(tasks.getByRole("button", { name: "Details", exact: true })).toHaveCount(0);
  await taskSummary.click();
  await expect(taskSummary).toHaveAttribute("aria-expanded", "true");
  await tasks.getByRole("combobox").click();
  await page.getByRole("option", { name: "In Progress", exact: true }).click();
  await expect.poll(() => state.calls.some(c => c.path.endsWith("/19/status") && c.body.task_timer_status === 1)).toBe(true);
  await tasks.getByRole("button", { name: "Details", exact: true }).click();
  await expect(page.getByRole("dialog", { name: "Task details" })).toContainText("Operations Manager");
  await page.getByRole("dialog").getByRole("button", { name: "Close", exact: true }).click();
  await taskSummary.click();
  await expect(taskSummary).toHaveAttribute("aria-expanded", "false");
  await expect(tasks.getByRole("combobox")).toHaveCount(0);
  await page.goto("/staff/time-off");
  await expect(page.locator("[data-staff-leave-list]")).toContainText("Family appointment"); await noOverflow(page);
  await page.getByRole("button", { name: "Apply", exact: true }).click();
  await expect(page.getByRole("dialog", { name: "Apply for time off" })).toBeVisible(); await noOverflow(page);
  await page.getByRole("button", { name: "Cancel", exact: true }).click();
  await page.goto("/staff/time");
  await expect(page.locator("[data-staff-session-list]")).toBeVisible(); await noOverflow(page);
  if (width === 390) await page.screenshot({ path: "/tmp/gla-staff-time-mobile.png", fullPage: true });
  await page.getByRole("button", { name: "Clock out", exact: true }).click();
  await page.getByRole("button", { name: "End of shift", exact: true }).click();
  const submit = page.getByRole("button", { name: "Submit & Clock out", exact: true });
  await expect(submit).toBeDisabled();
  await page.getByLabel("I confirm that I have checked and do not have any company cards or car keys.", { exact: true }).check();
  await expect(submit).toBeEnabled(); await noOverflow(page);
  expect(state.errors).toEqual([]);
});

test("mobile Forms sections are reachable without opening the navigation drawer", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 }); await fixture(page);
  await page.goto("/staff/forms");
  await page.getByLabel("Choose a form", { exact: true }).click();
  await page.getByRole("option", { name: "My expense submissions", exact: true }).click();
  await expect(page).toHaveURL(/tab=expense-my/); await noOverflow(page);
});

test("mobile dashboard keeps the profile compact and desktop retains detailed records", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 }); const state = await fixture(page);
  await page.goto("/staff/dashboard");
  const profile = page.locator("[data-staff-profile-summary]");
  await expect(profile).toContainText("Test Worker");
  await expect(page.locator(".workspace-header")).toHaveCount(1);
  const earnings = page.getByRole("button", { name: "Earnings & pay periods", exact: true });
  await expect(earnings).toHaveAttribute("aria-expanded", "false");
  await earnings.click(); await expect(earnings).toHaveAttribute("aria-expanded", "true");
  await earnings.click();
  const height = await profile.evaluate(element => element.getBoundingClientRect().height);
  expect(height).toBeLessThan(100); await noOverflow(page);
  await page.screenshot({ path: "/tmp/gla-staff-dashboard-mobile.png", fullPage: false });
  await page.goto("/staff/my-info/personal-information");
  await expect(page.getByRole("tab", { name: "Job and Pay", exact: true })).toBeVisible(); await noOverflow(page);
  await page.setViewportSize({ width: 1440, height: 1000 });
  await page.goto("/staff/time");
  await expect(page.locator("[data-staff-session-list]")).toBeHidden();
  await expect(page.getByRole("columnheader", { name: "Duration", exact: true })).toBeVisible();
  expect(state.errors).toEqual([]);
});
