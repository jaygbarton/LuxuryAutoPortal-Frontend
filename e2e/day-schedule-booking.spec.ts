import { expect, test, type Page } from "@playwright/test";

function task(id: number, bookingKey: string, overrides: Record<string, unknown> = {}) {
  return { id, bookingKey, type: "cleaning", category: "Cleaning", car_name: `Vehicle task ${id}`, plate: "TEST123", guest_name: "Test Guest", assigned_to: "Test Worker", assigned_to_id: 41, start_time: "09:00", end_time: null, location: "Test airport", status: "new", notes: null, detail: null, reservation_id: "RES-208", extras: null, trip_start: "09:00", trip_end: "10:00", trip_start_mt: "2026-10-07 09:00", trip_end_mt: "2026-10-08 10:00", pickup_location: "Test airport", dropoff_location: "Test airport", location_tag: "slc", photos: null, car_photo: null, duration_minutes: 60, scheduled_day: "2026-10-07", ...overrides };
}

async function mock(page: Page, options: { developer?: boolean; cancelled?: boolean; failedFirst?: boolean; empty?: boolean; unassigned?: boolean } = {}) {
  const reads: string[] = [], mutations: { method: string; path: string; body: unknown }[] = [], errors: string[] = [];
  let lookupCount = 0;
  page.on("pageerror", (error) => errors.push(error.message));
  await page.route((url) => url.pathname.startsWith("/api/"), async (route) => {
    const url = new URL(route.request().url()), path = url.pathname;
    const method = route.request().method();
    let body: unknown = { success: true, data: [], total: 0, events: [], notifications: [], unreadCount: 0 };
    if (method !== "GET") {
      mutations.push({ method, path, body: route.request().postDataJSON() });
      body = { success: true };
    } else if (path === "/api/auth/me") body = { user: { id: 1, name: "Test Admin", fullname: "Test Admin", roleName: "Admin", isAdmin: true, isSuperAdmin: options.developer === true, isEmployee: false, isClient: false, effectiveTimezone: "America/Denver" } };
    else if (path.startsWith("/api/internal-calendar/bookings/")) {
      lookupCount++;
      if (options.failedFirst && lookupCount === 1) return route.fulfill({ status: 404, contentType: "application/json", body: JSON.stringify({ error: "Not found" }) });
      const key = decodeURIComponent(path.split("/").pop()!);
      body = { timezone: "America/Denver", event: { id: key, bookingKey: key, source: "turo", sourceId: 208, carId: 101, carName: "Test vehicle", title: "Turo reservation", start: "2026-10-07T01:00:00Z", end: "2026-10-09T18:00:00Z", status: options.cancelled ? "cancelled" : "booked", cancelled: options.cancelled === true, blocksAvailability: !options.cancelled, timeStatus: "confirmed", reservationId: "RES-208" } };
    } else if (path === "/api/operations/day-schedule") {
      reads.push(url.searchParams.get("date")!);
      const events = options.empty ? [] : options.unassigned ? [task(1, "turo:201", { assigned_to: null, assigned_to_id: null }), task(2, "turo:202", { assigned_to: null, assigned_to_id: null }), task(3, "turo:203", { assigned_to: null, assigned_to_id: null }), task(19, "turo:208", { assigned_to: null, assigned_to_id: null })] : [task(19, "turo:208"), task(208, "turo:209")];
      body = { date: url.searchParams.get("date"), events, work_shifts: [{ employee_id: 41, fullname: "Test Worker", start_time: "08:00", end_time: "17:00", shift_label: "Operations" }] };
    } else if (path === "/api/employees") body = { success: true, data: [{ employee_aid: 41, employee_first_name: "Test", employee_last_name: "Worker", employee_is_active: 1 }] };
    await route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify(body) });
  });
  return { reads, mutations, errors, lookupCount: () => lookupCount };
}

