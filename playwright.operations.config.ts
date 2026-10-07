import { defineConfig } from "@playwright/test";

export default defineConfig({
  testDir: "./e2e",
  testMatch: "operations-mobile.spec.ts",
  outputDir: "test-results/operations-ui",
  reporter: [["line"], ["json", { outputFile: "test-results/operations-ui/results.json" }]],
  timeout: 60_000,
  expect: { timeout: 10_000 },
  workers: 1,
  use: {
    baseURL: "http://127.0.0.1:5101",
    launchOptions: { executablePath: process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH },
    screenshot: "only-on-failure",
    trace: "retain-on-failure",
  },
  webServer: {
    command: "npm run dev -- --host 127.0.0.1 --port 5101 --strictPort",
    url: "http://127.0.0.1:5101",
    reuseExistingServer: false,
  },
});
