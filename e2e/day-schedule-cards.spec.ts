import { expect, test, type Page } from "@playwright/test";

function task(id: number, bookingKey: string, overrides: Record<string, unknown> = {}) {
  return { id, bookingKey, type: "cleaning", category: "Cleaning", car_name: `Vehicle task ${id}`, plate: "TEST123", guest_name: "Test Guest", assigned_to: "Test Worker", assigned_to_id: 41, start_time: "09:00", end_time: null, location: "Test airport", status: "new", notes: null, detail: null, reservation_id: "RES-208", extras: null, trip_start: "09:00", trip_end: "10:00", trip_start_mt: "2026-10-07 09:00", trip_end_mt: "2026-10-08 10:00", pickup_location: "Test airport", dropoff_location: "Test airport", location_tag: "slc", photos: null, car_photo: null, duration_minutes: 60, scheduled_day: "2026-10-07", ...overrides };
}

async function fixture(page: Page, overrides: { date?: string; rows?: ReturnType<typeof task>[]; user?: Record<string, unknown>; manager?: boolean; missingEmployee?: boolean } = {}) {
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
    if (route.request().method() !== 'GET') {
      const input = route.request().postDataJSON(); writes.push({ path, body: input });
      if (path.endsWith('/carryover-note')) {
        const row = rows.find(row => row.id === input.eventId && row.type === input.type);
        if (row) row.carryover_note = input.note || null;
        body = { success: true, note: input.note || null };
      }
      if (/\/tasks\/\d+\/status$/.test(path)) {
        const row = rows.find(row => row.id === Number(path.split('/').at(-2)));
        if (row) row.status = input.status;
      }
      if (path.endsWith('/day-schedule/driver')) {
        const row = rows.find(row => row.id === input.eventId);
        if (row) Object.assign(row, { driver_assignment_type: input.assignmentType, driver_assigned_to_id: input.employeeId, driver_assigned_to: input.fullname });
      }
    }
    else if (path === '/api/auth/me') body = { user: { id: 1, name: 'Admin', isAdmin: true, isEmployee: false, isSuperAdmin: true, effectiveTimezone: 'America/Denver', tourCompleted: true, ...overrides.user } };
    else if (path === '/api/operations/chart-management/access') body = { canManage: overrides.manager === true };
    else if (path === '/api/me/employee') {
      if (overrides.missingEmployee) return route.fulfill({ status: 404, contentType: 'application/json', body: JSON.stringify({ error: 'No employee record' }) });
      body = { success: true, data: { employee_aid: 41, employee_first_name: 'Test', employee_last_name: 'Worker', employee_is_active: 1 } };
    }
    else if (path === '/api/operations/fleet-vehicles') body = { data: [{ carId: 101, carName: 'Test vehicle', plateNumber: 'TEST123', vinNumber: null, carStatus: 'available' }, { carId: 102, carName: 'Retired vehicle', plateNumber: 'RETIRED', vinNumber: null, carStatus: 'off_fleet' }] };
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
    await expect(controls.getByRole('combobox', { name: 'Task status' })).toHaveCount(0);
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

 test('active fleet is selected by default and inactive vehicle records remain available explicitly', async ({ page }) => {
  const rows = [task(81, 'turo:81', { type: 'pickup', category: 'Pick Up', car_name: 'Active vehicle' }), task(82, 'turo:82', { type: 'pickup', category: 'Pick Up', car_name: 'Retired vehicle', plate: 'RETIRED' })];
  await fixture(page, { rows });
  await expect(page.getByLabel('Operations fleet')).toHaveValue('active');
  await expect(page.locator('[data-day-schedule-card]')).toHaveCount(1, { timeout: 15000 });
  await expect(page.locator('[data-day-schedule-card]')).toContainText('Active vehicle');
  await page.getByLabel('Operations fleet').selectOption('all');
  await expect(page.locator('[data-day-schedule-card]')).toHaveCount(2);
  await page.getByLabel('Operations fleet').selectOption('inactive');
  await expect(page.locator('[data-day-schedule-card]')).toHaveCount(1);
  await expect(page.locator('[data-day-schedule-card]')).toContainText('Retired vehicle');
});

test('past deadlines tint cards grey while recorded new and completed statuses stay distinct', async ({ page }) => {
  await page.clock.setFixedTime(new Date('2026-10-31T18:00:00Z'));
  const rows = [
    task(91, 'turo:91', { type: 'pickup', category: 'Pick Up', car_name: 'Past but new', status: 'new', due_at: '2026-10-31T17:00:00Z' }),
    task(92, 'turo:92', { type: 'pickup', category: 'Pick Up', car_name: 'Past and completed', status: 'completed', due_at: '2026-10-31T16:00:00Z' }),
    task(93, 'turo:93', { type: 'pickup', category: 'Pick Up', car_name: 'Upcoming', status: 'new', due_at: '2026-11-01T17:00:00Z' }),
  ];
  const state = await fixture(page, { date: '2026-11-03', rows });
  const cards = page.locator('[data-day-schedule-card]');
  await expect(cards).toHaveCount(3, { timeout: 15000 });
  await expect(cards.filter({ hasText: 'Past but new' })).toHaveAttribute('data-task-past', 'true');
  await expect(cards.filter({ hasText: 'Past but new' })).toHaveClass(/bg-slate-100/);
  await expect(cards.filter({ hasText: 'Past but new' }).locator('[data-task-status]')).toHaveText('new');
  await expect(cards.filter({ hasText: 'Past and completed' }).locator('[data-task-status]')).toHaveText('completed');
  await expect(cards.filter({ hasText: 'Upcoming' })).not.toHaveAttribute('data-task-past');
  expect(state.writes).toEqual([]);
});

for (const impersonated of [false, true]) test(`employee task form assigns self with effective employee identity (impersonated=${impersonated})`, async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  const state = await fixture(page, { user: { id: 7, isAdmin: impersonated, isSuperAdmin: impersonated, isEmployee: true,
    ...(impersonated ? { viewAsEmployee: { employeeId: 41 }, impersonatorIsAdmin: true } : {}) } });
  await mockTripForCleaning(page, 'departure');
  await page.goto('/admin/operations');
  await page.getByRole('button', { name: 'Assign Cleaning', exact: true }).click();
  const modal = page.getByRole('dialog', { name: 'Assign Task', exact: true });
  await expect(modal.getByRole('combobox').filter({ hasText: 'Select an employee...' })).toHaveCount(0);
  const self = modal.getByRole('button', { name: 'Assign to self', exact: true });
  await expect(self).toBeEnabled();
  await self.click();
  await expect(modal.getByText('Selected: Test Worker', { exact: true })).toBeVisible();
  await modal.getByRole('button', { name: 'Create Task', exact: true }).click();
  await expect.poll(() => state.writes.find(write => write.path === '/api/operations/tasks')?.body).toMatchObject({ assigned_to_id: 41, assigned_to: 'Test Worker' });
  expect(state.errors).toEqual([]);
});

