import { expect, test, type Locator } from "@playwright/test";

test.use({ launchOptions: { executablePath: process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH } });

for (const mobile of [false, true]) {
  test.describe(mobile ? "mobile searchable dropdowns" : "desktop searchable dropdowns", () => {
    const activate = (locator: Locator) => mobile ? locator.tap() : locator.click();
    test.use({ isMobile: mobile, viewport: mobile ? { width: 375, height: 667 } : { width: 1280, height: 800 }, hasTouch: mobile });
    test.beforeEach(async ({ page }) => { await page.goto("/e2e/fixtures/dropdowns.html"); });

    test("searches a 120-car fleet by hidden VIN, plate, year, make and model", async ({ page }) => {
      await activate(page.getByTestId("cars"));
      const search = page.getByRole("searchbox");
      for (const query of ["5uxcr6", "abc123", "2025 bmw x5"]) {
        await search.fill(query);
        await expect(page.getByRole("option")).toHaveCount(1);
        await expect(page.getByRole("option")).toHaveText("Car 99");
      }
      await search.press("ArrowDown");
      await page.keyboard.press("Enter");
      await expect(page.getByTestId("cars")).toHaveText("Car 99");
      await activate(page.getByTestId("cars"));
      await expect(page.getByRole("searchbox")).toHaveValue("");
      await expect(page.getByRole("option")).toHaveCount(120);
    });

    test("shows an empty state, clears search, and preserves selection on Escape", async ({ page }) => {
      await activate(page.getByTestId("cars"));
      await page.getByRole("searchbox").fill("missing car");
      await expect(page.getByRole("status")).toHaveText("No matching options.");
      await activate(page.getByRole("button", { name: "Clear search" }));
      await expect(page.getByRole("option")).toHaveCount(120);
      await page.getByRole("searchbox").fill("missing car");
      await expect(page.getByRole("status")).toHaveText("No matching options.");
      await page.getByRole("searchbox").press("Escape");
      await expect(page.getByTestId("cars")).toHaveText("Car 1");
      await expect(page.getByTestId("cars")).toBeFocused();
      await activate(page.getByTestId("cars"));
      await expect(page.getByRole("option")).toHaveCount(120);
      await expect(page.getByRole("status")).toHaveCount(0);
    });

    test("preserves required native form validation and the saved option ID", async ({ page }) => {
      await activate(page.getByRole("button", { name: "Save selection" }));
      await expect(page.getByTestId("submitted")).toBeEmpty();
      await activate(page.getByRole("combobox", { name: "Choose a car" }));
      await page.getByRole("searchbox").fill("abc123");
      await activate(page.getByRole("option", { name: "Car 99", exact: true }));
      await expect(page.getByRole("combobox", { name: "Choose a car" })).toHaveText("Car 99");
      await activate(page.getByRole("button", { name: "Save selection" }));
      await expect(page.getByTestId("submitted")).toHaveText("99");
      await activate(page.getByRole("combobox", { name: "Choose a car" }));
      await page.getByRole("searchbox").fill("Unavailable");
      await expect(page.getByRole("option", { name: "Unavailable" })).toBeDisabled();
      await page.getByRole("searchbox").press("Escape");
      await expect(page.getByRole("combobox", { name: "Choose a car" })).toHaveText("Car 99");
    });

    test("searches employee names, email and department without changing their value", async ({ page }) => {
      await activate(page.getByTestId("employees"));
      await page.getByPlaceholder("Search employees").fill("operations jose");
      await expect(page.locator('[cmdk-item]:visible')).toHaveCount(1);
      await page.getByPlaceholder("Search employees").fill("jose@example.com");
      await activate(page.getByRole("option", { name: "José Rivera" }));
      await expect(page.getByTestId("employees")).toHaveText("José Rivera");
    });

    test("supports selection inside a modal without overflowing a narrow screen", async ({ page }) => {
      // Reduced height also exercises the space available when a mobile keyboard is open.
      if (mobile) await page.setViewportSize({ width: 375, height: 320 });
      await activate(page.getByRole("button", { name: "Open modal", exact: true }));
      await activate(page.getByTestId("modal-cars"));
      await page.getByRole("searchbox").fill("ABC123");
      const bounds = await page.getByRole("listbox").boundingBox();
      expect(bounds!.x).toBeGreaterThanOrEqual(0);
      expect(bounds!.x + bounds!.width).toBeLessThanOrEqual(page.viewportSize()!.width);
      expect(bounds!.y).toBeGreaterThanOrEqual(0);
      expect(bounds!.y + bounds!.height).toBeLessThanOrEqual(page.viewportSize()!.height);
      await activate(page.getByRole("option", { name: "Car 99", exact: true }));
      await expect(page.getByTestId("modal-cars")).toHaveText("Car 99");
    });
  });
}
