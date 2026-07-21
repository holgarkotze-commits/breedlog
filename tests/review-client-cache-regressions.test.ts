import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";

const source = fs.readFileSync("client/src/hooks/use-animals.ts", "utf8");

test("filtered animal lists do not prune unrelated IndexedDB cache entries", () => {
  assert.match(
    source,
    /if \(!filters\?\.search && !filters\?\.status && !filters\?\.sex\) \{\s*await pruneHiddenAnimalsFromCache\(data\);\s*\}/s,
  );
});

test("hidden-animal responses do not fall back to cached IndexedDB copies", () => {
  assert.match(source, /class AnimalVisibilityError extends Error/);
  assert.match(
    source,
    /if \(\[403, 404, 423\]\.includes\(res\.status\)\) \{\s*throw new AnimalVisibilityError\("Animal not found"\);\s*\}/s,
  );
  assert.match(
    source,
    /if \(error instanceof AnimalVisibilityError\) \{\s*throw error;\s*\}/s,
  );
});
