import { expect, test, type Page } from "@playwright/test";

const image = Buffer.from("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+aBrkAAAAASUVORK5CYII=", "base64");
function event(id: number, extra: Record<string, unknown> = {}) {
  return { id, type: "pickup", bookingKey: `turo:${id + 100}`, category: "Pick Up", car_name: `Test Vehicle ${id}`, plate: `TEST${id}`, guest_name: "Test Guest", assigned_to: "Test Worker", assigned_to_id: 41, start_time: "09:00", end_time: null, location: "SLC Airport", status: "new", notes: null, detail: null, reservation_id: `R${id}`, extras: null, trip_start: "09:00", trip_end: "10:00", trip_start_mt: "2026-10-16 09:00", trip_end_mt: "2026-10-17 10:00", pickup_location: "SLC Airport", dropoff_location: "Office", location_tag: "slc", photos: null, car_photo: null, duration_minutes: null, scheduled_day: "2026-10-17", airport_parking_required: true, ...extra };
}
async function mock(page: Page, options: { unreadable?: boolean; failStatus?: boolean; unassigned?: boolean; owner?: boolean; nonAirport?: boolean; failUpload?: boolean; dropGasResponse?: boolean; myEmployeeId?: number; failSubmit?: boolean } = {}) {
  const calls: { path: string; body: any }[] = [], errors: string[] = [];
  let saved = false, failed = false, myTasksFirst = true;
  const events = options.unassigned ? [1,2,3,4,5].map(id => event(id, { assigned_to: null, assigned_to_id: null })) : [event(19, options.owner ? { type: "owner_dropoff", bookingKey: "owner_rental:19", category: "Drop Off", airport_parking_required: false } : options.nonAirport ? { location: "Office", airport_parking_required: false } : {})];
  page.on("pageerror", e => errors.push(e.message));
  await page.route((url) => url.pathname.startsWith("/api/"), async route => {
    const req = route.request(), path = new URL(req.url()).pathname;
    if (path === "/api/gcs-image-proxy") return route.fulfill({ contentType: "image/svg+xml", body: '<svg xmlns="http://www.w3.org/2000/svg" width="300" height="500"><rect width="300" height="500" fill="#fff"/><g font-family="monospace" fill="#222" font-size="20"><text x="28" y="55">PARKING RECEIPT</text><text x="28" y="100">2026-10-16</text><text x="28" y="180">TOTAL $5.00</text><text x="28" y="225">Thank you</text></g></svg>' });
    const isWrite = req.method() !== "GET" && req.method() !== "OPTIONS";
    const body = req.headers()["content-type"]?.includes("application/json") ? req.postDataJSON() : null;
    if (isWrite) calls.push({ path, body });
    let result: any = { success: true, data: [], notifications: [], unreadCount: 0 }, status = 200;
    if (path === "/api/auth/me") result = { user: { id: 7, name: "Actual Submitter", roleName: "Admin", isAdmin: true, isSuperAdmin: true, isEmployee: false, isClient: false, effectiveTimezone: "America/Denver" } };
    else if (path === "/api/me/preferences/day-schedule") {
      if (isWrite) myTasksFirst = body.myTasksFirst;
      result = { myTasksFirst, employeeId: options.myEmployeeId ?? 41 };
    }
    else if (path === "/api/operations/day-schedule") result = { date: "2026-10-17", events, work_shifts: [{ employee_id: 41, fullname: "Test Worker", start_time: "08:00", end_time: "17:00", shift_label: "Operations" }] };
    else if (path === "/api/employees") result = { success: true, data: [{ employee_aid: 41, employee_first_name: "Test", employee_last_name: "Worker", employee_is_active: 1 }, { employee_aid: 42, employee_first_name: "Second", employee_last_name: "Worker", employee_is_active: 1 }] };
    else if (path === "/api/expense-form-submissions/options") result = { data: { currentEmployeeId: 7, isAdmin: true, employees: [{ id: 41, name: "Test Worker" }, { id: 42, name: "Second Worker" }], cars: [{ id: 101, name: "Test Vehicle" }], categoryFields: { reimbursedBills: [{ value: "db_42", label: "Parking Airport" }, { value: "gasReimbursed", label: "Gas Reimbursed" }] } } };
    else if (path.endsWith("/receipt")) {
      if (options.failUpload) { status = 500; result = { error: "Receipt upload failed. Please retry." }; }
      else result = { receiptUrl: "https://storage.googleapis.com/test-bucket/receipts/airport-task-19-00000000-0000-4000-8000-000000000001.jpg", amount: options.unreadable ? null : 5, date: options.unreadable ? null : "2026-10-16", vendor: "SLC International Airport", receiptNumber: "A209", enteredAt: null, exitedAt: null, needsManualEntry: !!options.unreadable };
    } else if (path.includes("/airport-parking") || path.includes("/return-receipts/")) result = { carId: 101, carName: "Test Vehicle", employeeId: options.unassigned ? null : 41, employeeName: options.unassigned ? null : "Test Worker", reservationId: "R19", submission: saved ? { id: 55, status: "pending", carId: 101 } : null };
    else if (path === "/api/expense-form-submissions" && isWrite) {
      if (options.failSubmit) return route.fulfill({ status: 500, contentType: "application/json", body: JSON.stringify({ error: "Could not save receipt." }) });
      saved = true; result = { success: true, id: 55 };
      const source = events.find(e => body.airportPickupTaskId ? e.id === body.airportPickupTaskId : e.bookingKey === body.fuelReturnKey);
      if (source && !source.assigned_to_id && !source.assigned_to) {
        source.assigned_to_id = body.employeeId;
        source.assigned_to = body.employeeId === 42 ? "Second Worker" : "Test Worker";
      }
      if (body.fuelReturnKey) events.push(event(301, { type: "refuel", category: "Refuel Run", status: "completed", bookingKey: body.fuelReturnKey, airport_parking_required: false }));
      if (options.dropGasResponse && body.fuelReturnKey) return route.abort("failed");
    }
    else if (path.endsWith("/status") && isWrite) {
      if (options.failStatus && !failed) { failed = true; status = 500; result = { error: "Connection interrupted. Please retry." }; }
      else { events[0].status = body.status; result = { success: true }; }
    } else if (path === "/api/operations/day-schedule/assign" && isWrite) {
      const target = events.find(e => e.id === body.eventId)!;
      target.assigned_to_id = body.employeeId; target.assigned_to = body.fullname;
    }
    await route.fulfill({ status, contentType: "application/json", headers: { "Access-Control-Allow-Origin": new URL(page.url()).origin, "Access-Control-Allow-Credentials": "true" }, body: JSON.stringify(result) });
  });
  await page.goto("/admin/operations?tab=day-schedule&date=2026-10-17");
  if(options.unassigned||options.myEmployeeId!==undefined)await page.getByRole('button',{name:/^(By Employee|Employees)$/}).click();
  return { calls, errors };
}
const upload = async (page: Page) => page.getByLabel("Receipt photo", { exact: true }).setInputFiles({ name: "receipt.png", mimeType: "image/png", buffer: image });

