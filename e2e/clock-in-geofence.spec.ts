import { expect, test, type Page } from '@playwright/test';

// All API calls are fixtures. These checks never create real time entries.
async function fixture(page: Page, role: 'employee' | 'admin' | 'super-admin', options: { clockedIn?: boolean } = {}) {
  const posts: any[] = [];
  let isClockedIn = options.clockedIn === true;
  await page.route(url => url.pathname.startsWith('/api/'), async route => {
    const path = new URL(route.request().url()).pathname;
    let data: any = { success: true, data: [], notifications: [], unreadCount: 0, total: 0 };
    if (path === '/api/auth/me') data = { user: { id: 7, name: 'Test Worker', firstName: 'Test', isEmployee: true, isAdmin: role !== 'employee', isSuperAdmin: role === 'super-admin', isClient: false, tourCompleted: true } };
    if (path === '/api/me/employee') data.data = { employee_aid: 41, employee_first_name: 'Test', employee_last_name: 'Worker' };
    if (path === '/api/me/contractor-policy') data.data = { hasEmployee: true, agreed: false, agreement: null, policy: { title: 'GLA Contractor Policy 1099', policyText: '', documentUrl: '' } };
    if (path === '/api/me/time-sheet/last') data.data = { isClockedIn, openSession: isClockedIn ? { time_aid: 17, time_date: '2026-11-02', time_in: '2026-11-02 15:00:00', time_out: null, time_total_hours: null, time_end_reason: null } : null, lastSession: null };
    if (path === '/api/me/time-sheet/sessions') data.data = { sessions: [], hourlyRate: 0 };
    if (path === '/api/me/time-sheet/clock-in-policy') data.data = { required: role === 'employee', configured: true, radiusMeters: 300 };
    if (path === '/api/me/time-sheet/clock-in') { posts.push(route.request().postDataJSON()); data.message = 'Timer started.'; }
    if (path === '/api/me/time-sheet/clock-out') { posts.push(route.request().postDataJSON()); isClockedIn = false; data.message = 'Clocked out.'; }
    await route.fulfill({ contentType: 'application/json', body: JSON.stringify(data) });
  });
  await page.addInitScript(() => {
    (window as any).gpsCalls = 0;
    (window as any).gpsAllowed = false;
    Object.defineProperty(navigator, 'geolocation', { configurable: true, value: {
      getCurrentPosition(success: PositionCallback, failure: PositionErrorCallback) {
        (window as any).gpsCalls++;
        if (!(window as any).gpsAllowed) { failure({ code: 1 } as GeolocationPositionError); return; }
        success({ coords: { latitude: 40.76904610555129, longitude: -111.94181788921198, accuracy: 10 }, timestamp: Date.now() } as GeolocationPosition);
      },
    } });
  });
  return posts;
}

test('mobile employee denied location cannot submit; retry obtains fresh location', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  const posts = await fixture(page, 'employee');
  await page.goto('/staff/time');
  const clockIn = page.getByRole('button', { name: 'Clock in', exact: true });
  await expect(page.getByText('Review and agree',{exact:true})).toHaveCount(0);
  await clockIn.click();
  await expect(page.getByRole('alert').filter({ hasText: 'site settings' }).first()).toBeVisible();
  expect(posts).toHaveLength(0);
  await page.evaluate(() => { (window as any).gpsAllowed = true; });
  await clockIn.click();
  await expect.poll(() => posts.length).toBe(1);
  expect(posts[0].location).toMatchObject({ latitude: 40.76904610555129, longitude: -111.94181788921198, accuracy: 10 });
  expect(await page.evaluate(() => (window as any).gpsCalls)).toBe(2);
  await expect(page.getByRole('dialog',{name:/GLA Contractor Policy/})).toHaveCount(0);
});

for (const role of ['admin', 'super-admin'] as const) {
  test(`${role} can clock in without asking for location even with employee role`, async ({ page }) => {
    const posts = await fixture(page, role);
    await page.goto('/admin/hr/time');
    await page.getByRole('button', { name: 'Clock in', exact: true }).click();
    await expect.poll(() => posts.length).toBe(1);
    expect(posts[0]).toEqual({});
    expect(await page.evaluate(() => (window as any).gpsCalls)).toBe(0);
  });
}


for (const role of ['employee', 'admin'] as const) test(`mobile ${role} ends a shift without an activity questionnaire and retains lunch and property confirmation`, async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  const posts = await fixture(page, role, { clockedIn: true });
  await page.goto(role === 'employee' ? '/staff/time' : '/admin/hr/time');
  await page.getByRole('button', { name: 'Clock out', exact: true }).click();
  const dialog = page.getByRole('dialog');
  await dialog.getByRole('textbox', { name: 'Notes (optional)', exact: true }).fill('Receipt awaiting manager review');
  await dialog.getByRole('button', { name: 'End of shift', exact: true }).click();
  await expect(dialog.getByText(/How many|energy today|grateful for|Additional Comments on Day/i)).toHaveCount(0);
  await expect(dialog.getByRole('combobox')).toHaveCount(0);
  await dialog.getByRole('spinbutton', { name: 'Lunch break (minutes)', exact: true }).fill('30');
  const submit = dialog.getByRole('button', { name: role === 'employee' ? 'Clock out' : 'Submit & clock out', exact: true });
  await expect(submit).toBeDisabled();
  await dialog.getByRole('checkbox', { name: /I confirm that I have checked/ }).check();
  await submit.click();
  await expect(dialog).toHaveCount(0);
  expect(posts).toHaveLength(1);
  expect(posts[0]).toMatchObject({ endReason: 'shift_end', lunchMinutes: 30 });
  const details = JSON.parse(posts[0].time_form_details);
  expect(details.map((detail: any) => detail.key)).toEqual(['notes', 'lunch_minutes']);
  await expect(page.getByRole('button', { name: 'Clock in', exact: true })).toBeVisible();
  expect(await page.evaluate(() => (window as any).gpsCalls)).toBe(0);
});

test('mobile employee can still clock out for break without an activity survey or property confirmation', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  const posts = await fixture(page, 'employee', { clockedIn: true });
  await page.goto('/staff/time');
  await page.getByRole('button', { name: 'Clock out', exact: true }).click();
  await page.getByRole('dialog').getByRole('button', { name: 'Clock out for break', exact: true }).click();
  await expect(page.getByRole('dialog')).toHaveCount(0);
  expect(posts).toHaveLength(1);
  expect(posts[0]).toEqual({ endReason: 'break', time_form_details: '[]' });
  await expect(page.getByRole('button', { name: 'Clock in', exact: true })).toBeVisible();
});
