import { defineConfig } from "@playwright/test";

export default defineConfig({
  testDir: "./e2e",
  testMatch: ["native-portal.spec.ts"],
  outputDir: "test-results/native-portal",
  reporter: "line",
  timeout: 40_000,
  workers: 1,
  use: {
    baseURL: "http://127.0.0.1:5331",
    viewport: { width: 390, height: 844 },
    launchOptions: { executablePath: process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH || "/usr/bin/chromium" },
    screenshot: "only-on-failure",
    trace: "retain-on-failure",
  },
  webServer: {
    command: "npm run dev -- --host 127.0.0.1 --port 5331 --strictPort",
    url: "http://127.0.0.1:5331",
    reuseExistingServer: false,
  },
});
