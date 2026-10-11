import { test, expect, type Page } from "@playwright/test";

async function publicFixtures(page: Page) {
  await page.route("**/*", async route => {
    const url = new URL(route.request().url());
    if (url.origin !== "http://127.0.0.1:5300") return route.abort();
    if (!url.pathname.startsWith("/api/")) return route.continue();
    if (url.pathname === "/api/public-page-status") {
      return route.fulfill({ json: { isPublic: true, canPreview: false } });
    }
    if (url.pathname.startsWith("/api/auth/")) {
      return route.fulfill({ status: 401, json: { message: "Not signed in" } });
    }
    return route.fulfill({ json: [] });
  });
}

// Exercise a real failed DOM removal while React replaces its initial spinner.
// Chromium supplies the native DOM operation; use WebKit's exception wording
// to test Safari recovery without relying on a Safari browser installation.
async function mutateLoadingNode(page: Page, persistent = false) {
  await page.addInitScript(({ persistent }) => {
    const removeChild = Node.prototype.removeChild;
    Node.prototype.removeChild = function<T extends Node>(child: T): T {
      const isLoading = child instanceof Element && child.querySelector("svg.animate-spin");
      if (isLoading && (persistent || !sessionStorage.getItem("test:dom-fault"))) {
        sessionStorage.setItem("test:dom-fault", "injected");
        removeChild.call(this, child);
        try { return removeChild.call(this, child) as T; }
        catch { throw new DOMException("The object can not be found here.", "NotFoundError"); }
      }
      return removeChild.call(this, child) as T;
    };
  }, { persistent });
}

test("home opens and remains usable after scrolling and navigation", async ({ page }) => {
  await publicFixtures(page);
  await page.goto("/salt-lake-city");
  await expect(page.getByRole("heading", { name: /Premium vehicle rentals/ })).toBeVisible();
  await page.evaluate(() => window.scrollTo(0, 1000));
  await expect(page.getByTestId("button-nav-pages")).toBeVisible();
  await page.getByTestId("button-nav-pages").hover();
  await expect(page.getByTestId("link-nav-pages-extras")).toBeVisible();
  await expect(page.getByRole("heading", { name: "Something went wrong" })).toHaveCount(0);
});

test("Safari DOM removal error on initial load recovers the same homepage once", async ({ page }) => {
  await publicFixtures(page);
  await mutateLoadingNode(page);
  let documents = 0;
  page.on("request", req => { if (req.isNavigationRequest() && req.frame() === page.mainFrame()) documents++; });
  await page.goto("/salt-lake-city");
  await expect.poll(() => documents).toBe(2);
  await expect(page.getByRole("heading", { name: /Premium vehicle rentals/ })).toBeVisible();
  expect(await page.evaluate(() => sessionStorage.getItem("test:dom-fault"))).toBe("injected");
  expect(documents).toBe(2);
  expect(await page.evaluate(() => JSON.parse(sessionStorage.getItem("gla:external-dom-recovery")!).url))
    .toBe("http://127.0.0.1:5300/salt-lake-city");
});

test("persistent Safari DOM mutation does not cause a reload loop", async ({ page }) => {
  await publicFixtures(page);
  await mutateLoadingNode(page, true);
  let documents = 0;
  page.on("request", req => { if (req.isNavigationRequest() && req.frame() === page.mainFrame()) documents++; });
  await page.goto("/salt-lake-city");
  await expect(page.getByRole("heading", { name: "Something went wrong" })).toBeVisible();
  await expect.poll(() => documents).toBe(2);
  await page.waitForTimeout(1500);
  expect(documents).toBe(2);
});
