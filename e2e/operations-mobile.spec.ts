import { expect, test, type Locator, type Page } from "@playwright/test";
import path from "node:path";

// Exercise the real authenticated app and its actual Operations components.
// Network interception keeps these checks independent of production accounts,
// backend availability, email, calendar, and upload services.
const fixtureDate = "2026-10-07";
const image = "/homepage-hero-escalade.jpg";
const screenshotPath = (name: string) => process.env.OPERATIONS_SCREENSHOT_DIR
  ? path.join(process.env.OPERATIONS_SCREENSHOT_DIR, name)
  : test.info().outputPath(name);

const employees = [
  { employee_aid: 41, employee_first_name: "Morgan", employee_last_name: "Rivera", employee_email: "morgan@example.test", employee_is_active: 1 },
  { employee_aid: 42, employee_first_name: "Jordan", employee_last_name: "Lee", employee_email: "jordan@example.test", employee_is_active: 1 },
];

const cars = [
  { id: 101, make: "Mercedes-Benz", model: "GLS 450", year: 2025, plateNumber: "ABC123", licensePlate: "ABC123", vin: "4JGFF5KE8RA123456", makeModel: "Mercedes-Benz GLS 450", photo: image },
  { id: 102, make: "BMW", model: "X5", year: 2024, plateNumber: "XYZ789", licensePlate: "XYZ789", vin: "5UXCR6C0XRA123456", makeModel: "BMW X5", photo: image },
];

function scheduleEvent(id: number, overrides: Record<string, unknown> = {}) {
  return {
    id, type: "cleaning", category: "Cleaning", car_name: "Mercedes-Benz GLS 450 2025", plate: "ABC123",
    guest_name: "Test Guest", assigned_to: "Morgan Rivera", assigned_to_id: 41, start_time: "09:00", end_time: "10:00",
    location: "Salt Lake City airport long-term parking garage", status: "new", notes: "Clean the cabin and check the fuel gauge before the next reservation. ".repeat(3),
    detail: "Reservation preparation", reservation_id: "RES-123456", extras: "Child seat", trip_start: "2026-10-07T16:00:00Z", trip_end: "2026-10-10T16:00:00Z",
    trip_start_mt: "2026-10-07 10:00", trip_end_mt: "2026-10-10 10:00", pickup_location: "Salt Lake City Airport", dropoff_location: "Salt Lake City Airport",
    location_tag: "slc", photos: [], car_photo: image, duration_minutes: 60, scheduled_day: fixtureDate, completed_day: null,
    is_carryover: false, driver_assignment_type: "employee", driver_assigned_to: "Jordan Lee", driver_assigned_to_id: 42,
    ...overrides,
  };
}

test.describe("touch Car Inspections header at 360px", () => {
  test.use({ viewport: { width: 360, height: 740 }, isMobile: true, hasTouch: true });

  test("secondary actions stay in the menu and deletion keeps its confirmation", async ({ page }) => {
    const { errors, mutations } = await mockOperations(page);
    await page.goto("/admin/operations?tab=inspections");
    const add = page.getByRole("button", { name: "Add Manual Inspection", exact: true });
    await expect(add).toBeVisible({ timeout: 25_000 });
    await expectFitsScreen(page, add);
    await page.getByRole("button", { name: "More inspection actions", exact: true }).tap();
    await page.getByRole("menuitem", { name: "Add Task", exact: true }).tap();
    const taskDialog = page.getByRole("dialog", { name: "Assign Task", exact: true });
    await expect(taskDialog).toBeVisible();
    await expectFitsScreen(page, taskDialog);
    await taskDialog.getByRole("button", { name: "Cancel", exact: true }).tap();
    await page.getByRole("button", { name: "More inspection actions", exact: true }).tap();
    await page.getByRole("menuitem", { name: "Delete All", exact: true }).tap();
    const confirmation = page.getByRole("dialog", { name: "Delete All Car Issues", exact: true });
    await expect(confirmation).toBeVisible();
    await expectFitsScreen(page, confirmation);
    await confirmation.getByRole("button", { name: "Cancel", exact: true }).tap();
    expect(mutations).toEqual([]);
    expect(errors).toEqual([]);
  });
});

