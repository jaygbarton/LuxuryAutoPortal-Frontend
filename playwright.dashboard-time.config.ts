import { defineConfig } from '@playwright/test';
export default defineConfig({ testDir: './e2e', testMatch: 'dashboard-time.spec.ts', workers: 1, reporter: 'line', use: { baseURL: 'http://127.0.0.1:5333', launchOptions: { executablePath: '/usr/bin/chromium' } }, webServer: { command: 'npm run dev -- --host 127.0.0.1 --port 5333 --strictPort', url: 'http://127.0.0.1:5333' } });
