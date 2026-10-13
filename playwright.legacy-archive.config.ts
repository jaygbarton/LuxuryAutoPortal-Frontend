import { defineConfig } from '@playwright/test';
import publicConfig from './playwright.public-home.config';
export default defineConfig({ ...publicConfig, testMatch: 'legacy-archive.spec.ts' });
