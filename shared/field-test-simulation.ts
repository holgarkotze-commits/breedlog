import { addDays } from 'date-fns';

export const SIM_BATCH_ID = 'BL-SIM-2025-RC1';
export const MATING_START = '2024-10-01';
export const MATING_END = '2024-11-11';
export const LAMBING_START = '2025-02-25';
export const LAMBING_END = '2025-03-24';

export type GroupId = 1|2|3|4;
export interface SimAnimal { tag: string; sex:'ewe'|'ram'; role:'ewe'|'ram'|'lamb'; group?:GroupId; birthDate:string; birthType?:'Single'|'Twin'; damTag?:string; sireTag?:string; birthWeightKg:number; notes:string; batchId:string; }
export interface GroupPlan { id:GroupId; name:string; ramTag:string; eweStart:number; eweEnd:number; ewesJoined:number; ewesLambed:number; lambsBorn:number; twinEwes:number; barrenEwes:number; avgBirthWeight:number; }

export const GROUPS: GroupPlan[] = [
  { id:1,name:'SIM Group 1 — R1 Control Line', ramTag:'SIM-R1', eweStart:1,eweEnd:50,ewesJoined:50,ewesLambed:50,lambsBorn:59,twinEwes:9,barrenEwes:0,avgBirthWeight:4.0 },
  { id:2,name:'SIM Group 2 — R2 Low Birth Weight Line', ramTag:'SIM-R2', eweStart:51,eweEnd:100,ewesJoined:50,ewesLambed:48,lambsBorn:55,twinEwes:7,barrenEwes:2,avgBirthWeight:3.2 },
  { id:3,name:'SIM Group 3 — R3 High Prolificacy Line', ramTag:'SIM-R3', eweStart:101,eweEnd:150,ewesJoined:50,ewesLambed:49,lambsBorn:66,twinEwes:17,barrenEwes:1,avgBirthWeight:4.67 },
  { id:4,name:'SIM Group 4 — R4 Poor Conception Line', ramTag:'SIM-R4', eweStart:151,eweEnd:200,ewesJoined:50,ewesLambed:41,lambsBorn:42,twinEwes:1,barrenEwes:9,avgBirthWeight:4.0 },
];

function d(s:string){return new Date(`${s}T00:00:00Z`)}
function iso(dt:Date){return dt.toISOString().slice(0,10)}
const lambWindowDays=(d(LAMBING_END).getTime()-d(LAMBING_START).getTime())/(24*3600*1000);

export function buildFieldTestSimulationDataset(){
  const animals: SimAnimal[]=[];
  for(let i=1;i<=200;i++){
    const bd=iso(addDays(d('2022-03-01'),(i-1)%61));
    animals.push({tag:`SIM-E${String(i).padStart(3,'0')}`,sex:'ewe',role:'ewe',birthDate:bd,birthWeightKg:4.0,notes:`${i<=100?'Bruno':'Bash'} daughter | ${SIM_BATCH_ID}`,batchId:SIM_BATCH_ID});
  }
  for(let i=1;i<=4;i++) animals.push({tag:`SIM-R${i}`,sex:'ram',role:'ram',birthDate:'2021-09-01',birthWeightKg:4.3,notes:`Stud ram ${SIM_BATCH_ID}`,batchId:SIM_BATCH_ID});

  const lambs: SimAnimal[]=[];
  for (const g of GROUPS){
    let n=1;
    for(let i=0;i<g.ewesJoined;i++){
      const eweTag=`SIM-E${String(g.eweStart+i).padStart(3,'0')}`;
      if(i>=g.ewesLambed) continue;
      const isTwin=i<g.twinEwes;
      const count=isTwin?2:1;
      const birthDate=iso(addDays(d(LAMBING_START),(g.id*5+i)% (lambWindowDays+1)));
      for(let k=0;k<count;k++){
        const tag=`SIM-G${g.id}-L${String(n).padStart(3,'0')}`; n++;
        const sex=((n+k)%2===0)?'ram':'ewe';
        const base=g.avgBirthWeight + (isTwin?-0.18:0.12) + (((n+k)%5)-2)*0.03;
        lambs.push({tag,sex,role:'lamb',group:g.id,damTag:eweTag,sireTag:g.ramTag,birthDate,birthType:isTwin?'Twin':'Single',birthWeightKg:Number(base.toFixed(2)),notes:`${isTwin?`Twin set with dam ${eweTag}${k===0?' Twin A':' Twin B'}`:'Single birth'} | ${SIM_BATCH_ID}`,batchId:SIM_BATCH_ID});
      }
    }
  }
  animals.push(...lambs);

  const weightRecords = lambs.flatMap((l)=>{
    const b=d(l.birthDate);
    const g=l.group!;
    const twinAdj=l.birthType==='Twin'?-1.1:0;
    const g30=[10.5,9.8,11.2,10.4][g-1]+twinAdj;
    const g100=[32.5,30.2,33.1,31.8][g-1]+twinAdj;
    const g150=[44.5,41.4,45.2,43.3][g-1]+twinAdj;
    return [
      {tag:l.tag,type:'Birth',date:l.birthDate,weightKg:l.birthWeightKg},
      {tag:l.tag,type:'30-day',date:iso(addDays(b,30)),weightKg:Number((l.birthWeightKg+g30).toFixed(2))},
      {tag:l.tag,type:'100-day',date:iso(addDays(b,100)),weightKg:Number(g100.toFixed(2))},
      {tag:l.tag,type:'150-day',date:iso(addDays(b,150)),weightKg:Number(g150.toFixed(2))},
    ];
  });

  return { batchId:SIM_BATCH_ID, animals, lambs, groups:GROUPS, weightRecords };
}
