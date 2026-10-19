import { expect, test, type Page } from '@playwright/test';
const service = (id: string, kind: string, days: number | null) => ({ id, kind, label: kind === 'tires' ? 'Tires' : 'Oil change', lastServiced: days === null ? null : '2026-01-01', dueDate: days === null || kind === 'tires' ? null : '2026-10-18', daysUntil: kind === 'tires' ? null : days, status: kind === 'tires' ? 'as_needed' : days === null ? 'no_data' : days < 0 ? 'overdue' : 'upcoming' });
const car = (id: number, name: string, days: number | null) => ({ car_id: id, car_name: name, car_plate: `P${id}`, car_vin: `VIN${id}`, car_status: 'ACTIVE', locationTag: 'SLC', car_photo: '/fixture/service-car.svg', car_fuel_type: 'Gasoline', last_any_service: '2026-01-01', services: [service(`${id}:oil_change`, 'oil_change', days), service(`${id}:tires`, 'tires', days === null ? null : days + 180)], nextService: days === null ? null : service(`${id}:oil_change`, 'oil_change', days) });
test('shows a safe service failure reference for troubleshooting and retry', async ({ page }) => {
  await fixture(page);
  await page.route('**/api/service-workspace', route => route.fulfill({ status: 503, contentType: 'application/json', body: JSON.stringify({ success: false, error: 'Service data could not be loaded. Reference: service_report/INVALID_RANGE/1234abcd' }) }));
  await page.goto('/admin/operations?tab=service-due');
  await expect(page.getByRole('alert').filter({ hasText: 'Service Due could not be loaded' })).toContainText('service_report/INVALID_RANGE/1234abcd');
  await expect(page.getByRole('button', { name: 'Retry', exact: true })).toBeEnabled();
});
async function fixture(page: Page) {
  const calls: URL[] = [];
  await page.route('**/fixture/service-car.svg', route => route.fulfill({ contentType: 'image/svg+xml', body: '<svg xmlns="http://www.w3.org/2000/svg" width="160" height="100" viewBox="0 0 160 100"><rect width="160" height="100" fill="#f4f0e6"/><path d="M25 65V45h20l15-15h40l18 15h18v20H25z" fill="#b29250"/><circle cx="50" cy="65" r="12" fill="#333"/><circle cx="112" cy="65" r="12" fill="#333"/></svg>' }));
  await page.route(url => url.pathname.startsWith('/api/'), async route => {
    const url = new URL(route.request().url()); calls.push(url);
    let result: any = { success: true, data: [], total: 0, notifications: [], unreadCount: 0 };
    if (url.pathname === '/api/auth/me') result = { user: { id: 7, firstName: 'Test', isAdmin: true, isSuperAdmin: true, isEmployee: false, isClient: false, tourCompleted: true } };
    if (url.pathname === '/api/service-workspace') result = { success: true, today: '2026-10-19', canOpenCarFiles: true, cars: [car(2, 'Urgent Audi', -8), car(3, 'Upcoming Buick', 20), car(1, 'No History Acura', null), { ...car(4, 'Inactive Lexus', -100), car_status: 'INACTIVE' }], rules: [{ kind: 'oil_change', label: 'Oil change', interval: 90 }, { kind: 'tires', label: 'Tires', interval: null }] };
    if (url.pathname.endsWith('/history')) result = { history: [{ id: 'receipt:7', carId: 2, kind: 'oil_change', label: 'Oil change', date: '2026-10-18', dateBasis: 'receipt_submission_date', status: 'approved', amount: 65, files: ['https://example.test/receipt.pdf'], notes: 'Verified receipt' }] };
    if (url.pathname === '/api/service-workspace/legacy') result = { status: 'ready', records: 3, vehicles: 1, canRecover: true, carFiles: { records: 3, files: 4, pending: 1, needReview: 0 }, summary: { scanned: 10, skippedVehicle: 7, unresolvedFiles: 0, unsupportedTables: [] } };
    if (url.pathname === '/api/expense-form-submissions/options') result = { data: { employees: [{ id: 41, name: 'Test Employee' }], cars: [{ id: 2, name: 'Urgent Audi - P2' }], currentEmployeeId: 41, isEmployee: true, isAdmin: false, categoryFields: { cogs: [{ value: 'db_42', label: 'Oil/Lube', serviceKind: 'oil_change' }, { value: 'db_43', label: 'Brakes', serviceKind: 'brakes' }, { value: 'db_44', label: 'Car Insurance', serviceKind: null }], directDelivery: [] } } };
    if (url.pathname === '/api/expense-form-submissions/receipt/analyze') result = { success: true, extracted: true, localReader: true, amount: 75.55, date: '2026-10-18', serviceOdometer: 50000, nextServiceOdometer: 55000, milesUntilNextService: 5000, nextServiceDate: '2027-01-18', needsManualEntry: false };
    if (url.pathname === '/api/expense-form-submissions/receipts/upload') result = { fileIds: ['https://example.test/new-service.jpg'] };
    if (url.pathname === '/api/expense-form-submissions' && route.request().method() === 'POST') result = { success: true, id: 55, slackNotificationSent: true };
    if (url.pathname === '/api/service-workspace/sheets') result = { connected: true, configured: true, canManage: true, url: 'https://docs.google.com/spreadsheets/d/test/edit', lastSuccess: '2026-10-19T18:00:00Z', error: null };
    if (url.pathname === '/api/internal-calendar/events') {
      const base = { carId: 2, carName: 'Urgent Audi', plateNumber: 'P2', start: '2026-10-19T12:00:00Z', end: '2026-10-19T13:00:00Z', status: 'completed', cancelled: false, timeStatus: 'confirmed' };
      const receipt = { ...base, id: 'service_history:receipt:7', bookingKey: 'service_history:receipt:7', source: 'maintenance', sourceId: 7, title: 'Receipt · Oil change', blocksAvailability: false, serviceEventKind: 'receipt', files: ['https://example.test/receipt.pdf'], detailUrl: '/admin/operations?tab=service-due&car=2' };
      const trip = { ...base, id: 'turo:4', bookingKey: 'turo:4', source: 'turo', sourceId: 4, title: 'Turo rental — Guest', blocksAvailability: true };
      const scope = url.searchParams.get('calendar');
      result = { cars: [{ carId: 2, carName: 'Urgent Audi', plateNumber: 'P2', carStatus: 'available' }, { carId: 4, carName: 'Inactive Lexus', plateNumber: 'P4', carStatus: 'INACTIVE' }], events: scope === 'services' ? [receipt] : scope === 'master' ? [trip, receipt] : [trip], warnings: [], complete: true, availabilityComplete: scope !== 'services', role: 'admin', timezone: 'America/Denver', from: url.searchParams.get('from'), to: url.searchParams.get('to') };
    }
    if (url.pathname === '/api/internal-calendar/sync') result = { sync: { configured: true, enabled: true, counts: {}, lastSuccess: '2026-10-19T18:00:00Z' }, import: { lastSuccess: '2026-10-19T18:00:00Z' } };
    await route.fulfill({ contentType: 'application/json', body: JSON.stringify(result) });
  });
  return calls;
}
for (const width of [360, 1280]) test(`service views, urgency, receipts and mobile sizing at ${width}`, async ({ page }) => {
  await page.setViewportSize({ width, height: 900 }); await fixture(page);
  await page.goto('/admin/operations?tab=service-due');
  const workspace = page.getByTestId('service-due-workspace');
  await expect(workspace.getByRole('button', { name: 'By car', exact: true })).toHaveAttribute('aria-pressed', 'true');
  const articles = workspace.locator('article');
  await expect(articles.first()).toContainText('Urgent Audi'); await expect(articles.last()).toContainText('No History Acura');
  await articles.first().getByRole('button').click();
  await expect(articles.first().getByRole('heading', { name: 'Urgent Audi' })).toBeVisible();
  await expect(workspace.getByRole('link', { name: 'Receipt / file 1' })).toHaveAttribute('href', 'https://example.test/receipt.pdf');
  await expect(workspace.getByText('Overdue · 8 days', { exact: true }).first()).toBeVisible();
  await workspace.getByRole('button', { name: 'By service', exact: true }).click();
  await workspace.getByRole('group', { name: 'Service categories' }).getByRole('button', { name: 'Tires', exact: true }).click();
  await expect(workspace.getByRole('table', { name: 'Service due spreadsheet' }).locator('tr[data-service-row]').first()).toContainText('Tires');
  await expect(workspace.getByRole('table', { name: 'Service due spreadsheet' }).locator('tr[data-service-row]').last()).toContainText('No Data');
  await expect(workspace.getByRole('link', { name: 'Open Google Sheet', exact: true })).toBeVisible();
  await expect(workspace.getByRole('button', { name: /CSV/i })).toHaveCount(0);
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
});

