import { expect, test, type Page } from "@playwright/test";

const calendarUrl = "/admin/trip-calendar?from=2026-10-10&to=2026-10-17";

test('offers confirmed-email recovery and a reservation-specific review link without hiding unresolved dates', async ({page}) => {
  await mockCalendar(page);
  await page.route('**/api/internal-calendar/events?*', route => route.fulfill({contentType:'application/json',body:JSON.stringify({...response(),warnings:['1 turo records have an unknown end time.']})}));
  let requests = 0;
  await page.route('**/api/internal-calendar/date-recovery', async route => {
    if(route.request().method()==='POST') { requests++; await route.fulfill({status:202,contentType:'application/json',body:'{"accepted":true}'}); }
    else await route.fulfill({contentType:'application/json',body:JSON.stringify({issues:[{tripId:7,reservationId:'12345678',result:'needs_review',error:'No confirmed Turo booking email was found.'}]})});
  });
  await page.goto(calendarUrl);
  await expect(page.getByText('No confirmed Turo booking email was found.',{exact:false})).toBeVisible();
  await expect(page.getByRole('link',{name:'Review trip'})).toHaveAttribute('href','/admin/turo-trips?reservation=12345678');
  await page.getByRole('button',{name:'Recover trip dates'}).click();
  await expect(page.getByRole('status').filter({hasText:'Recovery requested'})).toBeVisible();
  expect(requests).toBe(1);
  await expect(page.getByText('Calendar coverage needs attention.')).toBeVisible();
});
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
  event("maintenance", 5, "Oil change appointment", { start: "2026-10-14T15:00:00Z", end: "2026-10-14T16:00:00Z", status: "scheduled", destination: "Example vehicle service shop", maintenanceWorkStatus: "in_progress", appointmentVersion: 2 }),
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

