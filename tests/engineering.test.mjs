import test from "node:test";
import assert from "node:assert/strict";
import {blankProject,newNode,pin,defaultCable,defaultRoom,validateProject} from "../lib/circuit.ts";
import {coldRoomTemplate} from "../lib/cold-room-template.ts";
import {freshRuntime,stepCircuit,advanceCircuit,interact,injectFault} from "../lib/simulator.ts";
import {freshState} from "../lib/engine/state.ts";
import {nominalCurrent,loadCurrent} from "../lib/engine/load.ts";
import {protectionStep} from "../lib/engine/protection.ts";
import {cableCapacity,cableStep} from "../lib/engine/cable.ts";
import {pressureState,timerScheduled} from "../lib/engine/control.ts";
import {makeNetwork} from "../lib/engine/network.ts";
import {measure} from "../lib/engine/measurement.ts";
import {checkWiring} from "../lib/engine/diagnostics.ts";
import {SCENARIOS,runScenario} from "../lib/engine/scenarios.ts";
import {roomStep} from "../lib/engine/room.ts";
import {physicalBounds,panelWarnings} from "../lib/panel-layout.ts";
import {excelWorkbook,reportHTML,schedules,simulationRecord} from "../lib/reports.ts";

const near=(a,b,eps=1e-5)=>assert.ok(Math.abs(a-b)<eps,`${a} != ${b}`);
function fixture(entries){
 const p=blankProject("Engineering fixture"),nodes={};
 for(const [id,type,params={}]of entries){const n={...newNode(type,"power",0,0,id),id};n.params={...n.params,...params};p.nodes.push(n);nodes[id]=n;}
 const wire=(a,ap,b,bp,cable)=>{const w={id:"w"+p.wires.length,from:pin(a,ap),to:pin(b,bp),label:String(p.wires.length+1),color:"auto",bends:[],...(cable?{cable:{...defaultCable,...cable}}:{})};p.wires.push(w);return w;};
 return {p,nodes,wire};
}
function heaterFixture({rating=40,watts=2300,faultKA=6,cable}={}){
 const f=fixture([["s","source1",{faultKA}],["b","breaker1",{rating}],["h","heater1",{watts}]]);
 f.wire("s","L","b","1");f.feed=f.wire("b","2","h","L",cable);f.wire("h","N","s","N");return f;
}

