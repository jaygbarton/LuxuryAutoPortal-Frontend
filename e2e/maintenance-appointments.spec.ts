import { expect, test, type Page } from "@playwright/test";

const ROOT = "/api/maintenance-appointments";
const carName = "Mercedes-Benz GLS 450 2025";
function record(id: number, description: string) {
  return { id, inspection_id: 77, car_id: 101, car_name: carName, service_type: "oil_change", task_description: description, assigned_to: "Worker One", assigned_to_id: 41, scheduled_date: "2026-10-14T16:00:00.000Z", due_date: null, status: "new", completed_date: null, notes: "Keep the owner receipt", photos: [], repair_shop: "SLC Service Shop", repair_shop_license: "SHOP101", google_event_id: null, created_at: "2026-10-13T16:00:00Z", updated_at: "2026-10-13T16:00:00Z", car_make: "Mercedes-Benz", car_model: "GLS 450", car_year: 2025, car_plate: "TEST123", car_vin: "4JGFF5KE8RA123456", owner_approval_status: "approved", owner_has_app_access: true };
}
const appointment = { maintenanceId: 601, carId: 101, startAt: "2026-10-14T16:00:00.000Z", endAt: "2026-10-16T16:00:00.000Z", timezone: "America/Denver", destination: "SLC Service Shop", version: 3, status: "confirmed", confirmedBy: 1, confirmedAt: "2026-10-13T18:00:00Z", cancelledAt: null };
const clear = { status: "clear", complete: true, canSchedule: true, checkedAt: "2026-10-13T18:00:00Z", conflicts: [], warnings: [] };
async function fixture(page: Page, options: { conflict?: boolean; unknown?: boolean; existing?: boolean; rejectConfirm?: boolean; terminal?: boolean; changedCar?: boolean; malformedNeeds?: boolean } = {}) {
  const records = [record(601, "Oil change needed"), record(602, "Brake repair needed")];
  if (options.terminal) records[0].status = "completed";
  let current: Record<string, any> | null = options.existing ? structuredClone(appointment) : null;
  const writes: { method: string; path: string; body: Record<string, any> }[] = [], checks: URL[] = [], errors: string[] = [];
  page.on("pageerror", error => errors.push(error.message));
  await page.route(url => url.pathname.startsWith("/api/"), async route => {
    const request = route.request(), url = new URL(request.url()), path = url.pathname, method = request.method();
    let body: unknown = { success: true, data: [], events: [], notifications: [], unreadCount: 0, total: 0, count: 0 };
    if (method !== "GET") writes.push({ method, path, body: request.postDataJSON() });
    if (path === "/api/auth/me") body = { user: { id: 1, fullname: "Worker Admin", email: "worker@example.test", roleName: "Admin", isAdmin: true, isEmployee: false, isSuperAdmin: false, isClient: false, effectiveTimezone: "America/Denver" } };
    else if (path === "/api/cars") body = { success: true, data: [{ id: 101, makeModel: "Mercedes-Benz GLS 450", year: 2025, plateNumber: "TEST123" }] };
    else if (path === "/api/employees") body = { data: [{ employee_aid: 41, employee_first_name: "Worker", employee_last_name: "One", employee_email: "worker@example.test", employee_is_active: 1 }] };
    else if (path === "/api/operations/maintenance") body = options.malformedNeeds ? { success: false, error: "Maintenance source was not readable" } : { data: [...records, records[0]], total: 3 };
    else if (/^\/api\/operations\/maintenance\/\d+$/.test(path) && method === "PUT") { Object.assign(records.find(record => record.id === Number(path.split("/").at(-1)))!, request.postDataJSON()); body = { success: true }; }
    else if (path === ROOT) body = { appointments: current ? [current] : [] };
    else if (path === `${ROOT}/601` || path === `${ROOT}/602`) {
      const task = records.find(record => record.id === Number(path.split("/").at(-1)))!;
      if (method === "PUT") {
        if (options.rejectConfirm) return route.fulfill({ status: 409, json: { error: "A Turo trip was added while confirming. Nothing was scheduled." } });
        current = { ...appointment, ...request.postDataJSON(), maintenanceId: task.id, version: (current?.version ?? 0) + 1 };
      } else if (method === "DELETE") current = { ...current, version: (current?.version ?? 0) + 1, status: "cancelled", cancelledAt: "2026-10-13T18:01:00Z" };
      body = method === "GET" ? { task: { id: task.id, carId: task.car_id, carName: task.car_name, status: task.status, repairShop: task.repair_shop }, appointment: current && current.maintenanceId === task.id ? current : null, version: current?.version ?? 0 } : { appointment: current };
    } else if (/^\/api\/maintenance-appointments\/\d+\/availability$/.test(path)) {
      checks.push(url);
      body = { carId: options.changedCar ? 102 : 101, version: current?.version ?? 0, availability: options.conflict ? { ...clear, status: "conflict", canSchedule: false, conflicts: [{ bookingKey: "turo:23", title: "Existing Turo rental", start: "2026-10-14T16:00:00Z", end: "2026-10-15T16:00:00Z" }] } : options.unknown ? { ...clear, status: "unknown", complete: false, canSchedule: false, warnings: ["The Google blocked-date source could not be verified."] } : clear };
    }
    return route.fulfill({ json: body });
  });
  return { records, writes, checks, errors, current: () => current };
}
async function openAppointment(page: Page) {
  await page.goto("/admin/operations?tab=maintenance&appointment=601");
  const dialog = page.getByRole("dialog", { name: "Maintenance appointment", exact: true });
  await expect(dialog.getByLabel("Destination / repair shop *", { exact: true })).toBeVisible();
  return dialog;
}
async function chooseDates(page: Page) {
  await page.getByLabel("Start date & time *", { exact: true }).fill("2026-10-14T10:00");
  await page.getByLabel("Days away (optional)").fill("2");
  await expect(page.getByLabel("Expected return date & time *", { exact: true })).toHaveValue("2026-10-16T10:00");
}

