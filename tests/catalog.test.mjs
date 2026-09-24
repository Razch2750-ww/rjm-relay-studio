import test from "node:test";
import assert from "node:assert/strict";
import { CATALOG,blankProject,newNode,pin,ports,validateProject,controllerPins,defaultCable } from "../lib/circuit.ts";
import { freshRuntime,stepCircuit,advanceCircuit,interact } from "../lib/simulator.ts";
import { sizeProjectCables } from "../lib/cable-sizing.ts";
import { jagoTemplate } from "../lib/templates.ts";

const near=(a,b)=>assert.ok(Math.abs(a-b)<1e-5,`${a} ≠ ${b}`);
function fixture(spec){
  const p=blankProject("Catalog verification"),nodes={};
  for(const [id,type,params={}] of spec){const n={...newNode(type,"power",20,20,id),id};n.params={...n.params,...params};nodes[id]=n;p.nodes.push(n);}
  const w=(a,ap,b,bp)=>{const id="w"+p.wires.length;p.wires.push({id,from:pin(a,ap),to:pin(b,bp),label:id,color:"auto",bends:[]});return id;};
  const run=()=>stepCircuit(validateProject(p),freshRuntime());return {p,nodes,w,run};
}

test("all reference families have distinct usable terminal topologies",()=>{
  for(const id of ["motor1","motor3","motorStarDelta","motorTwoSpeed","motorDahlander","motorDC","rcd4","rcbo4","switchFuse4","isolator4","thermalBreaker4","magneticBreaker4","contactorNC4","pushNOnc","limitChangeover","rotaryNOnc","keyChangeover","auxOnMixed","auxOffChangeover","coilRelay","tonoff","flashingLamp","bell","siren","diode","connectionElbow","connectionCross","battery","generator","converter3","etc974"])assert.ok(CATALOG[id],id);
  for(const n of Object.keys(CATALOG).map(t=>newNode(t,"power",0,0,t))){const ps=ports(n);assert.equal(new Set(ps.map(p=>p.name)).size,ps.length);assert.equal(new Set(ps.map(p=>p.x+","+p.y)).size,ps.length);for(const p of ps){assert.equal(p.x%20,0,n.type);assert.equal(p.y%20,0,n.type);}}
  assert.deepEqual(ports(newNode("tonoff","control",0,0,"KT1")).map(p=>p.name),["A1","A2"]);
});

test("push NO+NC switches both blocks while held and releases",()=>{
  const f=fixture([["g","source1"],["b","pushNOnc"],["no","lamp"],["nc","lamp"]]);
  for(const [t,out,l] of [["13","14","no"],["21","22","nc"]]){f.w("g","L","b",t);f.w("b",out,l,"X1");f.w(l,"X2","g","N");}
  let r=f.run();assert.equal(r.devices.no.on,false);assert.equal(r.devices.nc.on,true);
  r=interact(f.p,r,"b",true);assert.equal(r.devices.no.on,true);assert.equal(r.devices.nc.on,false);
  r=interact(f.p,r,"b",false);assert.equal(r.devices.no.on,false);assert.equal(r.devices.nc.on,true);
});

test("maintained NC and keyed changeover operate the actual circuits",()=>{
  for(const type of ["switchNC","keyChangeover","limitChangeover","rotaryChangeover"]){
    const f=fixture([["g","source1"],["s",type],["l","lamp"]]);const c=type==="switchNC"?["1","2"]:["11","12"];
    f.w("g","L","s",c[0]);f.w("s",c[1],"l","X1");f.w("l","X2","g","N");let r=f.run();assert.equal(r.devices.l.on,true,type);r=interact(f.p,r,"s");assert.equal(r.devices.l.on,false,type);
  }
});

test("normally closed power contactor opens when its matching coil energizes",()=>{
  const f=fixture([["g","source1"],["sw","switch"],["coil","coil"],["k","contactorNC1"],["l","lamp"]]);f.nodes.k.tag="coil";
  f.w("g","L","sw","1");f.w("sw","2","coil","A1");f.w("coil","A2","g","N");f.w("g","L","k","1");f.w("k","2","l","X1");f.w("l","X2","g","N");
  let r=f.run();assert.equal(r.devices.l.on,true);r=interact(f.p,r,"sw");assert.equal(r.devices.l.on,false);assert.equal(r.devices.k.on,false);
});

