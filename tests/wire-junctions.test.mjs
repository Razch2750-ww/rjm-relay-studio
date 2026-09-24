import test from "node:test";
import assert from "node:assert/strict";
import {CATALOG,SNAP,PIN_PITCH,blankProject,newNode,nodeSize,pin,ports,portPosition,defaultCable,validateProject,normalizeProject} from "../lib/circuit.ts";
import {insertWireTap,crossingPaths,pickWirePoint} from "../lib/wire-junctions.ts";
import {wireNets,wirePhases} from "../lib/wire-colors.ts";
import {routingContext} from "../lib/wire-routing.ts";
import {alignNode,layoutDiagram,nodeBounds} from "../lib/diagram-layout.ts";
import {freshRuntime,stepCircuit,interact} from "../lib/simulator.ts";

const wire=(id,a,ap,b,bp)=>({id,from:pin(a,ap),to:pin(b,bp),label:id,color:"auto",bends:[],cable:{...defaultCable,length:10,resistance:.02,sizing:"manual"}});
const close=(a,b)=>assert.ok(Math.abs(a-b)<1e-6,`${a} ≈ ${b}`);

test("all library terminals use one pitch and stay on the same grid at every rotation",()=>{
  for(const type of Object.keys(CATALOG)){
    const n=newNode(type,"power",393,411,"TEST");
    for(const y of new Set(ports(n).map(p=>p.y))){const row=ports(n).filter(p=>p.y===y).sort((a,b)=>a.x-b.x);for(let i=1;i<row.length;i++)close(row[i].x-row[i-1].x,PIN_PITCH);}
    for(const rotation of [0,90,180,270]){n.rotation=rotation;for(const p of ports(n)){const world=portPosition(n,p.name);close(world.x/SNAP,Math.round(world.x/SNAP));close(world.y/SNAP,Math.round(world.y/SNAP));}}
  }
  const a=newNode("source3","power",400,400,"G"),b=newNode("breaker3","power",440,800,"Q");b.rotation=90;
  const aligned=alignNode(b,443,793,[a,b]);assert.equal(aligned.x%SNAP,0);assert.equal(aligned.y%SNAP,0);
});

test("a tap preserves cable length, series resistance and live continuity; a new branch takes supply",()=>{
  const p=blankProject(),g=newNode("source1","power",100,100,"G"),lamp=newNode("lamp","power",400,500,"H1"),branch=newNode("lamp","power",700,500,"H2");
  p.nodes=[g,lamp,branch];p.wires=[wire("supply",g,"L",lamp,"X1"),wire("neutral",lamp,"X2",g,"N"),wire("branch-return",branch,"X2",g,"N")];
  const points=[portPosition(g,"L"),{x:120,y:400},{x:460,y:400},portPosition(lamp,"X1")];
  const before=stepCircuit(p,freshRuntime());assert.equal(before.devices[lamp.id].on,true);assert.equal(before.devices[branch.id].on,false);
  const target=insertWireTap(p,"supply",points,{x:247,y:403});assert.ok(target);const halves=p.wires.filter(w=>w.id==="supply"||w.from===target);
  close(halves.reduce((v,w)=>v+w.cable.length,0),10);close(halves.reduce((v,w)=>v+w.cable.resistance,0),.02);assert.ok(halves.every(w=>w.cable.section===2.5&&w.cable.sizing==="manual"));
  close(p.nodes.at(-1).x,240);close(p.nodes.at(-1).y,400);
  const after=stepCircuit(p,freshRuntime());close(after.wireCurrent.supply,before.wireCurrent.supply);assert.equal(after.devices[lamp.id].on,true);
  p.wires.push({...wire("branch",g,"L",branch,"X1"),from:target});
  const active=stepCircuit(p,freshRuntime());assert.equal(active.devices[branch.id].on,true);assert.ok(active.wireCurrent.supply>after.wireCurrent.supply*1.9);
  const roundTrip=validateProject(JSON.parse(JSON.stringify(p)));assert.deepEqual(roundTrip,p);assert.equal(wirePhases(p).get("branch"),"R");
});

test("picking a wire endpoint reuses its terminal, without a duplicate junction",()=>{
  const p=blankProject(),a=newNode("source1","power",0,0,"G"),b=newNode("lamp","power",0,300,"H");p.nodes=[a,b];p.wires=[wire("w",a,"L",b,"X1")];
  const points=[{x:20,y:120},{x:20,y:200},{x:60,y:200},{x:60,y:300}];
  assert.equal(insertWireTap(p,"w",points,{x:20,y:121}),p.wires[0].from);assert.equal(p.nodes.length,2);assert.equal(p.wires.length,1);
  assert.deepEqual(pickWirePoint(points,{x:33,y:202}).point,{x:40,y:200});
});

test("pick points follow snap everywhere on horizontal and vertical spans, including bends and reversed wires",()=>{
  const points=[{x:100,y:100},{x:100,y:300},{x:400,y:300},{x:400,y:500}];
  const cases=[[{x:103,y:137},{x:100,y:140}],[{x:98,y:277},{x:100,y:280}],[{x:100,y:300},{x:100,y:300}],[{x:167,y:302},{x:160,y:300}],[{x:361,y:296},{x:360,y:300}],[{x:402,y:439},{x:400,y:440}]];
  for(const ps of [points,[...points].reverse()])for(const [cursor,expected] of cases){const picked=pickWirePoint(ps,cursor);assert.deepEqual(picked.point,expected);assert.equal(picked.point.x%SNAP,0);assert.equal(picked.point.y%SNAP,0);}
  assert.deepEqual(pickWirePoint([{x:100.00000001,y:107},{x:100,y:193}],{x:100,y:195}).point,{x:100,y:180});
  assert.equal(pickWirePoint([{x:100,y:101},{x:100,y:119}],{x:100,y:110}),null,"never create an off-grid tap on a span with no grid point");
});

