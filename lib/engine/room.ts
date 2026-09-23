import { defaultRoom,kind,number } from "../circuit.ts";
import type { Project } from "../circuit.ts";
import type { Runtime } from "./state.ts";
export function roomStep(p:Project,r:Runtime,dt:number){
 const c=p.room??defaultRoom;if(!c.enabled)return;
 if(r.now<=dt){r.room={temperature:c.initial,evaporator:c.initial-8,suction:c.suction,discharge:c.discharge,door:!!r.manual["room:door"]};}
 r.room.door=!!r.manual["room:door"];
 const comp=p.nodes.some(n=>n.type.startsWith("compressor")&&r.devices[n.id]?.on);
 const fan=p.nodes.some(n=>n.type.startsWith("evaporator")&&r.devices[n.id]?.on);
 const heaters=p.nodes.filter(n=>kind(n)==="heater"&&r.devices[n.id]?.on).reduce((sum,n)=>sum+number(n,"watts"),0);
 const area=2*(c.length*c.width+c.length*c.height+c.width*c.height);
 const gain=area*c.envelopeU*(c.ambient-r.room.temperature)+c.heatLoad+(r.room.door?c.doorKW*1000:0)+heaters;
 const cooling=comp&&fan?Math.min(c.coolingKW,c.evaporatorKW)*1000:0;
 const capacity=c.length*c.width*c.height*1.2*1005+c.productKg*c.productSpecificHeat*1000;
 r.room.temperature=Math.min(100,Math.max(-100,r.room.temperature+(gain-cooling)*dt/Math.max(1,capacity)));
 const evapTarget=heaters>0?20:comp?r.room.temperature-10:r.room.temperature;
 r.room.evaporator+=(evapTarget-r.room.evaporator)*(1-Math.exp(-dt/60));
 r.room.suction=r.values["room:suction"]??c.suction;r.room.discharge=r.values["room:discharge"]??c.discharge;
 for(const n of p.nodes)if(kind(n)==="probe"&&n.params.roomBinding){r.values[n.id+":value"]=n.params.roomBinding==="evaporator"?r.room.evaporator:r.room.temperature;}
}
