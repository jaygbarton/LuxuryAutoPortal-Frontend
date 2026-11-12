import { test, expect, type Page } from "@playwright/test";

const CONSULTATION = "https://rent.goldenluxuryauto.com/book-a-call-lyc";
const cars = [
  { id: 1, make: "Cadillac", makeModel: "Cadillac Escalade", year: 2026, numberOfSeats: 7, photo: "/homepage-hero-escalade.jpg", locationTag: "slc", performanceIncome: 200, turoLink: "https://turo.com/us/en/suv-rental/united-states/salt-lake-city-ut/escalade/123456" },
  { id: 2, make: "Subaru", makeModel: "Subaru Outback", year: 2022, numberOfSeats: 5, photo: "/rent-a-car-interior.jpg", locationTag: "slc", performanceIncome: 300, turoLink: "https://turo.com/us/en/suv-rental/united-states/salt-lake-city-ut/outback/123457" },
  { id: 3, make: "Toyota", makeModel: "Toyota Camry", year: 2025, numberOfSeats: 5, photo: "/homepage-hero-escalade.jpg", locationTag: "slc", performanceIncome: 100, turoLink: "https://turo.com/us/en/car-rental/united-states/salt-lake-city-ut/camry/123458" },
  { id: 4, make: "Honda", makeModel: "Honda Accord", year: 2024, numberOfSeats: 5, photo: "/rent-a-car-interior.jpg", locationTag: "wilmington", turoLink: "https://turo.com/us/en/car-rental/united-states/wilmington-nc/accord/123459" },
];

async function publicFixtures(page: Page) {
  const origin = new URL(test.info().project.use.baseURL!).origin;
  await page.route("**/*", async route => {
    const url = new URL(route.request().url());
    if (url.origin !== origin) return route.abort();
    // Vite also serves modules under /src/lib/api/; only mock server endpoints.
    if (!url.pathname.startsWith("/api/")) return route.continue();
    if (url.pathname === "/api/public-page-status") return route.fulfill({ json: { isPublic: true, canPreview: false } });
    if (url.pathname.startsWith("/api/auth/")) return route.fulfill({ status: 401, json: { message: "Not signed in" } });
    if (["/api/public/fleet", "/api/public/fleet/featured"].includes(url.pathname)) return route.fulfill({ json: { success: true, data: cars } });
    return route.fulfill({ json: [] });
  });
}

for (const width of [390, 1440]) {
  test(`one owner page preserves funnel links, booking and program video at ${width}px`, async ({ page }) => {
    await page.setViewportSize({ width, height: 900 });
    await publicFixtures(page);
    for (const location of ["salt-lake-city", "wilmington-nc"]) {
      await page.goto(`/${location}`);
      await expect(page.getByTestId("button-hero-owner")).toHaveAttribute("href", `/${location}/onboarding`);
      await expect(page.getByTestId("button-cta-get-started")).toHaveAttribute("href", `/${location}/onboarding`);
      await expect(page.locator('nav a', { hasText: "List Your Car" }).first()).toHaveAttribute("href", `/${location}/onboarding`);
      await expect(page.locator('footer').getByRole('link', { name: 'List Your Car', exact: true })).toHaveAttribute('href', `/${location}/onboarding`);
      await page.getByTestId("button-hero-owner").click();
      await expect(page).toHaveURL(new RegExp(`/${location}/onboarding$`));
      await expect(page.getByRole("heading", { level: 1 })).toContainText("Let us manage");
      await expect(page.getByRole("link", { name: "Book a consultation", exact: true })).toHaveAttribute("href", CONSULTATION);
      await expect(page.getByRole("link", { name: "Book a Free Consulting Appointment" })).toHaveAttribute("href", CONSULTATION);
      await expect(page.getByRole("link", { name: "Watch the Car Sharing Program" })).toHaveAttribute("href", "https://www.youtube.com/watch?v=zyhzeXvCp8U");
      await expect(page.locator('iframe[title="Golden Luxury Auto List Your Car"]')).toHaveAttribute("src", "https://www.youtube.com/embed/zyhzeXvCp8U?start=1");
      await expect(page.getByTestId("button-lyc-get-started")).toHaveAttribute("href", `/${location}/onboarding?start=1`);
      await expect(page.locator('input[type="range"], [data-earnings-calculator]')).toHaveCount(0);
      expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
      await page.screenshot({ path: test.info().outputPath(`owner-${location}-${width}.png`), fullPage: true });
    }
  });

  test(`fleet categories, filters, sorting and original booking links work at ${width}px`, async ({ page }) => {
    await page.setViewportSize({ width, height: 900 });
    await publicFixtures(page);
    await page.goto('/salt-lake-city/fleet');
    const cards = page.locator('[data-fleet-card]');
    await expect(cards).toHaveCount(3);
    for (const car of cars.slice(0, 3)) {
      await expect(cards.filter({ has: page.getByRole('heading', { name: car.makeModel, exact: true }) }).getByRole('link', { name: 'Book Now' })).toHaveAttribute('href', car.turoLink);
    }
    await page.getByRole('button', { name: 'SUV', exact: true }).click();
    await expect(cards).toHaveCount(2);
    await page.getByRole('button', { name: 'All vehicles', exact: true }).click();
    await page.getByRole('textbox', { name: 'Search vehicles' }).fill('Subaru');
    await expect(cards).toHaveCount(1);
    await expect(cards.first()).toContainText('Subaru Outback');
    await page.getByRole('button', { name: 'Clear All', exact: true }).click();
    await page.getByRole('button', { name: 'Filters', exact: true }).click();
    await page.getByText('7', { exact: true }).click();
    await page.keyboard.press('Escape');
    await expect(cards).toHaveCount(1);
    await expect(cards.first()).toContainText('Cadillac Escalade');
    await page.getByRole('button', { name: 'Clear All', exact: true }).click();
    await page.getByRole('combobox', { name: 'Sort' }).click();
    await page.getByRole('option', { name: 'Top Monthly Performing', exact: true }).click();
    await expect(cards.first()).toContainText('Subaru Outback');
    await page.getByRole('combobox', { name: 'Sort' }).click();
    await page.getByRole('option', { name: 'Newest Model Year', exact: true }).click();
    await expect(cards.first()).toContainText('Cadillac Escalade');
    await page.locator('#fleet-list').scrollIntoViewIfNeeded();
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
    await expect(page.locator('[data-fleet-grid] a button')).toHaveCount(0);
    await page.screenshot({ path: test.info().outputPath(`fleet-${width}.png`), fullPage: true });
    await page.goto('/wilmington-nc/fleet');
    await expect(cards).toHaveCount(1);
    await expect(cards.first()).toContainText('Honda Accord');
  });
}

