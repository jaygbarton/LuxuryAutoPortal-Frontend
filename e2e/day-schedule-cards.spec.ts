import { expect, test, type Page } from "@playwright/test";

function task(id: number, bookingKey: string, overrides: Record<string, unknown> = {}) {
  return { id, bookingKey, type: "cleaning", category: "Cleaning", car_name: `Vehicle task ${id}`, plate: "TEST123", guest_name: "Test Guest", assigned_to: "Test Worker", assigned_to_id: 41, start_time: "09:00", end_time: null, location: "Test airport", status: "new", notes: null, detail: null, reservation_id: "RES-208", extras: null, trip_start: "09:00", trip_end: "10:00", trip_start_mt: "2026-10-07 09:00", trip_end_mt: "2026-10-08 10:00", pickup_location: "Test airport", dropoff_location: "Test airport", location_tag: "slc", photos: null, car_photo: null, duration_minutes: 60, scheduled_day: "2026-10-07", ...overrides };
}

async function fixture(page: Page) {
  const writes: any[] = [], errors: string[] = [];
  page.on('pageerror', error => errors.push(error.message));
  const rows = [
    task(19, 'turo:208', { car_name: 'Kia Rio 2019', start_time: '10:30', type: 'pickup', category: 'Pick Up', airport_parking_required: true, extras: 'Child seat · Unlimited miles', car_photo: '/homepage-hero-escalade.jpg' }),
    task(12, 'owner_rental:12', { car_name: 'Owner car', start_time: '09:00', type: 'owner_pickup', category: 'Drop Off' }),
    task(12, 'owner_rental:12', { car_name: 'Owner car', start_time: '08:30', type: 'owner_cleaning', category: 'Cleaning', assigned_to: 'Second Worker', assigned_to_id: 42 }),
    task(12, 'owner_rental:12', { car_name: 'Owner car', start_time: '17:00', type: 'owner_dropoff', category: 'Pick Up' }),
    task(20, 'direct_booking:20', { car_name: 'Direct car', start_time: '12:00', type: 'trip_end', category: 'Trip End', assigned_to: null, assigned_to_id: null }),
  ];
  await page.route(url => url.pathname.startsWith('/api/'), async route => {
    const path = new URL(route.request().url()).pathname;
    let body: any = { success: true, data: [], total: 0, notifications: [], unreadCount: 0 };
    if (route.request().method() !== 'GET') { writes.push({ path, body: route.request().postDataJSON() }); }
    else if (path === '/api/auth/me') body = { user: { id: 1, name: 'Admin', isAdmin: true, isEmployee: false, isSuperAdmin: true, effectiveTimezone: 'America/Denver', tourCompleted: true } };
    else if (path === '/api/me/preferences/day-schedule') body = { myTasksFirst: true, employeeId: 41 };
    else if (path === '/api/operations/day-schedule') body = { date: '2026-10-07', events: rows, work_shifts: [] };
    else if (path === '/api/employees') body = { success: true, data: [{ employee_aid: 41, employee_first_name: 'Test', employee_last_name: 'Worker', employee_is_active: 1 }] };
    else if (path.includes('/airport-parking') || path.includes('/return-receipts/')) body = { carId: 101, carName: 'Kia Rio 2019', employeeId: 41, employeeName: 'Test Worker', reservationId: 'RES-208', submission: null };
    await route.fulfill({ contentType: 'application/json', body: JSON.stringify(body) });
  });
  await page.goto('/admin/operations?tab=day-schedule&date=2026-10-07');
  return { writes, errors };
}
for (const viewport of [{ width: 1280, height: 1000 }, { width: 390, height: 844 }]) test.describe(`${viewport.width}px schedule summaries`, () => {
  test.use({ viewport });
  test('timeline is chronological, has no inline controls or booking names, and opens all controls in a popup', async ({ page }) => {
    const state = await fixture(page);
    await expect(page.getByRole('button', { name: 'Timeline', exact: true })).toHaveAttribute('aria-pressed','true',{timeout:15000});
    const cards = page.locator('[data-day-schedule-card]');
    const filters=page.locator('[aria-label="Filter schedule by task type"]');
    await expect(filters.getByRole('button',{name:/^Pick Up/})).toHaveAttribute('aria-pressed','true');
    await expect(filters.getByRole('button',{name:/^Drop Off/})).toHaveAttribute('aria-pressed','true');
    await expect(filters.getByRole('button',{name:/^Cleaning/})).toHaveAttribute('aria-pressed','false');
    await expect(cards).toHaveCount(4);
    await filters.getByRole('button',{name:/^Cleaning/}).click();
    await expect(cards).toHaveCount(5);
    await filters.getByRole('button',{name:'Clear filter',exact:true}).click();
    await expect(cards).toHaveCount(5);
    await expect(cards.nth(0)).toContainText('8:30 AM');
    await expect(cards.nth(1)).toContainText('9:00 AM');
    await expect(cards.nth(2)).toContainText('10:30 AM');
    await expect(cards.nth(3)).toContainText('12:00 PM');
    await expect(cards.nth(4)).toContainText('5:00 PM');
    await expect(page.getByRole('region', { name: 'My tasks', exact: true })).toHaveCount(0);
    for (const card of await cards.all()) {
      await expect(card.locator('button, input, select, [role=combobox], a')).toHaveCount(0);
      await expect(card).not.toContainText('Test Guest');
      await expect(card).not.toContainText('RES-208');
      await expect(card).toContainText('TEST123');
      await expect(card.locator('[data-task-location]')).toHaveText('Test airport');
    }
    const turo = cards.filter({ hasText: 'Kia Rio 2019' });
    await expect(turo.locator('[data-booking-source="Turo"]')).toHaveClass(/bg-purple-600/);
    await expect(turo.locator('[data-trip-extras]')).toHaveCSS('animation-name', 'gla-trip-extras-flash');
    await expect(cards.filter({ hasText: 'Owner car' }).first().locator('[data-booking-source="Owner rental"]')).toHaveClass(/D3BC8D/);
    await expect(cards.filter({ hasText: 'Direct car' })).toContainText('Pick Up');
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
    await page.screenshot({ path: `/workspace/artifacts/day-schedule-timeline-${viewport.width}.png`, fullPage: true, animations: "disabled" });
    await turo.click();
    const controls = page.locator('[data-day-schedule-controls]');
    await expect(controls.getByLabel('Estimated duration in minutes')).toHaveCount(0);
    await expect(controls.getByRole('link',{name:'Car rental preview',exact:true})).toHaveCount(0);
    await expect(controls.locator('[aria-label="Trip receipt actions"]').getByRole('button',{name:'Refuel',exact:true})).toBeVisible();
    await expect(controls.locator('[aria-label="Trip receipt actions"]').getByRole('button',{name:'Airport parking receipt',exact:true})).toBeVisible();
    await expect(controls.getByRole('combobox', { name: 'Task status' })).toBeVisible();
    await expect(controls.getByRole('button', { name: 'Refuel', exact: true })).toBeVisible();
    await expect(controls.getByRole('button', { name: 'Airport parking receipt' })).toBeVisible();
    await expect(controls.getByRole('navigation', { name: 'Booking views' })).toBeVisible();
    await page.screenshot({ path: `/workspace/artifacts/day-schedule-controls-${viewport.width}.png`, fullPage: true, animations: "disabled" });
    // Receipt flow replaces the task dialog so there are no competing focus traps.
    await controls.getByRole('button', { name: 'Airport parking receipt' }).click();
    await expect(controls).toHaveCount(0);
    await expect(page.getByRole('dialog')).toHaveCount(1);
    expect(state.writes).toEqual([]);
    expect(state.errors).toEqual([]);
  });
});
test('employee view keeps employee grouping and unassigned assignment inside the task popup', async ({ page }) => {
  const state = await fixture(page);
  await page.getByRole('button',{name:/^(By Employee|Employees)$/}).click();
  const unassigned = page.getByRole('region', { name: 'Unassigned tasks' });
  await expect(unassigned.locator('[data-day-schedule-card]')).toHaveCount(1);
  const card = unassigned.locator('[data-day-schedule-card]');
  await expect(card.locator('[role=combobox]')).toHaveCount(0);
  await card.click();
  await expect(page.locator('[data-day-schedule-controls]').getByRole('combobox').first()).toBeVisible();
  await page.keyboard.press('Escape');
  await expect(page.getByRole('region', { name: 'My tasks' })).toContainText('Test Worker');
  await expect(page.getByRole('link',{name:'TV Timeline',exact:true})).toHaveCount(0);
  await page.goto('/admin/operations?tab=tv-timeline&date=2026-10-07&booking=turo:208');
  await expect(page).toHaveURL(/tab=day-schedule&date=2026-10-07&booking=turo%3A208/);
  await expect(page.getByRole('button',{name:'Timeline',exact:true})).toHaveAttribute('aria-pressed','true');
  await expect(page.getByLabel('Schedule date')).toHaveValue('2026-10-07');
  expect(state.errors).toEqual([]);
});
