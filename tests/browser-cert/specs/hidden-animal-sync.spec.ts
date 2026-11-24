import { test, expect, type Page } from '@playwright/test';

test('two offline devices retain queued hidden writes and restore after Premium returns', async ({ browser, baseURL }) => {
  if (!baseURL || !/^http:\/\/(127\.0\.0\.1|localhost):/.test(baseURL)) throw new Error('Synthetic billing fixtures require isolated localhost');
  const user = `hidden-browser-${Date.now()}`;
  const headers = { 'Content-Type': 'application/json', 'x-test-user-id': user, 'x-test-device-id': 'seed-device' };
  const api = async (path: string, method = 'GET', body?: any) => {
    const r = await fetch(baseURL + path, { method, headers, body: body === undefined ? undefined : JSON.stringify(body) });
    expect(r.ok, `${method} ${path}: ${r.status}`).toBeTruthy(); return r.json();
  };
  const upgrade = async () => {
    const checkout = await api('/api/billing/checkout-session', 'POST', { productCode: 'premium_monthly' });
    await api(`/api/billing/test/checkout/${checkout.sessionId}/complete`, 'POST');
  };
  await upgrade();
  const animals = [];
  for (let i = 1; i <= 35; i++) animals.push(await api('/api/animals', 'POST', {
    tagId: `BROWSER-${i}`, sex: i % 2 ? 'ram' : 'ewe', status: i <= 3 ? 'culled' : 'active', notes: `original-${i}`,
  }));
  await api(`/api/animals/${animals[3].id}`, 'PUT', { sireId: animals[33].id });
  await api('/api/health-records', 'POST', { animalId: animals[33].id, date: '2026-01-01', type: 'treatment', treatment: 'private health' });
  const contexts = await Promise.all(['device-a', 'device-b'].map(device => browser.newContext({
    extraHTTPHeaders: { ...headers, 'x-test-device-id': device }, serviceWorkers: 'block',
  })));
  const pages: Page[] = [];
  const sync = (page: Page) => page.evaluate(async () => {
    const { syncManager } = await import(/* @vite-ignore */ '/src/lib/sync-manager.ts');
    return syncManager.performFullSyncAction();
  });
  const cached = (page: Page) => page.evaluate(async () => {
    const db = await import(/* @vite-ignore */ '/src/lib/indexeddb.ts');
    return { animals: await db.getAllFromStore('animals'), health: await db.getAllFromStore('healthRecords'), queue: await db.getPendingSyncItems() };
  });
  try {
    for (const context of contexts) {
      const page = await context.newPage(); pages.push(page);
      await page.goto(baseURL + '/auth/login');
      await page.evaluate(async userId => {
        const db = await import(/* @vite-ignore */ '/src/lib/indexeddb.ts');
        await db.setCurrentUserId(userId);
      }, user);
      expect(await sync(page)).toBe('SYNC_COMPLETE');
      expect((await cached(page)).animals).toHaveLength(35);
    }
    await contexts[0].setOffline(true);
    await pages[0].evaluate(async ids => {
      const db = await import(/* @vite-ignore */ '/src/lib/indexeddb.ts');
      for (const id of ids) {
        const data = { id, notes: `offline-edit-${id}` };
        const old = await db.getFromStore<any>('animals', id);
        await db.putInStore('animals', { ...old, ...data });
        await db.addToSyncQueue({ entity: 'animals', action: 'update', data, operationId: crypto.randomUUID() });
      }
      await db.addToSyncQueue({ entity: 'animals', action: 'update', data: {
        id: ids[0], sireId: ids[1], sire: { id: ids[1], notes: 'hidden nested value' },
        grandparents: { paternalGrandsire: { id: ids[1] } },
      }, operationId: crypto.randomUUID() });
    }, [animals[3].id, animals[33].id]);
    expect((await cached(pages[0])).queue).toHaveLength(2);
    await api('/api/billing/test/simulate', 'POST', { eventType: 'subscription.refunded' });
    await contexts[0].setOffline(false);
    await expect.poll(async () => (await cached(pages[0])).animals.length).toBe(33);
    expect(await sync(pages[1])).toBe('SYNC_COMPLETE');
    for (const page of pages) {
      const data = await cached(page);
      expect(data.animals).toHaveLength(33); expect(data.health).toHaveLength(0);
      expect(data.animals.some((row: any) => row.id === animals[33].id || row.sireId === animals[33].id)).toBeFalsy();
      expect(JSON.stringify(data.animals)).not.toContain('hidden nested value');
    }
    const pending = (await cached(pages[0])).queue;
    expect(pending).toHaveLength(2);
    expect(pending.some(item => (item.data as any).id === animals[33].id)).toBeTruthy();
    await contexts[0].setOffline(true);
    expect((await cached(pages[0])).animals).toHaveLength(33);
    await upgrade();
    await contexts[0].setOffline(false);
    await expect.poll(async () => (await cached(pages[0])).queue.length, { timeout: 20_000 }).toBe(0);
    await expect.poll(async () => (await cached(pages[0])).animals.length).toBe(35);
    expect(await sync(pages[1])).toBe('SYNC_COMPLETE');
    for (const page of pages) {
      expect((await cached(page)).animals).toHaveLength(35);
      expect((await cached(page)).health).toHaveLength(1);
    }
    expect((await api(`/api/animals/${animals[33].id}`)).notes).toBe(`offline-edit-${animals[33].id}`);
    expect((await api('/api/animals')).filter((row: any) => row.status === 'culled')).toHaveLength(3);
  } finally {
    await Promise.all(contexts.map(context => context.close()));
  }
});