test('extra owner URL redirects to the original page without dropping funnel parameters', async ({ page }) => {
  await publicFixtures(page);
  for (const location of ['salt-lake-city', 'wilmington-nc']) {
    await page.goto(`/${location}/list-your-car?utm_source=fixture&campaign=keep#program`);
    await expect(page).toHaveURL(new RegExp(`/${location}/onboarding\\?utm_source=fixture&campaign=keep#program$`));
    await expect(page.getByTestId('button-lyc-get-started')).toHaveAttribute('href', `/${location}/onboarding?utm_source=fixture&campaign=keep&start=1`);
  }
});

for (const width of [390, 1440]) test(`Cadillac fades as the page scrolls and returns on scroll back at ${width}px`, async ({ page }) => {
  await page.setViewportSize({ width, height: 900 });
  await publicFixtures(page);
  await page.goto('/salt-lake-city');
  const image = page.locator('[data-cadillac-backdrop]');
  await expect(image).toHaveCSS('opacity', '1');
  const height = await page.locator('[data-public-hero]').evaluate(el => el.clientHeight);
  await page.evaluate(y => window.scrollTo({ top: y, behavior: 'instant' }), height * 0.6);
  await expect.poll(() => image.evaluate(el => Number(getComputedStyle(el).opacity))).toBeLessThan(0.6);
  await page.screenshot({ path: test.info().outputPath('cadillac-scroll.png') });
  await page.evaluate(() => window.scrollTo({ top: 0, behavior: 'instant' }));
  await expect(image).toHaveCSS('opacity', '1');
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.evaluate(y => window.scrollTo({ top: y, behavior: 'instant' }), height * 0.6);
  await expect(image).toHaveCSS('opacity', '1');
});

test('initial HTML and delayed page status keep a full-height dark hero during loading', async ({ page }) => {
  await publicFixtures(page);
  let releaseScript!: () => void;
  const scriptWait = new Promise<void>(resolve => { releaseScript = resolve; });
  await page.route('**/src/main.tsx', async route => { await scriptWait; await route.continue(); });
  await page.goto('/salt-lake-city', { waitUntil: 'commit' });
  const initial = page.locator('.initial-page-loader');
  await expect(initial).toBeVisible();
  expect(await initial.evaluate(el => el.getBoundingClientRect().height >= innerHeight)).toBe(true);
  await expect(initial).toHaveCSS('background-color', 'rgb(20, 20, 20)');
  let releaseStatus!: () => void;
  const statusWait = new Promise<void>(resolve => { releaseStatus = resolve; });
  await page.route('**/api/public-page-status?*', async route => { await statusWait; await route.fulfill({ json: { isPublic: true } }); });
  releaseScript();
  const loading = page.locator('[data-public-loading]');
  await expect(loading).toBeVisible();
  await expect(loading).toHaveCSS('background-color', 'rgb(20, 20, 20)');
  expect(await loading.evaluate(el => el.getBoundingClientRect().height >= innerHeight)).toBe(true);
  releaseStatus();
  await expect(page.getByRole('heading', { level: 1 })).toContainText('A remarkable drive');
});

