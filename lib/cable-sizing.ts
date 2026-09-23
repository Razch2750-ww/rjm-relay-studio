import { controllerPins,defaultCable,kind,number,pin,poles,ports } from "./circuit.ts";
import type { Node,Project,Wire } from "./circuit.ts";
import { conductorLinks } from "./wire-colors.ts";
import { cableCapacity,resistance } from "./engine/cable.ts";
import { nominalCurrent } from "./engine/load.ts";
import { protectionRating } from "./engine/protection.ts";

const SIZES=[1.5,2.5,4,6,10,16,25,35,50];
const COILS=["coil","ton","toff","impulse","cyclic","interval","schedule"];
const LOADS=["motor","heater","lamp","buzzer","valve"];
const amp=(a:number)=>a.toLocaleString("id-ID",{maximumFractionDigits:a<1?3:2})+" A";
export function componentAmperage(n:Node):string|undefined{
  const k=kind(n);
  if(["text","junction","bus","probe"].includes(k))return;
  if(["breaker","fuse","overload"].includes(k))return "Setelan "+amp(protectionRating(n));
  if(number(n,"rating")>0)return "Rating "+amp(number(n,"rating"));
  if(LOADS.includes(k)){const current=nominalCurrent(n);return current.current>0?(current.estimated?"Est. ":"Nominal ")+amp(current.current*(k==="motor"?Math.max(1,number(n,"fanCount",1)):1)):"Arus: belum diisi";}
  if(COILS.includes(k))return "Coil "+amp(number(n,"va",3)/Math.max(1,number(n,"voltage",230)));
  if(k==="controller")return "Model "+amp(3/Math.max(1,number(n,"voltage",230)));
  if(k==="transformer")return "Sekunder "+amp(number(n,"va",100)/Math.max(1,number(n,"secondary",230)));
  return "Rating: — A";
}
export const cableSizingMode=(w:Wire)=>w.cable?.sizing??(w.cable?"manual":"auto");
export function cableAnnotation(w:Wire){
  const c=w.cable,mode=cableSizingMode(w)==="auto"?"AUTO":"MANUAL";
  return c?`${w.label? w.label+" · ":""}${c.section.toLocaleString("id-ID")} mm² · ${mode}`:`${w.label? w.label+" · ":""}mm² belum diisi`;
}
export type CableRecommendation={current:number;protection:number;section:number|null;capacity:number|null;dropPercent:number;estimated:boolean;messages:string[];loads:string[]};
type Demand={node:Node;current:number;estimated:boolean;terminals:string[];unknown?:string};
function demands(project:Project):Demand[]{
  return project.nodes.flatMap<Demand>(n=>{
    const k=kind(n),voltage=Math.max(1,number(n,"voltage",230));
    if(LOADS.includes(k)){const rated=nominalCurrent(n);return [{node:n,current:rated.current*(k==="motor"?Math.max(1,number(n,"fanCount",1)):1),estimated:rated.estimated,terminals:ports(n).filter(p=>p.name!=="PE").map(p=>pin(n,p.name)),unknown:rated.current>0?undefined:n.tag+": arus / daya beban belum lengkap"}];}
    if(COILS.includes(k))return [{node:n,current:number(n,"va",3)/voltage,estimated:false,terminals:[pin(n,"A1"),pin(n,"A2")]}];
    if(k==="controller"){const cp=controllerPins(n);return [{node:n,current:3/voltage,estimated:true,terminals:[pin(n,cp.line),pin(n,cp.neutral)]}];}
    // Size the primary for full transformer VA; the secondary is traced independently.
    if(k==="transformer")return [{node:n,current:number(n,"va",100)/voltage,estimated:false,terminals:[pin(n,"P1"),pin(n,"P2")]}];
    if(k==="pfr")return [{node:n,current:0,estimated:false,terminals:["L1","L2","L3"].map(p=>pin(n,p)),unknown:n.tag+": konsumsi PFR perlu datasheet; pilih ukuran manual"}];
    return [];
  });
}

/** Nominal design loads across all possible contact states, including inter-sheet nets.
 * Bridges carry downstream totals. Each parallel/cyclic block receives its full
 * downstream demand conservatively, never an assumed equal current split. */
