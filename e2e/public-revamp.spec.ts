import { test, expect, type Page } from "@playwright/test";

async function publicFixtures(page: Page) {
  const origin = new URL(test.info().project.use.baseURL!).origin;
  await page.route("**/*", async route => {
    const url = new URL(route.request().url());
    if (url.origin !== origin) return route.abort();
    // Vite also serves modules under /src/lib/api/; only mock server endpoints.
    if (!url.pathname.startsWith("/api/")) return route.continue();
    if (url.pathname === "/api/public-page-status") {
      return route.fulfill({ json: { isPublic: true, canPreview: false } });
    }
    if (url.pathname.startsWith("/api/auth/")) {
      return route.fulfill({ status: 401, json: { message: "Not signed in" } });
    }
    if (url.pathname === "/api/public/fleet/featured") {
      return route.fulfill({ json: { success: true, data: [{
        id: 1, makeModel: "Cadillac Escalade", year: 2024, numberOfSeats: 7,
        photo: "/homepage-hero-escalade.jpg", locationTag: "slc",
        turoLink: "https://turo.com/us/en/suv-rental/united-states/salt-lake-city-ut/test/123456",
      }] } });
    }
    return route.fulfill({ json: [] });
  });
}

for (const width of [390, 1440]) {
  test(`rental and consultation journeys work at ${width}px`, async ({ page }) => {
    const errors: string[] = [];
    page.on("pageerror", error => errors.push(error.message));
    await page.setViewportSize({ width, height: 900 });
    await publicFixtures(page);
    await page.goto("/salt-lake-city");
    await expect(page.getByRole("heading", { level: 1 })).toContainText("A remarkable drive.");
    await expect(page.getByTestId("button-hero-fleet")).toHaveAttribute("href", "/salt-lake-city/fleet");
    await expect(page.getByTestId("button-hero-owner")).toHaveAttribute("href", "/salt-lake-city/list-your-car");
    await expect(page.locator("[data-public-hero]")).toContainText("Turo Rating");
    await expect(page.getByTestId("button-cta-get-started")).toHaveAttribute("href", "/salt-lake-city/list-your-car");
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
    await page.screenshot({ path: test.info().outputPath(`home-${width}.png`) });
    await page.getByTestId("button-hero-owner").click();
    await expect(page.getByRole("heading", { level: 1 })).toContainText("Your car has");
    const consultation = page.getByRole("link", { name: "Consult with our team", exact: true });
    await expect(consultation).toHaveAttribute("href", "/salt-lake-city/contact");
    await expect(page.locator('input[type="range"], [data-earnings-calculator]')).toHaveCount(0);
    await expect(page.getByRole("link", { name: "Start your application", exact: true })).toHaveAttribute("href", "/salt-lake-city/onboarding");
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
    await page.screenshot({ path: test.info().outputPath(`owners-${width}.png`), fullPage: true });
    await consultation.click();
    await expect(page).toHaveURL(/\/salt-lake-city\/contact$/);
    await expect(page.getByRole("heading", { level: 1 })).toContainText("Rental and vehicle management help");
    await page.goto("/wilmington-nc/list-your-car");
    await expect(page.getByRole("link", { name: "Consult with our team", exact: true })).toHaveAttribute("href", "/wilmington-nc/contact");
    await expect(page.getByRole("link", { name: "Start your application", exact: true })).toHaveAttribute("href", "/wilmington-nc/onboarding");
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
    expect(errors).toEqual([]);
  });
}
