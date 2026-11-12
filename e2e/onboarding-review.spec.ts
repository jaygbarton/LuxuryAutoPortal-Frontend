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
  if(path==='/api/settings/sales-reps')data.data=['Fixture Rep','Andy Zhang'];
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
   if(path.endsWith('/submit-pending')){const d=drafts.find(d=>d.id===Number(path.split('/').at(-2)));d.pendingSubmittedAt||=new Date().toISOString();d.version++;data={draft:d};}
   if(path.endsWith('/documents')){const d=drafts.find(d=>d.id===Number(path.split('/').at(-2)));d.documents={driversLicenseUrls:['/fixture-license.png']};d.version++;data={draft:d};}
   if(path.endsWith('/7/review'))Object.assign(submission,body.changes);
   if(path.endsWith('/7/approve')){submission.status='approved';workflow.clientId=12;workflow.carId=88;data={success:true,data:submission};}
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
 if(width===390)await page.addInitScript(()=>{
  const format=Date.prototype.toLocaleDateString;
  Date.prototype.toLocaleDateString=function(...args){return args[0]==='en-CA'?'11/6/2026':format.apply(this,args);};
 });
 await page.goto('/onboarding?start=1');
 const form=page.locator('form');
 await expect(form.locator('input[name=date]')).toHaveValue(/^\d{4}-\d{2}-\d{2}$/);
 await expect(form.getByText('Drivers License Upload',{exact:true})).toBeVisible();
 await expect(form.getByLabel('Vehicle Year *',{exact:true})).toHaveCount(0);
 await form.getByRole('button',{name:'Continue',exact:true}).click();
 await expect(form.getByRole('alert')).toHaveText(/highlighted fields/);expect(writes).toHaveLength(0);
 if(width===390)await form.locator('input[type=file]').setInputFiles({name:'fixture-license.png',mimeType:'image/png',buffer:Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+jRZkAAAAASUVORK5CYII=','base64')});
 await fillStep(page);await form.getByRole('button',{name:'Continue',exact:true}).click();
 await expect(page.getByRole('heading',{name:'Let’s tailor your LYC steps'})).toBeVisible();
 await page.getByRole('button',{name:'Yes, I have a vehicle',exact:true}).click();
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
 if(width===390){
  await page.route('**/api/onboarding/submit',route=>route.fulfill({status:500,json:{error:'Failed to create onboarding submission',message:'Your saved draft is still available; please retry.'}}),{times:1});
  await form.getByRole('button',{name:'Submit for review'}).click();
  await expect(form.getByRole('alert')).toHaveText('Your saved draft is still available; please retry.');
  await expect(form.getByRole('button',{name:'Submit for review'})).toBeEnabled();
  await expect(form.getByRole('checkbox',{name:'Confirm and submit for review'})).toBeChecked();
 }
 await form.getByRole('button',{name:'Submit for review'}).click();
 await expect(page.getByRole('heading',{name:'Your LYC applications'})).toBeVisible();
 const submissionWrites=writes.filter(w=>w.path==='/api/onboarding/submit');expect(submissionWrites).toHaveLength(1);
 expect(submissionWrites[0].body).toMatchObject({emailOwner:values.emailOwner,vinNumber:values.vinNumber,accountNumber:values.accountNumber,confirmAgreement:true,draftId:1});
 if(width===390)expect(writes.find(w=>w.path.endsWith('/documents'))?.body.multipart).toContain('filename="fixture-license.png"');
});
test('admin review approval creates an off-fleet record while signing and activation remain separate',async({page})=>{
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
 await expect(panel.getByRole('link',{name:'Open vehicle record'})).toHaveAttribute('href','/admin/cars/88');
 expect(writes.filter(w=>w.path.includes('create-vehicle'))).toHaveLength(0);
 for(const entry of writes)expect(entry.body).not.toHaveProperty('status','ACTIVE');
});

for(const signed of [false,true]) test(`owner drop-off form is ${signed?'available with an eligible signed car':'gated until a signed car is ready'}`,async({page})=>{
 await fixture(page,'client');
 await page.route('**/api/client/cars?for=onboarding',route=>route.fulfill({contentType:'application/json',body:JSON.stringify({success:true,data:signed?[{id:88,makeModel:'Honda Accord 2020',plateNumber:'TEST123',carStatus:'off_fleet'}]:[]})}));
 await page.goto('/admin/forms?section=client-onboarding&item=car-on');
 if(signed) { await expect(page.getByText('Your contract is signed.',{exact:false})).toBeVisible();await expect(page.getByText('Select Your Car *',{exact:true})).toBeVisible(); }
 else { await expect(page.getByText('No vehicles ready for drop-off',{exact:true})).toBeVisible();await expect(page.getByText('Select Your Car *',{exact:true})).toHaveCount(0); }
});

