import { CATALOG, controllerPins, kind, number, pin, poles, ports, selectorPositions } from "./circuit.ts";
import type { Node, Project } from "./circuit.ts";

import { makeNetwork,phasor } from "./engine/network.ts";
import { coilKinds,loadKinds,freshState,setting,switched,fault,logEvent,stateOf } from "./engine/state.ts";
import type { Runtime,DeviceState } from "./engine/state.ts";
export { freshRuntime,stateOf } from "./engine/state.ts";
export type { Runtime,DeviceState } from "./engine/state.ts";
import { motorWinding } from "./engine/motor-windings.ts";
import { loadCurrent } from "./engine/load.ts";
import { protectionStep,protectionRating } from "./engine/protection.ts";
import { cableStep,resistance } from "./engine/cable.ts";
import { roomStep } from "./engine/room.ts";
import { controllerState,pressureState,timerScheduled } from "./engine/control.ts";
import { shortCurrents } from "./engine/short-circuit.ts";
import { currentNetwork } from "./engine/current-network.ts";

export function stepCircuit(project:Project,previous:Runtime,dt=0,tripPass=0):Runtime {
  dt=Math.max(0,Math.min(dt,3600));
  const r:Runtime={...previous,now:previous.now+dt,devices:structuredClone(previous.devices),requests:{...previous.requests},values:{...previous.values},room:{...previous.room},injected:{...previous.injected},maxWire:{...previous.maxWire},cables:{...previous.cables},phaseCurrent:{R:0,S:0,T:0,N:0},nodeVoltage:{...previous.nodeVoltage},branchProtection:{},kva:0,pf:1,faults:[],warnings:[],energized:{},wireCurrent:{},halted:false,watts:0,log:[...previous.log]};
  roomStep(project,r,dt);
  const old:Record<string,DeviceState>={};for(const n of project.nodes)old[n.id]={...(previous.devices[n.id]??freshState())};
  let states={...old},net=makeNetwork(project,r,states),stable=false;
  const signature=(s:Record<string,DeviceState>)=>JSON.stringify(Object.values(s).map(x=>[x.on,x.cool,x.fan,x.defrost,x.tripped]));
  const duplicateCoils=new Set<string>();
  for(const n of project.nodes)if(coilKinds.includes(kind(n))){if(duplicateCoils.has(n.tag))r.faults.push("Lebih dari satu coil memakai tag "+n.tag+".");duplicateCoils.add(n.tag);}
  // ponytail: fixed-point ideal-contact model, bounded to 40 passes; an analog solver is required for physical transients.
  for(let iteration=0;iteration<40;iteration++){
    net=makeNetwork(project,r,states);
    const next:Record<string,DeviceState>={};
    for(const n of project.nodes){
      const k=kind(n),base=old[n.id],s={...base,current:0},a=pin(n,"A1"),b=pin(n,"A2");
      if(coilKinds.includes(k)){
        const v=net.voltage(a,b),rated=number(n,"voltage",230),source=project.nodes.find(x=>x.id===net.unique(a)?.source),hz=source?setting(r,source,"frequency",50):0,coilHz=number(n,"frequency",0);
        const input=v>=rated*.85&&v<=rated*1.15&&(!coilHz||Math.abs(hz-coilHz)<=coilHz*.1)&&!fault(r,n.id,"coil-open");
        s.input=input;s.voltage=v;s.elapsed=input?(base.input?base.elapsed+dt:0):0;
        if(base.input&&!input)s.offAt=r.now;
        if(k==="coil")s.on=input;
        if(k==="ton")s.on=input&&s.elapsed>=Math.max(0,number(n,"delay",5));
        if(k==="interval")s.on=input&&s.elapsed<Math.max(0,number(n,"delay",5));
        if(k==="schedule")s.on=input&&timerScheduled(n,r);
        if(k==="tonoff")s.on=input?base.on||s.elapsed>=Math.max(0,number(n,"delay",5)):base.on&&r.now-s.offAt<Math.max(0,number(n,"offDelay",5));
        if(k==="toff")s.on=input||(base.on&&r.now-s.offAt<Math.max(0,number(n,"delay",5)));
        if(k==="impulse")s.on=input&&!base.input?!base.on:base.on;
        if(k==="cyclic"){
          const off=Math.max(.1,number(n,"offDuration",60)),on=Math.max(.1,number(n,"onDuration",60));
          s.on=input&&s.elapsed%(off+on)>=off;
          s.stage=input?(s.on?"NO":"NC"):"off";
        }
      }else if(k==="timedContact"){
        const active=!!net.driven[n.tag];s.input=active;s.elapsed=active?(base.input?base.elapsed+dt:0):0;
        if(base.input&&!active)s.offAt=r.now;
        s.on=CATALOG[n.type].timing==="on"?active&&s.elapsed>=number(n,"delay",5):active||(base.on&&r.now-s.offAt<number(n,"delay",5));
      }else if(k==="auxiliary")s.on=!!net.driven[n.tag];
      else if(k==="diode")s.on=net.root(pin(n,"A"))===net.root(pin(n,"K"));
      else if(k==="spd"){s.voltage=net.three(["L1","L2","L3"].map(t=>pin(n,t)));s.on=s.voltage>0;}
      else if(k==="pfr"){
        s.voltage=net.three(["L1","L2","L3"].map(x=>pin(n,x)));
        const sequence=["L1","L2","L3"].map(x=>net.unique(pin(n,x))?.phase??"?").join("");
        const ordered=n.params.expected==="any"||!n.params.expected||sequence===n.params.expected;
        const voltages=["L1","L2","L3"].map(t=>net.unique(pin(n,t))?.voltage??0),avg=voltages.reduce((a,b)=>a+b,0)/3,imbalance=avg>0?Math.max(...voltages.map(v=>Math.abs(v-avg)))/avg*100:100;
        const healthy=s.voltage>=number(n,"minVoltage",320)&&Math.max(...voltages)<=number(n,"maxVoltage",460)&&imbalance<=number(n,"imbalance",10)&&ordered&&!r.manual[n.id+":fault"]&&!fault(r,n.id,"failed");
        s.elapsed=healthy?(base.input?base.elapsed+dt:dt):0;s.input=healthy;s.on=healthy&&s.elapsed>=number(n,"delay",0);
        s.stage=!healthy?"supply-fault":s.on?"healthy":"delay";
      }else if(k==="controller"){next[n.id]=controllerState(project,r,n,base,net,dt);continue;}
      else if(k==="overload")s.on=!s.tripped;
      else if(loadKinds.includes(k)){
        const pair=k==="motor"||k==="heater"?(poles(n)===0?["+","-"]:["L","N"]):["X1","X2"];
        const winding=CATALOG[n.type].winding?motorWinding(n,net):null;
        const v=winding?winding.voltage:poles(n)===3?net.three(["U","V","W"].map(x=>pin(n,x))):net.voltage(pin(n,pair[0]),pin(n,pair[1]));
        const neutralOK=!n.params.neutralRequired||(net.unique(pin(n,"N"))?.phase==="N"&&net.unique(pin(n,"N"))?.source===net.unique(pin(n,"U"))?.source);
        s.voltage=v;s.on=neutralOK&&v>=number(n,"voltage",230)*.3&&!fault(r,n.id,"coil-open");
        s.elapsed=s.on?(base.on?base.elapsed+dt:0):0;if(winding)s.stage=winding.stage;
      }else if(k==="contactor"||k==="no"||k==="changeover")s.on=(k==="contactor"&&CATALOG[n.type].contact==="NC"?!net.driven[n.tag]:!!net.driven[n.tag])||(k==="contactor"&&fault(r,n.id,"welded"));
      else if(k==="nc")s.on=!net.driven[n.tag];
      else if(["breaker","fuse","rcd","switch","source","isolator"].includes(k))s.on=switched(r,n)&&!s.tripped;
      else if(["stop","estop"].includes(k))s.on=!r.manual[n.id]&&!fault(r,n.id,"pressed");
      else if(k==="start")s.on=!!r.manual[n.id];
      else if(k==="pressure"){next[n.id]=pressureState(n,r,base);continue;}
      else if(k==="converter"){s.voltage=poles(n)===3?net.three(["L1","L2","L3"].map(t=>pin(n,t))):net.voltage(pin(n,"L"),pin(n,"N"));s.on=s.voltage>=number(n,"voltage",230)*.85&&s.voltage<=number(n,"voltage",230)*1.15;}
      else if(k==="transformer"){s.voltage=net.voltage(pin(n,"P1"),pin(n,"P2"));s.on=s.voltage>=number(n,"voltage",400)*.85&&s.voltage<=number(n,"voltage",400)*1.15;}
      else if(k==="meter"){s.voltage=net.voltage(pin(n,"V1"),pin(n,"V2"));s.on=s.voltage>0;s.current=previous.wireCurrent[String(n.params.wire)]??0;}
      else if(k==="selector")s.on=(r.manual[n.id]??n.params.position)!=="OFF";
      next[n.id]=s;
    }
    stable=signature(next)===signature(states);states=next;if(stable)break;
  }
  if(!stable&&!r.faults.length)r.faults.push("Logika berosilasi atau belum stabil. Periksa kontak NC, coil, dan interlock.");
  r.devices=states;
  if(r.faults.length){r.halted=true;for(const n of project.nodes)if(loadKinds.includes(kind(n))||coilKinds.includes(kind(n)))r.devices[n.id]={...(states[n.id]??freshState()),on:false};r.requests={};return r;}
  net=makeNetwork(project,r,states);
  for(const n of project.nodes)for(const port of ports(n)){const potential=net.unique(pin(n,port.name));if(potential){r.energized[pin(n,port.name)]=potential.phase;r.nodeVoltage[pin(n,port.name)]={...phasor(potential),net:net.root(pin(n,port.name)),source:potential.source};}}
  const demand=new Map<string,{re:number;im:number}>(),sourceComplex=new Map<string,{re:number;im:number}>();
  const consume=(port:string,amps:number,pf=1,angleOverride?:number,sign=1)=>{
    const pot=net.unique(port),phase=pot?.phase??"R",angle=angleOverride??(({R:0,S:-2*Math.PI/3,T:2*Math.PI/3} as Record<string,number>)[phase]??0);
    const value={re:sign*amps*Math.cos(angle-Math.acos(pf)),im:sign*amps*Math.sin(angle-Math.acos(pf))},old=demand.get(port)??{re:0,im:0};
    demand.set(port,{re:old.re+value.re,im:old.im+value.im});
    if(pot){const key=pot.source+":"+pot.phase,prev=sourceComplex.get(key)??{re:0,im:0};sourceComplex.set(key,{re:prev.re+value.re,im:prev.im+value.im});}
  };
  const consumePair=(a:string,b:string,amps:number,pf=1)=>{const pa=net.unique(a),pb=net.unique(b);if(!pa||!pb)return;const va=phasor(pa),vb=phasor(pb),angle=Math.atan2(va.im-vb.im,va.re-vb.re);consume(a,amps,pf,angle);consume(b,amps,pf,angle,-1);};
  for(const n of project.nodes){
    const k=kind(n),s=states[n.id];if(!s.on&&!(coilKinds.includes(k)&&s.input))continue;
    if(loadKinds.includes(k)){
      const winding=CATALOG[n.type].winding?motorWinding(n,net):null;
      const ps=winding?winding.pins:poles(n)===3?["U","V","W"]:k==="motor"||k==="heater"?(poles(n)===0?["+","-"]:["L","N"]):["X1","X2"];
      const paths=ps.flatMap(t=>net.path(pin(n,t))),cableOverload=paths.some(e=>e.startsWith("w:")&&fault(r,e.slice(2),"overload"));
      const {amps,watts,pf,starting,estimated}=loadCurrent(n,s,r,cableOverload);
      s.current=amps;if(!winding)s.stage=starting?"starting":"running";s.peak=Math.max(previous.devices[n.id]?.peak??0,amps);r.watts+=watts;r.kva+=watts/Math.max(.01,pf)/1000;
      if(winding?.stage==="delta")for(const lead of ["U","V","W"])consumePair(pin(n,lead+"1"),pin(n,lead+"2"),amps/Math.sqrt(3),pf);
      else if(winding?.stage==="star")ps.forEach((t,i)=>{const port=pin(n,t),v=phasor(net.unique(port)!);consume(port,amps,pf);consume(pin(n,["U2","V2","W2"][i]),amps,pf,Math.atan2(v.im,v.re),-1);});
      else if(poles(n)===3)ps.forEach(t=>consume(pin(n,t),amps,pf));else consumePair(pin(n,ps[0]),pin(n,ps[1]),amps,pf);
      const protectionIds=[...new Set(paths.filter(e=>e.startsWith("n:")).map(e=>e.split(":")[1]).filter(id=>["breaker","fuse","overload","contactor"].includes(kind(project.nodes.find(x=>x.id===id)!))))];
      r.branchProtection[n.id]=protectionIds;
      if(estimated)r.warnings.push(n.tag+": arus estimasi HP/PK daya poros; nameplate diprioritaskan bila diisi.");
      if(s.voltage<number(n,"voltage",230)*.85||s.voltage>number(n,"voltage",230)*1.15)r.warnings.push(n.tag+": tegangan beban di luar ±15% nominal.");
      if(starting&&!old[n.id].on)logEvent(r,n.tag+" starting "+amps.toFixed(1)+" A","Power",n.id);
      if(!starting&&old[n.id].stage==="starting")logEvent(r,n.tag+" running "+amps.toFixed(1)+" A","Power",n.id);
      if(["motor","heater"].includes(k)&&amps===0)r.warnings.push(n.tag+": arus/daya belum diisi; trip beban belum dapat diuji.");
      if(["motor","heater"].includes(k)&&net.unique(pin(n,"PE"))?.phase!=="PE")r.warnings.push(n.tag+": PE belum terhubung.");
    }else if(coilKinds.includes(k)&&s.input){const va=Math.max(0,number(n,"va",3)),amps=va/Math.max(1,s.voltage);consumePair(pin(n,"A1"),pin(n,"A2"),amps);s.current=amps;r.watts+=va;r.kva+=va/1000;}
    else if(k==="controller"){const cp=controllerPins(n);s.current=3/Math.max(1,s.voltage);consumePair(pin(n,cp.line),pin(n,cp.neutral),s.current);r.watts+=3;r.kva+=.003;}
  }
  for(const n of project.nodes.filter(n=>["transformer","converter"].includes(kind(n))&&states[n.id].on)){
    const converter=kind(n)==="converter",secondary=sourceComplex.get(n.id+(converter?":+":":R")),amps=secondary?Math.hypot(secondary.re,secondary.im)*number(n,"secondary",230)/Math.max(1,states[n.id].voltage):0;
    if(converter&&poles(n)===3)["L1","L2","L3"].forEach(t=>consume(pin(n,t),amps/Math.sqrt(3)));else consumePair(pin(n,converter?"L":"P1"),pin(n,converter?"N":"P2"),amps);states[n.id].current=converter&&poles(n)===3?amps/Math.sqrt(3):amps;
    if(amps*states[n.id].voltage>number(n,"va",100))r.warnings.push(n.tag+": beban output melebihi rating VA yang diisi.");
  }
  const shorts=shortCurrents(project,r,net);r.faults.push(...shorts.errors);r.warnings.push(...shorts.events);
  for(const text of shorts.events)if(!previous.warnings.includes(text))logEvent(r,text,"Fault");
  const solved=currentNetwork(project,r,net,demand),edgeCurrent=solved.edgeCurrent;r.nodeVoltage=solved.nodeVoltage;
  for(const [id,current]of shorts.edgeCurrent)edgeCurrent.set(id,Math.max(edgeCurrent.get(id)??0,current));
  for(const [id,v]of solved.sourceCurrent){const pot=net.sources.get(id),source=project.nodes.find(n=>n.id===pot?.source);if(source&&kind(source)==="source")r.phaseCurrent[pot!.phase]=(r.phaseCurrent[pot!.phase]??0)+Math.hypot(v.re,v.im);}
  r.pf=r.kva>0?Math.min(1,r.watts/(r.kva*1000)):1;r.peak=Math.max(previous.peak,...Object.values(r.phaseCurrent),...edgeCurrent.values());
  for(const [edge,amps]of edgeCurrent){
    if(edge.startsWith("w:"))r.wireCurrent[edge.slice(2)]=amps;
    if(edge.startsWith("n:")){const id=edge.split(":")[1];if(states[id])states[id].current=Math.max(states[id].current,amps);}
  }
  let newTrip=false;
  for(const n of project.nodes){
    const k=kind(n),s=states[n.id];
    if(["overload","breaker","fuse"].includes(k)&&number(n,"rating")<=0)r.warnings.push(n.tag+": rating belum diisi; trip arus lebih belum dihitung.");
    if(["overload","breaker","fuse","rcd"].includes(k))newTrip=protectionStep(n,old[n.id],s,r,dt)||newTrip;
    if(CATALOG[n.type].winding&&["speed-conflict","wiring-open"].includes(s.stage))r.warnings.push(n.tag+": "+(s.stage==="speed-conflict"?"kedua kecepatan mendapat suplai sekaligus; motor dihentikan.":"sambungan kumparan belum lengkap atau tidak sesuai mode."));
    if(k==="controller"&&number(n,"rating")>0&&s.current>number(n,"rating"))r.warnings.push(n.tag+": arus kontak relay melebihi rating yang diisi.");
    if(k==="controller"&&s.stage==="sensor-fault")r.warnings.push(n.tag+": sensor terputus, tersambung salah, atau mendapat tegangan daya.");
    if(coilKinds.includes(k)&&s.voltage>0&&!s.input)r.warnings.push(n.tag+": coil tidak menarik; periksa "+s.voltage.toFixed(0)+" V, frekuensi, dan fault winding.");
    if(s.on!==old[n.id].on||s.tripped!==old[n.id].tripped)logEvent(r,n.tag+" "+(s.tripped?"TRIP":s.on?"ON":"OFF"),["breaker","overload","fuse","pfr"].includes(k)?"Protection":k==="controller"?"Controller":loadKinds.includes(k)?"Power":"Control",n.id);
    if(k==="controller"&&s.stage!==old[n.id].stage)logEvent(r,n.tag+" "+s.stage,"Controller",n.id);
  }
  for(const w of project.wires){
    const s=cableStep(w,previous.cables[w.id],r.wireCurrent[w.id]??0,dt,fault(r,w.id,"loose"),fault(r,w.id,"derating"));
    s.protection=[...new Set(net.path(w.to).filter(e=>e.startsWith("n:")).map(e=>e.split(":")[1]).filter(id=>["breaker","fuse"].includes(kind(project.nodes.find(n=>n.id===id)!))))];
    r.cables[w.id]=s;r.maxWire[w.id]=Math.max(previous.maxWire[w.id]??0,s.current);
    if(s.capacity!==null&&s.current>s.capacity)r.warnings.push("Kabel "+(w.label||w.id)+": "+s.current.toFixed(1)+" A / kapasitas "+s.capacity.toFixed(1)+" A. Kabel memanas; trip ditentukan proteksi.");
    if(s.capacity!==null&&s.current>0&&s.protection.length&&!s.protection.some(id=>protectionRating(project.nodes.find(n=>n.id===id)!)<=s.capacity!))r.warnings.push("CRITICAL: proteksi upstream kabel "+(w.label||w.id)+" melebihi kapasitas "+s.capacity.toFixed(1)+" A.");
  }
  r.requests={};r.log=r.log.slice(-1000);
  if(newTrip&&tripPass<10&&!r.faults.length)return stepCircuit(project,r,0,tripPass+1);
  if(r.faults.length){r.halted=true;for(const n of project.nodes)if(loadKinds.includes(kind(n))||coilKinds.includes(kind(n)))r.devices[n.id].on=false;}
  return r;
}

