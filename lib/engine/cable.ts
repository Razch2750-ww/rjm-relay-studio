import type { Cable,Wire } from "../circuit.ts";
import type { CableState } from "./state.ts";
// Schneider Electrical Installation Guide, IEC B.52.4, three loaded Cu/PVC conductors.
// No extrapolated ampacity for smaller/custom sections, Al or XLPE: use manufacturer override.
const sizes=[1.5,2.5,4,6,10,16,25,35,50];
const tables={A2:[13,17.5,23,29,39,52,68,83,99],B2:[15,20,27,34,46,62,80,99,118],C:[17.5,24,32,41,57,76,96,119,144]};
const tempRows=[[10,1.22,1.15],[15,1.17,1.12],[20,1.12,1.08],[25,1.06,1.04],[30,1,1],[35,.94,.96],[40,.87,.91],[45,.79,.87],[50,.71,.82],[55,.61,.76],[60,.50,.71],[65,0,.65],[70,0,.58],[75,0,.50],[80,0,.41],[90,0,0]];
export function cableCapacity(c:Cable){
 const base=c.ampacity>0?c.ampacity:c.material==="Cu"&&c.insulation==="PVC"?tables[c.method][sizes.indexOf(c.section)]:undefined;
 if(base===undefined)return null;
 const row=tempRows.find(row=>row[0]>=c.ambient)??tempRows.at(-1)!;
 return base*(c.mode==="advanced"?row[c.insulation==="PVC"?1:2]*c.grouping:1);
}
export function resistance(w:Wire,temperature=30,loose=false){
 if(!w.cable)return loose?2:0;
 const c=w.cable,rho=c.material==="Cu"?.017241:.028264;
 return rho*c.length/Math.max(.001,c.section)*(1+.00393*(temperature-20))+c.resistance+(loose?2:0);
}
export function cableStep(w:Wire,old:CableState|undefined,current:number,dt:number,loose=false,derating=false):CableState{
 const c=w.cable;if(!c)return {current,capacity:null,utilization:null,drop:current*resistance(w,30,loose),temperature:30,status:"BELUM DIISI",protection:[]};
 const capacity=cableCapacity(c),iz=capacity===null?null:capacity*(derating?.5:1),limit=c.insulation==="PVC"?70:90;
 const target=iz===null?c.ambient:c.ambient+(limit-c.ambient)*(current/Math.max(.01,iz))**2;
 const temperature=Math.min(1500,(old?.temperature??c.ambient)+(target-(old?.temperature??c.ambient))*(1-Math.exp(-dt/120)));
 const utilization=iz===null?null:current/Math.max(.01,iz)*100,drop=current*resistance(w,temperature,loose);
 const status=utilization===null?"KAPASITAS BELUM DIISI":temperature>limit+10||utilization>150?"DANGEROUS":utilization>100?"UNDERSIZED":utilization>80||temperature>limit?"WARNING":utilization>0&&utilization<20?"OVERSIZED":"SAFE";
 return {current,capacity:iz,utilization,drop,temperature,status,protection:[]};
}
