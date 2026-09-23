import { number } from "../circuit.ts";
import type { Node, EventEntry } from "../circuit.ts";
export type DeviceState={on:boolean;input:boolean;tripped:boolean;elapsed:number;offAt:number;heat:number;stage:string;stageTime:number;cycleTime:number;cool:boolean;fan:boolean;defrost:boolean;current:number;voltage:number;temperature?:number;alarm?:boolean;peak?:number};
export type CableState={current:number;capacity:number|null;utilization:number|null;drop:number;temperature:number;status:string;protection:string[]};
export type Runtime={now:number;devices:Record<string,DeviceState>;manual:Record<string,boolean|string>;values:Record<string,number>;requests:Record<string,boolean>;energized:Record<string,string>;wireCurrent:Record<string,number>;faults:string[];warnings:string[];log:EventEntry[];halted:boolean;watts:number;injected:Record<string,boolean>;cables:Record<string,CableState>;phaseCurrent:Record<string,number>;kva:number;pf:number;peak:number;room:{temperature:number;evaporator:number;suction:number;discharge:number;door:boolean};clockStart:number;nodeVoltage:Record<string,{re:number;im:number;net:string;source:string}>;branchProtection:Record<string,string[]>;maxWire:Record<string,number>};
export const coilKinds=["coil","ton","toff","impulse","cyclic","interval","schedule"];
export const loadKinds=["motor","heater","lamp","buzzer","valve"];
export const freshState=():DeviceState=>({on:false,input:false,tripped:false,elapsed:0,offAt:0,heat:0,stage:"cooling",stageTime:0,cycleTime:0,cool:false,fan:false,defrost:false,current:0,voltage:0});
export const freshRuntime=():Runtime=>({now:0,devices:{},manual:{},values:{},requests:{},energized:{},wireCurrent:{},faults:[],warnings:[],log:[],halted:false,watts:0,injected:{},cables:{},phaseCurrent:{R:0,S:0,T:0,N:0},kva:0,pf:1,peak:0,room:{temperature:8,evaporator:-5,suction:2,discharge:16,door:false},clockStart:8*3600,nodeVoltage:{},branchProtection:{},maxWire:{}});
export const stateOf=(r:Runtime,n:Node)=>r.devices[n.id]??freshState();
export const setting=(r:Runtime,n:Node,k:string,fallback=0)=>r.values[n.id+":"+k]??number(n,k,fallback);
export const switched=(r:Runtime,n:Node)=>typeof r.manual[n.id]==="boolean"?r.manual[n.id] as boolean:!!n.params.on;
export const fault=(r:Runtime,id:string,name:string)=>!!r.injected?.[id+":"+name];
export function logEvent(r:Runtime,text:string,category:string,nodeId?:string){r.log.push({time:r.now,text,category,...(nodeId?{nodeId}:{})});}