test.describe('airport employee manager-review requests on mobile',()=>{
 test.use({viewport:{width:390,height:667},isMobile:true,hasTouch:true});
 test('explains the optional flag on tap and submits a reason with the unchanged airport receipt',async({page})=>{
  const state=await mock(page);await page.locator('[data-day-schedule-card][data-booking-key="turo:119"]').tap();
  await page.locator('[data-day-schedule-controls]').getByRole('button',{name:'Airport parking receipt',exact:true}).tap();
  const dialog=page.getByRole('dialog',{name:'Airport parking receipt'});
  const flag=dialog.getByRole('checkbox',{name:'Request manager review',exact:true});await expect(flag).not.toBeChecked();
  await dialog.getByRole('button',{name:'About manager review requests'}).tap();await expect(page.getByRole('note')).toContainText('ticket appears yellow');await page.keyboard.press('Escape');await expect(dialog).toBeVisible();
  await flag.check();await expect(dialog.getByLabel('Reason for manager review')).toBeVisible();
  await upload(page);await dialog.getByRole('button',{name:'Submit receipt & complete pickup'}).tap();
  expect(state.calls.filter(c=>c.path==='/api/expense-form-submissions')).toHaveLength(0);
  await dialog.getByLabel('Reason for manager review').fill('Guest returned late; parking cost needs review');
  await page.screenshot({path:'/workspace/artifacts/airport-review-request-390.png',fullPage:true,animations:'disabled'});
  await dialog.getByRole('button',{name:'Submit receipt & complete pickup'}).tap();await expect(dialog).toHaveCount(0);
  const submission=state.calls.find(c=>c.path==='/api/expense-form-submissions');expect(submission?.body).toMatchObject({managerReviewRequested:true,managerReviewReason:'Guest returned late; parking cost needs review',airportPickupTaskId:19,employeeId:41,carId:101,amount:5,submissionDate:'2026-10-16'});
  expect(state.calls.at(-1)).toMatchObject({path:'/api/operations/tasks/19/status',body:{status:'completed',airportParkingSubmissionId:55}});expect(state.errors).toEqual([]);
 });
});

