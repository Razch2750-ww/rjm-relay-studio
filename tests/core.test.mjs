import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { DatabaseSync } from "node:sqlite";
import { CATALOG,blankProject,newNode,pin,validateProject,ports,defaultCalculation } from "../lib/circuit.ts";
import { jagoTemplate,dolTemplate } from "../lib/templates.ts";
import { freshRuntime,stepCircuit,interact } from "../lib/simulator.ts";
import { calculate,voltageDrop } from "../lib/calculation.ts";
import { reconcile,acknowledge,entryFromRemote } from "../lib/sync.ts";
import { loadProjects,saveProject } from "../db/project-store.ts";

const near=(actual,expected,eps=1e-8)=>assert.ok(Math.abs(actual-expected)<eps,`${actual} ≠ ${expected}`);
const liveJago=()=>{const p=validateProject(jagoTemplate());return {p,r:stepCircuit(p,freshRuntime(),11)};};
const change=(p,r,key,value)=>stepCircuit(p,{...r,values:{...r.values,[key]:value}},0);
function fixture(types){
  const p=blankProject("Test circuit"),nodes={};
  for(const [id,type,params={}] of types){const n={...newNode(type,"control",20,20,id),id};n.params={...n.params,...params};nodes[id]=n;p.nodes.push(n);}
  const w=(a,ap,b,bp)=>p.wires.push({id:"w"+p.wires.length,from:pin(a,ap),to:pin(b,bp),label:"",color:"auto",bends:[]});
  return {p,nodes,w};
}
function timerFixture(type){
  const f=fixture([["s","source1"],["sw","switch",{on:false}],["t",type,{delay:5}],["no","no"],["l","lamp"]]);
  f.nodes.no.tag="t";f.w("s","L","sw","1");f.w("sw","2","t","A1");f.w("t","A2","s","N");
  f.w("s","L","no","1");f.w("no","2","l","X1");f.w("l","X2","s","N");return f;
}

