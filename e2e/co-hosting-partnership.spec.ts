import { expect, test, type Page } from "@playwright/test";

const PAGE = "/salt-lake-city/co-hosting-partnership";
const FUNNEL = "https://rent.goldenluxuryauto.com/co-hosting-partnership";

async function site(page: Page, live: boolean) {
  await page.route(url => url.pathname.startsWith("/api/"), route => {
    const url = new URL(route.request().url());
    if (url.pathname === "/api/public-page-status") {
      const path = url.searchParams.get("path");
      return route.fulfill({ json: { path, isPublic: path === PAGE ? live : true, canPreview: false } });
    }
    if (url.pathname.startsWith("/api/auth/")) return route.fulfill({ status: 401, json: { message: "Not signed in" } });
    return route.fulfill({ json: [] });
  });
}

test("stays hidden, with no header or footer link, until it is switched on", async ({ page }) => {
  await site(page, false);
  await page.goto("/salt-lake-city");
  await expect(page.getByTestId("link-nav-home")).toBeVisible({ timeout: 15000 });
  await expect(page.getByTestId("link-nav-co-host-program")).toHaveCount(0);
  await expect(page.getByTestId("link-footer-co-host-program")).toHaveCount(0);
  await page.goto("/co-hosting-partnership");
  await expect(page).toHaveURL(new RegExp(`${PAGE}$`));
  await expect(page.getByText("Page Under Maintenance")).toBeVisible();
  await expect(page.getByText("Run your city.")).toHaveCount(0);
});

test("once live: title, header placement, and every call to action is a same-tab link to the funnel", async ({ page }) => {
  await site(page, true);
  await page.setViewportSize({ width: 1280, height: 900 });
  await page.goto("/co-hosting-partnership");
  await expect(page).toHaveURL(new RegExp(`${PAGE}$`));
  await expect(page.getByRole("heading", { level: 1 })).toContainText("Run your city.Under the Golden Luxury Auto name.");
  await expect(page).toHaveTitle("Co-Hosting Partnership | Golden Luxury Auto");
  await expect(page.locator('meta[name="description"]')).toHaveAttribute("content", "We're choosing one Turo host per city to operate under the Golden Luxury Auto name. Check if your city is still open.");
  const nav = await page.locator('[data-testid^="link-nav-"]:visible').evaluateAll(links => links.map(l => l.textContent?.trim()));
  expect(nav.slice(nav.indexOf("List Your Car"), nav.indexOf("List Your Car") + 2)).toEqual(["List Your Car", "Co-Host Program"]);
  await expect(page.getByTestId("link-footer-co-host-program")).toHaveAttribute("href", PAGE);
  for (const id of ["button-cohost-hero-apply", "button-cohost-cta-apply"]) {
    const cta = page.getByTestId(id);
    await expect(cta).toHaveAttribute("href", FUNNEL);
    expect(await cta.getAttribute("target")).toBeNull();
  }
  await expect(page.getByTestId("link-cohost-training")).toHaveAttribute("href", "https://rent.goldenluxuryauto.com/co-host-training");
  expect(await page.locator("form, input, textarea, select").count()).toBe(0);
  await page.getByTestId("button-cohost-how-it-works").click();
  await expect(page.locator("#how-it-works")).toBeInViewport();
});

test("from another city the link still opens the one partnership page", async ({ page }) => {
  await site(page, true);
  await page.setViewportSize({ width: 1280, height: 900 });
  await page.goto("/wilmington-nc");
  await expect(page.getByTestId("link-nav-co-host-program")).toHaveAttribute("href", PAGE, { timeout: 15000 });
});

test("on a phone the stat cards are two per row and the steps stack", async ({ page }) => {
  await site(page, true);
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto(PAGE);
  await expect(page.getByText("9 years")).toBeVisible({ timeout: 15000 });
  const stats = await page.locator('section[aria-label="Golden Luxury Auto in numbers"] .grid > div').evaluateAll(cards => cards.map(c => Math.round(c.getBoundingClientRect().top)));
  expect(stats[0]).toBe(stats[1]);
  expect(stats[2]).toBeGreaterThan(stats[0]);
  await page.locator("#how-it-works").scrollIntoViewIfNeeded();
  const steps = await page.locator("[data-cohost-step]").evaluateAll(items => items.map(i => Math.round(i.getBoundingClientRect().left)));
  expect(new Set(steps).size).toBe(1);
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
});