for (const width of [360, 1280]) test(`service category bar, vehicle photos and active fleet at ${width}`, async ({ page }) => {
  await page.setViewportSize({ width, height: 900 }); const calls = await fixture(page);
  await page.goto('/admin/operations?tab=service-due');
  const workspace = page.getByTestId('service-due-workspace');
  await expect(workspace).not.toContainText('Inactive Lexus');
  await workspace.getByRole('button', { name: 'By service', exact: true }).click();
  await expect(workspace.getByRole('combobox', { name: 'Service type' })).toHaveCount(0);
  const bar = workspace.getByRole('group', { name: 'Service categories' });
  await bar.getByRole('button', { name: 'Tires', exact: true }).click();
  await expect(bar.getByRole('button', { name: 'Tires', exact: true })).toHaveAttribute('aria-pressed','true');
  const cards = workspace.getByRole('table', { name: 'Service due spreadsheet' }).locator('tr[data-service-row]');
  await expect(cards).toHaveCount(3);
  await expect(cards.first()).toContainText('Upcoming Buick');
  await expect(cards.last()).toContainText('No History Acura');
  await expect(cards.first().getByRole('img', { name: 'Upcoming Buick' })).toBeVisible();
  await expect.poll(() => cards.first().getByRole('img', { name: 'Upcoming Buick' }).evaluate((img: HTMLImageElement) => img.naturalWidth)).toBeGreaterThan(0);
  await expect(cards.first()).toContainText('Tires');
  await expect(cards.first()).toContainText('As needed');
  expect(calls.filter(url => url.pathname.endsWith('/history'))).toHaveLength(0);
  await expect(workspace).not.toContainText('Inactive Lexus');
  await expect(workspace.getByRole('combobox', { name: 'Vehicle status' })).toHaveCount(0);
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  await cards.first().scrollIntoViewIfNeeded();
  await page.screenshot({ path: `/tmp/gla-service-grid-${width}.png` });
  await bar.getByRole('button', { name: 'Oil change', exact: true }).click();
  await expect(cards.first()).toContainText('Urgent Audi');
  await cards.first().getByRole('button', { name: 'History & files' }).click();
  await expect(workspace.getByRole('link', { name: 'Receipt / file 1' })).toBeVisible();
  expect(calls.filter(url => url.pathname.endsWith('/history'))).toHaveLength(1);
  await workspace.getByText('Legacy service recovery', { exact: false }).click();
  await expect(workspace).toContainText('4 receipts/files copied');
  await workspace.getByRole('button', { name: 'By car', exact: true }).click();
  await workspace.locator('article').first().getByRole('button').first().click();
  await expect(workspace.getByRole('link', { name: 'Open car Records & Files', exact: true })).toHaveAttribute('href','/admin/cars/2/records');
  await workspace.getByRole('button', { name: 'Service calendar', exact: true }).click();
  await expect(workspace.getByTestId('fleet-calendar')).toBeVisible();
  await expect(workspace).not.toContainText('Inactive Lexus');
});
for (const width of [360, 1280]) test(`service calendar day width resizes dates and events and persists at ${width}`, async ({ page }) => {
  await page.setViewportSize({ width, height: 900 }); await fixture(page);
  await page.goto('/admin/service-calendar?from=2026-10-18&to=2026-10-20');
  const calendar = page.getByTestId('fleet-calendar');
  const showTimeline = async () => {
    if (width < 768) {
      await calendar.getByRole('button', { name: /^Calendar filters/ }).click();
      await page.getByRole('dialog').getByRole('button', { name: 'Timeline', exact: true }).click();
      await page.getByRole('button', { name: /^Show \d+ events$/ }).click();
    }
  };
  await showTimeline();
  const slider = calendar.getByRole('slider', { name: 'Day width' });
  const timeline = calendar.getByTestId('fleet-calendar-timeline');
  const event = timeline.getByRole('button', { name: 'Receipt · Oil change · Urgent Audi', exact: true });
  await expect(slider).toHaveValue('160');
  await expect(event).toHaveCSS('width', '154px');
  await expect(event).toHaveCSS('left', '163px');
  await calendar.getByRole('button', { name: 'Wider days', exact: true }).click();
  await expect(slider).toHaveValue('176');
  await slider.focus(); await slider.press('End');
  await expect(slider).toHaveValue('400');
  await expect(event).toHaveCSS('width', '394px');
  await expect(event).toHaveCSS('left', '403px');
  expect(await event.evaluate(node => node.scrollWidth <= node.clientWidth)).toBe(true);
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  // The event remains under Oct 19; widening does not change its dates or data.
  await event.scrollIntoViewIfNeeded();
  await event.click();
  await expect(page.getByRole('link', { name: 'Open receipt / file 1' })).toBeVisible();
  await page.getByRole('button', { name: 'Close', exact: true }).click();
  await page.reload(); await showTimeline();
  await expect(slider).toHaveValue('400');
  await expect(event).toHaveCSS('width', '394px');
  await calendar.getByRole('button', { name: 'Narrower days', exact: true }).click();
  await expect(slider).toHaveValue('384');
});

