import test from "node:test";
import assert from "node:assert/strict";
import {newNode,nodeSize,SNAP} from "../lib/circuit.ts";
import {alignNode,componentOverlap,freeNodePosition,nodeBounds,overlaps,placementConflict} from "../lib/diagram-layout.ts";

test("component edges may touch while overlapping bodies are rejected",()=>{
  const a=newNode("breaker3","power",200,200,"Q1"),b=newNode("breaker3","power",320,200,"Q2");
  assert.equal(componentOverlap(a,[a,b]),undefined);
  const hit=n=>{const r=nodeBounds(n);return {x:r.x-1,y:r.y-1,w:r.w+2,h:r.h+2};};
  assert.equal(overlaps(hit(a),hit(b)),true,"the 1-point hitbox margins may overlap");
  assert.equal(componentOverlap({...b,x:319},[a,b])?.id,a.id,"even one unit of body overlap is blocked");
  assert.equal(componentOverlap({...b,x:200,sheet:"control"},[a,b]),undefined);
});

test("dragging onto a neighbour keeps the last valid position; an adjacent snapped position is accepted",()=>{
  const a=newNode("breaker3","power",200,200,"Q1"),b=newNode("breaker3","power",500,200,"Q2"),nodes=[a,b];
  assert.deepEqual(alignNode(b,239,199,nodes),{x:500,y:200,blocked:true});
  const adjacent=alignNode(b,321,201,nodes);assert.equal(adjacent.x,320);assert.equal(adjacent.y,200);assert.ok(!adjacent.blocked);
  assert.equal(b.x,500,"checking a move does not mutate its source");
});

test("rotation, newly added components and changes in device size all use the same collision guard",()=>{
  const source=newNode("source3","power",300,300,"G1"),neighbour=newNode("breaker3","power",340,180,"Q1");
  assert.equal(componentOverlap(source,[source,neighbour]),undefined);
  assert.equal(placementConflict([source,neighbour],[{...source,rotation:90},neighbour])?.node.id,source.id);
  const added=newNode("lamp","power",320,340,"H1");
  assert.equal(placementConflict([source],[source,added])?.node.id,added.id);
  const motor=newNode("motor3","power",400,400,"M1"),side=newNode("breaker1","power",520,400,"Q2");
  assert.equal(nodeSize(motor).width,120);
  const bigger={...motor,params:{...motor.params,neutralRequired:true}};
  assert.equal(placementConflict([motor,side],[bigger,side])?.other.id,side.id);
});

test("large and rotated copies find free snapped positions without moving existing devices",()=>{
  for(const rotation of [0,90,180,270]){
    const original=newNode("etc974","control",400,400,"TC1");original.rotation=rotation;
    const neighbour=newNode("controller","control",900,400,"TC2");
    const nodes=[original,neighbour],before=JSON.stringify(nodes),copy={...structuredClone(original),id:"copy",x:560,y:440};
    const position=freeNodePosition(copy,nodes);assert.ok(position);assert.equal(position.x%SNAP,0);assert.equal(position.y%SNAP,0);
    assert.equal(componentOverlap({...copy,...position},nodes),undefined);assert.equal(JSON.stringify(nodes),before);
  }
});

test("wire taps and notes are not physical obstacles, and existing drawings remain editable",()=>{
  const a=newNode("breaker3","power",200,200,"Q1"),tap=newNode("tap","power",220,200,"J1"),note=newNode("text","power",200,200,"NOTE");
  assert.equal(componentOverlap(a,[a,tap,note]),undefined);assert.equal(componentOverlap(tap,[a,tap]),undefined);
  const b=newNode("breaker3","power",240,200,"Q2"),before=[a,b];
  assert.equal(placementConflict(before,[{...a,label:"Label baru"},b]),undefined,"editing text does not reposition an existing drawing");
  assert.equal(placementConflict(before,[a,{...b,x:400}]),undefined,"an old overlap can be moved to a clear position");
  const boundary=freeNodePosition({...a,id:"copy",x:10040,y:10040},[a]);
  assert.ok(boundary.x<=10000&&boundary.y<=10000);assert.equal(boundary.x%SNAP,0);assert.equal(boundary.y%SNAP,0);
});
