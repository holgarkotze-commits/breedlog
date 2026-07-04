import { test, expect, type Page } from '@playwright/test';

const DEVICE_ALERT = 'da01aabb-cc11-2233-4455-667788990011';
const DEVICE_EMPTY = 'da02aabb-cc11-2233-4455-667788990022';
const DEVICE_DISMISS = 'da03aabb-cc11-2233-4455-667788990033';
const DEVICE_REAPPEAR = 'da04aabb-cc11-2233-4455-667788990044';
const DEVICE_OFFLINE_HEALTH = 'da05aabb-cc11-2233-4455-667788990055';
const INVITE_CODE = 'U2A2ZAVQ';

async function registerDevice(baseURL: string, deviceId: string): Promise<string> {
  const res = await fetch(`${baseURL}/api/device/register`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ deviceId, deviceName: 'Decision Alert E2E Spec' }),
  });
  if (!res.ok) throw new Error(`register failed: ${res.status} ${await res.text()}`);
  const data = (await res.json()) as { deviceToken: string };
  return data.deviceToken;
}

async function validateInviteCode(baseURL: string, deviceId: string): Promise<void> {
  const res = await fetch(`${baseURL}/api/beta/validate`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ code: INVITE_CODE, deviceId, deviceType: 'desktop' }),
  });
  if (!res.ok) throw new Error(`validate failed: ${res.status} ${await res.text()}`);
  const data = (await res.json()) as { success: boolean };
  if (!data.success) throw new Error('validate returned success=false');
}

async function prepareAndOpenDashboard(page: Page, deviceId: string, deviceToken: string): Promise<void> {
  await page.addInitScript(
    ({ id, token }: { id: string; token: string }) => {
      localStorage.setItem('breedlog_device_id', id);
      localStorage.setItem('breedlog_device_token', token);
      localStorage.setItem(
        'breedlog_beta_access',
        JSON.stringify({ hasAccess: true, lastCheck: new Date().toISOString() }),
      );
      localStorage.setItem('breedlog_dismissed_alerts', '[]');
      localStorage.setItem('breedlog_install_skipped', String(Date.now()));
    },
    { id: deviceId, token: deviceToken },
  );
  await page.goto('/');
  await page.waitForLoadState('networkidle');
}

