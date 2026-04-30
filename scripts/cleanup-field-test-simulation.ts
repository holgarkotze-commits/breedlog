import { db } from '../server/db';
import { animals, matingGroups } from '../shared/schema';
import { and, eq, like } from 'drizzle-orm';
import { SIM_BATCH_ID } from '../shared/field-test-simulation';

const apply = process.argv.includes('--apply');
const userId = process.argv[process.argv.indexOf('--user-id')+1];
if(!userId){ console.error('Refusing cleanup without --user-id'); process.exit(1); }

async function main(){
  const simAnimals = await db.select().from(animals).where(and(eq(animals.userId,userId), like(animals.notes, `%${SIM_BATCH_ID}%`)));
  const simGroups = await db.select().from(matingGroups).where(and(eq(matingGroups.userId,userId), like(matingGroups.notes, `%${SIM_BATCH_ID}%`)));
  const report={mode:apply?'apply':'dry-run',userId,animals:simAnimals.length,matingGroups:simGroups.length,batch:SIM_BATCH_ID};
  if(!apply){ console.log(JSON.stringify(report,null,2)); return; }
  await db.delete(matingGroups).where(and(eq(matingGroups.userId,userId), like(matingGroups.notes, `%${SIM_BATCH_ID}%`)));
  await db.delete(animals).where(and(eq(animals.userId,userId), like(animals.notes, `%${SIM_BATCH_ID}%`)));
  console.log(JSON.stringify({...report,deleted:true},null,2));
}
main();