test("all catalog components and both templates round-trip through the import validator",()=>{
  for(const p of [jagoTemplate(),dolTemplate()])assert.deepEqual(validateProject(JSON.parse(JSON.stringify(p))),p);
  const p=blankProject();p.nodes=Object.keys(CATALOG).map((type,i)=>newNode(type,"control",i*20,0,"X"+i));
  validateProject(p);for(const n of p.nodes)assert.equal(new Set(ports(n).map(p=>p.name)).size,ports(n).length);
});
test("validator rejects dangling wires, duplicate IDs, unexpected fields and non-finite data",()=>{
  for(const mutate of [p=>p.wires[0].to="missing:A1",p=>p.nodes.push(p.nodes[0]),p=>p.nodes[0].x=Infinity,p=>p.extra=true,p=>p.wires[0].from=p.wires[0].to]){
    const p=dolTemplate();mutate(p);assert.throws(()=>validateProject(p));
  }
});
test("Jago power/control mapping energizes CDU and fan, leaves heater off",()=>{
  const {p,r}=liveJago();assert.equal(r.halted,false,r.faults.join());
  assert.equal(r.devices.cdu.on,true);assert.equal(r.devices.fan.on,true);assert.equal(r.devices.heater.on,false);
  near(r.devices.coilC.voltage,400/Math.sqrt(3));
  assert.equal(p.nodes.find(n=>n.id==="kheater").tag,"K2");assert.equal(p.nodes.find(n=>n.id==="kfan").tag,"K3");
});
test("START seals in after release and STOP removes the holding circuit",()=>{
  const p=dolTemplate();let r=stepCircuit(p,freshRuntime());assert.equal(r.devices.coil.on,false);
  r=interact(p,r,"start",true);r=interact(p,r,"start",false);assert.equal(r.devices.coil.on,true);assert.equal(r.devices.lamp.on,true);
  r=interact(p,r,"stop",true);assert.equal(r.devices.coil.on,false);
  r=interact(p,r,"stop",false);assert.equal(r.devices.coil.on,false);
});
test("wiring edits change the actual logical outcome",()=>{
  const p=dolTemplate();p.wires=p.wires.filter(w=>w.to!=="coil:A2"&&w.from!=="coil:A2");
  const r=interact(p,freshRuntime(),"start",true);assert.equal(r.devices.coil.on,false);
});
test("F2 fan overload interrupts common feed to ALL controller outputs",()=>{
  const {p,r}=liveJago();const tripped=interact(p,r,"ffan");
  assert.equal(tripped.devices.ctl.on,true);assert.equal(tripped.devices.cdu.on,false);assert.equal(tripped.devices.fan.on,false);assert.equal(tripped.devices.fanFault.on,true);
  const defrost=interact(p,tripped,"ctl");assert.equal(defrost.devices.ctl.defrost,true);assert.equal(defrost.devices.heater.on,false);
  const reset=interact(p,defrost,"ffan");assert.equal(reset.devices.heater.on,true);assert.equal(reset.devices.fanFault.on,false);
});
test("CDU internal F1 assumption stops compressor and raises its fault without stopping fan",()=>{
  const {p,r}=liveJago(),fault=interact(p,r,"fcdu");
  assert.equal(fault.devices.cdu.on,false);assert.equal(fault.devices.fan.on,true);assert.equal(fault.devices.compFault.on,true);
});
test("emergency stop latches open until explicitly reset",()=>{
  const {p,r}=liveJago();let fault=interact(p,r,"emergency");fault=stepCircuit(p,fault,50);
  assert.equal(fault.devices.ctl.on,false);assert.equal(fault.devices.cdu.on,false);assert.equal(fault.devices.fan.on,false);
  fault=interact(p,fault,"emergency");fault=stepCircuit(p,fault,11);assert.equal(fault.devices.cdu.on,true);
});
test("HP/LP safety opens the shared control supply and lights its alarm",()=>{
  const {p,r}=liveJago(),fault=interact(p,r,"hlp");assert.equal(fault.devices.cdu.on,false);assert.equal(fault.devices.fan.on,false);assert.equal(fault.devices.hlpFault.on,true);
});
test("loss of each phase removes 3-phase loads; control-powered PFR alarm reflects available feed",()=>{
  for(const phase of ["R","S","T"]){const {p,r}=liveJago(),fault=stepCircuit(p,{...r,manual:{["supply:phase"]:phase}},0);
    assert.equal(fault.devices.pfr.on,false);assert.equal(fault.devices.cdu.on,false);assert.equal(fault.devices.fan.on,false);
    assert.equal(fault.devices.pfrFault.on,phase!=="T");
  }
});
test("main breaker removes downstream buses and loads",()=>{
  const {p,r}=liveJago(),off=interact(p,r,"main");assert.equal(off.energized["pR:A"],undefined);assert.equal(off.devices.ctl.on,false);assert.equal(off.devices.cdu.on,false);
});
test("thermostat honors differential and anti-short-cycle delay",()=>{
  const {p,r}=liveJago();let x=change(p,r,"roomProbe:value",2);assert.equal(x.devices.cdu.on,false);
  x=change(p,x,"roomProbe:value",3);x=stepCircuit(p,x,15);assert.equal(x.devices.cdu.on,false);
  x=change(p,x,"roomProbe:value",5);assert.equal(x.devices.cdu.on,true);
  x=change(p,x,"roomProbe:value",1);x=change(p,x,"roomProbe:value",8);assert.equal(x.devices.cdu.on,false);
  x=stepCircuit(p,x,9);assert.equal(x.devices.cdu.on,false);x=stepCircuit(p,x,1);assert.equal(x.devices.cdu.on,true);
});
test("defrost -> drip -> fan delay -> cooling, with mutually exclusive heater/compressor",()=>{
  const {p,r}=liveJago();let x=interact(p,r,"ctl");
  assert.equal(x.devices.ctl.stage,"defrost");assert.equal(x.devices.heater.on,true);assert.equal(x.devices.cdu.on,false);assert.equal(x.devices.fan.on,false);
  x=stepCircuit(p,x,60);assert.equal(x.devices.ctl.stage,"drip");assert.equal(x.devices.heater.on,false);assert.equal(x.devices.cdu.on,false);
  x=stepCircuit(p,x,10);assert.equal(x.devices.ctl.stage,"fan-delay");assert.equal(x.devices.cdu.on,true);assert.equal(x.devices.fan.on,false);
  x=stepCircuit(p,x,10);assert.equal(x.devices.ctl.stage,"cooling");assert.equal(x.devices.fan.on,true);
});
test("automatic interval starts defrost and evaporator termination temperature ends it",()=>{
  const {p,r}=liveJago();p.nodes.find(n=>n.id==="ctl").params.defrostInterval=20;
  let x=stepCircuit(p,r,10);assert.equal(x.devices.ctl.stage,"defrost");x=change(p,x,"evapProbe:value",9);assert.equal(x.devices.ctl.stage,"drip");
});
test("broken/miswired sensor fails closed and temperature display follows its actual connection",()=>{
  const {p,r}=liveJago(),hot=change(p,r,"roomProbe:value",12);assert.equal(hot.devices.ctl.temperature,12);
  const broken=stepCircuit(p,{...hot,manual:{"roomProbe:fault":true}},0);assert.equal(broken.devices.ctl.stage,"sensor-fault");assert.equal(broken.devices.cdu.on,false);assert.equal(broken.devices.fan.on,false);
  p.wires=p.wires.filter(w=>w.to!=="roomProbe:2");const disconnected=stepCircuit(p,hot,0);assert.equal(disconnected.devices.ctl.stage,"sensor-fault");
});
test("ideal phase-neutral short halts instead of displaying invented fault current",()=>{
  const p=dolTemplate();p.wires.push({id:"short",from:"src:L",to:"src:N",label:"",color:"auto",bends:[]});
  const r=stepCircuit(p,freshRuntime(),1);assert.equal(r.halted,true);assert.match(r.faults.join(),/Hubung singkat/);assert.equal(r.devices.lamp.on,false);
});
test("motor cannot run on three copies of the same phase or use PE as a neutral",()=>{
  const f=fixture([["s","source3"],["m","motor3"]]);for(const port of ["U","V","W"])f.w("s","L1","m",port);
  assert.equal(stepCircuit(f.p,freshRuntime()).devices.m.on,false);
  const g=fixture([["s","source1"],["l","lamp"]]);g.w("s","L","l","X1");g.w("s","PE","l","X2");assert.equal(stepCircuit(g.p,freshRuntime()).devices.l.on,false);
});
test("TON does not accumulate delay repeatedly in solver iterations",()=>{
  const {p}=timerFixture("ton");let r=interact(p,freshRuntime(),"sw");r=stepCircuit(p,r,4.9);assert.equal(r.devices.l.on,false);r=stepCircuit(p,r,.1);assert.equal(r.devices.l.on,true);
  r=interact(p,r,"sw");assert.equal(r.devices.l.on,false);
});
test("TOFF holds exactly the configured interval after coil supply opens",()=>{
  const {p}=timerFixture("toff");let r=interact(p,freshRuntime(),"sw");assert.equal(r.devices.l.on,true);r=interact(p,r,"sw");r=stepCircuit(p,r,4);assert.equal(r.devices.l.on,true);r=stepCircuit(p,r,1);assert.equal(r.devices.l.on,false);
});
test("impulse relay toggles once per rising edge, not per solver tick",()=>{
  const {p}=timerFixture("impulse");let r=interact(p,freshRuntime(),"sw");assert.equal(r.devices.l.on,true);r=stepCircuit(p,r,30);assert.equal(r.devices.l.on,true);r=interact(p,r,"sw");assert.equal(r.devices.l.on,true);r=interact(p,r,"sw");assert.equal(r.devices.l.on,false);
});
test("overload alone does not physically interrupt power poles",()=>{
  const f=fixture([["s","source3"],["ol","overload",{rating:4}],["m","motor3",{current:2}]]);
  for(let i=0;i<3;i++){f.w("s","L"+(i+1),"ol",String(i*2+1));f.w("ol",String(i*2+2),"m",["U","V","W"][i]);}
  const r=interact(f.p,stepCircuit(f.p,freshRuntime()),"ol");assert.equal(r.devices.ol.tripped,true);assert.equal(r.devices.m.on,true);
});
test("unknown overload rating stays pending; known running current reaches upstream protection",()=>{
  const {p,r}=liveJago();let x=change(p,r,"cdu:current",5);x=stepCircuit(p,x,3);assert.equal(x.devices.fcdu.tripped,false);near(x.devices.bcdu.current,5);assert.match(x.warnings.join(),/F1: rating belum/);
  x=change(p,x,"cdu:current",0);near(x.devices.bcdu.current,0);
});
test("time-overcurrent model opens breaker and removes load voltage",()=>{
  const f=fixture([["s","source1"],["b","breaker1",{rating:2,thermalSeconds:1}],["m","motor1",{current:4}]]);
  f.w("s","L","b","1");f.w("b","2","m","L");f.w("m","N","s","N");let r=stepCircuit(f.p,freshRuntime(),1);assert.equal(r.devices.b.tripped,true);assert.equal(r.devices.m.on,false);near(r.devices.b.current,0);
});
test("RCCB injected leakage trips independently of load current",()=>{
  const f=fixture([["s","source1"],["b","rcd"],["l","lamp"]]);f.w("s","L","b","1");f.w("b","2","l","X1");f.w("s","N","b","3");f.w("b","4","l","X2");
  let r=stepCircuit(f.p,freshRuntime());assert.equal(r.devices.l.on,true);r=change(f.p,r,"b:leakageMA",31);assert.equal(r.devices.b.tripped,true);assert.equal(r.devices.l.on,false);
});
test("voltage-drop formula agrees with explicit 1-phase resistive and 3-phase calculations",()=>{
  near(voltageDrop(10,30,2.5,1,1),5.688);
  near(voltageDrop(12,50,4,.8,3),Math.sqrt(3)*12*.05*(5.925*.8+.08*.6));
});
test("cable candidate checks corrected ampacity and drop, rejects impossible results",()=>{
  const input={...defaultCalculation,current:10,phases:1,voltage:230,length:30,breaker:16,powerFactor:1};
  const r=calculate(input);assert.equal(r.error,null);assert.equal(r.candidate.size,2.5);near(r.candidate.iz,21);
  const derated=calculate({...input,ambient:41,grouping:2});near(derated.kt,.79);near(derated.kg,.8);assert.ok(derated.candidate.size>2.5);
  const impossible=calculate({...input,current:200,breaker:250});assert.equal(impossible.candidate,undefined);
});
test("HP/PK quick estimate distinguishes shaft power from cooling capacity",()=>{
  const input={...defaultCalculation,mode:"quick",hp:8,length:30};assert.match(calculate(input).error,/kapasitas pendinginan/);
  const hp=calculate({...input,hpBasis:"shaft"}),pk=calculate({...input,hpBasis:"shaft",hpUnit:"PK"});near(hp.current,8*745.7/(.85*Math.sqrt(3)*400*.8));near(pk.current/hp.current,735.5/745.7);assert.equal(hp.overloadReferenceA,null);
});
test("no zero-length, invalid PF or unknown current is presented as a valid cable design",()=>{
  assert.ok(calculate(defaultCalculation).error);assert.ok(calculate({...defaultCalculation,length:20,current:10,powerFactor:0}).error);
  const r=calculate({...defaultCalculation,length:20,current:10,faultKA:10,breakingKA:6});assert.match(r.warnings.join(),/Breaking capacity/);
});
test("sync preserves conflicting edits and accepts a newer clean server revision",()=>{
  const doc=blankProject(),remote={id:doc.id,document:doc,revision:1,deleted:false,updatedAt:"2026-09-16"};
  const local=entryFromRemote(remote),changed={...remote,revision:2,document:{...doc,name:"Cloud"}};
  const clean=reconcile([local],[changed]);assert.equal(clean.conflicts.length,0);assert.equal(clean.entries[0].document.name,"Cloud");
  const dirty={...local,dirty:true,document:{...doc,name:"Offline"}},conflict=reconcile([dirty],[changed]);assert.equal(conflict.conflicts.length,1);assert.equal(conflict.entries[0].document.name,"Offline");
});
test("upload acknowledgement preserves edits or deletion made while upload was in flight",()=>{
  const document=blankProject(),sent={document,baseRevision:0,dirty:true,deleted:false,updatedAt:"a"};
  assert.equal(acknowledge(sent,sent,1,"b").dirty,false);
  const live={...sent,document:{...document,name:"new edit"}};const next=acknowledge(live,sent,1,"b");assert.equal(next.dirty,true);assert.equal(next.document.name,"new edit");assert.equal(next.baseRevision,1);
  assert.equal(acknowledge({...sent,deleted:true},sent,1,"b").dirty,true);
});
test("database isolates owners and rejects stale updates/deletes with compare-and-swap",async()=>{
  const sql=new DatabaseSync(":memory:");sql.exec(readFileSync(new URL("../drizzle/0000_young_adam_warlock.sql",import.meta.url),"utf8"));
  const db={prepare(query){const statement=sql.prepare(query);return {bind(...args){return {first:async()=>statement.get(...args)??null,all:async()=>({results:statement.all(...args)})};}};}};
  try{
    const doc=blankProject();assert.equal((await saveProject(db,"a",doc,0,false)).revision,1);
    assert.equal((await saveProject(db,"a",{...doc,name:"stale"},0,false)).ok,false);
    assert.deepEqual(await loadProjects(db,"b"),[]);
    assert.equal((await saveProject(db,"b",{...doc,name:"B only"},0,false)).ok,true);
    assert.equal((await saveProject(db,"a",{...doc,name:"A updated"},1,false)).revision,2);
    const stale=await saveProject(db,"a",doc,1,true);assert.equal(stale.ok,false);assert.equal(stale.remote.document.name,"A updated");
    assert.equal((await loadProjects(db,"b"))[0].document.name,"B only");
    assert.equal((await saveProject(db,"a",doc,2,true)).revision,3);assert.equal((await loadProjects(db,"a"))[0].deleted,true);
  }finally{sql.close();}
});