test('cookie-authenticated bodyless DELETE keeps the JSON CSRF boundary', async ({ browser, baseURL }) => {
  if (!baseURL || !/^http:\/\/(127\.0\.0\.1|localhost):/.test(baseURL)) throw new Error('Local acceptance only');
  const context = await browser.newContext({ serviceWorkers: 'block' });
  try {
    const page = await context.newPage(); page.setDefaultTimeout(20_000);
    page.on('requestfailed', request => console.log('Browser request failed:', new URL(request.url()).pathname, request.failure()?.errorText));
    page.on('pageerror', error => console.log('Browser page error:', error.message));
    await page.goto(baseURL + '/auth/register');
    const result = await page.evaluate(async () => {
      const { apiRequest } = await import(/* @vite-ignore */ '/src/lib/queryClient.ts');
      await apiRequest('POST', '/api/auth/register', { email: `delete-${crypto.randomUUID()}@example.test`, password: 'Local-acceptance-password', acceptedTerms: true });
      const animal = await (await apiRequest('POST', '/api/animals', { tagId: 'COOKIE-DELETE', sex: 'ewe' })).json();
      const denied = await fetch(`/api/animals/${animal.id}`, { method: 'DELETE', credentials: 'include' });
      const deleted = await apiRequest('DELETE', `/api/animals/${animal.id}`);
      return { denied: denied.status, deleted: deleted.status, animals: await (await apiRequest('GET', '/api/animals')).json() };
    });
    expect(result.denied).toBe(415); expect(result.deleted).toBe(204); expect(result.animals).toEqual([]);
  } finally { await context.close(); }
});