for(const width of [390,1280]) test(`guests create a restricted account inline and continue into LYC steps at ${width}px`,async({page})=>{
 await page.setViewportSize({width,height:844});
 const {writes}=await fixture(page,'guest');await page.goto('/onboarding');
 await expect(page.locator('iframe[title="Golden Luxury Auto List Your Car"]')).toBeVisible();
 await expect(page.getByRole('heading',{name:'Create your account'})).toHaveCount(0);
 await page.getByRole('link',{name:'Get Started',exact:true}).click();
 await expect(page.getByRole('heading',{name:'Create your account'})).toBeVisible();
 await expect(page).toHaveURL(/\/onboarding\?start=1$/);
 const sidebar=page.getByRole('complementary',{name:'About the List Your Car program'});
 await expect(sidebar.getByRole('link',{name:'Book a Free Consulting Appointment'})).toBeVisible();
 await expect(sidebar.locator('iframe[title="Golden Luxury Auto List Your Car"]')).toBeVisible();
 await expect(sidebar.getByRole('heading',{name:'Client stories'})).toBeVisible();
 const application=page.getByRole('region',{name:'LYC application'});
 if(width===1280)expect((await application.boundingBox())!.x).toBeGreaterThan((await sidebar.boundingBox())!.x);
 expect(await page.evaluate(()=>document.documentElement.scrollWidth)).toBeLessThanOrEqual(width);
 await page.screenshot({path:test.info().outputPath('inline-account.png'),fullPage:true});
 await page.getByLabel('Phone (optional)').fill('8010000000');
 await page.getByLabel('First name',{exact:true}).fill('New');await page.getByLabel('Last name',{exact:true}).fill('Applicant');await page.getByLabel('Email',{exact:true}).fill('new@example.test');await page.getByLabel('Choose a password').fill('fixture-account-password');await page.getByLabel('Confirm password').fill('fixture-account-password');
 await page.getByRole('button',{name:'Create account & continue'}).click();await expect(page.locator('#onboarding-step-title')).toHaveText('Personal information');
 await expect(page).toHaveURL(/\/onboarding\?start=1$/);
 expect(writes.filter(w=>w.path==='/api/auth/signup')).toHaveLength(1);
 expect(writes.find(w=>w.path==='/api/auth/signup')?.body).not.toHaveProperty('roleId');
 await expect(page.locator('input[name=phoneOwner]')).toHaveValue('8010000000');
 await expect(sidebar.getByRole('link',{name:'Book a Free Consulting Appointment'})).toBeVisible();
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
   await expect(sidebar.getByRole('link',{name:'Book a Free Consulting Appointment'})).toHaveAttribute('href','https://rent.goldenluxuryauto.com/book-a-call-lyc');
   await expect(sidebar.getByRole('link',{name:'Book a Free Consulting Appointment'})).toHaveAttribute('target','_blank');
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
 await expect(page).toHaveURL(/\/wilmington-nc\/onboarding\?start=1$/);
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
 await expect(sidebar.getByRole('link',{name:'Book a Free Consulting Appointment'})).toBeVisible();
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
 await page.getByRole('button',{name:'3. Secure information',exact:true}).click();await page.locator('input[name=bankName]').fill('Fixture Bank');await page.locator('input[name=ssn]').fill('fixture-only');
 await page.getByRole('button',{name:'Save & exit',exact:true}).click();await expect(page.getByText('Waiting for vehicle details — your other steps can be completed now.')).toBeVisible();
 expect(drafts).toHaveLength(1);expect(drafts[0].fields).toMatchObject({acquisitionPlan:'finance',knowsPlannedCar:'no',bankName:'Fixture Bank'});expect(writes.some(w=>w.path==='/api/onboarding/submit')).toBe(false);
 await page.getByRole('link',{name:'Add vehicle details',exact:true}).click();await expect(page.getByRole('heading',{name:'Let’s tailor your LYC steps'})).toBeVisible();await expect(page.getByRole('button',{name:'Not yet',exact:true})).toHaveAttribute('aria-pressed','true');
 await page.getByRole('button',{name:'Yes, I have a vehicle',exact:true}).click();await expect(page.locator('input[name=vinNumber]')).toBeVisible();
 await page.getByRole('button',{name:'3. Secure information',exact:true}).click();await expect(page.locator('input[name=bankName]')).toHaveValue('Fixture Bank');
 expect(await page.evaluate(()=>document.documentElement.scrollWidth)).toBeLessThanOrEqual(391);
 await page.screenshot({path:test.info().outputPath('independent-steps-mobile.png'),fullPage:true});
});
test('existing client personal details are reused and multiple vehicle plans remain separate',async({page})=>{
 const {setProfile,setBanking}=await fixture(page,'client');setBanking(Object.fromEntries(['bankName','routingNumber','accountNumber','ssn'].map(key=>[key,values[key]])));setProfile(Object.fromEntries(['firstNameOwner','lastNameOwner','emailOwner','phoneOwner','streetAddress','city','state','zipCode','birthday','emergencyContactName','emergencyContactPhone'].map(key=>[key,values[key]])));setProfile({tshirtSize:'M',representative:'Fixture Rep',heardAboutUs:'Referral'});
 await page.goto('/onboarding');await page.getByRole('link',{name:'Get Started',exact:true}).click();await expect(page.locator('#onboarding-step-title')).toHaveText('Vehicle information');
 await page.getByRole('button',{name:'3. Secure information',exact:true}).click();await expect(page.locator('input[name=accountNumber]')).toHaveValue(values.accountNumber);await page.getByRole('button',{name:'2. Vehicle information',exact:true}).click();
 await expect(page.getByRole('heading',{name:'Let’s tailor your LYC steps'})).toBeVisible();await expect(page.getByRole('button',{name:'Not yet',exact:true})).toHaveAttribute('aria-pressed','false');await page.getByRole('button',{name:'Not yet',exact:true}).click();await choose(page,page.getByRole('combobox',{name:/Do you know which vehicle/}),'Yes');await page.getByLabel('Planned make',{exact:true}).fill('Honda');await page.getByLabel('Planned model',{exact:true}).fill('Accord');await page.getByRole('button',{name:'Save & exit'}).click();
 await page.getByRole('link',{name:'Start another application'}).click();await expect(page.getByRole('heading',{name:'Let’s tailor your LYC steps'})).toBeVisible();await expect(page.getByRole('button',{name:'Not yet',exact:true})).toHaveAttribute('aria-pressed','false');await page.getByRole('button',{name:'Not yet',exact:true}).click();await choose(page,page.getByRole('combobox',{name:/Do you know which vehicle/}),'Yes');await page.getByLabel('Planned make',{exact:true}).fill('Toyota');await page.getByLabel('Planned model',{exact:true}).fill('Sienna');await page.getByRole('button',{name:'Save & exit'}).click();
 await expect(page.getByRole('heading',{name:'Honda Accord'})).toBeVisible();await expect(page.getByRole('heading',{name:'Toyota Sienna'})).toBeVisible();
});

