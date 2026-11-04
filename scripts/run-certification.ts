import { mkdirSync, writeFileSync } from "node:fs";
import { spawnSync } from "node:child_process";

mkdirSync("artifacts", { recursive: true });
const resultPath = "artifacts/release-certification.json";
const record = (passed: boolean) => writeFileSync(resultPath, JSON.stringify({
  passed, sourceSha: process.env.GITHUB_SHA || null, checkedAt: new Date().toISOString(),
}));
record(false);
for (const args of [
  ["npm", ["run", "test:cert:unit"]],
  [process.execPath, ["--import", "tsx", "scripts/certify-onboarding-sql.ts"]],
] as const) {
  const result = spawnSync(args[0], [...args[1]], { stdio: "inherit", timeout: 240_000 });
  if (result.status !== 0) process.exit(result.status || 1);
}
record(true);
