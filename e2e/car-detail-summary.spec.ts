import { expect, test } from '@playwright/test';

for (const width of [390, 1024, 1280, 1440, 1920]) {
  test(`vehicle owner and status remain readable at ${width}px`, async ({ page }) => {
    await page.setViewportSize({ width, height: 1100 });
    const errors: string[] = [];
    page.on('pageerror', error => errors.push(error.message));
    await page.route('**/*', async route => {
      const url = new URL(route.request().url());
      if (!['127.0.0.1', 'localhost'].includes(url.hostname)) return route.abort();
      if (!url.pathname.startsWith('/api/')) return route.continue();
      let data: any = { success: true, data: [], total: 0, notifications: [], unreadCount: 0 };
      if (url.pathname === '/api/auth/me') data = { user: { id: 1, firstName: 'Test', lastName: 'Admin', isAdmin: true, isSuperAdmin: false, isEmployee: false, isClient: false, tourCompleted: true, effectiveTimezone: 'America/Denver' } };
      if (url.pathname === '/api/public-page-status') data = { isPublic: true };
      if (url.pathname === '/api/cars/88') data = { success: true, data: {
        id: 88, makeModel: 'Porsche Panamera', make: 'Porsche', model: 'Panamera', year: 2018,
        vin: '1HGCM82633A004352', licensePlate: 'TEST88', mileage: 87000,
        status: 'ACTIVE', rawStatus: 'available', managementStatus: 'management', locationTag: 'slc',
        clientId: 12, photos: [], vehicleFeatures: ['All-wheel drive', 'Blind Spot Warning', 'Apple CarPlay'],
        owner: { firstName: 'Alexandria-Catherine', lastName: 'Montgomery-Wellington', email: 'alexandria.catherine.montgomery.wellington@example.test', lastLoginAt: '2026-10-05T18:38:37Z', lastLogoutAt: null },
      } };
      if (url.pathname === '/api/clients/12') data = { success: true, data: { lastLoginAt: '2026-10-05T18:38:37Z', lastLogoutAt: null } };
      if (url.pathname.startsWith('/api/onboarding/vin/')) data = { success: true, data: null };
      await route.fulfill({ json: data });
    });
    await page.goto('/admin/cars/88');
    const owner = page.getByText('Assigned To', { exact: true }).locator('..');
    await expect(owner).toBeVisible();
    const summary = owner.locator('..');
    const cells = [owner, ...['Car Status', 'Management', 'Car Location', 'Online Status', 'Last Login'].map(label => summary.getByText(label, { exact: true }).locator('..'))];
    await expect(cells[1]).toContainText('ACTIVE');
    await expect(owner).toContainText('alexandria.catherine.montgomery.wellington@example.test');
    await expect(cells[4]).toContainText('Online');
    const bounds = (await summary.boundingBox())!;
    const boxes = await Promise.all(cells.map(async cell => {
      await expect(cell).toBeVisible();
      const box = (await cell.boundingBox())!;
      expect(box.x).toBeGreaterThanOrEqual(bounds.x - 1);
      expect(box.x + box.width).toBeLessThanOrEqual(bounds.x + bounds.width + 1);
      expect(await cell.evaluate(el => el.scrollWidth <= el.clientWidth + 1)).toBe(true);
      return box;
    }));
    for (let i = 0; i < boxes.length; i++) for (let j = i + 1; j < boxes.length; j++) {
      const a = boxes[i], b = boxes[j];
      const overlaps = Math.min(a.x + a.width, b.x + b.width) - Math.max(a.x, b.x) > 1
        && Math.min(a.y + a.height, b.y + b.height) - Math.max(a.y, b.y) > 1;
      expect(overlaps, `summary fields ${i} and ${j} overlap`).toBe(false);
    }
    expect(errors).toEqual([]);
    await summary.screenshot({ path: test.info().outputPath(`car-detail-summary-${width}.png`) });
  });
}
