import { expect, test, type Page } from "@playwright/test";

function task(id: number, bookingKey: string, overrides: Record<string, unknown> = {}) {
  return { id, bookingKey, type: "cleaning", category: "Cleaning", car_name: `Vehicle task ${id}`, plate: "TEST123", guest_name: "Test Guest", assigned_to: "Test Worker", assigned_to_id: 41, start_time: "09:00", end_time: null, location: "Test airport", status: "new", notes: null, detail: null, reservation_id: "RES-208", extras: null, trip_start: "09:00", trip_end: "10:00", trip_start_mt: "2026-10-07 09:00", trip_end_mt: "2026-10-08 10:00", pickup_location: "Test airport", dropoff_location: "Test airport", location_tag: "slc", photos: null, car_photo: null, duration_minutes: 60, scheduled_day: "2026-10-07", ...overrides };
}

async function fixture(page: Page, overrides: { date?: string; rows?: ReturnType<typeof task>[] } = {}) {
  const writes: any[] = [], errors: string[] = [];
  page.on('pageerror', error => errors.push(error.message));
  const date = overrides.date || '2026-10-07';
  const rows = overrides.rows || [
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
    else if (path === '/api/operations/day-schedule') body = { date, events: rows, work_shifts: [] };
    else if (path === '/api/employees') body = { success: true, data: [{ employee_aid: 41, employee_first_name: 'Test', employee_last_name: 'Worker', employee_is_active: 1 }] };
    else if (path.includes('/airport-parking') || path.includes('/return-receipts/')) body = { carId: 101, carName: 'Kia Rio 2019', employeeId: 41, employeeName: 'Test Worker', reservationId: 'RES-208', submission: null };
    await route.fulfill({ contentType: 'application/json', body: JSON.stringify(body) });
  });
  await page.goto(`/admin/operations?tab=day-schedule&date=${date}`);
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

test('future schedule browsing uses verified carryovers without inventing overdue badges from dates', async ({ page }) => {
  await page.clock.setFixedTime(new Date('2026-10-31T16:00:00Z'));
  const rows = [
    task(31, 'turo:31', { type: 'pickup', category: 'Pick Up', car_name: 'Due later today', scheduled_day: '2026-10-31', is_carryover: false }),
    task(32, 'turo:32', { type: 'pickup', category: 'Pick Up', car_name: 'Due tomorrow', scheduled_day: '2026-11-01', is_carryover: false }),
    task(33, 'turo:33', { type: 'pickup', category: 'Pick Up', car_name: 'Actually overdue', scheduled_day: '2026-10-30', is_carryover: true }),
    task(34, 'turo:34', { type: 'pickup', category: 'Pick Up', car_name: 'Already completed', scheduled_day: '2026-10-30', is_carryover: true, status: 'completed', completed_day: '2026-10-31' }),
    task(35, 'turo:35', { type: 'pickup', category: 'Pick Up', car_name: 'Not classified as carryover', scheduled_day: '2026-10-29' }),
  ];
  const state = await fixture(page, { date: '2026-11-03', rows });
  const cards = page.locator('[data-day-schedule-card]');
  await expect(cards).toHaveCount(5, { timeout: 15000 });
  await expect(page.locator('[data-task-carryover]')).toHaveCount(1);
  await expect(cards.filter({ hasText: 'Actually overdue' }).locator('[data-task-carryover]')).toBeVisible();
  await cards.filter({ hasText: 'Due tomorrow' }).click();
  await expect(page.locator('[data-day-schedule-controls]').getByLabel('Actual completion date')).toHaveCount(0);
  await page.keyboard.press('Escape');
  await cards.filter({ hasText: 'Actually overdue' }).click();
  await expect(page.locator('[data-day-schedule-controls]').getByLabel('Actual completion date')).toBeVisible();
  expect(state.writes).toEqual([]);
  expect(state.errors).toEqual([]);
});

