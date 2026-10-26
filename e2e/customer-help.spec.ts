import { expect, test, type Page } from '@playwright/test';

const frameId = '#gla-ghl-native-chat-frame';
const nativeFrame = (page: Page) => page.frameLocator(frameId);
const launcher = (page: Page) => nativeFrame(page).getByRole('button', {name:'Select to open the chat widget',exact:true});
const providerUrl = 'https://widgets.leadconnectorhq.com/loader.js';

async function blank(page: Page) {
  await page.route('**/__chat_test__',r=>r.fulfill({contentType:'text/html',body:'<!doctype html><html><body></body></html>'}));
  await page.goto('/__chat_test__');
}
async function mountRouteHarness(page: Page) {
  await blank(page);
  await page.evaluate(async () => {
    const load = (path:string) => import(/* @vite-ignore */ path);
    const refresh = (await load('/@react-refresh')).default;
    refresh.injectIntoGlobalHook(window);
    Object.assign(window, {$RefreshReg$:()=>{}, $RefreshSig$:()=>(type:unknown)=>type, __vite_plugin_react_preamble_installed__:true});
    await load('/e2e/customer-help-harness.tsx');
  });
}
async function navigateAs(page: Page, path:string, user:object|null) {
  await page.evaluate(({path,user})=>{
    (window as any).chatTestCache.setQueryData(['/api/auth/me'],{user});
    history.pushState({},'',path);
    dispatchEvent(new PopStateEvent('popstate'));
  },{path,user});
}

// Fixture of the provider's documented loaded event/isActive API, not a real bot.
async function fixtureProvider(page:Page, fail=false) {
  let requests=0;
  await page.route(providerUrl,route=>{
    requests++;
    if(fail) return route.abort();
    return route.fulfill({contentType:'text/javascript',body:`setTimeout(()=>{
      const host=document.createElement('chat-widget');
      const shadow=host.attachShadow({mode:'open'});
      shadow.innerHTML='<button aria-label="Select to open the chat widget" style="position:fixed;right:20px;bottom:20px;width:58px;height:58px">Fixture only</button><div hidden style="position:fixed;right:20px;bottom:90px;width:300px;height:450px">Provider fixture panel</div>';
      let active=false;
      shadow.querySelector('button').onclick=()=>{active=!active;shadow.querySelector('div').hidden=!active;host.setAttribute('data-active',String(active));};
      window.leadConnector={chatWidget:{isActive:()=>active}};
      document.body.append(host);
      window.dispatchEvent(new CustomEvent('LC_chatWidgetLoaded',{detail:host}));
    },100);`});
  });
  return ()=>requests;
}

async function mockPublicApi(page:Page) {
  await page.route(url=>url.pathname.startsWith('/api/'),r=>r.fulfill({json:{success:true,data:[],isPublic:true,user:null}}));
}

test('approved production configuration starts one clean native frame without preview flags',async({page})=>{
  const count=await fixtureProvider(page);
  await mockPublicApi(page);
  await page.goto('/contact');
  await expect(page.locator('body')).toContainText('Contact',{timeout:20000});
  await expect(launcher(page)).toBeVisible();
  await expect(page.locator(frameId)).toHaveCount(1);
  await expect(page.locator(frameId)).toHaveAttribute('src','/gla-help/frame.html');
  await expect(page.locator(frameId)).toHaveAttribute('referrerpolicy','no-referrer');
  await expect(page.locator('chat-widget')).toHaveCount(0);
  await expect(page.locator('script[src="'+providerUrl+'"]')).toHaveCount(0);
  await expect(nativeFrame(page).locator('#gla-ghl-native-chat-script')).toHaveAttribute('data-widget-id','6adbf3186c0798678b00aa14');
  expect(count()).toBe(1);
});

