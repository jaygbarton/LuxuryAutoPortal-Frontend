import {test,expect,type Page} from '@playwright/test';
const cars = (offset:number) => Array.from({length:3},(_,i)=>({id:offset+i,makeModel:`Ranked vehicle ${offset+i}`,make:'Ranked',model:`vehicle ${offset+i}`,year:2026,photo:null,numberOfSeats:5,turoLink:`https://turo.com/us/en/suv-rental/united-states/salt-lake-city-ut/test/${100000+offset+i}`,locationTag:'slc'}));
async function setup(page:Page) {
  const errors:string[]=[];page.on('pageerror',e=>errors.push(e.message));
  await page.route('**/api/public/fleet/featured?*',route=>route.fulfill({json:{success:true,data:cars(new URL(route.request().url()).searchParams.get('mode')==='previous-month'?4:1)}}));
  await page.route('https://images.unsplash.com/**',route=>route.abort());
  await page.goto('/e2e/fixtures/featured-cars.html');
  return errors;
}
async function expectCardsVisible(page:Page,offset:number) {
  for(let i=0;i<3;i++) {
    const heading=page.getByRole('heading',{name:`Ranked vehicle ${offset+i}`,exact:true});
    await heading.scrollIntoViewIfNeeded();
    await expect(heading).toBeVisible();
    // Playwright's toBeVisible does not catch opacity:0 on an ancestor.
    await expect.poll(()=>heading.evaluate(el=>{
      let opacity=1;
      for(let node:Element|null=el;node;node=node.parentElement)opacity*=Number(getComputedStyle(node).opacity);
      return opacity;
    })).toBeGreaterThan(0.99);
  }
}
for(const width of [390,1280])test(`featured cards stay painted when changing ranking tabs at ${width}px`,async({page})=>{
  await page.setViewportSize({width,height:844});const errors=await setup(page);
  await expectCardsVisible(page,1);
  for(let i=0;i<3;i++) {
    await page.getByRole('button',{name:'Top Last Month',exact:true}).click();await expectCardsVisible(page,4);
    await page.getByRole('button',{name:/^Top (2026|Vehicles)$/,exact:true}).click();await expectCardsVisible(page,1);
  }
  expect(errors).toEqual([]);
});

test('a slow ranking response cannot replace the currently selected ranking',async({page})=>{
  await setup(page);await expectCardsVisible(page,1);
  let release!:()=>void;const wait=new Promise<void>(resolve=>{release=resolve;});let requested=false;
  await page.route('**/api/public/fleet/featured?*mode=previous-month*',async route=>{requested=true;await wait;return route.fulfill({json:{success:true,data:cars(4)}});});
  await page.getByRole('button',{name:'Top Last Month',exact:true}).click();
  await expect.poll(()=>requested).toBe(true);
  await expect(page.getByRole('status',{name:'Loading featured vehicles'})).toBeVisible();
  await page.getByRole('button',{name:'Top Vehicles',exact:true}).click();await expectCardsVisible(page,1);
  release();await expectCardsVisible(page,1);
  await page.getByRole('button',{name:'Top Last Month',exact:true}).click();await expectCardsVisible(page,4);
});

test('a failed ranking request has a retry and a legitimate empty selection has a fleet link',async({page})=>{
  await setup(page);await expectCardsVisible(page,1);
  let fail=true;
  await page.route('**/api/public/fleet/featured?*mode=previous-month*',route=>fail?route.fulfill({status:503,json:{success:false}}):route.fulfill({json:{success:true,data:cars(4)}}));
  await page.getByRole('button',{name:'Top Last Month',exact:true}).click();
  await expect(page.getByRole('alert')).toContainText('could not be loaded');
  fail=false;await page.getByRole('button',{name:'Try again',exact:true}).click();await expectCardsVisible(page,4);
  await page.route('**/api/public/fleet/featured?*',route=>route.fulfill({json:{success:true,data:[]}}));
  await page.reload();await expect(page.getByText('This ranking is not available yet.',{exact:false})).toBeVisible();
  await expect(page.getByRole('link',{name:'Explore the Salt Lake City, UT collection.'})).toHaveAttribute('href','/salt-lake-city/fleet');
});

test('rankings do not poll or refetch on focus during the day and refresh once on Denver day rollover',async({page})=>{
  await page.clock.install({time:new Date('2026-11-09T15:00:00Z')});
  let requests=0;
  await setup(page);await expectCardsVisible(page,1);
  await page.route('**/api/public/fleet/featured?*',route=>{
    expect(new URL(route.request().url()).searchParams.get('location')).toBe('slc');requests++;
    return route.fulfill({json:{success:true,data:cars(10)}});
  });
  await page.clock.fastForward(15*60*1000);
  await page.evaluate(()=>{window.dispatchEvent(new Event('focus'));document.dispatchEvent(new Event('visibilitychange',{bubbles:true}));});
  await page.clock.fastForward(14*60*60*1000);
  expect(requests).toBe(0);await expectCardsVisible(page,1);
  await page.clock.fastForward(2*60*60*1000);
  await expect.poll(()=>requests).toBe(1);await expectCardsVisible(page,10);
  await page.evaluate(()=>window.dispatchEvent(new Event('focus')));
  expect(requests).toBe(1);
});

for(const width of [390,1280])test(`fallback rankings show the actual earlier month at ${width}px`,async({page})=>{
 await page.setViewportSize({width,height:844});await setup(page);await expectCardsVisible(page,1);
 await page.route('**/api/public/fleet/featured?*mode=previous-month*',route=>{
  expect(new URL(route.request().url()).searchParams.get('v')).toBe('month-fallback');
  return route.fulfill({json:{success:true,data:cars(4).map(car=>({...car,performancePeriod:{year:2025,month:12}}))}});
 });
 await page.getByRole('button',{name:'Top Last Month',exact:true}).click();
 await expectCardsVisible(page,4);await expect(page.locator('#featured-fleet')).toContainText('Our top-performing vehicles for December 2025');
 await page.getByRole('button',{name:'Top Vehicles',exact:true}).click();
 await expectCardsVisible(page,1);await expect(page.locator('#featured-fleet')).not.toContainText('December 2025');
 await page.getByRole('button',{name:'Top Last Month',exact:true}).click();
 await expectCardsVisible(page,4);await expect(page.locator('#featured-fleet')).toContainText('December 2025');
});
