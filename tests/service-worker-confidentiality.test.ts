import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync } from "node:fs";
import { runInNewContext } from "node:vm";

test("worker never reads or populates an origin-wide API cache, even offline or on navigation", async () => {
  const handlers = new Map<string, (event: any) => void>();
  let cacheReads = 0, cacheWrites = 0;
  let offline = false;
  runInNewContext(readFileSync("client/public/sw.js", "utf8"), {
    URL, Response, console,
    self: { addEventListener: (name: string, fn: any) => handlers.set(name, fn) },
    fetch: async () => { if (offline) throw new Error("Offline"); return Response.json([{ id: 1, name: "Visible" }]); },
    caches: {
      match: async () => { cacheReads++; return Response.json([{ id: 31, name: "Private Premium row" }]); },
      open: async () => ({ put: () => { cacheWrites++; } }),
    },
  });
  for (const mode of ["cors", "navigate"]) for (const path of ["/api/animals?search=private", "/api/animals/31", "/api/health-records", "/api/auth/me"]) {
    const dispatch = () => {
      let response: Promise<Response> | undefined;
      handlers.get("fetch")!({ request: { url: "https://breedlog.test" + path, method: "GET", mode }, respondWith: (value: Promise<Response>) => { response = value; } });
      assert.ok(response); return response!;
    };
    offline = false;
    assert.deepEqual(await (await dispatch()).json(), [{ id: 1, name: "Visible" }]);
    offline = true;
    await assert.rejects(dispatch(), /Offline/);
  }
  assert.equal(cacheReads, 0); assert.equal(cacheWrites, 0);
});

test("worker activation removes previously cached private API responses", async () => {
  let activate: (event: any) => void = () => {};
  const removed: string[] = [];
  runInNewContext(readFileSync("client/public/sw.js", "utf8"), {
    console,
    self: { addEventListener: (name: string, fn: any) => { if (name === "activate") activate = fn; }, clients: { claim: () => {}, matchAll: async () => [] } },
    caches: { keys: async () => ["breedlog-api-v3", "breedlog-static-v3", "breedlog-static-v4", "breedlog-shell-v4"], delete: async (name: string) => { removed.push(name); } },
  });
  let completed: Promise<void> | undefined;
  activate({ waitUntil: (value: Promise<void>) => { completed = value; } });
  await completed;
  assert.deepEqual(removed.sort(), ["breedlog-api-v3", "breedlog-static-v3"]);
});
