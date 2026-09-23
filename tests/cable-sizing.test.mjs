import test from "node:test";
import assert from "node:assert/strict";
import {blankProject,newNode,defaultCable,validateProject,pin} from "../lib/circuit.ts";
import {sizeProjectCables,componentAmperage} from "../lib/cable-sizing.ts";
import {freshRuntime,stepCircuit} from "../lib/simulator.ts";
import {schedules} from "../lib/reports.ts";

function fixture({watts=2300,rating=16,length=2,load="heater1"}={}){
  const p=blankProject(),source={...newNode("source1","power",60,60,"G"),id:"g"},breaker={...newNode("breaker1","power",80,260,"QF"),id:"q"},heater={...newNode(load,"power",80,520,"H"),id:"h"};
  Object.assign(breaker.params,{rating});Object.assign(heater.params,{watts,voltage:230});p.nodes=[source,breaker,heater];
  const wire=(from,to)=>{const w={id:"w"+p.wires.length,from,to,label:String(p.wires.length+1),color:"auto",bends:[],cable:{...defaultCable,sizing:"auto",length}};p.wires.push(w);return w;};
  wire("g:L","q:1");wire("q:2","h:L");wire("h:N","g:N");return {p,heater,breaker,wire};
}
test("automatic sections use the branch breaker and corrected ampacity, including the neutral",()=>{
  const {p}=fixture();const before=JSON.stringify(p),result=sizeProjectCables(p);
  for(const w of result.project.wires){assert.equal(w.cable.section,2.5);assert.equal(result.recommendations.get(w.id).current,10);assert.equal(result.recommendations.get(w.id).protection,16);}
  assert.equal(JSON.stringify(p),before);
  for(const w of p.wires)w.cable.ambient=50;
  for(const w of sizeProjectCables(p).project.wires)assert.equal(w.cable.section,4);
});
test("raising load and breaker recomputes automatic cables but never a manual override",()=>{
  const f=fixture();f.p.wires[1].cable.sizing="manual";f.p.wires[1].cable.section=1.5;
  f.heater.params.watts=6900;f.breaker.params.rating=32;
  const result=sizeProjectCables(f.p);assert.equal(result.project.wires[1].cable.section,1.5);assert.equal(result.project.wires[0].cable.section,6);
  assert.match(result.recommendations.get("w1").messages.join(),/di bawah kebutuhan/);
});
test("all feeder and return lengths participate in the voltage-drop budget",()=>{
  const f=fixture({length:100});const result=sizeProjectCables(f.p);
  for(const w of result.project.wires){assert.ok(w.cable.section>=10);assert.ok(result.recommendations.get(w.id).dropPercent<=3);}
  f.p.calculation.upstreamDrop=4;
  assert.match(sizeProjectCables(f.p).recommendations.get("w1").messages.join(),/Drop total jalur/);
});
test("downstream branch currents sum on the common feeder; a parallel pair is not assumed to share equally",()=>{
  const f=fixture({watts:1150,rating:25});const h2={...newNode("heater1","power",340,520,"H2"),id:"h2"};h2.params.watts=1150;f.p.nodes.push(h2);f.wire("q:2","h2:L");f.wire("h2:N","g:N");
  let result=sizeProjectCables(f.p);assert.equal(result.recommendations.get("w0").current,10);assert.equal(result.recommendations.get("w1").current,5);
  const parallel=f.wire("q:2","h:L");result=sizeProjectCables(f.p);assert.ok(result.recommendations.get(parallel.id).current>=5);assert.ok(result.recommendations.get("w1").current>=5);assert.match(result.recommendations.get(parallel.id).messages.join(),/paralel/);
});
test("nameplate current, motor count and shaft HP work without using starting current",()=>{
  const f=fixture({load:"motor1",rating:25});Object.assign(f.heater.params,{current:8,fanCount:2,lra:90});let result=sizeProjectCables(f.p);assert.equal(result.recommendations.get("w1").current,16);assert.match(componentAmperage(f.heater),/16 A/);
  Object.assign(f.heater.params,{current:0,fanCount:1,inputMode:"quick",hp:2,hpBasis:"shaft"});result=sizeProjectCables(f.p);assert.ok(result.recommendations.get("w1").current>9);assert.ok(result.recommendations.get("w1").estimated);
  f.heater.params.hpBasis="cooling";assert.equal(sizeProjectCables(f.p).recommendations.get("w1").section,null);
});
test("incomplete wiring, missing load data and unsupported tables never produce a recommendation",()=>{
  for(const change of [f=>f.p.wires.pop(),f=>f.heater.params.watts=0,f=>f.p.wires[1].cable.material="Al",f=>f.p.wires[1].cable.ampacity=25]){
    const f=fixture();change(f);const result=sizeProjectCables(f.p);assert.equal(result.recommendations.get("w1").section,null);assert.equal(result.project.wires[1].cable.section,2.5);
  }
});
test("conflicting supply pins block sizing instead of concealing a short",()=>{
  const f=fixture();f.wire("g:L","g:N");const result=sizeProjectCables(f.p);assert.equal(result.recommendations.get("w1").section,null);assert.match(result.recommendations.get("w1").messages.join(),/sumber/);
});
test("automatic/manual sections survive JSON and the same selected size reaches engine and schedule",()=>{
  const f=fixture({rating:32,watts:4600});const result=sizeProjectCables(f.p),p=validateProject(JSON.parse(JSON.stringify(result.project))),r=stepCircuit(p,freshRuntime());
  assert.equal(p.wires[1].cable.section,6);assert.equal(p.wires[1].cable.sizing,"auto");assert.ok(r.cables.w1.capacity>=32);assert.match(String(schedules(p,r)[1].rows[1][3]),/6 mm²/);
});
test("contact ratings and overload settings are labeled without fabricating missing source ratings",()=>{
  const q=newNode("mccb","power",0,0,"Q");Object.assign(q.params,{rating:100,tripSetting:63});assert.match(componentAmperage(q),/63 A/);
  assert.equal(componentAmperage(newNode("source3","power",0,0,"G")),"Rating: — A");
});

test("PE follows associated copper phase sizing with a conservative separate-conductor minimum",()=>{
  const f=fixture({rating:32,watts:4600});const pe=f.wire("h:PE","g:PE"),r=sizeProjectCables(f.p);
  assert.equal(r.project.wires.find(w=>w.id===pe.id).cable.section,6);assert.equal(r.recommendations.get(pe.id).current,0);
  assert.match(r.recommendations.get(pe.id).messages.join(),/gangguan tanah/);
});
