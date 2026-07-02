import { test, expect, type Page } from '@playwright/test';

const DEVICE_ALERT = 'da01aabb-cc11-2233-4455-667788990011';
const DEVICE_EMPTY = 'da02aabb-cc11-2233-4455-667788990022';
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
});
