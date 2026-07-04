import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

const schema = fs.readFileSync('shared/schema.ts','utf8');
const routes = fs.readFileSync('server/routes.ts','utf8');
const animals = fs.readFileSync('client/src/pages/Animals.tsx','utf8');
const lambs = fs.readFileSync('client/src/pages/Lambs.tsx','utf8');
const detail = fs.readFileSync('client/src/pages/AnimalDetail.tsx','utf8');
const records = fs.readFileSync('client/src/pages/Records.tsx','utf8');

test('exported documents schema supports metadata trace payload', ()=>{
  assert.match(schema, /metadata:\s*jsonb\("metadata"\)/);
  assert.match(routes, /metadata\s*\?\?\s*null/);
});

test('group exports store animal count and page count metadata', ()=>{
  assert.match(animals, /animalCount:/);
  assert.match(animals, /pageCount:/);
  assert.match(animals, /category:\s*"full-herd"/);
  assert.match(animals, /category:\s*"culled"/);
});

test('lamb export stores structured stamboek row summary metadata', ()=>{
  assert.match(lambs, /rowsSummary:/);
  assert.match(lambs, /eweBirthRows/);
  assert.match(lambs, /ramBirthRows/);
});

test('individual export still creates exported document with metadata', ()=>{
  assert.match(detail, /documentType:\s*"individual"/);
  assert.match(detail, /animalCount:\s*1/);
});

test('individual export uses designed pedigree tree instead of plain boxes', ()=>{
  assert.match(detail, /designedFamilyTreePage/);
  assert.match(detail, /tree-canvas/);
  assert.match(detail, /BLOODLINE <span>- ELITE PEDIGREE<\/span>/);
  assert.match(detail, /renderTreeNode\(animal, "SUBJECT",[\s\S]*"subject"/);
});

test('export pages use fixed A4 height so footers stay at the bottom', ()=>{
  assert.match(detail, /\.page \{ width: 190mm; height: 277mm; min-height: 277mm/);
  assert.match(animals, /\.page \{ width: 277mm; height: 190mm; min-height: 190mm/);
  assert.match(records, /\.page \{ width: 277mm; height: 190mm; min-height: 190mm/);
});

test('records page reads metadata safely and old records are tolerated', ()=>{
  assert.match(records, /const meta = \(doc as any\)\.metadata \|\| \{\}/);
  assert.match(records, /meta\.animalCount \?\?/);
  assert.match(records, /meta\.pageCount \?\?/);
});