test("same-booking links retain the explicit day, hide rental previews from ordinary admins, and preserve editing", async ({ page }) => {
  const result = await mock(page);
  await page.goto("/admin/operations?tab=day-schedule&date=2026-10-07&booking=turo:208");
  await expect(page.getByLabel("Schedule date")).toHaveValue("2026-10-07");
  const strip = page.getByRole("region", { name: "Selected booking" });
  await expect(strip.getByText("Turo reservation · Test vehicle")).toBeVisible();
  const card = page.locator('[data-day-schedule-card][data-booking-key="turo:208"]');
  await expect(card).toHaveAttribute("data-booking-selected", "true");
  await expect(page.locator('[data-day-schedule-card][data-booking-key="turo:209"]')).not.toHaveAttribute("data-booking-selected");
  await expect(card.getByRole("link", { name: "Internal calendar", exact: true })).toHaveAttribute("href", /booking=turo%3A208.*date=2026-10-07/);
  await expect(page.getByRole("link", { name: "Car rental preview", exact: true })).toHaveCount(0);
  await card.getByRole("combobox", { name: "Task status" }).click();
  await page.getByRole("option", { name: "in progress", exact: true }).click();
  await expect.poll(() => result.mutations).toContainEqual({ method: "PATCH", path: "/api/operations/tasks/19/status", body: { status: "in_progress" } });
  await page.getByRole("button", { name: "Next day", exact: true }).click();
  await expect(page.getByLabel("Schedule date")).toHaveValue("2026-10-08");
  expect(result.errors).toEqual([]);
});

test("lookup resolves the viewer day; failed lookup can retry and developer previews remain private", async ({ page }) => {
  const result = await mock(page, { developer: true, failedFirst: true });
  await page.goto("/admin/operations?tab=day-schedule&booking=turo:208");
  await expect(page.getByRole("alert").filter({ hasText: "Booking not found" })).toBeVisible();
  await page.getByRole("button", { name: "Retry booking details", exact: true }).click();
  await expect(page.getByLabel("Schedule date")).toHaveValue("2026-10-06");
  const strip = page.getByRole("region", { name: "Selected booking" });
  await expect(strip.getByRole("link", { name: "Car rental preview", exact: true })).toHaveAttribute("href", /^\/admin\/developer\/car-rentals\?booking=turo%3A208&date=2026-10-06$/);
  await page.getByRole("button", { name: "Next day", exact: true }).click();
  await expect(page.getByLabel("Schedule date")).toHaveValue("2026-10-07");
  expect(result.mutations).toEqual([]);
  expect(result.errors).toEqual([]);
});

test("cancelled and Google block context never fabricate operational tasks", async ({ page }) => {
  const result = await mock(page, { cancelled: true, empty: true });
  await page.goto("/admin/operations?tab=day-schedule&date=2026-10-07&booking=block_off%3Agoogle%3A208");
  await expect(page.getByRole("region", { name: "Selected booking" }).getByText(/Cancelled booking/)).toBeVisible();
  await expect(page.locator("[data-day-schedule-card]")).toHaveCount(0);
  expect(result.mutations).toEqual([]);
  expect(result.errors).toEqual([]);
});

test("draft keys do not enter the live schedule or call the real booking lookup", async ({ page }) => {
  const result = await mock(page, { empty: true });
  await page.goto("/admin/operations?tab=day-schedule&date=2026-10-07&booking=direct_booking_preview%3A00000000-0000-4000-8000-000000000001");
  await expect(page.getByLabel("Schedule date")).toHaveValue("2026-10-07");
  await expect(page.getByRole("region", { name: "Selected booking" })).toHaveCount(0);
  expect(result.lookupCount()).toBe(0);
  expect(result.mutations).toEqual([]);
  expect(result.errors).toEqual([]);
});

test.describe("mobile booking selection", () => {
  test.use({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true });
  test("selected fourth unassigned task stays visible without hiding or dropping it", async ({ page }) => {
    const result = await mock(page, { unassigned: true });
    await page.goto("/admin/operations?tab=day-schedule&date=2026-10-07&booking=turo:208");
    await expect(page.locator('[data-day-schedule-card][data-booking-key="turo:208"]')).toBeVisible();
    expect(result.mutations).toEqual([]);
    expect(result.errors).toEqual([]);
  });
});
