import type { Project } from "../circuit.ts";
import type { Runtime } from "./state.ts";
import { makeNetwork } from "./network.ts";
import { resistance } from "./cable.ts";
export function measure(p:Project,r:Runtime,a:string,b:string,mode:"voltage"|"continuity"|"resistance"|"current"){
 if(mode==="current")return {value:r.wireCurrent[a]??0,unit:"A",message:"Clamp pada satu konduktor"};
 if(!a||!b)return {value:null,unit:"",message:"Pilih dua terminal"};
 const net=makeNetwork(p,r,r.devices);
 if(mode==="voltage"){
  const x=r.nodeVoltage[a],y=r.nodeVoltage[b];if(!x||!y||x.source!==y.source)return {value:null,unit:"V",message:"Terminal floating / sumber terisolasi; tidak ada referensi tegangan yang sama"};
  return {value:Math.hypot(x.re-y.re,x.im-y.im),unit:"V AC/DC",message:x.net===y.net?"Satu electrical node":"Beda potensial dua terminal"};
 }
 if(Object.keys(r.energized).some(id=>!["N","PE","-"].includes(r.energized[id])))return {value:null,unit:"Ω",message:"Matikan seluruh sumber sebelum continuity / resistance"};
 if(net.root(a)!==net.root(b))return {value:null,unit:"Ω",message:"OL · rangkaian terbuka"};
 const path=net.path(a,b),ohms=path.reduce((sum,e)=>{const wire=p.wires.find(w=>e==="w:"+w.id);return sum+(wire?resistance(wire):0);},0);
 return {value:ohms,unit:"Ω",message:mode==="continuity"?"TERSAMBUNG":"Resistansi konduktor pada jalur; winding/impedansi beban tidak termasuk"};
}
