const { chromium } = require('@playwright/test');
const fs = require('node:fs');
const path = require('node:path');
const output = path.resolve(__dirname, '../test-results/legacy');
fs.mkdirSync(output, {recursive:true});
const preview = process.env.LEGACY_PREVIEW_URL || 'http://127.0.0.1:5201';
const assert = require('node:assert/strict');
(async () => {
 const browser = await chromium.launch({executablePath:process.env.CHROMIUM_PATH || '/usr/bin/chromium',headless:true,args:['--no-sandbox']});
 const checks = [];
 for (const [role,path] of [
  ['admin','/admin/clients'],['admin','/admin/cars'],['admin','/admin/forms'],
  ['admin','/admin/employees'],['admin','/admin/payrun'],['admin','/admin/payments'],
  ['admin','/admin/income-and-expenses'],['admin','/admin/car-maintenance'],
  ['admin','/admin/car-rental/trips'],['client','/client/record-and-files'],
  ['admin','/portal/admin/car?year=2024'],['admin','/admin/client/view-info/earnings?clientId=42'],
  ['admin','/admin/client/view-info/records-files?clientId=42'],
 ]) {
  const context=await browser.newContext({viewport:{width:1440,height:1000}});
  await context.addInitScript(()=>localStorage.setItem('glatoken',JSON.stringify({token:'local-fixture-only'})));
  const page=await context.newPage(); const errors=[]; const calls=[];
  page.on('pageerror',e=>errors.push(e.message));
  await page.route('**/*',async route=>{
   const url=new URL(route.request().url());
   if(url.origin!==new URL(preview).origin)return route.abort();
   if(url.pathname.includes('/rest/')){
    calls.push(url.pathname);
    const user={role,role_name:role,role_is_developer:0,role_is_admin:role==='admin'?1:0,role_is_client:role==='client'?1:0,role_is_employee:0,user_key:'fixture',user_other_password:'fixture',user_other_aid:999,user_other_fname:'Preview',user_other_lname:'User',user_other_email:'preview@example.invalid',user_other_client_id:42,user_other_show_policy:0,system_maintenance:false};
    let body=url.pathname.endsWith('/user-other/token')?{success:true,count:1,data:user,year:2026,date_now:'2026-10-07'}:{success:true,count:0,data:[],total:0,page:0,per_page:50,date_now:'2026-10-07',year:2026};
    if(url.pathname.includes('/client/records-files/page/'))body={...body,count:1,total:1,page:1,data:[{record_files_aid:42,record_files_gdrive:'fixture-folder',record_files_is_active:1,record_files_doc_name:'Historical receipts folder',record_files_date:'2024-05-15',record_files_remarks:'Test fixture'}]};
    if(url.pathname.includes('/client/view-record-files/page/'))body={...body,count:1,total:1,page:1,data:[{records_file_view_aid:43,records_file_view_name:'May 2024 receipt.pdf',records_file_view_remarks:'Historical receipt fixture',records_file_view_google_id:'fixture-file'}]};
    return route.fulfill({json:body});
   }
   if(url.pathname.includes('/img/'))return route.fulfill({status:404,body:''});
   return route.continue();
  });
  await page.goto(preview+path);
  await page.waitForTimeout(700);
  if(path==='/client/record-and-files'){
   await page.getByText('Historical receipts folder',{exact:true}).click();
   await page.getByText('May 2024 receipt.pdf',{exact:true}).waitFor();
   assert(page.url().includes('recordId=42&folderId=fixture-folder'));
   const requestPromise=context.waitForEvent('request',request=>request.url()==='https://drive.google.com/file/d/fixture-file');
   const popupPromise=page.waitForEvent('popup');
   await page.getByText('May 2024 receipt.pdf',{exact:true}).click();
   const popup=await popupPromise;
   assert.equal((await requestPromise).url(),'https://drive.google.com/file/d/fixture-file');
   await popup.close();
  }
  const text=await page.locator('body').innerText();
  const result={path,url:page.url(),errors,body:text.slice(0,700),api:calls}; checks.push(result);
  console.log(JSON.stringify(result));
  if(['/admin/forms','/admin/employees','/client/record-and-files'].includes(path))await page.screenshot({path:output+'/legacy-restored-'+path.split('/').pop()+'.png',fullPage:true});
  await context.close();
 }
 fs.writeFileSync(output+'/browser-results.json',JSON.stringify(checks,null,2));
 await browser.close();
 assert(checks.every(x=>x.errors.length===0),'Browser errors need review');
 assert(checks.every(x=>x.body.includes('Preview')&&!x.body.includes('Page not found')),'Every selected page must render its authenticated shell');
})();
