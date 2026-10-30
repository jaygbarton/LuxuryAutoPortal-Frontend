import { defineConfig } from '@playwright/test';
export default defineConfig({testDir:'./e2e',testMatch:['driver-rankings.spec.ts','day-schedule-receipts.spec.ts'],workers:1,reporter:'line',timeout:45000,
 use:{baseURL:'http://127.0.0.1:5336',launchOptions:{executablePath:process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH||'/usr/bin/chromium'},screenshot:'only-on-failure'},
 webServer:{command:'npm run dev -- --host 127.0.0.1 --port 5336 --strictPort',url:'http://127.0.0.1:5336'}});
