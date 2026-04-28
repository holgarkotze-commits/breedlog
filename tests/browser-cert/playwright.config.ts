import { defineConfig } from '@playwright/test';

export default defineConfig({
  testDir: './specs',
  timeout: 120_000,
  retries: 1,
  use: {
    baseURL: process.env.BROWSER_CERT_BASE_URL || 'http://127.0.0.1:5000',
    trace: 'on-first-retry',
    video: 'retain-on-failure',
    screenshot: 'only-on-failure',
    headless: true,
  },
  reporter: [['list'], ['html', { outputFolder: '../../artifacts/browser-certification/report' }]],
});
