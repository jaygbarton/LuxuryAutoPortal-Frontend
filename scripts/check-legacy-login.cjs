// Local fixtures only; never submit credentials or requests to production.
const { chromium } = require('@playwright/test');
const assert = require('node:assert/strict');
const preview = process.env.LEGACY_PREVIEW_URL || 'http://127.0.0.1:5201';
(async () => {
  const browser = await chromium.launch({ executablePath: process.env.CHROMIUM_PATH || '/usr/bin/chromium', args: ['--no-sandbox'] });
  let count = 0;
  try {
    for (const kind of ['other', 'system']) {
      for (const scenario of ['forbidden', 'captcha', 'network', 'timeout', 'rejected', 'expired', 'restore-error']) {
        const context = await browser.newContext();
        const page = await context.newPage();
        const errors = [];
        page.on('pageerror', e => errors.push(e.message));
        let loginCalls = 0;
        let signedIn = false;
        const role = kind === 'other' ? 'admin' : 'developer';
        const user = { role_name: role, role_is_admin: kind === 'other' ? 1 : 0, role_is_developer: kind === 'system' ? 1 : 0, role_is_client: 0, role_is_employee: 0, user_other_aid: 999, user_system_aid: 999, user_other_fname: 'Fixture', user_other_lname: 'User', user_key: 'fixture', system_maintenance: false };
        if (['expired', 'restore-error'].includes(scenario)) {
          await context.addInitScript(() => localStorage.setItem('glatoken', JSON.stringify({ token: 'expired-fixture' })));
        }
        await page.route('**/*', async route => {
          const url = new URL(route.request().url());
          if (url.origin !== new URL(preview).origin) return route.abort();
          if (!url.pathname.includes('/rest/')) return route.continue();
          if (url.pathname.endsWith(`/user-${kind}/token`)) {
            if (scenario === 'restore-error') return route.fulfill({ status: 403, body: 'Forbidden' });
            return route.fulfill({ json: signedIn ? { success: true, count: 1, data: user } : { success: false, count: 0, error: 'Expired token' } });
          }
          if (url.pathname.endsWith(`/user-${kind}/login`)) {
            loginCalls++;
            if (scenario === 'forbidden') return route.fulfill({ status: 403, body: 'Forbidden' });
            if (scenario === 'captcha') return route.fulfill({ status: 202, contentType: 'text/html', body: '<html>Browser verification</html>' });
            if (scenario === 'network') return route.abort('failed');
            if (scenario === 'timeout') return; // Keep pending until the UI aborts it.
            if (scenario === 'rejected') return route.fulfill({ json: { success: false, count: 0, error: 'Incorrect email or password.' } });
            signedIn = true;
            return route.fulfill({ json: { success: true, count: 1, data: [user, 'valid-fixture'] } });
          }
          return route.fulfill({ json: { success: true, count: 0, data: [], total: 0, year: 2026, date_now: '2026-10-07' } });
        });
        await page.goto(preview + (kind === 'other' ? '/login' : '/developer/login'));
        const submit = page.getByRole('button', { name: 'Login', exact: true });
        if (scenario === 'restore-error') {
          await page.getByText('The sign-in service is unavailable.', { exact: false }).waitFor();
          await submit.waitFor();
        } else {
          await page.locator(`[name="user_${kind}_email"]`).fill('test@example.invalid');
          await page.locator('[name="password"]').fill('fixture-password');
          await submit.click();
          if (scenario === 'expired') {
            await page.waitForURL(url => url.pathname.startsWith(`/${role}`) && !url.pathname.endsWith('/login'));
            assert.equal(await page.evaluate(() => JSON.parse(localStorage.getItem('glatoken')).token), 'valid-fixture');
          } else {
            const message = scenario === 'rejected' ? 'Incorrect email or password.' : scenario === 'timeout' ? 'Sign-in timed out. Please try again.' : 'The sign-in service is unavailable.';
            await page.getByText(message, { exact: false }).waitFor({ timeout: 25000 });
            assert.equal(await submit.isEnabled(), true);
            assert.equal(await page.locator('[name="password"]').inputValue(), 'fixture-password');
          }
          assert.equal(loginCalls, 1);
        }
        assert.deepEqual(errors, [], `${kind}/${scenario} browser errors`);
        console.log(`PASS ${kind}/${scenario}`);
        count++;
        await context.close();
      }
    }
    console.log(`${count} legacy login checks passed`);
  } finally { await browser.close(); }
})().catch(error => { console.error(error); process.exitCode = 1; });