export function interact(project:Project,r:Runtime,id:string,pressed?:boolean):Runtime {
  const n=project.nodes.find(n=>n.id===id);if(!n)return r;
  const next={...r,manual:{...r.manual},devices:structuredClone(r.devices),requests:{...r.requests},log:[...r.log]},k=kind(n);
  if(["start","stop"].includes(k))next.manual[id]=!!pressed;
  else if(["overload","breaker","fuse","rcd"].includes(k)&&stateOf(r,n).tripped){
    if(k==="overload"&&stateOf(r,n).heat>.2){logEvent(next,n.tag+": tunggu overload mendingin ke ≤20% sebelum reset","Protection",id);return next;}
    if(fault(r,id,"trip")){logEvent(next,n.tag+": lepaskan fault trip sebelum reset","Protection",id);return next;}
    next.devices[id]={...stateOf(r,n),tripped:false,current:0};
  }
  else if(k==="overload")next.devices[id]={...stateOf(r,n),tripped:true};
  else if(k==="estop")next.manual[id]=!r.manual[id];
  else if(k==="pressure"&&n.params.pressureType)next.requests[id]=true;
  else if(["switch","source","breaker","fuse","rcd","pressure","isolator"].includes(k))next.manual[id]=!switched(r,n);
  else if(k==="selector"){const positions=selectorPositions(n),value=String(r.manual[id]??n.params.position);next.manual[id]=positions[(positions.indexOf(value)+1)%positions.length];}
  else if(k==="pfr")next.manual[id+":fault"]=!r.manual[id+":fault"];
  else if(k==="controller")next.requests[id]=true;
  logEvent(next,n.tag+" dioperasikan","User action",id);
  return stepCircuit(project,next,0);
}
export function injectFault(p:Project,r:Runtime,id:string,name:string,on:boolean){
 const next={...r,injected:{...r.injected,[id+":"+name]:on},log:[...r.log]};
 logEvent(next,(p.nodes.find(n=>n.id===id)?.tag??p.wires.find(w=>w.id===id)?.label??id)+" · "+name+" "+(on?"FAULT":"PULIH"),"Fault",id);
 return stepCircuit(p,next,0);
}
export function advanceCircuit(p:Project,r:Runtime,seconds:number){
 let next=r,remaining=Math.max(0,Math.min(3600,seconds));
 while(remaining>1e-8&&!next.halted){const dt=Math.min(.1,remaining);next=stepCircuit(p,next,dt);remaining-=dt;}
 return next;
}