test.describe('Decision Assist alerts – Dashboard certification', () => {
  test('shows alert cards when triggering data exists (mating end within 14 days + lambing season)', async ({
    page,
    baseURL,
  }) => {
    if (!baseURL) throw new Error('Missing baseURL');

    const deviceToken = await registerDevice(baseURL, DEVICE_ALERT);
    await validateInviteCode(baseURL, DEVICE_ALERT);

    const dateOut = new Date();
    dateOut.setDate(dateOut.getDate() + 7);
    const dateOutStr = dateOut.toISOString().slice(0, 10);

    await fetch(`${baseURL}/api/mating-groups`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${deviceToken}` },
      body: JSON.stringify({ name: 'DA Cert Ram Group', dateOut: dateOutStr }),
    });

    await prepareAndOpenDashboard(page, DEVICE_ALERT, deviceToken);

    await expect(page.locator('[data-testid="decision-assist-alerts"]')).toBeVisible({ timeout: 15_000 });

    const cards = page.locator('[data-testid^="decision-alert-"]');
    await expect(cards.first()).toBeVisible({ timeout: 5_000 });
    expect(await cards.count()).toBeGreaterThan(0);
  });

  test('hides alert section entirely when no alerts apply (date mocked to March, no health/breeding triggers)', async ({
    page,
    baseURL,
  }) => {
    if (!baseURL) throw new Error('Missing baseURL');

    const deviceToken = await registerDevice(baseURL, DEVICE_EMPTY);
    await validateInviteCode(baseURL, DEVICE_EMPTY);

    const frozenMs = new Date('2026-03-15T10:00:00Z').getTime();

    await page.addInitScript(
      ({ id, token, frozen }: { id: string; token: string; frozen: number }) => {
        localStorage.setItem('breedlog_device_id', id);
        localStorage.setItem('breedlog_device_token', token);
        localStorage.setItem(
          'breedlog_beta_access',
          JSON.stringify({ hasAccess: true, lastCheck: new Date(frozen).toISOString() }),
        );
        localStorage.setItem('breedlog_dismissed_alerts', '[]');
        localStorage.setItem('breedlog_install_skipped', String(frozen));

        const OrigDate = Date;
        function PatchedDate(this: Date, ...args: ConstructorParameters<typeof Date>) {
          if (args.length === 0) return new OrigDate(frozen) as Date;
          return new (OrigDate as typeof Date)(...args) as Date;
        }
        (PatchedDate as unknown as typeof Date).now = () => frozen;
        (PatchedDate as unknown as typeof Date).parse = OrigDate.parse.bind(OrigDate);
        (PatchedDate as unknown as typeof Date).UTC = OrigDate.UTC.bind(OrigDate);
        Object.setPrototypeOf(PatchedDate, OrigDate);
        PatchedDate.prototype = OrigDate.prototype;
        (window as unknown as Record<string, unknown>)['Date'] = PatchedDate;
      },
      { id: DEVICE_EMPTY, token: deviceToken, frozen: frozenMs },
    );

    await page.goto('/');
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(3_000);

    await expect(page.locator('[data-testid="decision-assist-alerts"]')).not.toBeVisible({ timeout: 5_000 });
  });

  test('dismiss button immediately removes alert card from DOM', async ({ page, baseURL }) => {
    if (!baseURL) throw new Error('Missing baseURL');

    const deviceToken = await registerDevice(baseURL, DEVICE_DISMISS);
    await validateInviteCode(baseURL, DEVICE_DISMISS);

    // Create a mating group ending within 14 days to guarantee an alert is shown
    const dateOut = new Date();
    dateOut.setDate(dateOut.getDate() + 5);
    const dateOutStr = dateOut.toISOString().slice(0, 10);
    await fetch(`${baseURL}/api/mating-groups`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${deviceToken}` },
      body: JSON.stringify({ name: 'DA Dismiss Test Group', dateOut: dateOutStr }),
    });

    await prepareAndOpenDashboard(page, DEVICE_DISMISS, deviceToken);

    // Wait for at least one alert card to appear
    await expect(page.locator('[data-testid="decision-assist-alerts"]')).toBeVisible({ timeout: 15_000 });
    const firstCard = page.locator('[data-testid^="decision-alert-"]').first();
    await expect(firstCard).toBeVisible({ timeout: 5_000 });

    // Record which alert key is being dismissed
    const cardTestId = await firstCard.getAttribute('data-testid');
    const alertKey = cardTestId?.replace('decision-alert-', '') ?? '';

    // Click the dismiss button for that specific alert
    const dismissBtn = page.locator(`[data-testid="button-dismiss-alert-${alertKey}"]`);
    await expect(dismissBtn).toBeVisible();
    await dismissBtn.click();

    // The card must be removed from the DOM entirely (not just hidden)
    await expect(page.locator(`[data-testid="decision-alert-${alertKey}"]`)).toHaveCount(0, { timeout: 2_000 });

    // Verify the dismissal was persisted to localStorage
    const stored = await page.evaluate(() => localStorage.getItem('breedlog_dismissed_alerts'));
    const dismissals: Array<{ key: string; dismissedAt: string }> = stored ? JSON.parse(stored) : [];
    const entry = dismissals.find((d) => d.key === alertKey);
    expect(entry).toBeTruthy();
    expect(entry?.dismissedAt).toBeTruthy();
  });

  test('dismissed alert reappears after 7-day window expires', async ({ page, baseURL }) => {
    if (!baseURL) throw new Error('Missing baseURL');

    const deviceToken = await registerDevice(baseURL, DEVICE_REAPPEAR);
    await validateInviteCode(baseURL, DEVICE_REAPPEAR);

    // Freeze browser time to 15 July 2026 — deterministically inside lambing season
    // regardless of when this test runs in the real calendar.
    const frozenMs = new Date('2026-07-15T10:00:00Z').getTime();
    const lambingAlertKey = 'lambing-season-2026';

    // Stale dismissal: 8 days before the frozen "now" (past the 7-day suppression window)
    const eightDaysBeforeFrozen = new Date(frozenMs - 8 * 24 * 60 * 60 * 1000).toISOString();
    const staleDismissals = JSON.stringify([{ key: lambingAlertKey, dismissedAt: eightDaysBeforeFrozen }]);

    await page.addInitScript(
      ({ id, token, dismissals, frozen }: { id: string; token: string; dismissals: string; frozen: number }) => {
        localStorage.setItem('breedlog_device_id', id);
        localStorage.setItem('breedlog_device_token', token);
        localStorage.setItem(
          'breedlog_beta_access',
          JSON.stringify({ hasAccess: true, lastCheck: new Date(frozen).toISOString() }),
        );
        // Pre-populate with a stale dismissal (8 days old relative to frozen "now")
        localStorage.setItem('breedlog_dismissed_alerts', dismissals);
        localStorage.setItem('breedlog_install_skipped', String(frozen));

        // Freeze Date so generateAllAlerts sees July 2026 and produces the lambing alert
        const OrigDate = Date;
        function PatchedDate(this: Date, ...args: ConstructorParameters<typeof Date>) {
          if (args.length === 0) return new OrigDate(frozen) as Date;
          return new (OrigDate as typeof Date)(...args) as Date;
        }
        (PatchedDate as unknown as typeof Date).now = () => frozen;
        (PatchedDate as unknown as typeof Date).parse = OrigDate.parse.bind(OrigDate);
        (PatchedDate as unknown as typeof Date).UTC = OrigDate.UTC.bind(OrigDate);
        Object.setPrototypeOf(PatchedDate, OrigDate);
        PatchedDate.prototype = OrigDate.prototype;
        (window as unknown as Record<string, unknown>)['Date'] = PatchedDate;
      },
      { id: DEVICE_REAPPEAR, token: deviceToken, dismissals: staleDismissals, frozen: frozenMs },
    );

    await page.goto('/');
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(2_000);

    // The lambing-season alert must be visible because the 8-day-old dismissal is expired
    await expect(page.locator(`[data-testid="decision-alert-${lambingAlertKey}"]`)).toBeVisible({ timeout: 10_000 });
  });

  test('offline health record with overdue follow-up shows alert when device comes back online', async ({
    page,
    baseURL,
  }) => {
    if (!baseURL) throw new Error('Missing baseURL');

    const deviceToken = await registerDevice(baseURL, DEVICE_OFFLINE_HEALTH);
    await validateInviteCode(baseURL, DEVICE_OFFLINE_HEALTH);

    // Yesterday's date as the overdue follow-up
    const yesterday = new Date();
    yesterday.setDate(yesterday.getDate() - 1);
    const overdueDate = yesterday.toISOString().slice(0, 10);

    // Step 1: Set localStorage auth so the app initialises (and opens IndexedDB) on first load.
    await page.addInitScript(
      ({ id, token }: { id: string; token: string }) => {
        localStorage.setItem('breedlog_device_id', id);
        localStorage.setItem('breedlog_device_token', token);
        localStorage.setItem(
          'breedlog_beta_access',
          JSON.stringify({ hasAccess: true, lastCheck: new Date().toISOString() }),
        );
        localStorage.setItem('breedlog_dismissed_alerts', '[]');
        localStorage.setItem('breedlog_install_skipped', String(Date.now()));
      },
      { id: DEVICE_OFFLINE_HEALTH, token: deviceToken },
    );

    // Step 2: Load the page so the app opens and upgrades 'breedlog-offline' to v4,
    // creating the syncQueue object store if it doesn't exist yet.
    await page.goto('/');
    await page.waitForLoadState('networkidle');

    // Step 3: Seed the syncQueue in the correct database ('breedlog-offline', v4).
    // We use page.evaluate here — after the app has already opened/upgraded the DB —
    // so the syncQueue store is guaranteed to exist.
    const seeded = await page.evaluate(async (overdue: string) => {
      return new Promise<boolean>((resolve, reject) => {
        const openReq = indexedDB.open('breedlog-offline', 4);
        openReq.onerror = () => reject(openReq.error);
        openReq.onsuccess = () => {
          const db = openReq.result;
          if (!db.objectStoreNames.contains('syncQueue')) {
            db.close();
            resolve(false);
            return;
          }
          const tempId = -Date.now();
          const queueItem = {
            id: crypto.randomUUID(),
            action: 'create',
            entity: 'flockHealthEvents',
            data: {
              eventName: 'Offline Vaccination',
              eventDate: overdue,
              productName: 'Test Vaccine',
              route: 'subcutaneous',
              nextFollowUpDate: overdue,
              treatAllAnimals: true,
              treatments: [],
            },
            tempId,
            timestamp: Date.now(),
            synced: 0,
            syncStatus: 'pending',
            failedAttempts: 0,
          };
          const tx = db.transaction('syncQueue', 'readwrite');
          tx.objectStore('syncQueue').put(queueItem);
          tx.oncomplete = () => { db.close(); resolve(true); };
          tx.onerror = () => { db.close(); reject(tx.error); };
        };
      });
    }, overdueDate);

    if (!seeded) throw new Error('Failed to seed syncQueue — store not found in breedlog-offline');

    // Step 4: Reload so React Query re-runs useFlockHealthEvents and merges the pending item.
    await page.reload();
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(3_000);

    // The overdue health follow-up alert must be visible — driven by the pending offline record.
    await expect(page.locator('[data-testid="decision-assist-alerts"]')).toBeVisible({ timeout: 15_000 });
    await expect(page.locator('[data-testid="decision-alert-health-followup-overdue"]')).toBeVisible({
      timeout: 5_000,
    });
  });
});
