import test from "node:test";
import assert from "node:assert/strict";
import {blankProject,newNode,validateProject,pin,ports} from "../lib/circuit.ts";
import {SCHNEIDER_PRODUCTS,applyProduct,defaultProduct,productsFor,selectedProduct,productFieldLocked,productSettingRange,syncLinkedCoils} from "../lib/schneider-catalog.ts";
import {magneticThreshold,protectionStep} from "../lib/engine/protection.ts";
import {freshRuntime,stateOf} from "../lib/simulator.ts";

const project=(...nodes)=>({...blankProject(),nodes});
test("new target devices default to Schneider; existing manual data survives opening",()=>{
  for(const type of ["contactor1","contactor2","contactor3","contactor4","overload","breaker1","breaker2","breaker3","breaker4","mccb"]){
    const n=newNode(type,"power",100,100,"Q1");assert.equal(n.params.brand,"Schneider Electric");
  }
  const old=newNode("contactor3","power",100,100,"KM1");old.params={brand:"Other",model:"Existing custom",rating:17};
  const p=project(old);assert.deepEqual(validateProject(JSON.parse(JSON.stringify(p))).nodes[0].params,old.params);
});
test("all presets round-trip without changing symbol, ID, tag, description, pins or wires",()=>{
  assert.equal(new Set(SCHNEIDER_PRODUCTS.map(p=>p.id)).size,SCHNEIDER_PRODUCTS.length);
  for(const preset of SCHNEIDER_PRODUCTS){
    const n=newNode(preset.type,"power",100,100,"Q1"),other=newNode("terminal","power",500,100,"TB1"),before=structuredClone(n),p=project(n,other);
    p.wires=[{id:"wire",from:pin(n,ports(n)[0].name),to:pin(other,"1"),label:"1",color:"R",bends:[]}];const wires=structuredClone(p.wires);
    assert.equal(applyProduct(p,n.id,preset.id),true);
    for(const key of ["id","tag","label","x","y","rotation","type","sheet"])assert.equal(n[key],before[key]);
    assert.deepEqual(ports(n),ports(before));assert.deepEqual(p.wires,wires);
    const restored=validateProject(JSON.parse(JSON.stringify(p))).nodes[0];assert.equal(selectedProduct(restored)?.id,preset.id);
  }
});
test("LRD retains in-range setpoints, clamps out-of-range ones, and Custom is reversible",()=>{
  const n=newNode("overload","power",0,0,"OL1"),p=project(n);n.params.rating=7;
  applyProduct(p,n.id,"LRD12");assert.equal(n.params.rating,7);assert.deepEqual(productSettingRange(n,"rating"),[5.5,8]);
  assert.equal(productFieldLocked(n,"rating"),false);assert.equal(productFieldLocked(n,"minCurrent"),true);
  applyProduct(p,n.id,"LRD08");assert.equal(n.params.rating,4);assert.equal(n.params.maxCurrent,4);
  const values={...n.params};delete values.productProfile;applyProduct(p,n.id,"custom");assert.deepEqual(n.params,values);
  n.params.model="LRD-custom";n.params.rating=12;n.params.minCurrent=10;n.params.maxCurrent=15;
  assert.equal(productFieldLocked(n,"rating"),false);assert.equal(selectedProduct(n),undefined);
  applyProduct(p,n.id,"LRD14");assert.equal(n.params.rating,10);assert.equal(n.params.model,"LRD14");
});
test("LC1D changes synchronize only linked plain coils, preserving wiring and other tags",()=>{
  const n=newNode("contactor3","power",0,0,"KM1"),coil=newNode("coil","control",0,0,"KM1"),other=newNode("coil","control",200,0,"KM2"),p=project(n,coil,other);
  applyProduct(p,n.id,"LC1D25","M7");assert.equal(n.params.model,"LC1D25M7");assert.equal(coil.params.voltage,220);assert.equal(coil.params.va,7);assert.equal(other.params.voltage,230);
  applyProduct(p,n.id,"LC1D09","B7");assert.equal(n.params.rating,9);assert.equal(coil.params.voltage,24);assert.equal(coil.params.model,"LC1D09B7");
  coil.params.voltage=120;syncLinkedCoils(p,n);assert.equal(coil.params.voltage,24);
  applyProduct(p,n.id,"LC1D80","P7");assert.equal(coil.params.va,26);assert.equal(coil.params.voltage,230);
});
test("preset selection rejects incompatible pole counts without mutating the drawing",()=>{
  const n=newNode("breaker1","power",0,0,"Q1"),p=project(n),before=structuredClone(p);
  assert.equal(applyProduct(p,n.id,"A9F74316"),false);assert.deepEqual(p,before);
  assert.ok(productsFor(n).every(p=>p.type==="breaker1"));assert.equal(defaultProduct(n)?.id,"A9F74106");
});
test("MCCB thermal adjustment does not move its fixed magnetic threshold",()=>{
  const n=newNode("mccb","power",0,0,"Q1"),p=project(n);applyProduct(p,n.id,"LV510307");
  assert.equal(n.params.rating,100);assert.deepEqual(productSettingRange(n,"tripSetting"),[70,100]);
  n.params.tripSetting=70;assert.equal(magneticThreshold(n),800);n.params.tripSetting=100;assert.equal(magneticThreshold(n),800);
  const runtime=freshRuntime(),old=stateOf(runtime,n),below={...old,current:799};
  protectionStep(n,old,below,runtime,.000001);assert.equal(below.tripped,false);
  const at={...old,current:800};protectionStep(n,old,at,runtime,.000001);assert.equal(at.tripped,true);
});
test("MCB presets replace stale manual trip overrides and retain their own current curve",()=>{
  const n=newNode("breaker3","power",0,0,"Q1"),p=project(n);Object.assign(n.params,{tripSetting:100,magnetic:20,magneticAmps:800});
  applyProduct(p,n.id,"A9F74316");assert.equal(n.params.rating,16);assert.equal(n.params.breakingKA,6);
  assert.equal(n.params.tripSetting,undefined);assert.equal(n.params.magneticAmps,undefined);assert.equal(magneticThreshold(n),160);
});
