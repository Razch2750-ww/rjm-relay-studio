import { kind, nodeSize, portPosition, ports } from "./circuit.ts";
import type { Node, Project, Sheet, Wire } from "./circuit.ts";
import { componentAmperage,sizeProjectCables } from "./cable-sizing.ts";
import { routeWire,routingContext } from "./wire-routing.ts";
import type { RoutedWire } from "./wire-routing.ts";

export type Point = {x:number;y:number};
export type Rect = {x:number;y:number;w:number;h:number};
export type Label = Rect & {lines:string[];amperage?:string;rotation?:90};
type Segment = {a:Point;b:Point};
const GAP=18;

export function nodeBounds(n:Node):Rect {
  const size=nodeSize(n),quarter=n.rotation%180!==0;
  const w=quarter?size.height:size.width,h=quarter?size.width:size.height;
  return {x:n.x+(size.width-w)/2,y:n.y+(size.height-h)/2,w,h};
}
export function alignNode(n:Node,x:number,y:number,nodes:Node[],tolerance=8){
  const body=nodeBounds({...n,x,y}),axes={x:[body.x,body.x+body.w/2,body.x+body.w],y:[body.y,body.y+body.h/2,body.y+body.h]};
  const result:{x:number;y:number;guideX?:number;guideY?:number}={x:Math.round(x/20)*20,y:Math.round(y/20)*20};
  for(const axis of ["x","y"] as const){
    let best=tolerance;
    for(const other of nodes){if(other.id===n.id||other.sheet!==n.sheet)continue;const b=nodeBounds(other),size=axis==="x"?b.w:b.h;
      for(const target of [b[axis],b[axis]+size/2,b[axis]+size])for(const own of axes[axis])if(Math.abs(target-own)<best){best=Math.abs(target-own);result[axis]=(axis==="x"?x:y)+target-own;result[axis==="x"?"guideX":"guideY"]=target;}
    }
    result[axis]=Math.max(0,Math.min(10000,result[axis]));
  }
  return result;
}
export function wirePoints(w:Wire,nodes:Map<string,Node>,previous:RoutedWire[]=[]):Point[] {
  const [a,ap]=w.from.split(":"),[b,bp]=w.to.split(":"),na=nodes.get(a),nb=nodes.get(b);
  if(!na||!nb)return [];
  const start=portPosition(na,ap),end=portPosition(nb,bp);
  const stub=(n:Node,name:string,p:Point)=>{const t=ports(n).find(t=>t.name===name)!,size=nodeSize(n),dx=t.x===0?-1:t.x===size.width?1:0,dy=dx?0:t.y===0?-1:1,a=n.rotation*Math.PI/180;return {x:p.x+24*Math.round(dx*Math.cos(a)-dy*Math.sin(a)),y:p.y+24*Math.round(dx*Math.sin(a)+dy*Math.cos(a))};};
  const obstacles=[...nodes.values()].map(n=>padded(nodeBounds(n),8));
  return routeWire(start,stub(na,ap,start),stub(nb,bp,end),end,obstacles,previous,w.bends);
}
const padded=(b:Rect,p:number):Rect=>({x:b.x-p,y:b.y-p,w:b.w+p*2,h:b.h+p*2});
export const overlaps=(a:Rect,b:Rect)=>a.x<b.x+b.w&&a.x+a.w>b.x&&a.y<b.y+b.h&&a.y+a.h>b.y;
// Clip the actual segment, including diagonal user-drawn wires, against the label clearance.
export function crossesBox(a:Point,b:Point,box:Rect):boolean {
  let lo=0,hi=1;
  for(const axis of ["x","y"] as const){
    const d=b[axis]-a[axis],start=box[axis],end=start+(axis==="x"?box.w:box.h);
    if(Math.abs(d)<1e-8){if(a[axis]<start||a[axis]>end)return false;}
    else {const t1=(start-a[axis])/d,t2=(end-a[axis])/d;lo=Math.max(lo,Math.min(t1,t2));hi=Math.min(hi,Math.max(t1,t2));if(lo>hi)return false;}
  }
  return true;
}
function textWidth(text:string,size:number,mono=false):number {
  return Array.from(text).reduce((sum,c)=>sum+size*(mono?.63:/[MW@%]/.test(c)?1:/[ilIjtfr.,:;!'| ]/.test(c)?.44:.76),0);
}
export function wrapLabel(text:string,maxWidth=190):string[] {
  const lines:string[]=[];let line="";
  for(const word of text.trim().split(/\s+/).filter(Boolean)){
    if(line&&textWidth(line+" "+word,14)>maxWidth){lines.push(line);line="";}
    for(const c of word){if(textWidth(line+c,14)>maxWidth){lines.push(line);line="";}line+=c;}
    line+=" ";
  }
  if(line.trim())lines.push(line.trim());
  return lines.map(s=>s.trim());
}
export function terminalLabel(n:Node,name:string){
  const port=ports(n).find(p=>p.name===name)!,position=portPosition(n,name),size=nodeSize(n);
  const nx=port.x===0?-1:port.x===size.width?1:0,ny=nx?0:port.y===0?-1:1;
  const angle=n.rotation*Math.PI/180,dx=Math.round(nx*Math.cos(angle)-ny*Math.sin(angle)),dy=Math.round(nx*Math.sin(angle)+ny*Math.cos(angle));
  const x=position.x+(dx?-dx*9:8),y=position.y+(dx?-8:-dy*12+4),anchor=dx>0?"end":"start";
  const w=textWidth(name,12,true);
  return {x,y,anchor,side:dx>0?1:dx<0?3:dy>0?2:0,box:{x:anchor==="end"?x-w:x,y:y-12,w,h:15}} as const;
}
function candidates(body:Rect,w:number,h:number,sides:number[]):Rect[] {
  const result:Rect[]=[];
  for(const gap of [GAP,38,70,110,170,250])for(const side of sides)for(const offset of [0,40,-40,80,-80]){
    const cx=body.x+body.w/2,cy=body.y+body.h/2;
    result.push(side===0?{x:cx-w/2+offset,y:body.y-gap-h,w,h}:side===1?{x:body.x+body.w+gap,y:cy-h/2+offset,w,h}:side===2?{x:cx-w/2+offset,y:body.y+body.h+gap,w,h}:{x:body.x-gap-w,y:cy-h/2+offset,w,h});
  }
  return result;
}
export function layoutDiagram(project:Project,sheet:Sheet){
  const sizing=sizeProjectCables(project).recommendations;
  const nodes=project.nodes.filter(n=>n.sheet===sheet),byId=new Map(nodes.map(n=>[n.id,n]));
  const routes:{wire:Wire;points:Point[]}[]=[];
  // Give manually positioned segments priority; reserve each lane for subsequent wires.
  const wires=project.wires.filter(w=>byId.has(w.from.split(":")[0])).sort((a,b)=>Number(!!b.bends.length)-Number(!!a.bends.length));
  for(const wire of wires)routes.push({wire,points:wirePoints(wire,byId,routes)});
  const routingConflicts=routes.filter((r,i)=>{const blocked=routingContext(routes.slice(0,i),r.points[0],r.points.at(-1)!);return r.points.slice(1).some((p,j)=>blocked(r.points[j],p));}).map(r=>r.wire.id);
  const segments:Segment[]=routes.flatMap(r=>r.points.slice(1).map((b,i)=>({a:r.points[i],b})));
  const bodies=nodes.map(nodeBounds);
  const occupied:Rect[]=bodies.map(b=>padded(b,10));
  for(const n of nodes)for(const port of ports(n))occupied.push(padded(terminalLabel(n,port.name).box,3));
  const nodeLabels=new Map<string,Label>(),wireLabels=new Map<string,Label>();
  // Clearance is geometry, not a background painted over the conductors.
  const free=(box:Rect)=>!occupied.some(b=>overlaps(box,b))&&!segments.some(s=>crossesBox(s.a,s.b,padded(box,5)));
  const outerX=Math.max(0,...bodies.map(b=>b.x+b.w),...segments.flatMap(s=>[s.a.x,s.b.x]))+GAP;
  const outerHeight=Math.max(700,...bodies.map(b=>b.y+b.h),...segments.flatMap(s=>[s.a.y,s.b.y]));
  let fallbackX=outerX,fallbackY=0;
  const place=(choices:(Rect&{rotation?:90})[],lines:string[]):Label=>{
    let box=choices.find(free);
    if(!box){
      box={...choices[0],x:fallbackX,y:fallbackY};
      while(!free(box)){box={...box,y:box.y+box.h+GAP};if(box.y+box.h>outerHeight){fallbackX+=280;box={...box,x:fallbackX,y:0};}}
      fallbackY=box.y+box.h+GAP;if(fallbackY>outerHeight){fallbackX+=280;fallbackY=0;}
    }
    occupied.push(padded(box,6));return {...box,lines};
  };
  for(const n of nodes){
    const body=nodeBounds(n),lines=kind(n)==="text"?wrapLabel(n.label):n.label===n.tag?[]:wrapLabel(n.label);
    const canTrip=["breaker","rcd","overload","pfr","motor"].includes(kind(n));
    const amperage=componentAmperage(n);
    const w=Math.max(textWidth(n.tag+(canTrip?" · TRIP":""),18,true),textWidth(amperage??"",14),...lines.map(s=>textWidth(s,14)))+12,h=28+(lines.length+(amperage?1:0))*18;
    // Prefer a side without terminals; that side turns with the component.
    const counts=[0,0,0,0];for(const p of ports(n))counts[terminalLabel(n,p.name).side]++;
    const first=n.rotation/90,sides=[0,1,2,3].map(s=>(s+first)%4).sort((a,b)=>counts[a]-counts[b]);
    nodeLabels.set(n.id,{...place(candidates(body,w,h,sides),lines),amperage});
  }
  for(const {wire,points} of routes){
    if(points.length<2)continue;
    const annotation=`${wire.label?wire.label+" · ":""}${wire.cable?wire.cable.section.toLocaleString("id-ID")+" mm²":"mm² belum diisi"}${wire.cable?.sizing==="auto"&&sizing.get(wire.id)?.section===null?" · AUTO?":""}`;
    const lines=wrapLabel(annotation,185),w=Math.max(...lines.map(s=>textWidth(s,14,true)))+12,h=lines.length*18+8;
    const choices:(Rect&{rotation?:90})[]=[];
    const edges=points.slice(1).map((b,i)=>({a:points[i],b})).sort((u,v)=>Math.hypot(v.b.x-v.a.x,v.b.y-v.a.y)-Math.hypot(u.b.x-u.a.x,u.b.y-u.a.y));
    for(const {a,b} of edges)for(const fraction of [.5,.25,.75])for(const gap of [8,20,36]){
      const x=a.x+(b.x-a.x)*fraction,y=a.y+(b.y-a.y)*fraction;
      if(Math.abs(a.x-b.x)<.001&&Math.abs(a.y-b.y)>w+12)choices.push({x:x+gap,y:y-w/2,w:h,h:w,rotation:90},{x:x-gap-h,y:y-w/2,w:h,h:w,rotation:90});
      choices.push({x:x-w/2,y:y-gap-h,w,h},{x:x+gap,y:y-h/2,w,h},{x:x-w/2,y:y+gap,w,h},{x:x-gap-w,y:y-h/2,w,h});
    }
    wireLabels.set(wire.id,place(choices,lines));
  }
  const all=[...bodies,...nodeLabels.values(),...wireLabels.values(),...segments.flatMap(s=>[s.a,s.b]).map(p=>({...p,w:0,h:0}))];
  const x=Math.min(0,...all.map(b=>b.x))-35,y=Math.min(0,...all.map(b=>b.y))-35;
  const bounds={x,y,w:Math.max(x+240,...all.map(b=>b.x+b.w))-x+35,h:Math.max(y+180,...all.map(b=>b.y+b.h))-y+35};
  return {nodes,routes,nodeLabels,wireLabels,bounds,routingConflicts};
}