test('airport review-request explanation works on mouse hover and an unchecked form sends no request',async({page})=>{
 const state=await mock(page);await page.locator('[data-day-schedule-card][data-booking-key="turo:119"]').click();await page.locator('[data-day-schedule-controls]').getByRole('button',{name:'Airport parking receipt',exact:true}).click();
 const dialog=page.getByRole('dialog',{name:'Airport parking receipt'});await dialog.getByRole('button',{name:'About manager review requests'}).hover();await expect(page.getByRole('note')).toContainText('special circumstance');await page.keyboard.press('Escape');
 await upload(page);await dialog.getByRole('button',{name:'Submit receipt & complete pickup'}).click();await expect(dialog).toHaveCount(0);
 expect(state.calls.find(c=>c.path==='/api/expense-form-submissions')?.body).not.toHaveProperty('managerReviewRequested');expect(state.errors).toEqual([]);
});

for (const { width, height } of [{ width: 360, height: 844 }, { width: 390, height: 844 }, { width: 430, height: 844 }, { width: 390, height: 500 }]) test.describe(`compact mobile receipt flow at ${width}×${height}px`, () => {
  const screenshotSize = height < 600 ? `${width}-short` : width;
  test.use({ viewport: { width, height }, isMobile: true, hasTouch: true });
  test("keeps task actions compact and submits the required parking receipt in a phone sheet", async ({ page }) => {
    const state = await mock(page);
    const card = page.locator('[data-day-schedule-card][data-booking-key="turo:119"]');
    await expect(card).toBeVisible();
    expect((await card.boundingBox())!.height).toBeLessThan(240);
    const summary = card;
    await expect(summary).toHaveAttribute("aria-expanded", "false");
    await expect(card.getByRole("combobox", { name: "Task status" })).not.toBeVisible();
    await expect(card.getByRole("button", { name: "Airport parking receipt", exact: true })).not.toBeVisible();
    await page.screenshot({ path: `/tmp/gla-mobile-day-${screenshotSize}.png`, fullPage: true });
    await summary.tap();
    await expect(summary).toHaveAttribute("aria-expanded", "true");
    const bounds = await page.evaluate(() => ({ scroll: document.documentElement.scrollWidth, width: document.documentElement.clientWidth }));
    expect(bounds.scroll).toBeLessThanOrEqual(bounds.width);
    const controls = page.locator("[data-day-schedule-controls]");
    await controls.evaluate(async element => { await Promise.all(element.getAnimations().map(animation => animation.finished)); });
    for (const button of [controls.getByRole("combobox", { name: "Task status" }), controls.getByRole("button", { name: "Refuel", exact: true }), controls.getByRole("button", { name: "Airport parking receipt", exact: true })]) {
      expect((await button.boundingBox())!.height).toBeGreaterThanOrEqual(44);
    }
    await expect(controls.getByRole("navigation", { name: "Booking views" })).toBeVisible();
    await page.screenshot({ path: `/tmp/gla-mobile-day-expanded-${screenshotSize}.png`, fullPage: true });
    await controls.getByRole("combobox", { name: "Task status" }).tap();
    await page.getByRole("option", { name: "completed", exact: true }).tap();
    const dialog = page.getByRole("dialog", { name: "Airport parking receipt" });
    await expect(dialog).toBeVisible();
    expect(state.calls).toHaveLength(0);
    await upload(page);
    await expect(dialog.getByLabel("Amount ($)", { exact: true })).toHaveValue("5.00");
    for (const name of ["Employee", "Receipt date", "Amount ($)"]) {
      expect(await dialog.getByLabel(name, { exact: true }).evaluate(el => parseFloat(getComputedStyle(el).fontSize))).toBeGreaterThanOrEqual(16);
    }
    const box = (await dialog.boundingBox())!;
    expect(box.x).toBeGreaterThanOrEqual(0);
    expect(box.x + box.width).toBeLessThanOrEqual(width);
    expect(box.y).toBeGreaterThanOrEqual(0);
    expect(box.y + box.height).toBeLessThanOrEqual(height);
    await dialog.getByLabel("Receipt date", { exact: true }).fill("2026-10-16");
    await dialog.getByLabel("Amount ($)", { exact: true }).fill("5.00");
    await page.screenshot({ path: `/tmp/gla-mobile-receipt-${screenshotSize}.png`, fullPage: true });
    await dialog.getByRole("button", { name: "Submit receipt & complete pickup" }).tap();
    await expect(dialog).toHaveCount(0);
    expect(state.calls.filter(call => call.path === "/api/expense-form-submissions")).toHaveLength(1);
    expect(state.calls.at(-1)).toMatchObject({ path: "/api/operations/tasks/19/status", body: { status: "completed", airportParkingSubmissionId: 55 } });
    expect(state.errors).toEqual([]);
  });
});

