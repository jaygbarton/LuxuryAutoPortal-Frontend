import { defineConfig } from '@playwright/test';
export default defineConfig({
  testDir: './e2e', testMatch: ['day-schedule-cards.spec.ts', 'day-schedule-booking.spec.ts', 'day-schedule-receipts.spec.ts', 'operations-mobile.spec.ts'], workers: 1, reporter: 'line', timeout: 45000,
  use: { baseURL: 'http://127.0.0.1:5335', launchOptions: { executablePath: process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH || '/usr/bin/chromium' }, screenshot: 'only-on-failure' },
  webServer: { command: 'npm run dev -- --host 127.0.0.1 --port 5335 --strictPort', url: 'http://127.0.0.1:5335' },
});
