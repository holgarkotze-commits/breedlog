import { describe, test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";

const writerPath = path.resolve("scripts/seed-field-test-simulation.ts");

describe("simulation evidence output", () => {
  test("importing the writer cannot create files at module load", () => {
    const source = fs.readFileSync(writerPath, "utf8");
    const mainStart = source.indexOf("async function main()");
    assert.ok(mainStart > 0, "writer must keep side effects inside main()");
    assert.doesNotMatch(
      source.slice(0, mainStart),
      /fs\.(?:mkdirSync|writeFileSync)\(/,
      "module initialization must not write files",
    );
  });

  test("file output requires an explicit flag and destination", () => {
    const source = fs.readFileSync(writerPath, "utf8");
    assert.match(source, /process\.argv\.includes\('--write-evidence'\)/);
    assert.match(source, /--write-evidence requires --out-dir <path>/);
    assert.match(source, /path\.resolve\(evidenceOutDir!\)/);
  });

  test("generated evidence uses only the caller-selected output directory", () => {
    const source = fs.readFileSync(writerPath, "utf8");
    const writeTargets = [...source.matchAll(/fs\.writeFileSync\(path\.join\(([^,]+),/g)]
      .map((match) => match[1].trim());

    assert.ok(writeTargets.length > 0, "writer must contain evidence output calls");
    assert.deepEqual(
      new Set(writeTargets),
      new Set(["outDir"]),
      "every generated file must be written beneath the caller-selected directory",
    );
    assert.doesNotMatch(source, /artifacts\/field-test/);
  });
});
