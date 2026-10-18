import { defineConfig } from "@playwright/test";
export default defineConfig({
  testDir: "./e2e", testMatch: "mobile-shell.spec.ts", outputDir: "test-results/mobile-shell", reporter: "line", workers: 1,
  timeout: 45000, expect: { timeout: 10000 },
  use: { baseURL: "http://127.0.0.1:5326", launchOptions: { executablePath: process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH || "/usr/bin/chromium" }, screenshot: "only-on-failure", trace: "retain-on-failure" },
  webServer: { command: "npm run dev -- --host 127.0.0.1 --port 5326 --strictPort", url: "http://127.0.0.1:5326", reuseExistingServer: false },
});