test('service calendar shows receipt markers and files; master combines trip and service feeds', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 }); const calls = await fixture(page);
  await page.goto('/admin/operations?tab=service-due');
  await page.getByRole('button', { name: 'Service calendar', exact: true }).click();
  await expect(page.getByText('Receipt · Oil change', { exact: true })).toBeVisible();
  expect(calls.some(url => url.pathname === '/api/internal-calendar/events' && url.searchParams.get('calendar') === 'services')).toBe(true);
  await page.getByText('Receipt · Oil change', { exact: true }).click();
  await expect(page.getByRole('link', { name: 'Open receipt / file 1' })).toHaveAttribute('href', 'https://example.test/receipt.pdf');
  await page.getByRole('button', { name: 'Close', exact: true }).click();
  await page.goto('/admin/internal-calendar');
  await expect(page.getByText('Receipt · Oil change', { exact: true })).toBeVisible();
  await expect(page.getByText('Turo rental — Guest', { exact: true })).toBeVisible();
  await page.getByRole('link', { name: 'Vehicle trips', exact: true }).click();
  await expect(page.getByText('Turo rental — Guest', { exact: true })).toBeVisible();
  await expect(page.getByText('Receipt · Oil change', { exact: true })).toHaveCount(0);
});

for (const entry of ['service portal', 'existing Forms'] as const) test(`local receipt fields and one service submission from ${entry}`, async ({ page }) => {
  await page.setViewportSize({ width: 360, height: 844 }); await fixture(page);
  let submitted: any;
  page.on('request', request => { if (new URL(request.url()).pathname === '/api/expense-form-submissions' && request.method() === 'POST') submitted = request.postDataJSON(); });
  if (entry === 'service portal') {
    await page.goto('/admin/operations?tab=service-due');
    await page.getByTestId('service-due-workspace').locator('article').first().getByRole('button').click();
    await page.getByRole('button', { name: 'Add service record', exact: true }).click();
    await expect(page.getByRole('dialog')).toContainText('Oil/Lube');
    await expect(page.getByRole('dialog').getByPlaceholder('Type car name, VIN, or plate number...')).toBeDisabled();
  } else {
    await page.route('**/api/auth/me', route => route.fulfill({ contentType: 'application/json', body: JSON.stringify({ user: { id: 7, firstName: 'Test', isAdmin: false, isEmployee: true, isClient: false, tourCompleted: true } }) }));
    await page.goto('/staff/forms/submit?category=cogs&field=db_42');
    await page.getByPlaceholder('Type car name, VIN, or plate number...').fill('Audi');
    await page.getByText('Urgent Audi - P2', { exact: true }).click();
  }
  await expect(page.getByText('Service record details', { exact: true })).toBeVisible();
  await page.locator('input[type=file]').setInputFiles({ name: 'oil.jpg', mimeType: 'image/jpeg', buffer: Buffer.from('receipt') });
  await expect(page.getByLabel('Service / receipt date', { exact: true })).toHaveValue('2026-10-18');
  await expect(page.getByLabel('Next service at (odometer miles)', { exact: true })).toHaveValue('55000');
  await expect(page.getByLabel('Miles until next service', { exact: true })).toHaveValue('5000');
  await expect(page.getByRole('button', { name: 'Submit', exact: true })).toBeDisabled();
  await page.getByRole('checkbox', { name: 'I checked the service date, final price and any next-service details against the receipt.' }).check();
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  await page.getByRole('button', { name: 'Submit', exact: true }).click();
  await expect.poll(() => submitted?.field).toBe('db_42');
  expect(submitted).toMatchObject({ carId: 2, employeeId: 41, category: 'cogs', amount: 75.55, receiptUrls: ['https://example.test/new-service.jpg'], serviceDetails: { valuesConfirmed: true, nextOdometer: 55000, milesUntilNext: 5000, nextDueDate: '2027-01-18' } });
});

