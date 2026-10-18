import { defineConfig } from "@playwright/test";
export default defineConfig({
  testDir: "./e2e", testMatch: ["staff-mobile.spec.ts"], outputDir: "test-results/staff-mobile", reporter: "line",
  timeout: 45_000, expect: { timeout: 10_000 }, workers: 1,
  use: { baseURL: "http://127.0.0.1:5325", launchOptions: { executablePath: process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH || "/usr/bin/chromium" }, screenshot: "only-on-failure", trace: "retain-on-failure" },
  webServer: { command: "npm run dev -- --host 127.0.0.1 --port 5325 --strictPort", url: "http://127.0.0.1:5325", reuseExistingServer: false },
});
