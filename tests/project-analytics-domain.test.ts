import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";

const hooks = {
  animals: fs.readFileSync("client/src/hooks/use-animals.ts", "utf8"),
  matingGroups: fs.readFileSync("client/src/hooks/use-mating-groups.ts", "utf8"),
  breeding: fs.readFileSync("client/src/hooks/use-breeding.ts", "utf8"),
  flockHealth: fs.readFileSync("client/src/hooks/use-flock-health.ts", "utf8"),
};

test("project analytics: creation hooks use the shared safe analytics client", () => {
  for (const source of Object.values(hooks)) {
    assert.match(source, /import\s+\{\s*trackAnalyticsEvent\s*\}\s+from\s+["']@\/lib\/project-analytics["']/);
  }
});

test("project analytics: animal creation tracks only safe outcome dimensions", () => {
  assert.match(hooks.animals, /trackAnalyticsEvent\("animal_created",\s*\{\s*sync_state:\s*serverConfirmed\s*\?\s*"synced"\s*:\s*"queued",\s*sex:\s*variables\.sex/s);
});

test("project analytics: mating group creation tracks sync state and member count", () => {
  assert.match(hooks.matingGroups, /trackAnalyticsEvent\("mating_group_created",\s*\{\s*sync_state:\s*data\.id\s*>\s*0\s*\?\s*"synced"\s*:\s*"queued",\s*member_count:\s*variables\.eweIds\?\.length\s*\?\?\s*0/s);
});

test("project analytics: breeding creation tracks safe method and group presence", () => {
  assert.match(hooks.breeding, /trackAnalyticsEvent\("breeding_event_created",\s*\{\s*sync_state:\s*data\.id\s*>\s*0\s*\?\s*"synced"\s*:\s*"queued",\s*method:\s*variables\.matingType,\s*has_mating_group:\s*variables\.matingGroupId\s*!=\s*null/s);
});

test("project analytics: flock health creation tracks safe event dimensions", () => {
  assert.match(hooks.flockHealth, /trackAnalyticsEvent\("health_event_created",\s*\{\s*sync_state:\s*data\.id\s*>\s*0\s*\?\s*"synced"\s*:\s*"queued",\s*event_type:\s*variables\.eventType\s*\?\?\s*"observation_symptom",\s*treat_all_animals:\s*variables\.treatAllAnimals\s*\?\?\s*false/s);
});