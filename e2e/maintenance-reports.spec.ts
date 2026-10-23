import { expect, test } from '@playwright/test';
for (const width of [390,1280]) test(`one reservation card preserves all nine reports and their individual controls at ${width}px`, async ({page}) => {
  await page.setViewportSize({width,height:900});
  const base = {id:1,car_id:7,car_name:'Toyota Sienna',car_make:'Toyota',car_model:'Sienna',car_year:2020,car_plate:'ABC123',trip_reservation_id:'53923977',reservation_id:'53923977',trip_id:null,inspection_id:123,status:'new',assigned_to:'Andy Zhang',assigned_to_id:41,photos:[],notes:null,service_type:'other',task_description:'Car issue: Battery',created_at:'2026-10-20T12:00:00Z',reported_at:'2026-10-20T12:00:00Z'};
  const reports = Array.from({length:9},(_,i)=>({...base,id:i+1,task_description:`Reported issue ${i+1}`,notes:`Original note ${i+1}`,photos:[`https://storage.googleapis.com/luxury-auto-portal-files/task-photos/report-${i+1}.jpg`]}));
  const writes:{path:string;body:any}[]=[];
  const errors:string[]=[]; page.on('pageerror',e=>errors.push(e.message));
  await page.route(url=>url.pathname.startsWith('/api/'), async route=>{
    const path=new URL(route.request().url()).pathname;
    if(route.request().method()==='PUT') writes.push({path,body:route.request().postDataJSON()});
    let result:any={success:true,data:[],total:0,notifications:[],unreadCount:0,appointments:[]};
    if(path==='/api/auth/me') result={user:{id:41,fullname:'Andy Zhang',name:'Andy Zhang',email:'admin@example.test',roleName:'Admin',isAdmin:true,isEmployee:false,isClient:false,isSuperAdmin:true,tourCompleted:true,effectiveTimezone:'America/Denver'}};
    if(path==='/api/operations/maintenance') result={success:true,total:1,data:[{...base,report_count:9,report_trip_count:1,reported_issues:reports.map(r=>r.task_description),report_ids:reports.map(r=>r.id),reported_reservations:['53923977']}]};
    if(path==='/api/service-workspace/maintenance/1/reports') result={reports,tripCount:1};
    if(path==='/api/cars/7') result={success:true,data:{id:7,makeModel:'Toyota Sienna',year:2020,plateNumber:'ABC123'}};
    if(path==='/api/cars') result={success:true,data:[{id:7,makeModel:'Toyota Sienna',year:2020,plateNumber:'ABC123'}]};
    await route.fulfill({json:result});
  });
  await page.goto('/admin/operations?tab=maintenance');
  const card=page.getByRole('article',{name:/Maintenance for/});
  await expect(card).toHaveCount(1,{timeout:20000});
  await expect(card).toContainText('9 reports · 1 trips');
  await expect(card).toContainText('Reservation # 53923977');
  await card.getByRole('button',{name:'View details',exact:true}).click();
  await card.getByRole('button',{name:/Reported issues and trips/}).click();
  const region=page.getByRole('region',{name:'Reports of this maintenance issue'});
  await expect(region.locator('article')).toHaveCount(9);
  for(let i=1;i<=9;i++) {
    await expect(region.getByText(`Original note ${i}`,{exact:true})).toBeVisible();
    await expect(region.getByRole('button',{name:`Edit report #${i}`,exact:true})).toBeVisible();
  }
  await expect(region.getByRole('link',{name:'Report file 1'})).toHaveCount(9);
  await region.getByRole('button',{name:'Edit report #9',exact:true}).click();
  await expect(page.getByRole('dialog').getByPlaceholder('What maintenance is needed...')).toHaveValue('Reported issue 9');
  expect(await page.evaluate(()=>document.documentElement.scrollWidth <= window.innerWidth+1)).toBe(true);
  await page.getByRole('dialog').getByRole('button',{name:'Update',exact:true}).click();
  await expect.poll(()=>writes).toContainEqual({path:'/api/operations/maintenance/9',body:expect.objectContaining({car_id:7,task_description:'Reported issue 9'})});
  await expect(page.getByRole('dialog')).toHaveCount(0);
  await page.goto('/admin/cars/7/maintenance');
  await expect(page.getByRole('heading',{name:'Car Maintenance',exact:true})).toBeVisible();
  await expect(page.getByText('Total: 1',{exact:true})).toBeVisible();
  await page.getByRole('button',{name:/Reported issues and trips/}).click();
  await expect(page.getByRole('region',{name:'Reports of this maintenance issue'}).locator('article')).toHaveCount(9);
  expect(errors).toEqual([]);
});