test("airport Completed opens receipt before any status write and preserves expense category, vehicle, and assignee", async ({ page }) => {
  const state = await mock(page);
  const card = page.locator('[data-day-schedule-card][data-booking-key="turo:119"]');
  await card.click();
  await page.locator("[data-day-schedule-controls]").getByRole("combobox", { name: "Task status" }).click();
  await page.getByRole("option", { name: "completed", exact: true }).click();
  const dialog = page.getByRole("dialog", { name: "Airport parking receipt" });
  await expect(dialog).toBeVisible(); expect(state.calls).toHaveLength(0);
  await expect(dialog.getByLabel("Vehicle", { exact: true })).toHaveValue("101");
  await expect(dialog.getByLabel("Employee", { exact: true })).toHaveValue("41");
  await expect(dialog.getByText(/Please double-check the amount, date/)).toBeVisible();
  await upload(page);
  await expect(dialog.getByLabel("Amount ($)", { exact: true })).toHaveValue("5.00");
  await dialog.getByRole("button", { name: "Submit receipt & complete pickup" }).click();
  await expect(dialog).toHaveCount(0);
  const expense = state.calls.find(c => c.path === "/api/expense-form-submissions")!;
  expect(expense.body).toMatchObject({ airportPickupTaskId: 19, employeeId: 41, carId: 101, field: "db_42", category: "reimbursedBills", amount: 5, submissionDate: "2026-10-16", year: 2026, month: 10 });
  expect(state.calls.at(-1)).toMatchObject({ path: "/api/operations/tasks/19/status", body: { status: "completed", airportParkingSubmissionId: 55 } });
  expect(state.errors).toEqual([]);
});

test("failed completion retries the saved expense without double submission", async ({ page }) => {
  const state = await mock(page, { failStatus: true });
  await page.locator("[data-day-schedule-card]").first().click();
  await page.getByRole("button", { name: "Airport parking receipt", exact: true }).click(); await upload(page);
  await page.getByRole("button", { name: "Submit receipt & complete pickup" }).click();
  await expect(page.getByRole("dialog").getByText(/receipt is saved for approval/)).toBeVisible();
  await page.getByRole("button", { name: "Complete pickup", exact: true }).click();
  await expect(page.getByRole("dialog")).toHaveCount(0);
  expect(state.calls.filter(c => c.path === "/api/expense-form-submissions")).toHaveLength(1);
  expect(state.calls.filter(c => c.path.endsWith("/status"))).toHaveLength(2);
});

test("upload failure or cancellation does not complete the task", async ({ page }) => {
  const state = await mock(page, { failUpload: true });
  await page.locator("[data-day-schedule-card]").first().click();
  await page.getByRole("button", { name: "Airport parking receipt", exact: true }).click(); await upload(page);
  await expect(page.getByRole("dialog").getByRole("alert")).toContainText("Receipt upload failed");
  await expect(page.getByRole("button", { name: "Submit receipt & complete pickup" })).toBeDisabled();
  await page.getByRole("button", { name: "Cancel", exact: true }).click();
  expect(state.calls.filter(c => c.path.endsWith("/status") || c.path === "/api/expense-form-submissions")).toHaveLength(0);
});