function maintenanceRecord(id: number, overrides: Record<string, unknown> = {}) {
  return {
    id, inspection_id: null, car_id: 101, car_name: "Mercedes-Benz GLS 450", service_type: "oil_change", task_description: "Oil change and inspect brake pads",
    assigned_to: "Morgan Rivera", assigned_to_id: 41, scheduled_date: "2026-10-07T16:00:00Z", due_date: "2026-10-08T16:00:00Z", status: "new",
    completed_date: null, notes: "Check the service interval and keep the receipt for the owner. ".repeat(3), photos: [], repair_shop: "Salt Lake City Vehicle Service Center", repair_shop_license: "SHOP-101",
    google_event_id: null, created_at: "2026-10-06T16:00:00Z", updated_at: "2026-10-06T16:00:00Z", car_make: "Mercedes-Benz", car_model: "GLS 450", car_year: 2025,
    car_plate: "ABC123", car_vin: "4JGFF5KE8RA123456", car_photo: image, trip_id: null, trip_start: "2026-10-07T16:00:00Z", trip_end: "2026-10-10T16:00:00Z",
    trip_reservation_id: "RES-123456", trip_pickup_location: "Salt Lake City Airport", trip_return_location: "Salt Lake City Airport", inspection_car_issue_types: ["Oil Change"],
    ...overrides,
  };
}

async function mockOperations(page: Page, recordCount = 2) {
  const mutations: { method: string; path: string; body: any }[] = [];
  const errors: string[] = [];
  page.on("pageerror", (error) => errors.push(error.message));
  // Matching the pathname avoids intercepting Vite's /src/lib/api/index.ts
  // module requests, which also contain the string "/api/".
  await page.route((url) => url.pathname.startsWith("/api/"), async (route) => {
    const request = route.request();
    const url = new URL(request.url());
    const path = url.pathname;
    const method = request.method();
    let response: unknown;
    if (method !== "GET") {
      let body: any;
      try { body = request.postDataJSON(); } catch { body = request.postData(); }
      const knownMutation =
        (method === "PATCH" && /^\/api\/operations\/tasks\/\d+\/status$/.test(path)) ||
        (method === "PUT" && /^\/api\/operations\/maintenance\/\d+$/.test(path)) ||
        (method === "POST" && path === "/api/operations/day-schedule/entry") ||
        (method === "PATCH" && path === "/api/operations/day-schedule/assign") ||
        (method === "DELETE" && path === "/api/operations/day-schedule/event");
      if (!knownMutation) {
        errors.push(`Unexpected mutation: ${method} ${path}`);
        await route.fulfill({ status: 400, contentType: "application/json", body: JSON.stringify({ error: "Unexpected test mutation" }) });
        return;
      }
      mutations.push({ method, path, body });
      response = { success: true, id: 990, data: { id: 990 } };
    } else if (path === "/api/auth/me") {
      response = { user: { id: 1, email: "operations@example.test", fullname: "Operations Admin", name: "Operations Admin", roleName: "Admin", isAdmin: true, isEmployee: false, isClient: false, effectiveTimezone: "America/Denver" } };
    } else if (path === "/api/operations/day-schedule") {
      response = {
        date: url.searchParams.get("date") || fixtureDate,
        events: [scheduleEvent(501), scheduleEvent(502, { type: "maintenance", category: "Mechanical Run", start_time: "11:00", end_time: "12:00", car_name: "BMW X5 2024", plate: "XYZ789", notes: "Inspect the tire pressure and braking system." }), scheduleEvent(503, { assigned_to: null, assigned_to_id: null, car_name: "Unassigned car task", start_time: "13:00", end_time: "14:00" }), scheduleEvent(504, { car_name: "Carryover car task", start_time: "14:00", end_time: "15:00", scheduled_day: "2026-10-06", is_carryover: true })],
        work_shifts: [{ employee_id: 41, fullname: "Morgan Rivera", start_time: "08:00", end_time: "17:00", shift_label: "Operations" }],
      };
    } else if (path === "/api/operations/maintenance") {
      const rows = [maintenanceRecord(601), maintenanceRecord(602, { car_id: 102, car_name: "BMW X5", car_make: "BMW", car_model: "X5", car_year: 2024, car_plate: "XYZ789", car_vin: "5UXCR6C0XRA123456", status: "in_progress", service_type: "tires", task_description: "Replace rear tires", assigned_to: "Jordan Lee", assigned_to_id: 42 })];
      for (let id = 603; rows.length < recordCount; id++) rows.push(maintenanceRecord(id, { car_name: `Fleet car ${id}`, car_make: null, car_model: null, car_year: null, car_plate: `PLATE${id}` }));
      const filtered = url.searchParams.get("status") ? rows.filter((row) => row.status === url.searchParams.get("status")) : rows;
      response = { success: true, data: filtered, total: filtered.length };
    } else if (path === "/api/cars") {
      response = { success: true, data: cars, total: cars.length };
    } else if (path === "/api/employees") {
      response = { success: true, data: employees, total: employees.length };
    } else if (/^\/api\/operations\/cars\/\d+\/availability$/.test(path)) {
      response = { success: true, data: { currentTrip: null, nextTrip: null, isAvailable: true } };
    } else {
      response = { success: true, data: [], events: [], notifications: [], unreadCount: 0, total: 0, count: 0 };
    }
    await route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify(response) });
  });
  return { mutations, errors };
}

