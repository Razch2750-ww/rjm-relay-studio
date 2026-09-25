import type { Node, Params, Project } from "./circuit.ts";

// Reference data checked against Schneider Electric on 2026-09-25.
// The schematic symbol and its wiring stay unchanged when a product is selected.
export type Product = { id:string; type:string; name:string; family:string; params:Params; source:string };
export const SCHNEIDER_SOURCES = {
  contactors:"https://productinfo.se.com/nadigest/5c51d645347bdf0001f1f280/Master/17718_MAIN%20(bookmap)_0000058904.xml/$/TeSys%E2%84%A2-Deca-Series-9-150-Amperes",
  overloads:"https://www.se.com/uk/en/faqs/FA142123/",
  coils:"https://www.se.com/us/en/faqs/FA105276/",
  mcb:"https://www.se.com/id/en/product/A9F74316/ic60n-miniature-circuit-breaker-3p-16a-c-curve/",
  mccb:"https://www.se.com/id/en/product/LV510307/easypact-cvs-cvs100b-tm100d-circuit-breaker-3p-3d/",
};
export const COIL_CODES = [
  {value:"B7",voltage:24},{value:"F7",voltage:110},{value:"M7",voltage:220},
  {value:"P7",voltage:230},{value:"U7",voltage:240},{value:"Q7",voltage:380},{value:"V7",voltage:400},
];
const product=(id:string,type:string,name:string,family:string,params:Params,source:string):Product=>({id,type,name,family,params:{brand:"Schneider Electric",model:id,...params},source});
const lc1d:[string,number][]=[["LC1D09",9],["LC1D12",12],["LC1D18",18],["LC1D25",25],["LC1D32",32],["LC1D38",38],["LC1D40A",40],["LC1D50A",50],["LC1D65A",65],["LC1D80",80],["LC1D95",95]];
const lrd:[string,number,number][]=[
  ["LRD01",.1,.16],["LRD02",.16,.25],["LRD03",.25,.4],["LRD04",.4,.63],
  ["LRD05",.63,1],["LRD06",1,1.6],["LRD07",1.6,2.5],["LRD08",2.5,4],
  ["LRD10",4,6],["LRD12",5.5,8],["LRD14",7,10],["LRD16",9,13],
  ["LRD21",12,18],["LRD22",16,24],["LRD32",23,32],["LRD35",30,38],
  ["LRD3322",17,25],["LRD3353",23,32],["LRD3355",30,40],["LRD3357",37,50],
  ["LRD3359",48,65],["LRD3361",55,70],["LRD3363",63,80],["LRD3365",80,104],
];
// 3P/3d TM-D, Icu at 380–415 VAC. Magnetic values are absolute amperes,
// independent of the adjustable thermal setting Ir (not a B/C/D MCB curve).
const cvs:[string,string,number,number][]=[
  ["LV510300","CVS100B",16,190],["LV510301","CVS100B",25,300],
  ["LV510302","CVS100B",32,400],["LV510303","CVS100B",40,500],
  ["LV510304","CVS100B",50,500],["LV510305","CVS100B",63,500],
  ["LV510306","CVS100B",80,640],["LV510307","CVS100B",100,800],
  ["LV516302","CVS160B",125,1250],["LV516303","CVS160B",160,1250],
  ["LV525302","CVS250B",200,2000],["LV525303","CVS250B",250,2500],
];
export const SCHNEIDER_PRODUCTS:Product[]=[
  ...lc1d.map(([id,rating])=>product(id,"contactor3",`${id} · ${rating} A AC-3`,"TeSys Deca LC1D",{rating,utilization:"AC-3",ratingVoltage:400,auxNO:1,auxNC:1,coilVA:rating<=38?7:rating<=65?15:26},SCHNEIDER_SOURCES.contactors)),
  ...lrd.map(([id,minCurrent,maxCurrent])=>product(id,"overload",`${id} · ${minCurrent}–${maxCurrent} A`,"TeSys LRD",{minCurrent,maxCurrent,tripClass:"10A",auxNO:1,auxNC:1},SCHNEIDER_SOURCES.overloads)),
  ...[1,2,3,4].flatMap(p=>[6,10,16,20,25,32,40,50,63].map(rating=>{
    const id=`A9F74${p}${String(rating).padStart(2,"0")}`;
    return product(id,`breaker${p}`,`iC60N C${rating} · ${p}P · ${id}`,"Acti9 iC60N",{rating,curve:"C",voltage:p===1?230:400,breakingKA:6,breakingStandard:"Icn · IEC 60898-1",physicalWidth:p*18,physicalHeight:85},SCHNEIDER_SOURCES.mcb);
  })),
  ...cvs.map(([id,frame,rating,magneticAmps])=>product(id,"mccb",`${frame} TM${rating}D · ${id}`,"EasyPact CVS",{model:`${frame} TM${rating}D`,orderCode:id,rating,voltage:415,breakingKA:25,breakingStandard:"Icu · IEC 60947-2",tripUnit:"TM-D",minCurrent:Number((rating*.7).toFixed(2)),maxCurrent:rating,magneticAmps},SCHNEIDER_SOURCES.mccb)),
];
export const productsFor=(n:Pick<Node,"type">)=>SCHNEIDER_PRODUCTS.filter(p=>p.type===n.type);
export const selectedProduct=(n:Node)=>productsFor(n).find(p=>p.id===n.params.productProfile);
export const defaultProduct=(n:Node)=>productsFor(n).find(p=>p.params.rating===n.params.rating||(n.type==="overload"&&p.id==="LRD08"));
export const isSchneiderDevice=(n:Node)=>productsFor(n).length>0||/^contactor/.test(n.type)||/^overload[12]$/.test(n.type);
const clamp=(value:unknown,min:number,max:number)=>typeof value==="number"&&Number.isFinite(value)?Math.min(max,Math.max(min,value)):min;

