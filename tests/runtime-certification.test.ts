import test, { before, after } from 'node:test';
import assert from 'node:assert/strict';
import { spawn, ChildProcessWithoutNullStreams } from 'node:child_process';

const BASE_URL = 'http://127.0.0.1:5000';
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
    await new Promise(r => setTimeout(r, 250));
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
      PORT: '5000',
    },
    stdio: 'pipe',
    detached: true,
  });

  server.stdout.on('data', (chunk) => { logs += chunk.toString(); });
  server.stderr.on('data', (chunk) => { logs += chunk.toString(); });

  await waitForServer();
});

after(async () => {
  if (server && !server.killed) {
    process.kill(-server.pid!, 'SIGTERM');
  }
});

function authHeaders() {
  return {
    'Content-Type': 'application/json',
    'x-test-user-id': 'cert-user-1',
    'x-test-device-id': 'cert-device-1',
  };
}

async function resetData() {
  await fetch(`${BASE_URL}/api/reset-all-data`, {
    method: 'POST',
    headers: authHeaders(),
    body: JSON.stringify({ confirmPhrase: 'RESET BREEDLOG' }),
  });
}

test('runtime boot and version endpoint', async () => {
  const res = await fetch(`${BASE_URL}/api/version`);
  assert.equal(res.status, 200);
  const body = await res.json();
  assert.ok(body.version);
});

test('online CRUD flow: create, read, update, delete animal', async () => {
  await resetData();
  const createRes = await fetch(`${BASE_URL}/api/animals`, {
    method: 'POST',
    headers: authHeaders(),
    body: JSON.stringify({ tagId: 'A-100', sex: 'ewe', electronicId: 'EID-100' }),
  });
  assert.equal(createRes.status, 201);
  const created = await createRes.json();
  assert.ok(created.id > 0);

  const listRes = await fetch(`${BASE_URL}/api/animals`, { headers: authHeaders() });
  assert.equal(listRes.status, 200);
  const list = await listRes.json();
  assert.equal(list.length, 1);

  const updateRes = await fetch(`${BASE_URL}/api/animals/${created.id}`, {
    method: 'PUT',
    headers: authHeaders(),
    body: JSON.stringify({ name: 'Updated Ewe' }),
  });
  assert.equal(updateRes.status, 200);
  const updated = await updateRes.json();
  assert.equal(updated.name, 'Updated Ewe');

  const deleteRes = await fetch(`${BASE_URL}/api/animals/${created.id}`, {
    method: 'DELETE',
    headers: authHeaders(),
  });
  assert.equal(deleteRes.status, 204);

  const listAfterDelete = await fetch(`${BASE_URL}/api/animals`, { headers: authHeaders() });
  const afterDelete = await listAfterDelete.json();
  assert.equal(afterDelete.length, 0);
});

test('duplicate protection check: duplicate electronicId is rejected', async () => {
  await resetData();
  const first = await fetch(`${BASE_URL}/api/animals`, {
    method: 'POST',
    headers: authHeaders(),
    body: JSON.stringify({ tagId: 'A-101', sex: 'ewe', electronicId: 'EID-DUP-1' }),
  });
  assert.equal(first.status, 201);

  const second = await fetch(`${BASE_URL}/api/animals`, {
    method: 'POST',
    headers: authHeaders(),
    body: JSON.stringify({ tagId: 'A-102', sex: 'ewe', electronicId: 'EID-DUP-1' }),
  });
  assert.equal(second.status, 400);
});

test('security check: debug endpoint is protected', async () => {
  const unauth = await fetch(`${BASE_URL}/api/debug/test`);
  assert.equal(unauth.status, 403);

  const authed = await fetch(`${BASE_URL}/api/debug/test`, {
    headers: { Authorization: 'AdminPin 1234' },
  });
  assert.equal(authed.status, 200);
});
