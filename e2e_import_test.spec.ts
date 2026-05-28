import { test, expect } from '@playwright/test';

const FRONTEND = 'http://localhost:5000';
const CSV_PATH = '/tmp/test_import.csv';
const SS = (p: string) => `/tmp/ie_screenshots/${p}.png`;

test('I&E Import: full browser flow', async ({ page }) => {
  const ss = async (name: string) => page.screenshot({ path: SS(name) });

  // 1. Login
  await page.goto(`${FRONTEND}/admin/login`, { waitUntil: 'domcontentloaded', timeout: 20000 });
  await ss('01_login');

  await page.fill('input[type="email"]', 'verifytest@gla.local');
  await page.fill('input[type="password"]', 'VerifyTest@123');
  await page.click('button[type="submit"]');
  await page.waitForURL(url => !url.toString().includes('login'), { timeout: 10000 });
  await ss('02_dashboard');
  console.log('Logged in, URL:', page.url());

  // 2. Navigate to I&E
  await page.goto(`${FRONTEND}/admin/income-expenses`, { waitUntil: 'networkidle', timeout: 20000 });
  await ss('03_ie_main');

  // 3. Select car — look for car selector dropdowns
  await page.waitForTimeout(2000);
  await ss('04_ie_loaded');
  
  // The page has a car selector. Find it by iterating comboboxes.
  const comboboxes = page.locator('[role="combobox"]');
  const comboCnt = await comboboxes.count();
  console.log(`Found ${comboCnt} comboboxes`);

  // Print their texts to identify the car selector
  for (let i = 0; i < comboCnt; i++) {
    const txt = await comboboxes.nth(i).textContent();
    console.log(`  combobox[${i}]: "${txt}"`);
  }

  // Typically the first combobox is "Select Car", the second is Year
  // Click first combobox and pick any car
  if (comboCnt > 0) {
    await comboboxes.first().click();
    await page.waitForTimeout(500);
    await ss('05_car_dropdown');
    
    const options = page.locator('[role="option"]');
    const optCount = await options.count();
    console.log(`Car options: ${optCount}`);
    if (optCount > 0) {
      const optText = await options.first().textContent();
      console.log(`Selecting: "${optText}"`);
      await options.first().click();
    } else {
      // Already no car selected — Import button won't show. Try a different approach.
      await page.keyboard.press('Escape');
    }
  }

  await page.waitForTimeout(2000);
  await ss('06_car_selected');

  // 4. Check if Import button appears
  const importBtnLocator = page.locator('button').filter({ hasText: /^Import$/ });
  const importBtnVisible = await importBtnLocator.isVisible().catch(() => false);
  console.log(`Import button visible: ${importBtnVisible}`);

  if (!importBtnVisible) {
    // Try year selector — change year to 2026 first
    const yearCombos = page.locator('[role="combobox"]').filter({ hasText: /20\d\d/ });
    const yearCount = await yearCombos.count();
    console.log(`Year comboboxes: ${yearCount}`);
    if (yearCount > 0) {
      await yearCombos.first().click();
      await page.waitForTimeout(500);
      const opt2026 = page.locator('[role="option"]').filter({ hasText: '2026' }).first();
      if (await opt2026.isVisible()) { await opt2026.click(); console.log('Year set to 2026'); }
      else { await page.keyboard.press('Escape'); }
      await page.waitForTimeout(1000);
    }
    await ss('06b_after_year');
  }

  // 5. Click Import
  await expect(importBtnLocator).toBeVisible({ timeout: 5000 });
  await importBtnLocator.click();
  await ss('07_modal_opening');

  // 6. Verify modal content
  const modal = page.locator('[role="dialog"]');
  await expect(modal).toBeVisible({ timeout: 5000 });
  console.log('Modal opened');
  await ss('08_modal_open');

  // 7. Upload file
  const fileInput = modal.locator('input[type="file"]');
  await fileInput.setInputFiles(CSV_PATH);
  await page.waitForTimeout(500);
  await ss('09_file_set');
  
  // Verify file selection text shown
  const selectionText = modal.locator('p').filter({ hasText: /test_import|Selected/ }).first();
  if (await selectionText.isVisible()) {
    console.log('File selection text:', await selectionText.textContent());
  }

  // 8. Submit and capture API response
  const [apiResp] = await Promise.all([
    page.waitForResponse(r => r.url().includes('/api/income-expense/import'), { timeout: 15000 }),
    modal.locator('button').filter({ hasText: 'Import Data' }).click(),
  ]);
  
  const apiStatus = apiResp.status();
  const apiBody = await apiResp.json().catch(() => ({})) as any;
  console.log(`Import API: status=${apiStatus}, success=${apiBody.success}, message=${apiBody.message}`);
  await ss('10_after_import_submit');

  // 9. Wait for toast / modal close
  await page.waitForTimeout(3000);
  await ss('11_final_state');

  // Check for success toast
  const toastTitle = page.locator('[class*="ToastTitle"], [data-title], li[role="status"]').first();
  let toastTxt = '';
  if (await toastTitle.isVisible().catch(() => false)) {
    toastTxt = await toastTitle.textContent() || '';
    console.log('Toast:', toastTxt);
  }
  
  // Also check page body for success text
  const body = await page.textContent('body') || '';
  const hasSuccess = body.includes('Import Successful') || body.includes('successfully');
  console.log(`Success text in page: ${hasSuccess}`);

  // Assertions
  expect(apiStatus).toBe(200);
  expect(apiBody.success).toBe(true);
});
