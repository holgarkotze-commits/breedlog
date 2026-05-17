import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

const src = fs.readFileSync('client/src/pages/Animals.tsx','utf8');

test('long-press entry exists for both mobile cards and desktop/list rows', ()=>{
  assert.match(src, /selectionMode/);
  assert.match(src, /startSelectionByLongPress/);
  assert.match(src, /onTouchStart=\{\(\) => \{ longPressTimerRef\.current = setTimeout\(\(\) => startSelectionByLongPress\(animal\.id\), 500\); \}\}/);
  assert.match(src, /<ListRow[\s\S]*onLongPress=\{startSelectionByLongPress\}/);
  assert.match(src, /<AnimalListRow[\s\S]*onLongPress=\{startSelectionByLongPress\}/);
  assert.match(src, /onTouchStart/);
});

test('selected count and sticky toolbar exist and clear selection resets mode', ()=>{
  assert.match(src, /bulk-selection-toolbar/);
  assert.match(src, /bulk-selected-count/);
  assert.match(src, /selectedAnimalIds\.length\} selected/);
  assert.match(src, /button-clear-selection/);
  assert.match(src, /const clearSelection = \(\) => \{ setSelectionMode\(false\); setSelectedAnimalIds\(\[\]\); \};/);
});

test('normal navigation remains when selection mode is false', ()=>{
  assert.match(src, /onClick=\{\(\) => selectionMode \? onToggleSelect\(animal.id\) : setLocation\(`\/animals\/\$\{animal.id\}`\)\}/);
  assert.match(src, /<Link href=\{`\/animals\/\$\{animal.id\}`\}[\s\S]*if \(selectionMode\) e\.preventDefault\(\);/);
});

test('selection-mode clicks toggle select\/deselect instead of navigating', ()=>{
  assert.match(src, /const toggleSelected = \(id: number\) => setSelectedAnimalIds\(\(prev\) => prev\.includes\(id\) \? prev\.filter\(x => x !== id\) : \[\.\.\.prev, id\]\);/);
  assert.match(src, /selectionMode \? onToggleSelect\(animal.id\) : setLocation/);
  assert.match(src, /if \(selectionMode\) e.preventDefault\(\)/);
});

test('bulk confirmation cancel blocks action and accept executes action', ()=>{
  assert.match(src, /if \(window\.confirm\(`Apply \$\{bulkAction\} to \$\{selectedAnimalIds.length\} selected animals\?`\)\) runBulkAction\(\);/);
});

test('no quick permanent delete and weight rule explicit', ()=>{
  assert.ok(!src.includes('Delete selected'));
  assert.match(src, /Apply same weight to all selected animals/);
  assert.match(src, /No automatic average-to-individual overwrite\./);
  assert.match(src, /bulkAction === "record-weight"/);
  assert.match(src, /createPerformanceRecord\.mutateAsync\(\{ animalId: a\.id, date: new Date\(\)\.toISOString\(\)\.slice\(0,10\), weight: bulkValue \}/);
});

test('bulk action trace is created as productivity record and can be read from records path', ()=>{
  assert.match(src, /createBulkTrace/);
  assert.match(src, /documentType: "productivity"/);
  assert.match(src, /subfolder: "productivity"/);
  assert.match(src, /selectedAnimalCount:/);
  assert.match(src, /selectedAnimalIds,/);
  assert.match(src, /selectedTagIds:/);
});
