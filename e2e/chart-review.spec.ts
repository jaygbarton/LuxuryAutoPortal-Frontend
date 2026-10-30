import{test,expect,type Page}from'@playwright/test';
import { PDFDocument } from 'pdf-lib';
async function fixture(page:Page,options:{manager?:boolean;home?:'slc'|'wilmington';cohost?:boolean}={}){
 const writes:any[]=[],reads:string[]=[],errors:string[]=[];
 const entry:any={key:'receipt:1',sourceId:1,adjustmentId:null,version:0,kind:'parking',date:'2026-10-01',employeeId:41,carId:101,amount:50,sourceAmount:50,name:'Own Driver',sourceEmployeeName:'Own Driver',carName:'Own vehicle',returnReference:'turo:9',decision:'auto',reason:'',exclusion:'$40+ ticket awaiting manager review',anomaly:true,reservation:'RES-9'};
 page.on('pageerror',e=>errors.push(e.message));
 await page.route(url=>url.pathname.startsWith('/api/'),async route=>{
  const req=route.request(),url=new URL(req.url()),path=decodeURIComponent(url.pathname);let body:any={success:true,data:[],total:0,events:[],notifications:[],unreadCount:0};
  if(req.method()==='GET')reads.push(path+url.search);else writes.push({path,body:req.headers()['content-type']?.includes('application/json')?req.postDataJSON():null});
  if(path==='/api/auth/me')body={user:{id:7,name:'Own Employee',roleName:'Admin',isAdmin:true,isEmployee:false,isSuperAdmin:true,isClient:false,tourCompleted:true,effectiveTimezone:'America/Denver'}};
  else if(path==='/api/me/workspace-context')body={homeLocation:options.home??'slc',allowedLocations:options.cohost?['wilmington']:['slc','wilmington'],coHostScoped:!!options.cohost,impersonating:false};
  else if(path==='/api/operations/chart-management/access')body={canManage:!!options.manager};
  else if(path==='/api/operations/chart-management'&&req.method()==='GET')body={entries:[entry],drivers:[{employeeId:41,name:'Own Driver'},{employeeId:42,name:'Second Driver'}],cars:[{carId:101,name:'Own vehicle'}]};
  else if(path.startsWith('/api/operations/chart-management/')&&req.method()==='PUT'){Object.assign(entry,req.postDataJSON());entry.name=entry.employeeId===42?'Second Driver':entry.employeeId?'Own Driver':'No one';entry.exclusion=entry.decision==='exclude'?'Excluded by manager':null;entry.version++;body={key:entry.key,version:entry.version};}
  else if(path==='/api/operations/chart-management'&&req.method()==='POST')body={key:'manual:2',version:1};
  else if(path==='/api/operations/chart-management/receipt:1/receipts')body={files:[{name:'Receipt 1',url:'/api/operations/chart-management/receipt%3A1/receipts/0/file'}]};
  else if(path==='/api/operations/chart-management/receipt:1/receipts/0/file'){await route.fulfill({contentType:'image/png',body:Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+jE1sAAAAASUVORK5CYII=','base64')});return;}
  else if(path.endsWith('/history'))body={history:[{version:1,actor_id:7,created_at:'2026-10-30',after_json:{decision:'exclude',reason:'Special case'}}]};
  else if(path==='/api/me/preferences/day-schedule')body={myTasksFirst:true,employeeId:41};
  else if(path==='/api/operations/day-schedule')body={date:url.searchParams.get('date'),events:[],work_shifts:[]};
  else if(path==='/api/operations/day-schedule/driver-rankings')body={parking:[],gas:[]};
  else if(path==='/api/developer/direct-booking-preview/vehicles')body={vehicles:[{carId:101,name:'Utah preview vehicle',city:'Salt Lake City',state:'UT',photo:null,baseDailyRate:100,isListed:true},{carId:202,name:'Wilmington preview vehicle',city:'Wilmington',state:'NC',photo:null,baseDailyRate:100,isListed:true}]};
  else if(path==='/api/developer/direct-booking-preview/drafts')body={drafts:[]};
  else if(path==='/api/cars')body={success:true,data:[],pagination:{total:0,page:1,limit:10,totalPages:0}};
  else if(path==='/api/internal-calendar/events')body={role:'admin',timezone:'America/Denver',from:'2026-10-01',to:'2026-10-31',complete:true,availabilityComplete:true,warnings:[],cars:[{carId:101,carName:'Utah vehicle',carStatus:'active',plate:'UT1',locationTag:'slc'},{carId:202,carName:'Wilmington vehicle',carStatus:'active',plate:'NC1',locationTag:'wilmington'}],events:[]};
  await route.fulfill({contentType:'application/json',body:JSON.stringify(body)});
 });return{writes,reads,errors};
}
for(const width of[390,1440])test.describe(`${width}px manager review`,()=>{
 test.use({viewport:{width,height:1000}});
 test('manager sees red anomalies, can exclude with no employee, and saves a chart-only review',async({page})=>{
  const state=await fixture(page,{manager:true});await page.goto('/admin/operations?tab=chart-management');
  const row=page.getByRole('article',{name:'Chart entry receipt:1'});await expect(row).toContainText('$40+ parking anomaly');await expect(row).toHaveClass(/border-red-400/);
  await page.screenshot({path:`/workspace/artifacts/chart-management-${width}.png`,fullPage:true,animations:'disabled'});
  await row.getByRole('button',{name:'Edit',exact:true}).click();const dialog=page.getByRole('dialog',{name:'Edit chart entry'});
  await dialog.getByLabel('Chart employee',{exact:true}).selectOption('');
  await expect(dialog.getByLabel('Chart inclusion')).toHaveValue('exclude');
  await dialog.getByLabel('Reason for chart change').fill('Special-case ticket, do not count');await dialog.getByRole('button',{name:'Save chart entry'}).click();
  await expect(dialog).toHaveCount(0);expect(state.writes).toHaveLength(1);expect(state.writes[0]).toMatchObject({path:'/api/operations/chart-management/receipt:1',body:{employeeId:null,decision:'exclude',version:0,amount:50}});
  await expect(row).toContainText('No one');await row.getByRole('button',{name:'History'}).click();await expect(page.getByRole('dialog',{name:'Chart edit history'})).toContainText('Special case');
  expect(state.writes.some(w=>w.path.includes('expense-form'))).toBe(false);expect(state.errors).toEqual([]);
 });
});
test('an admin without Manager cannot see the tab or load review data through a direct URL',async({page})=>{
 const state=await fixture(page);await page.goto('/admin/operations?tab=chart-management');
 await expect(page.getByRole('alert').filter({hasText:'Manager role required'})).toBeVisible();
 await expect(page.getByRole('link',{name:'Chart Management',exact:true})).toHaveCount(0);
 expect(state.reads.some(url=>url.startsWith('/api/operations/chart-management?'))).toBe(false);expect(state.writes).toEqual([]);
});
test('manual chart entries have a request ID and require an explicit employee and review reason',async({page})=>{
 const state=await fixture(page,{manager:true});await page.goto('/admin/operations?tab=chart-management');await page.getByRole('button',{name:'Add chart entry'}).click();
 const dialog=page.getByRole('dialog',{name:'Add chart entry'});await dialog.getByLabel('Chart',{exact:true}).selectOption('gas');await dialog.getByLabel('Chart employee').selectOption('42');await dialog.getByLabel('Chart amount').fill('55');await dialog.getByLabel('Chart inclusion').selectOption('include');await dialog.getByLabel('Reason for chart change').fill('Manual gas reimbursement chart correction');await dialog.getByRole('button',{name:'Save chart entry'}).click();
 await expect(dialog).toHaveCount(0);expect(state.writes[0]).toMatchObject({path:'/api/operations/chart-management',body:{kind:'gas',employeeId:42,amount:55,decision:'include',version:0}});expect(state.writes[0].body.requestId).toMatch(/^[0-9a-f-]{36}$/);expect(state.errors).toEqual([]);
});
test('Wilmington co-host workspace starts at Wilmington and does not offer another city',async({page})=>{
 const state=await fixture(page,{home:'wilmington',cohost:true});await page.goto('/admin/operations?tab=day-schedule');
 await expect(page.getByRole('combobox',{name:'Operations location'})).toHaveText('Wilmington');await page.getByRole('combobox',{name:'Operations location'}).click();await expect(page.getByRole('option',{name:'SLC',exact:true})).toHaveCount(0);await expect(page.getByRole('option',{name:'All locations',exact:true})).toHaveCount(0);expect(state.errors).toEqual([]);
});
test('Utah home defaults cars to UT and the calendar to Utah, while allowing an explicit location change',async({page})=>{
 const state=await fixture(page,{home:'slc'});await page.goto('/cars');await expect.poll(()=>state.reads.some(url=>url.startsWith('/api/cars?')&&url.includes('state=UT'))).toBe(true);
 await page.goto('/admin/trip-calendar?from=2026-10-01&to=2026-10-31');await expect(page.getByLabel('Workspace location')).toHaveValue('slc');await expect(page.getByText('Utah vehicle',{exact:true}).first()).toBeVisible();await expect(page.getByText('Wilmington vehicle',{exact:true})).not.toBeVisible();await page.getByLabel('Workspace location').selectOption('wilmington');await expect(page.getByText('Wilmington vehicle',{exact:true}).first()).toBeVisible();expect(state.errors).toEqual([]);
});

test('direct-booking preview uses the saved home city without changing its isolated preview behavior',async({page})=>{
 const state=await fixture(page,{home:'wilmington'});await page.goto('/admin/developer/direct-bookings');
 await expect(page.getByLabel('Pickup city',{exact:true})).toHaveValue('Wilmington, NC');
 await expect(page.getByText('Wilmington preview vehicle',{exact:true})).toBeVisible();await expect(page.getByText('Utah preview vehicle',{exact:true})).toHaveCount(0);
 await page.getByLabel('Pickup city',{exact:true}).selectOption('');await expect(page.getByText('Utah preview vehicle',{exact:true})).toBeVisible();expect(state.writes).toEqual([]);expect(state.errors).toEqual([]);
});

for(const width of[390,1440])test(`force inclusion reassigns only the chart and preserves form attribution at ${width}px`,async({page})=>{
 await page.setViewportSize({width,height:844});
 const state=await fixture(page,{manager:true});await page.goto('/admin/operations?tab=chart-management');
 const row=page.getByRole('article',{name:'Chart entry receipt:1'});await row.getByRole('button',{name:'Edit',exact:true}).click();
 const dialog=page.getByRole('dialog',{name:'Edit chart entry'});
 await dialog.getByLabel('Chart employee',{exact:true}).selectOption('42');
 await dialog.getByLabel('Airport-return trip reference').fill('');
 await dialog.getByLabel('Chart inclusion').selectOption('force');
 await expect(dialog).toContainText('Form employee: Own Driver (unchanged)');
 await expect(dialog).toContainText('An unverified parking entry counts once as a trip');
 await dialog.getByLabel('Reason for chart change').fill('Reviewed receipt: Second Driver completed airport pickup');
 await dialog.getByRole('button',{name:'Save chart entry'}).click();await expect(dialog).toHaveCount(0);
 expect(state.writes).toHaveLength(1);expect(state.writes[0]).toMatchObject({path:'/api/operations/chart-management/receipt:1',body:{employeeId:42,decision:'force',returnReference:'',amount:50}});
 await expect(row).toContainText('Chart employee: Second Driver');await expect(row).toContainText('Form employee: Own Driver');await expect(row).toContainText('Force included by manager');
 await page.screenshot({path:`/workspace/artifacts/chart-force-${width}.png`,fullPage:true,animations:'disabled'});
 expect(state.errors).toEqual([]);
});

test('receipt review loads the original file in the app from both the entry and its edit dialog',async({page})=>{
 await page.addInitScript(()=>{
  const original=window.fetch.bind(window);(window as any).chartReceiptFetches=[];
  window.fetch=(input,init)=>{if(String(input).includes('/receipts/0/file'))(window as any).chartReceiptFetches.push({credentials:init?.credentials});return original(input,init);};
 });
 const state=await fixture(page,{manager:true});await page.goto('/admin/operations?tab=chart-management');
 const row=page.getByRole('article',{name:'Chart entry receipt:1'});await row.getByRole('button',{name:'View receipts'}).click();
 const viewer=page.getByRole('dialog',{name:'Entry receipts'});await expect(viewer.getByRole('img',{name:'Receipt 1'})).toBeVisible();
 await expect.poll(()=>viewer.getByRole('img',{name:'Receipt 1'}).evaluate((img:HTMLImageElement)=>img.naturalWidth)).toBe(1);
 expect(state.reads.some(url=>url.includes('/receipts/0/file'))).toBe(true);
 expect(await page.evaluate(()=>(window as any).chartReceiptFetches)).toEqual([{credentials:'include'}]);
 await viewer.getByRole('button',{name:'Close receipts'}).click();await row.getByRole('button',{name:'Edit',exact:true}).click();
 const edit=page.getByRole('dialog',{name:'Edit chart entry'});await edit.getByRole('button',{name:'View receipts'}).click();
 await expect(viewer.getByRole('img',{name:'Receipt 1'})).toBeVisible();await viewer.getByRole('button',{name:'Close receipts'}).click();await expect(edit).toBeVisible();
 expect(state.writes).toEqual([]);expect(state.errors).toEqual([]);
});

test('receipt review supports original PDF attachments on a short mobile screen',async({page})=>{
 await page.setViewportSize({width:390,height:667});const state=await fixture(page,{manager:true});
 const pdf=await PDFDocument.create();pdf.addPage().drawText('Airport parking receipt - $50.00');const bytes=Buffer.from(await pdf.save());
 await page.route(url=>decodeURIComponent(url.pathname).endsWith('/chart-management/receipt:1/receipts/0/file'),route=>route.fulfill({contentType:'application/pdf',body:bytes}));
 await page.goto('/admin/operations?tab=chart-management');await page.getByRole('button',{name:'View receipts',exact:true}).click();
 const viewer=page.getByRole('dialog',{name:'Entry receipts'});await expect(viewer.locator('iframe[title="Receipt 1"]')).toBeVisible();await expect(viewer).not.toContainText('Couldn’t load receipt');
 const panel=await viewer.boundingBox();expect(panel!.width).toBeLessThanOrEqual(390);expect(panel!.height).toBeLessThanOrEqual(667*.91);
 await viewer.getByRole('button',{name:'Close receipts'}).click();expect(state.writes).toEqual([]);expect(state.errors).toEqual([]);
});

test('receipt review displays missing-file errors without opening raw storage links',async({page})=>{
 const state=await fixture(page,{manager:true});
 await page.route(url=>decodeURIComponent(url.pathname).endsWith('/chart-management/receipt:1/receipts/0/file'),route=>route.fulfill({status:404,contentType:'application/json',body:JSON.stringify({error:'Original receipt file could not be found.'})}));
 await page.goto('/admin/operations?tab=chart-management');await page.getByRole('button',{name:'View receipts',exact:true}).click();
 const viewer=page.getByRole('dialog',{name:'Entry receipts'});await expect(viewer).toContainText('Original receipt file could not be found.');
 await expect(viewer.locator('a[href*="storage.googleapis.com"]')).toHaveCount(0);expect(state.writes).toEqual([]);expect(state.errors).toEqual([]);
});
