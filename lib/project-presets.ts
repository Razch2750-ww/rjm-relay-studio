import type { Project } from "./circuit.ts";
import { dolTemplate, jagoTemplate } from "./templates.ts";
import { dsvTemplate, lionColdTemplate, lionPumpTemplate, lionSdpTemplate } from "./panel-templates.ts";

export const PROJECT_PRESETS = [
  {id:"lion-sdp",name:"Lion · Distribusi SDP",description:"12 feeder · MCCB 200 A · PDF hlm. 2–3",create:lionSdpTemplate},
  {id:"lion-pump",name:"Lion · Water pump",description:"3 dry cooler + 2 pump · MAN/AUTO · hlm. 5–7",create:lionPumpTemplate},
  {id:"lion-freezer-chiller",name:"Lion · Freezer & chiller",description:"2 XR70CX · beban 1 fase · hlm. 9–11",create:()=>lionColdTemplate(true)},
  {id:"lion-chiller",name:"Lion · Chiller",description:"1 XR70CX · beban 1 fase · hlm. 13–15",create:()=>lionColdTemplate(false)},
  {id:"dsv",name:"DSV · Dua CDU 8 HP",description:"2 ETC-974 · timer pergantian · PDF hlm. 2–4",create:dsvTemplate},
  {id:"jago",name:"Jago Coffee",description:"Panel cold room · contoh awal",create:jagoTemplate},
  {id:"dol",name:"Latihan START / STOP",description:"Push button dan kontak pengunci",create:dolTemplate},
] as const;
export type PresetId=typeof PROJECT_PRESETS[number]["id"];
export type ReferenceLink={file:string;label:string;page:number};
const lionFile="LION_SUPER_INDO_2026-09-15.pdf",dsvFile="DSV_SOLUTIONS_2026-08-22.pdf";
const pages=(file:string,power:number,control:number|undefined,layout:number):ReferenceLink[]=>[
  {file,label:"Power · halaman "+power,page:power},
  ...(control?[{file,label:"Control · halaman "+control,page:control}]:[]),
  {file,label:"Layout · halaman "+layout,page:layout},
];
export function projectReferences(p:Project):ReferenceLink[]{
  // Older exported v1 Jago files have no referenceKey; keep their reference links.
  const key=p.referenceKey??(p.notes.includes("ACUAN: POWER.pdf, CONTROL.pdf")?"jago":undefined);
  switch(key){
    case "lion-sdp":return pages(lionFile,2,undefined,3);
    case "lion-pump":return pages(lionFile,5,6,7);
    case "lion-freezer-chiller":return pages(lionFile,9,10,11);
    case "lion-chiller":return pages(lionFile,13,14,15);
    case "dsv":return pages(dsvFile,2,3,4);
    case "jago":return [{file:"POWER.pdf",label:"Power",page:1},{file:"CONTROL.pdf",label:"Control",page:1},{file:"CONTROL_PANEL_LAMP.pdf",label:"Layout panel & lampu",page:1}];
    default:return [];
  }
}
