import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

const src = fs.readFileSync('client/src/pages/Settings.tsx','utf8');

test('settings sections are collapsed by default', ()=>{
  assert.match(src, /const \[profileOpen, setProfileOpen\] = useState\(false\)/);
  assert.match(src, /const \[dataOpen, setDataOpen\] = useState\(false\)/);
});

test('profile contains farm details and logo controls', ()=>{
  assert.match(src, /Save Profile Details/);
  assert.match(src, /button-upload-logo/);
  assert.match(src, /Logo Size in Exports/);
});

test('farm details and farm logo are not separate top-level section titles', ()=>{
  assert.equal(src.includes('> Farm Details<'), false);
  assert.equal(src.includes('> Farm Logo<'), false);
});

test('profile no longer shows device registered and reset session text', ()=>{
  assert.equal(src.includes('Device Registered'), false);
  assert.equal(src.includes('Reset This Device Session'), false);
});

test('beta admin info hidden from normal settings ui', ()=>{
  assert.equal(src.includes('Beta Admin Panel'), false);
});

test('backup and safety controls remain present', ()=>{
  assert.match(src, /Export CSV Backup/);
  assert.match(src, /Unsynced local records detected/);
});
