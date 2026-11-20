import assert from "node:assert/strict";
import test from "node:test";
import express from "express";
import { createServer } from "node:http";
import { InMemoryStorage, storage } from "../server/storage";
import { registerRoutes } from "../server/routes";

test("in-memory counter also enforces simultaneous limits and fixed-window boundaries", async () => {
  const store = new InMemoryStorage();
  for (const limit of [3, 5, 12]) {
    const key = `counter-${limit}`;
    const results = await Promise.all(Array.from({ length: 40 }, () => store.consumeAuthAttempt(key, 100, limit)));
    assert.equal(results.filter(Boolean).length, limit);
    assert.equal(await store.consumeAuthAttempt(key, 101, limit), true);
    assert.equal(await store.consumeAuthAttempt(key, 100, limit), false);
    const next = await Promise.all(Array.from({ length: 20 }, () => store.consumeAuthAttempt(key, 101, limit)));
    assert.equal(next.filter(Boolean).length, Math.max(0, limit - 2));
  }
});

test("identity counter failure denies signup, login and recovery before any auth work", async () => {
  const app = express(); app.use(express.json());
  const server = createServer(app);
  await registerRoutes(server, app);
  await new Promise<void>(resolve => server.listen(0, "127.0.0.1", resolve));
  const old = storage.consumeAuthAttempt;
  storage.consumeAuthAttempt = async () => { throw new Error("private-database-context"); };
  try {
    for (const path of ["register", "login", "recovery/request", "recovery/confirm"]) {
      const response = await fetch(`http://127.0.0.1:${(server.address() as any).port}/api/auth/${path}`, {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: "counter-failure@example.test", password: "long-test-password", acceptedTerms: true,
          token: "invalid-recovery-token", newPassword: "long-test-password" }),
      });
      assert.equal(response.status, 503);
      const body = await response.json();
      assert.equal(body.code, "AUTH_PROTECTION_UNAVAILABLE");
      assert.doesNotMatch(JSON.stringify(body), /private-database/);
    }
    assert.equal(await storage.getAccountByEmail("counter-failure@example.test"), undefined);
  } finally {
    storage.consumeAuthAttempt = old;
    server.closeAllConnections();
    await new Promise<void>(resolve => server.close(() => resolve()));
  }
});