test('role-aware navigation hides the whole native frame and reuses one provider load (fixture)',async({page})=>{
  const count=await fixtureProvider(page);
  await mountRouteHarness(page);
  await navigateAs(page,'/contact?glaChatPreview=1',null);
  await expect(page.locator(frameId)).toHaveAttribute('referrerpolicy','no-referrer');
  await navigateAs(page,'/admin/operations',{isAdmin:true});
  await expect(nativeFrame(page).locator('chat-widget')).toHaveCount(1);
  await expect(page.locator(frameId)).toBeHidden();
  for(const [path,user] of [
    ['/contact',null], ['/admin/cars/7/records',{isClient:true}],
    ['/admin/my-co-host-cars',{isCoHost:true,isAdmin:true}],
    ['/admin/operations?tab=maintenance',{isCoHost:true,isAdmin:true}],
    ['/admin/profile',{isCoHost:true,isAdmin:true}],
    ['/admin/operations?tab=service-due',{isClient:true,isAdmin:true}],
  ] as const){
    await navigateAs(page,path,user);
    await expect(page.locator(frameId)).toBeVisible();
    await expect(launcher(page)).toBeVisible();
  }
  await launcher(page).click();
  await expect(nativeFrame(page).getByText('Provider fixture panel')).toBeVisible();
  for(const [path,user] of [
    ['/admin/operations',{isAdmin:true}], ['/admin/profile',{isAdmin:true}],
    ['/admin/operations?tab=payroll',{isCoHost:true,isAdmin:true}],
    ['/dashboard',{isEmployee:true}], ['/admin/cars/7/records',null],
  ] as const){
    await navigateAs(page,path,user);
    await expect(page.locator(frameId)).toBeHidden();
  }
  await navigateAs(page,'/admin/operations?tab=claims',{isCoHost:true,isAdmin:true});
  await expect(page.locator(frameId)).toBeVisible();
  await expect(nativeFrame(page).getByText('Provider fixture panel')).toBeVisible();
  await navigateAs(page,'/contact?glaChatPreview=0',null);
  await expect(page.locator(frameId)).toBeVisible(); // Production cannot be disabled by a preview flag.
  await navigateAs(page,'/admin/hr/time',{isAdmin:true});
  await expect(page.locator(frameId)).toBeHidden();
  expect(count()).toBe(1);
  await expect(page.locator(frameId)).toHaveCount(1);
});

test('provider failure stays hidden without navigation retries (fixture)',async({page})=>{
  const count=await fixtureProvider(page,true);
  await mountRouteHarness(page);
  await navigateAs(page,'/contact?glaChatPreview=1',null);
  await expect.poll(count).toBe(1);
  await expect(page.locator(frameId)).toBeHidden();
  await navigateAs(page,'/contact?glaChatPreview=0',null);
  await navigateAs(page,'/contact?glaChatPreview=1',null);
  await expect(page.locator(frameId)).toBeHidden();
  expect(count()).toBe(1);
});

test('untrusted bridge messages cannot open or inject the widget',async({page})=>{
  await fixtureProvider(page);
  await mountRouteHarness(page);
  await navigateAs(page,'/contact?glaChatPreview=1',null);
  await expect(launcher(page)).toBeVisible();
  await page.evaluate(()=>window.postMessage({type:'gla:help:state',active:true},location.origin));
  await expect(page.locator(frameId)).toHaveCSS('height','100px');
  await page.evaluate(()=>document.querySelector<HTMLIFrameElement>('#gla-ghl-native-chat-frame')?.contentWindow?.postMessage({type:'gla:help:config',config:{scriptUrl:'https://evil.example/test.js',attributes:{}}},location.origin));
  await expect(nativeFrame(page).locator('script[src="https://evil.example/test.js"]')).toHaveCount(0);
});

test('public teaser waits five seconds, fits mobile, dismisses and stays gone after reload (fixture)',async({page})=>{
  await page.setViewportSize({width:390,height:400});
  const count=await fixtureProvider(page);
  await mockPublicApi(page);
  // Record actual provider-readiness and invitation times without changing timers.
  await page.addInitScript(()=>{
    const times=(window as any).teaserTimes={ready:0,shown:0};
    addEventListener('message',e=>{
      const frame=document.querySelector<HTMLIFrameElement>('#gla-ghl-native-chat-frame');
      if(e.source===frame?.contentWindow&&e.origin===location.origin&&e.data?.type==='gla:help:state'&&!times.ready)times.ready=performance.now();
    });
    new MutationObserver(()=>{
      if(document.querySelector('#gla-customer-help-teaser')&&!times.shown)times.shown=performance.now();
    }).observe(document,{childList:true,subtree:true});
  });
  await page.goto('/contact');
  await expect(launcher(page)).toBeVisible();
  const teaser=page.getByRole('complementary',{name:'GLA help suggestion'});
  await expect(teaser).toHaveCount(0);
  await expect(teaser).toBeVisible({timeout:8000});
  await expect(teaser).toContainText('Have questions? I can answer them.');
  const delay=await page.evaluate(()=>{
    const t=(window as any).teaserTimes;return t.shown-t.ready;
  });
  expect(delay).toBeGreaterThanOrEqual(4900); // Allow browser measurement rounding.
  await expect(page.locator(frameId)).toHaveCSS('height','100px'); // No auto-open.
  const box=(await teaser.boundingBox())!;
  const button=(await launcher(page).boundingBox())!;
  expect(box.x).toBeGreaterThanOrEqual(0);
  expect(box.y).toBeGreaterThanOrEqual(0);
  expect(box.x+box.width).toBeLessThanOrEqual(390);
  expect(box.y+box.height).toBeLessThanOrEqual(button.y);
  await page.screenshot({path:test.info().outputPath('teaser-mobile.png')});
  await page.getByRole('button',{name:'Dismiss help message'}).click();
  await expect(teaser).toHaveCount(0);
  await page.reload();
  await expect(launcher(page)).toBeVisible();
  await page.waitForTimeout(5500);
  await expect(teaser).toHaveCount(0);
  expect(count()).toBe(2); // Exactly one load per full page, none from dismissal.
});

