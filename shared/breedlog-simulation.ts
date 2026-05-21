import { addDays } from "date-fns";
import type { Animal, BreedingEvent, FarmSettings, HealthRecord, MatingGroup, PerformanceRecord } from "./schema";

export interface BreedLogSimulationDataset { farmMetadata?: any; farmSettings: FarmSettings; animals: Animal[]; matingGroups: MatingGroup[]; breedingEvents: BreedingEvent[]; performanceRecords: PerformanceRecord[]; healthRecords: HealthRecord[]; expectedAnalysisSummary: Record<string, any>; }
const USER="simulation-user-kw"; const NOW=new Date("2026-05-21T00:00:00Z"); const CREATED=new Date("2022-09-01T00:00:00Z");
const rounds=[
{key:"R1",start:"2022-10-01",end:"2022-11-12",ewes:100,lambs:120,rams:48},
{key:"R2",start:"2023-06-01",end:"2023-07-12",ewes:100,lambs:140,rams:56},
{key:"R3",start:"2024-02-01",end:"2024-03-13",ewes:168,lambs:235,rams:94},
{key:"R4",start:"2024-10-01",end:"2024-11-12",ewes:248,lambs:298,rams:119},
{key:"R5",start:"2025-06-01",end:"2025-07-12",ewes:382,lambs:535,rams:214},
{key:"R6",start:"2026-02-01",end:"2026-03-14",ewes:400,lambs:0,rams:0,future:true},
];
const tg=(y:number,n:number)=>`KW${String(y).slice(2)}${String(n).padStart(3,"0")}`;
export function buildBreedLogSimulationDataset(): BreedLogSimulationDataset {
let id=1,gid=1,bid=1,hid=1; const seq={2022:1,2023:1,2024:1,2025:1}; const animals:Animal[]=[]; const matingGroups:MatingGroup[]=[]; const breedingEvents:BreedingEvent[]=[]; const healthRecords:HealthRecord[]=[]; const performanceRecords:PerformanceRecord[]=[];
const add=(p:Partial<Animal>&{tagId:string;sex:"ewe"|"ram";birthDate:string;animalSource:string})=>{const a:any={id:id++,userId:USER,rawTag:p.tagId.replace(/^KW/,""),studPrefix:"KW",name:p.tagId,tattooId:null,electronicId:null,breed:"Meatmaster",classification:null,status:"active",photo:null,lambStatus:"active",ramLambClass:null,ramType:null,cullConfirmed:false,cullDate:null,cullReason:null,removalReason:null,birthStatus:"single",damId:null,sireId:null,externalDamInfo:null,externalSireInfo:null,evaluationDocument:null,lambingSeason:null,environmentGroup:"Veld",managementGroup:"Main",birthWeight:null,birthWeightEstimated:false,currentWeight:null,weight100Day:null,weight100DayDate:null,weight100DayEstimated:false,weight270Day:null,weight270DayDate:null,weaningStatus:null,breederName:"Kwantam",ownerName:"Kwantam",farmName:"Kwantam Meatmasters",location:"Demo",notes:null,createdAt:CREATED,clientId:null,vectorClock:null,lastSyncedAt:null,...p}; animals.push(a); return a;};
const ram1=add({tagId:"KW22001",sex:"ram",birthDate:"2022-01-10",animalSource:"bought_in",classification:"stud",ramType:"stud_ram",currentWeight:"92.0"});
const ram2=add({tagId:"KW22002",sex:"ram",birthDate:"2022-01-16",animalSource:"bought_in",classification:"stud",ramType:"stud_ram",currentWeight:"89.0"});
const founderEwes:number[]=[]; for(let i=3;i<=102;i++){founderEwes.push(add({tagId:`KW22${String(i).padStart(3,"0")}`,sex:"ewe",birthDate:`2022-01-${String((i%20)+1).padStart(2,"0")}`,animalSource:"bought_in",classification:"commercial",currentWeight:"55.0"}).id);} 
  const breedingEwes=new Set<number>(founderEwes);
  const admittedReplacementByRound: Record<string, number[]> = {};
  const blockedByCapByRound: Record<string, number[]> = {};
const eweRetainedByRound:Record<string,number[]>= {};
for(const r of rounds){
  const elig=[...breedingEwes].filter(eid=>new Date(animals.find(a=>a.id===eid)!.birthDate!)<=addDays(new Date(r.start),-240)).slice(0,r.ewes);
  const gA=elig.filter((_,i)=>i%2===0), gB=elig.filter((_,i)=>i%2===1);
  const odd=["R1","R3","R5"].includes(r.key); const rgA=odd?ram1.id:ram2.id, rgB=odd?ram2.id:ram1.id;
  matingGroups.push({id:gid,userId:USER,name:`Group A ${r.key}`,ramId:rgA,eweIds:gA,dateIn:r.start,dateOut:r.end,lambingSeason:r.key,environmentGroup:"Veld",managementGroup:"Main",notes:r.future?"Expected lambing Jun-Aug 2026":null} as any);
  for(const eid of gA) breedingEvents.push({id:bid++,userId:USER,eweId:eid,ramId:rgA,matingDate:r.start,matingType:"natural",lambingDate:r.future?null:addDays(new Date(r.start),150+(eid%21)).toISOString().slice(0,10),lambCount:r.future?null:0,notes:r.future?"pregnant_expected":null,matingGroupId:gid,clientId:null,vectorClock:null,lastSyncedAt:null} as any);
  gid++;
  matingGroups.push({id:gid,userId:USER,name:`Group B ${r.key}`,ramId:rgB,eweIds:gB,dateIn:r.start,dateOut:r.end,lambingSeason:r.key,environmentGroup:"Veld",managementGroup:"Main",notes:r.future?"Expected lambing Jun-Aug 2026":null} as any);
  for(const eid of gB) breedingEvents.push({id:bid++,userId:USER,eweId:eid,ramId:rgB,matingDate:r.start,matingType:"natural",lambingDate:r.future?null:addDays(new Date(r.start),150+(eid%21)).toISOString().slice(0,10),lambCount:r.future?null:0,notes:r.future?"pregnant_expected":null,matingGroupId:gid,clientId:null,vectorClock:null,lastSyncedAt:null} as any);
  gid++;
  if(r.future) continue;
  const year=addDays(new Date(r.start),150).getUTCFullYear(); const eweCount=r.lambs-r.rams; const retainedRam=12; let eweBornIds:number[]=[];
  for(let i=0;i<r.lambs;i++){
    const damId=elig[i%elig.length]; const sireId=(i%2===0)?rgA:rgB; const isRam=i<r.rams; const twin=i%5===0;
    const tag=tg(year,(seq as any)[year]++); const bw=(twin?(3.1+(i%8)*0.1):(4.1+(i%10)*0.1)) + (isRam?0.15:0);
    const strong=sireId===ram1.id;
    const a=add({tagId:tag,sex:isRam?"ram":"ewe",birthDate:addDays(new Date(r.start),150+(i%20)).toISOString().slice(0,10),animalSource:i%33===0?"unknown_not_recorded":"born_on_farm",damId,sireId,birthStatus:twin?"twin":"single",birthWeight:bw.toFixed(1),classification:isRam?null:"commercial",ramLambClass:isRam?(i<retainedRam?(i%3===0?"stud":"commercial"):"cull"):null,weaningStatus:i%17===0?"watch":"normal",weight100Day:(strong?(isRam?31:30):(isRam?26:25)) + (i%5),weight100DayDate:addDays(new Date(r.start),250+(i%20)).toISOString().slice(0,10),weight270Day:isRam&&i<retainedRam?(strong?52:47)+(i%4):null,weight270DayDate:isRam&&i<retainedRam?addDays(new Date(r.start),420+(i%20)).toISOString().slice(0,10):null,currentWeight:isRam?(isRam&&i<retainedRam?String((strong?62:57)+(i%5)):null):String((strong?49:45)+(i%5)),lambStatus:isRam&&i<4?"moved_to_rams":"active",notes: isRam&&i>=retainedRam?"Marketed after ram-lamb selection.":null} as any);
    if(i%14===0){a.weight100Day=null;a.weight100DayDate=null;} if(!isRam)eweBornIds.push(a.id);
    if(isRam && i>=retainedRam){a.status=(i%2===0)?"sold":"culled"; if(a.status==="culled"){a.cullConfirmed=true;a.cullReason="Culled from ram grow-out group due to type/growth/class.";} else a.removalReason="Marketed after ram-lamb selection.";}
  }
  const removeN=Math.round(eweBornIds.length*0.05); const remove=eweBornIds.slice(0,removeN); const keep=eweBornIds.slice(removeN);
  for(const eid of remove){const e=animals.find(a=>a.id===eid)!; e.status="culled"; e.cullConfirmed=true; e.cullReason="Removed during replacement-ewe selection: does not meet Kwantam breeding type/standard."; e.notes=e.cullReason;}
  // add eligible retained ewes for future rounds up to cap 400
  admittedReplacementByRound[r.key] = [];
  blockedByCapByRound[r.key] = [];
  for(const eid of keep){
    const e=animals.find(a=>a.id===eid)!;
    if(breedingEwes.size>=400) { e.classification="commercial"; e.notes="Sale candidate after ewe cap reached."; blockedByCapByRound[r.key].push(eid); continue; }
    breedingEwes.add(eid);
    e.lambStatus = "moved_to_ewes";
    e.classification = "replacement";
    e.notes = "Admitted replacement ewe into breeding herd.";
    admittedReplacementByRound[r.key].push(eid);
  }
  eweRetainedByRound[r.key]=keep;
}
// health: 2 flock + 12 individual
healthRecords.push({id:hid++,userId:USER,animalId:ram1.id,date:"2023-02-10",treatment:"Flock vaccination",medication:"Routine vaccine",dosage:null,vet:null,withdrawalPeriod:null,notes:"Flock-level vaccination"} as any);
healthRecords.push({id:hid++,userId:USER,animalId:ram2.id,date:"2024-06-15",treatment:"Flock deworming",medication:"Dewormer",dosage:null,vet:null,withdrawalPeriod:null,notes:"Flock-level deworming"} as any);
const ind=animals.filter(a=>a.damId||a.sex==='ewe').slice(0,12); ind.forEach((an,ix)=>healthRecords.push({id:hid++,userId:USER,animalId:an.id,date:addDays(new Date("2025-01-01"),ix*10).toISOString().slice(0,10),treatment:ix%3===0?"Lameness check":"Respiratory support",medication:ix%3===0?"Topical care":"Supportive care",dosage:null,vet:null,withdrawalPeriod:null,notes:"Individual animal treatment record"} as any));
const farmSettings: FarmSettings = { id:1,userId:USER,farmName:"Kwantam Meatmasters",studName:"Kwantam Meatmasters",studPrefix:"KW",ownerName:"Demo",ownerEmail:"demo@example.invalid",ownerPhone:null,farmAddress:null,farmLocation:"Demo",membershipNumber:null,registrationNumber:null,logoUrl:null,logoSize:"medium",logoWidth:null,logoHeight:null,createdAt:CREATED,updatedAt:NOW };
const summary={totalAnimals:animals.length,activeBreedingEwesByRound:{R1:100,R2:100,R3:168,R4:248,R5:382,R6:400},retainedRamTarget:12,matingRounds:rounds.map(r=>r.start),admittedReplacementByRound,blockedByCapByRound};
return {farmMetadata:{studPrefix:"KW",farmName:"Kwantam Meatmasters",studName:"Kwantam Meatmasters",mode:"test",userId:USER},farmSettings,animals,matingGroups,breedingEvents,performanceRecords,healthRecords,expectedAnalysisSummary:summary};
}
