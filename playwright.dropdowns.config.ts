import { defineConfig } from "@playwright/test";

export default defineConfig({
  testDir: "./e2e",
  testMatch: "searchable-dropdowns.spec.ts",
  outputDir: "test-results/dropdowns",
  timeout: 20_000,
  expect: { timeout: 5_000 },
  workers: 1,
  use: {
    baseURL: "http://127.0.0.1:5100",
    launchOptions: { executablePath: process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH },
    screenshot: "only-on-failure",
    trace: "retain-on-failure",
  },
  webServer: {
    command: "npm run dev -- --host 127.0.0.1 --port 5100 --strictPort",
    url: "http://127.0.0.1:5100/e2e/fixtures/dropdowns.html",
    reuseExistingServer: !process.env.CI,
  },
});
