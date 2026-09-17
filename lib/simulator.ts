import { controllerPins, kind, number, pin, poles, ports, selectorPositions } from "./circuit.ts";
import type { Node, Project } from "./circuit.ts";

export type DeviceState = { on:boolean; input:boolean; tripped:boolean; elapsed:number; offAt:number; heat:number; stage:string; stageTime:number; cycleTime:number; cool:boolean; fan:boolean; defrost:boolean; current:number; voltage:number; temperature?:number };
export type Runtime = { now:number; devices:Record<string,DeviceState>; manual:Record<string,boolean|string>; values:Record<string,number>; requests:Record<string,boolean>; energized:Record<string,string>; wireCurrent:Record<string,number>; faults:string[]; warnings:string[]; log:{time:number;text:string}[]; halted:boolean; watts:number };
type Potential = {source:string; phase:string; voltage:number; three:boolean; port:string};
type Edge = {to:string; via:string};
const coilKinds = ["coil","ton","toff","impulse","cyclic"];
const loadKinds = ["motor","heater","lamp","buzzer","valve"];
const freshState = ():DeviceState => ({on:false,input:false,tripped:false,elapsed:0,offAt:0,heat:0,stage:"cooling",stageTime:0,cycleTime:0,cool:false,fan:false,defrost:false,current:0,voltage:0});
export const freshRuntime = ():Runtime => ({now:0,devices:{},manual:{},values:{},requests:{},energized:{},wireCurrent:{},faults:[],warnings:[],log:[],halted:false,watts:0});
export const stateOf = (r:Runtime,n:Node) => r.devices[n.id] ?? freshState();
const setting = (r:Runtime,n:Node,k:string,fallback=0) => r.values[n.id+":"+k] ?? number(n,k,fallback);
const switched = (r:Runtime,n:Node) => typeof r.manual[n.id]==="boolean" ? r.manual[n.id] as boolean : !!n.params.on;

