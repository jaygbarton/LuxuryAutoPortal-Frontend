import { expect, test } from "@playwright/test";

test("Cybercab page: US map, city status, membership benefits and the unchanged reservation request", async ({ page }) => {
  const posts: unknown[] = [];
  await page.route(url => url.pathname.startsWith("/api/"), route => {
    const url = new URL(route.request().url());
    if (url.pathname === "/api/cybercab/reservations") { posts.push(route.request().postDataJSON()); return route.fulfill({ json: { success: true } }); }
    if (url.pathname === "/api/public-page-status") return route.fulfill({ json: { isPublic: true, canPreview: false } });
    if (url.pathname.startsWith("/api/auth/")) return route.fulfill({ status: 401, json: {} });
    return route.fulfill({ json: [] });
  });
  await page.setViewportSize({ width: 1280, height: 900 });
  await page.goto("/salt-lake-city/cybercab");
  const map = page.getByTestId("cybercab-us-map");
  await expect(map).toBeVisible({ timeout: 15000 });
  await expect(map.locator("path[data-state]")).toHaveCount(51);
  await expect(map.locator("path[data-friendly]")).toHaveCount(22);
  await expect(map.locator('path[data-state="Utah"]')).toHaveAttribute("data-friendly", "true");
  await expect(map.locator('path[data-state="New York"]')).not.toHaveAttribute("data-friendly", /.*/);
  await expect(map.locator('[data-status="cybercab"]')).toHaveCount(2);
  await expect(map.locator('[data-status="testing"][data-city="Salt Lake City, UT"] circle')).toHaveAttribute("fill", "none");
  await expect(map.locator('[data-status="soon"]')).toHaveCount(3);
  await expect(map.locator('[data-status="testing"]')).toHaveCount(4);
  await page.getByTestId("button-nav-pages").hover();
  await expect(page.getByTestId("link-nav-pages-cybercab")).toHaveAttribute("href", "/salt-lake-city/cybercab");
  await page.keyboard.press("Escape");
  await expect(map.locator('[data-status="soon"][data-city="Jacksonville, FL"]')).toHaveCount(1);
  await expect(page.locator("body")).not.toContainText("Turo program");
  await expect(page.locator("#reserve")).toContainText("newsletter and updates");
  await expect(page.locator("main")).toContainText("Each car we manage runs in one program at a time.");

  const form = page.locator("#reserve form");
  await form.getByLabel("Full name").fill("Test Member");
  await form.getByLabel("Email").fill("member@example.test");
  await form.getByLabel("Phone").fill("8015550100");
  await form.getByRole("checkbox").check();
  await form.getByRole("button", { name: /Become a member/ }).click();
  await expect(page.getByRole("status")).toContainText("member newsletter and updates");
  expect(posts).toEqual([{ name: "Test Member", email: "member@example.test", phone: "8015550100", city: "Salt Lake City", cars: 1, notes: "", acceptsNonRefundableDeposit: true }]);
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
});
