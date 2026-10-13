import { expect, test, type Page } from "@playwright/test";

const calendarUrl = "/admin/trip-calendar?from=2026-10-10&to=2026-10-17";
const cars = [
  { carId: 101, carName: "Mercedes-Benz GLS", plate: "ABC123", status: "available", vin: "TESTVIN101" },
  { carId: 102, carName: "BMW X5", plate: "XYZ789", status: "off_fleet", vin: "TESTVIN102" },
  { carId: 103, carName: "Audi Q5", plate: "AUDI103", status: "available", vin: "TESTVIN103" },
  { carId: 104, carName: "Volvo XC90", plate: "VOLVO104", status: "available", vin: "TESTVIN104" },
];

function event(source: string, id: number, title: string, overrides: Record<string, unknown> = {}) {
  return {
    id: `${source}:${id}`, bookingKey: `${source}:${id}`, source, sourceId: id,
    carId: 101, carName: "Mercedes-Benz GLS", plate: "ABC123", title,
    start: "2026-10-13T15:00:00Z", end: "2026-10-15T15:00:00Z",
    status: "booked", cancelled: false, blocksAvailability: true,
    timeStatus: "confirmed", notes: "Synthetic calendar test record", ...overrides,
  };
}
const events = [
  event("turo", 1, "Active Turo trip", { reservationId: "TEST-RES-1", detailUrl: "/admin/turo-trips?q=TEST-RES-1" }),
  event("turo", 2, "Cancelled Turo trip", { carId: 104, carName: "Volvo XC90", plate: "VOLVO104", status: "cancelled", cancelled: true, blocksAvailability: false }),
  event("owner_rental", 3, "Owner personal use", { status: "car_blocked_off" }),
  event("block_off", 4, "Google blocked period", { id: "block_off:google:4", bookingKey: "block_off:google:4", status: "blocked" }),
  event("maintenance", 5, "Oil change", { start: "2026-10-14T15:00:00Z", end: "2026-10-14T16:00:00Z", status: "new" }),
  event("maintenance", 6, "Inspection without dates", { start: null, end: null, timeStatus: "missing", blocksAvailability: false, status: "new" }),
  event("owner_rental", 7, "Open-ended owner use", { carId: 102, carName: "BMW X5", plate: "XYZ789", end: null, timeStatus: "open_ended", status: "car_blocked_off" }),
  event("turo", 8, "Unmatched trip", { carId: null, carName: "Unmatched vehicle", plate: null }),
  event("direct_booking", 9, "Confirmed direct rental", { status: "confirmed" }),
];

function response() {
  return {
    role: "admin", timezone: "America/Denver", from: "2026-10-10", to: "2026-10-17",
    generatedAt: "2026-10-13T18:00:00Z", cars, events,
    warnings: ["One reservation has not been matched to a vehicle."],
    complete: true, availabilityComplete: false,
    sync: { status: "pending", lastSuccessAt: "2026-10-13T17:00:00Z", pending: 1, failed: 0, configured: true },
  };
}

async function mockCalendar(page: Page, options: { developer?: boolean; employee?: boolean; cohost?: boolean } = {}) {
  let failCalendar = false;
  let failMapping = false;
  const mappingUpdates = new Map<number, { classification: string; carId: number | null }>();
  const requests: URL[] = [];
  const mutations: string[] = [];
  const errors: string[] = [];
  page.on("pageerror", (error) => errors.push(error.message));
  await page.route((url) => url.pathname.startsWith("/api/"), async (route) => {
    const request = route.request();
    const url = new URL(request.url());
    if (request.method() !== "GET") mutations.push(`${request.method()} ${url.pathname}`);
    let payload: unknown = { success: true, data: [], unreadCount: 0 };
    if (request.method() === "PATCH" && /^\/api\/internal-calendar\/google-blocks\/\d+$/.test(url.pathname)) {
      if (failMapping) {
        await route.fulfill({ status: 503, contentType: "application/json", body: JSON.stringify({ error: "Calendar mapping could not be saved." }) });
        return;
      }
      mappingUpdates.set(Number(url.pathname.split("/").pop()), request.postDataJSON());
      payload = { success: true };
    } else if (url.pathname.startsWith("/api/internal-calendar/bookings/")) {
      requests.push(url);
      payload = { event: event("turo", 99, "Historical rental", { start: "2025-12-01T16:00:00Z", end: "2025-12-03T16:00:00Z" }), timezone: "America/Denver", role: options.employee ? "employee" : "admin" };
    } else if (url.pathname === "/api/auth/me") {
      payload = { user: {
        id: 1, email: "calendar@example.test", firstName: "Calendar", lastName: "Tester", roleName: options.cohost ? "Co-Host" : options.employee ? "Employee" : "Admin",
        isAdmin: !options.employee && !options.cohost, isEmployee: !!options.employee, isClient: false,
        isCoHost: !!options.cohost, isSuperAdmin: !!options.developer, effectiveTimezone: "America/Denver",
      } };
    } else if (url.pathname === "/api/internal-calendar/events") {
      requests.push(url);
      if (failCalendar) {
        await route.fulfill({ status: 503, contentType: "application/json", body: JSON.stringify({ error: "The booking source could not be read." }) });
        return;
      }
      const calendar = response();
      payload = {
        ...calendar,
        role: options.employee ? "employee" : "admin",
        events: calendar.events.map((item) => {
          const mapping = item.id.startsWith("block_off:google:") ? mappingUpdates.get(item.sourceId) : null;
          return mapping ? { ...item, carId: mapping.carId, googleClassification: mapping.classification, blocksAvailability: mapping.classification === "blocked" } : item;
        }),
      };
    } else if (url.pathname === "/api/turo-trips/calendar") {
      requests.push(url);
      payload = { success: true, role: "cohost", cars: [{ carId: 101, carName: "Scoped cohost car", plateNumber: "ABC123", carStatus: "available" }], trips: [], blockOffs: [], prices: [], sync: { lastSyncAt: null, hoursSinceSync: null, stale: false } };
    }
    await route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify(payload) });
  });
  return { requests, mutations, errors, fail: (value: boolean) => { failCalendar = value; }, failMapping: (value: boolean) => { failMapping = value; } };
}

