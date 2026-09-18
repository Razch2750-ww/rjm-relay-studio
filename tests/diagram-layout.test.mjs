import test from "node:test";
import assert from "node:assert/strict";
import { blankProject, newNode, pin } from "../lib/circuit.ts";
import { PROJECT_PRESETS } from "../lib/project-presets.ts";
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
  const expected=[[430,500],[440,390],[550,400],[540,510]];
  for(const [i,rotation] of [0,90,180,270].entries()){
    const p=blankProject(),source=newNode("source3","power",400,400,"SUP"),load=newNode("motor3","power",1000,900,"M1");
    source.rotation=rotation;p.nodes=[source,load];p.wires=[{id:"wire",from:pin(source,"L1"),to:pin(load,"U"),label:"Power supply",color:"R",bends:[]}];
    const before=JSON.stringify(p),layout=layoutDiagram(p,"power"),body=nodeBounds(source),label=layout.nodeLabels.get(source.id);
    const first=layout.routes[0].points[0];assert.ok(Math.abs(first.x-expected[i][0])<1e-6&&Math.abs(first.y-expected[i][1])<1e-6);
    assert.ok(i===0?label.y+label.h<body.y:i===1?label.x>body.x+body.w:i===2?label.y>body.y+body.h:label.x+label.w<body.x);
    assert.equal(JSON.stringify(p),before);clearLabels(layout);
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