for (const width of [390,1280]) test(`moving a report opens its older reservation card with the new trip visible at ${width}px`, async ({page}) => {
  await page.setViewportSize({width,height:900});
  let moved=false;
  const base={id:1,car_id:7,car_name:'Toyota Sienna',car_make:'Toyota',car_model:'Sienna',car_year:2020,car_plate:'ABC123',inspection_id:10,status:'new',photos:[],service_type:'other',task_description:'Car issue: Battery',trip_reservation_id:'older-trip'};
  const original={...base,id:99,inspection_id:20,reservation_id:'62113257',task_description:'Car issue: Battery',notes:'New report from the returning trip',trip_id:30};
  const card={...base,report_count:2,report_ids:[1,99],report_inspection_ids:[10,20],report_trip_count:2,reported_issues:['Car issue: Battery'],reported_reservations:['older-trip','62113257'],report_statuses:['new']};
  const requests:string[]=[];
  await page.route(url=>url.pathname.startsWith('/api/'),async route=>{
    const url=new URL(route.request().url()), path=url.pathname;requests.push(path+url.search);
    let json:any={success:true,data:[],total:0,appointments:[],notifications:[],unreadCount:0};
    if(path==='/api/auth/me')json={user:{id:41,fullname:'Andy Zhang',roleName:'Admin',isAdmin:true,isSuperAdmin:true,tourCompleted:true,effectiveTimezone:'America/Denver'}};
    if(path==='/api/operations/inspections')json={success:true,total:moved?0:1,data:moved?[]:[{id:20,turo_trip_id:30,car_name:'Toyota Sienna',reservation_id:'62113257',status:'new',source:'manual',car_issue_types:['Battery'],photos:[]}]};
    if(path.endsWith('/move-to-maintenance')){moved=true;json={success:true,data:[original]};}
    if(path==='/api/operations/maintenance')json={success:true,total:1,data:[moved?card:base]};
    if(path==='/api/service-workspace/maintenance/1/reports')json={reports:[base,original],tripCount:2};
    if(path==='/api/cars')json={success:true,data:[{id:7,makeModel:'Toyota Sienna',year:2020,plateNumber:'ABC123'}]};
    await route.fulfill({json});
  });
  await page.goto('/admin/operations?tab=inspections');
  await page.getByTitle('Move to Maintenance',{exact:true}).click();
  const link=page.getByRole('link',{name:'View in Maintenance',exact:true});
  await expect(link).toHaveAttribute('href','/admin/operations?tab=maintenance&report=99');
  await link.click();
  const article=page.getByRole('article',{name:/Maintenance for/});
  await expect(article).toHaveCount(1);
  await expect(article).toContainText('62113257');
  await expect(page.getByRole('region',{name:'Reports of this maintenance issue'})).toContainText('New report from the returning trip');
  expect(requests.some(url=>url.includes('/api/operations/maintenance?reportId=99'))).toBe(true);
  expect(await page.evaluate(()=>document.documentElement.scrollWidth<=window.innerWidth+1)).toBe(true);
  await page.reload();
  await expect(page.getByRole('region',{name:'Reports of this maintenance issue'})).toContainText('New report from the returning trip');
});
