import { test, expect } from '@playwright/test';

test('real service worker discards old API cache and cannot resurrect private rows offline', async ({ browser, baseURL }) => {
  if (!baseURL || !/^http:\/\/(127\.0\.0\.1|localhost):/.test(baseURL)) throw new Error('Isolated localhost only');
  const context = await browser.newContext({ serviceWorkers: 'allow' });
  try {
    const page = await context.newPage(); await page.goto(baseURL + '/api/version');
    await page.evaluate(async () => {
      const old = await caches.open('breedlog-api-v3');
      await old.put('/api/animals?search=private', new Response(JSON.stringify([{ id: 31, name: 'Private row' }])));
      await navigator.serviceWorker.register('/sw.js');
      await navigator.serviceWorker.ready;
    });
    await expect.poll(() => page.evaluate(() => !!navigator.serviceWorker.controller)).toBeTruthy();
    expect(await page.evaluate(() => caches.keys())).not.toContain('breedlog-api-v3');
    // Even a lingering cache on a long-lived tab is never used by this worker.
    await page.evaluate(async () => {
      const old = await caches.open('breedlog-api-v3');
      await old.put('/api/animals?search=private', new Response(JSON.stringify([{ id: 31, name: 'Private row' }])));
    });
    await context.setOffline(true);
    const failed = await page.evaluate(async () => {
      try { await fetch('/api/animals?search=private'); return false; } catch { return true; }
    });
    expect(failed).toBeTruthy();
  } finally { await context.setOffline(false); await context.close(); }
});
