import {test,expect,type Page} from '@playwright/test';
type Role='Admin'|'CoHost'|'Employee'|'Client';
async function fixture(page:Page,role:Role='Admin',view?:'Client'|'CoHost'|'Employee') {
 const errors:string[]=[],requests:string[]=[];page.on('pageerror',error=>errors.push(error.message));
 await page.route(url=>url.pathname.startsWith('/api/'),async route=>{
  const path=new URL(route.request().url()).pathname;requests.push(path);
  let result:any={success:true,data:[],total:0,notifications:[],unreadCount:0};
  if(path==='/api/auth/me')result={user:{id:7,firstName:'Test',lastName:'Worker',roleName:role,isAdmin:role==='Admin'||role==='CoHost',isEmployee:role==='Employee',isClient:role==='Client',isCoHost:role==='CoHost',isSuperAdmin:role==='Admin',effectiveTimezone:'America/Denver',tourCompleted:true,...(view?{[`viewAs${view==='CoHost'?'CoHost':view}`]:view==='Employee'?{employeeId:41}:view==='Client'?{clientId:12}:{coHostId:12}}:{})}};
  if(path==='/api/operations/chart-management/access')result={canManage:role==='Admin'&&!view};
  if(path==='/api/me/contractor-policy')result={data:{hasEmployee:true,agreed:true,mustSign:false,agreement:null,policy:{version:1}}};
  if(path==='/api/me/preferences/day-schedule')result={myTasksFirst:true,employeeId:41};
  if(path==='/api/operations/day-schedule')result={date:'2026-11-11',events:[],work_shifts:[]};
  if(path==='/api/cars')result={success:true,data:[],cars:[],pagination:{total:0,page:1,totalPages:1,limit:20}};
  await route.fulfill({json:result});
 });
 return {errors,requests};
}
async function menu(page:Page,width:number) {
 if(width<1024){await page.getByRole('button',{name:'More navigation',exact:true}).click();return page.getByRole('dialog',{name:'Workspace navigation'});}
 return page.getByRole('complementary',{name:'Workspace navigation'});
}
for(const width of [390,1280])test(`organized admin sidebar preserves nested links and operation order at ${width}px`,async({page})=>{
 await page.setViewportSize({width,height:900});const state=await fixture(page);
 await page.goto('/admin/operations?tab=day-schedule&date=2026-11-11');const nav=await menu(page,width);
 await expect(nav).toBeVisible();
 await expect(nav.locator('[data-nav-group="Operations"] > div > a').first()).toHaveText('Day Schedule');
 const ops=nav.locator('[data-nav-group="Operations"]');
 expect(await ops.locator(':scope > div > a').evaluateAll(nodes=>nodes.slice(0,5).map(node=>node.textContent))).toEqual(['Day Schedule','Car Block Off','Maintenance','Service Due','Turo Trips']);
 await expect(nav.getByRole('link',{name:'Car Block Off',exact:true})).toHaveCount(1);
 await expect(nav.getByRole('link',{name:'Rental Listings',exact:true})).toHaveCount(0);
 await nav.getByRole('button',{name:'Accounts',exact:true}).click();
 const accounts=nav.locator('[data-nav-group="Accounts"]');
 await expect(accounts.getByRole('link',{name:'Admins',exact:true})).toHaveAttribute('href','/admin/admins');
 await expect(accounts.getByRole('link',{name:'Applicants',exact:true})).toHaveAttribute('href','/admin/applicants');
 await accounts.getByRole('button',{name:'Co-Hosts',exact:true}).click();
 await expect(accounts.getByRole('link',{name:'My Co-Host Cars',exact:true})).toHaveAttribute('href','/admin/my-co-host-cars');
 await nav.getByRole('button',{name:'Cars',exact:true}).click();const cars=nav.locator('[data-nav-group="Cars"]');
 await expect(cars.getByRole('link',{name:'Car Rental',exact:true})).toHaveAttribute('target','_blank');
 await cars.getByRole('button',{name:'BOUNCIE',exact:true}).click();
 await expect(cars.getByRole('link',{name:'Devices',exact:true})).toHaveAttribute('href','/admin/bouncie-devices');
 await nav.getByRole('button',{name:'System',exact:true}).click();
 await expect(nav.locator('[data-nav-group="System"]').getByRole('link')).toHaveText(['Turo Guide','System Tutorial','Client Testimonials','News & Media','Notice Board','AI Hub']);
 expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
 await nav.screenshot({path:test.info().outputPath(`sidebar-${width}.png`)});
 await ops.getByRole('link',{name:'Maintenance',exact:true}).click();await expect(page).toHaveURL(/tab=maintenance/);
 if(width<1024)await page.getByRole('button',{name:'More navigation',exact:true}).click();
 await expect(page.locator('[data-testid="link-admin-maintenance"][aria-current="page"]')).toBeVisible();
 expect(state.errors).toEqual([]);
});