test('teaser cancels on account routes, never prompts sensitive pages and disappears on native open (fixture)',async({page})=>{
  const count=await fixtureProvider(page);
  await mountRouteHarness(page);
  await navigateAs(page,'/contact',null);
  await expect(launcher(page)).toBeVisible();
  await navigateAs(page,'/admin/cars/7/records',{isClient:true});
  await page.waitForTimeout(5500);
  await expect(page.locator('#gla-customer-help-teaser')).toHaveCount(0);
  // A forbidden page must not consume the session's invitation.
  expect(await page.evaluate(()=>sessionStorage.getItem('gla-help-teaser-seen-v1'))).toBeNull();
  await navigateAs(page,'/fleet',null);
  await expect(page.locator('#gla-customer-help-teaser')).toBeVisible({timeout:8000});
  await launcher(page).click();
  await expect(page.locator('#gla-customer-help-teaser')).toHaveCount(0);
  await launcher(page).click();
  await navigateAs(page,'/contact',null);
  await page.waitForTimeout(5500);
  await expect(page.locator('#gla-customer-help-teaser')).toHaveCount(0);
  expect(count()).toBe(1);
});

test('opening chat before the delay suppresses the teaser for this session (fixture)',async({page})=>{
  await fixtureProvider(page);
  await mountRouteHarness(page);
  await navigateAs(page,'/contact',null);
  await expect(launcher(page)).toBeVisible();
  await launcher(page).click();
  await expect(nativeFrame(page).getByText('Provider fixture panel')).toBeVisible();
  await launcher(page).click();
  await page.waitForTimeout(5500);
  await expect(page.locator('#gla-customer-help-teaser')).toHaveCount(0);
  expect(await page.evaluate(()=>sessionStorage.getItem('gla-help-teaser-seen-v1'))).toBe('1');
});