for(const width of [390,1280]) test(`pending intake requires personal, license and secure details before submission, then completes the same plan at ${width}px`,async({page})=>{
 await page.setViewportSize({width,height:844});const {drafts,writes}=await fixture(page);
 await page.goto('/onboarding?start=1');
 const form=page.locator('form');
 await expect(page.getByRole('heading',{name:'Let’s tailor your LYC steps'})).toHaveCount(0);
 await expect(page.getByRole('button',{name:/questionnaire/i})).toHaveCount(0);
 await form.locator('input[name=phoneOwner]').fill('8010000000');
 await choose(page,form.getByRole('combobox',{name:/Representative/}),'Andy Zhang');
 await form.getByRole('button',{name:'2. Vehicle information',exact:true}).click();
 const plan=page.getByRole('region',{name:'Your vehicle plan'});
 await expect(plan).toBeVisible();
 await form.getByRole('button',{name:'Continue',exact:true}).click();
 await expect(form.getByRole('alert')).toContainText('Please choose whether');
 await plan.getByRole('button',{name:'Not yet',exact:true}).click();
 await expect(plan).toContainText('Pending means we’re waiting for your car details.');
 await expect(plan).toContainText('Complete your personal and secure information, then submit.');
 await form.getByRole('button',{name:'Continue',exact:true}).click();
 await expect(form.getByRole('alert')).toContainText('Choose your plan');
 await choose(page,plan.getByRole('combobox',{name:/Do you plan to buy or finance/}),'Finance a vehicle');
 await choose(page,plan.getByRole('combobox',{name:/Do you know which vehicle/}),'Not yet — that’s okay');
 await plan.getByRole('checkbox',{name:'I understand GLA must approve the vehicle.'}).check();
 await plan.screenshot({path:test.info().outputPath('vehicle-questionnaire.png')});
 await form.getByRole('button',{name:'Continue',exact:true}).click();
 await expect(page.locator('#onboarding-step-title')).toHaveText('Secure information');await expect(plan).toHaveCount(0);
 await form.getByRole('button',{name:'Continue',exact:true}).click();await expect(form.getByRole('alert')).toContainText('highlighted');
 await fillStep(page);await form.getByRole('button',{name:'Continue',exact:true}).click();
 await expect(page.locator('#onboarding-step-title')).toHaveText('Review & submit');await expect(form).toContainText('Vehicle details to follow');
 await form.getByRole('checkbox',{name:'Confirm and submit pending application',exact:true}).check();
 await form.getByRole('button',{name:'Submit pending application',exact:true}).click();
 await expect(page.locator('#onboarding-step-title')).toHaveText('Personal information');await expect(form.getByRole('alert')).toContainText('Only car information can wait.');
 expect(writes.some(w=>w.path.endsWith('/submit-pending'))).toBe(false);await fillStep(page);
 await form.getByRole('button',{name:'4. Review & submit',exact:true}).click();await expect(page.locator('#onboarding-step-title')).toHaveText('Review & submit');
 await form.getByRole('button',{name:'Submit pending application',exact:true}).click();await expect(page.locator('#onboarding-step-title')).toHaveText('Personal information');
 await expect(form.getByRole('alert')).toContainText('upload your driver’s license');
 await form.locator('input[type=file]').setInputFiles({name:'fixture-license.png',mimeType:'image/png',buffer:Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+jRZkAAAAASUVORK5CYII=','base64')});
 await form.getByRole('button',{name:'4. Review & submit',exact:true}).click();await expect(page.locator('#onboarding-step-title')).toHaveText('Review & submit');
 await expect(form).toContainText('Driver’s license saved');
 await form.getByRole('checkbox',{name:'Confirm and submit pending application',exact:true}).uncheck();
 await form.getByRole('button',{name:'Submit pending application',exact:true}).click();await expect(form).toContainText('Please confirm before submitting');
 expect(writes.some(w=>w.path.endsWith('/submit-pending'))).toBe(false);
 await form.getByRole('checkbox',{name:'Confirm and submit pending application',exact:true}).check();
 let failOnce=width===390;
 await page.route('**/api/lyc/drafts/*/submit-pending',route=>{
   if(failOnce){failOnce=false;return route.fulfill({status:503,json:{error:'Pending application could not be saved. Please retry.'}});}
   return route.fallback();
 });
 await form.getByRole('button',{name:'Submit pending application',exact:true}).click();
 if(width===390){await expect(form.getByRole('alert')).toContainText('Please retry');await expect(page.locator('#onboarding-step-title')).toHaveText('Review & submit');await form.getByRole('button',{name:'Submit pending application',exact:true}).click();}
 await expect(page.getByText('Pending application submitted — GLA can view it and contact you.')).toBeVisible();
 expect(drafts).toHaveLength(1);expect(drafts[0]).toMatchObject({id:1,hasVehicle:false});expect(drafts[0].pendingSubmittedAt).toBeTruthy();
 expect(drafts[0].fields.accountNumber).toBe(values.accountNumber);expect(drafts[0].documents.driversLicenseUrls).toHaveLength(1);
 expect(drafts[0].fields.vinNumber).toBe('');expect(writes.some(w=>w.path==='/api/onboarding/submit')).toBe(false);
 await page.getByRole('link',{name:'Add vehicle details',exact:true}).click();
 await expect(plan.getByRole('button',{name:'Not yet',exact:true})).toHaveAttribute('aria-pressed','true');
 await plan.getByRole('button',{name:'Yes, I have a vehicle',exact:true}).click();await fillStep(page);await form.getByRole('checkbox').first().check();
 await form.getByRole('button',{name:'Continue',exact:true}).click();await expect(page.locator('#onboarding-step-title')).toHaveText('Secure information');await expect(plan).toHaveCount(0);
 await expect(form.locator('input[name=accountNumber]')).toHaveValue(values.accountNumber);
 await form.getByRole('button',{name:'Continue',exact:true}).click();await expect(page.locator('#onboarding-step-title')).toHaveText('Review & submit');
 await form.getByRole('checkbox',{name:'Confirm and submit for review',exact:true}).check();await form.getByRole('button',{name:'Submit for review',exact:true}).click();
 await expect(page.getByRole('heading',{name:'Your LYC applications'})).toBeVisible();
 expect(drafts).toHaveLength(1);expect(drafts[0]).toMatchObject({id:1,submissionId:7});
 expect(writes.filter(w=>w.path==='/api/onboarding/submit')).toHaveLength(1);expect(writes.find(w=>w.path==='/api/onboarding/submit')?.body.draftId).toBe(1);
});

test('admin can filter pending no-car applications and contact the applicant without client conversion',async({page})=>{
 await page.setViewportSize({width:390,height:844});await fixture(page,true);
 const account={id:91,firstName:'Test',lastName:'Applicant',email:'applicant@example.test',phone:'8010000000',createdAt:'2026-11-03',lastActivityAt:'2026-11-03',stage:{key:'pending_vehicle',label:'Pending application · vehicle later',rank:2.5},applications:[],drafts:[{id:17,hasVehicle:false,fields:{acquisitionPlan:'finance'},pendingSubmittedAt:'2026-11-03'}]};
 await page.route('**/api/onboarding/applicants',route=>route.fulfill({json:{accounts:[account]}}));
 await page.goto('/admin/applicants');
 await choose(page,page.getByRole('combobox',{name:'Applicant status'}),'Pending application · vehicle later');
 await page.getByLabel('Search applicants').fill('801');
 const applicant=page.locator('article');await expect(applicant).toHaveCount(1);await applicant.locator('summary').click();
 await expect(applicant.getByRole('link',{name:'Email Test'})).toHaveAttribute('href','mailto:applicant@example.test');
 await expect(applicant.getByRole('link',{name:'Call 8010000000'})).toHaveAttribute('href','tel:8010000000');
 await expect(applicant).toContainText('Pending application submitted');
 await expect(applicant).toContainText('before approval');
 await expect(applicant.getByRole('button',{name:'Move account to Clients'})).toHaveCount(0);
 expect(await page.evaluate(()=>document.documentElement.scrollWidth)).toBeLessThanOrEqual(390);
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


test('standalone signup stays available, rejects mismatched passwords and keeps continuation local',async({page})=>{
 const {writes}=await fixture(page,'guest');
 await page.goto('/signup?next=https%3A%2F%2Fexample.test');
 await expect(page.getByRole('heading',{name:'Create your account'})).toBeVisible();
 await expect(page.getByRole('link',{name:'Sign in to continue'})).toHaveAttribute('href','/admin/login?next=%2Flyc%2Fstatus');
 await page.getByLabel('First name',{exact:true}).fill('New');await page.getByLabel('Last name',{exact:true}).fill('Applicant');await page.getByLabel('Email',{exact:true}).fill('new@example.test');
 await page.getByLabel('Choose a password').fill('fixture-password');await page.getByLabel('Confirm password').fill('different-password');
 await page.getByRole('button',{name:'Create account & continue'}).click();
 await expect(page.getByRole('alert')).toHaveText('Passwords do not match.');expect(writes).toHaveLength(0);
 await page.getByLabel('Confirm password').fill('fixture-password');
 await page.getByRole('button',{name:'Create account & continue'}).click();
 await expect(page).toHaveURL(/\/lyc\/status$/);
 await expect(page.getByRole('heading',{name:'Your LYC applications'})).toBeVisible();
 expect(writes.filter(w=>w.path==='/api/auth/signup')).toHaveLength(1);
});

test('inline signup failure keeps the form and consultation visible without creating an application',async({page})=>{
 const {writes}=await fixture(page,'guest');
 await page.route('**/api/auth/signup',route=>route.fulfill({status:409,contentType:'application/json',body:JSON.stringify({error:'An account with this email already exists. Please sign in.'})}));
 await page.goto('/salt-lake-city/onboarding?start=1');
 await page.getByLabel('First name',{exact:true}).fill('New');await page.getByLabel('Last name',{exact:true}).fill('Applicant');await page.getByLabel('Email',{exact:true}).fill('new@example.test');
 await page.getByLabel('Choose a password').fill('fixture-password');await page.getByLabel('Confirm password').fill('fixture-password');
 await page.getByRole('button',{name:'Create account & continue'}).click();
 await expect(page.getByRole('alert')).toContainText('already exists');
 await expect(page.getByRole('link',{name:'Sign in to continue'})).toHaveAttribute('href','/admin/login?next=%2Fsalt-lake-city%2Fonboarding%3Fstart%3D1');
 await expect(page.getByRole('link',{name:'Book a Free Consulting Appointment'})).toBeVisible();
 await expect(page).toHaveURL(/\/salt-lake-city\/onboarding\?start=1$/);expect(writes).toHaveLength(0);
});


for(const width of [390,1280]) test(`onboarding step navigation has one deliberate scroll and validation keeps focus at the step at ${width}px`,async({page})=>{
 await page.setViewportSize({width,height:844});await fixture(page);
 await page.addInitScript(()=>{
   const original=HTMLElement.prototype.focus;
   (window as any).__onboardingFocus=[];
   HTMLElement.prototype.focus=function(options){
     if(this.id==='onboarding-step-title'||this.closest('form')&&this instanceof HTMLInputElement)
       (window as any).__onboardingFocus.push({id:this.id,name:this.getAttribute('name'),preventScroll:options?.preventScroll===true});
     return original.call(this,options);
   };
 });
 await page.goto('/onboarding?start=1');
 await expect(page.locator('#onboarding-step-title')).toHaveText('Personal information');
 await page.locator('form').getByRole('button',{name:'3. Secure information',exact:true}).click();
 await expect(page.locator('#onboarding-step-title')).toHaveText('Secure information');
 await expect(page.locator('#onboarding-step-title')).toBeFocused();
 const focus=await page.evaluate(()=>(window as any).__onboardingFocus.filter((call:any)=>call.id==='onboarding-step-title'));
 expect(focus.length).toBeGreaterThan(0);expect(focus.every((call:any)=>call.preventScroll)).toBe(true);
 const titleBox=await page.locator('#onboarding-step-title').boundingBox();expect(titleBox!.y).toBeGreaterThanOrEqual(80);expect(titleBox!.y).toBeLessThan(200);
 await page.locator('form').getByRole('button',{name:'Continue',exact:true}).click();
 await expect(page.locator('form').getByRole('alert')).toContainText('highlighted');
 await expect(page.locator('#onboarding-step-title')).toBeFocused();
 const errors=await page.evaluate(()=>(window as any).__onboardingFocus.filter((call:any)=>call.name));
 expect(errors).toEqual([]);
 const field=page.locator('input[name=bankName]');await field.fill('Fixture bank');
 // Two animation frames let the browser commit focus/layout; no delayed
 // focus callbacks may move the user away from the field they are editing.
 const top=await field.evaluate(el=>el.getBoundingClientRect().top);
 await page.evaluate(()=>new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve))));
 await expect(field).toBeFocused();expect(Math.abs((await field.boundingBox())!.y-top)).toBeLessThan(2);
});


for(const width of [390,1280]) test(`onboarding sensitive numbers reveal individually without submitting and remask between steps at ${width}px`,async({page})=>{
 await page.setViewportSize({width,height:844});const {writes}=await fixture(page);
 await page.goto('/onboarding?start=1');const form=page.locator('form');
 await form.getByRole('button',{name:'3. Secure information',exact:true}).click();
 await expect(page.locator('#onboarding-step-title')).toHaveText('Secure information');
 const samples=[['routingNumber','routing number','012345678'],['accountNumber','account number','000001234567890'],['ein','EIN','01-2345678'],['ssn','SSN','001-02-3456']];
 const writesBefore=writes.length;
 for(const [name,label,value] of samples){
   const input=form.locator(`input[name="${name}"]`);await expect(input).toHaveAttribute('type','password');
   await input.fill(value);
   const show=form.getByRole('button',{name:`Show ${label}`,exact:true});await expect(show).toHaveAttribute('type','button');
   await show.click();await expect(input).toHaveAttribute('type','text');await expect(input).toHaveValue(value);
   const hide=form.getByRole('button',{name:`Hide ${label}`,exact:true});await expect(hide).toHaveAttribute('aria-pressed','true');
   const others=samples.filter(([other])=>other!==name);for(const [other]of others)await expect(form.locator(`input[name="${other}"]`)).toHaveAttribute('type','password');
   await hide.click();await expect(input).toHaveAttribute('type','password');await expect(input).toHaveValue(value);
 }
 expect(writes.length).toBe(writesBefore);
 // The toggle remains keyboard operable and never becomes a submit button.
 const reveal=form.getByRole('button',{name:'Show SSN',exact:true});await reveal.focus();await page.keyboard.press('Enter');
 await expect(form.locator('input[name=ssn]')).toHaveAttribute('type','text');expect(writes.length).toBe(writesBefore);
 await form.getByRole('button',{name:'4. Review & submit',exact:true}).click();
 await expect(page.locator('#onboarding-step-title')).toHaveText('Review & submit');
 for(const [, ,value]of samples)await expect(form).not.toContainText(value);
 const saved=writes.filter(w=>w.path.includes('/api/lyc/drafts')).at(-1);
 expect(saved.body.fields).toMatchObject(Object.fromEntries(samples.map(([name,,value])=>[name,value])));
 await form.getByRole('button',{name:'Edit Secure information',exact:true}).click();
 for(const [name,,value]of samples){await expect(form.locator(`input[name="${name}"]`)).toHaveAttribute('type','password');await expect(form.locator(`input[name="${name}"]`)).toHaveValue(value);}
 expect(await page.evaluate(()=>document.documentElement.scrollWidth)).toBeLessThanOrEqual(width);
 await form.getByRole('button',{name:'Show account number',exact:true}).click();
 await expect(form.locator('input[name=accountNumber]')).toHaveAttribute('type','text');
 await page.evaluate(()=>{Object.defineProperty(document,'hidden',{configurable:true,value:true});document.dispatchEvent(new Event('visibilitychange'));});
 await expect(form.locator('input[name=accountNumber]')).toHaveAttribute('type','password');
});


for(const width of [390,1280]) test(`Step 3 tax classification and typing keep the page in place at ${width}px`,async({page})=>{
 await page.setViewportSize({width,height:844});await fixture(page);await page.goto('/onboarding?start=1');
 const form=page.locator('form');await form.getByRole('button',{name:'3. Secure information',exact:true}).click();
 await expect(page.locator('#onboarding-step-title')).toHaveText('Secure information');
 const select=form.getByRole('combobox',{name:'Tax Classification *',exact:true});
 await select.scrollIntoViewIfNeeded();
 const before=await select.boundingBox();await select.click();
 await page.getByRole('option',{name:'Individual',exact:true}).click();
 const after=await select.boundingBox();
 expect(Math.abs(after!.y-before!.y)).toBeLessThan(4);
 const bank=form.locator('input[name=bankName]');await bank.fill('Test bank');
 const initial=await bank.boundingBox();
 const positions=await page.evaluate(()=>new Promise<number[]>(resolve=>{
   const start=performance.now(),values:number[]=[];
   const sample=()=>{values.push(document.querySelector('input[name=bankName]')!.getBoundingClientRect().top);if(performance.now()-start<1000)requestAnimationFrame(sample);else resolve(values);};sample();
 }));
 expect(Math.max(...positions)-Math.min(...positions)).toBeLessThan(4);
 await expect(bank).toBeFocused();expect(Math.abs((await bank.boundingBox())!.y-initial!.y)).toBeLessThan(4);
});


for(const width of [390,1280]) test(`Step 3 stays steady during real keystrokes in each field at ${width}px`,async({page})=>{
 await page.setViewportSize({width,height:844});await fixture(page);await page.goto('/onboarding?start=1');
 const form=page.locator('form');await form.getByRole('button',{name:'3. Secure information',exact:true}).click();
 await expect(page.locator('#onboarding-step-title')).toHaveText('Secure information');
 await form.getByRole('button',{name:'Continue',exact:true}).click();
 await expect(form.getByRole('alert')).toBeVisible();
 for(const [name,text] of [['bankName','Test bank with a longer name'],['routingNumber','012345678'],['accountNumber','0001234567890123456789'],['businessName','Fixture business name'],['ein','01-2345678'],['ssn','001-02-3456']]){
   const input=form.locator(`input[name="${name}"]`);await input.click();
   const y=(await input.boundingBox())!.y;
   await input.pressSequentially(text,{delay:50});
   await expect(input).toBeFocused();expect(Math.abs((await input.boundingBox())!.y-y),name).toBeLessThan(4);
 }
});

for(const height of [600,844]) test(`Step 3 clicking visible fields does not move the page on desktop at ${height}px high`,async({page})=>{
 await page.setViewportSize({width:1280,height});await fixture(page);await page.goto('/onboarding?start=1');
 const form=page.locator('form');await form.getByRole('button',{name:'3. Secure information',exact:true}).click();
 await expect(page.locator('#onboarding-step-title')).toHaveText('Secure information');
 for(const name of ['bankName','routingNumber','accountNumber','businessName','ein','ssn']){
   const input=form.locator(`input[name="${name}"]`);
   await input.evaluate(el=>el.scrollIntoView({block:'center',behavior:'instant'}));
   const before=(await input.boundingBox())!;
   // Raw mouse clicks: locator.click()/fill() auto-scroll and can conceal a focus jump.
   await page.mouse.click(before.x+30,before.y+before.height/2);
   await expect(input).toBeFocused();
   const positions=await input.evaluate(el=>new Promise<number[]>(resolve=>{
     const values:number[]=[],start=performance.now();
     const sample=()=>{values.push(el.getBoundingClientRect().top);if(performance.now()-start<500)requestAnimationFrame(sample);else resolve(values);};sample();
   }));
   expect(Math.max(...positions.map(y=>Math.abs(y-before.y))),name).toBeLessThan(3);
 }
});

for(const position of ['top','bottom'] as const) test(`Step 3 clicks near viewport ${position} keep the visible field in place`,async({page})=>{
 await page.setViewportSize({width:1280,height:720});await fixture(page);await page.goto('/onboarding?start=1');
 await page.locator('form').getByRole('button',{name:'3. Secure information',exact:true}).click();
 await expect(page.locator('#onboarding-step-title')).toHaveText('Secure information');
 for(const name of ['bankName','routingNumber','accountNumber','businessName','ein','ssn']){
  const input=page.locator(`input[name="${name}"]`);
  await input.evaluate((el,position)=>{el.scrollIntoView({block:'center',behavior:'instant'});window.scrollBy({top:el.getBoundingClientRect().top-(position==='top'?100:window.innerHeight-60),behavior:'instant'});},position);
  const before=(await input.boundingBox())!;
  await page.mouse.click(before.x+20,before.y+before.height/2);
  await expect(input).toBeFocused();
  await page.evaluate(()=>new Promise(resolve=>setTimeout(resolve,400)));
  expect(Math.abs((await input.boundingBox())!.y-before.y),name).toBeLessThan(3);
 }
});

async function applicantDeletionFixture(page:Page,blockers:string[]=[]) {
 await fixture(page,true);const requests:any[]=[];let deleted=false,failDelete=false,version='a'.repeat(64);
 const account={id:91,firstName:'Fixture',lastName:'Applicant',email:'applicant@example.test',createdAt:'2026-11-01',lastActivityAt:'2026-11-02',stage:{key:'created',rank:0,label:'Account created · not started'},drafts:[],applications:[]};
 await page.route('**/api/onboarding/applicants**',async route=>{
  const path=new URL(route.request().url()).pathname;
  if(path.endsWith('/deletion-preview'))return route.fulfill({json:{user:{id:91,name:'Fixture Applicant',email:account.email},counts:{drafts:1,applications:0,documents:2},blockers,version}});
  if(route.request().method()==='DELETE'){
   requests.push(route.request().postDataJSON());
   if(failDelete)return route.fulfill({status:409,json:{error:'This account changed after the preview. Refresh the preview before deleting.'}});
   deleted=true;return route.fulfill({json:{success:true,message:'Applicant account and applications deleted. Uploaded documents are queued for cleanup.'}});
  }
  return route.fulfill({json:{accounts:deleted?[]:[account]}});
 });
 await page.goto('/admin/applicants');await page.getByText('Fixture Applicant',{exact:true}).click();
 return {requests,setFailure:(value:boolean)=>{failDelete=value;version='b'.repeat(64);}};
}
for(const width of [390,1280])test(`admin can review, cancel and confirm applicant deletion at ${width}px`,async({page})=>{
 await page.setViewportSize({width,height:844});const {requests}=await applicantDeletionFixture(page);
 await page.getByRole('button',{name:'Delete account',exact:true}).click();const dialog=page.getByRole('dialog');
 await expect(dialog).toContainText('1 saved applications · 0 submitted applications · 2 uploaded documents');
 const remove=dialog.getByRole('button',{name:'Permanently delete account'});await expect(remove).toBeDisabled();
 await dialog.getByRole('button',{name:'Cancel',exact:true}).click();await expect(dialog).not.toBeVisible();expect(requests).toHaveLength(0);
 await page.getByRole('button',{name:'Delete account',exact:true}).click();
 await dialog.getByLabel('Reason for deletion').fill('Duplicate test account');
 await dialog.getByLabel('Enter the applicant email to confirm').fill('someone-else@example.test');await expect(remove).toBeDisabled();
 await dialog.getByLabel('Enter the applicant email to confirm').fill('applicant@example.test');await expect(remove).toBeEnabled();
 await remove.click();await expect(dialog).not.toBeVisible();await expect(page.getByText('0 applicant accounts',{exact:true})).toBeVisible();
 expect(requests).toEqual([{version:'a'.repeat(64),reason:'Duplicate test account',confirmationEmail:'applicant@example.test'}]);
});
test('admin sees linked-record blockers and cannot delete a protected applicant',async({page})=>{
 const {requests}=await applicantDeletionFixture(page,['This account has a signed contract. Its contract and client records require review before removal.']);
 await page.getByRole('button',{name:'Delete account',exact:true}).click();const dialog=page.getByRole('dialog');
 await expect(dialog.getByRole('alert')).toContainText('signed contract');await expect(dialog.getByRole('button',{name:'Permanently delete account'})).toBeDisabled();
 await expect(dialog.getByLabel('Reason for deletion')).toHaveCount(0);expect(requests).toHaveLength(0);
});
test('stale applicant deletion keeps the account visible and lets admin refresh the preview',async({page})=>{
 const {requests,setFailure}=await applicantDeletionFixture(page);
 await page.getByRole('button',{name:'Delete account',exact:true}).click();const dialog=page.getByRole('dialog');
 await dialog.getByLabel('Reason for deletion').fill('Duplicate');await dialog.getByLabel('Enter the applicant email to confirm').fill('applicant@example.test');
 setFailure(true);await dialog.getByRole('button',{name:'Permanently delete account'}).click();
 await expect(dialog.getByRole('alert')).toContainText('changed after the preview');await expect(page.locator('article')).toContainText('Fixture Applicant');
 setFailure(false);await dialog.getByRole('button',{name:'Refresh preview'}).click();await dialog.getByRole('button',{name:'Permanently delete account'}).click();
 await expect(dialog).not.toBeVisible();expect(requests.map(r=>r.version)).toEqual(['a'.repeat(64),'b'.repeat(64)]);
});

test('visible onboarding fields use scroll-free mouse focus while preserving selection, labels and keyboard access',async({page})=>{
 await page.setViewportSize({width:1280,height:844});await fixture(page);
 await page.addInitScript(()=>{
  const original=HTMLElement.prototype.focus;(window as any).__fieldFocus=[];
  HTMLElement.prototype.focus=function(options){if(this instanceof HTMLInputElement)(window as any).__fieldFocus.push({name:this.name,preventScroll:options?.preventScroll===true});return original.call(this,options);};
 });
 await page.goto('/onboarding?start=1');const form=page.locator('form');await form.getByRole('button',{name:'3. Secure information',exact:true}).click();
 const bank=form.locator('input[name=bankName]');await bank.evaluate(el=>el.scrollIntoView({block:'center',behavior:'instant'}));
 let box=(await bank.boundingBox())!;await page.mouse.click(box.x+30,box.y+box.height/2);await bank.pressSequentially('Fixture bank');
 expect(await page.evaluate(()=>(window as any).__fieldFocus)).toContainEqual({name:'bankName',preventScroll:true});
 await bank.press('ControlOrMeta+A');await expect(bank).toBeFocused();expect(await bank.evaluate(el=>el.selectionEnd! - el.selectionStart!)).toBe(12);
 await form.getByText('Bank Name *',{exact:true}).click();await expect(bank).toBeFocused();
 await bank.press('Tab');await expect(form.getByRole('combobox',{name:'Tax Classification *',exact:true})).toBeFocused();
 const routing=form.locator('input[name=routingNumber]');await routing.evaluate(el=>el.scrollIntoView({block:'center',behavior:'instant'}));box=(await routing.boundingBox())!;
 await page.mouse.click(box.x+30,box.y+box.height/2);await expect(routing).toBeFocused();
 expect(await page.evaluate(()=>(window as any).__fieldFocus)).toContainEqual({name:'routingNumber',preventScroll:true});
});

test('admin can remove a signed onboarding submission without deleting its account or contract',async({page})=>{
 const {writes}=await fixture(page,true);let removed=false;
 await page.route('**/api/onboarding/submissions**',async route=>{
  const path=new URL(route.request().url()).pathname;
  if(path==='/api/onboarding/submissions/7'&&route.request().method()==='DELETE'){writes.push({path,method:'DELETE',body:route.request().postDataJSON()});removed=true;return route.fulfill({json:{success:true,message:'Removed'}});}
  if(path==='/api/onboarding/submissions')return route.fulfill({json:{success:true,data:removed?[]:[{id:7,firstNameOwner:'Test',lastNameOwner:'Owner',emailOwner:'owner@example.test',vehicleMake:'Honda',vehicleModel:'Accord',status:'approved',contractStatus:'signed',createdAt:'2026-11-03'}],pagination:{page:1,total:removed?0:1,totalPages:1,limit:10}}});
  return route.fallback();
 });
 await page.goto('/admin/forms?section=client-onboarding&item=lyc');
 await page.getByRole('button',{name:'Delete application for Test Owner',exact:true}).click();const dialog=page.getByRole('dialog',{name:'Delete application'});
 await expect(dialog).toContainText('Signed contracts, receipts and linked client or vehicle records are retained');
 await expect(dialog.getByRole('button',{name:'Confirm delete application'})).toBeDisabled();
 await dialog.getByLabel('Reason for deletion').fill('Test submission');await dialog.getByRole('button',{name:'Confirm delete application'}).click();
 await expect(dialog).not.toBeVisible();await expect(page.getByRole('button',{name:'Delete application for Test Owner',exact:true})).toHaveCount(0);
 expect(writes.filter(w=>w.method==='DELETE')).toEqual([{path:'/api/onboarding/submissions/7',method:'DELETE',body:{version:'a'.repeat(64),reason:'Test submission'}}]);
});

test('Operations defaults to Day Schedule with no Trips Overview and keeps legacy links working',async({page})=>{
 await fixture(page,true);await page.goto('/admin/operations');
 await expect(page.getByText('TRIPS OVERVIEW',{exact:true})).toHaveCount(0);
 const nav=page.getByRole('link',{name:'Day Schedule',exact:true});await expect(nav.first()).toBeVisible();
 await expect(page.getByRole('link',{name:'Trips Overview',exact:true})).toHaveCount(0);
 expect(await nav.first().evaluate(el=>el.parentElement?.textContent)).toContain('Day Schedule');
 await page.goto('/admin/operations?tab=trips');await expect(page).toHaveURL(/tab=day-schedule/);
});

test('clients can open Forms from their applications and load their drop-off vehicle picker',async({page})=>{
 await fixture(page,'client');
 await page.route('**/api/client/cars?for=onboarding',route=>route.fulfill({json:{success:true,data:[{id:88,makeModel:'Fixture vehicle',year:2026,plateNumber:'FIXTURE',carStatus:'off_fleet'}]}}));
 await page.goto('/lyc/status');
 await page.getByRole('link',{name:'Forms',exact:true}).click();
 await expect(page).toHaveURL(/\/admin\/forms$/);
 await page.goto('/admin/forms?section=client-onboarding&item=car-on');
 await expect(page.getByText('Vehicle drop-off form',{exact:true})).toBeVisible();
 await expect(page.getByText('We could not check which vehicles are ready for drop-off.')).toHaveCount(0);
 await page.getByRole('combobox',{name:'Select Your Car *',exact:true}).click();
 await expect(page.getByRole('option',{name:/Fixture vehicle/})).toBeVisible();
});

test('admin client view can read application progress without offering personal application writes',async({page})=>{
 await fixture(page,'client');
 await page.route('**/api/auth/me',route=>route.fulfill({json:{user:{id:7,firstName:'Test',lastName:'Client',email:'owner@example.test',isClient:true,isAdmin:false,isApplicant:false,viewAsClient:{clientId:12}}}}));
 await page.route('**/api/lyc/applications',route=>route.fulfill({json:{drafts:[],applications:[{id:44,vehicle:'Fixture vehicle',vin:'FIXTURE',status:'approved',steps:[{label:'Application submitted',done:true},{label:'Application approved',done:true},{label:'Contract sent',done:true},{label:'Contract signed',done:true},{label:'Vehicle drop-off',done:false}],canDropOff:true}]}}));
 await page.goto('/lyc/status');
 await expect(page.getByRole('heading',{name:'Fixture vehicle'})).toBeVisible();
 await expect(page.getByText('Viewing this client’s applications and profile.',{exact:false})).toBeVisible();
 await expect(page.getByRole('link',{name:'Forms',exact:true})).toBeVisible();
 await expect(page.getByRole('link',{name:'Start another application'})).toHaveCount(0);
 await page.getByRole('link',{name:'Complete vehicle drop-off form'}).click();
 await expect(page).toHaveURL(/\/admin\/forms\?section=client-onboarding&item=car-on$/);
});

test('an already approved missing vehicle has an explicit retry-safe recovery action',async({page})=>{
 const {submission,workflow,writes}=await fixture(page,true);submission.status='approved';workflow.clientId=12;
 await page.goto('/admin/forms?section=client-onboarding&item=lyc');await page.getByRole('button',{name:'Review & edit application',exact:true}).click();
 const panel=page.getByRole('region',{name:'Onboarding review workflow'});
 await panel.getByRole('button',{name:'Restore approved vehicle',exact:true}).click();
 await panel.getByRole('button',{name:'Confirm create vehicle record',exact:true}).click();
 await expect(panel.getByRole('link',{name:'Open vehicle record'})).toHaveAttribute('href','/admin/cars/88');
 expect(writes.filter(w=>w.path.includes('create-vehicle'))).toHaveLength(1);
});
