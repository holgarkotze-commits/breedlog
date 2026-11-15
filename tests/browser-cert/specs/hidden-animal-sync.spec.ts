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
  await api(`/api/animals/${animals[3].id}`, 'PUT', { sireId: animals[30].id });
  await api('/api/health-records', 'POST', { animalId: animals[30].id, date: '2026-01-01', type: 'treatment', treatment: 'private health' });
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
    }, [animals[3].id, animals[30].id]);
    expect((await cached(pages[0])).queue).toHaveLength(2);
    await api('/api/billing/test/simulate', 'POST', { eventType: 'subscription.refunded' });
    await contexts[0].setOffline(false);
    await expect.poll(async () => (await cached(pages[0])).animals.length).toBe(30);
    expect(await sync(pages[1])).toBe('SYNC_COMPLETE');
    for (const page of pages) {
      const data = await cached(page);
      expect(data.animals).toHaveLength(30); expect(data.health).toHaveLength(0);
      expect(data.animals.some((row: any) => row.id === animals[30].id || row.sireId === animals[30].id)).toBeFalsy();
    }
    const pending = (await cached(pages[0])).queue;
    expect(pending).toHaveLength(1); expect((pending[0].data as any).id).toBe(animals[30].id);
    await contexts[0].setOffline(true);
    expect((await cached(pages[0])).animals).toHaveLength(30);
    await upgrade();
    await contexts[0].setOffline(false);
    await expect.poll(async () => (await cached(pages[0])).queue.length, { timeout: 20_000 }).toBe(0);
    await expect.poll(async () => (await cached(pages[0])).animals.length).toBe(35);
    expect(await sync(pages[1])).toBe('SYNC_COMPLETE');
    for (const page of pages) {
      expect((await cached(page)).animals).toHaveLength(35);
      expect((await cached(page)).health).toHaveLength(1);
    }
    expect((await api(`/api/animals/${animals[30].id}`)).notes).toBe(`offline-edit-${animals[30].id}`);
    expect((await api('/api/animals')).filter((row: any) => row.status === 'culled')).toHaveLength(3);
  } finally {
    await Promise.all(contexts.map(context => context.close()));
  }
});

test('cookie-authenticated bodyless DELETE keeps the JSON CSRF boundary', async ({ browser, baseURL }) => {
  if (!baseURL || !/^http:\/\/(127\.0\.0\.1|localhost):/.test(baseURL)) throw new Error('Local acceptance only');
  const context = await browser.newContext({ serviceWorkers: 'block' });
  try {
    const page = await context.newPage(); await page.goto(baseURL + '/auth/register');
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