test("shows every source, cancellations, overlapping events, and attention records", async ({ page }) => {
  const mock = await mockCalendar(page, { developer: true });
  await page.goto(calendarUrl);
  const calendar = page.getByTestId("fleet-calendar");
  await expect(calendar.getByText("9 of 9 events shown", { exact: false })).toBeVisible();
  for (const name of ["Active Turo trip", "Owner personal use", "Google blocked period", "Oil change", "Confirmed direct rental"]) {
    await expect(calendar.getByRole("button", { name: `${name} · Mercedes-Benz GLS`, exact: true })).toBeVisible();
  }
  await expect(calendar.getByRole("button", { name: "Cancelled · Cancelled Turo trip · Volvo XC90", exact: true })).toBeVisible();
  await expect(calendar.getByText("Records needing attention (3)")).toBeVisible();
  await expect(calendar.getByText("An empty period does not confirm that a vehicle is available for booking.")).toBeVisible();
  await expect(calendar.getByText("Google Calendar sync: pending")).toBeVisible();
  const bars = await calendar.getByTestId("fleet-calendar-timeline").getByRole("button").filter({ hasText: /Active Turo trip|Owner personal use|Google blocked period|Confirmed direct rental/ }).evaluateAll((buttons) => buttons.map((button) => (button as HTMLElement).style.top));
  expect(new Set(bars).size).toBe(4);
  expect(mock.requests[0].searchParams.get("timezone")).toBe("America/Denver");
  expect(mock.mutations).toEqual([]);
  expect(mock.errors).toEqual([]);
});

test("cancelled trips are visible history and do not make their vehicle look blocked", async ({ page }) => {
  await mockCalendar(page);
  await page.goto(calendarUrl);
  await page.getByRole("button", { name: "Cancelled · Cancelled Turo trip · Volvo XC90", exact: true }).click();
  const dialog = page.getByRole("dialog");
  await expect(dialog.getByText("Does not block availability", { exact: true })).toBeVisible();
  await expect(dialog.getByRole("link", { name: "Car rental preview", exact: true })).toHaveCount(0);
  await dialog.getByRole("button", { name: "Close", exact: true }).click();
  await page.getByRole("combobox", { name: "Blocking event filter" }).click();
  await page.getByRole("option", { name: "No blocking events in view", exact: true }).click();
  await expect(page.getByRole("button", { name: "Cancelled · Cancelled Turo trip · Volvo XC90", exact: true })).toBeVisible();
  await expect(page.getByRole("button", { name: "Active Turo trip · Mercedes-Benz GLS", exact: true })).toHaveCount(0);
});

test("hidden source bars never change the occupancy calculation", async ({ page }) => {
  await mockCalendar(page);
  await page.goto(calendarUrl);
  await page.getByRole("checkbox", { name: "Owner rentals", exact: true }).click();
  await page.getByRole("combobox", { name: "Blocking event filter" }).click();
  await page.getByRole("option", { name: "No blocking events in view", exact: true }).click();
  await expect(page.getByTestId("fleet-calendar-timeline").getByText("BMW X5", { exact: true })).toHaveCount(0);
  await expect(page.getByTestId("fleet-calendar-timeline").getByText("Audi Q5", { exact: true })).toBeVisible();
});

test("deep-links one booking across the internal calendar and developer preview", async ({ page }) => {
  await mockCalendar(page, { developer: true });
  await page.goto(`${calendarUrl}&booking=block_off%3Agoogle%3A4`);
  const dialog = page.getByRole("dialog");
  await expect(dialog.getByRole("heading", { name: "Google blocked period" })).toBeVisible();
  await expect(dialog.getByRole("link", { name: "Day schedule", exact: true })).toHaveAttribute("href", "/admin/operations?booking=block_off%3Agoogle%3A4&date=2026-10-13&tab=day-schedule");
  await expect(dialog.getByRole("link", { name: "Car rental preview", exact: true })).toHaveAttribute("href", "/admin/developer/car-rentals?booking=block_off%3Agoogle%3A4&date=2026-10-13");
});

