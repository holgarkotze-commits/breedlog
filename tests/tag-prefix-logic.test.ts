import test, { before, after } from 'node:test';
import assert from 'node:assert/strict';
import { splitTagInput, nextTagRawSequence } from '../shared/tag-utils';
import { spawn, ChildProcessWithoutNullStreams } from 'node:child_process';

const BASE_URL = 'http://127.0.0.1:5001';
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
      PORT: '5001',
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

function authHeaders(user = 'prefix-user-1') {
  return {
    'Content-Type': 'application/json',
    'x-test-user-id': user,
    'x-test-device-id': `${user}-device`,
  };
}

async function resetData(user = 'prefix-user-1') {
  await fetch(`${BASE_URL}/api/reset-all-data`, {
    method: 'POST',
    headers: authHeaders(user),
    body: JSON.stringify({ confirmPhrase: 'RESET BREEDLOG' }),
  });
}

test('splitTagInput normalizes prefixed/unprefixed/casing/spacing variants', () => {
  assert.equal(splitTagInput('24-001', 'KW').canonicalTag, 'KW24-001');
  assert.equal(splitTagInput('KW24-001', 'KW').canonicalTag, 'KW24-001');
  assert.equal(splitTagInput('kw24-001', 'KW').canonicalTag, 'KW24-001');
  assert.equal(splitTagInput(' KW 24 - 001 ', 'kw').canonicalTag, 'KW24-001');
});

test('nextTagRawSequence generates expected sequence boundaries', () => {
  assert.equal(nextTagRawSequence([], 'KW', 2024), '24-001');
  assert.equal(nextTagRawSequence(['KW24-009'], 'KW', 2024), '24-010');
  assert.equal(nextTagRawSequence(['KW24-099'], 'KW', 2024), '24-100');
});

test('server blocks duplicate canonical tag on create and update; allows same raw in another account', async () => {
  const u1 = 'prefix-user-1';
  const u2 = 'prefix-user-2';
  await resetData(u1);
  await resetData(u2);

  await fetch(`${BASE_URL}/api/farm-settings`, {
    method: 'POST',
    headers: authHeaders(u1),
    body: JSON.stringify({ studPrefix: 'KW' }),
  });

  const create1 = await fetch(`${BASE_URL}/api/animals`, {
    method: 'POST',
    headers: authHeaders(u1),
    body: JSON.stringify({ tagId: '24-001', studPrefix: 'KW', sex: 'ewe' }),
  });
  assert.equal(create1.status, 201);

  const dupCreate = await fetch(`${BASE_URL}/api/animals`, {
    method: 'POST',
    headers: authHeaders(u1),
    body: JSON.stringify({ tagId: 'KW24-001', studPrefix: 'KW', sex: 'ewe' }),
  });
  assert.equal(dupCreate.status, 400);

  const create2 = await fetch(`${BASE_URL}/api/animals`, {
    method: 'POST',
    headers: authHeaders(u1),
    body: JSON.stringify({ tagId: '24-002', studPrefix: 'KW', sex: 'ewe' }),
  });
  assert.equal(create2.status, 201);
  const created2 = await create2.json();

  const dupUpdate = await fetch(`${BASE_URL}/api/animals/${created2.id}`, {
    method: 'PUT',
    headers: authHeaders(u1),
    body: JSON.stringify({ tagId: 'kw24-001', studPrefix: 'KW' }),
  });
  assert.equal(dupUpdate.status, 400);

  await fetch(`${BASE_URL}/api/farm-settings`, {
    method: 'POST',
    headers: authHeaders(u2),
    body: JSON.stringify({ studPrefix: 'AB' }),
  });
  const otherAccountCreate = await fetch(`${BASE_URL}/api/animals`, {
    method: 'POST',
    headers: authHeaders(u2),
    body: JSON.stringify({ tagId: '24-001', sex: 'ewe' }),
  });
  assert.equal(otherAccountCreate.status, 201);
});
