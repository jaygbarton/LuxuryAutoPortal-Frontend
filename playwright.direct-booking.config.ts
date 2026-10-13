import { defineConfig } from "@playwright/test";

export default defineConfig({
  testDir: "./e2e", testMatch: "direct-booking-preview.spec.ts", timeout: 45_000,
  workers: 1, reporter: "list",
  use: { baseURL: "http://127.0.0.1:5303", browserName: "chromium", launchOptions: { executablePath: process.env.CHROMIUM_PATH || "/usr/bin/chromium" }, screenshot: "only-on-failure", trace: "retain-on-failure" },
  webServer: { command: "npm run dev -- --host 127.0.0.1 --port 5303 --strictPort", url: "http://127.0.0.1:5303", reuseExistingServer: true },
});