function timed(type,contact="no"){
  const f=fixture([["g","source1"],["sw","switch"],["coil",type,{delay:.3,offDelay:.4}],["c",contact,{delay:.3}],["l","lamp"]]);f.nodes.c.tag="coil";
  f.w("g","L","sw","1");f.w("sw","2","coil","A1");f.w("coil","A2","g","N");f.w("g","L","c","1");f.w("c","2","l","X1");f.w("l","X2","g","N");return f;
}

test("ON and OFF delayed contacts honor the independent delay",()=>{
  for(const [contact,onDelay] of [["auxOnNO",true],["auxOffNO",false]]){
    const f=timed("coil",contact);let r=interact(f.p,f.run(),"sw");assert.equal(r.devices.l.on,!onDelay);r=advanceCircuit(f.p,r,.5);assert.equal(r.devices.l.on,true);
    r=interact(f.p,r,"sw");assert.equal(r.devices.l.on,!onDelay);r=advanceCircuit(f.p,r,.5);assert.equal(r.devices.l.on,false);
  }
});

test("combined delay coil waits on pickup and holds through release delay",()=>{
  const f=timed("tonoff");let r=interact(f.p,f.run(),"sw");assert.equal(r.devices.l.on,false);r=advanceCircuit(f.p,r,.5);assert.equal(r.devices.l.on,true);
  r=interact(f.p,r,"sw");assert.equal(r.devices.l.on,true);r=advanceCircuit(f.p,r,.1);r=interact(f.p,r,"sw");assert.equal(r.devices.l.on,true);r=interact(f.p,r,"sw");r=advanceCircuit(f.p,r,.6);assert.equal(r.devices.l.on,false);
});

test("RCBO residual trip works without relying on load current",()=>{
  const f=fixture([["g","source1"],["q","rcbo2",{leakageMA:40}],["l","lamp"]]);f.w("g","L","q","1");f.w("g","N","q","3");f.w("q","2","l","X1");f.w("q","4","l","X2");const r=f.run();assert.equal(r.devices.q.tripped,true);assert.equal(r.devices.l.on,false);
});

test("magnetic-only protection ignores thermal overload but trips on magnetic current",()=>{
  const f=fixture([["g","source1"],["q","magneticBreaker1",{rating:1,magnetic:10}],["l","heater1",{watts:460}]]);f.w("g","L","q","1");f.w("q","2","l","L");f.w("l","N","g","N");
  let r=advanceCircuit(f.p,f.run(),60);assert.equal(r.devices.q.tripped,false);r=stepCircuit(f.p,{...r,values:{"l:watts":4600}},.1);assert.equal(r.devices.q.tripped,true);
});

test("isolator opens all poles and does not simulate overload protection",()=>{
  const f=fixture([["g","source1"],["q","isolator2",{rating:1}],["l","heater1",{watts:460}]]);f.w("g","L","q","1");f.w("g","N","q","3");f.w("q","2","l","L");f.w("q","4","l","N");let r=advanceCircuit(f.p,f.run(),60);assert.equal(r.devices.l.on,true);assert.equal(r.devices.q.tripped,false);r=interact(f.p,r,"q");assert.equal(r.devices.l.on,false);
});

test("ideal DC diode conducts forward and blocks reversed polarity",()=>{
  for(const forward of [true,false]){const f=fixture([["g","battery"],["d","diode"],["m","motorDC",{current:2}]]);f.w("g","+","d",forward?"A":"K");f.w("d",forward?"K":"A","m","+");f.w("m","-","g","-");const r=f.run();assert.equal(r.halted,false);assert.equal(r.devices.m.on,forward);near(r.devices.m.current,forward?2:0);}
});

test("AC/DC supplies produce DC only with valid input, reflect power, and size both sides",()=>{
  for(const phases of [1,3]){const f=fixture([["g",phases===1?"source1":"source3"],["ps","converter"+phases],["m","motorDC",{current:2}]]);
    for(const t of phases===1?["L","N"]:["L1","L2","L3"])f.w("g",t,"ps",t);
    const out=f.w("ps","+","m","+");f.w("ps","-","m","-");let r=f.run();assert.equal(r.halted,false,r.faults.join());near(r.devices.m.voltage,24);near(r.devices.m.current,2);near(r.phaseCurrent.R,48/(phases===1?230:400*Math.sqrt(3)));
    for(const w of f.p.wires)w.cable={...defaultCable,length:1,sizing:"auto"};const sized=sizeProjectCables(f.p);near(sized.recommendations.get(out).current,2);assert.ok(sized.recommendations.get(out).section);
    r=interact(f.p,r,"g");assert.equal(r.devices.m.on,false);assert.equal(r.devices.ps.on,false);
  }
});

