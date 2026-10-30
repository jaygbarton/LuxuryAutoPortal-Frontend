import { expect,test,type Page } from '@playwright/test';
async function fixture(page:Page) {
  const reads:string[]=[],writes:any[]=[],errors:string[]=[];
  let roles=['Cleaner'];
  page.on('pageerror',error=>errors.push(error.message));
  await page.route(url=>url.pathname.startsWith('/api/'),async route=>{
    const req=route.request(),url=new URL(req.url()),path=url.pathname;
    let body:any={success:true,data:[],total:0,notifications:[],unreadCount:0};
    if(req.method()==='GET') reads.push(path+url.search); else writes.push({path,body:req.postDataJSON()});
    if(path==='/api/auth/me')body={user:{id:7,name:'Test Admin',isAdmin:true,isEmployee:false,isSuperAdmin:true,isClient:false,effectiveTimezone:'America/Denver',tourCompleted:true}};
    else if(path==='/api/me/preferences/day-schedule')body={myTasksFirst:true,employeeId:41};
    else if(path==='/api/operations/day-schedule')body={date:url.searchParams.get('date'),work_shifts:[],events:[1,2,3,4,5].map(id=>({id,type:'pickup',category:'Pick Up',bookingKey:`turo:${id}`,car_name:`Vehicle ${id}`,plate:`TEST${id}`,assigned_to:null,assigned_to_id:null,start_time:'09:00',status:id===2?'completed':null,completed_day:id===2?'2026-10-02':null,scheduled_day:id<3?'2026-10-01':'2026-10-30',car_photo:null,extras:'Child seat'}))};
    else if(path==='/api/operations/day-schedule/driver-rankings')body={parking:[{employeeId:41,name:'Cheapest Driver',total:12,trips:4,receipts:4,average:3,pending:1,unlinked:1},{employeeId:42,name:'Second Driver',total:20,trips:4,receipts:4,average:5,pending:0,unlinked:0}],gas:[{employeeId:42,name:'Second Driver',total:200,receipts:4,pending:0},{employeeId:41,name:'Cheapest Driver',total:90,receipts:2,pending:1}]};
    else if(path==='/api/employees/41')body={success:true,data:{employee_aid:41,employee_is_active:1,employee_status:'approved',employee_first_name:'Driver',employee_last_name:'One',employee_email:'driver@example.test'}};
    else if(path==='/api/employees/41/operational-roles'){
      if(req.method()==='PUT')roles=req.postDataJSON().roles;
      body={roles,options:['Car Driver','Cleaner','Office']};
    }
    await route.fulfill({contentType:'application/json',body:JSON.stringify(body)});
  });
  return {reads,writes,errors};
}
for(const width of [390,1440])test.describe(`${width}px monthly charts`,()=>{
  test.use({viewport:{width,height:1000}});
  test('defaults to current month, expands unassigned, places carryover after source and loads both employee rankings',async({page})=>{
    const state=await fixture(page);
    await page.goto('/admin/operations?tab=day-schedule&date=2026-10-30');
    const unassigned=page.getByRole('region',{name:'Unassigned tasks'});
    await expect(unassigned.getByRole('button',{name:'Collapse',exact:true})).toHaveAttribute('aria-expanded','true');
    await expect(unassigned.getByLabel('Search unassigned tasks')).toBeVisible();
    await expect(unassigned.locator('[data-day-schedule-card]')).toHaveCount(5);
    const old=unassigned.locator('[data-booking-key="turo:1"]');
    await expect(old.locator('[data-task-carryover]')).toHaveText('Carried over');
    expect(await old.evaluate(element=>element.innerHTML.indexOf('data-booking-source')<element.innerHTML.indexOf('data-task-carryover'))).toBe(true);
    await expect(unassigned.locator('[data-booking-key="turo:2"] [data-task-carryover]')).toHaveCount(0);
    await expect(unassigned.locator('[data-booking-key="turo:3"] [data-task-carryover]')).toHaveCount(0);
    // Use the input's actual current month, with a calendar comparison independent of locale order.
    const today=new Intl.DateTimeFormat('en-CA',{timeZone:'America/Denver',year:'numeric',month:'2-digit',day:'2-digit'}).format(new Date()).slice(0,7);
    await expect(page.getByLabel('Month',{exact:true})).toHaveValue(today);
    const parking=page.getByRole('region',{name:'Airport parking average',exact:true});
    await expect(parking.locator('[data-ranked-employee]').first()).toContainText('Cheapest Driver');
    await expect(parking).toContainText('$3.00');
    await expect(parking).toContainText('$12.00 ÷ 4 trips');
    const gas=page.getByRole('region',{name:'Gas reimbursed',exact:true});
    await expect(gas.locator('[data-ranked-employee]').first()).toContainText('Second Driver');
    await expect(gas).toContainText('$200.00');
    await page.getByLabel('Month',{exact:true}).fill('2024-02');
    await expect.poll(()=>state.reads.some(url=>url.includes('from=2024-02-01')&&url.includes('to=2024-02-29'))).toBe(true);
    expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
    await page.screenshot({path:`/workspace/artifacts/day-schedule-driver-charts-${width}.png`,fullPage:true,animations:'disabled'});
    expect(state.errors).toEqual([]);
  });
});
test('employee profile saves multiple operational roles without modifying account or job data',async({page})=>{
  const state=await fixture(page);
  await page.goto('/admin/hr/employees/view?employeeId=41');
  await page.getByRole('button',{name:'Job and Pay',exact:true}).click();
  const editor=page.getByRole('region',{name:'Employee operational roles'});
  await expect(editor.getByRole('checkbox',{name:'Cleaner',exact:true})).toBeChecked();
  await editor.getByRole('checkbox',{name:'Car Driver',exact:true}).check();
  await editor.getByRole('button',{name:'Save roles',exact:true}).click();
  await expect.poll(()=>state.writes.length).toBe(1);
  expect(state.writes[0]).toEqual({path:'/api/employees/41/operational-roles',body:{roles:['Cleaner','Car Driver']}});
  await page.reload();await page.getByRole('button',{name:'Job and Pay',exact:true}).click();
  await expect(editor.getByRole('checkbox',{name:'Car Driver',exact:true})).toBeChecked();
  await expect(editor.getByRole('checkbox',{name:'Cleaner',exact:true})).toBeChecked();
  expect(state.errors).toEqual([]);
});
