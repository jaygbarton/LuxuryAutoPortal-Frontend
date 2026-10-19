import { expect, test } from '@playwright/test';
for (const role of ['admin', 'employee']) {
  test(`${role} dashboard has read-only time and collapsed news at 360px`, async ({ page }) => {
    await page.setViewportSize({ width: 360, height: 800 });
    await page.route(url => url.pathname.startsWith('/api/'), async route => {
      const path = new URL(route.request().url()).pathname;
      let data: any = { success: true, data: [], total: 0, notifications: [], unreadCount: 0 };
      if (path === '/api/auth/me') data = { user: { id: 7, name: 'Test Worker', roleName: role === 'admin' ? 'Admin' : 'Employee', isEmployee: role === 'employee', isAdmin: role === 'admin', isSuperAdmin: role === 'admin', isClient: false, tourCompleted: true } };
      if (path === '/api/news-media/dashboard') data = { success: true, slot1: [], slot2: [] };
      if (path === '/api/me/employee') data = { success: true, data: { employee_aid: 41, employee_first_name: 'Test', employee_last_name: 'Worker' } };
      if (path === '/api/me/time-sheet/dashboard') data = { success: true, data: { hasEmployee: true, isClockedIn: true, elapsedSeconds: 7200, period: { start: '2026-10-16', end: '2026-10-31' }, workedHours: 32.5, activeHours: 2, periodStatus: 'ready' } };
      await route.fulfill({ contentType: 'application/json', body: JSON.stringify(data) });
    });
    await page.goto(role === 'admin' ? '/dashboard' : '/staff/dashboard');
    const summary = page.getByRole('region', { name: 'Your time summary' });
    await expect(summary.getByText('Clocked in', { exact: true })).toBeVisible();
    await expect(summary.getByText('2h 0m on the clock')).toBeVisible();
    await expect(summary.getByText('32h 30m')).toBeVisible();
    await expect(summary.getByText('Oct 16, 2026 – Oct 31, 2026')).toBeVisible();
    await expect(summary.getByRole('button')).toHaveCount(0);
    const news = page.locator('details').filter({ hasText: 'Company updates & newsletters' });
    await expect(news).not.toHaveAttribute('open', '');
    expect((await summary.boundingBox())!.y).toBeLessThan((await news.boundingBox())!.y);
    await news.locator('summary').click();
    await expect(news.getByText('No company updates.')).toBeVisible();
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  });
}
