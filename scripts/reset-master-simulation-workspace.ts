import { db } from '../server/db';
import { and, eq, like } from 'drizzle-orm';
import { animals, breedingEvents, flockHealthEvents, flockHealthTreatments, healthRecords, inviteCodes, matingGroups, userActivations, users } from '../shared/schema';
import { buildBreedLogSimulationDataset } from '../shared/breedlog-simulation';
import { MASTER_SIMULATION_ACCESS_CODE, MASTER_SIMULATION_BATCH_MARKER } from '../shared/master-simulation';

function arg(name:string){ const i=process.argv.indexOf(name); return i>-1?process.argv[i+1]:undefined; }
const accessCode = (arg('--access-code') || '').toUpperCase();
const confirm = process.argv.includes('--confirm-master-simulation-reset');
const apply = process.argv.includes('--apply');

if (accessCode !== MASTER_SIMULATION_ACCESS_CODE) throw new Error('Refusing: script only supports U2A2ZAVQ');
if (!confirm) throw new Error('Refusing without --confirm-master-simulation-reset');

async function resolveWorkspaceUserId(code: string): Promise<string> {
  const codeRows = await db.select().from(inviteCodes).where(eq(inviteCodes.code, code));
  if (!codeRows.length) throw new Error(`Access code not found: ${code}`);
  const activations = await db.select().from(userActivations).where(and(eq(userActivations.inviteCodeId, codeRows[0].id), eq(userActivations.status, 'active')));
  if (!activations.length) throw new Error(`No active activations for code ${code}`);
  const u = await db.select().from(users).where(eq(users.id, activations[0].userId));
  if (!u.length) throw new Error('Activation user missing');
  return u[0].sharedUserId || u[0].id;
}

async function main(){
  const userId = await resolveWorkspaceUserId(accessCode);
  const before = {
    animals: (await db.select().from(animals).where(eq(animals.userId,userId))).length,
    matingGroups: (await db.select().from(matingGroups).where(eq(matingGroups.userId,userId))).length,
    breedingEvents: (await db.select().from(breedingEvents).where(eq(breedingEvents.userId,userId))).length,
    healthRecords: (await db.select().from(healthRecords).where(eq(healthRecords.userId,userId))).length,
    flockHealthEvents: (await db.select().from(flockHealthEvents).where(eq(flockHealthEvents.userId,userId))).length,
  };
  const markedAnimals = await db.select().from(animals).where(and(eq(animals.userId,userId), like(animals.notes, `%${MASTER_SIMULATION_BATCH_MARKER}%`)));
  const report:any = { targetAccessCode: accessCode, resolvedWorkspaceUserId: userId, mode: apply ? 'applied' : 'dry-run', before };
  if (!apply) return console.log(JSON.stringify({ ...report, markedAnimals: markedAnimals.length }, null, 2));

  await db.delete(flockHealthTreatments).where(eq(flockHealthTreatments.userId,userId));
  await db.delete(flockHealthEvents).where(eq(flockHealthEvents.userId,userId));
  await db.delete(healthRecords).where(eq(healthRecords.userId,userId));
  await db.delete(breedingEvents).where(eq(breedingEvents.userId,userId));
  await db.delete(matingGroups).where(eq(matingGroups.userId,userId));
  await db.delete(animals).where(eq(animals.userId,userId));

  const ds = buildBreedLogSimulationDataset();
  const idMap = new Map<number,number>();
  const mark=(txt?:string|null)=>[txt, MASTER_SIMULATION_BATCH_MARKER].filter(Boolean).join(' | ');
  for (const a of ds.animals as any[]) {
    const { id, userId:_, ...rest } = a;
    const ins = await db.insert(animals).values({ ...rest, userId, sireId: null, damId: null, notes: mark(rest.notes) }).returning({ id: animals.id });
    idMap.set(id, ins[0].id);
  }
  for (const a of ds.animals as any[]) {
    const sireId = a.sireId ? idMap.get(a.sireId) || null : null;
    const damId = a.damId ? idMap.get(a.damId) || null : null;
    if (sireId || damId) await db.update(animals).set({ sireId, damId }).where(and(eq(animals.userId,userId), eq(animals.id,idMap.get(a.id)!)));
  }
  for (const g of ds.matingGroups as any[]) await db.insert(matingGroups).values({ ...g, userId, ramId: idMap.get(g.ramId)!, eweIds:(g.eweIds||[]).map((x:number)=>idMap.get(x)).filter(Boolean), notes: mark(g.notes) });
  for (const e of ds.breedingEvents as any[]) await db.insert(breedingEvents).values({ ...e, userId, eweId:idMap.get(e.eweId)!, ramId:idMap.get(e.ramId)!, matingGroupId:null, notes: mark(e.notes) });
  for (const h of ds.healthRecords as any[]) { const aid=idMap.get(h.animalId); if(aid) await db.insert(healthRecords).values({ ...h, userId, animalId:aid, notes: mark(h.notes) }); }
  const fe = await db.insert(flockHealthEvents).values({ userId, date: '2026-01-15', title:`Master Simulation ${MASTER_SIMULATION_BATCH_MARKER}`, category:'vaccination', status:'completed', notes:mark('seed') }).returning({id:flockHealthEvents.id});
  await db.insert(flockHealthTreatments).values({ userId, eventId: fe[0].id, treatmentType: 'vaccine', product: 'Routine', notes: mark('seed') } as any);

  const after = {
    animals: (await db.select().from(animals).where(eq(animals.userId,userId))).length,
    matingGroups: (await db.select().from(matingGroups).where(eq(matingGroups.userId,userId))).length,
    breedingEvents: (await db.select().from(breedingEvents).where(eq(breedingEvents.userId,userId))).length,
    healthRecords: (await db.select().from(healthRecords).where(eq(healthRecords.userId,userId))).length,
    flockHealthEvents: (await db.select().from(flockHealthEvents).where(eq(flockHealthEvents.userId,userId))).length,
  };
  console.log(JSON.stringify({ ...report, after }, null, 2));
}

main();