function winding(type,which="first"){
  const f=fixture([["g","source3"],["m",type,{current:9,lowCurrent:4,highCurrent:7}]]);
  const pins=type==="motorStarDelta"?["U1","V1","W1"]:which==="first"?["1U","1V","1W"]:["2U","2V","2W"];
  ["L1","L2","L3"].forEach((t,i)=>f.w("g",t,"m",pins[i]));return f;
}

test("six-lead star motor requires star links, with real jumper currents",()=>{
  const f=winding("motorStarDelta");assert.equal(f.run().devices.m.on,false);
  const a=f.w("m","U2","m","V2"),b=f.w("m","V2","m","W2");const r=f.run();assert.equal(r.devices.m.stage,"star");near(r.devices.m.current,3);near(r.wireCurrent[a],3);near(r.wireCurrent[b],3);near(r.phaseCurrent.R,3);
  for(const w of f.p.wires)w.cable={...defaultCable,length:1,sizing:"auto"};const sized=sizeProjectCables(f.p);for(const id of [a,b]){near(sized.recommendations.get(id).current,9);assert.ok(sized.recommendations.get(id).section);}
});

test("delta branch currents equal line current divided by sqrt(3)",()=>{
  const f=winding("motorStarDelta");const jumpers=[["U1","W2"],["V1","U2"],["W1","V2"]].map(([a,b])=>f.w("m",a,"m",b));const r=f.run();assert.equal(r.devices.m.stage,"delta");near(r.phaseCurrent.R,9);for(const id of jumpers)near(r.wireCurrent[id],9/Math.sqrt(3));
});

test("two-speed motor selects nameplate current and rejects simultaneous speeds",()=>{
  const f=winding("motorTwoSpeed");let r=f.run();assert.equal(r.devices.m.stage,"low-speed");near(r.devices.m.current,4);
  ["L1","L2","L3"].forEach((t,i)=>f.w("g",t,"m",["2U","2V","2W"][i]));r=f.run();assert.equal(r.devices.m.on,false);assert.equal(r.devices.m.stage,"speed-conflict");
  const high=winding("motorTwoSpeed","second").run();near(high.devices.m.current,7);
});

test("Dahlander high speed needs its low-speed terminals joined",()=>{
  const f=winding("motorDahlander","second");assert.equal(f.run().devices.m.on,false);f.w("m","1U","m","1V");f.w("m","1V","m","1W");const r=f.run();assert.equal(r.devices.m.on,true);assert.equal(r.devices.m.stage,"high-speed");near(r.devices.m.current,7);
});

test("detailed ETC-974 preserves supply, sensors, relay common and full defrost sequence",()=>{
  const p=jagoTemplate(),ctl=p.nodes.find(n=>n.id==="ctl");ctl.type="etc974";
  assert.deepEqual(ports(ctl).map(p=>p.name),Array.from({length:10},(_,i)=>String(i+1)));
  assert.deepEqual(controllerPins(ctl),{common:"1",comp:"4",fan:"5",defCommon:"1",defrost:"2",defNC:"3",line:"6",neutral:"7",evap:"8",sensorCommon:"9",room:"10"});
  let r=stepCircuit(validateProject(p),freshRuntime(),11);assert.equal(r.devices.ctl.on,true);assert.equal(r.devices.cdu.on,true);assert.equal(r.devices.fan.on,true);
  r=interact(p,r,"ctl");assert.equal(r.devices.ctl.defrost,true);assert.equal(r.devices.heater.on,true);assert.equal(r.devices.cdu.on,false);assert.equal(r.devices.fan.on,false);
  r=stepCircuit(p,r,60);assert.equal(r.devices.ctl.stage,"drip");assert.equal(r.devices.heater.on,false);
  const noCommon=structuredClone(p);noCommon.wires=noCommon.wires.filter(w=>w.to!=="ctl:1"&&w.from!=="ctl:1");r=stepCircuit(noCommon,freshRuntime(),11);assert.equal(r.devices.ctl.on,true);assert.equal(r.devices.cdu.on,false);assert.equal(r.devices.fan.on,false);
  const brokenProbe=structuredClone(p);brokenProbe.wires=brokenProbe.wires.filter(w=>w.to!=="ctl:10"&&w.from!=="ctl:10");r=stepCircuit(brokenProbe,freshRuntime(),11);assert.equal(r.devices.ctl.stage,"sensor-fault");
});
