import {expect,test,type Page,type Locator} from '@playwright/test';
const values:Record<string,string>={date:'2026-11-02',firstNameOwner:'Test',lastNameOwner:'Owner',phoneOwner:'8010000000',emailOwner:'owner@example.test',streetAddress:'50 Test Street',city:'Salt Lake City',state:'UT',zipCode:'84116',birthday:'1990-01-01',emergencyContactName:'Test Contact',emergencyContactPhone:'8010000001',vehicleYear:'2020',vehicleMake:'Honda',vehicleModel:'Accord',vehicleTrim:'Sport',vehicleMiles:'55000',exteriorColor:'White',interiorColor:'Black',vinNumber:'1HGCM82633A004352',licensePlate:'TEST123',registrationExpiration:'2027-03-01',numberOfSeats:'5',numberOfDoors:'4',lastOilChange:'2026-10-01',oilType:'0W-20',oilPackageDetails:'Test package',tireSize:'225/45R17',insuranceProvider:'Fixture insurance',insurancePhone:'8010000002',policyNumber:'FIXTURE',insuranceExpiration:'2027-04-01',purchasePrice:'20000',interestRate:'4',monthlyPayment:'300',downPayment:'2000',ultimateGoal:'Help cover costs',bankName:'Fixture bank',routingNumber:'123456789',accountNumber:'987654321',ssn:'000001234',ein:'001234567',businessName:'Test',carManufacturerWebsite:'https://example.test',carManufacturerUsername:'test-owner',password:'fixture-password'};
async function fixture(page:Page,admin:boolean|'client'|'guest'=false){
 const writes:any[]=[];
 let account:any=admin==='guest'?null:{id:1,firstName:'Test',lastName:admin===true?'Admin':'Owner',email:'owner@example.test',roleName:admin===false?'LYC Applicant':admin==='client'?'Client':'Admin',isApplicant:admin===false,isAdmin:admin===true,isSuperAdmin:admin===true,isClient:admin==='client',isEmployee:false,tourCompleted:true};
 let profile:any={firstNameOwner:'Test',lastNameOwner:'Owner',emailOwner:'owner@example.test'};
 const drafts:any[]=[];let nextId=1,questionnaireCompleted=admin==='client';let banking:any={};

 const submission:any={id:7,...values,status:'pending',contractStatus:'sent',createdAt:'2026-11-02T12:00:00Z',vehicleFeatures:['Bluetooth'],reviewVersion:'a'.repeat(64),routingNumber:'•••6789',accountNumber:'•••4321',ssn:'•••1234',password:'••••••••'};
 const workflow:any={version:submission.reviewVersion,carId:null,clientId:null,history:[]};
 await page.route('**/*',async route=>{
  const url=new URL(route.request().url());
  if(!['127.0.0.1','localhost'].includes(url.hostname))return route.abort();
  if(!url.pathname.startsWith('/api/'))return route.continue();
  const path=url.pathname;let data:any={success:true,data:[],notifications:[],unreadCount:0,total:0};
  if(path==='/api/auth/me')data={user:account};
  if(path==='/api/lyc/profile')data={profile};
  if(path==='/api/lyc/reusable')data={profile,banking,questionnaireCompleted,driversLicenseUrls:[]};
  if(path==='/api/lyc/applications')data={drafts:drafts.filter(d=>!d.submissionId),applications:[]};
  if(/^\/api\/lyc\/drafts\/\d+$/.test(path))data={draft:drafts.find(d=>d.id===Number(path.split('/').at(-1)))};
  if(path==='/api/public-page-status')data={isPublic:true,canPreview:false};
  if(path==='/api/settings/sales-reps')data.data=['Fixture Rep'];
  if(path==='/api/admin/form-visibility')data={isAdmin:admin===true,isClient:admin!==true,isEmployee:false,formVisibility:{'Car On-boarding':{isVisible:true},'Client Onboarding Form LYC':{isVisible:true}}};
  if(path==='/api/onboarding/submissions')data={success:true,data:[submission],pagination:{page:1,total:1,totalPages:1,limit:10}};
  if(path==='/api/onboarding/submissions/7')data={success:true,data:submission};
  if(path.endsWith('/7/review'))data={success:true,data:workflow};
  if(route.request().method()!=='GET'){
   const body=route.request().headers()['content-type']?.includes('multipart/form-data') ? {multipart:route.request().postData()} : route.request().postDataJSON();writes.push({path,body});
   if(path==='/api/auth/signup')data={success:true,user:{id:1}};
   if(path==='/api/auth/login'){account={id:1,firstName:'New',lastName:'Applicant',email:body.email,roleName:'LYC Applicant',isApplicant:true,isAdmin:false,isClient:false,isEmployee:false};data={user:account};}
   if(path==='/api/lyc/questionnaire'){questionnaireCompleted=true;data={completed:true};}
   if(path==='/api/lyc/profile'){profile={...profile,...body};data={profile};}
   if(path==='/api/lyc/drafts'){const d={id:nextId++,hasVehicle:body.hasVehicle,fields:body.fields,version:0,updatedAt:new Date().toISOString(),documents:{}};drafts.push(d);data={draft:d};}
   if(/^\/api\/lyc\/drafts\/\d+$/.test(path)){const d=drafts.find(d=>d.id===Number(path.split('/').at(-1)));Object.assign(d,body,{version:d.version+1});data={draft:d};}
   if(path.endsWith('/documents')){const d=drafts.find(d=>d.id===Number(path.split('/').at(-2)));d.documents={driversLicenseUrls:['/fixture-license.png']};d.version++;data={draft:d};}
   if(path.endsWith('/7/review'))Object.assign(submission,body.changes);
   if(path.endsWith('/7/approve')){submission.status='approved';data={success:true,data:submission};}
   if(path.endsWith('/7/status'))submission.status=body.status;
   if(path.endsWith('/7/create-vehicle')){workflow.carId=88;data={success:true,data:{carId:88},message:'Vehicle record created. It has not been activated for rental.'};}
   if(path==='/api/onboarding/submit'){drafts.find(d=>d.id===body.draftId).submissionId=7;data={success:true,data:{id:7}};}
  }
  return route.fulfill({contentType:'application/json',body:JSON.stringify(data)});
 });
 return {writes,submission,workflow,drafts,profile,setBanking:(b:any)=>{banking=b;},setProfile:(p:any)=>{profile={...profile,...p};}};
}
async function choose(page:Page,trigger:Locator,label:string){await trigger.click();await page.getByRole('option',{name:label,exact:true}).click();}
async function fillStep(page:Page){
 await expect(page.locator('form input[name]:visible').first()).toBeVisible();
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
 await page.goto('/onboarding?start=1');
 const form=page.locator('form');
 await expect(form.getByText('Drivers License Upload',{exact:true})).toBeVisible();
 await expect(form.getByLabel('Vehicle Year *',{exact:true})).toHaveCount(0);
 await form.getByRole('button',{name:'Continue',exact:true}).click();
 await expect(form.getByRole('alert')).toHaveText(/highlighted fields/);expect(writes).toHaveLength(0);
 if(width===390)await form.locator('input[type=file]').setInputFiles({name:'fixture-license.png',mimeType:'image/png',buffer:Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+jRZkAAAAASUVORK5CYII=','base64')});
 await fillStep(page);await form.getByRole('button',{name:'Continue',exact:true}).click();
 await expect(page.getByRole('heading',{name:'Let’s tailor your LYC steps'})).toBeVisible();
 await page.getByRole('button',{name:'Yes, I have a vehicle',exact:true}).click();await page.getByRole('button',{name:'Save plan & choose my next step'}).click();
 await expect(page.locator('#onboarding-step-title')).toHaveText('Vehicle information');
 await form.getByRole('button',{name:'Back',exact:true}).click();await expect(form.locator('input[name=emailOwner]')).toHaveValue(values.emailOwner);
 await form.getByRole('button',{name:'Continue',exact:true}).click();await expect(page.locator('#onboarding-step-title')).toHaveText('Vehicle information');await fillStep(page);
 await form.getByRole('checkbox').first().check();
 await form.getByRole('button',{name:'Continue',exact:true}).click();await expect(page.locator('#onboarding-step-title')).toHaveText('Secure information');
 await fillStep(page);await expect(form.locator('input[name=ssn]')).toHaveAttribute('type','password');
 await form.getByRole('button',{name:'Continue',exact:true}).click();await expect(page.locator('#onboarding-step-title')).toHaveText('Review & submit');
 expect(await page.evaluate(()=>document.documentElement.scrollWidth)).toBeLessThanOrEqual(width+1);
 await page.screenshot({path:test.info().outputPath('review.png'),fullPage:true});
 await expect(form).not.toContainText(values.accountNumber);await expect(form).not.toContainText(values.ssn);
 await form.getByRole('checkbox',{name:'Confirm and submit for review'}).check();
 await form.getByRole('button',{name:'Submit for review'}).click();
 await expect(page.getByRole('heading',{name:'Your LYC applications'})).toBeVisible();
 const submissionWrites=writes.filter(w=>w.path==='/api/onboarding/submit');expect(submissionWrites).toHaveLength(1);
 expect(submissionWrites[0].body).toMatchObject({emailOwner:values.emailOwner,vinNumber:values.vinNumber,accountNumber:values.accountNumber,confirmAgreement:true,draftId:1});
 if(width===390)expect(writes.find(w=>w.path.endsWith('/documents'))?.body.multipart).toContain('filename="fixture-license.png"');
});
test('admin review saves only edited fields, approves separately from signing, then creates one inactive record',async({page})=>{
 await page.setViewportSize({width:390,height:844});const {writes,submission,workflow}=await fixture(page,true);
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
 expect(writes.filter(w=>w.path.includes('create-vehicle'))).toHaveLength(0);await expect(panel.getByRole('button',{name:'Create vehicle record',exact:true})).toBeDisabled();
 submission.contractStatus='signed';workflow.clientId=12;await page.reload();await page.getByRole('button',{name:'Review & edit application',exact:true}).click();
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

test('guests create a restricted account before starting and existing login continuation stays local',async({page})=>{
 const {writes}=await fixture(page,'guest');await page.goto('/onboarding');
 await expect(page.locator('iframe[title="Golden Luxury Auto List Your Car"]')).toBeVisible();
 await expect(page.getByRole('heading',{name:'Create your account'})).toHaveCount(0);
 await page.getByRole('link',{name:'Get Started',exact:true}).click();
 await expect(page.getByRole('heading',{name:'Create your account'})).toBeVisible();
 await page.getByLabel('First name',{exact:true}).fill('New');await page.getByLabel('Last name',{exact:true}).fill('Applicant');await page.getByLabel('Email',{exact:true}).fill('new@example.test');await page.getByLabel('Choose a password').fill('fixture-account-password');await page.getByLabel('Confirm password').fill('fixture-account-password');
 await page.getByRole('button',{name:'Create account & continue'}).click();await expect(page.locator('#onboarding-step-title')).toHaveText('Personal information');
 expect(writes.find(w=>w.path==='/api/auth/signup')?.body).not.toHaveProperty('roleId');
});

for(const width of [390,1280]) test(`public LYC overview, consultation and testimonials remain available before Get Started at ${width}px`,async({page})=>{
 await page.setViewportSize({width,height:844});const {writes}=await fixture(page,'guest');
 const requests:string[]=[];page.on('request',request=>requests.push(new URL(request.url()).pathname));
 for(const path of ['/onboarding','/salt-lake-city/onboarding','/wilmington-nc/onboarding']){
   await page.goto(path);
   await expect(page).toHaveURL(new RegExp(`${path}$`));
   await expect(page.getByRole('heading',{name:'Let us manage your vehicle'})).toBeVisible();
   await expect(page.getByRole('heading',{name:'Create your account'})).toHaveCount(0);
   await expect(page.locator('#onboarding-step-title')).toHaveCount(0);
   const sidebar=page.getByRole('complementary',{name:'About the List Your Car program'});
   await expect(sidebar.locator('iframe[title="Golden Luxury Auto List Your Car"]')).toHaveAttribute('src','https://www.youtube.com/embed/zyhzeXvCp8U?start=1');
   await expect(sidebar.getByRole('link',{name:'Book A Consulting Appointment'})).toHaveAttribute('href','https://rent.goldenluxuryauto.com/book-a-call-lyc');
   await expect(sidebar.getByRole('link',{name:'Book A Consulting Appointment'})).toHaveAttribute('target','_blank');
   const video=sidebar.locator('iframe[title="Golden Luxury Auto List Your Car"]');
   const testimonial=sidebar.locator('iframe[title="Client Testimonial 1"]');
   await expect(testimonial).toHaveAttribute('src','https://www.youtube-nocookie.com/embed/KMBnH3Bg4Qg');
   const first=await video.boundingBox(),second=await testimonial.boundingBox();
   expect(second!.y).toBeGreaterThan(first!.y+first!.height);
   await sidebar.getByRole('button',{name:'Next testimonial'}).click();
   await expect(sidebar.locator('iframe[title="Client Testimonial 2"]')).toHaveAttribute('src','https://www.youtube-nocookie.com/embed/nLOSfS22EhE');
   await sidebar.getByRole('button',{name:'Previous testimonial'}).click();
   const expectedTestimonials=path.startsWith('/wilmington-nc')?'/wilmington-nc/testimonials':'/salt-lake-city/testimonials';
   await expect(sidebar.getByRole('link',{name:'View all testimonials'})).toHaveAttribute('href',expectedTestimonials);
   expect(await page.evaluate(()=>document.documentElement.scrollWidth)).toBeLessThanOrEqual(width);
 }
 expect(writes).toHaveLength(0);expect(requests).not.toContain('/api/lyc/reusable');
 await page.getByRole('link',{name:'Get Started',exact:true}).click();
 await expect(page).toHaveURL(/\/signup\?next=%2Fwilmington-nc%2Fonboarding%3Fstart%3D1$/);
 await expect(page.getByRole('heading',{name:'Create your account'})).toBeVisible();
});

test('signed-in applicant opens saved steps only after Get Started and retains the testimonial sidebar',async({page})=>{
 await fixture(page);await page.goto('/salt-lake-city/onboarding');
 await expect(page.locator('#onboarding-step-title')).toHaveCount(0);
 await page.getByRole('link',{name:'Get Started',exact:true}).click();
 await expect(page.locator('#onboarding-step-title')).toHaveText('Personal information');
 await expect(page.getByRole('heading',{name:'Create your account'})).toHaveCount(0);
 const sidebar=page.getByRole('complementary',{name:'About the List Your Car program'});
 await expect(sidebar.getByRole('heading',{name:'Client stories'})).toBeVisible();
 await expect(sidebar.getByRole('link',{name:'Book A Consulting Appointment'})).toBeVisible();
});

test('LYC video and testimonials send the origin required by YouTube without leaking application query details',async({page})=>{
 await fixture(page);
 const embeds:{url:string;referer:string|undefined}[]=[];
 // Inspect the browser's real iframe request headers; do not call the provider
 // or pretend that a mocked player verifies actual YouTube playback.
 await page.route(/^https:\/\/www\.youtube(?:-nocookie)?\.com\/embed\//,async route=>{
   embeds.push({url:route.request().url(),referer:(await route.request().allHeaders()).referer});
   await route.fulfill({contentType:'text/html',body:'<!doctype html><title>Test player</title>'});
 });
 for(const query of ['?campaign=fixture-private-value','?start=1&campaign=fixture-private-value']){
   embeds.length=0;
   await page.goto(`/salt-lake-city/onboarding${query}`);
   const sidebar=page.getByRole('complementary',{name:'About the List Your Car program'});
   await sidebar.locator('iframe[title="Client Testimonial 1"]').scrollIntoViewIfNeeded();
   await expect.poll(()=>embeds.length).toBe(2);
   expect(embeds.every(item=>item.referer==='http://127.0.0.1:5336/')).toBe(true);
   expect(embeds.some(item=>item.url.includes('fixture-private-value')||item.referer?.includes('onboarding'))).toBe(false);
   await expect(sidebar.locator('iframe[title="Golden Luxury Auto List Your Car"]')).toHaveAttribute('referrerpolicy','strict-origin');
   await expect(sidebar.locator('iframe[title="Client Testimonial 1"]')).toHaveAttribute('referrerpolicy','strict-origin');
 }
});
test('applicant cannot mount the staff shell when visiting a staff URL',async({page})=>{
 const requests:string[]=[];await fixture(page);page.on('request',req=>{if(req.url().includes('/api/'))requests.push(new URL(req.url()).pathname);});
 await page.goto('/admin/admins');await expect(page).toHaveURL(/\/lyc\/status/);await expect(page.getByRole('heading',{name:'Your LYC applications'})).toBeVisible();
 expect(requests).not.toContain('/api/admin/users');await expect(page.getByRole('navigation',{name:'Workspace navigation'})).toHaveCount(0);
});
test('vehicle-free finance plan saves secure details out of order and resumes a separate vehicle step',async({page})=>{
 await page.setViewportSize({width:390,height:844});const {drafts,writes}=await fixture(page);await page.goto('/onboarding?start=1');await fillStep(page);await page.locator('form').getByRole('button',{name:'Continue',exact:true}).click();
 await page.getByRole('button',{name:'Not yet',exact:true}).click();await choose(page,page.getByRole('combobox',{name:/Do you plan to buy or finance/}),'Finance a vehicle');await choose(page,page.getByRole('combobox',{name:/Do you know which vehicle/}),'Not yet — that’s okay');
 await page.getByRole('button',{name:'Save plan & choose my next step'}).click();
 await page.getByRole('button',{name:'3. Secure information',exact:true}).click();await page.locator('input[name=bankName]').fill('Fixture Bank');await page.locator('input[name=ssn]').fill('fixture-only');
 await page.getByRole('button',{name:'Save & exit',exact:true}).click();await expect(page.getByText('Waiting for vehicle details — your other steps can be completed now.')).toBeVisible();
 expect(drafts).toHaveLength(1);expect(drafts[0].fields).toMatchObject({acquisitionPlan:'finance',knowsPlannedCar:'no',bankName:'Fixture Bank'});expect(writes.some(w=>w.path==='/api/onboarding/submit')).toBe(false);
 await page.getByRole('link',{name:'Add vehicle details',exact:true}).click();await expect(page.getByRole('heading',{name:'Add your vehicle when you’re ready'})).toBeVisible();
 await page.getByRole('button',{name:'I now have a vehicle — add its details'}).click();await expect(page.locator('input[name=vinNumber]')).toBeVisible();
 await page.getByRole('button',{name:'3. Secure information',exact:true}).click();await expect(page.locator('input[name=bankName]')).toHaveValue('Fixture Bank');
 expect(await page.evaluate(()=>document.documentElement.scrollWidth)).toBeLessThanOrEqual(391);
 await page.screenshot({path:test.info().outputPath('independent-steps-mobile.png'),fullPage:true});
});
test('existing client personal details are reused and multiple vehicle plans remain separate',async({page})=>{
 const {setProfile,setBanking}=await fixture(page,'client');setBanking(Object.fromEntries(['bankName','routingNumber','accountNumber','ssn'].map(key=>[key,values[key]])));setProfile(Object.fromEntries(['firstNameOwner','lastNameOwner','emailOwner','phoneOwner','streetAddress','city','state','zipCode','birthday','emergencyContactName','emergencyContactPhone'].map(key=>[key,values[key]])));setProfile({tshirtSize:'M',representative:'Fixture Rep',heardAboutUs:'Referral'});
 await page.goto('/onboarding');await page.getByRole('link',{name:'Get Started',exact:true}).click();await expect(page.locator('#onboarding-step-title')).toHaveText('Vehicle information');
 await page.getByRole('button',{name:'3. Secure information',exact:true}).click();await expect(page.locator('input[name=accountNumber]')).toHaveValue(values.accountNumber);await page.getByRole('button',{name:'2. Vehicle information',exact:true}).click();
 await expect(page.getByRole('heading',{name:'Let’s tailor your LYC steps'})).toHaveCount(0);await page.getByRole('button',{name:'I’m still planning this vehicle — save its details for later'}).click();await choose(page,page.getByRole('combobox',{name:/Do you know which vehicle/}),'Yes');await page.getByLabel('Planned make',{exact:true}).fill('Honda');await page.getByLabel('Planned model',{exact:true}).fill('Accord');await page.getByRole('button',{name:'Save & exit'}).click();
 await page.getByRole('link',{name:'Start another application'}).click();await expect(page.getByRole('heading',{name:'Let’s tailor your LYC steps'})).toHaveCount(0);await page.getByRole('button',{name:'I’m still planning this vehicle — save its details for later'}).click();await choose(page,page.getByRole('combobox',{name:/Do you know which vehicle/}),'Yes');await page.getByLabel('Planned make',{exact:true}).fill('Toyota');await page.getByLabel('Planned model',{exact:true}).fill('Sienna');await page.getByRole('button',{name:'Save & exit'}).click();
 await expect(page.getByRole('heading',{name:'Honda Accord'})).toBeVisible();await expect(page.getByRole('heading',{name:'Toyota Sienna'})).toBeVisible();
});

test('applicant directory ranks closest first and only offers conversion after approval and signing',async({page})=>{
 await page.setViewportSize({width:390,height:844});await fixture(page,true);const changes:any[]=[];
 const app=(signed:boolean)=>({id:signed?7:8,status:'approved',vehicle:'Honda Accord 2020',steps:[{label:'Submitted',done:true},{label:'Approved',done:true},{label:'Sent',done:true},{label:'Signed',done:signed},{label:'Drop-off',done:false}]});
 let accounts=[{id:1,firstName:'Zoe',lastName:'New',email:'new@example.test',createdAt:'2026-11-03',lastActivityAt:'2026-11-03',stage:{key:'created',label:'Not started',rank:0},drafts:[],applications:[]},{id:2,firstName:'Bea',lastName:'Unsigned',email:'unsigned@example.test',createdAt:'2026-11-02',lastActivityAt:'2026-11-03',stage:{key:'contract',label:'Awaiting signature',rank:5},drafts:[],applications:[app(false)]},{id:3,firstName:'Ana',lastName:'Signed',email:'signed@example.test',createdAt:'2026-11-01',lastActivityAt:'2026-11-03',stage:{key:'ready',label:'Ready',rank:6},drafts:[],applications:[app(true)]}];
 await page.route('**/api/onboarding/applicants',route=>route.fulfill({json:{accounts}}));
 await page.route('**/api/onboarding/submissions/7/activate-client',route=>{changes.push(route.request().postDataJSON());accounts=accounts.filter(a=>a.id!==3);return route.fulfill({json:{success:true}});});
 await page.goto('/admin/applicants');await expect(page.getByRole('heading',{name:'Applicants',exact:true})).toBeVisible();
 await expect(page.locator('article').first()).toContainText('Ana Signed');
 const unsigned=page.locator('article').filter({hasText:'Bea Unsigned'});await unsigned.locator('summary').click();await expect(unsigned.getByRole('button',{name:'Move account to Clients'})).toHaveCount(0);
 const signed=page.locator('article').filter({hasText:'Ana Signed'});await signed.locator('summary').click();await signed.getByRole('button',{name:'Move account to Clients'}).click();await expect(page.getByRole('heading',{name:'Ana Signed'})).toHaveCount(0);expect(changes).toHaveLength(1);
 await choose(page,page.getByRole('combobox',{name:'Applicant status'}),'Account created · not started');await expect(page.locator('article')).toHaveCount(1);await expect(page.locator('article')).toContainText('Zoe New');
 expect(await page.evaluate(()=>document.documentElement.scrollWidth)).toBeLessThanOrEqual(391);
 await page.screenshot({path:test.info().outputPath('applicants-mobile.png'),fullPage:true});
});
test('retention queue blocks removal pending information and allows a reasoned keep exception',async({page})=>{
 await page.setViewportSize({width:390,height:844});await fixture(page,true);const writes:any[]=[];
 const record={client_id:12,client_fname:'Fixture',client_lname:'Owner',client_email:'fixture@example.test',inactive_since:'2024-01-01',notice_sent_at:'2026-01-01',information_requested_at:'2026-01-01',information_request:'Please send my statements.',review_status:'review'};
 await page.route('**/api/admin/client-retention',route=>route.fulfill({json:{records:[record]}}));
 await page.route('**/api/admin/client-retention/12/preview',route=>route.fulfill({json:{version:'a'.repeat(64),groups:[{table:'client_payments',kind:'financial',count:2}],blockers:['Provide the requested information before removing records.'],decisionBlockers:{},scope:'Current software records'}}));
 await page.route('**/api/admin/client-retention/12/decision',route=>{writes.push(route.request().postDataJSON());record.review_status='kept';return route.fulfill({json:{message:'Keep exception recorded.'}});});
 await page.goto('/admin/client-retention');await page.getByRole('button',{name:'Review retention options'}).click();await choose(page,page.getByRole('combobox',{name:'Decision',exact:true}),'Remove personal information; keep financials and contracts');await page.getByLabel('Reason',{exact:true}).fill('Fixture reviewed');await page.getByLabel('Enter client ID 12').fill('12');await expect(page.getByRole('button',{name:'Apply reviewed removal'})).toBeDisabled();await page.screenshot({path:test.info().outputPath('retention-mobile.png'),fullPage:true});
 await choose(page,page.getByRole('combobox',{name:'Decision',exact:true}),'Keep everything — record an exception');await page.getByRole('button',{name:'Save keep exception'}).click();await expect(page.getByRole('status').filter({hasText:'Keep exception recorded'})).toBeVisible();expect(writes[0]).toMatchObject({decision:'keep',reason:'Fixture reviewed'});
 expect(await page.evaluate(()=>document.documentElement.scrollWidth)).toBeLessThanOrEqual(391);
});
