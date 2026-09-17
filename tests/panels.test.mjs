import test from "node:test";
import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import { createHash } from "node:crypto";
import { CATALOG, blankProject, newNode, validateProject } from "../lib/circuit.ts";
import { PROJECT_PRESETS, projectReferences } from "../lib/project-presets.ts";
import { dsvTemplate, lionColdTemplate, lionPumpTemplate, lionSdpTemplate } from "../lib/panel-templates.ts";
import { freshRuntime, interact, stepCircuit } from "../lib/simulator.ts";
import { loadProjects, saveProject } from "../db/project-store.ts";

const live=create=>{const p=validateProject(create());let r=stepCircuit(p,freshRuntime());r=stepCircuit(p,r,11);assert.equal(r.halted,false,r.faults.join());return {p,r};};
const modes=(p,r,manual)=>stepCircuit(p,{...r,manual:{...r.manual,...manual}},0);
const off=(r,...ids)=>ids.forEach(id=>assert.equal(r.devices[id].on,false,id));
const on=(r,...ids)=>ids.forEach(id=>assert.equal(r.devices[id].on,true,id));

test("every preset round-trips, has existing PDF links and isolated document identities",()=>{
  for(const preset of PROJECT_PRESETS){
    const p=preset.create();assert.deepEqual(validateProject(JSON.parse(JSON.stringify(p))),p);assert.notEqual(p.id,preset.create().id);
    for(const ref of projectReferences(p))assert.ok(existsSync(new URL("../public/reference/"+ref.file,import.meta.url)),ref.file);
    const r=stepCircuit(p,freshRuntime());assert.equal(r.halted,false,preset.id+": "+r.faults.join());
  }
  assert.deepEqual(projectReferences(blankProject()),[]);
  assert.equal(CATALOG.xr70.kind,"controller");
});

test("source PDFs retain their exact uploaded bytes",()=>{
  // These SHA-256 values are recorded from the uploaded source files.
  const expected=JSON.parse(readFileSync(new URL("../docs/source-pdfs.json",import.meta.url),"utf8"));
  for(const file of expected){const bytes=readFileSync(new URL("../public/reference/"+file.file,import.meta.url));assert.equal(createHash("sha256").update(bytes).digest("hex"),file.sha256);}
});

test("SDP preserves twelve branch ratings and the S-phase waterloop take-offs",()=>{
  const {p,r}=live(lionSdpTemplate);
  const ratings=Object.fromEntries(p.nodes.filter(n=>CATALOG[n.type].kind==="breaker").map(n=>[n.tag,n.params.rating]));
  assert.deepEqual(ratings,{MC1:200,M1:40,M2:40,M3:32,M4:25,M5:16,M6:16,M7:16,M8:16,M9:16,M10:16,M11:16,M12:10});
  for(let i=0;i<6;i++){on(r,"showcase"+i,"waterloop"+i);assert.equal(r.energized["waterloop"+i+":L"],"S");}
  const trip=interact(p,r,"showcaseBreaker2");off(trip,"showcase2","waterloop2");on(trip,"showcase1","waterloop1","sydney1");
  const neutral=structuredClone(p);neutral.wires=neutral.wires.filter(w=>w.from!=="showcase0:N");off(stepCircuit(neutral,r),"showcase0");
  off(interact(p,r,"main"),"showcase0","waterloop0","sydney1","heater");
});

test("Lion pump automatic transfer breaks before the delayed second pump starts",()=>{
  const {p,r}=live(lionPumpTemplate);on(r,"fan1","fan2","fan3","pump1");off(r,"pump2");
  // Crossing a timer boundary on a large timestep must not charge a newly powered TDR retroactively.
  let x=stepCircuit(p,r,49);assert.equal(x.devices.dutyTimer.stage,"NO");off(x,"pump1","pump2");
  x=stepCircuit(p,x,1.9);off(x,"pump1","pump2");x=stepCircuit(p,x,.1);on(x,"pump2");off(x,"pump1");
  x=stepCircuit(p,x,58);off(x,"pump1","pump2");x=stepCircuit(p,x,2);on(x,"pump1");off(x,"pump2");
});

