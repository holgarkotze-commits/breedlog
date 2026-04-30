import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { buildFieldTestSimulationDataset, GROUPS, LAMBING_END, LAMBING_START, MATING_END, MATING_START, SIM_BATCH_ID } from '../shared/field-test-simulation';

const ds=buildFieldTestSimulationDataset();

test('dataset totals',()=>{
  assert.equal(ds.animals.length,426);
  assert.equal(ds.animals.filter(a=>a.role==='ewe').length,200);
  assert.equal(ds.animals.filter(a=>a.role==='ram').length,4);
  assert.equal(ds.animals.filter(a=>a.role==='lamb').length,222);
});

test('group lamb counts and logic',()=>{
  for (const g of GROUPS){
    const lambs=ds.lambs.filter(l=>l.group===g.id);
    assert.equal(lambs.length,g.lambsBorn);
    const twinEwes = new Set(lambs.filter(l=>l.birthType==='Twin').map(l=>l.damTag)).size;
    assert.equal(twinEwes,g.twinEwes);
    assert.equal(g.ewesJoined-g.ewesLambed,g.barrenEwes);
  }
});

test('mating and lambing dates',()=>{
  assert.equal(MATING_START,'2024-10-01');
  assert.equal(MATING_END,'2024-11-11');
  const dates=ds.lambs.map(l=>l.birthDate).sort();
  assert.equal(dates[0],LAMBING_START);
  assert.equal(dates[dates.length-1],LAMBING_END);
});

test('birth weight ratios',()=>{
  const avg=(n:number)=>{const rows=ds.lambs.filter(l=>l.group===n); return rows.reduce((s,r)=>s+r.birthWeightKg,0)/rows.length;};
  const r1=avg(1),r2=avg(2),r3=avg(3),r4=avg(4);
  assert.ok(Math.abs((r2/r1)-0.8)<0.03);
  const combined=(r1+r2+r4)/3;
  assert.ok(Math.abs((r3/combined)-1.25)<0.03);
});

test('batch marker and safety docs',()=>{
  assert.ok(ds.animals.every(a=>a.notes.includes(SIM_BATCH_ID)));
  assert.match(fs.readFileSync('scripts/cleanup-field-test-simulation.ts','utf8'), /Refusing cleanup without --user-id/);
});