for (const width of [390, 1440, 2048, 3440]) test(`fleet hero keeps the full photograph and adapts to ${width}px`, async ({ page }) => {
  await page.setViewportSize({ width, height: 1000 });
  await publicFixtures(page);
  await page.goto('/salt-lake-city/fleet');
  const image = page.locator('[data-fleet-hero-media] img');
  await expect(image).toHaveCSS('object-fit', 'contain');
  await expect.poll(() => image.evaluate((el: HTMLImageElement) => el.naturalWidth)).toBeGreaterThan(0);
  const geometry = await image.evaluate(el => ({ width: el.getBoundingClientRect().width, height: el.getBoundingClientRect().height }));
  expect(geometry.width).toBeGreaterThan(width >= 1024 ? width * 0.55 : width * 0.95);
  expect(geometry.height).toBeLessThanOrEqual(720);
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  const collection = await page.locator('#fleet-list').boundingBox();
  expect(collection!.width).toBeGreaterThanOrEqual(Math.min(width * 0.9, 1900));
  if (width >= 1536) expect(await page.locator('[data-fleet-grid]').evaluate(el => getComputedStyle(el).gridTemplateColumns.split(' ').length)).toBe(4);
  await expect(page.getByRole('button', { name: 'All vehicles', exact: true })).toHaveCSS('background-color', 'rgb(211, 188, 141)');
  await page.screenshot({ path: test.info().outputPath(`fleet-hero-${width}.png`) });
});

test('fleet cards fade in on scroll and remain painted after filtering and sorting', async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await publicFixtures(page);
  await page.route('**/api/public/fleet', route => route.fulfill({ json: { success: true, data: Array.from({ length: 12 }, (_, i) => ({ ...cars[0], id: 10 + i, makeModel: `Fleet vehicle ${i}` })) } }));
  await page.goto('/salt-lake-city/fleet');
  const first = page.locator('[data-fleet-reveal]').first();
  const last = page.locator('[data-fleet-reveal]').last();
  await expect(first).toHaveCSS('opacity', '0');
  await first.scrollIntoViewIfNeeded();
  await expect(first).toHaveCSS('opacity', '1');
  await expect(last).toHaveCSS('opacity', '0');
  await last.scrollIntoViewIfNeeded();
  await expect(last).toHaveCSS('opacity', '1');
  await page.getByRole('textbox', { name: 'Search vehicles' }).fill('Fleet vehicle 11');
  await page.locator('[data-fleet-reveal]').scrollIntoViewIfNeeded();
  await expect(page.locator('[data-fleet-reveal]')).toHaveCSS('opacity', '1');
  await page.getByRole('button', { name: 'Clear All', exact: true }).click();
  await page.getByRole('combobox', { name: 'Sort' }).click();
  await page.getByRole('option', { name: 'Z-A', exact: true }).click();
  await first.scrollIntoViewIfNeeded();
  await expect(first).toHaveCSS('opacity', '1');
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.reload();
  await expect(page.locator('[data-fleet-reveal]').last()).toHaveCSS('opacity', '1');
});

for (const width of [390, 1595, 2560]) test(`homepage keeps a compact headline and introduction below the hero at ${width}px`, async ({ page }) => {
  await page.setViewportSize({ width, height: 1000 });
  await publicFixtures(page);
  await page.goto('/salt-lake-city');
  const heading = page.getByRole('heading', { level: 1 });
  const metrics = await heading.evaluate(el => ({ height: el.getBoundingClientRect().height, lineHeight: parseFloat(getComputedStyle(el).lineHeight) }));
  expect(metrics.height).toBeLessThanOrEqual(metrics.lineHeight * 2 + 2);
  await expect(page.locator('[data-public-hero]')).not.toContainText('Find a premium vehicle');
  await expect(page.locator('[data-home-intro]')).toContainText('car sharing program');
  await expect(page.getByTestId('button-scroll-down')).toBeVisible();
  await expect(page.getByTestId('button-cta-call')).toHaveAttribute('href', 'tel:+18003461394');
  await page.screenshot({ path: test.info().outputPath(`home-compact-${width}.png`) });
});

