import { expect, test, type Page } from "@playwright/test";

async function nativeBridge(page: Page, platform: "android" | "ios" = "android") {
  await page.addInitScript(platform => {
    const win = window as any;
    win.__nativeListeners = {};
    win.__nativeMinimized = 0;
    if (platform === "android") win.androidBridge = {};
    else win.webkit = { messageHandlers: { bridge: {} } };
    win.Capacitor = {
      PluginHeaders: [
        { name: "App", methods: [{ name: "addListener", rtype: "callback" }, { name: "removeListener", rtype: "promise" }, { name: "minimizeApp", rtype: "promise" }, { name: "getLaunchUrl", rtype: "promise" }] },
        { name: "Network", methods: [{ name: "addListener", rtype: "callback" }, { name: "removeListener", rtype: "promise" }, { name: "getStatus", rtype: "promise" }] },
      ],
      nativeCallback(plugin: string, method: string, options: any, callback: any) {
        win.__nativeListeners[`${plugin}:${options.eventName}`] = callback;
        return Promise.resolve(`${plugin}:${options.eventName}`);
      },
      nativePromise(plugin: string, method: string, options: any) {
        if (method === "getStatus") return Promise.resolve({ connected: true });
        if (method === "minimizeApp") win.__nativeMinimized++;
        if (method === "removeListener") delete win.__nativeListeners[options.callbackId];
        return Promise.resolve(undefined);
      },
    };
  }, platform);
}

async function emit(page: Page, event: string, value: unknown) {
  await page.evaluate(({ event, value }) => (window as any).__nativeListeners[event]?.(value), { event, value });
}

async function fixture(page: Page, signedIn = true) {
  const calls: string[] = [];
  const errors: string[] = [];
  page.on("pageerror", error => errors.push(error.message));
  await page.route(url => url.pathname.startsWith("/api/"), async route => {
    const path = new URL(route.request().url()).pathname;
    calls.push(path);
    let data: unknown = { success: true, data: [], total: 0, notifications: [], unreadCount: 0 };
    if (path === "/api/auth/me") data = signedIn ? { user: { id: 7, name: "Test Worker", roleName: "Employee", isEmployee: true, isAdmin: false, isClient: false, isSuperAdmin: false, effectiveTimezone: "America/Denver" } } : {};
    if (path === "/api/news-media/dashboard") data = { success: true, slot1: [], slot2: [] };
    if (path === "/api/me/employee") data = { success: true, data: { employee_aid: 41, employee_first_name: "Test", employee_last_name: "Worker" } };
    await route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify(data) });
  });
  return { calls, errors };
}

test("Android back closes navigation/dialogs, follows app history, then minimizes at its root", async ({ page }) => {
  await nativeBridge(page); const state = await fixture(page);
  await page.goto("/staff/time-off");
  await expect(page.getByRole("button", { name: "Apply", exact: true })).toBeVisible();
  await expect(page.locator("html")).toHaveClass(/native-app-shell/);
  await page.getByRole("button", { name: "More navigation" }).click();
  await expect(page.getByRole("button", { name: "Close navigation" })).toBeVisible();
  await emit(page, "App:backButton", { canGoBack: true });
  await expect(page.getByRole("button", { name: "More navigation" })).toHaveAttribute("aria-expanded", "false");
  await expect(page).toHaveURL(/\/staff\/time-off$/);
  await page.getByRole("button", { name: "Apply", exact: true }).click();
  await expect(page.getByRole("dialog", { name: "Apply for time off" })).toBeVisible();
  await emit(page, "App:backButton", { canGoBack: true });
  await expect(page.getByRole("dialog", { name: "Apply for time off" })).toBeHidden();
  await page.evaluate(() => history.pushState(null, "", "/staff/task-management"));
  await expect(page.getByRole("heading", { name: "Task Management", exact: true })).toBeVisible();
  await emit(page, "App:backButton", { canGoBack: true });
  await expect(page).toHaveURL(/\/staff\/time-off$/);
  await emit(page, "App:backButton", { canGoBack: true });
  expect(await page.evaluate(() => (window as any).__nativeMinimized)).toBe(1);
  expect(state.errors).toEqual([]);
});

test("native disconnect/reconnect and app resume preserve entered form values", async ({ page }) => {
  await nativeBridge(page, "ios"); const state = await fixture(page, false);
  await page.goto("/admin/login");
  await page.getByTestId("input-email").fill("employee@example.test");
  await emit(page, "Network:networkStatusChange", { connected: false });
  await expect(page.getByRole("status").filter({ hasText: "You’re offline" })).toBeVisible();
  await expect(page.getByTestId("input-email")).toHaveValue("employee@example.test");
  const reads = state.calls.filter(path => path === "/api/auth/me").length;
  await emit(page, "Network:networkStatusChange", { connected: true });
  await expect(page.locator("[data-native-offline]")).toHaveCount(0);
  await expect.poll(() => state.calls.filter(path => path === "/api/auth/me").length).toBeGreaterThan(reads);
  await emit(page, "App:appStateChange", { isActive: false });
  await emit(page, "App:appStateChange", { isActive: true });
  await expect(page.getByTestId("input-email")).toHaveValue("employee@example.test");
  expect(await page.evaluate(() => Boolean((window as any).__nativeListeners["App:backButton"])) ).toBe(false);
  expect(state.errors).toEqual([]);
});

test("deep links reject foreign hosts and still enforce route roles", async ({ page }) => {
  await nativeBridge(page); const state = await fixture(page);
  await page.goto("/staff/time-off");
  await expect(page.getByRole("button", { name: "Apply", exact: true })).toBeVisible();
  await emit(page, "App:appUrlOpen", { url: "https://evil.example/admin/operations" });
  await expect(page).toHaveURL(/\/staff\/time-off$/);
  await emit(page, "App:appUrlOpen", { url: "https://www.goldenluxuryauto.com/staff/task-management" });
  await expect(page).toHaveURL(/\/staff\/task-management$/);
  await emit(page, "App:appUrlOpen", { url: "https://goldenluxuryauto.com/admin/admins" });
  await expect(page).toHaveURL(/\/staff\/dashboard$/);
  expect(state.calls).not.toContain("/api/admins");
  expect(state.errors).toEqual([]);
});

test("ordinary web pages do not activate native integration", async ({ page }) => {
  const state = await fixture(page, false);
  await page.goto("/admin/login");
  await expect(page.getByTestId("input-email")).toBeVisible();
  await expect(page.locator("html")).not.toHaveClass(/native-app-shell/);
  await page.evaluate(() => window.dispatchEvent(new Event("offline")));
  await expect(page.locator("[data-native-offline]")).toHaveCount(0);
  expect(await page.evaluate(() => history.state?.__glaNativeNavigation)).toBeUndefined();
  expect(state.errors).toEqual([]);
});
