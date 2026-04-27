import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

const layout = fs.readFileSync('client/src/components/Layout.tsx', 'utf8');
const app = fs.readFileSync('client/src/App.tsx', 'utf8');
const animalsPage = fs.readFileSync('client/src/pages/Animals.tsx', 'utf8');

test('analysis route is present in app routes and primary navigation while lambs remain in herd workflow', () => {
  assert.match(app, /Route path="\/analysis"/);
  assert.match(layout, /\{ href: "\/analysis",/);
  assert.match(animalsPage, /title="Lambs"/);
});