test("independent needs from the same inspection remain visible and legacy dates are not appointments", async ({ page }) => {
  const mock = await fixture(page); await page.goto("/admin/operations?tab=maintenance");
  await expect(page.getByText("Oil change needed", { exact: true })).toBeVisible();
  await expect(page.getByText("Brake repair needed", { exact: true })).toBeVisible();
  await expect(page.getByText("Maintenance needed — not scheduled", { exact: true })).toHaveCount(2);
  expect(await page.getByRole("article", { name: `Maintenance for ${carName}`, exact: true }).count()).toBe(2);
  expect(mock.writes).toEqual([]); expect(mock.checks).toEqual([]); expect(mock.errors).toEqual([]);
});

test("an unreadable maintenance feed is not displayed as an empty list", async ({ page }) => {
  const mock = await fixture(page, { malformedNeeds: true }); await page.goto("/admin/operations?tab=maintenance");
  await expect(page.getByText("Maintenance needs could not be loaded. No empty or complete list can be confirmed.")).toBeVisible();
  await expect(page.getByText("No maintenance records found", { exact: true })).toHaveCount(0);
  await expect(page.getByRole("button", { name: "Retry maintenance needs", exact: true })).toBeVisible();
  expect(mock.writes).toEqual([]); expect(mock.errors).toEqual([]);
});

test("availability and an explicit reviewed start and return are required before confirmation", async ({ page }) => {
  const mock = await fixture(page); const dialog = await openAppointment(page);
  await expect(dialog.getByRole("button", { name: "Confirm appointment", exact: true })).toBeDisabled();
  await chooseDates(page);
  await dialog.getByLabel("Destination / repair shop *", { exact: true }).fill("Confirmed Repair Shop, Salt Lake City");
  await dialog.getByRole("button", { name: "Check appointment availability", exact: true }).click();
  await expect(dialog.getByText("Availability checked — ready for your review", { exact: true })).toBeVisible();
  await expect(dialog.getByRole("button", { name: "Confirm appointment", exact: true })).toBeDisabled();
  expect(mock.writes).toEqual([]);
  await dialog.getByRole("checkbox", { name: "I have reviewed the destination, start, and return time and want to confirm this appointment." }).check();
  await dialog.getByRole("button", { name: "Confirm appointment", exact: true }).click();
  await expect(dialog).not.toBeVisible();
  expect(mock.writes).toEqual([{ method: "PUT", path: `${ROOT}/601`, body: { startAt: "2026-10-14T16:00:00.000Z", endAt: "2026-10-16T16:00:00.000Z", timezone: "America/Denver", destination: "Confirmed Repair Shop, Salt Lake City", version: 0, expectedCarId: 101 } }]);
  expect(mock.checks[0].searchParams.get("startAt")).toBe("2026-10-14T16:00:00.000Z");
  expect(mock.checks[0].searchParams.get("endAt")).toBe("2026-10-16T16:00:00.000Z");
  await expect(page.getByText("Oil change needed", { exact: true })).toBeVisible();
  expect(mock.errors).toEqual([]);
});

for (const state of ["conflict", "unknown"] as const) test(`${state} availability prevents scheduling and leaves the need unchanged`, async ({ page }) => {
  const mock = await fixture(page, { [state]: true }); const dialog = await openAppointment(page); await chooseDates(page);
  await dialog.getByRole("button", { name: "Check appointment availability", exact: true }).click();
  await expect(dialog.getByText(state === "conflict" ? "This appointment conflicts with existing bookings" : "Availability cannot be confirmed", { exact: true })).toBeVisible();
  await expect(dialog.getByRole("button", { name: "Confirm appointment", exact: true })).toBeDisabled();
  await expect(dialog.getByRole("checkbox")).toHaveCount(0);
  expect(mock.current()).toBeNull(); expect(mock.writes).toEqual([]); expect(mock.errors).toEqual([]);
});

test("the server can reject a newly added conflict without showing a confirmed appointment", async ({ page }) => {
  const mock = await fixture(page, { rejectConfirm: true }); const dialog = await openAppointment(page); await chooseDates(page);
  await dialog.getByRole("button", { name: "Check appointment availability", exact: true }).click();
  await dialog.getByRole("checkbox").check(); await dialog.getByRole("button", { name: "Confirm appointment", exact: true }).click();
  await expect(dialog.getByText("A Turo trip was added while confirming. Nothing was scheduled.")).toBeVisible();
  await expect(dialog.getByRole("button", { name: "Confirm appointment", exact: true })).toBeDisabled();
  expect(mock.current()).toBeNull(); expect(mock.writes).toHaveLength(1);
});

