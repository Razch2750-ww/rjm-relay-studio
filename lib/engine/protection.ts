import { CATALOG,kind,number } from "../circuit.ts";
import type { Node } from "../circuit.ts";
import type { DeviceState,Runtime } from "./state.ts";
import { fault,setting } from "./state.ts";
export const protectionRating=(n:Node)=>number(n,"tripSetting",number(n,"rating"));
export const magneticThreshold=(n:Node)=>number(n,"magneticAmps")>0?number(n,"magneticAmps"):protectionRating(n)*number(n,"magnetic",n.params.curve==="B"?5:n.params.curve==="D"?20:10);
export function protectionStep(n:Node,old:DeviceState,s:DeviceState,r:Runtime,dt:number){
 const k=kind(n),rated=protectionRating(n),ratio=rated>0?s.current/rated:0;
 const thermal=Math.max(1,number(n,"thermalSeconds",30));
 const cool=Math.max(1,number(n,"coolingSeconds",30));
 s.heat=Math.min(2,Math.max(0,old.heat+(ratio>1?(ratio*ratio-1)*dt/thermal:-dt/cool)));
 if(fault(r,n.id,"trip"))s.tripped=true;
 else if(s.tripped&&k==="overload"&&n.params.resetMode==="auto"&&s.heat<=.2)s.tripped=false;
 if(!s.tripped&&rated>0){
   if((CATALOG[n.type].tripMode!=="magnetic"&&s.heat>=1)||(CATALOG[n.type].tripMode!=="thermal"&&k!=="overload"&&s.current>=magneticThreshold(n)&&dt>0))s.tripped=true;
 }
 if((k==="rcd"||CATALOG[n.type].residual)&&setting(r,n,"leakageMA")>=Math.max(1,number(n,"thresholdMA",30)))s.tripped=true;
 return s.tripped!==old.tripped;
}
