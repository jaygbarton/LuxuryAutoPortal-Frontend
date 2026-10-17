import { defineConfig } from "@playwright/test";
export default defineConfig({
  testDir: "./e2e", testMatch: ["day-schedule-receipts.spec.ts", "day-schedule-booking.spec.ts", "direct-booking-preview.spec.ts"], outputDir: "test-results/day-schedule-receipts", reporter: "line",
  timeout: 45_000, expect: { timeout: 10_000 }, workers: 1,
  use: { baseURL: "http://127.0.0.1:5319", launchOptions: { executablePath: process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH || "/usr/bin/chromium" }, screenshot: "only-on-failure", trace: "retain-on-failure" },
  webServer: { command: "npm run dev -- --host 127.0.0.1 --port 5319 --strictPort", url: "http://127.0.0.1:5319", reuseExistingServer: false },
});
