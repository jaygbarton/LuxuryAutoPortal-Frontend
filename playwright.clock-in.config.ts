import { defineConfig } from '@playwright/test';
export default defineConfig({
  testDir: './e2e', testMatch: 'clock-in-geofence.spec.ts', workers: 1, reporter: 'line',
  use: { baseURL: 'http://127.0.0.1:5334', launchOptions: { executablePath: process.env.CHROMIUM_PATH || '/usr/bin/chromium' } },
  webServer: { command: 'npm run dev -- --host 127.0.0.1 --port 5334 --strictPort', url: 'http://127.0.0.1:5334' },
});
