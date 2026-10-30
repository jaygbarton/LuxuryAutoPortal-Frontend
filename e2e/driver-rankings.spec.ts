import { expect,test,type Page } from '@playwright/test';
async function fixture(page:Page) {
  const reads:string[]=[],writes:any[]=[],errors:string[]=[];
  let roles=['Cleaner'];
  const employee={employee_aid:41,employee_is_active:1,employee_status:'approved',employee_first_name:'Driver',employee_last_name:'One',employee_email:'driver@example.test',employee_job_pay_work_email:'driver@example.test',employee_job_pay_department_name:'Operations',employee_job_pay_job_title_name:'Car Driver'};
  page.on('pageerror',error=>errors.push(error.message));
  await page.route(url=>url.pathname.startsWith('/api/'),async route=>{
    const req=route.request(),url=new URL(req.url()),path=url.pathname;
    let body:any={success:true,data:[],total:0,notifications:[],unreadCount:0};
    if(req.method()==='GET') reads.push(path+url.search); else writes.push({path,body:req.postDataJSON()});
    if(path==='/api/auth/me')body={user:{id:7,name:'Test Admin',isAdmin:true,isEmployee:false,isSuperAdmin:true,isClient:false,effectiveTimezone:'America/Denver',tourCompleted:true}};
    else if(path==='/api/me/preferences/day-schedule')body={myTasksFirst:true,employeeId:41};
    else if(path==='/api/operations/day-schedule')body={date:url.searchParams.get('date'),work_shifts:[],events:[1,2,3,4,5].map(id=>({id,type:'pickup',category:'Pick Up',bookingKey:`turo:${id}`,car_name:`Vehicle ${id}`,plate:`TEST${id}`,assigned_to:null,assigned_to_id:null,start_time:'09:00',status:id===2?'completed':null,completed_day:id===2?'2026-10-02':null,scheduled_day:id<3?'2026-10-01':'2026-10-30',car_photo:null,extras:'Child seat'}))};
    else if(path==='/api/operations/day-schedule/driver-rankings')body={parking:[{employeeId:41,name:'Cheapest Driver',total:12,trips:4,receipts:4,average:3,pending:1,unlinked:1},{employeeId:42,name:'Second Driver',total:20,trips:4,receipts:4,average:5,pending:0,unlinked:0}],gas:[{employeeId:42,name:'Second Driver',total:200,receipts:4,pending:0},{employeeId:41,name:'Cheapest Driver',total:90,receipts:2,pending:1}]};
    else if(path==='/api/employees/41')body={success:true,data:employee};
    else if(path==='/api/employees/41/job-and-pay'&&req.method()==='PATCH'){Object.assign(employee,req.postDataJSON());body={success:true};}
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
    await page.getByRole('button',{name:/^(By Employee|Employees)$/}).click();
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

for(const width of[390,1440])test(`employee departments and job titles support standard, custom and cleared values independently of roles at ${width}px`,async({page})=>{
 await page.setViewportSize({width,height:844});const state=await fixture(page);
 const open=async()=>{await page.getByRole('button',{name:'Job and Pay',exact:true}).click();const info=page.getByText('Job Information',{exact:true}).locator('..').locator('..');await info.getByRole('button',{name:'Update',exact:true}).click();return page.getByRole('dialog',{name:'Update Job Information'});};
 await page.goto('/admin/hr/employees/view?employeeId=41');let dialog=await open();
 await expect(dialog.getByLabel('Department',{exact:true}).locator('option')).toHaveText(['Not set','Operations','Sales & Marketing','Administration','Custom…']);
 await expect(dialog.getByLabel('Job title',{exact:true}).locator('option')).toHaveText(['Not set','Car Driver','Car Cleaner','Mechanic','Custom…']);
 await dialog.getByLabel('Department',{exact:true}).selectOption('Sales & Marketing');await dialog.getByLabel('Job title',{exact:true}).selectOption('Car Cleaner');
 await page.screenshot({path:`/workspace/artifacts/employee-job-classification-${width}.png`,fullPage:true,animations:'disabled'});
 await dialog.getByRole('button',{name:'Save',exact:true}).click();await expect(dialog).toHaveCount(0);
 expect(state.writes[0]).toMatchObject({path:'/api/employees/41/job-and-pay',body:{employee_job_pay_department_name:'Sales & Marketing',employee_job_pay_job_title_name:'Car Cleaner',employee_job_pay_work_email:'driver@example.test'}});
 const roleEditor=page.getByRole('region',{name:'Employee operational roles'});await expect(roleEditor.getByRole('checkbox',{name:'Cleaner',exact:true})).toBeChecked();await expect(roleEditor.getByRole('checkbox',{name:'Car Driver',exact:true})).not.toBeChecked();
 dialog=await open();await dialog.getByLabel('Department',{exact:true}).selectOption('__custom__');await dialog.getByLabel('Custom department',{exact:true}).fill('Customer Experience');
 await dialog.getByLabel('Job title',{exact:true}).selectOption('__custom__');await dialog.getByLabel('Custom job title',{exact:true}).fill('Vehicle Detail Lead');await dialog.getByRole('button',{name:'Save',exact:true}).click();await expect(dialog).toHaveCount(0);
 expect(state.writes[1]).toMatchObject({body:{employee_job_pay_department_name:'Customer Experience',employee_job_pay_job_title_name:'Vehicle Detail Lead'}});
 await page.reload();dialog=await open();await expect(dialog.getByLabel('Custom department',{exact:true})).toHaveValue('Customer Experience');await expect(dialog.getByLabel('Custom job title',{exact:true})).toHaveValue('Vehicle Detail Lead');
 const bounds=await dialog.boundingBox();expect(bounds!.width).toBeLessThanOrEqual(width);expect(bounds!.height).toBeLessThanOrEqual(844*.91);
 await dialog.getByLabel('Department',{exact:true}).selectOption('');await dialog.getByLabel('Job title',{exact:true}).selectOption('');await dialog.getByRole('button',{name:'Save',exact:true}).click();await expect(dialog).toHaveCount(0);
 expect(state.writes[2]).toMatchObject({body:{employee_job_pay_department_name:null,employee_job_pay_job_title_name:null}});
 expect(state.writes).toHaveLength(3);expect(state.writes.some(w=>w.path.endsWith('/operational-roles'))).toBe(false);expect(state.errors).toEqual([]);
});

test('Add Employee offers the same department and job-title choices without submitting a new employee',async({page})=>{
 const state=await fixture(page);await page.goto('/admin/hr/employees');await page.getByRole('button',{name:'Add',exact:true}).click();
 const dialog=page.getByRole('dialog',{name:'Add New Employee'});
 await dialog.getByLabel('Department',{exact:true}).selectOption('Administration');await dialog.getByLabel('Job title',{exact:true}).selectOption('Mechanic');
 await expect(dialog.getByLabel('Job title',{exact:true}).locator('option')).toHaveText(['Not set','Car Driver','Car Cleaner','Mechanic','Custom…']);
 await dialog.getByLabel('Department',{exact:true}).selectOption('__custom__');await dialog.getByLabel('Custom department',{exact:true}).fill('Service Team');
 await dialog.getByRole('button',{name:'Cancel',exact:true}).click();expect(state.writes).toEqual([]);expect(state.errors).toEqual([]);
});

test('staff self-service uses the same choices without exposing employee-role or pay editing',async({page})=>{
 await page.setViewportSize({width:390,height:844});const state=await fixture(page);
 const employee={employee_aid:41,employee_number:'E041',employee_first_name:'Staff',employee_last_name:'Worker',employee_email:'staff@example.test',employee_job_pay_department_name:'Existing Department',employee_job_pay_job_title_name:'Existing Title'};
 await page.route(url=>['/api/auth/me','/api/me/employee','/api/me/employee/job-pay'].includes(url.pathname),async route=>{
  const path=new URL(route.request().url()).pathname;
  if(path==='/api/auth/me')return route.fulfill({contentType:'application/json',body:JSON.stringify({user:{id:7,name:'Staff Worker',roleName:'Employee',isAdmin:false,isEmployee:true,isClient:false,tourCompleted:true,effectiveTimezone:'America/Denver'}})});
  if(route.request().method()==='PATCH'){const body=route.request().postDataJSON();state.writes.push({path,body});Object.assign(employee,body);}
  return route.fulfill({contentType:'application/json',body:JSON.stringify({success:true,data:employee})});
 });
 await page.goto('/staff/my-info/job-and-pay');await page.getByRole('button',{name:'Edit',exact:true}).click();
 await expect(page.getByLabel('Custom department',{exact:true})).toHaveValue('Existing Department');await expect(page.getByLabel('Custom job title',{exact:true})).toHaveValue('Existing Title');
 await page.getByLabel('Department',{exact:true}).selectOption('Operations');await page.getByLabel('Job title',{exact:true}).selectOption('Car Driver');
 await page.getByRole('button',{name:'Save',exact:true}).click();await expect(page.getByRole('button',{name:'Edit',exact:true})).toBeVisible();
 expect(state.writes).toHaveLength(1);expect(state.writes[0]).toMatchObject({path:'/api/me/employee/job-pay',body:{employee_job_pay_department_name:'Operations',employee_job_pay_job_title_name:'Car Driver'}});
 expect(state.writes[0].body).not.toHaveProperty('roles');expect(state.writes[0].body).not.toHaveProperty('employee_job_pay_salary_rate');expect(state.writes[0].body).not.toHaveProperty('employee_job_pay_work_email');
 await expect(page.getByRole('region',{name:'Employee operational roles'})).toHaveCount(0);expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);expect(state.errors).toEqual([]);
});