async function expectFitsScreen(page: Page, locator?: Locator) {
  const width = page.viewportSize()!.width;
  const sizes = await page.evaluate(() => ({ width: document.documentElement.clientWidth, scroll: document.documentElement.scrollWidth }));
  expect(sizes.scroll, "The page should not scroll horizontally").toBeLessThanOrEqual(sizes.width);
  if (locator) {
    const bounds = await locator.boundingBox();
    expect(bounds).not.toBeNull();
    expect(bounds!.x).toBeGreaterThanOrEqual(0);
    expect(bounds!.x + bounds!.width).toBeLessThanOrEqual(width);
  }
}

for (const viewport of [{ width: 360, height: 800 }, { width: 390, height: 844 }, { width: 1280, height: 900 }]) {
  const mobile = viewport.width < 768;
  test.describe(`${mobile ? "touch" : "desktop"} Operations at ${viewport.width}px`, () => {
    test.use({ viewport, isMobile: mobile, hasTouch: mobile, timezoneId: "America/Denver" });
    const activate = (locator: Locator) => mobile ? locator.tap() : locator.click();

    test("Day Schedule keeps compact cards, editing, status updates and date navigation usable", async ({ page }) => {
      const { errors, mutations } = await mockOperations(page);
      await page.goto(`/admin/operations?tab=day-schedule&date=${fixtureDate}`);
      await expect(page.getByRole("heading", { name: "Operations", exact: true, level: 1 })).toBeVisible({ timeout: 25_000 });
      const card = page.locator("[data-day-schedule-card]:visible").filter({ hasText: "Mercedes-Benz GLS 450 2025" }).first();
      await expect(card).toBeVisible();
      const thumbnail = card.locator("img:visible").first();
      await expect(thumbnail).toBeVisible();
      await expect.poll(() => thumbnail.evaluate((element) => (element as HTMLImageElement).naturalWidth)).toBeGreaterThan(0);
      await expectFitsScreen(page);
      await page.screenshot({ path: screenshotPath(`operations-day-${viewport.width}.png`), fullPage: true });
      if (mobile) {
        expect((await card.boundingBox())!.height).toBeLessThan(400);
        await expect(card.getByLabel("Estimated duration in minutes")).not.toBeVisible();
        await activate(card.getByRole("button", { name: "Details & edit" }));
      }
      await expect(card.getByLabel("Estimated duration in minutes")).toBeVisible();
      await expect(card.getByRole("combobox", { name: "Driver type" })).toHaveText("Employee");
      await expectFitsScreen(page, card);
      await activate(card.getByRole("combobox", { name: "Task status" }));
      await activate(page.getByRole("option", { name: "in progress", exact: true }));
      await expect.poll(() => mutations.find((item) => item.path === "/api/operations/tasks/501/status")?.body).toMatchObject({ status: "in_progress" });
      await activate(card.getByRole("button", { name: /^More actions/ }));
      await expect(page.getByRole("menuitem", { name: "Delete task", exact: true })).toBeVisible();
      await expect(page.getByRole("menuitem", { name: "Already clean?", exact: true })).toBeVisible();
      page.once("dialog", (dialog) => dialog.dismiss());
      await activate(page.getByRole("menuitem", { name: "Delete task", exact: true }));
      expect(mutations.some((item) => item.method === "DELETE")).toBe(false);
      await activate(card.getByRole("combobox", { name: "Assignee", exact: true }));
      await page.getByPlaceholder("Search employees...").fill("jordan");
      await activate(page.getByRole("option", { name: "Jordan Lee", exact: true }));
      await expect.poll(() => mutations.find((item) => item.path === "/api/operations/day-schedule/assign")?.body).toMatchObject({ type: "cleaning", eventId: 501, employeeId: 42, fullname: "Jordan Lee" });
      const carryover = page.locator("[data-day-schedule-card]:visible").filter({ hasText: "Carryover car task" }).first();
      if (mobile) await activate(carryover.getByRole("button", { name: "Details & edit" }));
      await carryover.getByLabel("Actual completion date").fill(fixtureDate);
      await activate(carryover.getByRole("button", { name: "Complete", exact: true }));
      await expect.poll(() => mutations.find((item) => item.path === "/api/operations/tasks/504/status")?.body).toMatchObject({ status: "completed", completedDate: fixtureDate });
      await activate(page.getByRole("button", { name: "Next day", exact: true }));
      await expect(page.getByLabel("Schedule date")).toHaveValue("2026-10-08");
      await activate(page.getByRole("button", { name: "Previous day", exact: true }));
      await expect(page.getByLabel("Schedule date")).toHaveValue(fixtureDate);
      await activate(page.getByRole("button", { name: mobile ? "Add" : "Add Entry", exact: true }));
      await page.getByPlaceholder("Car refueled or worked on").fill("Test BMW X5");
      await page.getByPlaceholder("Details", { exact: true }).fill("Check fuel before pickup");
      await activate(page.getByRole("button", { name: "Save Entry", exact: true }));
      await expect.poll(() => mutations.find((item) => item.path === "/api/operations/day-schedule/entry")?.body).toMatchObject({ carName: "Test BMW X5", notes: "Check fuel before pickup", entryType: "refuel", employeeId: null });
      expect(errors).toEqual([]);
    });

    test("Maintenance reveals details and filters on demand and preserves edits", async ({ page }) => {
      const { errors, mutations } = await mockOperations(page);
      await page.goto("/admin/operations?tab=maintenance");
      await expect(page.getByRole("heading", { name: "Maintenance", exact: true })).toBeVisible({ timeout: 25_000 });
      const card = page.getByRole("article", { name: "Maintenance for Mercedes-Benz GLS 450 2025", exact: true });
      await expect(card).toBeVisible();
      await expectFitsScreen(page);
      await page.screenshot({ path: screenshotPath(`operations-maintenance-${viewport.width}.png`), fullPage: true });
      if (mobile) expect((await card.boundingBox())!.height).toBeLessThan(400);
      await expect(card.getByText("4JGFF5KE8RA123456", { exact: true })).not.toBeVisible();
      await activate(card.getByRole("button", { name: "View details" }));
      await expect(card.getByText("4JGFF5KE8RA123456", { exact: true })).toBeVisible();
      await expectFitsScreen(page, card);
      await activate(card.getByRole("button", { name: "Hide details" }));
      await activate(card.getByRole("button", { name: /^More actions/ }));
      await expect(page.getByRole("menuitem", { name: "Edit history" })).toBeVisible();
      await expect(page.getByRole("menuitem", { name: "Delete record" })).toBeVisible();
      await activate(page.getByRole("menuitem", { name: "Edit history" }));
      await expect(page.getByRole("dialog", { name: "Edit History" })).toBeVisible();
      await page.keyboard.press("Escape");
      await activate(card.getByRole("button", { name: /^More actions/ }));
      await activate(page.getByRole("menuitem", { name: "Delete record" }));
      const confirmation = page.getByRole("dialog", { name: "Delete Maintenance Record" });
      await expect(confirmation).toBeVisible();
      await activate(confirmation.getByRole("button", { name: "Cancel", exact: true }));
      expect(mutations.some((item) => item.method === "DELETE")).toBe(false);
      if (mobile) await activate(page.getByRole("button", { name: "Filters", exact: true }));
      await activate(page.getByRole("combobox", { name: "Status", exact: true }));
      await activate(page.getByRole("option", { name: "In Progress", exact: true }));
      await expect(page.getByRole("article")).toHaveCount(1);
      await expect(page.getByRole("article").getByText("Replace rear tires")).toBeVisible();
      await activate(page.getByRole("button", { name: "Clear Filters", exact: true }).first());
      await page.getByRole("searchbox", { name: "Search maintenance" }).fill("ABC123");
      await expect(page.getByRole("article")).toHaveCount(1);
      await page.getByRole("searchbox", { name: "Search maintenance" }).clear();
      await activate(card.getByRole("button", { name: "Edit", exact: true }));
      const dialog = page.getByRole("dialog", { name: "Edit Maintenance" });
      await expect(dialog).toBeVisible();
      if (mobile) await page.setViewportSize({ width: viewport.width, height: 400 });
      await expectFitsScreen(page, dialog);
      const geometry = () => dialog.evaluate((element) => {
          const bounds = element.getBoundingClientRect();
          const css = window.getComputedStyle(element);
          return { y: bounds.y, bottom: bounds.bottom, height: bounds.height, innerHeight: window.innerHeight, visualHeight: window.visualViewport?.height, clientHeight: document.documentElement.clientHeight, maxHeight: css.maxHeight, top: css.top, transform: css.transform };
      });
      await test.info().attach("dialog-immediately-after-resize", { body: JSON.stringify(await geometry()), contentType: "application/json" });
      await expect.poll(async () => {
        const bounds = await geometry();
        return bounds.y >= 0 && bounds.bottom <= bounds.innerHeight;
      }, { message: "The dialog must fit after viewport and opening animation settle" }).toBe(true);
      await test.info().attach("dialog-after-animation-settles", { body: JSON.stringify(await geometry()), contentType: "application/json" });
      await dialog.getByPlaceholder("What maintenance is needed...").fill("Oil change and brake check updated");
      await activate(dialog.getByRole("button", { name: "Update", exact: true }));
      await expect.poll(() => mutations.find((item) => item.path === "/api/operations/maintenance/601")?.body).toMatchObject({ car_id: 101, task_description: "Oil change and brake check updated", assigned_to_id: 41 });
      await expect(dialog).not.toBeVisible();
      expect(errors).toEqual([]);
    });

    test("Pagination and section navigation stay usable without crowding the page", async ({ page }) => {
      const { errors } = await mockOperations(page, 7);
      await page.goto("/admin/operations?tab=maintenance");
      await expect(page.getByRole("heading", { name: "Maintenance", exact: true })).toBeVisible({ timeout: 25_000 });
      await activate(page.getByRole("combobox", { name: "Rows per page" }));
      await activate(page.getByRole("option", { name: "5", exact: true }));
      await expect(page.getByRole("article")).toHaveCount(5);
      await activate(page.getByRole("button", { name: "Next page" }));
      await expect(page.getByRole("article")).toHaveCount(2);
      await activate(page.getByRole("button", { name: "Previous page" }));
      await expect(page.getByRole("article")).toHaveCount(5);
      await expectFitsScreen(page);
      if (mobile) {
        await activate(page.getByRole("combobox", { name: "Operations section" }));
        await activate(page.getByRole("option", { name: "Day Schedule", exact: true }));
        await expect(page).toHaveURL(/tab=day-schedule/);
        await expect(page.getByLabel("Schedule date")).toBeVisible();
        await activate(page.getByRole("combobox", { name: "Operations section" }));
        await activate(page.getByRole("option", { name: "Maintenance", exact: true }));
        await expect(page).toHaveURL(/tab=maintenance/);
        await expect(page.getByRole("heading", { name: "Maintenance", exact: true })).toBeVisible();
        await activate(page.getByRole("button", { name: "Open navigation", exact: true }));
        await expect(page.getByRole("button", { name: "Close navigation", exact: true })).toBeVisible();
        await activate(page.getByRole("button", { name: "Close navigation", exact: true }));
      } else {
        await activate(page.getByTestId("link-admin-day-schedule"));
        await expect(page).toHaveURL(/tab=day-schedule/);
        await expect(page.getByLabel("Schedule date")).toBeVisible();
      }
      expect(errors).toEqual([]);
    });
  });
}
