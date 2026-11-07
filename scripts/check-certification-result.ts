import { readFileSync } from "node:fs";

// Existing CI pipes TAP through tee without pipefail. Require an explicit,
// commit-bound certification success before it can build a release artifact.
if (process.env.CI === "true") {
  const result = JSON.parse(readFileSync("artifacts/release-certification.json", "utf8"));
  if (!result.passed || !process.env.GITHUB_SHA || result.sourceSha !== process.env.GITHUB_SHA) {
    throw new Error("Release blocked: certification failed, is missing, or belongs to another source commit.");
  }
}
