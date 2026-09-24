import test from "node:test";
import assert from "node:assert/strict";
import { blankProject, newNode, pin, ports, portPosition, PIN_PITCH } from "../lib/circuit.ts";
import { wirePhases } from "../lib/wire-colors.ts";
import { PROJECT_PRESETS } from "../lib/project-presets.ts";
import { routingContext,moveWireSegment,addWireBend,orthogonalPoints } from "../lib/wire-routing.ts";
import { crossesBox, layoutDiagram, nodeBounds, overlaps } from "../lib/diagram-layout.ts";

function clearLabels(layout){
  const labels=[...layout.nodeLabels.values(),...layout.wireLabels.values()];
  const {bounds}=layout;
  for(const [i,label] of labels.entries()){
    assert.ok(label.x>=bounds.x&&label.y>=bounds.y&&label.x+label.w<=bounds.x+bounds.w&&label.y+label.h<=bounds.y+bounds.h,"export includes the full label");
    for(const {points} of layout.routes)for(let j=1;j<points.length;j++)assert.equal(crossesBox(points[j-1],points[j],label),false,"label stays off conductors");
    for(const other of labels.slice(i+1))assert.equal(overlaps(label,other),false,"labels do not collide");
    for(const node of layout.nodes)assert.equal(overlaps(label,nodeBounds(node)),false,"label stays off component bodies");
  }
}

test("labels follow the source's free side at all four rotations without changing terminals",()=>{
  const expected=[[420,520],[440,380],[420,400],[560,380]];
  for(const [i,rotation] of [0,90,180,270].entries()){
    const p=blankProject(),source=newNode("source3","power",400,400,"SUP"),load=newNode("motor3","power",1000,900,"M1");
    source.rotation=rotation;p.nodes=[source,load];p.wires=[{id:"wire",from:pin(source,"L1"),to:pin(load,"U"),label:"Power supply",color:"R",bends:[]}];
    const before=JSON.stringify(p),layout=layoutDiagram(p,"power"),body=nodeBounds(source),label=layout.nodeLabels.get(source.id);
    const first=layout.routes[0].points[0];assert.ok(Math.abs(first.x-expected[i][0])<1e-6&&Math.abs(first.y-expected[i][1])<1e-6);
    assert.ok(i===0?label.y+label.h<body.y:i===1?label.x>body.x+body.w:i===2?label.y>body.y+body.h:label.x+label.w<body.x);
    assert.equal(JSON.stringify(p),before);clearLabels(layout);
  }
});

test("AC source phases stay in reading order and retain connected wire identities after repeated rotations",()=>{
  for(const [type,names,colours] of [
    ["source3",["L1","L2","L3","N","PE"],["R","S","T","N","PE"]],
    ["source1",["L","N","PE"],["R","N","PE"]],
  ]){
    const p=blankProject(),source=newNode(type,"power",400,400,"SUP");p.nodes=[source];
    for(const [i,name] of names.entries()){
      const terminal=newNode("terminal","power",400+i*200,1000,"TB"+(i+1));p.nodes.push(terminal);
      p.wires.push({id:name,from:pin(source,name),to:pin(terminal,"1"),label:"",color:"auto",bends:[]});
    }
    const connections=JSON.stringify(p.wires);
    for(let turn=0;turn<8;turn++){
      source.rotation=turn%4*90;
      const axis=source.rotation%180?"y":"x",other=axis==="x"?"y":"x";
      const visible=ports(source).map(p=>({name:p.name,...portPosition(source,p.name)})).sort((a,b)=>a[axis]-b[axis]);
      assert.deepEqual(visible.map(p=>p.name),names,`${type} at ${source.rotation}°`);
      for(let i=1;i<visible.length;i++){
        assert.ok(Math.abs(visible[i][axis]-visible[i-1][axis]-PIN_PITCH)<1e-6);
        assert.ok(Math.abs(visible[i][other]-visible[0][other])<1e-6);
      }
      const phases=wirePhases(p),layout=layoutDiagram(p,"power");
      for(const [i,name] of names.entries()){
        assert.equal(phases.get(name),colours[i]);
        assert.deepEqual(layout.routes.find(r=>r.wire.id===name).points[0],portPosition(source,name));
      }
      assert.equal(JSON.stringify(p.wires),connections,"rotation never renames or swaps a wire endpoint");
    }
  }
});

test("component and wire descriptions avoid actual horizontal, vertical and diagonal paths",()=>{
  assert.equal(crossesBox({x:0,y:0},{x:100,y:100},{x:45,y:45,w:10,h:10}),true);
  assert.equal(crossesBox({x:0,y:0},{x:100,y:100},{x:10,y:60,w:10,h:10}),false);
  const p=blankProject(),a=newNode("source3","power",400,400,"SUP"),b=newNode("motor3","power",900,700,"MOTOR_01");
  b.label="COMPRESSOR COLD ROOM — KETERANGAN PANJANG HARUS TETAP UTUH";
  p.nodes=[a,b];p.wires=[{id:"diagonal",from:pin(a,"L1"),to:pin(b,"U"),label:"SUPPLY COMPRESSOR",color:"R",bends:[{x:800,y:350},{x:1000,y:600}]}];
  const layout=layoutDiagram(p,"power");clearLabels(layout);
  assert.equal(layout.nodeLabels.get(b.id).lines.join(" "),b.label);
});

test("existing wiring presets retain connections and all annotations fit export bounds",()=>{
  for(const preset of PROJECT_PRESETS){
    const p=preset.create(),before=JSON.stringify(p);
    for(const sheet of ["power","control"])clearLabels(layoutDiagram(p,sheet));
    assert.equal(JSON.stringify(p),before,preset.id);
  }
});

test("bundled sheets separate unrelated conductors and allow same-net overlap",()=>{
  for(const preset of PROJECT_PRESETS)for(const sheet of ["power","control"]){
    const layout=layoutDiagram(preset.create(),sheet);
    layout.routes.forEach((r,i)=>{const blocked=routingContext(layout.routes.slice(0,i),r.points[0],r.points.at(-1),r.net);
      for(let j=1;j<r.points.length;j++){const a=r.points[j-1],b=r.points[j];assert.ok(Math.abs(a.x-b.x)<.001||Math.abs(a.y-b.y)<.001,"every segment is orthogonal");assert.equal(blocked(a,b),false,preset.id+" "+r.wire.id+" cannot stack on another wire");}
    });
  }
});
test("straight wires can gain a dogleg and dragging an interior segment keeps endpoints and right angles",()=>{
  const start={x:40,y:100},end={x:40,y:400},points=addWireBend([start,end]);
  assert.ok(points.length>=6);const moved=moveWireSegment(points,2,{x:120,y:220});assert.deepEqual(moved[0],start);assert.deepEqual(moved.at(-1),end);assert.ok(moved.some(p=>p.x===120));
  for(let i=1;i<moved.length;i++)assert.ok(moved[i].x===moved[i-1].x||moved[i].y===moved[i-1].y);
  assert.deepEqual(orthogonalPoints([{x:0,y:0},{x:100,y:50}]),[{x:0,y:0},{x:100,y:0},{x:100,y:50}]);
});