function makeNetwork(p:Project,r:Runtime,states:Record<string,DeviceState>) {
  const parent=new Map<string,string>(), adj=new Map<string,Edge[]>(), sources=new Map<string,Potential>();
  const root=(x:string):string => { if(!parent.has(x)) parent.set(x,x); let v=x; while(parent.get(v)!==v) v=parent.get(v)!; while(x!==v){const next=parent.get(x)!;parent.set(x,v);x=next;} return v; };
  const join=(a:string,b:string,via:string) => {const ra=root(a),rb=root(b); if(ra!==rb)parent.set(ra,rb); adj.set(a,[...(adj.get(a)??[]),{to:b,via}]);adj.set(b,[...(adj.get(b)??[]),{to:a,via}]);};
  const driven:Record<string,boolean>={};
  for(const n of p.nodes) if(coilKinds.includes(kind(n))) driven[n.tag] ||= states[n.id]?.on ?? false;
  for(const n of p.nodes) if(kind(n)==="overload") driven[n.tag] ||= states[n.id]?.tripped ?? false;
  for(const n of p.nodes) if(kind(n)==="pfr") driven[n.tag] ||= states[n.id]?.on ?? false;
  for(const n of p.nodes) {
    ports(n).forEach(t=>root(pin(n,t.name)));
    const k=kind(n),s=states[n.id]??freshState(),on=switched(r,n);
    const link=(a:string,b:string)=>join(pin(n,a),pin(n,b),"n:"+n.id+":"+a);
    const powerPoles=()=>{for(let i=0;i<poles(n);i++)link(String(i*2+1),String(i*2+2));};
    if(k==="source" && on) {
      const missing=r.manual[n.id+":phase"];
      const names=poles(n)===3?["L1","L2","L3","N","PE"]:poles(n)===0?["+","-"]:["L","N","PE"];
      for(const name of names) {
        const phase:Record<string,string>={L1:"R",L2:"S",L3:"T",L:"R",N:"N",PE:"PE","+":"+","-":"-"};
        if(missing===phase[name])continue;
        const port=pin(n,name);sources.set(port,{source:n.id,phase:phase[name],voltage:number(n,"voltage",230),three:poles(n)===3,port});
      }
    }
    if(["breaker","fuse","rcd"].includes(k) && on && !s.tripped)powerPoles();
    if(k==="contactor" && driven[n.tag])powerPoles();
    if(k==="overload"){ powerPoles();link(s.tripped?"97":"95",s.tripped?"98":"96"); }
    if(k==="switch" && on)link("1","2");
    if(k==="start" && !!r.manual[n.id])link("1","2");
    if(["stop","estop"].includes(k) && !r.manual[n.id])link("1","2");
    if(k==="no" && driven[n.tag])link("1","2");
    if(k==="nc" && !driven[n.tag])link("1","2");
    if(k==="changeover")link("11",driven[n.tag]?"14":"12");
    if(k==="terminal")link("1","2");
    if(k==="junction"){link("T","B");link("T","L");link("T","R");}
    if(k==="bus" && String(n.params.net??"").trim())join(pin(n,"A"),"@"+String(n.params.net).trim(),"bus");
    if(k==="selector"){const mode=String(r.manual[n.id]??n.params.position);if(mode!=="OFF"&&selectorPositions(n).includes(mode))link("C",mode);}
    if(k==="pressure")link("C",on?"OK":"FAULT");
    if(k==="pfr")link("Tc",s.on?"Ta":"Tb");
    if(k==="controller"){
      const cp=controllerPins(n);
      if(s.cool)link(cp.common,cp.comp);
      if(s.fan)link(cp.common,cp.fan);
      link(cp.defCommon,s.defrost?cp.defrost:cp.defNC);
    }
  }
  for(const w of p.wires)join(w.from,w.to,"w:"+w.id);
  const potentials=new Map<string,Potential[]>();
  for(const [port,value]of sources){const rt=root(port);potentials.set(rt,[...(potentials.get(rt)??[]),value]);}
  const potential=(port:string)=>potentials.get(root(port))??[];
  const unique=(port:string)=>potential(port).length===1?potential(port)[0]:undefined;
  const voltage=(a:string,b:string)=>{
    const x=unique(a),y=unique(b);if(!x||!y||x.source!==y.source||x.phase===y.phase||x.phase==="PE"||y.phase==="PE")return 0;
    if(["+","-"].includes(x.phase)||["+","-"].includes(y.phase)) return [x.phase,y.phase].includes("+")&&[x.phase,y.phase].includes("-")?x.voltage:0;
    return x.phase==="N"||y.phase==="N"?(x.three?x.voltage/Math.sqrt(3):x.voltage):x.voltage;
  };
  const three=(pins:string[])=>{
    const ps=pins.map(unique);
    return ps.every(x=>x && ["R","S","T"].includes(x.phase)) && new Set(ps.map(x=>x?.phase)).size===3 && new Set(ps.map(x=>x?.source)).size===1 ? ps[0]!.voltage : 0;
  };
  const path=(start:string)=>{
    const queue=[start], seen=new Map<string,{prev:string;via:string}>();seen.set(start,{prev:"",via:""});
    let found="";
    for(let i=0;i<queue.length;i++){const current=queue[i];if(sources.has(current)){found=current;break;}for(const edge of adj.get(current)??[])if(!seen.has(edge.to)){seen.set(edge.to,{prev:current,via:edge.via});queue.push(edge.to);}}
    const result:string[]=[];while(found&&found!==start){const x=seen.get(found)!;result.push(x.via);found=x.prev;}return result;
  };
  return {root,unique,potential,voltage,three,path,potentials,driven};
}

function sensed(p:Project,r:Runtime,n:Node,a:string,b:string,net:ReturnType<typeof makeNetwork>):number|undefined {
  const ra=net.root(pin(n,a)),rb=net.root(pin(n,b));
  if(ra===rb||net.potential(pin(n,a)).length||net.potential(pin(n,b)).length)return undefined;
  const probe=p.nodes.find(x=>kind(x)==="probe"&&((net.root(pin(x,"1"))===ra&&net.root(pin(x,"2"))===rb)||(net.root(pin(x,"2"))===ra&&net.root(pin(x,"1"))===rb)));
  if(!probe||r.manual[probe.id+":fault"])return undefined;
  return setting(r,probe,"value",8);
}