test("Lion pump manual selector, OFF and KP1 match the drawn control paths",()=>{
  const {p,r}=live(lionPumpTemplate);let x=modes(p,r,{mode:"MAN",pumpSelect:"2"});on(x,"pump2");off(x,"pump1");
  x=interact(p,x,"kp1");off(x,"pump1","pump2");
  x=modes(p,x,{mode:"AUTO"});x=stepCircuit(p,x,2);on(x,"pump1"); // KP1 is bypassed by AUTO in the supplied drawing.
  x=modes(p,x,{mode:"OFF"});off(x,"pump1","pump2");on(x,"fan1","fan2","fan3");
  x=interact(p,x,"fan2-switch");off(x,"fan2");on(x,"fan1","fan3");
  const selector=p.nodes.find(n=>n.id==="pumpSelect");assert.equal(selector.type,"selector12");
  x=modes(p,x,{pumpSelect:"1"});x=interact(p,x,"pumpSelect");assert.equal(x.manual.pumpSelect,"2");
  x=interact(p,x,"pumpSelect");assert.equal(x.manual.pumpSelect,"OFF");
});

test("Lion pump overloads are independent and F5 trips pump 2 only",()=>{
  const {p,r}=live(lionPumpTemplate);let x=modes(p,r,{mode:"MAN",pumpSelect:"2"});x=interact(p,x,"f-pump2");
  off(x,"pump2");on(x,"pump2-fault","fan1","fan2","fan3");assert.equal(p.nodes.find(n=>n.id==="f-pump2").tag,"F5");
  x=interact(p,x,"f-fan1");off(x,"fan1");on(x,"fan1-fault","fan2");
  x=interact(p,x,"main");off(x,"fan2","fan3","pump1","pump2");
});

test("both Lion refrigeration templates are R-N loads and keep the missing COM6 visible",()=>{
  for(const combined of [true,false]){
    const {p,r}=live(()=>lionColdTemplate(combined));const units=combined?["fz","ch"]:["ch"];
    for(const id of units){
      on(r,id+"-comp",id+"-fan");off(r,id+"-heat");assert.ok(Math.abs(r.devices[id+"-comp"].voltage-380/Math.sqrt(3))<1e-8);
      assert.equal(p.nodes.find(n=>n.id===id+"-ctl").type,"xr70");
      let x=interact(p,r,id+"-ctl");assert.equal(x.devices[id+"-ctl"].defrost,true);off(x,id+"-heat",id+"-comp",id+"-fan");
      assert.equal(x.energized[id+"-ctl:6"],undefined);
      // Explicit user wiring is required to supply the dry contact; this is a test circuit, not an automatic correction.
      const repaired=structuredClone(p);repaired.wires.push({id:"testDefCommon",from:id+"-fanNC:2",to:id+"-ctl:6",label:"test only",color:"signal",bends:[]});
      x=stepCircuit(repaired,x);on(x,id+"-heat",id+"-defOn");off(x,id+"-comp",id+"-fan");
      x=interact(repaired,x,"f-"+id+"-fan");off(x,id+"-heat");on(x,id+"-fanFault");
    }
  }
});

test("Lion units have independent faults, switches, sensors and normalized tags",()=>{
  const {p,r}=live(()=>lionColdTemplate(true));let x=interact(p,r,"f-fz-fan");off(x,"fz-comp","fz-fan");on(x,"fz-fanFault","ch-comp","ch-fan");
  x=interact(p,r,"fz-hlp");off(x,"fz-comp","fz-fan");on(x,"fz-hlpFault","ch-comp");
  x=interact(p,r,"ch-switch");off(x,"ch-comp","ch-fan");on(x,"fz-comp");
  x=modes(p,r,{"fz-roomProbe:fault":true});assert.equal(x.devices["fz-ctl"].stage,"sensor-fault");off(x,"fz-comp");on(x,"ch-comp");
  const ch=lionColdTemplate(false);assert.equal(ch.nodes.find(n=>n.id==="k-ch-heat").tag,"K3");assert.equal(ch.nodes.find(n=>n.id==="k-ch-fan").tag,"K2");
});

