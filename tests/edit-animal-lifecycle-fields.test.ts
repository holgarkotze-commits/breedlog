import test, { before, after } from 'node:test';
import assert from 'node:assert/strict';
import { spawn, ChildProcessWithoutNullStreams } from 'node:child_process';
import { isMetricWeight, resolveBirthWeight, resolveWeaningWeight } from '../shared/animal-lifecycle';

const BASE_URL = 'http://127.0.0.1:5002';
let server: ChildProcessWithoutNullStreams | null = null;
let logs = '';

async function waitForServer(timeoutMs = 20000) {
  const start = Date.now();
  while (Date.now() - start < timeoutMs) {
    try {
      const res = await fetch(`${BASE_URL}/api/version`);
      if (res.ok) return;
    } catch {
      // retry
    }
    await new Promise((r) => setTimeout(r, 250));
  }
  throw new Error(`Server did not become ready. Logs:\n${logs}`);
}

before(async () => {
  server = spawn('./node_modules/.bin/tsx', ['server/index.ts'], {
    env: {
      ...process.env,
      NODE_ENV: 'test',
      USE_IN_MEMORY_STORAGE: '1',
      SESSION_SECRET: 'test-secret',
      ADMIN_PIN: '1234',
      PORT: '5002',
    },
    stdio: 'pipe',
    detached: true,
  });

  server.stdout.on('data', (chunk) => {
    logs += chunk.toString();
  });
  server.stderr.on('data', (chunk) => {
    logs += chunk.toString();
  });

  await waitForServer();
});

after(async () => {
  if (server && !server.killed) {
    process.kill(-server.pid!, 'SIGTERM');
  }
});

function authHeaders(user = 'lifecycle-user-1') {
  return {
    'Content-Type': 'application/json',
    'x-test-user-id': user,
    'x-test-device-id': `${user}-device`,
  };
}

async function resetData(user = 'lifecycle-user-1') {
  await fetch(`${BASE_URL}/api/reset-all-data`, {
    method: 'POST',
    headers: authHeaders(user),
    body: JSON.stringify({ confirmPhrase: 'RESET BREEDLOG' }),
  });
}

test('lamb can be created without weaning and later updated without losing core fields', async () => {
  await resetData();

  const createRes = await fetch(`${BASE_URL}/api/animals`, {
    method: 'POST',
    headers: authHeaders(),
    body: JSON.stringify({
      tagId: 'LIFE-001',
      sex: 'ewe',
      birthDate: '2025-01-10',
      birthWeight: '3.8',
      status: 'active',
    }),
  });
  assert.equal(createRes.status, 201);
  const created = await createRes.json();

  const updateRes = await fetch(`${BASE_URL}/api/animals/${created.id}`, {
    method: 'PUT',
    headers: authHeaders(),
    body: JSON.stringify({
      weight100DayDate: '2025-04-20',
      weight100Day: '29.4',
      weaningStatus: 'normal',
    }),
  });
  assert.equal(updateRes.status, 200);

  const getRes = await fetch(`${BASE_URL}/api/animals/${created.id}`, { headers: authHeaders() });
  assert.equal(getRes.status, 200);
  const updated = await getRes.json();

  assert.equal(updated.birthDate, '2025-01-10');
  assert.equal(updated.birthWeight, '3.8');
  assert.equal(updated.tagId, 'LIFE-001');
  assert.equal(updated.status, 'active');
  assert.equal(updated.weight100DayDate, '2025-04-20');
  assert.equal(updated.weight100Day, '29.4');
});

test('duplicate EID is blocked during update', async () => {
  await resetData();

  const first = await fetch(`${BASE_URL}/api/animals`, {
    method: 'POST',
    headers: authHeaders(),
    body: JSON.stringify({ tagId: 'LIFE-010', sex: 'ewe', electronicId: 'EID-LIFE-1' }),
  });
  const second = await fetch(`${BASE_URL}/api/animals`, {
    method: 'POST',
    headers: authHeaders(),
    body: JSON.stringify({ tagId: 'LIFE-011', sex: 'ewe' }),
  });
  const secondBody = await second.json();

  assert.equal(first.status, 201);
  assert.equal(second.status, 201);

  const dupUpdate = await fetch(`${BASE_URL}/api/animals/${secondBody.id}`, {
    method: 'PUT',
    headers: authHeaders(),
    body: JSON.stringify({ electronicId: 'EID-LIFE-1' }),
  });
  assert.equal(dupUpdate.status, 400);
});

test('estimated flags are tracked and actual values override estimated state', () => {
  const estimatedBirth = resolveBirthWeight(null, true);
  assert.equal(estimatedBirth.value, null);
  assert.equal(estimatedBirth.estimated, true);

  const actualBirth = resolveBirthWeight('4.2', true);
  assert.equal(actualBirth.value, '4.2');
  assert.equal(actualBirth.estimated, false);

  const estimatedWeaning = resolveWeaningWeight('', true);
  assert.equal(estimatedWeaning.value, null);
  assert.equal(estimatedWeaning.estimated, true);

  const actualWeaning = resolveWeaningWeight('31.0', true);
  assert.equal(actualWeaning.value, '31.0');
  assert.equal(actualWeaning.estimated, false);
});

test('metric validation helper rejects invalid text values', () => {
  assert.equal(isMetricWeight('31.2'), true);
  assert.equal(isMetricWeight(''), true);
  assert.equal(isMetricWeight('31kg'), false);
  assert.equal(isMetricWeight('abc'), false);
});