test('manager retains the employee picker on task forms', async ({ page }) => {
  await fixture(page, { user: { id: 7, isAdmin: false, isSuperAdmin: false, isEmployee: true }, manager: true });
  await mockTripForCleaning(page, 'departure');
  await page.goto('/admin/operations');
  await page.getByRole('button', { name: 'Assign Cleaning', exact: true }).click();
  const modal = page.getByRole('dialog', { name: 'Assign Task', exact: true });
  await expect(modal.getByRole('combobox').filter({ hasText: 'Select an employee...' })).toBeVisible();
  await expect(modal.getByRole('button', { name: 'Assign to self', exact: true })).toHaveCount(0);
});

test('missing employee profile never falls back to an account ID or roster dropdown', async ({ page }) => {
  const state = await fixture(page, { user: { id: 7, isAdmin: false, isSuperAdmin: false, isEmployee: true }, missingEmployee: true });
  await mockTripForCleaning(page, 'departure');
  await page.goto('/admin/operations');
  await page.getByRole('button', { name: 'Assign Cleaning', exact: true }).click();
  const modal = page.getByRole('dialog', { name: 'Assign Task', exact: true });
  await expect(modal.getByRole('button', { name: 'Assign to self', exact: true })).toBeDisabled();
  await expect(modal.getByRole('alert')).toContainText('employee profile could not be loaded');
  await expect(modal.getByRole('combobox').filter({ hasText: 'Select an employee...' })).toHaveCount(0);
  expect(state.writes).toEqual([]);
});

test('employee claims an unassigned Day Schedule task using the self button', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  const state = await fixture(page, {
    user: { id: 7, isAdmin: false, isSuperAdmin: false, isEmployee: true },
    rows: [task(19, 'turo:208', { type: 'pickup', category: 'Pick Up', assigned_to: null, assigned_to_id: null })],
  });
  await page.locator('[data-day-schedule-card]').click();
  const popup = page.locator('[data-day-schedule-controls]');
  await expect(popup.getByRole('combobox').filter({ hasText: 'Unassigned' })).toHaveCount(0);
  await popup.getByRole('button', { name: 'Assign to self', exact: true }).first().click();
  await expect.poll(() => state.writes.find(write => write.path === '/api/operations/day-schedule/assign')?.body).toMatchObject({
    type: 'pickup', eventId: 19, employeeId: 41, fullname: 'Test Worker',
  });
  expect(state.errors).toEqual([]);
});

