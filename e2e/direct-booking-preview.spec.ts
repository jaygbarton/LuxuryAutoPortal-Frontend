import { expect, test, type Page } from "@playwright/test";

const ROOT = "/api/developer/direct-booking-preview";
const id = "11111111-1111-4111-8111-111111111111", key = `direct_booking_preview:${id}`;
const otherId = "22222222-2222-4222-8222-222222222222";
const clearAvailability = { status: "clear", complete: true, canConfirm: false, conflicts: [], issues: [], checkedAt: "2026-10-13T18:00:00Z" };
const car = { carId: 1, name: "2024 Mercedes-Benz GLS", year: 2024, make: "Mercedes-Benz", specs: "GLS", photo: null, city: "Salt Lake City", state: "UT", baseDailyRate: 175, isListed: true };
const detail = { ...car, description: "Synthetic vehicle description", guidelines: "Return with fuel.", features: ["All-wheel drive", "Bluetooth"], faq: [{ question: "Is this a live booking?", answer: "No. This is a private preview." }], locations: [{ id: 1, name: "SLC Airport", fee: "Review required" }], extras: [{ id: 1, type: "Child seat", description: "Request only", price: null }] };
const baseDraft = { id, bookingKey: key, carId: 1, startAt: "2026-10-14T16:00:00.000Z", endAt: "2026-10-16T16:00:00.000Z", timezone: "America/Denver", customerName: "Preview Guest", customerEmail: "guest@example.test", customerPhone: "", notes: "Synthetic private request", status: "draft", isPreview: true, version: 1, quote: { currency: "USD", baseDailyRate: 175, estimatedTotal: null, requiresReview: true, reason: "Final pricing and direct booking policies require review." }, availability: clearAvailability, createdAt: "2026-10-13T18:00:00Z", updatedAt: "2026-10-13T18:00:00Z" };
async function fixture(page: Page, options: { developer?: boolean; availability?: Record<string, unknown>; errorOnPatch?: boolean; errorAfterSave?: boolean; hasDraft?: boolean; photo?: string } = {}) {
  const drafts: Record<string, any>[] = options.hasDraft === false ? [] : [structuredClone(baseDraft), { ...structuredClone(baseDraft), id: otherId, bookingKey: `direct_booking_preview:${otherId}`, customerName: "Cancelled Preview Guest", status: "cancelled" }];
  const writes: { path: string; method: string; body: Record<string, any> }[] = [], errors: string[] = [], requests: string[] = [];
  page.on("pageerror", error => errors.push(error.message));
  await page.route(url => url.pathname.startsWith("/api/"), async route => {
    const request = route.request(), path = new URL(request.url()).pathname, method = request.method(); requests.push(path);
    let data: unknown = { success: true, data: [], total: 0, notifications: [], unreadCount: 0 };
    if (method !== "GET") writes.push({ path, method, body: request.postDataJSON() });
    if (path === "/api/auth/me") data = { user: { id: 1, fullname: "Preview Developer", email: "developer@example.test", isAdmin: true, isSuperAdmin: options.developer ?? true, isEmployee: false, isClient: false, effectiveTimezone: "America/Denver" } };
    else if (path === `${ROOT}/vehicles`) data = { vehicles: [{ ...car, photo: options.photo ?? car.photo }] };
    else if (path === `${ROOT}/vehicles/1`) data = { vehicle: { ...detail, photo: options.photo ?? detail.photo } };
    else if (path === `${ROOT}/availability`) data = { availability: options.availability ?? clearAvailability };
    else if (path === `${ROOT}/drafts`) {
      if (method === "POST") {
        const body = request.postDataJSON(); const draft = { ...structuredClone(baseDraft), ...body }; drafts.unshift(draft); data = { draft };
        if (options.errorAfterSave) return route.fulfill({ status: 503, json: { error: "The preview draft was saved, but could not be reloaded. Reload the preview list before saving again.", savedDraftId: id } });
      }
      else data = { drafts };
    } else if (path.startsWith(`${ROOT}/drafts/`)) {
      const draft = drafts.find(draft => draft.id === path.split("/").at(-1));
      if (method === "PATCH") {
        if (options.errorOnPatch) return route.fulfill({ status: 409, json: { error: "Another developer changed this draft. Reload the request before saving." } });
        Object.assign(draft, request.postDataJSON(), { version: draft.version + 1 });
      }
      data = { draft };
    } else if (path === "/api/internal-calendar/bookings/turo%3A23" || path === "/api/internal-calendar/bookings/turo:23") data = { timezone: "America/Denver", event: { id: "turo:23", bookingKey: "turo:23", source: "turo", sourceId: 23, carId: 1, carName: car.name, plate: "TEST123", title: "Turo reservation TEST23", start: baseDraft.startAt, end: baseDraft.endAt, status: "booked", cancelled: false, timeStatus: "confirmed", blocksAvailability: true, reservationId: "TEST23", guestName: "Existing Guest" } };
    return route.fulfill({ json: data });
  });
  return { drafts, writes, errors, requests };
}

