import { kind,number,pin,ports } from "../circuit.ts";
import type { Project } from "../circuit.ts";
import { coilKinds,freshRuntime } from "./state.ts";
import type { Runtime } from "./state.ts";
import { sizeProjectCables } from "../cable-sizing.ts";
import { nominalCurrent } from "./load.ts";
import { cableCapacity } from "./cable.ts";
import { protectionRating } from "./protection.ts";
import { stepCircuit } from "../simulator.ts";
export type Diagnostic={id:string;severity:"ERROR"|"WARNING"|"INFO";target:string;message:string};
export function checkWiring(p:Project,r:Runtime=freshRuntime()):Diagnostic[]{
 if(!Object.keys(r.devices).length)r=stepCircuit(p,r,0);
 const results:Diagnostic[]=[],add=(severity:Diagnostic["severity"],target:string,message:string)=>results.push({id:String(results.length),severity,target,message});
 const ends=new Map<string,number>();for(const w of p.wires){ends.set(w.from,(ends.get(w.from)??0)+1);ends.set(w.to,(ends.get(w.to)??0)+1);}
 const sizing=p.wires.some(w=>w.cable?.sizing==="auto")?sizeProjectCables(p).recommendations:undefined;
 const pairs=new Set<string>(),drivers=p.nodes.filter(n=>coilKinds.includes(kind(n))||["pfr","overload"].includes(kind(n)));
 for(const w of p.wires){
  const pair=[w.from,w.to].sort().join("|");if(pairs.has(pair))add("WARNING",w.id,"Koneksi kabel duplikat / paralel. Periksa apakah disengaja.");pairs.add(pair);
  if(w.cable){const iz=cableCapacity(w.cable);if(iz===null)add("WARNING",w.id,"Kapasitas kabel perlu input datasheet untuk material, isolasi, atau ukuran ini.");}
  else add("INFO",w.id,"Ukuran dan panjang kabel belum diisi.");
  if(w.cable?.sizing==="auto"&&sizing?.get(w.id)?.section===null)add("WARNING",w.id,"Ukuran AUTO belum terselesaikan: "+sizing.get(w.id)!.messages.join(" · "));
  const s=r.cables[w.id];if(s?.capacity!==null&&s?.capacity!==undefined){
    if(s.current>s.capacity)add("ERROR",w.id,`Arus ${s.current.toFixed(1)} A melebihi kapasitas kabel ${s.capacity.toFixed(1)} A.`);
    if(s.protection.length&&!s.protection.some(id=>protectionRating(p.nodes.find(n=>n.id===id)!)<=s.capacity!))add("ERROR",w.id,"Critical protection coordination: semua pemutus upstream lebih besar dari kapasitas kabel.");
  }
  if(s&&s.drop>6.9)add("WARNING",w.id,`Jatuh tegangan segmen ${s.drop.toFixed(2)} V. Periksa total jalur ke beban.`);
 }
 for(const n of p.nodes){
  const k=kind(n),state=r.devices[n.id];
  if(["contactor","no","nc","changeover","auxiliary","timedContact"].includes(k)&&!drivers.some(x=>x.tag===n.tag))add("ERROR",n.id,"Kontak tidak memiliki coil / proteksi penggerak dengan tag yang sama.");
  if(coilKinds.includes(k)){
   if(!ends.has(pin(n,"A1"))||!ends.has(pin(n,"A2")))add("ERROR",n.id,"Coil terbuka: A1 atau A2 belum terhubung.");
   if(p.nodes.filter(x=>coilKinds.includes(kind(x))&&x.tag===n.tag).length>1)add("ERROR",n.id,"Tag coil duplikat; satu tag harus mempunyai satu penggerak.");
   if(state&&state.voltage>0&&(state.voltage<number(n,"voltage",230)*.85||state.voltage>number(n,"voltage",230)*1.15))add("ERROR",n.id,`Coil ${number(n,"voltage",230)} V menerima ${state.voltage.toFixed(1)} V.`);
  }
  if(["motor","heater"].includes(k)){
   const rated=nominalCurrent(n);rated.current*=Math.max(1,number(n,"fanCount",1));if(rated.error)add("WARNING",n.id,rated.error);
   if(!ends.has(pin(n,"PE")))add("WARNING",n.id,"Terminal PE beban belum tersambung.");
   if((n.params.neutralRequired||ports(n).some(t=>t.name==="L"))&&!ends.has(pin(n,"N")))add("ERROR",n.id,"Netral beban belum tersambung.");
   const path=(r.branchProtection[n.id]??[]).map(id=>p.nodes.find(x=>x.id===id)!).filter(Boolean);
   if(state?.on&&!path.some(x=>["breaker","fuse"].includes(kind(x))))add("ERROR",n.id,"Beban aktif tanpa pemutus upstream.");
   for(const protection of path){const rating=protectionRating(protection),pk=kind(protection);
    if(rating>0&&rating<rated.current)add("WARNING",protection.id,`${protection.tag} ${rating} A < ${n.tag} ${rated.current.toFixed(1)} A. Berpotensi trip / terlalu kecil saat running.`);
    if(pk==="overload"&&rating>rated.current*1.25&&rated.current>0)add("WARNING",protection.id,"Setelan overload >125% arus nameplate. Verifikasi data motor dan faktor servis.");
    const starting=number(n,"lra")>0?number(n,"lra")*Math.max(1,number(n,"fanCount",1)):rated.current*number(n,"startFactor",1);
    if(pk==="breaker"&&starting>rating*(protection.params.curve==="B"?3:protection.params.curve==="D"?10:5))add("WARNING",protection.id,"Arus start berada di wilayah magnetic kurva. Cocokkan durasi start dengan kurva pabrikan.");
   }
  }
  if(k==="contactor"&&state&&state.current>number(n,"rating",25))add("ERROR",n.id,"Arus beban melebihi rating operasional kontaktor.");
  if(k==="overload"&&(number(n,"rating")<number(n,"minCurrent")||number(n,"rating")>number(n,"maxCurrent",1e8)))add("ERROR",n.id,"Setelan overload di luar range perangkat.");
  if(k!=="text")for(const t of ports(n))if(!ends.has(pin(n,t.name)))add("INFO",n.id,`${n.tag}-${t.name} tidak digunakan.`);
 }
 const phases=[r.phaseCurrent.R,r.phaseCurrent.S,r.phaseCurrent.T],max=Math.max(...phases),min=Math.min(...phases);
 if(max>0&&(max-min)/max>.2&&p.nodes.some(n=>n.type==="source3"))add("WARNING",p.nodes.find(n=>n.type==="source3")!.id,"Beban antar fase berbeda lebih dari 20% dari arus fase tertinggi.");
 for(const message of r.faults)add("ERROR","",message);
 return results.sort((a,b)=>["ERROR","WARNING","INFO"].indexOf(a.severity)-["ERROR","WARNING","INFO"].indexOf(b.severity));
}