test('mileage overdue is visible with source/time and historical service mileage stays manual', async ({ page }) => {
  await page.setViewportSize({ width: 360, height: 844 }); await fixture(page);
  await page.route('**/api/service-workspace', route => {
    const vehicle: any = car(2, 'Urgent Audi', null);
    vehicle.currentMileage = { miles: 55200, source: 'bouncie', observedAt: '2026-10-19T19:59:00Z', state: 'recent', warning: null };
    const oil = { ...service('2:oil_change','oil_change',null), lastServiced: '2026-10-18', nextServiceOdometer: 55000, odometerAtService: 50000, milesUntilNext: 5000, milesRemaining: -200, mileageOverdue: true, status: 'overdue' };
    vehicle.services = [oil]; vehicle.nextService = oil;
    return route.fulfill({ contentType: 'application/json', body: JSON.stringify({ cars: [vehicle], rules: [{ kind: 'oil_change', label: 'Oil change' }] }) });
  });
  await page.goto('/admin/operations?tab=service-due');
  await expect(page.getByText('Overdue · 200 miles', { exact: true }).first()).toBeVisible();
  await expect(page.getByText('55,200 miles · Bouncie', { exact: true })).toBeVisible();
  await page.getByTestId('service-due-workspace').locator('article').first().getByRole('button').click();
  await page.getByRole('button', { name: 'Add service record', exact: true }).click();
  await expect(page.getByRole('dialog').getByText('55,200 miles · Bouncie', { exact: true })).toBeVisible();
  await expect(page.getByLabel('Odometer at service (miles)', { exact: true })).toHaveValue('');
});

