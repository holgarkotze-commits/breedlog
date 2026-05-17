import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { LAMB_BIRTH_HEADERS, LAMB_PERFORMANCE_HEADERS, buildLambBirthRows, buildLambPerformanceRows, isValid100DayRange, isValid270DayRange, buildEweExportRows, buildRamExportRows, buildMatingDekRows, buildCullSoldRows } from '../client/src/lib/stamboek-export-fields';

const lamb: any = { id: 1, tagId:'L1', birthDate:'2026-01-01', sex:'ewe', externalSireInfo:'R1', externalDamInfo:'E1', birthType:'single', birthWeight:'4.1', electronicId:'EID1', tattoo:'T1', studPrefix:'SP', breed:'Meatmaster', lambingSeason:'26A', weaningStatus:'normal', notes:'n', weight100DayDate:'2026-04-11', weight100Day:'30', weight270DayDate:'2026-10-01', weight270Day:'45', currentWeight:'50', currentWeightDate:'2026-10-01' };

test('stable lamb headers', ()=>{
 assert.equal(LAMB_BIRTH_HEADERS[0],'Lamb ID');
 assert.equal(LAMB_PERFORMANCE_HEADERS[5],'270-day/post-wean weigh date');
});

test('100 and 270 day age/range logic', ()=>{
 const rows = buildLambPerformanceRows([lamb]);
 assert.equal(rows[0]['Age at 100-day weighing'], 100);
 assert.equal(rows[0]['100-day valid range indicator'], 'valid');
 assert.equal(rows[0]['Age at 270-day/post-wean weighing'], 273);
 assert.equal(rows[0]['270-day valid range indicator'], 'valid');
 assert.equal(isValid100DayRange(89), false);
 assert.equal(isValid100DayRange(90), true);
 assert.equal(isValid100DayRange(115), true);
 assert.equal(isValid100DayRange(116), false);
 assert.equal(isValid270DayRange(259), false);
 assert.equal(isValid270DayRange(260), true);
 assert.equal(isValid270DayRange(320), true);
 assert.equal(isValid270DayRange(321), false);
});

test('missing optional fields do not crash', ()=>{
 const rows = buildLambBirthRows([{id:2, tagId:'L2'} as any]);
 assert.equal(rows.length, 1);
});

test('other builders include expected keys', ()=>{
 assert.ok('Ewe ID' in buildEweExportRows([{id:1,tagId:'E1'} as any])[0]);
 assert.ok('Ram ID' in buildRamExportRows([{id:1,tagId:'R1'} as any])[0]);
 assert.ok('Mating group name/code' in buildMatingDekRows([{name:'G1',eweIds:[]} as any])[0]);
 assert.ok('Animal ID' in buildCullSoldRows([{id:1,tagId:'X1'} as any])[0]);
});

test('no hardcoded example names/places', ()=>{
 const src = fs.readFileSync('client/src/lib/stamboek-export-fields.ts','utf8').toLowerCase();
 assert.equal(src.includes('kwantam'), false);
 assert.equal(src.includes('haka'), false);
});