test("a tap at an unrelated crossing splits only the chosen conductor",()=>{
  const p=blankProject(),a=newNode("tap","power",100,100,"J1"),b=newNode("tap","power",100,500,"J2"),c=newNode("tap","power",0,300,"J3"),d=newNode("tap","power",400,300,"J4");p.nodes=[a,b,c,d];
  p.wires=[wire("vertical",a,"A",b,"A"),wire("horizontal",c,"A",d,"A")];const untouched=structuredClone(p.wires[1]);
  const target=insertWireTap(p,"vertical",[{x:100,y:100},{x:100,y:500}],{x:100,y:300});assert.ok(target);
  assert.deepEqual(p.wires[1],untouched);assert.notEqual(wireNets(p).get("vertical"),wireNets(p).get("horizontal"));
  assert.equal(p.nodes.at(-1).x,100);assert.equal(p.nodes.at(-1).y,300);
});

test("same physical origin can overlap, while equal phase colours across a breaker cannot",()=>{
  const p=blankProject(),g=newNode("source1","power",0,0,"G"),q=newNode("breaker1","power",0,300,"Q"),a=newNode("lamp","power",300,300,"H1"),b=newNode("lamp","power",500,300,"H2");
  p.nodes=[g,q,a,b];p.wires=[wire("one",g,"L",q,"1"),wire("two",g,"L",a,"X1"),wire("three",q,"2",b,"X1")];
  const nets=wireNets(p);assert.equal(nets.get("one"),nets.get("two"));assert.notEqual(nets.get("one"),nets.get("three"));assert.equal(wirePhases(p).get("one"),wirePhases(p).get("three"));
  const ps=[{x:0,y:0},{x:200,y:0}],previous=[{points:ps,net:nets.get("one")}];
  assert.equal(routingContext(previous,{x:0,y:0},{x:300,y:0},nets.get("two"))({x:40,y:0},{x:180,y:0}),false);
  assert.equal(routingContext(previous,{x:0,y:0},{x:300,y:0},nets.get("three"))({x:40,y:0},{x:180,y:0}),true);
});

test("unrelated crossings draw a curve; a connected junction draws no bridge",()=>{
  const routes=[{net:"R",points:[{x:0,y:100},{x:200,y:100}]},{net:"N",points:[{x:100,y:0},{x:100,y:200}]}],copy=structuredClone(routes);
  const paths=crossingPaths(routes);assert.ok(!paths[0].includes(" C"));assert.match(paths[1],/ C/);assert.deepEqual(routes,copy);
  routes[1].net="R";assert.ok(!crossingPaths(routes)[1].includes(" C"));
  routes[1].points=[{x:100,y:100},{x:100,y:200}];assert.ok(!crossingPaths(routes)[1].includes(" C"));
});

test("legacy overload auxiliary wires migrate to independent NC and NO symbols and still trip/reset",()=>{
  const p=blankProject(),g=newNode("source1","control",100,100,"G"),ol=newNode("overload","control",400,300,"OL1"),run=newNode("lamp","control",800,500,"RUN"),fault=newNode("lamp","control",1000,500,"FAULT");
  p.nodes=[g,ol,run,fault];p.wires=[wire("nc-in",g,"L",ol,"95"),wire("nc-out",ol,"96",run,"X1"),wire("no-in",g,"L",ol,"97"),wire("no-out",ol,"98",fault,"X1"),wire("run-return",run,"X2",g,"N"),wire("fault-return",fault,"X2",g,"N")];
  const migrated=validateProject(p);assert.equal(p.nodes.length,4);assert.equal(migrated.nodes.length,6);assert.deepEqual(ports(ol).map(p=>p.name),["1","3","5","2","4","6"]);
  assert.equal(migrated.nodes.find(n=>n.type==="overloadNC").tag,ol.tag);assert.equal(migrated.nodes.find(n=>n.type==="overloadNO").tag,ol.tag);assert.deepEqual(normalizeProject(migrated),migrated);
  let runtime=stepCircuit(migrated,freshRuntime());assert.equal(runtime.devices[run.id].on,true);assert.equal(runtime.devices[fault.id].on,false);
  runtime=interact(migrated,runtime,ol.id);assert.equal(runtime.devices[run.id].on,false);assert.equal(runtime.devices[fault.id].on,true);
  runtime=interact(migrated,runtime,ol.id);assert.equal(runtime.devices[run.id].on,true);assert.equal(runtime.devices[fault.id].on,false);
});

test("component descriptions remain locally anchored even when other wires pass nearby",()=>{
  const p=blankProject(),g=newNode("source3","power",400,200,"G1"),ol=newNode("overload","power",600,500,"OL1");p.nodes=[g,ol];p.wires=[wire("w",g,"L1",ol,"1")];
  const l=layoutDiagram(p,"power");for(const n of p.nodes){const label=l.nodeLabels.get(n.id),body=nodeBounds(n);const dx=Math.max(0,body.x-label.x-label.w,label.x-body.x-body.w),dy=Math.max(0,body.y-label.y-label.h,label.y-body.y-body.h);assert.ok(Math.hypot(dx,dy)<=20);}
});
