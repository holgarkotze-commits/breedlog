import { defineConfig } from '@playwright/test';
import path from 'node:path';

const repositoryRoot = path.resolve(import.meta.dirname, '../..');

export default defineConfig({
  testDir: './specs',
  timeout: 120_000,
  retries: 1,
  workers: 1,
  outputDir: path.join(repositoryRoot, 'test-results'),
  webServer: process.env.BROWSER_CERT_BASE_URL ? undefined : {
    cwd: repositoryRoot,
    command: 'npx cross-env NODE_ENV=test USE_IN_MEMORY_STORAGE=1 SESSION_SECRET=browser-cert-only-secret ADMIN_PIN=0000 node --import tsx scripts/browser-cert-server.ts',
    url: 'http://127.0.0.1:5000/api/version',
    reuseExistingServer: !process.env.CI,
    timeout: 60_000,
  },
  use: {
    baseURL: process.env.BROWSER_CERT_BASE_URL || 'http://127.0.0.1:5000',
    trace: 'on-first-retry',
    video: 'retain-on-failure',
    screenshot: 'only-on-failure',
    headless: true,
    launchOptions: process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH ? {
      executablePath: process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH,
    } : undefined,
  },
  reporter: [['list'], ['html', { outputFolder: path.join(repositoryRoot, 'artifacts/browser-certification/report') }]],
});
