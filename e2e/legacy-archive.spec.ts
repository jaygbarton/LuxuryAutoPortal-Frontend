import { expect, test, type Page } from '@playwright/test';
const ROOT = '/api/developer/legacy-archives';
const id = '11111111-1111-4111-8111-111111111111', fileId = 'a'.repeat(64), tableId = 'b'.repeat(64);
const chunkSize = 3 * 1024 * 1024;
async function fixtures(page: Page, developer = true, ready = true, resume = 0, compressed = false, failFirst = false) {
  const chunks: number[] = []; let indexed = false, databaseIndexes = 0;
  const archive = { id, name: 'old-software.tar.gz', size: 2 * chunkSize + 123, createdAt: '2026-10-13T12:00:00Z', status: ready ? 'ready' : 'uploading', uploadedChunks: resume, totalChunks: 3, chunkSize, counts: { receipt: ready ? 1 : 0, data: 1, page: 1, file: 0 }, tableCount: ready && !compressed ? 1 : 0, skipped: 0, warnings: [], databaseCandidateCount: compressed ? 4 : 0, needsDatabaseIndex: compressed, databaseIndex: undefined as any };
  const file = { id: fileId, path: 'portal/img/receipts/gas.pdf', size: 20, category: 'receipt' };
  const table = { id: tableId, name: 'receipts', fileId: 'c'.repeat(64), sourcePath: 'mysql/main.zst', database: 'legacy', columns: ['id', 'description', 'password_hash'], rowCount: 1 };
  await page.route('**/*', async route => {
    const request = route.request(), url = new URL(request.url()), path = url.pathname;
    if (!path.startsWith('/api/')) { if (url.origin !== 'http://127.0.0.1:5300') return route.abort(); return route.continue(); }
    let data: unknown = { success: true, data: [], total: 0, notifications: [], unreadCount: 0 };
    if (path === '/api/auth/me') data = { user: { id: 1, fullname: 'Test Developer', email: 'dev@example.test', isAdmin: true, isSuperAdmin: developer, isEmployee: false, isClient: false, effectiveTimezone: 'America/Denver' } };
    else if (path === '/api/developer/public-pages') data = { pages: [] };
    else if (path === ROOT) data = request.method() === 'POST' ? { archive } : { archives: [archive] };
    else if (path === `${ROOT}/${id}`) data = { archive };
    else if (path.startsWith(`${ROOT}/${id}/chunks/`)) {
      const part = Number(path.split('/').pop()); chunks.push(part);
      expect(request.postDataBuffer()?.length).toBe(part === 2 ? 123 : chunkSize);
      archive.uploadedChunks = part + 1; data = { archive };
    } else if (path === `${ROOT}/${id}/index`) { indexed = true; archive.status = 'ready'; archive.counts.receipt = 1; archive.tableCount = 1; data = { archive }; }
    else if (path === `${ROOT}/${id}/index-databases`) {
      databaseIndexes++;
      const failed = failFirst && databaseIndexes === 1;
      archive.databaseIndex = { status: failed ? 'failed' : 'ready', startedAt: '2026-10-13T12:00:00Z', completed: 4, total: 4, files: Array.from({ length: 4 }, (_, i) => ({ fileId: String(i), path: `mysql/database-${i}.zst`, status: failed && i === 0 ? 'failed' : 'ready', tableCount: failed && i === 0 ? undefined : 1, error: failed && i === 0 ? 'Truncated Zstandard database backup.' : undefined })) };
      archive.needsDatabaseIndex = failed; archive.tableCount = failed ? 0 : 2; data = { archive };
    }
    else if (path === `${ROOT}/${id}/files`) data = { files: [file], total: 1 };
    else if (path === `${ROOT}/${id}/tables`) data = { tables: archive.tableCount ? compressed ? [table, { ...table, id: 'd'.repeat(64), fileId: 'e'.repeat(64), sourcePath: 'mysql/staging.zst' }] : [table] : [] };
    else if (path === `${ROOT}/${id}/tables/${tableId}`) data = { table, rows: [['1', 'Gas receipt', '[redacted]']], total: 1 };
    else if (path === `${ROOT}/${id}/files/${fileId}`) return route.fulfill({ contentType: 'application/pdf', body: '%PDF-test receipt' });
    return route.fulfill({ json: data });
  });
  return { archive, chunks, indexed: () => indexed, databaseIndexes: () => databaseIndexes };
}
for (const width of [390, 1280]) test(`developer can browse receipts and SQL records at ${width}px`, async ({ page }) => {
  await page.setViewportSize({ width, height: 844 }); await fixtures(page);
  await page.goto('/admin/developer');
  await expect(page.getByText('Legacy Software Archive', { exact: true })).toBeVisible();
  await expect(page.getByRole('link', { name: 'Download inventory' })).toHaveAttribute('href', `${ROOT}/${id}/inventory`);
  await page.getByRole('button', { name: 'Receipts (1)', exact: true }).click();
  await expect(page.getByText('portal/img/receipts/gas.pdf', { exact: true })).toBeVisible();
  await page.getByRole('button', { name: 'View', exact: true }).click();
  await expect(page.getByRole('dialog').getByRole('link', { name: 'Download file' })).toHaveAttribute('href', `${ROOT}/${id}/files/${fileId}`);
  await page.keyboard.press('Escape');
  await page.getByRole('combobox', { name: 'Archived database table' }).selectOption(tableId);
  await expect(page.getByRole('cell', { name: 'Gas receipt', exact: true })).toBeVisible();
  await expect(page.getByRole('cell', { name: '[redacted]', exact: true })).toBeVisible();
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= document.documentElement.clientWidth)).toBe(true);
});
test('regular admin cannot open the developer archive', async ({ page }) => {
  await fixtures(page, false); await page.goto('/admin/developer');
  await expect(page).not.toHaveURL(/\/admin\/developer$/);
  await expect(page.getByText('Legacy Software Archive', { exact: true })).toHaveCount(0);
});
test('tar.gz upload resumes at the next missing chunk and triggers indexing', async ({ page }) => {
  const state = await fixtures(page, true, false, 1);
  await page.goto('/admin/developer');
  await page.getByLabel('Legacy backup file').setInputFiles({ name: 'old-software.tar.gz', mimeType: 'application/gzip', buffer: Buffer.alloc(2 * chunkSize + 123) });
  await expect.poll(() => state.indexed()).toBe(true);
  expect(state.chunks).toEqual([1, 2]);
  await expect(page.getByText('Backup uploaded', { exact: true })).toBeVisible();
});
test('compressed database recovery starts once and separates overlapping source dumps', async ({ page }) => {
  const state = await fixtures(page, true, true, 0, true);
  await page.goto('/admin/developer');
  await expect(page.getByRole('heading', { name: '4 database backups found' })).toBeVisible();
  await expect.poll(() => state.databaseIndexes()).toBe(1);
  await expect(page.getByRole('status').filter({ hasText: 'Database indexing complete' })).toBeVisible();
  const table = page.getByRole('combobox', { name: 'Archived database table' });
  await expect(table.locator('optgroup')).toHaveCount(2);
  await expect(table.locator('optgroup').first()).toHaveAttribute('label', 'mysql/main.zst · legacy');
  await expect(table.locator('optgroup').nth(1)).toHaveAttribute('label', 'mysql/staging.zst · legacy');
  await table.selectOption(tableId);
  await expect(page.getByRole('cell', { name: 'Gas receipt', exact: true })).toBeVisible();
  expect(state.chunks).toEqual([]); expect(state.databaseIndexes()).toBe(1);
});
test('database failure remains visible and retries only after a deliberate click', async ({ page }) => {
  const state = await fixtures(page, true, true, 0, true, true);
  await page.goto('/admin/developer');
  await expect(page.getByText(/Truncated Zstandard database backup/)).toBeVisible();
  expect(state.databaseIndexes()).toBe(1);
  await page.getByRole('button', { name: 'Retry database backups' }).click();
  await expect.poll(() => state.databaseIndexes()).toBe(2);
  await expect(page.getByRole('status').filter({ hasText: 'Database indexing complete' })).toBeVisible();
  expect(state.chunks).toEqual([]);
});
test('interrupted database processing can resume after a server restart', async ({ page }) => {
  const state = await fixtures(page, true, true, 0, true);
  state.archive.databaseIndex = { status: 'processing', startedAt: '2026-10-13T12:00:00Z', completed: 0, total: 4, files: [{ fileId: 'one', path: 'mysql/main.zst', status: 'processing' }] };
  await page.goto('/admin/developer');
  const resume = page.getByRole('button', { name: 'Resume database backups' });
  await expect(resume).toBeEnabled(); expect(state.databaseIndexes()).toBe(0);
  await resume.click();
  await expect.poll(() => state.databaseIndexes()).toBe(1);
  await expect(page.getByRole('status').filter({ hasText: 'Database indexing complete' })).toBeVisible();
});