/** Mutates a project draft so profile selection, linked coils and undo are atomic. */
export function applyProduct(p:Project,id:string,profileId:string,coilCode?:string):boolean {
  const n=p.nodes.find(n=>n.id===id);if(!n)return false;
  if(profileId==="custom"){delete n.params.productProfile;return true;}
  const profile=productsFor(n).find(p=>p.id===profileId);if(!profile)return false;
  const oldRating=n.params.rating,oldTrip=n.params.tripSetting,previous=selectedProduct(n);
  const oldModel=String(n.params.model??""),oldCoil=n.params.coilCode;
  for(const key of Object.keys(previous?.params??{}))delete n.params[key];
  // A preset must not inherit a manual magnetic multiplier or stale Ir value.
  for(const key of ["tripSetting","magnetic","magneticAmps","curve"])delete n.params[key];
  Object.assign(n.params,profile.params,{productProfile:profile.id});
  if(n.type==="overload")n.params.rating=clamp(oldRating,Number(profile.params.minCurrent),Number(profile.params.maxCurrent));
  if(n.type==="mccb")n.params.tripSetting=clamp(oldTrip??oldRating,Number(profile.params.minCurrent),Number(profile.params.maxCurrent));
  if(n.type==="contactor3"){
    const coil=COIL_CODES.find(c=>c.value===(coilCode??oldCoil))??COIL_CODES.find(c=>c.value==="P7")!;
    Object.assign(n.params,{coilCode:coil.value,coilVoltage:coil.voltage,coilFrequency:50,model:profile.id+coil.value});
  }
  // Preserve user descriptions; replace only an unedited model label.
  if(n.label===oldModel)n.label=String(n.params.model);
  syncLinkedCoils(p,n);
  return true;
}

export function syncLinkedCoils(p:Project,contactor:Node){
  if(contactor.type!=="contactor3"||!selectedProduct(contactor))return;
  for(const coil of p.nodes.filter(n=>n.type==="coil"&&n.tag===contactor.tag)){
    Object.assign(coil.params,{brand:"Schneider Electric",model:contactor.params.model,voltage:contactor.params.coilVoltage,frequency:contactor.params.coilFrequency,va:contactor.params.coilVA});
  }
}

export function productFieldLocked(n:Node,key:string){
  const p=selectedProduct(n);if(!p)return false;
  return Object.hasOwn(p.params,key)||["coilVoltage","coilFrequency","coilCode"].includes(key);
}
export function productSettingRange(n:Node,key:string):[number,number]|undefined {
  if(selectedProduct(n)&&((n.type==="overload"&&key==="rating")||(n.type==="mccb"&&key==="tripSetting")))return [Number(n.params.minCurrent),Number(n.params.maxCurrent)];
}
