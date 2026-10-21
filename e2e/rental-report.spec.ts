import { expect,test,type Page } from '@playwright/test';

async function fixture(page: Page) {
  const writes: any[]=[];
  const history=Array.from({length:12},(_,i)=>({month:i+1,daysRented:i===0 ? 3 : null,tripsTaken:i===0 ? 1 : null,carsAvailableForRent:77,rentalMetricsWarning:i===0 ? null : 'Reservation 12345 needs a valid return date.'}));
  const data: any={history,formulaSetting:{carManagementSplitPercent:50,carOwnerSplitPercent:50}};
  for (const key of ['incomeExpenses','directDelivery','cogs','parkingFeeLabor','reimbursedBills','officeSupport','parkingAirportQB']) data[key]=Array.from({length:12},(_,i)=>({month:i+1}));
  await page.route(url=>url.pathname.startsWith('/api/'),async route=>{
    const url=new URL(route.request().url());
    let result:any={success:true,data:[],total:0,notifications:[],unreadCount:0};
    if(url.pathname==='/api/auth/me') result={user:{id:7,firstName:'Report',isAdmin:true,isSuperAdmin:true,isEmployee:false,isClient:false,tourCompleted:true}};
    if(url.pathname==='/api/cars/1') result={success:true,data:{id:1,makeModel:'Tesla Model 3',year:2023,plateNumber:'T394ST'}};
    if(/^\/api\/income-expense\/(1|all-cars)\/\d{4}$/.test(url.pathname)) result={success:true,data};
    if(url.pathname==='/api/income-expense/history' && route.request().method()==='POST') {
      const body=route.request().postDataJSON(); writes.push(body);
      const row=history[body.month-1] as any;
      for (const field of ['daysRented','tripsTaken','carsAvailableForRent']) if(body[field]!==undefined) row[field]=body[field];
      result={success:true,data:row};
    }
    await route.fulfill({json:result});
  });
  return {writes};
}
for (const width of [390,1280]) test(`unknown rental quantities stay blank and reviewed zero saves at ${width}`,async({page})=>{
  await page.setViewportSize({width,height:900});const {writes}=await fixture(page);
  await page.goto('/admin/cars/1/income-expense');
  const row=page.locator('tr').filter({has:page.locator('td').first().getByText('Days Rented',{exact:true})}).first();
  await expect(row).toBeVisible();
  await expect(row.locator('td').nth(1)).toHaveText('3');
  await expect(row.locator('td').nth(2)).toHaveText('—');
  await expect(row.locator('td').last()).toHaveText('—');
  await row.locator('td').nth(2).getByText('—',{exact:true}).click();
  const dialog=page.getByRole('dialog');
  await expect(dialog.getByRole('spinbutton')).toHaveValue('');
  await expect(dialog.getByRole('button',{name:'Save',exact:true})).toBeDisabled();
  await dialog.getByRole('spinbutton').fill('0');
  await dialog.getByRole('button',{name:'Save',exact:true}).click();
  await expect.poll(()=>writes.length).toBe(1);
  expect(writes[0]).toMatchObject({carId:1,month:2,daysRented:0});
  await expect(row.locator('td').nth(2)).toHaveText('0');
  await page.reload();
  await expect(row.locator('td').nth(2)).toHaveText('0');
  await expect(page.locator('tr').filter({has:page.locator('td').first().getByText('Cars Available',{exact:true})}).first().locator('td').nth(2)).toHaveText('77');
});
