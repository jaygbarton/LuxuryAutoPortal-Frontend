import { defineConfig } from "@playwright/test";
export default defineConfig({
  testDir: "./e2e",
  testMatch: "owner-documents-quality.spec.ts",
  outputDir: "test-results/quality",
  timeout: 60000,
  workers: 1,
  reporter: "line",
  use: {
    baseURL: "http://127.0.0.1:5340",
    launchOptions: { executablePath: "/usr/bin/chromium" },
    screenshot: "only-on-failure",
  },
  webServer: {
    command: "npm run dev -- --host 127.0.0.1 --port 5340 --strictPort",
    url: "http://127.0.0.1:5340",
  },
});