async function mockTripForCleaning(page: Page, phase?: 'standard' | 'departure') {
  await page.route(url => url.pathname === '/api/turo-trips', route => route.fulfill({ contentType: 'application/json', body: JSON.stringify({
    data: [{ id: 208, reservationId: 'RES-208', carName: 'Return cleaning car', guestName: 'Test Guest', plateNumber: 'TEST123',
      status: 'booked', tripStart: '2026-10-07T15:00:00Z', tripEnd: '2026-10-10T23:00:00Z', pickupLocation: 'Departure airport',
      returnLocation: 'Return lot', deliveryLocation: 'Fallback lot', earnings: 300, cancelledEarnings: 0 }], total: 1,
  }) }));
  await page.route(url => url.pathname === '/api/operations/tasks' && (url.searchParams.has('turo_trip_id') || url.searchParams.has('turo_trip_ids')), route => route.fulfill({ contentType: 'application/json', body: JSON.stringify({
    data: [{ id: 700, turo_trip_id: 208, task_type: 'cleaning', task_phase: phase, status: 'completed',
      assigned_to: 'Test Worker', assigned_to_id: 41, scheduled_date: '2026-10-07T15:00:00Z', due_date: '2026-10-07T15:00:00Z' }], total: 1,
  }) }));
}

test('assigning cleaning uses the return date and location despite completed departure history', async ({ page }) => {
  const state = await fixture(page);
  await mockTripForCleaning(page, 'departure');
  await page.goto('/admin/operations');
  await expect(page.getByText('Departure cleaning (history):', { exact: true })).toBeVisible({ timeout: 15000 });
  await page.getByRole('button', { name: 'Assign Cleaning', exact: true }).click();
  const modal = page.getByRole('dialog', { name: 'Assign Task', exact: true });
  await expect(modal.getByLabel('Scheduled Date/Time')).toHaveValue('2026-10-10T17:00');
  await expect(modal.getByLabel('Due Date', { exact: true })).toHaveValue('2026-10-10T17:00');
  await modal.getByRole('combobox', { name: 'Task type', exact: true }).click();
  await page.getByRole('option', { name: 'Drop Off', exact: true }).click();
  await expect(modal.getByLabel('Scheduled Date/Time')).toHaveValue('2026-10-07T09:00');
  await modal.getByRole('combobox', { name: 'Task type', exact: true }).click();
  await page.getByRole('option', { name: 'Cleaning', exact: true }).click();
  await expect(modal.getByLabel('Scheduled Date/Time')).toHaveValue('2026-10-10T17:00');
  await expect(modal.getByLabel('Due Date', { exact: true })).toHaveValue('2026-10-10T17:00');
  await modal.getByRole('combobox').filter({ hasText: 'Select an employee...' }).click();
  await page.getByRole('option', { name: 'Test Worker', exact: true }).click();
  await modal.getByRole('button', { name: 'Create Task', exact: true }).click();
  await expect.poll(() => state.writes.find(write => write.path === '/api/operations/tasks')?.body).toMatchObject({
    task_type: 'cleaning', turo_trip_id: 208, scheduled_date: '2026-10-10 23:00:00', due_date: '2026-10-10 23:00:00',
    scheduled_location: 'Return lot', assigned_to_id: 41,
  });
  expect(state.errors).toEqual([]);
});

for (const phase of ['standard', undefined] as const) test(`existing ${phase || 'legacy'} cleaning prevents a second return cleaning`, async ({ page }) => {
  const state = await fixture(page);
  await mockTripForCleaning(page, phase);
  await page.goto('/admin/operations');
  await expect(page.getByRole('button', { name: 'Edit Cleaning Task', exact: true })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Assign Cleaning', exact: true })).toHaveCount(0);
  await page.getByRole('button', { name: 'Assign Drop Off', exact: true }).click();
  const modal = page.getByRole('dialog', { name: 'Assign Task', exact: true });
  await modal.getByRole('combobox', { name: 'Task type', exact: true }).click();
  await page.getByRole('option', { name: 'Cleaning', exact: true }).click();
  await modal.getByRole('combobox').filter({ hasText: 'Select an employee...' }).click();
  await page.getByRole('option', { name: 'Test Worker', exact: true }).click();
  await modal.getByRole('button', { name: 'Create Task', exact: true }).click();
  await expect(page.getByText('A cleaning task already exists for this trip. Edit the existing one instead.', { exact: true })).toBeVisible();
  expect(state.writes.filter(write => write.path === '/api/operations/tasks')).toEqual([]);
  expect(state.errors).toEqual([]);
});