function controllerState(p:Project,r:Runtime,n:Node,old:DeviceState,net:ReturnType<typeof makeNetwork>,dt:number):DeviceState {
  const cp=controllerPins(n),s={...old,current:0},v=net.voltage(pin(n,cp.line),pin(n,cp.neutral)),nominal=number(n,"voltage",230);
  const room=sensed(p,r,n,cp.sensorCommon,cp.room,net),evap=sensed(p,r,n,cp.evap,cp.sensorCommon,net);
  s.voltage=v;s.on=v>=nominal*0.85&&v<=nominal*1.15;s.temperature=room;
  if(!s.on||room===undefined||evap===undefined)return {...s,cool:false,fan:false,defrost:false,stage:s.on?"sensor-fault":"off",stageTime:0,cycleTime:0,offAt:r.now};
  if(["off","sensor-fault"].includes(s.stage)){s.stage="cooling";s.stageTime=0;}
  s.stageTime+=dt;s.cycleTime+=dt;
  const interval=Math.max(1,number(n,"defrostInterval",3600));
  if(s.stage==="cooling"&&(r.requests[n.id]||s.cycleTime>=interval)){s.stage="defrost";s.stageTime=0;s.cycleTime=0;}
  if(s.stage==="defrost" && (s.stageTime>=Math.max(1,number(n,"defrostDuration",60))||evap>=number(n,"defrostEnd",8))){s.stage="drip";s.stageTime=0;}
  if(s.stage==="drip" && s.stageTime>=Math.max(0,number(n,"drip",10))){s.stage="fan-delay";s.stageTime=0;}
  if(s.stage==="fan-delay" && s.stageTime>=Math.max(0,number(n,"fanDelay",10))){s.stage="cooling";s.stageTime=0;}
  const setpoint=setting(r,n,"setpoint",2),diff=Math.max(.1,number(n,"differential",2));
  let demand=old.cool;if(room>=setpoint+diff)demand=true;if(room<=setpoint)demand=false;
  if(!["cooling","fan-delay"].includes(s.stage))demand=false;
  if(old.cool&&!demand)s.offAt=r.now;
  s.cool=demand && r.now-s.offAt>=Math.max(0,number(n,"restartDelay",10));
  s.defrost=s.stage==="defrost";
  s.fan=s.stage==="cooling"&&(!n.params.fanWithComp||s.cool);
  return s;
}