for (const owner of [false, true]) test(`gas return form supports manual fallback for ${owner ? "owner rental" : "non-airport Turo"} without completing the return`, async ({ page }) => {
  const state = await mock(page, { unreadable: true, owner, nonAirport: !owner });
  await page.locator("[data-day-schedule-card]").first().click();
  await page.getByRole("button", { name: "Refuel", exact: true }).click();
  await expect(page.getByRole("dialog", { name: "Gas reimbursed receipt" })).toBeVisible(); await upload(page);
  await expect(page.getByRole("dialog").getByText(/Please manually enter/)).toBeVisible();
  await expect(page.getByRole("dialog").getByText(/Please double-check/)).toBeVisible();
  await page.getByLabel("Amount ($)", { exact: true }).fill("60.00");
  await page.getByLabel("Receipt date", { exact: true }).fill("2026-09-30");
  await page.getByRole("button", { name: "Submit gas receipt", exact: true }).click();
  await expect(page.getByRole("dialog")).toHaveCount(0);
  expect(state.calls.find(c => c.path === "/api/expense-form-submissions")?.body).toMatchObject({ fuelReturnKey: owner ? "owner_rental:19" : "turo:119", category: "reimbursedBills", field: "gasReimbursed", amount: 60, month: 9, year: 2026 });
  expect(state.calls.filter(c => c.path.endsWith("/status"))).toHaveLength(0);
  await expect(page.getByText("Refuel Run", { exact: true }).first()).toBeVisible();
  expect(state.errors).toEqual([]);
});

test("a lost gas submission response recovers the saved receipt and refuel without a duplicate POST", async ({ page }) => {
  const state = await mock(page, { nonAirport: true, dropGasResponse: true });
  await page.locator("[data-day-schedule-card]").first().click();
  await page.getByRole("button", { name: "Refuel", exact: true }).click(); await upload(page);
  await page.getByRole("button", { name: "Submit gas receipt", exact: true }).click();
  await expect(page.getByRole("dialog").getByText(/completed Refuel Run are already saved/)).toBeVisible();
  await page.getByRole("dialog").getByRole("button", { name: "Close", exact: true }).click();
  await expect(page.getByRole("dialog")).toHaveCount(0);
  await expect(page.getByText("Refuel Run", { exact: true }).first()).toBeVisible();
  expect(state.calls.filter(c => c.path === "/api/expense-form-submissions")).toHaveLength(1);
  expect(state.calls.filter(c => c.path.endsWith("/status"))).toHaveLength(0);
});

for (const mobile of [false, true]) test.describe(mobile ? "phone" : "desktop", () => {
  test.use({ viewport: mobile ? { width: 390, height: 844 } : { width: 1440, height: 1000 }, isMobile: mobile, hasTouch: mobile });
  test("expand/search/assign unassigned tasks without dragging", async ({ page }) => {
    const state = await mock(page, { unassigned: true });
    const region = page.getByRole("region", { name: "Unassigned tasks", exact: true });
    if (await region.getByRole("button", { name: "Expand", exact: true }).isVisible()) await region.getByRole("button", { name: "Expand", exact: true }).click();
    await region.getByLabel("Search unassigned tasks").fill("TEST4");
    await expect(region.getByText("1 of 5 unassigned tasks", { exact: false })).toBeVisible();
    await expect(region.locator("[data-day-schedule-card]")).toHaveCount(1);
    await region.getByRole("button", { name: "Task details for Test Vehicle 4", exact: true }).click();
    await page.locator("[data-day-schedule-controls]").getByRole("combobox", { name: "Assign Test Vehicle 4", exact: true }).click();
    await page.getByPlaceholder("Search employees...").fill("Second");
    await page.getByRole("option", { name: "Second Worker", exact: true }).click();
    await expect.poll(() => state.calls.some(c => c.path.endsWith("/assign") && c.body.eventId === 4 && c.body.employeeId === 42)).toBe(true);
    await expect(region.getByText("No unassigned tasks match your search.")).toBeVisible();
    await region.getByRole("button", { name: "Clear", exact: true }).click();
    await expect(region.locator("[data-day-schedule-card]")).toHaveCount(4);
    await region.getByRole("button", { name: "Collapse", exact: true }).click();
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 2)).toBe(true);
    expect(state.errors).toEqual([]);
  });
});

