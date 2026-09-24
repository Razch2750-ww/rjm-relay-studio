import { CATALOG, contactPairs, sourceTerminals, controllerPins, kind, number, pin, poles, ports, selectorPositions } from "../circuit.ts";
import type { Project } from "../circuit.ts";
import { coilKinds, freshState, switched, fault } from "./state.ts";
import type { Runtime, DeviceState } from "./state.ts";
export type Potential = {source:string;phase:string;voltage:number;three:boolean;port:string};
type Edge = {to:string;via:string};
export const phasor=(p:Potential)=>{const angle=({R:0,S:-2*Math.PI/3,T:2*Math.PI/3} as Record<string,number>)[p.phase]??0,m=["N","PE","-"].includes(p.phase)?0:p.three?p.voltage/Math.sqrt(3):p.voltage;return {re:m*Math.cos(angle),im:m*Math.sin(angle)};};
export function makeNetwork(p:Project,r:Runtime,states:Record<string,DeviceState>) {
  const parent=new Map<string,string>(), adj=new Map<string,Edge[]>(), sources=new Map<string,Potential>();
  const root=(x:string):string => { if(!parent.has(x)) parent.set(x,x); let v=x; while(parent.get(v)!==v) v=parent.get(v)!; while(x!==v){const next=parent.get(x)!;parent.set(x,v);x=next;} return v; };
  const join=(a:string,b:string,via:string) => {const ra=root(a),rb=root(b); if(ra!==rb)parent.set(ra,rb); adj.set(a,[...(adj.get(a)??[]),{to:b,via}]);adj.set(b,[...(adj.get(b)??[]),{to:a,via}]);};
  const driven:Record<string,boolean>={};
  for(const n of p.nodes) if(coilKinds.includes(kind(n))) driven[n.tag] ||= states[n.id]?.on ?? false;
  for(const n of p.nodes) if(kind(n)==="overload") driven[n.tag] ||= states[n.id]?.tripped ?? false;
  for(const n of p.nodes) if(kind(n)==="pfr") driven[n.tag] ||= states[n.id]?.on ?? false;
  for(const n of p.nodes) {
    ports(n).forEach(t=>root(pin(n,t.name)));
    const k=kind(n),d=CATALOG[n.type],s=states[n.id]??freshState(),on=switched(r,n);
    const link=(a:string,b:string)=>join(pin(n,a),pin(n,b),"n:"+n.id+":"+a);
    const powerPoles=()=>{for(let i=0;i<poles(n);i++)link(String(i*2+1),String(i*2+2));};
    if(k==="source" && on) {
      const missing=r.manual[n.id+":phase"];
      const names=sourceTerminals(n);
      for(const name of names) {
        const phase:Record<string,string>={L1:"R",L2:"S",L3:"T",L:"R",N:"N",PE:"PE","+":"+","-":"-"};
        if(missing===phase[name]||fault(r,n.id,"phase-loss")&&phase[name]==="R"||fault(r,n.id,"neutral-lost")&&phase[name]==="N")continue;
        const actual=fault(r,n.id,"phase-reversal")?(phase[name]==="S"?"T":phase[name]==="T"?"S":phase[name]):phase[name];
        const multiplier=(fault(r,n.id,"undervoltage")?.8:1)*(fault(r,n.id,"overvoltage")?1.2:1)*(fault(r,n.id,"imbalance")&&actual==="S"?.85:1);
        const port=pin(n,name);sources.set(port,{source:n.id,phase:actual,voltage:(r.values[n.id+":voltage"]??number(n,"voltage",230))*multiplier,three:poles(n)===3,port});
      }
    }
    if(["breaker","fuse","rcd"].includes(k) && on && !s.tripped)powerPoles();
    if(k==="contactor" && ((d.contact==="NC"?!driven[n.tag]:driven[n.tag])||fault(r,n.id,"welded")))powerPoles();
    if(k==="isolator"&&on)powerPoles();
    if(d.contact&&["switch","start","auxiliary","timedContact"].includes(k)){const active=k==="switch"?on:k==="start"?!!r.manual[n.id]:k==="timedContact"?s.on:!!driven[n.tag];for(const [a,b]of contactPairs(n,active))link(a,b);}
    if(k==="overload")powerPoles();
    if(k==="switch" && !d.contact && on)link("1","2");
    if(k==="start" && !d.contact && !!r.manual[n.id])link("1","2");
    if(["stop","estop"].includes(k) && !r.manual[n.id]&&!fault(r,n.id,"pressed"))link("1","2");
    if(k==="no" && driven[n.tag])link(ports(n)[0].name,ports(n)[1].name);
    if(k==="nc" && !driven[n.tag])link(ports(n)[0].name,ports(n)[1].name);
    if(k==="changeover")link("11",driven[n.tag]?"14":"12");
    if(k==="terminal")link("1","2");
    if(k==="junction")for(const port of ports(n).slice(1))link(ports(n)[0].name,port.name);
    if(k==="bus" && String(n.params.net??"").trim())join(pin(n,"A"),"@"+String(n.params.net).trim(),"bus");
    if(k==="selector"){
      const mode=String(r.manual[n.id]??n.params.position);
      if(n.params.mapping){const terminals=new Set(ports(n).map(t=>t.name));for(const entry of String(n.params.mapping).split(";")){const [position,pairs]=entry.split(":");if(position?.trim()===mode)for(const pair of (pairs??"").split(",")){const [a,b]=pair.trim().split("-");if(terminals.has(a)&&terminals.has(b)&&a!==b)link(a,b);}}}
      else if(mode!=="OFF"&&selectorPositions(n).includes(mode))link("C",mode);
    }
    if(k==="pressure")link("C",(n.params.pressureType?s.on:on&&!fault(r,n.id,"pressure"))?"OK":"FAULT");
    if(k==="transformer"&&s.on){for(const [name,phase] of [["S1","R"],["S2","N"]]){const port=pin(n,name);sources.set(port,{source:n.id,phase,voltage:number(n,"secondary",230),three:false,port});}}
    if(k==="converter"&&s.on){for(const name of ["+","-"]){const port=pin(n,name);sources.set(port,{source:n.id,phase:name,voltage:number(n,"secondary",24),three:false,port});}}
    if(k==="pfr")link("Tc",s.on?"Ta":"Tb");
    if(k==="controller"){
      const cp=controllerPins(n);
      if(s.cool)link(cp.common,cp.comp);
      if(s.fan)link(cp.common,cp.fan);
      link(cp.defCommon,s.defrost?cp.defrost:cp.defNC);
    }
  }
  for(const w of p.wires)if(!fault(r,w.id,"open"))join(w.from,w.to,"w:"+w.id);
  // Resolve ideal DC diodes from externally supplied nets, then propagate through
  // series diodes. AC half-wave transients are deliberately outside this model.
  const diodes=p.nodes.filter(n=>kind(n)==="diode"),connected=new Set<string>();
  for(let pass=0;pass<diodes.length;pass++){
    let changed=false;
    for(const n of diodes){if(connected.has(n.id))continue;
      const at=(name:string)=>[...sources].filter(([port])=>root(port)===root(pin(n,name))).map(([,v])=>v);
      const a=at("A"),b=at("K"),known=[...a,...b];
      if(known.length&&known.every(v=>["+","-"].includes(v.phase))&&!a.some(v=>v.phase==="-")&&!b.some(v=>v.phase==="+")&&(a.some(v=>v.phase==="+")||b.some(v=>v.phase==="-"))){join(pin(n,"A"),pin(n,"K"),"n:"+n.id+":A");connected.add(n.id);changed=true;}
    }
    if(!changed)break;
  }
  const potentials=new Map<string,Potential[]>();
  for(const [port,value]of sources){const rt=root(port);potentials.set(rt,[...(potentials.get(rt)??[]),value]);}
  const potential=(port:string)=>potentials.get(root(port))??[];
  const unique=(port:string)=>potential(port).length===1?potential(port)[0]:undefined;
  const voltage=(a:string,b:string)=>{
    const x=unique(a),y=unique(b);if(!x||!y||x.source!==y.source||x.phase===y.phase||x.phase==="PE"||y.phase==="PE")return 0;
    if(["+","-"].includes(x.phase)||["+","-"].includes(y.phase)) return [x.phase,y.phase].includes("+")&&[x.phase,y.phase].includes("-")?x.voltage:0;
    const adjusted=(id:string,p:Potential)=>{const v=phasor(p),old=r.nodeVoltage[id],source=r.nodeVoltage[p.port];if(old&&source&&old.source===p.source&&old.net===root(id))return {re:v.re-(source.re-old.re),im:v.im-(source.im-old.im)};return v;};
    const a1=adjusted(a,x),b1=adjusted(b,y);return Math.hypot(a1.re-b1.re,a1.im-b1.im);
  };
  const three=(pins:string[])=>{
    const ps=pins.map(unique);
    return ps.every(x=>x && ["R","S","T"].includes(x.phase)) && new Set(ps.map(x=>x?.phase)).size===3 && new Set(ps.map(x=>x?.source)).size===1 ? Math.min(voltage(pins[0],pins[1]),voltage(pins[1],pins[2]),voltage(pins[2],pins[0])) : 0;
  };
  const path=(start:string,target?:string)=>{
    const queue=[start], seen=new Map<string,{prev:string;via:string}>();seen.set(start,{prev:"",via:""});
    let found="";
    for(let i=0;i<queue.length;i++){const current=queue[i];if(target?current===target:sources.has(current)){found=current;break;}for(const edge of adj.get(current)??[])if(!seen.has(edge.to)){seen.set(edge.to,{prev:current,via:edge.via});queue.push(edge.to);}}
    const result:string[]=[];while(found&&found!==start){const x=seen.get(found)!;result.push(x.via);found=x.prev;}return result;
  };
  return {root,unique,potential,voltage,three,path,potentials,driven,sources,adj};
}