test("DSV automatic alternation, manual bypass and emergency operate both units correctly",()=>{
  const {p,r}=live(dsvTemplate);on(r,"u1-comp","u1-fan");off(r,"u2-comp","u2-fan");
  let x=stepCircuit(p,r,49);x=stepCircuit(p,x,11);on(x,"u2-comp","u2-fan");off(x,"u1-comp","u1-fan");
  x=modes(p,r,{"u1-selector":"MAN","u2-selector":"MAN"});x=stepCircuit(p,x,11);on(x,"u1-comp","u2-comp");
  x=interact(p,x,"emergency");off(x,"u1-comp","u2-comp","u1-fan","u2-fan","u1-heat","u2-heat");
  x=modes(p,r,{"u1-selector":"OFF","u2-selector":"OFF"});off(x,"u1-comp","u2-comp");
});

test("DSV defrost and shared-common fan overload affect only their own machine",()=>{
  const {p,r}=live(dsvTemplate);let x=modes(p,r,{"u1-selector":"MAN","u2-selector":"MAN"});x=stepCircuit(p,x,11);
  x=interact(p,x,"u1-ctl");on(x,"u1-heat","u1-defOn","u2-comp");off(x,"u1-comp","u1-fan");
  x=interact(p,x,"f-u1-fan");off(x,"u1-heat","u1-comp","u1-fan");on(x,"u1-fanFault","u2-comp");
  x=interact(p,x,"u2-hlp");off(x,"u2-comp","u2-fan");on(x,"u2-hlpFault");
});

test("every panel with a PFR drops controlled loads on loss of any phase",()=>{
  for(const create of [lionPumpTemplate,()=>lionColdTemplate(true),()=>lionColdTemplate(false),dsvTemplate])for(const phase of ["R","S","T"]){
    const {p,r}=live(create),x=modes(p,r,{"supply:phase":phase});assert.equal(x.devices.pfr.on,false);
    for(const n of p.nodes.filter(n=>["motor","heater"].includes(CATALOG[n.type].kind)&&n.id!=="vent"))off(x,n.id);
  }
});

test("cyclic timer keeps drawing coil power during NC and restarts at NC after supply loss",()=>{
  const {p,r}=live(dsvTemplate);assert.equal(r.devices.dutyTimer.stage,"NC");assert.ok(r.wireCurrent[p.wires.find(w=>w.to==="dutyTimer:A1").id]>0);
  let x=stepCircuit(p,r,49);assert.equal(x.devices.dutyTimer.stage,"NO");
  x=interact(p,x,"emergency");assert.equal(x.devices.dutyTimer.stage,"off");x=interact(p,x,"emergency");assert.equal(x.devices.dutyTimer.stage,"NC");assert.equal(x.devices.dutyTimer.elapsed,0);
});

test("standalone memory store keeps snapshots isolated and detects stale revisions",async()=>{
  const owner=crypto.randomUUID(),other=crypto.randomUUID(),p=blankProject();
  await saveProject({},owner,p,0,false);p.name="mutated outside store";
  const items=await loadProjects({},owner);assert.notEqual(items[0].document.name,p.name);items[0].document.name="mutated read";
  assert.notEqual((await loadProjects({},owner))[0].document.name,"mutated read");assert.deepEqual(await loadProjects({},other),[]);
  const concurrent=await Promise.all([saveProject({},owner,p,1,false),saveProject({},owner,p,1,true)]);assert.equal(concurrent.filter(r=>r.ok).length,1);
  assert.equal((await saveProject({},other,p,4,false)).ok,false);
});
