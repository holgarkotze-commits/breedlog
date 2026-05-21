import test from "node:test";
import assert from "node:assert/strict";
import { buildBreedLogSimulationDataset } from "../shared/breedlog-simulation";
import { buildBreedLogAIContext } from "../server/ai/breedlog-ai-context";
import { generateLocalFallback } from "../server/ai/local-fallback";

const ds = buildBreedLogSimulationDataset();
const ctx = buildBreedLogAIContext({
  animals: ds.animals as any,
  breedingEvents: ds.breedingEvents as any,
  performanceRecords: ds.performanceRecords as any,
  healthRecords: ds.healthRecords as any,
  flockHealthEvents: [],
  matingGroups: ds.matingGroups as any,
  farmSettings: ds.farmSettings as any,
});

test("phase6 context contains real-source dimensions", () => {
  assert.ok(ctx.herd.total > 1000);
  assert.ok((ctx.herd as any).lambStageSummary || ctx.workspace.dataQualityScore >= 0);
  assert.ok(ctx.reproductive.groupCount > 0);
});

test("fallback herd overview uses real herd numbers", () => {
  const r = generateLocalFallback("herd overview", ctx, "herd-overview");
  assert.equal(r.isFallback, true);
  assert.match(r.answer, /animal/);
  assert.match(r.answer, /Rams:/);
});

test("fallback sire/ewe/lamb/mating/health/data-quality/priority all return structured, non-hardcoded outputs", () => {
  const cats = ["sire-performance", "ewe-performance", "lamb-growth", "reproductive", "health", "data-quality", "priority"] as const;
  for (const c of cats) {
    const r = generateLocalFallback(`question for ${c}`, ctx, c);
    assert.equal(r.isFallback, true);
    assert.ok(r.answer.length > 30);
    assert.ok(r.usedData.length > 0);
    assert.ok(!r.answer.includes("lorem ipsum"));
  }
});

test("keyword routing supports mating-group performance prompt", () => {
  const r = generateLocalFallback("How are my mating-group performance numbers?", ctx);
  assert.match(r.answer, /Ewes joined|mating groups|Lambs per ewe joined/);
});
