import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";

const source = fs.readFileSync("server/index.ts", "utf8");

test("strict auth limiter protects the managed account authentication endpoints", () => {
  assert.match(source, /app\.use\("\/api\/auth\/register", authLimiter\);/);
  assert.match(source, /app\.use\("\/api\/auth\/login", authLimiter\);/);
  assert.match(source, /app\.use\("\/api\/auth\/recovery\/request", authLimiter\);/);
});