test('real account UI saves an animal offline immediately and drains it on reconnect', async ({ browser, baseURL }) => {
  if (!baseURL || !/^http:\/\/(127\.0\.0\.1|localhost):/.test(baseURL)) throw new Error('Local acceptance only');
  const context = await browser.newContext({ serviceWorkers: 'block' });
  try {
    const page = await context.newPage(); page.setDefaultTimeout(20_000);
    page.on('requestfailed', request => console.log('Browser request failed:', new URL(request.url()).pathname, request.failure()?.errorText));
    page.on('pageerror', error => console.log('Browser page error:', error.message));
    await page.goto(baseURL + '/auth/register');
    await page.locator('#account-email').fill(`offline-ui-${Date.now()}@example.test`);
    await page.locator('#account-password').fill('Local-offline-acceptance-password');
    await page.getByRole('checkbox').check(); await page.getByRole('button', { name: 'Create account', exact: true }).click();
    await page.locator('#saved-recovery-code').check(); await page.getByTestId('button-save-recovery-code').click();
    await page.getByTestId('button-trial-add-animals').click();
    await page.getByTestId('button-add-animal').click(); await page.getByTestId('input-tag-id').fill('LOCAL-OFFLINE-UI');
    await context.setOffline(true); await page.getByTestId('button-save-animal').click();
    const queued = () => page.evaluate(async () => {
      const db = await import(/* @vite-ignore */ '/src/lib/indexeddb.ts');
      return (await db.getPendingSyncItems()).length;
    });
    await expect.poll(queued).toBe(1);
    await expect(page.getByRole('dialog')).not.toBeVisible();
    await page.screenshot({ path: test.info().outputPath('offline-animal-saved.png') });
    await context.setOffline(false);
    await expect.poll(queued, { timeout: 20_000 }).toBe(0);
    const rows = await page.evaluate(async () => (await fetch('/api/animals')).json());
    expect(rows.filter((row: any) => row.tagId === 'LOCAL-OFFLINE-UI')).toHaveLength(1);
    // Unsupported queue work must be retained, rather than marked synced/lost.
    const result = await page.evaluate(async () => {
      const db = await import(/* @vite-ignore */ '/src/lib/indexeddb.ts');
      const { syncManager } = await import(/* @vite-ignore */ '/src/lib/sync-manager.ts');
      await db.addToSyncQueue({ entity: 'unrecognized-entity', action: 'create', data: { note: 'retain for recovery' } });
      const result = await syncManager.performFullSyncAction();
      return { result, queue: await db.getPendingSyncItems() };
    });
    expect(result.result).toBe('SYNC_PARTIAL_ERROR'); expect(result.queue).toHaveLength(1);
  } finally { await context.setOffline(false); await context.close(); }
});

test('verified Premium export access works offline and respects the paid deadline', async ({ browser, baseURL }) => {
  if (!baseURL || !/^http:\/\/(127\.0\.0\.1|localhost):/.test(baseURL)) throw new Error('Synthetic billing fixtures require isolated localhost');
  const workspace = `export-browser-${Date.now()}`;
  const context = await browser.newContext({
    extraHTTPHeaders: { 'x-test-user-id': workspace, 'x-test-device-id': 'export-device' },
    serviceWorkers: 'block',
  });
  try {
    const page = await context.newPage();
    await page.goto(baseURL + '/auth/login');
    const authorize = () => page.evaluate(async workspaceId => {
      const { setCurrentUserId } = await import(/* @vite-ignore */ '/src/lib/indexeddb.ts');
      const { authorizeExport } = await import(/* @vite-ignore */ '/src/lib/export-access.ts');
      await setCurrentUserId(workspaceId);
      return authorizeExport();
    }, workspace);
    expect(await authorize()).toBe(false);
    const checkout = await context.request.post(baseURL + '/api/billing/checkout-session', {
      data: { productCode: 'premium_monthly' },
    });
    expect(checkout.status()).toBe(201);
    const { sessionId } = await checkout.json();
    expect((await context.request.post(baseURL + `/api/billing/test/checkout/${sessionId}/complete`, { data: {} })).ok()).toBeTruthy();
    expect(await authorize()).toBe('online');
    await page.evaluate(async () => {
      const db = await import(/* @vite-ignore */ '/src/lib/indexeddb.ts');
      const access = await db.getFromStore('metadata', 'verifiedExportAccess');
      if (!access?.value?.validUntil) throw new Error('Missing verified paid deadline');
    });
    await context.setOffline(true);
    expect(await authorize()).toBe('offline');
    await page.evaluate(async () => {
      const db = await import(/* @vite-ignore */ '/src/lib/indexeddb.ts');
      await db.setCurrentUserId('another-workspace');
      const { authorizeExport } = await import(/* @vite-ignore */ '/src/lib/export-access.ts');
      if (await authorizeExport()) throw new Error('Another workspace inherited Premium');
    });
    await page.clock.setFixedTime(new Date('2100-01-01T00:00:00Z'));
    expect(await authorize()).toBe(false);
    await page.clock.setFixedTime(new Date());
    await context.setOffline(false);
    expect((await context.request.post(baseURL + '/api/billing/test/simulate', { data: { eventType: 'subscription.refunded' } })).ok()).toBeTruthy();
    expect(await authorize()).toBe(false);
    await context.setOffline(true);
    expect(await authorize()).toBe(false);
  } finally {
    await context.close();
  }
});