for (const impersonated of [false, true]) test(`employees cannot use Complete Old (view as employee=${impersonated})`, async ({ page }) => {
  const state = await fixture(page, {
    user: { id: 7, isEmployee: true, isAdmin: impersonated, isSuperAdmin: impersonated,
      ...(impersonated ? { viewAsEmployee: { employeeId: 41 }, impersonatorIsAdmin: true } : {}) },
    rows: [task(200, 'turo:200', { type: 'pickup', category: 'Pick Up', location: 'Office', scheduled_day: '2026-10-06', is_carryover: true, assigned_to: null, assigned_to_id: null })],
  });
  await page.getByRole('button', { name: /^(By Employee|Employees)$/ }).click();
  await expect(page.getByRole('region', { name: 'Unassigned tasks' }).locator('[data-day-schedule-card]')).toHaveCount(1);
  await expect(page.getByRole('button', { name: 'Unassigned task actions' })).toHaveCount(0);
  await expect(page.getByRole('menuitem', { name: 'Complete Old' })).toHaveCount(0);
  expect(state.writes).toEqual([]);
});

test('admin bulk action remains available only for eligible old normal tasks', async ({ page }) => {
  await fixture(page, { rows: [task(201, 'turo:201', { type: 'pickup', category: 'Pick Up', location: 'Office', scheduled_day: '2026-10-06', is_carryover: true, assigned_to: null, assigned_to_id: null })] });
  await page.getByRole('button', { name: /^(By Employee|Employees)$/ }).click();
  await page.getByRole('button', { name: 'Unassigned task actions' }).click();
  await expect(page.getByRole('menuitem', { name: /Complete Old/ })).toBeEnabled();
});

test('Day Schedule exposes only New and Completed and preserves owner booking availability', async ({ page }) => {
  const state = await fixture(page, { rows: [
    task(202, 'turo:202', { type: 'pickup', category: 'Pick Up', status: 'in_progress' }),
    task(203, 'turo:203', { type: 'pickup', category: 'Pick Up', status: 'delivered' }),
    task(204, 'owner_rental:204', { type: 'owner_dropoff', category: 'Pick Up', status: 'car_blocked_off' }),
  ] });
  const cards = page.locator('[data-day-schedule-card]');
  await expect(cards).toHaveCount(3, { timeout: 15000 });
  await expect(cards.filter({ hasText: 'Vehicle task 202' }).locator('[data-task-status]')).toHaveText('new');
  await expect(cards.filter({ hasText: 'Vehicle task 203' }).locator('[data-task-status]')).toHaveText('completed');
  await cards.filter({ hasText: 'Vehicle task 204' }).click();
  await page.locator('[data-day-schedule-controls]').getByRole('combobox', { name: 'Task status' }).click();
  await expect(page.getByRole('option')).toHaveText(['New', 'Completed']);
  await page.getByRole('option', { name: 'Completed', exact: true }).click();
  await expect.poll(() => state.writes.find(w => w.path === '/api/operations/day-schedule/owner-task-status')?.body).toMatchObject({ type: 'owner_dropoff', eventId: 204, status: 'completed' });
  expect(state.writes.some(w => w.path.includes('/car-block-off'))).toBe(false);
  expect(state.errors).toEqual([]);
});

for (const width of [1280, 390]) test(`pending carryovers precede daily work in timeline, employee and unassigned lists at ${width}px`, async ({ page }) => {
  await page.setViewportSize({ width, height: 844 });
  const pickup = (id: number, overrides: Record<string, unknown>) => task(id, `turo:${id}`, { type: 'pickup', category: 'Pick Up', ...overrides });
  const unassigned = { assigned_to: null, assigned_to_id: null };
  const state = await fixture(page, { rows: [
    pickup(301, { start_time: '07:00' }),
    pickup(302, { start_time: '20:00', scheduled_day: '2026-10-06', is_carryover: true }),
    pickup(303, { ...unassigned, start_time: '08:00' }),
    pickup(304, { ...unassigned, start_time: '21:00', scheduled_day: '2026-10-06', is_carryover: true }),
    pickup(305, { start_time: '07:30', scheduled_day: '2026-10-06', is_carryover: true, status: 'completed', completed_day: '2026-10-07', assigned_to_id: 42, assigned_to: 'Second Worker' }),
    pickup(306, { ...unassigned, start_time: '23:00', scheduled_day: '2026-10-05', is_carryover: true }),
    // An earlier date alone must not promote work that the server did not mark overdue.
    pickup(307, { start_time: '06:00', scheduled_day: '2026-10-06', is_carryover: false }),
  ] });
  await expect(page.locator('[data-day-schedule-card]')).toHaveText([306, 302, 304, 307, 301, 305, 303].map(id => new RegExp(`Vehicle task ${id}`)), { timeout: 15000 });
  await page.getByRole('button', { name: /^(By Employee|Employees)$/ }).click();
  await expect(page.getByRole('region', { name: 'My tasks', exact: true }).locator('[data-day-schedule-card]')).toHaveText([302, 307, 301].map(id => new RegExp(`Vehicle task ${id}`)));
  const unassignedRegion = page.getByRole('region', { name: 'Unassigned tasks', exact: true });
  await expect(unassignedRegion.locator('[data-day-schedule-card]')).toHaveText([306, 304, 303].map(id => new RegExp(`Vehicle task ${id}`)));
  await unassignedRegion.getByLabel('Search unassigned tasks').fill('Vehicle task 30');
  await expect(unassignedRegion.locator('[data-day-schedule-card]')).toHaveText([306, 304, 303].map(id => new RegExp(`Vehicle task ${id}`)));
  expect(state.writes).toEqual([]);
  expect(state.errors).toEqual([]);
});

