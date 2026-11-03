import {expect,test,type Page} from '@playwright/test';
const values:Record<string,string>={date:'2026-11-02',firstNameOwner:'Test',lastNameOwner:'Owner',phoneOwner:'8010000000',emailOwner:'owner@example.test',streetAddress:'50 Test Street',city:'Salt Lake City',state:'UT',zipCode:'84116',birthday:'1990-01-01',emergencyContactName:'Test Contact',emergencyContactPhone:'8010000001',vehicleYear:'2020',vehicleMake:'Honda',vehicleModel:'Accord',vehicleTrim:'Sport',vehicleMiles:'55000',exteriorColor:'White',interiorColor:'Black',vinNumber:'1HGCM82633A004352',licensePlate:'TEST123',registrationExpiration:'2027-03-01',numberOfSeats:'5',numberOfDoors:'4',lastOilChange:'2026-10-01',oilType:'0W-20',oilPackageDetails:'Test package',tireSize:'225/45R17',insuranceProvider:'Fixture insurance',insurancePhone:'8010000002',policyNumber:'FIXTURE',insuranceExpiration:'2027-04-01',purchasePrice:'20000',interestRate:'4',monthlyPayment:'300',downPayment:'2000',ultimateGoal:'Help cover costs',bankName:'Fixture bank',routingNumber:'123456789',accountNumber:'987654321',ssn:'000001234',ein:'001234567',businessName:'Test',carManufacturerWebsite:'https://example.test',carManufacturerUsername:'test-owner',password:'fixture-password'};
async function fixture(page:Page,admin:boolean|'client'=false){
 const writes:any[]=[];
 const submission:any={id:7,...values,status:'pending',contractStatus:'sent',createdAt:'2026-11-02T12:00:00Z',vehicleFeatures:['Bluetooth'],reviewVersion:'a'.repeat(64),routingNumber:'•••6789',accountNumber:'•••4321',ssn:'•••1234',password:'••••••••'};
 const workflow:any={version:submission.reviewVersion,carId:null,clientId:null,history:[]};
 await page.route('**/*',async route=>{
  const url=new URL(route.request().url());
  if(!['127.0.0.1','localhost'].includes(url.hostname))return route.abort();
  if(!url.pathname.startsWith('/api/'))return route.continue();
  const path=url.pathname;let data:any={success:true,data:[],notifications:[],unreadCount:0,total:0};
  if(path==='/api/auth/me')data={user:admin?{id:1,firstName:'Test',lastName:'Admin',isAdmin:admin===true,isSuperAdmin:admin===true,isClient:admin==='client',isEmployee:false,tourCompleted:true}:null};
  if(path==='/api/public-page-status')data={isPublic:true,canPreview:false};
  if(path==='/api/settings/sales-reps')data.data=['Fixture Rep'];
  if(path==='/api/admin/form-visibility')data={isAdmin:admin===true,isClient:admin!==true,isEmployee:false,formVisibility:{'Car On-boarding':{isVisible:true},'Client Onboarding Form LYC':{isVisible:true}}};
  if(path==='/api/onboarding/submissions')data={success:true,data:[submission],pagination:{page:1,total:1,totalPages:1,limit:10}};
  if(path==='/api/onboarding/submissions/7')data={success:true,data:submission};
  if(path.endsWith('/7/review'))data={success:true,data:workflow};
  if(route.request().method()!=='GET'){
   const body=route.request().headers()['content-type']?.includes('multipart/form-data') ? {multipart:route.request().postData()} : route.request().postDataJSON();writes.push({path,body});
   if(path.endsWith('/7/review'))Object.assign(submission,body.changes);
   if(path.endsWith('/7/approve')){submission.status='approved';workflow.clientId=12;data={success:true,data:submission};}
   if(path.endsWith('/7/status'))submission.status=body.status;
   if(path.endsWith('/7/create-vehicle')){workflow.carId=88;data={success:true,data:{carId:88},message:'Vehicle record created. It has not been activated for rental.'};}
   if(path==='/api/onboarding/submit')data={success:true,data:{id:7}};
  }
  return route.fulfill({contentType:'application/json',body:JSON.stringify(data)});
 });
 return {writes,submission,workflow};
}
async function fillStep(page:Page){
 for(const input of await page.locator('form input[name]:visible, form textarea[name]:visible').all()){
  const name=await input.getAttribute('name');if(name && values[name] && await input.isEnabled())await input.fill(values[name]);
 }
 for(const select of await page.locator('form').getByRole('combobox').all()){
  await select.click();await page.getByRole('option').first().click();
 }
 const oil=page.locator('input[name=oilPackageDetails]');if(await oil.count() && await oil.isEnabled())await oil.fill('Fixture prepaid oil plan');
}
for(const width of [390,1280]) test(`customer onboarding step validation, back navigation and final submission at ${width}px`,async({page})=>{
 await page.setViewportSize({width,height:844});const {writes}=await fixture(page);
 await page.goto('/onboarding');
 const form=page.locator('form');
 await expect(form.getByText('Drivers License Upload',{exact:true})).toBeVisible();
 await expect(form.getByLabel('Vehicle Year *',{exact:true})).toHaveCount(0);
 await form.getByRole('button',{name:'Continue',exact:true}).click();
 await expect(form.getByRole('alert')).toHaveText(/highlighted fields/);expect(writes).toHaveLength(0);
 if(width===390)await form.locator('input[type=file]').setInputFiles({name:'fixture-license.png',mimeType:'image/png',buffer:Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+jRZkAAAAASUVORK5CYII=','base64')});
 await fillStep(page);await form.getByRole('button',{name:'Continue',exact:true}).click();
 await expect(page.locator('#onboarding-step-title')).toHaveText('Vehicle information');
 await form.getByRole('button',{name:'Back',exact:true}).click();await expect(form.locator('input[name=emailOwner]')).toHaveValue(values.emailOwner);
 await form.getByRole('button',{name:'Continue',exact:true}).click();await fillStep(page);
 await form.getByRole('checkbox').first().check();
 await form.getByRole('button',{name:'Continue',exact:true}).click();await expect(page.locator('#onboarding-step-title')).toHaveText('Secure information');
 await fillStep(page);await expect(form.locator('input[name=ssn]')).toHaveAttribute('type','password');
 await form.getByRole('button',{name:'Continue',exact:true}).click();await expect(page.locator('#onboarding-step-title')).toHaveText('Review & submit');
 expect(await page.evaluate(()=>document.documentElement.scrollWidth)).toBeLessThanOrEqual(width+1);
 await page.screenshot({path:test.info().outputPath('review.png'),fullPage:true});
 await expect(form).not.toContainText(values.accountNumber);await expect(form).not.toContainText(values.ssn);
 await form.getByRole('checkbox',{name:'Confirm and submit for review'}).check();
 await form.getByRole('button',{name:'Submit for review'}).click();
 await expect(page.getByRole('heading',{name:'Thank You!'})).toBeVisible();
 expect(writes).toHaveLength(1);expect(writes[0].path).toBe('/api/onboarding/submit');if(width===390){expect(writes[0].body.multipart).toContain('filename="fixture-license.png"');expect(writes[0].body.multipart).toContain(values.vinNumber);expect(writes[0].body.multipart).toContain(values.accountNumber);}else expect(writes[0].body).toMatchObject({emailOwner:values.emailOwner,vinNumber:values.vinNumber,accountNumber:values.accountNumber,confirmAgreement:true});
});
test('admin review saves only edited fields, approves separately from signing, then creates one inactive record',async({page})=>{
 await page.setViewportSize({width:390,height:844});const {writes}=await fixture(page,true);
 await page.goto('/admin/forms?section=client-onboarding&item=lyc');
 await page.getByRole('button',{name:'Review & edit application',exact:true}).click();
 const panel=page.getByRole('region',{name:'Onboarding review workflow'});
 await expect(panel.getByText(/Awaiting contract signature/)).toBeVisible();
 await panel.getByRole('button',{name:'Edit application',exact:true}).click();
 await panel.getByLabel('Edit Vehicle Trim',{exact:true}).fill('Touring');
 await panel.getByRole('button',{name:'Save review changes'}).click();
 await expect(panel.getByRole('status')).toContainText('saved');
 expect(writes.at(-1).body.changes).toEqual({vehicleTrim:'Touring'});
 await panel.getByRole('button',{name:'Approve application',exact:true}).click();
 await expect(panel.getByText('Application: approved',{exact:true})).toBeVisible();
 await expect(panel.getByText('Contract: sent',{exact:true})).toBeVisible();
 expect(writes.filter(w=>w.path.includes('create-vehicle'))).toHaveLength(0);
 await panel.getByRole('button',{name:'Create vehicle record',exact:true}).click();
 await panel.getByRole('button',{name:'Confirm create vehicle record',exact:true}).click();
 await expect(panel.getByRole('link',{name:'Open vehicle record'})).toHaveAttribute('href','/admin/cars/88');
 await expect(panel.getByRole('button',{name:'Create vehicle record',exact:true})).toHaveCount(0);
 expect(writes.filter(w=>w.path.includes('create-vehicle'))).toHaveLength(1);
 for(const entry of writes)expect(entry.body).not.toHaveProperty('status','ACTIVE');
});

for(const signed of [false,true]) test(`owner drop-off form is ${signed?'available with an eligible signed car':'gated until a signed car is ready'}`,async({page})=>{
 await fixture(page,'client');
 await page.route('**/api/client/cars?for=onboarding',route=>route.fulfill({contentType:'application/json',body:JSON.stringify({success:true,data:signed?[{id:88,makeModel:'Honda Accord 2020',plateNumber:'TEST123',carStatus:'off_fleet'}]:[]})}));
 await page.goto('/admin/forms?section=client-onboarding&item=car-on');
 if(signed) { await expect(page.getByText('Your contract is signed.',{exact:false})).toBeVisible();await expect(page.getByText('Select Your Car *',{exact:true})).toBeVisible(); }
 else { await expect(page.getByText('Vehicle drop-off comes after signing',{exact:true})).toBeVisible();await expect(page.getByText('Select Your Car *',{exact:true})).toHaveCount(0); }
});