for (const gas of [false, true]) test(`successful ${gas ? "gas" : "parking"} form assigns only its source task to the chosen employee`, async ({ page }) => {
  const state = await mock(page, { unassigned: true });
  const region = page.getByRole("region", { name: "Unassigned tasks", exact: true });
  if (await region.getByRole("button", { name: "Expand", exact: true }).isVisible()) await region.getByRole("button", { name: "Expand", exact: true }).click();
  const source = region.locator('[data-booking-key="turo:101"]');
  await source.click();
  await page.locator("[data-day-schedule-controls]").getByRole("button", { name: gas ? "Refuel" : "Airport parking receipt", exact: true }).click();
  await expect(page.getByRole("dialog").getByText(/Submitting assigns this unassigned task/)).toBeVisible();
  await page.getByLabel("Employee", { exact: true }).selectOption("42");
  await upload(page);
  await expect(page.locator('[aria-label="Unassigned tasks"] [data-booking-key="turo:101"]')).toHaveCount(1); // Reading a photo alone must not assign it.
  await page.getByRole("button", { name: gas ? "Submit gas receipt" : "Submit receipt & complete pickup", exact: true }).click();
  await expect(page.getByRole("dialog")).toHaveCount(0);
  await expect(source).toHaveCount(0);
  expect(state.calls.find(c => c.path === "/api/expense-form-submissions")?.body.employeeId).toBe(42);
  expect(state.calls.filter(c => c.path.endsWith("/assign"))).toHaveLength(0); // Assignment is part of the form transaction.
  await expect(region.locator('[data-booking-key="turo:102"]')).toBeVisible();
  expect(state.errors).toEqual([]);
});

test("failed form save leaves the source task unassigned", async ({ page }) => {
  await mock(page, { unassigned: true, failSubmit: true });
  const region = page.getByRole("region", { name: "Unassigned tasks", exact: true });
  if (await region.getByRole("button", { name: "Expand", exact: true }).isVisible()) await region.getByRole("button", { name: "Expand", exact: true }).click();
  const source = region.locator('[data-booking-key="turo:101"]');
  await source.click();
  await page.locator("[data-day-schedule-controls]").getByRole("button", { name: "Airport parking receipt", exact: true }).click();
  await page.getByLabel("Employee", { exact: true }).selectOption("42"); await upload(page);
  await page.getByRole("button", { name: "Submit receipt & complete pickup" }).click();
  await expect(page.getByRole("dialog").getByRole("alert")).toContainText("Could not save receipt");
  await page.getByRole("button", { name: "Cancel", exact: true }).click();
  await expect(source).toBeVisible();
});

for (const mobile of [false, true]) test.describe(`saved priority ${mobile ? "phone" : "desktop"}`, () => {
  test.use({ viewport: mobile ? { width: 390, height: 844 } : { width: 1440, height: 1000 } });
  test("automatically shows my tasks first and remembers disabling after a refresh", async ({ page }) => {
    const state = await mock(page);
    await page.getByRole('button',{name:/^(By Employee|Employees)$/}).click();
    const checkbox = page.getByRole("checkbox", { name: "My tasks first", exact: true });
    await expect(checkbox).toBeChecked();
    const mine = page.getByRole("region", { name: "My tasks", exact: true });
    await expect(mine.locator('[data-booking-key="turo:119"]')).toBeVisible();
    const unassigned = page.getByRole("region", { name: "Unassigned tasks", exact: true });
    expect((await mine.boundingBox())!.y).toBeLessThan((await unassigned.boundingBox())!.y);
    await checkbox.click(); await expect(checkbox).not.toBeChecked(); await expect(mine).toHaveCount(0);
    expect(state.calls.find(c => c.path === "/api/me/preferences/day-schedule")?.body).toEqual({ myTasksFirst: false });
    await page.reload();
    await page.getByRole('button',{name:/^(By Employee|Employees)$/}).click();
    await expect(checkbox).not.toBeChecked();
    await expect(mine).toHaveCount(0);
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 2)).toBe(true);
  });
  test("shows Unassigned first when this employee has no tasks", async ({ page }) => {
    await mock(page, { myEmployeeId: 42 });
    await expect(page.getByRole("checkbox", { name: "My tasks first", exact: true })).toBeChecked();
    await expect(page.getByRole("region", { name: "My tasks", exact: true })).toHaveCount(0);
    const unassigned = page.getByRole("region", { name: "Unassigned tasks", exact: true });
    const otherTask = page.locator('[data-day-schedule-card][data-booking-key="turo:119"]');
    expect((await unassigned.boundingBox())!.y).toBeLessThan((await otherTask.boundingBox())!.y);
  });
});