for (const access of ['admin', 'manager', 'employee'] as const) test(`carryover notes are visible on the card and editable only by admin or manager: ${access}`, async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  const state = await fixture(page, { manager: access === 'manager', user: { isAdmin: access === 'admin', isSuperAdmin: access === 'admin', isEmployee: access !== 'admin' }, rows: [
    task(401, 'turo:401', { type: 'pickup', category: 'Pick Up', location: '50 South Redwood Road', scheduled_day: '2026-10-06', is_carryover: true, carryover_note: 'Check the key envelope before pickup.' }),
  ] });
  const card = page.locator('[data-day-schedule-card]');
  await expect(card.locator('[data-carryover-note]')).toContainText('Check the key envelope before pickup.');
  await expect(card.locator('[data-carryover-note]')).toHaveCSS('background-color', 'rgb(255, 255, 255)');
  await card.click();
  const popup = page.locator('[data-day-schedule-controls]');
  const editor = popup.getByRole('textbox', { name: 'Carryover note', exact: true });
  if (access === 'employee') {
    await expect(editor).toHaveCount(0);
    expect(state.writes).toEqual([]);
    return;
  }
  await editor.fill('Please take the spare key from the office.');
  await popup.getByRole('button', { name: 'Save carryover note', exact: true }).click();
  await expect.poll(() => state.writes.find(write => write.path.endsWith('/carryover-note'))?.body).toMatchObject({ eventId: 401, type: 'pickup', date: '2026-10-07', note: 'Please take the spare key from the office.' });
  await expect(editor).toHaveValue('Please take the spare key from the office.');
  await popup.getByRole('button', { name: 'Close task details', exact: true }).click();
  await expect(card.locator('[data-carryover-note]')).toContainText('Please take the spare key from the office.');
  await card.click();
  await expect(popup.getByRole('combobox', { name: 'Task driver' })).toHaveCount(0);
  await popup.getByRole('combobox', { name: 'Task status', exact: true }).click();
  await page.getByRole('option', { name: 'Completed', exact: true }).click();
  await expect(card.locator('[data-carryover-note]')).toHaveCount(0);
  await expect(editor).toHaveCount(0);
  expect(state.errors).toEqual([]);
});

for (const type of ['custom', 'delivery']) test(`manual ${type} task completion shows a driver-required error and sends no status change until a driver is selected`, async ({ page }) => {
  const state = await fixture(page, { rows: [task(402, 'turo:402', { type, category: type === 'custom' ? 'Custom Entry' : 'Drop Off', location: 'Airport rental office' })] });
  await page.locator('[aria-label="Filter schedule by task type"]').getByRole('button', { name: 'Clear filter', exact: true }).click();
  await page.locator('[data-day-schedule-card]').click();
  const popup = page.locator('[data-day-schedule-controls]');
  await popup.getByRole('combobox', { name: 'Task status', exact: true }).click();
  await page.getByRole('option', { name: 'Completed', exact: true }).click();
  await expect(page.getByText('Select a driver before completing this task.', { exact: true })).toBeVisible();
  expect(state.writes.filter(write => write.path.endsWith('/status'))).toEqual([]);
  await popup.getByRole('combobox', { name: 'Task driver', exact: true }).selectOption('41');
  await expect.poll(() => state.writes.find(write => write.path.endsWith('/driver'))?.body).toMatchObject({ eventId: 402, employeeId: 41, assignmentType: 'employee', date: '2026-10-07' });
  await popup.getByRole('combobox', { name: 'Task status', exact: true }).click();
  await page.getByRole('option', { name: 'Completed', exact: true }).click();
  await expect.poll(() => state.writes.filter(write => write.path.endsWith('/status')).length).toBe(1);
  expect(state.errors).toEqual([]);
});