for (const width of [390, 1440]) test(`page navigation starts at the top without animating through the old scroll position at ${width}px`, async ({ page }) => {
  await page.setViewportSize({ width, height: 900 });
  await publicFixtures(page);
  await page.addInitScript(() => {
    const samples: { path: string; y: number }[] = [];
    (window as any).__routeScrollSamples = samples;
    let last = location.pathname + location.search;
    function sample() {
      if (location.pathname + location.search !== last) {
        samples.push({ path: location.pathname + location.search, y: window.scrollY });
        last = location.pathname + location.search;
      }
      requestAnimationFrame(sample);
    }
    requestAnimationFrame(sample);
  });
  await page.goto('/salt-lake-city');
  for (const [name, path] of [['Our Fleet', '/salt-lake-city/fleet'], ['List Your Car', '/salt-lake-city/onboarding'], ['Contact Us', '/salt-lake-city/contact'], ['Our Fleet', '/salt-lake-city/fleet']]) {
    await expect(page.locator('footer')).toBeVisible();
    await page.evaluate(() => new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve))));
    await page.evaluate(() => window.scrollTo({ top: document.documentElement.scrollHeight, behavior: 'instant' }));
    expect(await page.evaluate(() => window.scrollY)).toBeGreaterThan(500);
    await page.locator('footer').getByRole('link', { name, exact: true }).click();
    await expect(page).toHaveURL(new RegExp(`${path}$`));
    await expect.poll(() => page.evaluate(() => window.scrollY)).toBe(0);
    await expect.poll(() => page.evaluate(() => (window as any).__routeScrollSamples.at(-1))).toEqual({ path, y: 0 });
  }
  await page.evaluate(() => window.scrollTo({ top: 800, behavior: 'instant' }));
  await page.goBack();
  await expect.poll(() => page.evaluate(() => window.scrollY)).toBe(0);
  await page.goto('/salt-lake-city/onboarding');
  await expect(page.getByTestId('button-lyc-get-started')).toBeVisible();
  await page.evaluate(() => window.scrollTo({ top: document.documentElement.scrollHeight, behavior: 'instant' }));
  await page.getByTestId('button-lyc-get-started').click();
  await expect(page).toHaveURL(/onboarding\?start=1$/);
  await expect.poll(() => page.evaluate(() => (window as any).__routeScrollSamples.at(-1))).toEqual({ path: '/salt-lake-city/onboarding?start=1', y: 0 });
  // Exercise the same central reset against the independently scrolling staff pane.
  const nested = await page.evaluate(async () => {
    const { resetPageScroll } = await import('/src/lib/navigation-scroll.ts');
    const pane = document.createElement('main');
    pane.style.cssText = 'height:100px; overflow:auto; scroll-behavior:smooth';
    const content = document.createElement('div'); content.style.height = '2000px';
    pane.appendChild(content); document.body.appendChild(pane);
    pane.scrollTo({ top: 700, behavior: 'instant' });
    const before = pane.scrollTop;
    resetPageScroll();
    const result = { before, after: pane.scrollTop, scrollBehavior: pane.style.scrollBehavior };
    pane.remove(); return result;
  });
  expect(nested).toEqual({ before: 700, after: 0, scrollBehavior: 'smooth' });
});

for (const width of [390, 2048]) test(`hero stats sit at the bottom and guest reviews crossfade without resizing at ${width}px`, async ({ page }) => {
  await page.setViewportSize({ width, height: 1000 });
  await publicFixtures(page);
  await page.goto('/salt-lake-city');
  const hero = page.locator('[data-public-hero]');
  const stats = page.locator('[data-hero-stats]');
  await expect(stats).toBeVisible();
  const heroBox = (await hero.boundingBox())!;
  const statsBox = (await stats.boundingBox())!;
  expect(Math.abs(heroBox.y + heroBox.height - statsBox.y - statsBox.height)).toBeLessThan(2);
  const viewportHeight = await page.evaluate(() => innerHeight);
  expect(heroBox.height).toBeGreaterThanOrEqual(viewportHeight);
  expect(statsBox.y + statsBox.height).toBeLessThanOrEqual(viewportHeight + 2);
  expect((await page.locator('[data-home-intro]').boundingBox())!.y).toBeGreaterThanOrEqual(viewportHeight);
  await page.screenshot({ path: test.info().outputPath(`hero-bottom-stats-${width}.png`) });
  const reviewBox = page.locator('[data-google-review-box]');
  await reviewBox.scrollIntoViewIfNeeded();
  const initialHeight = (await reviewBox.boundingBox())!.height;
  for (const name of ['Melissa Rose Stoltzfus', 'Faatupuinati Muliumu', 'Tony LoPresto', 'Sinthia Kabir']) {
    await page.getByRole('button', { name: `Show Google review from ${name}`, exact: true }).click();
    const active = page.locator('[data-review-active="true"]');
    await expect(active).toHaveCSS('opacity', '1');
    await expect(active).toContainText(name);
    expect(Math.abs((await reviewBox.boundingBox())!.height - initialHeight)).toBeLessThan(1);
  }
  await expect(page.locator('[data-review-active="true"]')).toHaveCSS('transition-property', 'opacity');
  await page.screenshot({ path: test.info().outputPath(`reviews-stable-${width}.png`) });
});