test("commissioning project and stored engineering results round-trip without losing layouts or cable data",()=>{
 const p=coldRoomTemplate();p.sheets=[{id:"sheet-extra",name:"Terminal diagram"}];p.nodes.push(newNode("text","sheet-extra",0,0,"NOTE1"));
 p.simulation=simulationRecord(stepCircuit(p,freshRuntime()));
 assert.deepEqual(validateProject(JSON.parse(JSON.stringify(p))),p);
 p.front.items[0].nodeId="missing";assert.throws(()=>validateProject(p));
});
test("all thirteen commissioning scenarios verify their expected circuit response",()=>{
 const p=coldRoomTemplate();for(const {id}of SCENARIOS){const result=runScenario(p,id);assert.equal(result.status,"PASS",id+": "+result.steps.join("; "));}
});
test("scenario detects a bypassed HP safety; it cannot give a scripted PASS",()=>{
 const p=coldRoomTemplate(),hp=p.nodes.find(n=>n.type==="hp");
 p.wires.push({id:"unsafe-bypass",from:pin(hp,"C"),to:pin(hp,"OK"),label:"HP bypass",color:"auto",bends:[]});
 assert.equal(runScenario(p,"hp").status,"FAIL");
});
test("motor startup is 35 A before settling at nameplate 8 A; normal C16 survives",()=>{
 const f=fixture([["s","source1"],["b","breaker1",{rating:16}],["m","motor1",{current:8,lra:35,startSeconds:.5}]]);
 f.wire("s","L","b","1");f.wire("b","2","m","L");f.wire("m","N","s","N");
 let r=stepCircuit(f.p,freshRuntime());near(r.devices.m.current,35);assert.equal(r.devices.b.tripped,false);
 r=advanceCircuit(f.p,r,.7);near(r.devices.m.current,8);near(r.devices.m.peak,35);assert.equal(r.devices.b.tripped,false);
 f.nodes.b.params.rating=4;f.nodes.b.params.curve="B";r=advanceCircuit(f.p,freshRuntime(),.1);assert.equal(r.devices.b.tripped,true);assert.equal(r.devices.m.on,false);
});
test("full nameplate wins over HP and cooling HP cannot be silently converted to shaft current",()=>{
 const n=newNode("motor3","power",0,0,"M1");Object.assign(n.params,{current:8,inputMode:"quick",hp:10});near(nominalCurrent(n).current,8);
 n.params.current=0;near(nominalCurrent(n).current,7457/(Math.sqrt(3)*400*.8*.85));
 n.params.hpBasis="cooling";assert.equal(nominalCurrent(n).current,0);assert.match(nominalCurrent(n).error,/bukan daya poros/);
});
test("thermal inverse-time response speeds up at 105%, 120%, 200% and 600%; no immediate overload trip",()=>{
 const n=newNode("overload","power",0,0,"OL1");n.params.rating=10;
 const times=[1.05,1.2,2,6].map(ratio=>{let s={...freshState(),current:10*ratio},t=0;while(!s.tripped&&t<300){const old={...s};protectionStep(n,old,s,freshRuntime(),.05);t+=.05;}return t;});
 assert.ok(times[0]>times[1]&&times[1]>times[2]&&times[2]>times[3]);assert.ok(times[0]>190);assert.ok(times[3]>.5&&times[3]<1);
});
test("overload cools before manual reset; automatic reset is opt-in",()=>{
 const n={...newNode("overload","power",0,0,"OL1"),id:"ol"},p=blankProject();p.nodes=[n];
 let r=freshRuntime();r.devices.ol={...freshState(),heat:1,tripped:true};
 r=interact(p,r,"ol");assert.equal(r.devices.ol.tripped,true);
 r=advanceCircuit(p,r,25);assert.equal(r.devices.ol.tripped,true);assert.ok(r.devices.ol.heat<.2);
 r=interact(p,r,"ol");assert.equal(r.devices.ol.tripped,false);
 n.params.resetMode="auto";r.devices.ol={...freshState(),heat:1,tripped:true};r=advanceCircuit(p,r,25);assert.equal(r.devices.ol.tripped,false);
});
test("MCB overload trips by accumulated heat and remains latched after fault removal",()=>{
 const {p,nodes}=heaterFixture({rating:10,watts:4600});let r=advanceCircuit(p,freshRuntime(),9);assert.equal(r.devices.b.tripped,false);
 r=advanceCircuit(p,r,2);assert.equal(r.devices.b.tripped,true);assert.equal(r.devices.h.on,false);
 nodes.h.params.watts=230;r=advanceCircuit(p,r,50);assert.equal(r.devices.b.tripped,true);
 r=interact(p,r,"b");assert.equal(r.devices.b.tripped,false);assert.equal(r.devices.h.on,true);
});
test("known source impedance lets upstream breaker clear a short; event and peak survive clearing",()=>{
 const {p}=heaterFixture({rating:16});let r=injectFault(p,stepCircuit(p,freshRuntime()),"h","short",true);
 r=advanceCircuit(p,r,.1);assert.equal(r.halted,false,r.faults.join());assert.equal(r.devices.b.tripped,true);assert.equal(r.devices.h.on,false);assert.ok(r.peak>=6000-1e-4);assert.ok(r.log.some(e=>e.text.includes("Hubung singkat")));
});
test("unknown short-circuit source data or inadequate breaking capacity prevents a false safe result",()=>{
 const {p,nodes}=heaterFixture({rating:16,faultKA:0});let r=injectFault(p,stepCircuit(p,freshRuntime()),"h","short",true);assert.equal(r.halted,true);assert.match(r.faults.join(),/prospektif/);
 nodes.s.params.faultKA=10;nodes.b.params.breakingKA=3;r=injectFault(p,stepCircuit(p,freshRuntime()),"h","short",true);assert.equal(r.halted,true);assert.match(r.faults.join(),/Breaking capacity/);
});
test("parallel resistive wires split current and upstream current obeys Kirchhoff balance",()=>{
 const f=heaterFixture({watts:2300,cable:{length:0,resistance:1}});const parallel=f.wire("b","2","h","L",{length:0,resistance:2});
 const r=advanceCircuit(f.p,freshRuntime(),1),i=r.devices.h.current;
 near(r.wireCurrent[f.feed.id]/r.wireCurrent[parallel.id],2);near(r.wireCurrent[f.feed.id]+r.wireCurrent[parallel.id],i);near(r.devices.b.current,i);near(r.phaseCurrent.N,i);
 assert.ok(r.devices.h.voltage<230);near(measure(f.p,r,"h:L","h:N","voltage").value,r.devices.h.voltage,1e-3);
});
test("neutral current is a phasor sum: balanced loads cancel, two equal phases leave one phase current",()=>{
 const v=380/Math.sqrt(3),f=fixture([["s","source3",{voltage:380}],["j","junction"],...["r","s2","t"].map(id=>[id,"heater1",{voltage:v,watts:v*10}])]);
 for(const [i,id]of ["r","s2","t"].entries()){f.wire("s","L"+(i+1),id,"L");f.wire(id,"N","j","T");}const neutral=f.wire("j","B","s","N");
 let r=stepCircuit(f.p,freshRuntime());near(r.phaseCurrent.R,10);near(r.phaseCurrent.S,10);near(r.phaseCurrent.T,10);near(r.wireCurrent[neutral.id],0);near(r.phaseCurrent.N,0);
 f.nodes.t.params.watts=0;r=stepCircuit(f.p,freshRuntime());near(r.phaseCurrent.N,10);near(r.wireCurrent[neutral.id],10);
});
test("an undersized cable heats and warns without acting as a protective switch",()=>{
 const {p,feed}=heaterFixture({rating:40,watts:4600,cable:{section:1.5,length:1}});const r=advanceCircuit(p,freshRuntime(),130);
 assert.equal(r.devices.b.tripped,false);assert.equal(r.devices.h.on,true);assert.ok(r.cables[feed.id].temperature>70);assert.ok(["UNDERSIZED","DANGEROUS"].includes(r.cables[feed.id].status));
 assert.ok(checkWiring(p,r).some(x=>x.target===feed.id&&x.message.includes("Critical protection coordination")));
});
test("cable table correction and unsupported materials are explicit",()=>{
 near(cableCapacity({...defaultCable,section:1.5}),15);near(cableCapacity({...defaultCable,section:2.5,ambient:40,grouping:.8}),20*.87*.8);
 assert.equal(cableCapacity({...defaultCable,section:.75}),null);assert.equal(cableCapacity({...defaultCable,material:"Al"}),null);
 near(cableCapacity({...defaultCable,material:"Al",ampacity:18,ambient:40}),18*.87);
 const w={id:"w",from:"s:L",to:"h:L",label:"1",bends:[],color:"auto",cable:{...defaultCable}};
 assert.ok(cableStep(w,undefined,10,1,true).drop>cableStep(w,undefined,10,1).drop+19);
});
test("cable overload injection increases a downstream load through its real upstream breaker",()=>{
 const {p,feed}=heaterFixture({rating:40,watts:1840,cable:{section:1.5,length:0}});let r=stepCircuit(p,freshRuntime());near(r.devices.h.current,8);
 r=injectFault(p,r,feed.id,"overload",true);near(r.devices.h.current,24);near(r.devices.b.current,24);near(r.wireCurrent[feed.id],24);assert.equal(r.devices.b.tripped,false);assert.equal(r.cables[feed.id].status,"DANGEROUS");
});
test("HP manual reset and LP automatic hysteresis operate actual NC/NO contacts",()=>{
 const hp={...newNode("hp","control",0,0,"HP"),id:"hp"},lp={...newNode("lp","control",0,0,"LP"),id:"lp"},p=blankProject();p.nodes=[hp,lp];
 let r=stepCircuit(p,freshRuntime());assert.equal(r.devices.hp.on,true);assert.equal(r.devices.lp.on,true);
 r=stepCircuit(p,{...r,values:{"room:discharge":25,"room:suction":.4}});assert.equal(r.devices.hp.on,false);assert.equal(r.devices.lp.on,false);
 r=stepCircuit(p,{...r,values:{"room:discharge":16,"room:suction":1}});assert.equal(r.devices.hp.on,false);assert.equal(r.devices.lp.on,false);
 r=stepCircuit(p,{...r,values:{...r.values,"room:suction":2}});assert.equal(r.devices.lp.on,true);assert.equal(r.devices.hp.on,false);
 r=interact(p,r,"hp");assert.equal(r.devices.hp.on,true);
 hp.params.contact="NO";r=injectFault(p,stepCircuit(p,freshRuntime()),"hp","pressure",true);const net=makeNetwork(p,r,r.devices);assert.equal(net.root("hp:C"),net.root("hp:OK"));
});
test("weekly and overnight timer handles day rollover and explicit overrides",()=>{
 const n=newNode("schedule","control",0,0,"KT1"),r=freshRuntime();n.params.schedule="1@22:00-06:00";
 for(const [seconds,expected]of [[21*3600,false],[23*3600,true],[86400+5*3600,true],[86400+6*3600,false]]){r.clockStart=seconds;assert.equal(timerScheduled(n,r),expected);}
 r.manual[n.id+":override"]="ON";assert.equal(timerScheduled(n,r),true);r.manual[n.id+":override"]="OFF";assert.equal(timerScheduled(n,r),false);
});
test("coil open releases main and auxiliary contacts; welded main contacts stay live independently",()=>{
 const f=fixture([["s","source1"],["c","coil"],["k","contactor1"],["no","no"],["m","motor1",{current:2}],["l","lamp"]]);f.nodes.k.tag=f.nodes.no.tag=f.nodes.c.tag;
 f.wire("s","L","c","A1");f.wire("c","A2","s","N");f.wire("s","L","k","1");f.wire("k","2","m","L");f.wire("m","N","s","N");f.wire("s","L","no","1");f.wire("no","2","l","X1");f.wire("l","X2","s","N");
 let r=stepCircuit(f.p,freshRuntime());assert.equal(r.devices.m.on,true);assert.equal(r.devices.l.on,true);
 r=injectFault(f.p,r,"c","coil-open",true);assert.equal(r.devices.m.on,false);assert.equal(r.devices.l.on,false);
 r=injectFault(f.p,r,"k","welded",true);assert.equal(r.devices.m.on,true);assert.equal(r.devices.l.on,false);
});
test("coil frequency and open neutral prevent energization",()=>{
 const f=fixture([["s","source1",{frequency:60}],["c","coil",{frequency:50}]]);f.wire("s","L","c","A1");f.wire("c","A2","s","N");
 let r=stepCircuit(f.p,freshRuntime());assert.equal(r.devices.c.on,false);f.nodes.c.params.frequency=60;r=stepCircuit(f.p,r);assert.equal(r.devices.c.on,true);
 r=injectFault(f.p,r,"s","neutral-lost",true);assert.equal(r.devices.c.on,false);
});
test("multimeter reads actual terminal voltage and blocks resistance measurement on energized circuits",()=>{
 const {p,feed}=heaterFixture({cable:{section:2.5,length:10}});let r=advanceCircuit(p,freshRuntime(),1);
 assert.ok(measure(p,r,"h:L","h:N","voltage").value<230);assert.equal(measure(p,r,"b:1","b:2","resistance").value,null);
 r=interact(p,r,"s");assert.equal(measure(p,r,"b:1","b:2","continuity").value,0);assert.ok(measure(p,r,feed.from,feed.to,"resistance").value>0);
});
test("room temperature responds to compressor plus fan, heater and open door; bound probes follow it",()=>{
 const p=coldRoomTemplate();p.room={...defaultRoom,enabled:true,productKg:0};let r=freshRuntime();r.now=1;roomStep(p,r,1);const t=r.room.temperature;
 r.devices.comp={...freshState(),on:true};r.devices.fan={...freshState(),on:true};r.now+=10;roomStep(p,r,10);assert.ok(r.room.temperature<t);const cold=r.room.temperature;
 r.devices.comp.on=false;r.devices.fan.on=false;r.devices.heat={...freshState(),on:true};r.manual["room:door"]=true;r.now+=10;roomStep(p,r,10);assert.ok(r.room.temperature>cold);assert.equal(r.room.door,true);
 const probe=p.nodes.find(n=>n.params.roomBinding==="room");near(r.values[probe.id+":value"],r.room.temperature);
});
test("panel collision detection respects rotated dimensions and allows mounting on DIN rails",()=>{
 const a={id:"a",nodeId:"n",x:0,y:0,width:60,height:20,rotation:90,kind:"device"},b={...a,id:"b",x:10,y:50};assert.deepEqual(physicalBounds(a),{x:0,y:0,width:20,height:60});
 const l={width:100,height:100,items:[a,b]};assert.equal(panelWarnings(l).issues.length,2);
 l.items=[a,{...b,kind:"rail"}];assert.equal(panelWarnings(l).issues.filter(x=>/Bertabrakan/.test(x.text)).length,0);
});
test("reports escape user-controlled text and preserve formulas as Excel strings",()=>{
 const p=coldRoomTemplate();p.name='<script>alert("x")</script>';p.nodes[0].label="=HYPERLINK(\"https://example.invalid\")";
 const r=stepCircuit(p,freshRuntime()),html=reportHTML(p,r,[]),xml=excelWorkbook(schedules(p,r));assert.ok(!html.includes("<script>"));assert.ok(html.includes("&lt;script&gt;"));assert.ok(xml.includes('ss:Type="String">=HYPERLINK'));assert.ok(!xml.includes("ss:Formula"));
});