for (const width of [360, 1280]) test(`license deadline can be cleared without losing history at ${width}`, async ({ page }) => {
  await page.setViewportSize({ width, height: 900 }); await fixture(page);
  let dueDate: string | null = '2026-11-01';
  const writes: any[] = [];
  await page.route('**/api/service-workspace', route => route.fulfill({ contentType: 'application/json', body: JSON.stringify({
    success: true, canOpenCarFiles: true, today: '2026-10-19', cars: [{ ...car(2, 'Urgent Audi', -8), services: [
      { id: '2:license_registration', kind: 'license_registration', label: 'License', lastServiced: '2025-02-18', lastServicedSource: 'legacy', dueDate, daysUntil: dueDate ? 13 : null, status: dueDate ? 'due_soon' : 'no_data' },
      { id: '2:registration', kind: 'registration', label: 'Registration expiration', lastServiced: null, dueDate: null, daysUntil: null, status: 'no_data' },
    ], nextService: null }], rules: [{ kind: 'license_registration', label: 'License', interval: null }] }) }));
  await page.route('**/api/service-workspace/cars/2/license-due', async route => {
    writes.push(route.request().postDataJSON()); dueDate = writes.at(-1).dueDate;
    await route.fulfill({ contentType: 'application/json', body: JSON.stringify({ success: true, dueDate }) });
  });
  await page.goto('/admin/operations?tab=service-due');
  const workspace = page.getByTestId('service-due-workspace');
  await workspace.locator('article').first().getByRole('button').first().click();
  await expect(workspace).not.toContainText('License & registration');
  await workspace.getByRole('button', { name: 'Edit license due date', exact: true }).click();
  await expect(page.getByRole('textbox', { name: 'License due date' })).toHaveValue('2026-11-01');
  await page.getByRole('button', { name: 'Clear date', exact: true }).click();
  await expect.poll(() => writes).toEqual([{ dueDate: null }]);
  await workspace.getByRole('button', { name: 'Edit license due date', exact: true }).click();
  await expect(page.getByRole('textbox', { name: 'License due date' })).toHaveValue('');
  await page.getByRole('textbox', { name: 'License due date' }).fill('2027-02-18');
  await page.getByRole('button', { name: 'Save', exact: true }).click();
  await expect.poll(() => writes.length).toBe(2);
  expect(writes[1]).toEqual({ dueDate: '2027-02-18' });
  await page.reload();
  await workspace.locator('article').first().getByRole('button').first().click();
  await expect(workspace).toContainText('Last serviced: Feb 18, 2025');
  await expect(workspace).toContainText('Due date: Feb 18, 2027');
  await workspace.getByRole('button', { name: 'By service', exact: true }).click();
  await workspace.getByRole('group', { name: 'Service categories' }).getByRole('button', { name: 'License', exact: true }).click();
  const grid = workspace.getByRole('table', { name: 'Service due spreadsheet' });
  await grid.getByRole('button', { name: 'Edit license due date', exact: true }).click();
  await page.getByRole('button', { name: 'Clear date', exact: true }).click();
  await expect.poll(() => writes.length).toBe(3);
  await expect(grid).toContainText('No Data');
  await expect(grid).toContainText('Feb 18, 2025');
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
});