test('nested deep links expand Accounts and Co-Hosts automatically',async({page})=>{
 await page.setViewportSize({width:1280,height:900});await fixture(page);
 await page.goto('/admin/my-co-host-cars');const nav=page.getByRole('complementary',{name:'Workspace navigation'});
 await expect(nav.getByRole('button',{name:'Accounts',exact:true})).toHaveAttribute('aria-expanded','true');
 await expect(nav.getByRole('button',{name:'Co-Hosts',exact:true})).toHaveAttribute('aria-expanded','true');
 await expect(nav.getByRole('link',{name:'My Co-Host Cars',exact:true})).toHaveAttribute('aria-current','page');
 await nav.getByRole('button',{name:'Accounts',exact:true}).click();await expect(nav.getByRole('button',{name:'Accounts',exact:true})).toHaveAttribute('aria-expanded','false');
});

for(const [role,view] of [['CoHost',undefined],['Employee',undefined],['Client',undefined],['Admin','Client'],['Admin','CoHost'],['Admin','Employee']] as const)test(`sidebar grouping preserves ${role} ${view??'own'} access`,async({page})=>{
 await page.setViewportSize({width:1280,height:900});await fixture(page,role,view);
 const client=role==='Client'||view==='Client';
 await page.goto(client?'/admin/forms?section=referral-forms':'/admin/operations?tab=day-schedule');
 const nav=page.getByRole('complementary',{name:'Workspace navigation'});await expect(nav).toBeVisible();
 await expect(nav.getByRole('link',{name:'Rental Listings',exact:true})).toHaveCount(0);
 if(!client) {
  const ops=nav.locator('[data-nav-group="Operations"]');
  expect(await ops.locator(':scope > div > a').evaluateAll(nodes=>nodes.slice(0,4).map(node=>node.textContent))).toEqual(['Day Schedule','Car Block Off','Maintenance','Service Due']);
 } else await expect(nav.getByRole('button',{name:'Operations',exact:true})).toHaveCount(0);
 await nav.getByRole('button',{name:'System',exact:true}).click();
 await expect(nav.getByRole('link',{name:'System Tutorial',exact:true})).toHaveAttribute('href',client?'/tutorial':role==='CoHost'||view==='CoHost'?'/cohost/training-manual':'/staff/training-manual');
 await expect(nav.getByRole('link',{name:'Developer',exact:true})).toHaveCount(0);
 if(client||role==='Employee'||view==='Employee')await expect(nav.getByRole('button',{name:'Accounts',exact:true})).toHaveCount(0);
 if(client)await expect(nav.getByRole('link',{name:'AI Hub',exact:true})).toHaveCount(0);
});

test('retired Rental Listings bookmark redirects to Cars without loading the old API',async({page})=>{
 const state=await fixture(page);await page.goto('/admin/rental-listings');
 await expect(page).toHaveURL(/\/cars$/);expect(state.requests.filter(path=>path.startsWith('/api/rental-listings'))).toEqual([]);
});
