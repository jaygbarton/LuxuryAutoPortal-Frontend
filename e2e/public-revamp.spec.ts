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
  await expect(initial).toHaveCSS('background-color', 'rgb(20, 21, 18)');
  let releaseStatus!: () => void;
  const statusWait = new Promise<void>(resolve => { releaseStatus = resolve; });
  await page.route('**/api/public-page-status?*', async route => { await statusWait; await route.fulfill({ json: { isPublic: true } }); });
  releaseScript();
  const loading = page.locator('[data-public-loading]');
  await expect(loading).toBeVisible();
  await expect(loading).toHaveCSS('background-color', 'rgb(20, 21, 18)');
  expect(await loading.evaluate(el => el.getBoundingClientRect().height >= innerHeight)).toBe(true);
  releaseStatus();
  await expect(page.getByRole('heading', { level: 1 })).toContainText('A remarkable drive');
});