test("saved car photos use the schedule proxies and recover from a broken first photo across preview views", async ({ page }) => {
  const mock = await fixture(page, { photo: JSON.stringify([{ url: "https://storage.googleapis.com/test-fleet/missing.jpg" }, { id: "synthetic-drive-file" }]) });
  await page.route("**/api/gcs-image-proxy?*", route => route.fulfill({ status: 404, body: "Missing photo" }));
  await page.route("**/api/employees/drive-file?*", route => route.fulfill({ contentType: "image/png", body: Buffer.from("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+aWWQAAAAASUVORK5CYII=", "base64") }));
  for (const view of ["customer", "worker", "calendar", "day-schedule"]) {
    await page.goto(`/admin/developer/direct-bookings?view=${view}&booking=${encodeURIComponent(key)}`);
    const photo = page.getByRole("img", { name: `${car.name} photo`, exact: true }).first();
    await expect(photo).toBeVisible();
    await expect(photo).toHaveAttribute("src", /\/api\/employees\/drive-file\?fileId=synthetic-drive-file/);
    await expect.poll(() => photo.evaluate((img: HTMLImageElement) => img.naturalWidth)).toBeGreaterThan(0);
  }
  expect(mock.writes).toEqual([]); expect(mock.errors).toEqual([]);
});

test("described testing views keep the selected request and mark the current view", async ({ page }) => {
  const mock = await fixture(page);
  await page.goto(`/admin/developer/direct-bookings?view=worker&booking=${encodeURIComponent(key)}`);
  const nav = page.getByRole("navigation", { name: "Direct booking preview areas" });
  await expect(nav.getByRole("link", { name: /Manage requests/ })).toHaveAttribute("aria-current", "page");
  await expect(nav.getByText("Review and edit saved test requests.")).toBeVisible();
  for (const [label, view] of [["Booking calendar", "calendar"], ["Daily schedule", "day-schedule"], ["Customer booking page", "customer"], ["Manage requests", "worker"]]) {
    const link = nav.getByRole("link", { name: new RegExp(label) });
    await link.click();
    await expect(link).toHaveAttribute("aria-current", "page");
    expect(new URL(page.url()).searchParams.get("view")).toBe(view);
    expect(new URL(page.url()).searchParams.get("booking")).toBe(key);
  }
  expect(mock.writes).toEqual([]); expect(mock.errors).toEqual([]);
});

