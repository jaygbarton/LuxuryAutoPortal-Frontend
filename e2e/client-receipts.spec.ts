import { expect, test, type Page } from '@playwright/test';
import { PDFDocument } from 'pdf-lib';

async function fixture(page: Page) {
  const data: any = { formulaSetting: { carManagementSplitPercent: 50, carOwnerSplitPercent: 50 } };
  for (const key of ['incomeExpenses','directDelivery','cogs','parkingFeeLabor','reimbursedBills','officeSupport','history','parkingAirportQB']) data[key] = Array.from({length:12}, (_,i) => ({month:i+1, ...(key==='cogs' && i===0 ? {oilLube:75} : {})}));
  const pdf = await PDFDocument.create(); pdf.addPage().drawText('Service receipt - $75.00'); const pdfBytes = Buffer.from(await pdf.save());
  const png = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+jZ+0AAAAASUVORK5CYII=','base64');
  const writes: string[] = [];
  await page.addInitScript(() => {
    const original = window.fetch;
    (window as any).receiptRequests = [];
    window.fetch = (input, init) => {
      const url = String(input);
      if (url.includes('/file')) (window as any).receiptRequests.push({url,credentials:init?.credentials});
      return original(input, init);
    };
  });
  await page.route(url => url.pathname.startsWith('/api/'), async route => {
    const url = new URL(route.request().url());
    if (route.request().method() !== 'GET') writes.push(url.pathname);
    if (url.pathname === '/api/income-expense/images/11/file') return route.fulfill({contentType:'image/png',body:png});
    if (url.pathname === '/api/expense-form-submissions/receipt/file') return route.fulfill({contentType:'application/pdf',body:pdfBytes});
    let result: any = {success:true,data:[],total:0,notifications:[],unreadCount:0};
    if (url.pathname === '/api/auth/me') result = {user:{id:42,firstName:'Client',isClient:true,isAdmin:false,isEmployee:false,tourCompleted:true}};
    if (url.pathname === '/api/cars/1') result = {success:true,data:{id:1,makeModel:'Tesla Model 3',year:2023,plateNumber:'T394ST'}};
    if (/^\/api\/income-expense\/1\/\d{4}$/.test(url.pathname)) result = {success:true,data};
    if (url.pathname === '/api/income-expense/images/summary') result = {success:true,cells:{'1:cogs:oilLube':2}};
    if (url.pathname === '/api/income-expense/images') result = {success:true,images:url.searchParams.get('field')==='oilLube' ? [
      {id:'11',url:'http://127.0.0.1:5346/api/income-expense/images/11/file',filename:'cell-photo.png'},
      {id:'form-55-0',url:'/api/expense-form-submissions/receipt/file?fileId=stored.pdf&submissionId=55',filename:'staff-service.pdf'},
    ] : []};
    await route.fulfill({json:result});
  });
  return writes;
}
for (const width of [390,1280]) test(`client opens cell and staff receipts without edit access at ${width}px`, async ({page}) => {
  await page.setViewportSize({width,height:900}); const writes = await fixture(page);
  await page.goto('/admin/cars/1/earnings');
  const row = page.locator('tr').filter({has:page.getByText('Oil/Lube',{exact:true})}).first();
  await row.getByTitle('View uploaded receipts').click();
  const image = page.getByRole('img',{name:'cell-photo.png',exact:true});
  await expect(image).toBeVisible();
  await expect.poll(() => image.evaluate((el:any)=>el.complete && el.naturalWidth > 0)).toBe(true);
  await expect(page.getByText('View PDF',{exact:true})).toBeVisible();
  await expect(page.getByText('Couldn’t load receipt')).toHaveCount(0);
  await expect(page.getByTitle('Remove this receipt')).toHaveCount(0);
  await expect(page.getByTitle('Edit amount / receipts')).toHaveCount(0);
  await image.click(); await expect(page.getByRole('dialog')).toBeVisible();
  await page.keyboard.press('Escape');
  await page.getByText('View PDF',{exact:true}).click();
  const frame = page.getByRole('dialog').locator('iframe');
  await expect(frame).toBeVisible(); await expect(frame).toHaveAttribute('src',/^blob:/);
  const requests = await page.evaluate(() => (window as any).receiptRequests);
  expect(requests).toHaveLength(2); expect(requests.every((r:any)=>r.credentials==='include')).toBe(true);
  expect(writes).toEqual([]);
});
