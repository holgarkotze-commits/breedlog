import { test, expect } from '@playwright/test';

type AnyRecord = Record<string, any>;

const authHeaders = {
  'x-test-user-id': 'browser-cert-user',
  'x-test-device-id': 'browser-cert-device',
  'Content-Type': 'application/json',
};

async function resetServer(baseURL: string) {
  await fetch(`${baseURL}/api/reset-all-data`, {
    method: 'POST',
    headers: authHeaders,
    body: JSON.stringify({ confirmPhrase: 'RESET BREEDLOG' }),
  });
}

test.describe('BreedLog offline + sync certification', () => {
  test('offline create, reload persistence, reconnect drain, and final consistency', async ({ page, context, baseURL }) => {
    if (!baseURL) throw new Error('Missing baseURL');

    await resetServer(baseURL);
    await page.goto('/');

    // seed one online record via API (online CRUD baseline)
    const baselineCreate = await fetch(`${baseURL}/api/animals`, {
      method: 'POST',
      headers: authHeaders,
      body: JSON.stringify({ tagId: 'CERT-BASE-1', sex: 'ewe' }),
    });
    expect([200, 201]).toContain(baselineCreate.status);

    // Offline create flow (write directly to local IndexedDB to validate sync drain mechanics)
    await context.setOffline(true);
    const offlineCreate = await page.evaluate(async () => {
      const req = indexedDB.open('BreedLogDB');
      const db = await new Promise<IDBDatabase>((resolve, reject) => {
        req.onsuccess = () => resolve(req.result);
        req.onerror = () => reject(req.error);
      });

      const tx = db.transaction(['animals', 'syncQueue'], 'readwrite');
      const animals = tx.objectStore('animals');
      const queue = tx.objectStore('syncQueue');

      const tempId = -Date.now();
      const animal = {
        id: tempId,
        tagId: `CERT-OFF-${Math.abs(tempId)}`,
        sex: 'ewe',
        synced: 0,
      };

      animals.put(animal);
      queue.put({
        id: crypto.randomUUID(),
        action: 'create',
        entity: 'animals',
        data: animal,
        tempId,
        operationId: crypto.randomUUID(),
        clientOperationId: crypto.randomUUID(),
        idempotencyKey: crypto.randomUUID(),
        timestamp: Date.now(),
        synced: 0,
        syncStatus: 'pending',
      });

      await new Promise<void>((resolve, reject) => {
        tx.oncomplete = () => resolve();
        tx.onerror = () => reject(tx.error);
      });

      return tempId;
    });

    const beforeReload = await page.evaluate(async () => {
      const req = indexedDB.open('BreedLogDB');
      const db = await new Promise<IDBDatabase>((resolve, reject) => {
        req.onsuccess = () => resolve(req.result);
        req.onerror = () => reject(req.error);
      });
      const tx = db.transaction(['animals', 'syncQueue'], 'readonly');
      const animals = tx.objectStore('animals');
      const queue = tx.objectStore('syncQueue');

      const allAnimals = await new Promise<any[]>((resolve, reject) => {
        const r = animals.getAll();
        r.onsuccess = () => resolve(r.result || []);
        r.onerror = () => reject(r.error);
      });
      const allQueue = await new Promise<any[]>((resolve, reject) => {
        const r = queue.getAll();
        r.onsuccess = () => resolve(r.result || []);
        r.onerror = () => reject(r.error);
      });
      return { animals: allAnimals.length, queue: allQueue.length };
    });

    expect(beforeReload.animals).toBeGreaterThan(0);
    expect(beforeReload.queue).toBeGreaterThan(0);

    // Offline reload persistence
    await page.reload();
    const persistedQueueCount = await page.evaluate(async () => {
      const req = indexedDB.open('BreedLogDB');
      const db = await new Promise<IDBDatabase>((resolve, reject) => {
        req.onsuccess = () => resolve(req.result);
        req.onerror = () => reject(req.error);
      });
      const tx = db.transaction('syncQueue', 'readonly');
      const store = tx.objectStore('syncQueue');
      return await new Promise<number>((resolve, reject) => {
        const r = store.count();
        r.onsuccess = () => resolve(r.result || 0);
        r.onerror = () => reject(r.error);
      });
    });
    expect(persistedQueueCount).toBeGreaterThan(0);

    // Reconnect + sync drain
    await context.setOffline(false);
    await page.waitForTimeout(1500);
    await page.evaluate(() => window.dispatchEvent(new Event('online')));

    await expect
      .poll(async () => {
        const res = await fetch(`${baseURL}/api/animals`, { headers: authHeaders });
        const records: AnyRecord[] = await res.json();
        return records.filter((r) => String(r.tagId || '').startsWith('CERT-OFF-')).length;
      }, { timeout: 30_000 })
      .toBe(1);

    // Final local/server consistency + no stale temp IDs + no queued leftovers
    const finalLocal = await page.evaluate(async () => {
      const req = indexedDB.open('BreedLogDB');
      const db = await new Promise<IDBDatabase>((resolve, reject) => {
        req.onsuccess = () => resolve(req.result);
        req.onerror = () => reject(req.error);
      });
      const tx = db.transaction(['animals', 'syncQueue'], 'readonly');
      const animals = tx.objectStore('animals');
      const queue = tx.objectStore('syncQueue');

      const allAnimals = await new Promise<any[]>((resolve, reject) => {
        const r = animals.getAll();
        r.onsuccess = () => resolve(r.result || []);
        r.onerror = () => reject(r.error);
      });
      const allQueue = await new Promise<any[]>((resolve, reject) => {
        const r = queue.getAll();
        r.onsuccess = () => resolve(r.result || []);
        r.onerror = () => reject(r.error);
      });

      return {
        animals: allAnimals,
        queue: allQueue,
        hasTempIds: allAnimals.some((a) => typeof a.id === 'number' && a.id < 0),
      };
    });

    const serverRes = await fetch(`${baseURL}/api/animals`, { headers: authHeaders });
    const serverAnimals: AnyRecord[] = await serverRes.json();

    expect(finalLocal.hasTempIds).toBe(false);
    expect(finalLocal.queue.length).toBe(0);
    expect(serverAnimals.length).toBeGreaterThanOrEqual(2);
    expect(serverAnimals.filter((r) => String(r.tagId || '').startsWith('CERT-OFF-')).length).toBe(1);

    // Prevent test variable from being optimized away by lint rules and verify deterministic temp creation happened.
    expect(typeof offlineCreate).toBe('number');
  });
});
