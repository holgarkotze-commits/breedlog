import fs from 'node:fs';
import path from 'node:path';
import { db } from '../server/db';
import { animals, matingGroups } from '../shared/schema';
import { and, eq, like } from 'drizzle-orm';
import { buildFieldTestSimulationDataset, SIM_BATCH_ID, MATING_START, MATING_END } from '../shared/field-test-simulation';

function arg(name:string){ const i=process.argv.indexOf(name); return i>-1?process.argv[i+1]:undefined; }
const apply = process.argv.includes('--apply');
const targetUserId = arg('--user-id') || arg('--access-code') || arg('--workspace-id');
if(!targetUserId){ console.error('Refusing to seed without --user-id/--workspace-id/--access-code target'); process.exit(1); }
const outDir=path.join(process.cwd(),'artifacts/field-test'); fs.mkdirSync(outDir,{recursive:true});
const ds=buildFieldTestSimulationDataset();

function toCsv(rows: Record<string,unknown>[]) { const keys=Object.keys(rows[0]||{}); return [keys.join(','),...rows.map(r=>keys.map(k=>JSON.stringify(r[k]??'')).join(','))].join('\n'); }

async function main(){
  const existing = await db.select().from(animals).where(and(eq(animals.userId,targetUserId), like(animals.notes, `%${SIM_BATCH_ID}%`)));
  const report={targetUserId,mode:apply?'apply':'dry-run',existingBatchAnimals:existing.length,plannedAnimals:ds.animals.length,matingWindow:{start:MATING_START,end:MATING_END}};
  fs.writeFileSync(path.join(outDir,'breedlog-simulation-dataset.json'), JSON.stringify(ds,null,2));
  fs.writeFileSync(path.join(outDir,'breedlog-simulation-dataset.csv'), toCsv(ds.animals));
  fs.writeFileSync(path.join(outDir,'breedlog-simulation-report.md'), `# BreedLog Field-Test Simulation\n\nBatch: ${SIM_BATCH_ID}\n\nTarget: ${targetUserId}\n\nMode: ${report.mode}\n\nTotals: ${ds.animals.length} animals (200 ewes, 4 rams, 222 lambs).\n`);
  if(!apply){ console.log(JSON.stringify(report,null,2)); return; }
  if(existing.length>0){ console.log('Batch already present for target; idempotent no-op.'); return; }

  const tagToId = new Map<string,number>();
  for(const a of ds.animals.filter(a=>a.role!=='lamb')){
    const inserted = await db.insert(animals).values({userId:targetUserId,tagId:a.tag,rawTag:a.tag,name:a.tag,sex:a.sex,classification:a.role==='ram'?'stud':'commercial',status:'active',birthDate:a.birthDate,birthStatus:a.birthType?.toLowerCase() ?? 'single',birthWeight:String(a.birthWeightKg),notes:a.notes,externalSireInfo:a.tag.startsWith('SIM-E')?(Number(a.tag.slice(5))<=100?'Bruno':'Bash'):null,externalDamInfo:a.tag.startsWith('SIM-E')?`Foundation Dam Line ${((Number(a.tag.slice(5))-1)%3)+1}`:null,managementGroup:SIM_BATCH_ID}).returning({id:animals.id,tagId:animals.tagId});
    tagToId.set(inserted[0].tagId, inserted[0].id);
  }
  for(const l of ds.lambs){
    const inserted = await db.insert(animals).values({userId:targetUserId,tagId:l.tag,rawTag:l.tag,name:l.tag,sex:l.sex,classification:l.sex==='ram'?'stud':'commercial',status:'active',birthDate:l.birthDate,birthStatus:l.birthType?.toLowerCase(),birthWeight:String(l.birthWeightKg),damId:tagToId.get(l.damTag!),sireId:tagToId.get(l.sireTag!),notes:l.notes,managementGroup:SIM_BATCH_ID}).returning({id:animals.id,tagId:animals.tagId});
    tagToId.set(inserted[0].tagId, inserted[0].id);
  }
  for(const g of ds.groups){
    await db.insert(matingGroups).values({userId:targetUserId,name:g.name,ramId:tagToId.get(g.ramTag)!,eweIds:Array.from({length:50},(_,i)=>tagToId.get(`SIM-E${String(g.eweStart+i).padStart(3,'0')}`)!),dateIn:MATING_START,dateOut:MATING_END,lambingSeason:'25A',status:'closed',notes:`${SIM_BATCH_ID}`});
  }
  console.log('Applied simulation seed safely.');
}
main();
