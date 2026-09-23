import { kind, number, poles } from "../circuit.ts";
import type { Node } from "../circuit.ts";
import { fault,setting } from "./state.ts";
import type { Runtime,DeviceState } from "./state.ts";
export function nominalCurrent(n:Node):{current:number;estimated:boolean;error?:string}{
 if(kind(n)!=="motor")return {current:number(n,"watts")/((poles(n)===3?Math.sqrt(3):1)*Math.max(1,number(n,"voltage",230))),estimated:false};
 if(number(n,"current")>0)return {current:number(n,"current"),estimated:false};
 if(n.params.inputMode!=="quick"||number(n,"hp")<=0)return {current:0,estimated:false,error:"Arus nameplate / HP belum diisi"};
 if(n.params.hpBasis==="cooling")return {current:0,estimated:true,error:"HP/PK pendinginan bukan daya poros; isi arus nameplate"};
 return {current:number(n,"hp")*(n.params.hpUnit==="PK"?735.5:745.7)/(Math.max(1,number(n,"voltage",400))*(poles(n)===3?Math.sqrt(3):1)*Math.max(.01,number(n,"powerFactor",.8))*Math.max(.01,number(n,"efficiency",.85))),estimated:true};
}
export function loadCurrent(n:Node,s:DeviceState,r:Runtime,cableOverload=false){
 const k=kind(n),rated=nominalCurrent(n),nominalV=Math.max(1,number(n,"voltage",230));
 if(!s.on||fault(r,n.id,"coil-open"))return {amps:0,watts:0,pf:1,starting:false,estimated:rated.estimated};
 const multiplier=fault(r,n.id,"overload")||cableOverload?3:1;
 if(k!=="motor"){
   const amps=Math.max(0,setting(r,n,"watts"))*s.voltage/(nominalV*nominalV*(poles(n)===3?Math.sqrt(3):1))*multiplier;
   return {amps,watts:(poles(n)===3?Math.sqrt(3):1)*s.voltage*amps,pf:1,starting:false,estimated:false};
 }
 const starting=fault(r,n.id,"locked")||s.elapsed<number(n,"startSeconds"),base=Math.max(0,r.values[n.id+":current"]??rated.current);
 let amps=base*Math.max(0,setting(r,n,"loadFactor",1));
 if(starting)amps=number(n,"lra")>0?number(n,"lra"):amps*Math.max(1,number(n,"startFactor",6));
 if(starting&&n.params.startingMethod==="star-delta"&&!fault(r,n.id,"locked"))amps/=3;
 if(starting&&n.params.startingMethod==="soft-start"&&!fault(r,n.id,"locked"))amps=Math.min(amps,base*3);
 amps*=multiplier*Math.max(1,number(n,"fanCount",1));
 // Constant-power running approximation; locked rotor/start modeled as impedance.
 amps*=starting?s.voltage/nominalV:nominalV/Math.max(nominalV*.3,s.voltage);
 const pf=Math.min(1,Math.max(.01,starting?number(n,"startPowerFactor",.35):number(n,"powerFactor",.8)));
 return {amps,watts:(poles(n)===3?Math.sqrt(3):1)*s.voltage*amps*pf,pf,starting,estimated:rated.estimated};
}
