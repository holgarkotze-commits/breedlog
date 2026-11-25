import test from "node:test";
import assert from "node:assert/strict";
import { InMemoryStorage } from "../server/storage";
import { createAnimalWithinLimit, updateAnimalWithinLimit, EntitlementDeniedError, setInternalTestEntitlement } from "../server/commercial";

test("parallel Free creates retain exactly 30 original registrations, including inactive animals", async () => {
  const store = new InMemoryStorage(), account = "parallel-free";
  const results = await Promise.allSettled(Array.from({ length: 40 }, (_, i) =>
    createAnimalWithinLimit(store, account, { tagId: `FREE-${i}`, sex: "ewe", status: i % 2 ? "active" : "culled" })));
  assert.equal(results.filter(r => r.status === "fulfilled").length, 30);
  const rejected = results.filter(r => r.status === "rejected");
  assert.equal(rejected.length, 10);
  for (const result of rejected) {
    assert.ok(result.reason instanceof EntitlementDeniedError);
    assert.equal(result.reason.code, "ACTIVE_ANIMAL_LIMIT_REACHED");
  }
  assert.equal((await store.getAnimals(account)).length, 30);
});

test("idempotent creates reuse a full farm's original record; failed writes release the lock", async () => {
  const store = new InMemoryStorage(), account = "parallel-replay";
  const results = await Promise.all(Array.from({ length: 40 }, () =>
    createAnimalWithinLimit(store, account, { tagId: "REPLAY", sex: "ewe", clientId: "one-offline-record" })));
  assert.equal(results.filter(r => r.created).length, 1);
  for (let i = 1; i < 30; i++) await createAnimalWithinLimit(store, account, { tagId: `ROW-${i}`, sex: "ewe" });
  assert.equal((await createAnimalWithinLimit(store, account, { tagId: "REPLAY", sex: "ewe", clientId: "one-offline-record" })).created, false);
  const other = "write-error";
  await createAnimalWithinLimit(store, other, { tagId: "DUP", sex: "ewe" });
  await assert.rejects(createAnimalWithinLimit(store, other, { tagId: "DUP", sex: "ewe" }));
  await createAnimalWithinLimit(store, other, { tagId: "AFTER-ERROR", sex: "ewe" });
  assert.equal((await store.getAnimals(other)).length, 2);
});

test("reactivation serializes its status re-read and preserves the internal-test bypass", async () => {
  const store = new InMemoryStorage(), account = "reactivation";
  const inactive = await Promise.all(Array.from({ length: 2 }, (_, i) =>
    store.createAnimal(account, { tagId: `INACTIVE-${i}`, sex: "ewe", status: "culled" })));
  for (let i = 0; i < 29; i++) await store.createAnimal(account, { tagId: `ACTIVE-${i}`, sex: "ewe", status: "active" });
  const results = await Promise.allSettled(inactive.map(a => updateAnimalWithinLimit(store, account, a.id, { status: "active" })));
  assert.equal(results.filter(r => r.status === "fulfilled").length, 1);
  assert.equal((await store.getAnimals(account, { status: "active" })).length, 30);
  await setInternalTestEntitlement(store, "internal");
  await Promise.all(Array.from({ length: 40 }, (_, i) => createAnimalWithinLimit(store, "internal", { tagId: `INTERNAL-${i}`, sex: "ewe" })));
  assert.equal((await store.getAnimals("internal")).length, 40);
});