test("customer preview saves only a private draft with explicit UTC instants", async ({ page }) => {
  const mock = await fixture(page, { hasDraft: false });
  await page.goto("/admin/developer/direct-bookings");
  await expect(page.getByText("Private preview — direct bookings are not live.")).toBeVisible();
  await page.getByLabel("Pickup date & time").fill("2026-10-14T10:00");
  await page.getByLabel("Return date & time").fill("2026-10-16T10:00");
  await page.getByRole("button", { name: `Select ${car.name}`, exact: true }).click();
  await expect(page.getByText("No conflict found in current records")).toBeVisible();
  await page.getByLabel("Guest name", { exact: true }).fill("Synthetic Guest");
  await page.getByLabel("Email", { exact: true }).fill("guest@example.test");
  await page.getByRole("button", { name: "Save preview request", exact: true }).click();
  await expect(page.getByText("Preview request saved. No booking was placed.")).toBeVisible();
  await expect(page.getByRole("button", { name: "Payments & booking confirmation unavailable" })).toBeDisabled();
  expect(mock.writes).toHaveLength(1);
  expect(mock.writes[0]).toEqual({ path: `${ROOT}/drafts`, method: "POST", body: { carId: 1, startAt: "2026-10-14T16:00:00.000Z", endAt: "2026-10-16T16:00:00.000Z", timezone: "America/Denver", customerName: "Synthetic Guest", customerEmail: "guest@example.test", customerPhone: "", notes: "", status: "draft" } });
  expect(mock.errors).toEqual([]);
});

test("unverified availability stays visible and never enables booking confirmation", async ({ page }) => {
  const mock = await fixture(page, { availability: { ...clearAvailability, status: "unknown", complete: false, issues: [{ code: "INCOMPLETE_CALENDAR", message: "The Google blocked-date source is incomplete." }] } });
  await page.goto("/admin/developer/direct-bookings");
  await page.getByLabel("Pickup date & time").fill("2026-10-14T10:00");
  await page.getByLabel("Return date & time").fill("2026-10-16T10:00");
  await page.getByRole("button", { name: `Select ${car.name}`, exact: true }).click();
  await expect(page.getByText("Availability needs review", { exact: true })).toBeVisible();
  await expect(page.getByText("The Google blocked-date source is incomplete.")).toBeVisible();
  await expect(page.getByRole("button", { name: "Payments & booking confirmation unavailable" })).toBeDisabled();
  expect(mock.writes).toEqual([]); expect(mock.errors).toEqual([]);
});

test("a saved draft with a reload error does not create a duplicate on retry", async ({ page }) => {
  const mock = await fixture(page, { hasDraft: false, errorAfterSave: true });
  await page.goto("/admin/developer/direct-bookings");
  await page.getByLabel("Pickup date & time").fill("2026-10-14T10:00");
  await page.getByLabel("Return date & time").fill("2026-10-16T10:00");
  await page.getByRole("button", { name: `Select ${car.name}`, exact: true }).click();
  await page.getByRole("button", { name: "Save preview request", exact: true }).click();
  await expect(page.getByText("The preview draft was saved, but could not be reloaded. Reload the preview list before saving again.")).toBeVisible();
  await expect(page.getByRole("button", { name: "Save preview request", exact: true })).toBeDisabled();
  await page.getByRole("link", { name: "Open the saved draft", exact: true }).click();
  await expect(page.getByLabel("Staff notes & request")).toBeVisible();
  expect(mock.drafts).toHaveLength(1); expect(mock.writes).toHaveLength(1);
});

test("worker changes remain versioned private drafts with no live effects", async ({ page }) => {
  const mock = await fixture(page);
  await page.goto(`/admin/developer/direct-bookings?view=worker&booking=${encodeURIComponent(key)}`);
  await page.getByLabel("Staff notes & request").fill("Reviewed pickup preference");
  await page.getByLabel("Preview status").selectOption("ready_for_review");
  await page.getByRole("button", { name: "Save preview changes", exact: true }).click();
  await expect.poll(() => mock.writes.length).toBe(1);
  expect(mock.writes[0].path).toBe(`${ROOT}/drafts/${id}`);
  expect(mock.writes[0].body).toMatchObject({ status: "ready_for_review", version: 1, notes: "Reviewed pickup preference" });
  await expect(page.getByRole("button", { name: "Confirm reservation" })).toBeDisabled();
  await expect(page.getByRole("button", { name: "Charge or refund" })).toBeDisabled();
  await expect(page.getByRole("button", { name: "Send guest email" })).toBeDisabled();
  const nav = page.getByRole("navigation", { name: "Booking views" });
  for (const link of await nav.getByRole("link").all()) await expect(link).toHaveAttribute("href", /^\/admin\/developer\/direct-bookings\?/);
  expect(mock.errors).toEqual([]);
});

