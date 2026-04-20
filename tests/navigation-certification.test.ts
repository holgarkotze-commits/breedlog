import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

const layout = fs.readFileSync('client/src/components/Layout.tsx', 'utf8');
const app = fs.readFileSync('client/src/App.tsx', 'utf8');

test('lambs route is present in app routes and primary navigation', () => {
  assert.match(app, /Route path="\/lambs"/);
  assert.match(layout, /\{ href: "\/lambs",/);
});
