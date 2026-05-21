import test from "node:test";
import assert from "node:assert/strict";
import { buildBreedLogSimulationDataset } from "../shared/breedlog-simulation";
import { calculateLambStage } from "../shared/lamb-stage";

test("phase5c corrected growth and selection logic", () => {
  const ds = buildBreedLogSimulationDataset();
  const a = ds.animals;
  const tags = a.map(x=>x.tagId!);
  assert.equal(tags.includes("KW22001"), true);
  assert.equal(tags.includes("KW22002"), true);
  for(let i=3;i<=102;i++) assert.equal(tags.includes(`KW22${String(i).padStart(3,"0")}`), true);
  assert.equal(new Set(tags).size, tags.length);
  assert.equal(tags.filter(t=>t.startsWith("KW26")).length, 0);

  const rounds = ["2022-10-01","2023-06-01","2024-02-01","2024-10-01","2025-06-01","2026-02-01"];
  for (const r of rounds) assert.ok(ds.matingGroups.some(g=>g.dateIn===r));
  const ewesPerRound = rounds.map(r => ds.matingGroups.filter(g=>g.dateIn===r).reduce((s,g)=>s+((g.eweIds||[]).length),0));
  assert.deepEqual(ewesPerRound,[100,100,168,248,382,400]);
  assert.ok(Math.max(...ewesPerRound)<=400);

  const lambs = a.filter(x=>x.damId&&x.sireId);
  assert.ok(lambs.length > 1300);
  const soldCullRams = lambs.filter(x=>x.sex==="ram" && ["sold","culled"].includes(x.status||""));
  assert.ok(soldCullRams.length > 400);
  assert.ok(ds.healthRecords.length >= 14);

  const indiv = ds.healthRecords.filter(h=>![1,2].includes(h.animalId));
  assert.ok(indiv.length >= 12);

  const st = new Map<string,number>();
  for(const x of a){ const s=calculateLambStage(x as any,{now:new Date("2026-05-21")}).label; st.set(s,(st.get(s)||0)+1); }
  assert.ok((st.get("Replacement candidate")||0) > 0);
  assert.ok((st.get("Sale candidate")||0) > 0);
  assert.ok((st.get("Cull/watch")||0) > 0);
  assert.ok((st.get("Ready for herd admission")||0) > 0);
  assert.ok((st.get("Admitted to herd")||0) > 0);

  const activeBreedingEwes = a.filter(x => x.sex === "ewe" && (x.status || "active") === "active" && ds.expectedAnalysisSummary.activeBreedingEwesByRound.R6 >= 400);
  const activeFounderBreedingEwes = a.filter(x => x.sex === "ewe" && (x.status || "active") === "active" && x.tagId?.startsWith("KW22") && Number(x.tagId.slice(4)) >= 3 && Number(x.tagId.slice(4)) <= 102);
  const activeAdmittedReplacementEwes = a.filter(x => x.sex === "ewe" && (x.status || "active") === "active" && x.lambStatus === "moved_to_ewes" && x.tagId && !x.tagId.startsWith("KW22"));
  assert.ok(activeAdmittedReplacementEwes.length >= 250);
  assert.equal(activeFounderBreedingEwes.length + activeAdmittedReplacementEwes.length, 400);

  const currentLambStageAnimals = a.filter(x => (x.status || "active") === "active" && !(x.sex === "ewe" && (x.tagId?.startsWith("KW22") || x.lambStatus === "moved_to_ewes")));
  const historicalOutcomes = a.filter(x => Boolean(x.damId) && (x.status !== "active" || x.lambStatus === "moved_to_ewes" || (x.notes || "").includes("Admitted replacement ewe")));
  assert.ok(currentLambStageAnimals.length > 0);
  assert.ok(historicalOutcomes.length > 0);
  assert.ok((ds.expectedAnalysisSummary.blockedByCapByRound?.R5?.length || 0) > 0);
});
