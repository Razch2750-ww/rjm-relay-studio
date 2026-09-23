import { controllerPins, kind, pin, poles, ports } from "./circuit.ts";
import type { Project } from "./circuit.ts";

export const WIRE_COLORS:Record<string,string>={R:"#e53935",S:"#ffdc00",T:"#ffffff",N:"#1976ed",PE:"#18a34a","+":"#e53935","-":"#1976ed",auto:"#596775",signal:"#796391"};
export const WIRE_COLOR_LABELS:Record<string,string>={R:"R · Merah",S:"S · Kuning",T:"T · Putih",N:"N · Biru",PE:"PE · Hijau",auto:"Otomatis · ikuti jalur",signal:"Sinyal"};
const phaseName=(name:string)=>({L:"R",L1:"R",L2:"S",L3:"T",R:"R",S:"S",T:"T",N:"N",PE:"PE","+":"+","-":"-"} as Record<string,string>)[name];

// Conductor identity is independent of power and switch state. Trace each pole
// through its possible contacts, never through loads, coils or sensor inputs.
// This display-only graph does not change the electrical simulation.
export function wirePhases(project:Project):Map<string,string>{
  const parent=new Map<string,string>();
  const root=(id:string):string=>{let p=parent.get(id);if(p===undefined){parent.set(id,id);return id;}if(p!==id){p=root(p);parent.set(id,p);}return p;};
  const join=(a:string,b:string)=>{const x=root(a),y=root(b);if(x!==y)parent.set(x,y);};
  for(const e of conductorLinks(project))join(e.a,e.b);
  const sources=new Map<string,Set<string>>(),hints=new Map<string,Set<string>>();
  const seed=(map:Map<string,Set<string>>,terminal:string,phase:string|undefined)=>{if(!phase)return;const id=root(terminal);if(!map.has(id))map.set(id,new Set());map.get(id)!.add(phase);};
  for(const n of project.nodes){
    if(kind(n)==="source")for(const p of ports(n))seed(sources,pin(n,p.name),phaseName(p.name));
    if(kind(n)==="transformer"){seed(sources,pin(n,"S1"),"R");seed(sources,pin(n,"S2"),"N");}
    if(kind(n)==="bus")seed(hints,pin(n,"A"),phaseName(String(n.params.net??"").trim().toUpperCase()));
  }
  for(const w of project.wires)if(phaseName(w.color))seed(hints,w.from,phaseName(w.color));
  const result=new Map<string,string>();
  for(const w of project.wires){
    const source=sources.get(root(w.from)),hint=hints.get(root(w.from)),identity=source?.size?source:hint;
    // Known supply wins over old cosmetic colors; conflicting supplies stay
    // unclassified so a wrong connection is not given a misleading phase.
    result.set(w.id,identity?.size===1?[...identity][0]:identity?.size?"auto":w.color==="signal"?"signal":"auto");
  }
  return result;
}

export type ConductorLink={a:string;b:string;wireId?:string;nodeId?:string};
/** All possible contact paths; load terminals remain electrically separate. */
export function conductorLinks(project:Project):ConductorLink[]{
  const edges:ConductorLink[]=[];
  for(const w of project.wires)edges.push({a:w.from,b:w.to,wireId:w.id});
  for(const n of project.nodes){
    const k=kind(n),valid=new Set(ports(n).map(p=>p.name));
    const link=(a:string,b:string)=>{if(valid.has(a)&&valid.has(b))edges.push({a:pin(n,a),b:pin(n,b),nodeId:n.id});};
    if(["breaker","fuse","rcd","contactor","overload"].includes(k))for(let i=0;i<poles(n);i++)link(String(i*2+1),String(i*2+2));
    if(["switch","start","stop","estop","limit","terminal"].includes(k))link("1","2");
    if(k==="no"||k==="nc")link(ports(n)[0].name,ports(n)[1].name);
    if(k==="junction")for(const p of ports(n).slice(1))link(ports(n)[0].name,p.name);
    if(k==="bus"&&String(n.params.net??"").trim())edges.push({a:pin(n,"A"),b:"@"+String(n.params.net).trim(),nodeId:n.id});
    if(k==="changeover"){link("11","12");link("11","14");}
    if(k==="pressure"){link("C","OK");link("C","FAULT");}
    if(k==="pfr"){link("Tc","Ta");link("Tc","Tb");}
    if(k==="controller"){const p=controllerPins(n);link(p.common,p.comp);link(p.common,p.fan);link(p.defCommon,p.defrost);link(p.defCommon,p.defNC);}
    if(k==="selector"){
      if(n.params.mapping)for(const entry of String(n.params.mapping).split(";"))for(const pair of (entry.split(":")[1]??"").split(",")){const [a,b]=pair.trim().split("-");link(a,b);}
      else for(const p of valid)if(p!=="C")link("C",p);
    }
  }
  return edges;
}

/** Physical wire nets only. Equal colours or a shared upstream supply do not bypass a contact. */
export function wireNets(project:Project):Map<string,string>{
  const parent=new Map<string,string>();
  const root=(x:string):string=>{const p=parent.get(x);if(!p){parent.set(x,x);return x;}if(p===x)return x;const r=root(p);parent.set(x,r);return r;};
  const join=(a:string,b:string)=>parent.set(root(a),root(b));
  for(const w of project.wires)join(w.from,w.to);
  for(const n of project.nodes){
    const ps=ports(n);
    if(["junction","terminal"].includes(kind(n)))for(const p of ps.slice(1))join(pin(n,ps[0].name),pin(n,p.name));
    if(kind(n)==="bus"&&String(n.params.net??"").trim())join(pin(n,"A"),"@"+String(n.params.net).trim());
  }
  return new Map(project.wires.map(w=>[w.id,root(w.from)]));
}