test("concurrent edits show the conflict without silently overwriting", async ({ page }) => {
  const mock = await fixture(page, { errorOnPatch: true });
  await page.goto(`/admin/developer/direct-bookings?view=worker&booking=${encodeURIComponent(key)}`);
  await page.getByLabel("Staff notes & request").fill("New local note");
  await page.getByRole("button", { name: "Save preview changes", exact: true }).click();
  await expect(page.getByText("Another developer changed this draft. Reload the request before saving.")).toBeVisible();
  expect(mock.drafts[0].notes).toBe("Synthetic private request");
  expect(mock.writes).toHaveLength(1);
});

test("private draft calendar and day schedule share a draft and cancellation filters", async ({ page }) => {
  const mock = await fixture(page);
  await page.goto(`/admin/developer/direct-bookings?view=calendar&booking=${encodeURIComponent(key)}`);
  await expect(page.getByText("Preview Guest", { exact: true })).toBeVisible();
  await expect(page.getByText("Cancelled Preview Guest", { exact: true })).toHaveCount(0);
  await page.getByRole("checkbox", { name: "Show cancelled previews" }).check();
  await expect(page.getByText("Cancelled Preview Guest", { exact: true })).toBeVisible();
  await page.getByRole("navigation", { name: "Booking views" }).first().getByRole("link", { name: "Day schedule preview", exact: true }).click();
  await expect(page).toHaveURL(/\/admin\/developer\/direct-bookings\?view=day-schedule/);
  await expect(page.getByText("Preview Guest", { exact: true })).toBeVisible();
  expect(mock.writes).toEqual([]);
});

test("existing real booking details provide crosslinks but no writable actions", async ({ page }) => {
  const mock = await fixture(page);
  await page.goto("/admin/developer/car-rentals?booking=turo%3A23");
  await expect(page.getByText("Turo reservation TEST23", { exact: true })).toBeVisible();
  await expect(page.getByText("TEST123", { exact: true })).toBeVisible();
  await expect(page.getByRole("button", { name: "Edit booking", exact: true })).toBeDisabled();
  const nav = page.getByRole("navigation", { name: "Booking views" });
  await expect(nav.getByRole("link", { name: "Internal calendar" })).toHaveAttribute("href", "/admin/trip-calendar?booking=turo%3A23&date=2026-10-14");
  await expect(nav.getByRole("link", { name: "Day schedule", exact: true })).toHaveAttribute("href", "/admin/operations?booking=turo%3A23&date=2026-10-14&tab=day-schedule");
  expect(mock.writes).toEqual([]); expect(mock.errors).toEqual([]);
});

test("regular admins cannot open either private rental preview", async ({ page }) => {
  const mock = await fixture(page, { developer: false });
  for (const route of ["/admin/developer/direct-bookings", "/admin/developer/car-rentals?booking=turo%3A23"]) {
    await page.goto(route);
    await expect(page).not.toHaveURL(/\/admin\/developer\/(?:direct-bookings|car-rentals)/);
  }
  expect(mock.requests.filter(path => path.startsWith(ROOT))).toEqual([]);
  expect(mock.writes).toEqual([]);
});

for (const width of [390, 1280]) test(`preview request layout fits at ${width}px`, async ({ page }) => {
  await page.setViewportSize({ width, height: 900 }); const mock = await fixture(page);
  await page.goto("/admin/developer/direct-bookings");
  await page.getByRole("button", { name: `Select ${car.name}`, exact: true }).click();
  await expect(page.getByRole("button", { name: "Save preview request" })).toBeVisible();
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= document.documentElement.clientWidth)).toBe(true);
  expect(mock.errors).toEqual([]);
});