test("opens a historical permalink through the protected point lookup", async ({ page }) => {
  const mock = await mockCalendar(page);
  await page.goto(`${calendarUrl}&booking=turo%3A99`);
  const dialog = page.getByRole("dialog");
  await expect(dialog.getByRole("heading", { name: "Historical rental" })).toBeVisible();
  await expect(dialog.getByText("Dec 1, 2025, 9:00 AM MST", { exact: true })).toBeVisible();
  expect(mock.requests.some((url) => url.pathname === "/api/internal-calendar/bookings/turo%3A99")).toBe(true);
  await dialog.getByRole("button", { name: "Show event in calendar" }).click();
  await expect(page.getByLabel("From", { exact: true })).toHaveValue("2025-11-28");
});

test("admins classify imported blocks and see save errors; staff remain read-only", async ({ page }) => {
  const mock = await mockCalendar(page);
  await page.goto(`${calendarUrl}&booking=block_off%3Agoogle%3A4`);
  const dialog = page.getByRole("dialog");
  await expect(dialog.getByRole("button", { name: "Ignore for availability", exact: true })).toBeVisible();
  mock.failMapping(true);
  await dialog.getByRole("button", { name: "Ignore for availability", exact: true }).click();
  await expect(dialog.getByText("Calendar mapping could not be saved.")).toBeVisible();
  mock.failMapping(false);
  await dialog.getByRole("button", { name: "Ignore for availability", exact: true }).click();
  await expect(dialog.getByText("Classification: ignored", { exact: true })).toBeVisible();
  await expect(dialog.getByText("Does not block availability", { exact: true })).toBeVisible();
  expect(mock.mutations).toEqual(["PATCH /api/internal-calendar/google-blocks/4", "PATCH /api/internal-calendar/google-blocks/4"]);
});

test("staff can inspect an imported period without classification controls", async ({ page }) => {
  await mockCalendar(page, { employee: true });
  await page.goto(`${calendarUrl}&booking=block_off%3Agoogle%3A4`);
  const dialog = page.getByRole("dialog");
  await expect(dialog.getByRole("heading", { name: "Google blocked period" })).toBeVisible();
  await expect(dialog.getByRole("button", { name: "Ignore for availability", exact: true })).toHaveCount(0);
  await expect(dialog.getByRole("combobox", { name: "Vehicle for imported Google period" })).toHaveCount(0);
});

test("shows source errors and keeps prior loaded data instead of an empty calendar", async ({ page }) => {
  const mock = await mockCalendar(page);
  await page.goto(calendarUrl);
  await expect(page.getByText("9 of 9 events shown", { exact: false })).toBeVisible();
  mock.fail(true);
  await page.getByRole("button", { name: "Refresh", exact: true }).click();
  await expect(page.getByText("Calendar could not be refreshed.")).toBeVisible();
  await expect(page.getByText("Previously loaded records remain visible. They may be out of date.")).toBeVisible();
  await expect(page.getByRole("button", { name: "Active Turo trip · Mercedes-Benz GLS", exact: true })).toBeVisible();
});

test("filters the list and lets staff open events without exposing developer workflows", async ({ page }) => {
  await mockCalendar(page, { employee: true });
  await page.goto(calendarUrl);
  await page.getByRole("button", { name: "List", exact: true }).click();
  await page.getByRole("checkbox", { name: "Show cancelled trips", exact: true }).click();
  await expect(page.getByRole("button", { name: "Cancelled · Cancelled Turo trip", exact: true })).toHaveCount(0);
  await page.getByRole("button", { name: "Active Turo trip", exact: true }).click();
  await expect(page.getByRole("dialog").getByRole("link", { name: "Day schedule", exact: true })).toBeVisible();
  await expect(page.getByRole("dialog").getByRole("link", { name: "Car rental preview", exact: true })).toHaveCount(0);
});

test("keeps co-hosts on their existing scoped booking feed", async ({ page }) => {
  const mock = await mockCalendar(page, { cohost: true });
  await page.goto(calendarUrl);
  await expect(page.getByRole("heading", { name: "Trips Calendar", exact: true })).toBeVisible();
  await expect(page.getByTestId("fleet-calendar")).toHaveCount(0);
  await expect.poll(() => mock.requests.some((url) => url.pathname === "/api/turo-trips/calendar")).toBe(true);
  expect(mock.requests.some((url) => url.pathname === "/api/internal-calendar/events")).toBe(false);
});

test("invalid ranges are explicit and do not request a guessed date window", async ({ page }) => {
  const mock = await mockCalendar(page);
  await page.goto(calendarUrl);
  await expect(page.getByText("9 of 9 events shown", { exact: false })).toBeVisible();
  const count = mock.requests.length;
  await page.getByLabel("From", { exact: true }).fill("2026-10-20");
  await expect(page.getByText("Choose valid dates in order", { exact: false })).toBeVisible();
  expect(mock.requests).toHaveLength(count);
});
