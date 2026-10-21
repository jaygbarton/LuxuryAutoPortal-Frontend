import { defineConfig } from '@playwright/test';
import { existsSync } from 'node:fs';
export default defineConfig({
  testDir: './e2e', testMatch: 'client-receipts.spec.ts', workers: 1, reporter: 'line', timeout: 45_000,
  use: { baseURL: 'http://127.0.0.1:5346', launchOptions: { executablePath: process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE || (existsSync('/usr/bin/chromium') ? '/usr/bin/chromium' : undefined) }, screenshot: 'only-on-failure' },
  webServer: { command: 'npm run dev -- --host 127.0.0.1 --port 5346 --strictPort', url: 'http://127.0.0.1:5346' },
});