export function stepCircuit(project:Project,previous:Runtime,dt=0,tripPass=0):Runtime {
  const r:Runtime={...previous,now:previous.now+Math.max(0,Math.min(dt,3600)),devices:structuredClone(previous.devices),requests:{...previous.requests},faults:[],warnings:[],energized:{},wireCurrent:{},halted:false,watts:0,log:[...previous.log]};
  const old:Record<string,DeviceState>={};for(const n of project.nodes)old[n.id]={...(previous.devices[n.id]??freshState())};
  let states={...old},net=makeNetwork(project,r,states),stable=false;
  const signature=(s:Record<string,DeviceState>)=>JSON.stringify(Object.values(s).map(x=>[x.on,x.cool,x.fan,x.defrost]));
  const duplicateCoils=new Set<string>();
  for(const n of project.nodes)if(coilKinds.includes(kind(n))){if(duplicateCoils.has(n.tag))r.faults.push("Lebih dari satu coil memakai tag "+n.tag+".");duplicateCoils.add(n.tag);}
  // ponytail: fixed-point ideal-contact model, bounded to 40 passes; an analog solver is required for physical transients.
  for(let iteration=0;iteration<40;iteration++){
    net=makeNetwork(project,r,states);
    const shorts=[...net.potentials.values()].filter(v=>new Set(v.map(x=>x.source+":"+x.phase)).size>1);
    if(shorts.length){r.faults.push("Hubung singkat / sumber bertabrakan: "+shorts.map(v=>v.map(x=>x.phase).join("–")).join(", ")+". Simulasi dihentikan; arus hubung singkat tidak dihitung.");break;}
    const next:Record<string,DeviceState>={};
    for(const n of project.nodes){
      const k=kind(n),base=old[n.id],s={...base,current:0},a=pin(n,"A1"),b=pin(n,"A2");
      if(coilKinds.includes(k)){
        const v=net.voltage(a,b),rated=number(n,"voltage",230),input=v>=rated*.85&&v<=rated*1.15;
        s.input=input;s.voltage=v;s.elapsed=input?(base.input?base.elapsed+dt:0):0;
        if(base.input&&!input)s.offAt=r.now;
        if(k==="coil")s.on=input;
        if(k==="ton")s.on=input&&s.elapsed>=Math.max(0,number(n,"delay",5));
        if(k==="toff")s.on=input||(base.on&&r.now-s.offAt<Math.max(0,number(n,"delay",5)));
        if(k==="impulse")s.on=input&&!base.input?!base.on:base.on;
        if(k==="cyclic"){
          const off=Math.max(.1,number(n,"offDuration",60)),on=Math.max(.1,number(n,"onDuration",60));
          s.on=input&&s.elapsed%(off+on)>=off;
          s.stage=input?(s.on?"NO":"NC"):"off";
        }
      }else if(k==="pfr"){
        s.voltage=net.three(["L1","L2","L3"].map(x=>pin(n,x)));
        const sequence=["L1","L2","L3"].map(x=>net.unique(pin(n,x))?.phase??"?").join("");
        const ordered=n.params.expected==="any"||!n.params.expected||sequence===n.params.expected;
        s.on=s.voltage>=number(n,"minVoltage",320)&&ordered&&!r.manual[n.id+":fault"];
      }else if(k==="controller"){next[n.id]=controllerState(project,r,n,base,net,dt);continue;}
      else if(loadKinds.includes(k)){
        const pair=k==="motor"||k==="heater"?(poles(n)===0?["+","-"]:["L","N"]):["X1","X2"];
        const v=poles(n)===3?net.three(["U","V","W"].map(x=>pin(n,x))):net.voltage(pin(n,pair[0]),pin(n,pair[1]));
        const neutralOK=!n.params.neutralRequired||(net.unique(pin(n,"N"))?.phase==="N"&&net.unique(pin(n,"N"))?.source===net.unique(pin(n,"U"))?.source);
        s.voltage=v;s.on=neutralOK&&v>=number(n,"voltage",230)*.85&&v<=number(n,"voltage",230)*1.15;
        s.elapsed=s.on?base.elapsed+dt:0;
      }else if(k==="contactor"||k==="no"||k==="changeover")s.on=!!net.driven[n.tag];
      else if(k==="nc")s.on=!net.driven[n.tag];
      else if(["breaker","fuse","rcd","switch","source"].includes(k))s.on=switched(r,n)&&!s.tripped;
      else if(["stop","estop"].includes(k))s.on=!r.manual[n.id];
      else if(k==="start")s.on=!!r.manual[n.id];
      else if(k==="pressure")s.on=switched(r,n);
      else if(k==="selector")s.on=(r.manual[n.id]??n.params.position)!=="OFF";
      next[n.id]=s;
    }
    stable=signature(next)===signature(states);states=next;if(stable)break;
  }
  if(!stable&&!r.faults.length)r.faults.push("Logika berosilasi atau belum stabil. Periksa kontak NC, coil, dan interlock.");
  r.devices=states;
  if(r.faults.length){r.halted=true;for(const n of project.nodes)if(loadKinds.includes(kind(n))||coilKinds.includes(kind(n)))r.devices[n.id]={...(states[n.id]??freshState()),on:false};r.requests={};return r;}
  net=makeNetwork(project,r,states);
  for(const n of project.nodes)for(const port of ports(n)){const potential=net.unique(pin(n,port.name));if(potential)r.energized[pin(n,port.name)]=potential.phase;}
  const edgeCurrent=new Map<string,number>();
  const consume=(port:string,amps:number)=>{for(const edge of net.path(port))edgeCurrent.set(edge,(edgeCurrent.get(edge)??0)+amps);};
  for(const n of project.nodes){
    const k=kind(n),s=states[n.id];if(!s.on&&!(coilKinds.includes(k)&&s.input))continue;
    if(loadKinds.includes(k)){
      const factor=poles(n)===3?Math.sqrt(3):1,pf=k==="motor"?Math.max(.01,number(n,"powerFactor",.8)):1;
      const startup=k==="motor"&&s.elapsed<number(n,"startSeconds")?Math.max(1,number(n,"startFactor",1)):1;
      const amps=k==="motor"?Math.max(0,setting(r,n,"current"))*Math.max(0,setting(r,n,"loadFactor",1))*startup:Math.max(0,setting(r,n,"watts"))/(factor*Math.max(1,s.voltage));
      s.current=amps;r.watts+=factor*s.voltage*amps*pf;
      const ps=poles(n)===3?["U","V","W"]:k==="motor"||k==="heater"?(poles(n)===0?["+","-"]:["L","N"]):["X1","X2"];
      ps.forEach(t=>consume(pin(n,t),amps));
      if(["motor","heater"].includes(k)&&amps===0)r.warnings.push(n.tag+": arus/daya belum diisi; trip beban belum dapat diuji.");
      if(["motor","heater"].includes(k)&&net.unique(pin(n,"PE"))?.phase!=="PE")r.warnings.push(n.tag+": PE belum terhubung.");
    }else if(coilKinds.includes(k)&&s.input){const amps=Math.max(0,number(n,"va",3))/Math.max(1,s.voltage);consume(pin(n,"A1"),amps);consume(pin(n,"A2"),amps);}
    else if(k==="controller"){const cp=controllerPins(n);consume(pin(n,cp.line),3/Math.max(1,s.voltage));consume(pin(n,cp.neutral),3/Math.max(1,s.voltage));}
  }
  for(const [edge,amps]of edgeCurrent){
    if(edge.startsWith("w:"))r.wireCurrent[edge.slice(2)]=amps;
    if(edge.startsWith("n:")){const id=edge.split(":")[1];if(states[id])states[id].current=Math.max(states[id].current,amps);}
  }
  let newTrip=false;
  for(const n of project.nodes){
    const k=kind(n),s=states[n.id];
    if(["overload","breaker","fuse"].includes(k)&&number(n,"rating")<=0)r.warnings.push(n.tag+": rating belum diisi; trip arus lebih belum dihitung.");
    if(["overload","breaker","fuse"].includes(k)&&!s.tripped&&number(n,"rating")>0){
      const rated=number(n,"rating",1),ratio=s.current/Math.max(.01,rated),thermal=Math.max(1,number(n,"thermalSeconds",30));
      s.heat=Math.max(0,old[n.id].heat+dt*(ratio>1?(ratio*ratio-1)/thermal:-.2));
      const magnetic=n.params.curve==="B"?5:n.params.curve==="D"?20:10;
      if(s.heat>=1||(k!=="overload"&&ratio>=magnetic&&dt>0)){s.tripped=true;newTrip=true;}
    }
    if(k==="rcd"&&!s.tripped&&setting(r,n,"leakageMA")>=Math.max(1,number(n,"thresholdMA",30))){s.tripped=true;newTrip=true;}
    if(k==="controller"&&s.stage==="sensor-fault")r.warnings.push(n.tag+": sensor terputus, tersambung salah, atau mendapat tegangan daya.");
    if(coilKinds.includes(k)&&s.voltage>0&&!s.input)r.warnings.push(n.tag+": tegangan coil "+s.voltage.toFixed(0)+" V tidak cocok.");
    if(s.on!==old[n.id].on||s.tripped!==old[n.id].tripped)r.log.push({time:r.now,text:n.tag+" "+(s.tripped?"TRIP":s.on?"ON":"OFF")});
  }
  r.requests={};r.log=r.log.slice(-120);
  if(newTrip&&tripPass<3)return stepCircuit(project,r,0,tripPass+1);
  return r;
}

export function interact(project:Project,r:Runtime,id:string,pressed?:boolean):Runtime {
  const n=project.nodes.find(n=>n.id===id);if(!n)return r;
  const next={...r,manual:{...r.manual},devices:structuredClone(r.devices),requests:{...r.requests}},k=kind(n);
  if(["start","stop"].includes(k))next.manual[id]=!!pressed;
  else if(["overload","breaker","fuse","rcd"].includes(k)&&stateOf(r,n).tripped)next.devices[id]={...stateOf(r,n),tripped:false,heat:0,current:0};
  else if(k==="overload")next.devices[id]={...stateOf(r,n),tripped:true};
  else if(k==="estop")next.manual[id]=!r.manual[id];
  else if(["switch","source","breaker","fuse","rcd","pressure"].includes(k))next.manual[id]=!switched(r,n);
  else if(k==="selector"){const positions=selectorPositions(n),value=String(r.manual[id]??n.params.position);next.manual[id]=positions[(positions.indexOf(value)+1)%positions.length];}
  else if(k==="pfr")next.manual[id+":fault"]=!r.manual[id+":fault"];
  else if(k==="controller")next.requests[id]=true;
  return stepCircuit(project,next,0);
}
