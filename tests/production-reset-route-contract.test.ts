import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

const SETTINGS_SOURCE = readFileSync(
  fileURLToPath(new URL("../client/src/pages/Settings.tsx", import.meta.url)),
  "utf8",
);

const ROUTES_SOURCE = readFileSync(
  fileURLToPath(new URL("../server/routes.ts", import.meta.url)),
  "utf8",
);

test("production reset UI targets the authenticated reset-all-data route", () => {
  assert.match(SETTINGS_SOURCE, /fetch\("\/api\/reset-all-data"/);
  assert.doesNotMatch(SETTINGS_SOURCE, /fetch\("\/api\/admin\/reset"/);
});

test("server exposes the reset-all-data route behind auth", () => {
  assert.match(ROUTES_SOURCE, /app\.post\("\/api\/reset-all-data",\s*requireAuth,/);
});
