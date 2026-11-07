import test from "node:test";
import assert from "node:assert/strict";
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { spawnSync } from "node:child_process";

for (const scenario of [
  { name: "missing evidence", result: undefined, allowed: false },
  { name: "failed tests", result: { passed: false, sourceSha: "certified-source" }, allowed: false },
  { name: "stale source evidence", result: { passed: true, sourceSha: "different-source" }, allowed: false },
  { name: "successful current-source evidence", result: { passed: true, sourceSha: "certified-source" }, allowed: true },
]) {
  test(`release gate ${scenario.allowed ? "accepts" : "rejects"} ${scenario.name}`, () => {
    const cwd = mkdtempSync(join(tmpdir(), "breedlog-release-gate-"));
    try {
      mkdirSync(join(cwd, "artifacts"));
      if (scenario.result) writeFileSync(join(cwd, "artifacts/release-certification.json"), JSON.stringify(scenario.result));
      const result = spawnSync(process.execPath, [
        "--import", import.meta.resolve("tsx"), resolve("scripts/check-certification-result.ts"),
      ], { cwd, env: { ...process.env, CI: "true", GITHUB_SHA: "certified-source" } });
      assert.equal(result.status === 0, scenario.allowed);
    } finally {
      rmSync(cwd, { recursive: true, force: true });
    }
  });
}
