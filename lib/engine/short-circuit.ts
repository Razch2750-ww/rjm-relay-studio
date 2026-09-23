import { kind,number,pin,poles } from "../circuit.ts";
import type { Project } from "../circuit.ts";
import { makeNetwork,phasor } from "./network.ts";
import { fault } from "./state.ts";
import type { Runtime } from "./state.ts";
import { resistance } from "./cable.ts";
export function shortCurrents(p:Project,r:Runtime,net:ReturnType<typeof makeNetwork>){
 const edgeCurrent=new Map<string,number>(),errors:string[]=[],events:string[]=[];
 const apply=(sourceId:string,volts:number,path:string[])=>{
  const source=p.nodes.find(n=>n.id===sourceId),ka=source?number(source,"faultKA"):0;
  if(ka<=0){errors.push("Hubung singkat: isi arus gangguan prospektif (kA) pada sumber agar proteksi dapat dihitung.");return;}
  const loop=path.reduce((sum,e)=>{const w=p.wires.find(w=>e==="w:"+w.id);return sum+(w?resistance(w,r.cables[w.id]?.temperature,fault(r,w.id,"loose")):0);},0);
  const amps=volts/(volts/(ka*1000)+loop);
  for(const e of path)edgeCurrent.set(e,Math.max(edgeCurrent.get(e)??0,amps));
  events.push("Hubung singkat "+amps.toFixed(0)+" A · Z loop "+loop.toFixed(3)+" Ω");
  const breakers=path.map(e=>p.nodes.find(n=>e.startsWith("n:"+n.id+":")&&["breaker","fuse"].includes(kind(n)))).filter(Boolean);
  if(!breakers.length)errors.push("Hubung singkat tidak memiliki pemutus pada jalur ke sumber.");
  else if(!breakers.some(n=>number(n!,"breakingKA",6)*1000>=amps*(1-1e-9)))errors.push("Breaking capacity semua pemutus di jalur lebih kecil dari arus hubung singkat.");
 };
 for(const potentials of net.potentials.values())if(potentials.length>1){
  const a=potentials[0];for(const b of potentials.slice(1)){
   if(a.source!==b.source){errors.push("Sumber independen bertabrakan; model tidak mendukung sumber paralel.");continue;}
   if(a.phase===b.phase)continue;
   const va=phasor(a),vb=phasor(b),v=Math.hypot(va.re-vb.re,va.im-vb.im);
   if(v>0)apply(a.source,v,net.path(a.port,b.port));
  }
 }
 for(const n of p.nodes)if(fault(r,n.id,"short")){
  const terminals=poles(n)===3?["U","V"]:kind(n)==="lamp"?["X1","X2"]:["L","N"],a=pin(n,terminals[0]),b=pin(n,terminals[1]),v=net.voltage(a,b),src=net.unique(a);
  if(v>0&&src)apply(src.source,v,[...net.path(a),...net.path(b)]);
 }
 for(const w of p.wires)if(fault(r,w.id,"short")){
  const a=net.unique(w.to);if(!a||["N","PE","-"].includes(a.phase))continue;
  const volts=a.three?a.voltage/Math.sqrt(3):a.voltage;apply(a.source,volts,net.path(w.to));
 }
 return {edgeCurrent,errors,events};
}
