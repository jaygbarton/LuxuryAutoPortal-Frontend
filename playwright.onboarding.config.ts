import {defineConfig} from '@playwright/test';
export default defineConfig({testDir:'./e2e',testMatch:'onboarding-review.spec.ts',timeout:120_000,workers:1,reporter:'line',use:{baseURL:'http://127.0.0.1:5336',launchOptions:{executablePath:process.env.CHROMIUM_PATH || '/usr/bin/chromium'}},webServer:{command:'npm run dev -- --host 127.0.0.1 --port 5336 --strictPort',url:'http://127.0.0.1:5336'}});
