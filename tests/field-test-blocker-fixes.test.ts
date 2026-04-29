import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

const read = (p: string) => fs.readFileSync(p, 'utf8');

test('spa fallback excludes api and serves app routes', () => {
  assert.match(read('server/static.ts'), /req\.path\.startsWith\("\/api\/"\)/);
  assert.match(read('server/vite.ts'), /req\.path\.startsWith\("\/api\/"\)/);
});

test('app route list includes critical pages and lazy fallback', () => {
  const app = read('client/src/App.tsx');
  for (const route of ['/records','/analysis','/settings','/health','/animals','/breeding']) assert.match(app, new RegExp(route));
  assert.match(app, /RouteErrorBoundary/);
});

test('data safety guards risky actions and server-empty/local-present', () => {
  const settings = read('client/src/pages/Settings.tsx');
  const sync = read('client/src/lib/sync-manager.ts');
  assert.match(settings, /guardRiskyAction/);
  assert.match(settings, /Unsynced local records detected/);
  assert.match(settings, /Export CSV Backup/);
  assert.match(settings, /performLogout/);
  assert.match(settings, /reloadLocalData/);
  assert.match(sync, /Server returned no animals, but local animal records exist/);
});

test('backup wording is honest about image references', () => {
  const settings = read('client/src/pages/Settings.tsx');
  assert.match(settings, /CSV backup includes animal records and image references/);
  assert.match(settings, /Full image-file backup will be added in the Android\/production backup phase/);
});

test('health disclaimer exact wording and restricted references', () => {
  const guide = read('client/src/lib/health-plan-guide.ts');
  assert.match(guide, /This Health Plan is a BreedLog in-app planning guide/);
  assert.doesNotMatch(guide, /American Veterinary Regulations|Namibian veterinary regulations|Agra/);
});


test('critical dark buttons use readable text classes', () => {
  const breeding = read('client/src/pages/Breeding.tsx');
  const health = read('client/src/pages/Health.tsx');
  const animals = read('client/src/pages/Animals.tsx');
  assert.match(breeding, /New Group/);
  assert.match(breeding, /text-primary-foreground/);
  assert.match(health, /button-save-health-event/);
  assert.match(health, /All Active Animals/);
  assert.match(health, /text-primary-foreground/);
  assert.match(animals, /button-add-animal/);
  assert.match(animals, /text-primary-foreground/);
});