export function sizeProjectCables(project:Project):{project:Project;recommendations:Map<string,CableRecommendation>}{
  const nodes=new Map(project.nodes.map(n=>[n.id,n])),wires=new Map(project.wires.map(w=>[w.id,w]));
  const edges=conductorLinks(project),adj=new Map<string,{to:string;edge:number}[]>();
  const add=(a:string,b:string,edge:number)=>{if(!adj.has(a))adj.set(a,[]);adj.get(a)!.push({to:b,edge});};
  edges.forEach((e,i)=>{add(e.a,e.b,i);add(e.b,e.a,i);});
  const sources=new Map<string,{node:Node;phase:string}>();
  for(const n of project.nodes){
    if(kind(n)==="source")for(const p of ports(n))sources.set(pin(n,p.name),{node:n,phase:p.name});
    if(kind(n)==="transformer")for(const phase of ["S1","S2"])sources.set(pin(n,phase),{node:n,phase});
  }
  const seen=new Map<string,number>(),low=new Map<string,number>(),bridges=new Set<number>();let time=0;
  // Iterative Tarjan traversal avoids call-stack limits on large imported diagrams.
  for(const origin of adj.keys())if(!seen.has(origin)){
    seen.set(origin,++time);low.set(origin,time);
    const stack=[{at:origin,parent:"",edge:-1,index:0}];
    while(stack.length){
      const frame=stack.at(-1)!,next=adj.get(frame.at)![frame.index++];
      if(!next){stack.pop();if(frame.edge>=0){low.set(frame.parent,Math.min(low.get(frame.parent)!,low.get(frame.at)!));if(low.get(frame.at)!>seen.get(frame.parent)!)bridges.add(frame.edge);}continue;}
      if(next.edge===frame.edge)continue;
      if(seen.has(next.to)){low.set(frame.at,Math.min(low.get(frame.at)!,seen.get(next.to)!));continue;}
      seen.set(next.to,++time);low.set(next.to,time);stack.push({at:next.to,parent:frame.at,edge:next.edge,index:0});
    }
  }
  const block=new Map<string,number>(),internal=new Map<number,number[]>(),tree=new Map<number,{to:number;edge:number}[]>();let count=0;
  for(const origin of adj.keys())if(!block.has(origin)){
    const id=count++,queue=[origin];block.set(origin,id);internal.set(id,[]);tree.set(id,[]);
    for(let i=0;i<queue.length;i++)for(const e of adj.get(queue[i])!)if(!bridges.has(e.edge)&&!block.has(e.to)){block.set(e.to,id);queue.push(e.to);}
  }
  edges.forEach((e,i)=>{const a=block.get(e.a)!,b=block.get(e.b)!;if(a===b)internal.get(a)!.push(i);else{tree.get(a)!.push({to:b,edge:i});tree.get(b)!.push({to:a,edge:i});}});
  const parent=new Map<number,{to:number;edge:number}>(),sourceFor=new Map<number,string>(),conflicting=new Set<number>();
  for(const [terminal] of sources){
    const start=block.get(terminal);if(start===undefined)continue;
    if(sourceFor.has(start)){const existing=sourceFor.get(start)!;for(const [id,source] of sourceFor)if(source===existing)conflicting.add(id);continue;}
    const queue=[start];sourceFor.set(start,terminal);
    for(let i=0;i<queue.length;i++)for(const next of tree.get(queue[i])!)if(!sourceFor.has(next.to)){sourceFor.set(next.to,terminal);parent.set(next.to,{to:queue[i],edge:next.edge});queue.push(next.to);}
  }
  const rec=new Map<string,CableRecommendation>(project.wires.map(w=>[w.id,{current:0,protection:0,section:null,capacity:null,dropPercent:0,estimated:false,messages:[],loads:[]}]));
  const blockers=new Set<string>(),loadPaths:{d:Demand;paths:string[][]}[]=[];
  const message=(id:string,text:string,blocking=false)=>{const r=rec.get(id)!;if(!r.messages.includes(text))r.messages.push(text);if(blocking)blockers.add(id);};
  for(const d of demands(project)){
    const paths:string[][]=[],touched=new Set<string>(),supplyIds=new Set<string>();let disconnected=false,returnProtection=0;
    for(const terminal of d.terminals){
      let at=block.get(terminal);const path:number[]=[];
      if(at===undefined||!sourceFor.has(at)){disconnected=true;paths.push([]);continue;}
      supplyIds.add(sources.get(sourceFor.get(at)!)!.node.id);
      const conflict=conflicting.has(at);
      while(true){path.push(...internal.get(at)!);const p=parent.get(at);if(!p)break;path.push(p.edge);at=p.to;}
      for(const i of path){const n=nodes.get(edges[i].nodeId??"");if(n&&["breaker","fuse"].includes(kind(n)))returnProtection=Math.max(returnProtection,protectionRating(n));}
      const ids=path.flatMap(i=>edges[i].wireId?[edges[i].wireId!]:[]);paths.push(ids);
      for(let i=0;i<path.length;i++){
        const edge=edges[path[i]],id=edge.wireId;if(!id||touched.has(id))continue;touched.add(id);
        const r=rec.get(id)!;r.current+=d.current;r.estimated||=d.estimated;r.loads.push(d.node.tag);
        const protection=(indices:number[])=>indices.map(j=>edges[j].nodeId?nodes.get(edges[j].nodeId!):undefined).find(n=>n&&["breaker","fuse"].includes(kind(n))&&protectionRating(n)>0);
        const upstream=protection(path.slice(i+1)),downstream=protection(path.slice(0,i).reverse()),device=upstream??downstream;
        if(device)r.protection=Math.max(r.protection,protectionRating(device));
        else message(id,"Pengaman cabang belum ditemukan; periksa koordinasi pengaman.");
        if(d.unknown)message(id,d.unknown,true);
        if(conflict)message(id,"Lebih dari satu terminal sumber terhubung. Perbaiki wiring sebelum hitung otomatis.",true);
        if(path.some(j=>!bridges.has(j)))message(id,"Jalur paralel: arus dihitung konservatif tanpa pembagian beban.");
      }
    }
    // A neutral/return is protected by the phase device even though the neutral pole
    // itself is unswitched. Use the greatest associated rating conservatively.
    for(const id of touched)if(rec.get(id)!.protection===0&&returnProtection>0){const r=rec.get(id)!;r.protection=returnProtection;r.messages=r.messages.filter(m=>!m.startsWith("Pengaman cabang belum"));}
    if(disconnected)for(const id of touched)message(id,d.node.tag+": terminal beban belum lengkap ke sumber.",true);
    if(supplyIds.size>1)for(const id of touched)message(id,d.node.tag+": terminal memakai sumber berbeda; periksa wiring.",true);
    loadPaths.push({d,paths});
  }
  for(const w of project.wires){
    const r=rec.get(w.id)!,c=w.cable??defaultCable;
    if(c.material!=="Cu"||c.insulation!=="PVC"||c.ampacity>0){message(w.id,"Otomatis memakai tabel Cu/PVC. Material / kapasitas datasheet ini perlu ukuran manual.",true);continue;}
    if(!r.loads.length){message(w.id,"Beban belum terlacak; isi atau hubungkan beban. Kabel sinyal perlu ukuran manual.",true);continue;}
    if(r.current>r.protection&&r.protection>0)message(w.id,"Arus beban melampaui setelan pengaman. Periksa rating pengaman.");
    if(blockers.has(w.id))continue;
    r.section=SIZES.find(section=>(cableCapacity({...c,section,mode:"advanced"})??0)>=Math.max(r.current,r.protection))??null;
    if(r.section===null)message(w.id,"Kebutuhan melampaui tabel 1,5–50 mm² atau faktor koreksi tidak mendukung.",true);
  }
  const effective=(id:string):Wire=>{const w=wires.get(id)!,r=rec.get(id)!;return cableSizingMode(w)==="auto"&&r.section!==null&&!blockers.has(id)?{...w,cable:{...(w.cable??defaultCable),section:r.section,mode:"advanced",sizing:"auto"}}:w;};
  const maxDrop=project.calculation.maxDrop,upstreamDrop=project.calculation.upstreamDrop;
  const pathDrop=(ids:string[])=>ids.reduce((sum,id)=>sum+rec.get(id)!.current*resistance(effective(id),70),0);
  const demandDrop=({d,paths}:{d:Demand;paths:string[][]})=>{
    const drops=paths.map(pathDrop).sort((a,b)=>b-a);
    // Sum the two greatest conductor-path drops: conservative for 3-phase AC,
    // exact resistive loop for single phase/DC. Includes the full feeder path.
    const voltage=Math.max(1,number(d.node,"voltage",230)/(poles(d.node)===3&&d.node.params.neutralRequired?Math.sqrt(3):1));
    return ((drops[0]??0)+(drops[1]??0))*100/voltage+upstreamDrop;
  };
  for(let iteration=0;iteration<SIZES.length;iteration++){
    let changed=false;
    for(const load of loadPaths)if(demandDrop(load)>maxDrop){
      for(const id of new Set(load.paths.flat())){const r=rec.get(id)!,w=wires.get(id)!;
        if(cableSizingMode(w)!=="auto"||blockers.has(id)||r.section===null)continue;
        const next=SIZES[SIZES.indexOf(r.section)+1];if(next!==undefined){r.section=next;changed=true;}
      }
    }
    if(!changed)break;
  }
  for(const load of loadPaths){const drop=demandDrop(load);for(const id of new Set(load.paths.flat())){rec.get(id)!.dropPercent=Math.max(rec.get(id)!.dropPercent,drop);if(drop>maxDrop+.001)message(id,`Drop total jalur ${drop.toFixed(1)}% > batas ${maxDrop}%. Periksa kabel manual, panjang, atau ukuran di luar tabel.`);}}
  // Conservative Cu PE sizing: do not reduce below any associated phase section,
  // and assume a separate PE without mechanical protection (minimum 4 mm²).
  // This is not an earth-fault disconnection-time or adiabatic verification.
  const peNeeds=new Map<string,{section:number;loads:Set<string>;incomplete:boolean}>();
  for(const load of loadPaths){
    const pe=pin(load.d.node,"PE");let at=block.get(pe);
    if(at===undefined||!sourceFor.has(at)||sources.get(sourceFor.get(at)!)?.phase!=="PE")continue;
    const phaseIds=[...new Set(load.paths.flat())],phaseCables=phaseIds.map(id=>effective(id).cable);
    const incomplete=!phaseIds.length||phaseIds.some(id=>blockers.has(id)&&cableSizingMode(wires.get(id)!)==="auto")||phaseCables.some(c=>!c||c.material!=="Cu");
    const section=Math.max(4,...phaseCables.map(c=>c?.section??0));
    const path:number[]=[];while(true){path.push(...internal.get(at)!);const p=parent.get(at);if(!p)break;path.push(p.edge);at=p.to;}
    for(const index of path){const id=edges[index].wireId;if(!id)continue;const need=peNeeds.get(id)??{section:4,loads:new Set<string>(),incomplete:false};need.section=Math.max(need.section,section);need.incomplete||=incomplete;need.loads.add(load.d.node.tag);peNeeds.set(id,need);}
  }
  for(const [id,need] of peNeeds){const w=wires.get(id)!,c=w.cable??defaultCable,r=rec.get(id)!;
    if(need.incomplete||c.material!=="Cu"||c.insulation!=="PVC"||c.ampacity>0||!SIZES.includes(need.section))continue;
    blockers.delete(id);r.section=need.section;r.loads=[...need.loads];r.estimated=true;r.messages=["PE mengikuti penampang fase terbesar pada jalurnya, minimum 4 mm² Cu. Periksa waktu pemutusan gangguan tanah."];
  }
  for(const w of project.wires){const r=rec.get(w.id)!,c=effective(w.id).cable??defaultCable;r.capacity=cableCapacity(c);if(r.capacity!==null&&Math.max(r.current,r.protection)>r.capacity)message(w.id,"Ukuran terpasang di bawah kebutuhan arus / pengaman.");}
  return {project:{...project,wires:project.wires.map(w=>effective(w.id))},recommendations:rec};
}