async function mockCalendar(page: Page, options: { developer?: boolean; employee?: boolean; cohost?: boolean; firstGoogleSync?: boolean; importError?: string } = {}) {
  let failCalendar = false;
  let failMapping = false;
  let failSync = false;
  let syncAccepted = false;
  let syncPolls = 0;
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
    if (request.method() === "POST" && url.pathname === "/api/internal-calendar/sync") {
      if (failSync) {
        await route.fulfill({ status: 503, contentType: "application/json", body: JSON.stringify({ error: "Google synchronization could not start." }) });
      } else {
        syncAccepted = true;
        await route.fulfill({ status: 202, contentType: "application/json", body: JSON.stringify({ accepted: true }) });
      }
      return;
    } else if (request.method() === "GET" && url.pathname === "/api/internal-calendar/sync") {
      const completed = syncAccepted && ++syncPolls >= 2;
      const lastSuccess = completed ? new Date(Date.now() + 1000).toISOString() : options.firstGoogleSync ? null : "2026-10-13T17:00:00Z";
      payload = {
        sync: { status: completed ? "synced" : "pending", pending: completed || options.firstGoogleSync ? 0 : 1, failed: 0, configured: true, enabled: true, lastSuccessAt: lastSuccess, lastError: null },
        import: { lastSuccess, lastError: options.importError ?? null }, enabled: true,
      };
    } else if (request.method() === "PATCH" && /^\/api\/internal-calendar\/google-blocks\/\d+$/.test(url.pathname)) {
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
  return { requests, mutations, errors, fail: (value: boolean) => { failCalendar = value; }, failMapping: (value: boolean) => { failMapping = value; }, failSync: (value: boolean) => { failSync = value; } };
}

test("shows every source, cancellations, overlapping events, and attention records", async ({ page }) => {
  const mock = await mockCalendar(page, { developer: true });
  await page.goto(calendarUrl);
  const calendar = page.getByTestId("fleet-calendar");
  await expect(calendar.getByText("9 of 9 events shown", { exact: false })).toBeVisible();
  for (const name of ["Active Turo trip", "Owner personal use", "Google blocked period", "Oil change appointment", "Confirmed direct rental"]) {
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

test("shows pending Google status before the first import even when no events are queued", async ({ page }) => {
  await mockCalendar(page, { firstGoogleSync: true });
  await page.goto(calendarUrl);
  const status = page.getByRole("region", { name: "Google Calendar status" });
  await expect(status.getByRole("heading", { name: "Google Calendar: Configured · first connection pending", exact: true })).toBeVisible();
  await expect(status.getByText("Google Calendar sync: pending · 0 pending · 0 failed", { exact: true })).toBeVisible();
  await expect(status.getByText("Not completed yet", { exact: true })).toHaveCount(2);
});

test("shows the actual Google import error alongside its connection status", async ({ page }) => {
  await mockCalendar(page, { firstGoogleSync: true, importError: "invalid_grant: The refresh token has expired." });
  await page.goto(calendarUrl);
  const status = page.getByRole("region", { name: "Google Calendar status" });
  await expect(status.getByRole("heading", { name: "Google Calendar: Connection needs attention", exact: true })).toBeVisible();
  await expect(status.getByText("Google import failed: invalid_grant: The refresh token has expired.", { exact: true })).toBeVisible();
});

test("Sync now reports acceptance, polls to completion, and exposes failed requests", async ({ page }) => {
  const mock = await mockCalendar(page, { firstGoogleSync: true });
  await page.goto(calendarUrl);
  const status = page.getByRole("region", { name: "Google Calendar status" });
  const sync = status.getByRole("button", { name: "Sync now", exact: true });
  await expect(sync).toBeEnabled();
  mock.failSync(true);
  await sync.click();
  await expect(status.getByText("Google synchronization could not start.", { exact: true })).toBeVisible();
  mock.failSync(false);
  await sync.click();
  await expect(status.getByText("Sync request accepted. Checking Google import and updates…", { exact: true })).toBeVisible();
  await expect(status.getByText("Google synchronization completed.", { exact: true })).toBeVisible({ timeout: 15_000 });
  await expect(status.getByRole("heading", { name: "Google Calendar: Connected", exact: true })).toBeVisible();
  expect(mock.mutations).toEqual(["POST /api/internal-calendar/sync", "POST /api/internal-calendar/sync"]);
});

test("staff can read Google status and open the real scheduled appointment without a sync action", async ({ page }) => {
  await mockCalendar(page, { employee: true });
  await page.goto(calendarUrl);
  await expect(page.getByRole("checkbox", { name: "Scheduled maintenance", exact: true })).toBeVisible();
  await expect(page.getByRole("button", { name: "Sync now", exact: true })).toHaveCount(0);
  await page.getByRole("button", { name: "Oil change appointment · Mercedes-Benz GLS", exact: true }).click();
  await expect(page.getByRole("dialog").getByText("Example vehicle service shop", { exact: true })).toBeVisible();
  await expect(page.getByRole("dialog").getByText("in progress", { exact: true })).toBeVisible();
  await expect(page.getByRole("dialog").getByRole("link", { name: "Open maintenance appointment", exact: true }))
    .toHaveAttribute("href", "/admin/operations?tab=maintenance&appointment=5");
});

for (const width of [360, 390, 430]) {
  test(`mobile ${width}: agenda contains every record, filters stay accessible, and booking links fit`, async ({ page }) => {
    await page.setViewportSize({ width, height: 844 });
    const mock = await mockCalendar(page, { employee: true });
    await page.goto(calendarUrl);
    const calendar = page.getByTestId("fleet-calendar");
    const agenda = calendar.getByTestId("fleet-calendar-agenda");
    await expect(agenda).toBeVisible();
    await expect(agenda.getByRole("button")).toHaveCount(9);
    expect((await agenda.getByRole("button").first().boundingBox())!.y).toBeLessThanOrEqual(500);
    await expect.poll(() => calendar.getByRole("textbox", { name: "Search vehicle or plate" }).evaluate((input) => parseFloat(getComputedStyle(input).fontSize))).toBeGreaterThanOrEqual(16);
    if (width === 390) await page.screenshot({ path: "/tmp/gla-calendar-mobile-top.png", fullPage: false, animations: "disabled" });
    await expect(agenda.getByRole("button", { name: "Inspection without dates · Mercedes-Benz GLS", exact: true })).toBeVisible();
    await expect(agenda.getByRole("button", { name: "Open-ended owner use · BMW X5", exact: true })).toContainText("Ongoing / no end recorded");
    const coverage = calendar.getByRole("button", { name: "Calendar coverage needs attention.", exact: true });
    await expect(coverage).toHaveAttribute("aria-expanded", "false");
    await coverage.click();
    await expect(page.getByText("An empty period does not confirm that a vehicle is available for booking.")).toBeVisible();
    await expect(page.getByText("One reservation has not been matched to a vehicle.")).toBeVisible();
    await coverage.click();
    await expect(page.getByRole("button", { name: "Sync now", exact: true })).toHaveCount(0);
    await calendar.getByRole("button", { name: "Google sync details", exact: true }).click();
    await expect(calendar.getByText("Last Google import:", { exact: true })).toBeVisible();
    await calendar.getByRole("button", { name: "Google sync details", exact: true }).click();
    await calendar.getByRole("button", { name: "Calendar filters", exact: true }).click();
    const filterSheet = page.getByRole("dialog", { name: "Calendar filters", exact: true });
    await expect(filterSheet).toBeVisible();
    await expect(filterSheet.getByRole("button", { name: "Agenda", exact: true })).toHaveAttribute("aria-pressed", "true");
    const closeBounds = await filterSheet.getByRole("button", { name: "Close filters" }).boundingBox();
    const filterBounds = await filterSheet.boundingBox();
    expect(closeBounds!.x).toBeGreaterThan(width - 65);
    expect(closeBounds!.y - filterBounds!.y).toBeLessThan(20);
    if (width === 390) await page.screenshot({ path: "/tmp/gla-calendar-mobile-filters.png", fullPage: false, animations: "disabled" });
    await expect(filterSheet.getByRole("checkbox", { name: "Scheduled maintenance", exact: true })).toBeVisible();
    await filterSheet.getByRole("checkbox", { name: "Show cancelled trips", exact: true }).click();
    await filterSheet.getByRole("button", { name: "Show 8 events", exact: true }).click();
    await expect(agenda.getByRole("button")).toHaveCount(8);
    await expect(agenda.getByRole("button", { name: "Cancelled · Cancelled Turo trip · Volvo XC90", exact: true })).toHaveCount(0);
    await expect(calendar.getByRole("button", { name: "Calendar filters, 1 active", exact: true })).toBeVisible();
    await calendar.getByRole("textbox", { name: "Search vehicle or plate" }).fill("XYZ789");
    await expect(agenda.getByRole("button")).toHaveCount(1);
    await calendar.getByRole("textbox", { name: "Search vehicle or plate" }).fill("");
    const eventButton = agenda.getByRole("button", { name: "Active Turo trip · Mercedes-Benz GLS", exact: true });
    const bounds = await eventButton.boundingBox();
    expect(bounds!.height).toBeGreaterThanOrEqual(44);
    expect(bounds!.x + bounds!.width).toBeLessThanOrEqual(width);
    await eventButton.click();
    const detail = page.getByRole("dialog", { name: "Active Turo trip", exact: true });
    await expect(detail.getByRole("link", { name: "Day schedule", exact: true })).toHaveAttribute("href", "/admin/operations?booking=turo%3A1&date=2026-10-13&tab=day-schedule");
    await expect(detail.getByRole("link", { name: "Car rental preview", exact: true })).toHaveCount(0);
    const dialogBounds = await detail.boundingBox();
    expect(dialogBounds!.x).toBeGreaterThanOrEqual(0);
    expect(dialogBounds!.x + dialogBounds!.width).toBeLessThanOrEqual(width);
    await detail.getByRole("button", { name: "Close", exact: true }).click();
    await expect.poll(() => page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
    await page.screenshot({ path: `/tmp/gla-calendar-mobile-${width}.png`, fullPage: false, animations: "disabled" });
    await calendar.getByRole("button", { name: /^Calendar filters/ }).click();
    await filterSheet.getByRole("button", { name: "Timeline", exact: true }).click();
    await filterSheet.getByRole("button", { name: /^Show \d+ events$/ }).click();
    await expect(calendar.getByTestId("fleet-calendar-timeline")).toBeVisible();
    const appointmentBounds = await calendar.getByTestId("fleet-calendar-timeline").getByRole("button", { name: "Oil change appointment · Mercedes-Benz GLS", exact: true }).boundingBox();
    expect(appointmentBounds!.width).toBeGreaterThanOrEqual(44);
    expect(appointmentBounds!.height).toBeGreaterThanOrEqual(44);
    await expect.poll(() => page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
    expect(mock.mutations).toEqual([]);
    expect(mock.errors).toEqual([]);
  });
}

test("mobile keeps Google errors visible when sync details are collapsed", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await mockCalendar(page, { firstGoogleSync: true, importError: "invalid_grant: The refresh token has expired." });
  await page.goto(calendarUrl);
  const status = page.getByRole("region", { name: "Google Calendar status" });
  await expect(status.getByRole("button", { name: "Google sync details" })).toHaveAttribute("aria-expanded", "false");
  await expect(status.getByText("Google import failed: invalid_grant: The refresh token has expired.", { exact: true })).toBeVisible();
  await status.getByRole("button", { name: "Google sync details" }).click();
  await expect(status.getByRole("button", { name: "Sync now", exact: true })).toBeEnabled();
});

test("mobile History defaults to the last 30 days, keeps confirmed past records, and preserves review warnings", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.clock.setFixedTime(new Date("2026-10-18T18:00:00Z"));
  const mock = await mockCalendar(page, { employee: true });
  await page.route("**/api/internal-calendar/events?*", async (route) => {
    mock.requests.push(new URL(route.request().url()));
    await route.fulfill({ contentType: "application/json", body: JSON.stringify({
      ...response(), role: "employee", events: [
        ...events,
        event("turo", 20, "Future rental", { start: "2026-10-19T15:00:00Z", end: "2026-10-21T15:00:00Z" }),
        event("turo", 21, "Invalid reversed dates", { start: "2026-10-17T15:00:00Z", end: "2026-10-15T15:00:00Z" }),
        event("turo", 22, "Invalid missing start", { start: null, end: "2026-10-15T15:00:00Z" }),
        event("turo", 23, "Ended outside selected range", { start: "2026-09-15T15:00:00Z", end: "2026-09-18T15:00:00Z" }),
        event("turo", 24, "Invalid zero duration", { start: "2026-10-15T15:00:00Z", end: "2026-10-15T15:00:00Z" }),
      ],
    }) });
  });
  await page.goto("/admin/trip-calendar?view=history");
  const calendar = page.getByTestId("fleet-calendar");
  await expect(calendar.getByRole("heading", { name: "History", exact: true })).toHaveText("History");
  const tabs = calendar.getByRole("navigation", { name: "Work schedule views" });
  await expect(tabs.getByRole("link", { name: "History", exact: true })).toHaveAttribute("aria-current", "page");
  await expect(tabs.getByRole("link", { name: "Day Schedule", exact: true })).toHaveAttribute("href", "/admin/operations?tab=day-schedule");
  await calendar.getByRole("button", { name: /^Change date range/ }).click();
  await expect(page.getByLabel("From", { exact: true })).toHaveValue("2026-09-19");
  await expect(page.getByLabel("To", { exact: true })).toHaveValue("2026-10-18");
  await page.getByRole("button", { name: "Close filters", exact: true }).click();
  await expect(calendar.getByTestId("history-range-description")).toContainText("2026-09-19 through 2026-10-18");
  const agenda = calendar.getByTestId("fleet-calendar-agenda");
  await expect(agenda.getByRole("button")).toHaveCount(7);
  for (const absent of ["Future rental", "Invalid reversed dates", "Invalid missing start", "Ended outside selected range", "Invalid zero duration", "Inspection without dates", "Open-ended owner use"]) {
    await expect(agenda.getByRole("button", { name: new RegExp(absent) })).toHaveCount(0);
  }
  await expect(agenda.getByRole("button", { name: "Active Turo trip · Mercedes-Benz GLS", exact: true })).toContainText("booked");
  await expect(calendar.getByText("5 date records need review", { exact: true })).toBeVisible();
  const historyCoverage = calendar.getByRole("button", { name: "Calendar coverage needs attention.", exact: true });
  await historyCoverage.click();
  await expect(calendar.getByText("5 records have unconfirmed or open-ended dates and are not classified as past.", { exact: false })).toBeVisible();
  await historyCoverage.click();
  await calendar.getByRole("button", { name: "Calendar filters", exact: true }).click();
  const filters = page.getByRole("dialog", { name: "Calendar filters", exact: true });
  await filters.getByRole("checkbox", { name: "Show cancelled trips", exact: true }).click();
  await filters.getByRole("button", { name: "Show 6 events", exact: true }).click();
  await expect(agenda.getByRole("button")).toHaveCount(6);
  expect((await agenda.getByRole("button").first().boundingBox())!.y).toBeLessThanOrEqual(500);
  await page.screenshot({ path: "/tmp/gla-calendar-history-mobile.png", animations: "disabled" });
  expect(mock.requests.some((url) => url.searchParams.get("from") === "2026-09-19" && url.searchParams.get("to") === "2026-10-18")).toBe(true);
  expect(mock.mutations).toEqual([]);
});

test("mobile Calendar and History tabs reset their own date windows on query-only navigation", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.clock.setFixedTime(new Date("2026-10-18T18:00:00Z"));
  await mockCalendar(page, { employee: true });
  await page.goto(calendarUrl);
  const calendar = page.getByTestId("fleet-calendar");
  const tabs = calendar.getByRole("navigation", { name: "Work schedule views" });
  await tabs.getByRole("link", { name: "History", exact: true }).click();
  await expect(page).toHaveURL(/view=history/);
  await calendar.getByRole("button", { name: /^Change date range/ }).click();
  await expect(page.getByLabel("From", { exact: true })).toHaveValue("2026-09-19");
  await expect(page.getByLabel("To", { exact: true })).toHaveValue("2026-10-18");
  await page.getByRole("button", { name: "Close filters", exact: true }).click();
  await tabs.getByRole("link", { name: "Calendar", exact: true }).click();
  await expect(tabs.getByRole("link", { name: "Calendar", exact: true })).toHaveAttribute("aria-current", "page");
  await calendar.getByRole("button", { name: /^Change date range/ }).click();
  await expect(page.getByLabel("From", { exact: true })).toHaveValue("2026-10-15");
  await expect(page.getByLabel("To", { exact: true })).toHaveValue("2026-11-07");
  await page.getByRole("button", { name: "Close filters", exact: true }).click();
  await page.goto("/admin/trip-calendar?view=history&from=2026-10-13&to=2026-10-14");
  await calendar.getByRole("button", { name: /^Change date range/ }).click();
  await expect(page.getByLabel("From", { exact: true })).toHaveValue("2026-10-13");
  await expect(page.getByLabel("To", { exact: true })).toHaveValue("2026-10-14");
  await expect(page.getByRole("dialog").getByRole("button", { name: "Show 1 events", exact: true })).toBeVisible();
  await page.getByLabel("To", { exact: true }).fill("2026-10-12");
  await expect(page.getByRole("dialog").getByRole("alert")).toContainText("Choose valid dates in order");
  await page.getByLabel("To", { exact: true }).fill("2026-10-15");
  await page.getByRole("dialog").getByRole("button", { name: "Show 7 events", exact: true }).click();
  await expect(calendar.getByTestId("fleet-calendar-agenda").getByRole("button")).toHaveCount(7);
});