test('real native widget: menu, one load, hiding and desktop/mobile placement',async({page})=>{
  test.skip(process.env.GHL_REAL_WIDGET_TEST!=='1','Opt-in real provider; never substitute the fixture.');
  test.setTimeout(60000);
  await mockPublicApi(page);
  let loads=0;page.on('request',r=>{if(r.url()===providerUrl)loads++;});
  await page.goto('/contact?glaChatPreview=1');
  await expect(launcher(page)).toBeVisible({timeout:15000});
  await expect(page.locator('chat-widget')).toHaveCount(0);
  await expect(nativeFrame(page).locator('chat-widget')).toHaveCount(1);
  const assertInside = async(locator:ReturnType<Page['locator']>)=>{
    const box=(await locator.boundingBox())!;const viewport=page.viewportSize()!;
    expect(box.x).toBeGreaterThanOrEqual(0);expect(box.y).toBeGreaterThanOrEqual(0);
    expect(box.x+box.width).toBeLessThanOrEqual(viewport.width);
    expect(box.y+box.height).toBeLessThanOrEqual(viewport.height);
  };
  await assertInside(launcher(page));
  const bubble=(await launcher(page).boundingBox())!;const viewport=page.viewportSize()!;
  expect(viewport.width-bubble.x-bubble.width).toBeLessThan(100);
  expect(viewport.height-bubble.y-bubble.height).toBeLessThan(100);
  await page.screenshot({path:test.info().outputPath('native-desktop.png')});
  await launcher(page).click();
  await expect(nativeFrame(page).getByText('GLA AI Help',{exact:true})).toBeVisible();
  await expect(nativeFrame(page).getByText(/1\. Book a car/)).toBeVisible();
  await expect(nativeFrame(page).getByText(/4\. Other/)).toBeVisible();
  await expect(page.locator(frameId)).not.toHaveCSS('height','100px');
  await page.screenshot({path:test.info().outputPath('native-open.png')});
  // Exercise the native frame lifecycle directly; preview flags intentionally
  // cannot disable the approved production config. Role gating is covered above.
  const toggle=async(enabled:boolean)=>page.evaluate(async enabled=>{
    const path='/src/lib/ghlNativeWidget.ts';
    const widget=await import(/* @vite-ignore */ path);
    widget.updateGhlNativeWidget(document,widget.GHL_NATIVE_WIDGET_CONFIG,enabled);
  },enabled);
  await toggle(false);await expect(page.locator(frameId)).toBeHidden();
  await toggle(true);await expect(page.locator(frameId)).toBeVisible();
  for(const size of [{width:390,height:844},{width:390,height:667},{width:390,height:400}]){
    await page.setViewportSize(size);
    await assertInside(page.locator(frameId));
    await expect(nativeFrame(page).getByPlaceholder('Type a message')).toBeVisible();
    await assertInside(nativeFrame(page).getByPlaceholder('Type a message'));
    await expect.poll(()=>nativeFrame(page).getByRole('heading',{name:'GLA AI Help',exact:true}).evaluate(element=>{
      const outside:{tag:string;className:string;top:number;left:number;right:number;bottom:number;viewport:number[]}[]=[];
      for(let node:Element|null=element;node;node=node.parentElement){
        const r=node.getBoundingClientRect();
        if(r.width>0&&r.height>0&&(r.top < -1||r.left < -1||r.right > innerWidth+1||r.bottom > innerHeight+1))outside.push({tag:node.tagName,className:node.className,top:r.top,left:r.left,right:r.right,bottom:r.bottom,viewport:[innerWidth,innerHeight]});
      }
      return outside;
    })).toEqual([]);
  }
  await page.screenshot({path:test.info().outputPath('native-mobile-open.png')});
  await nativeFrame(page).getByRole('button',{name:'Select to close the chat widget',exact:true}).first().click();
  await expect(page.locator(frameId)).toHaveCSS('height','100px');
  await assertInside(launcher(page));
  expect(loads).toBe(1);
});

test('real native widget never attributes the surrounding private route token',async({page})=>{
  test.skip(process.env.GHL_REAL_WIDGET_TEST!=='1','Opt-in real provider.');
  test.setTimeout(60000);
  await mockPublicApi(page);
  await page.route('**/contracts/*.pdf',r=>r.fulfill({status:404,body:''}));
  const marker='GLA_FAKE_PRIVATE_ROUTE_TOKEN_20261024';
  const leaks:{method:string;host:string;path:string}[]=[];
  page.on('request',r=>{
    const u=new URL(r.url());if(u.hostname==='127.0.0.1'||u.protocol==='data:')return;
    let payload=[r.url(),r.postData()||'',JSON.stringify(r.headers())].join('\n');
    for(let i=0;i<2;i++){try{payload=decodeURIComponent(payload)}catch{break}}
    if(payload.includes(marker))leaks.push({method:r.method(),host:u.hostname,path:u.pathname});
  });
  for(const path of [`/sign-contract/${marker}`,`/maintenance-approval/${marker}`,`/reset-password?token=${marker}`]){
    await page.goto(`${path}${path.includes('?')?'&':'?'}glaChatPreview=1`);
    await expect(launcher(page)).toBeVisible({timeout:15000});
    await expect.poll(async()=>page.frames().find(f=>f.url().endsWith('/gla-help/frame.html'))?.evaluate(()=>document.referrer)).toBe('');
    await launcher(page).click();
    await expect(nativeFrame(page).getByText('GLA AI Help',{exact:true})).toBeVisible();
    // Include delayed native attribution/session updates; no message is sent.
    await page.waitForTimeout(1000);
  }
  await test.info().attach('private-route-disclosures',{body:JSON.stringify(leaks,null,2),contentType:'application/json'});
  expect(leaks).toEqual([]);
});