test("cancelled appointment leaves the maintenance report and owner approval in place", async ({ page }) => {
  const mock = await fixture(page, { existing: true }); const dialog = await openAppointment(page);
  await expect(dialog.getByText("Confirmed appointment", { exact: true })).toBeVisible();
  await dialog.getByRole("button", { name: "Cancel appointment", exact: true }).click();
  await dialog.getByRole("button", { name: "Confirm appointment cancellation", exact: true }).click();
  await expect(dialog).not.toBeVisible();
  expect(mock.writes).toEqual([{ method: "DELETE", path: `${ROOT}/601`, body: { version: 3 } }]);
  await expect(page.getByText("Appointment cancelled — need remains", { exact: true })).toBeVisible();
  expect(mock.records[0].owner_approval_status).toBe("approved");
  await expect(page.getByText("Oil change needed", { exact: true })).toBeVisible();
});

test("completed work does not prevent reviewing the vehicle’s existing return appointment", async ({ page }) => {
  const mock = await fixture(page, { existing: true, terminal: true }); const dialog = await openAppointment(page);
  await dialog.getByLabel("Expected return date & time *", { exact: true }).fill("2026-10-17T10:00");
  await dialog.getByRole("button", { name: "Check appointment availability", exact: true }).click();
  await dialog.getByRole("checkbox").check(); await dialog.getByRole("button", { name: "Confirm rescheduled appointment", exact: true }).click();
  await expect(dialog).not.toBeVisible();
  expect(mock.writes[0].body).toMatchObject({ version: 3, endAt: "2026-10-17T16:00:00.000Z" });
  expect(mock.records[0].status).toBe("completed");
});

test("editing a maintenance need preserves reporting fields without scheduling an appointment", async ({ page }) => {
  const mock = await fixture(page); await page.goto("/admin/operations?tab=maintenance");
  const card = page.getByRole("article", { name: `Maintenance for ${carName}`, exact: true }).filter({ hasText: "Oil change needed" });
  await card.getByRole("button", { name: "Edit", exact: true }).click();
  const dialog = page.getByRole("dialog", { name: "Edit Maintenance", exact: true });
  await expect(dialog.getByLabel("Suggested service date (not an appointment)")).toBeVisible();
  await expect(dialog.getByText("Setting a scheduled date adds this maintenance to the Google Calendar.")).toHaveCount(0);
  await dialog.getByPlaceholder("What maintenance is needed...").fill("Oil and filter change needed");
  await dialog.getByRole("button", { name: "Update", exact: true }).click();
  await expect(dialog).not.toBeVisible();
  expect(mock.writes).toHaveLength(1);
  expect(mock.writes[0].path).toBe("/api/operations/maintenance/601");
  expect(mock.writes[0].body).toMatchObject({ car_id: 101, assigned_to_id: 41, task_description: "Oil and filter change needed", notes: "Keep the owner receipt", photos: [] });
  expect(mock.checks).toEqual([]);
});

test("appointment confirmation review resets when dates or destination change", async ({ page }) => {
  await fixture(page); const dialog = await openAppointment(page); await chooseDates(page);
  await dialog.getByRole("button", { name: "Check appointment availability", exact: true }).click();
  await dialog.getByRole("checkbox").check();
  await expect(dialog.getByRole("button", { name: "Confirm appointment", exact: true })).toBeEnabled();
  await dialog.getByLabel("Destination / repair shop *", { exact: true }).fill("Different Repair Location");
  await expect(dialog.getByRole("button", { name: "Confirm appointment", exact: true })).toBeDisabled();
  await expect(dialog.getByRole("checkbox")).toHaveCount(0);
});

test("a changed vehicle cannot be scheduled from a stale report view", async ({ page }) => {
  const mock = await fixture(page, { changedCar: true }); const dialog = await openAppointment(page); await chooseDates(page);
  await dialog.getByRole("button", { name: "Check appointment availability", exact: true }).click();
  await expect(dialog.getByText("The maintenance record is now linked to a different vehicle. Reload it and verify the vehicle before scheduling.")).toBeVisible();
  await expect(dialog.getByRole("button", { name: "Confirm appointment", exact: true })).toBeDisabled();
  await expect(dialog.getByRole("checkbox")).toHaveCount(0);
  expect(mock.writes).toEqual([]); expect(mock.current()).toBeNull();
});

test("appointment editor fits a small screen", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 }); await fixture(page); const dialog = await openAppointment(page); await chooseDates(page);
  await dialog.getByRole("button", { name: "Check appointment availability", exact: true }).click();
  await expect(dialog.getByRole("checkbox")).toBeVisible();
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= document.documentElement.clientWidth)).toBe(true);
  expect(await dialog.evaluate(element => element.scrollWidth <= element.clientWidth)).toBe(true);
});
