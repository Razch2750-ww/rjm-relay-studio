import { kind, nodeSize, portPosition, ports, SNAP, snap } from "./circuit.ts";
import type { Node, Project, Sheet, Wire } from "./circuit.ts";
import { componentAmperage,sizeProjectCables } from "./cable-sizing.ts";
import { routeWire,routingContext } from "./wire-routing.ts";
import type { RoutedWire } from "./wire-routing.ts";
import { wireNets } from "./wire-colors.ts";

export type Point = {x:number;y:number};
export type Rect = {x:number;y:number;w:number;h:number};
export type Label = Rect & {lines:string[];amperage?:string;rotation?:90;anchor?:"start"|"middle"|"end"};
export type WireLabel = Label & {fontSize:number;textLength:number};
type Segment = {a:Point;b:Point};

export function nodeBounds(n:Node):Rect {
  const size=nodeSize(n),quarter=n.rotation%180!==0;
  const w=quarter?size.height:size.width,h=quarter?size.width:size.height;
  return {x:n.x+(size.width-w)/2,y:n.y+(size.height-h)/2,w,h};
}
const hasBody=(n:Node)=>n.type!=="tap"&&kind(n)!=="text";
/** Compare symbol bodies only. Hitbox margins, labels and touching edges are allowed. */
export function componentOverlap(n:Node,nodes:Node[]):Node|undefined {
  if(!hasBody(n))return;
  const body=nodeBounds(n);
  return nodes.find(other=>other.id!==n.id&&other.sheet===n.sheet&&hasBody(other)&&overlaps(body,nodeBounds(other)));
}
/** Existing drawings stay intact; only newly introduced placement changes are checked. */
export function placementConflict(before:Node[],after:Node[]){
  const previous=new Map(before.map(n=>[n.id,n]));
  for(const n of after){
    const old=previous.get(n.id),a=old?nodeBounds(old):undefined,b=nodeBounds(n);
    if(old&&old.type===n.type&&old.sheet===n.sheet&&old.rotation===n.rotation&&a!.x===b.x&&a!.y===b.y&&a!.w===b.w&&a!.h===b.h)continue;
    const other=componentOverlap(n,after);if(other)return {node:n,other};
  }
}
/** Find the nearest free snapped position for a copied device or auxiliary contact. */
export function freeNodePosition(n:Node,nodes:Node[]):Point|undefined {
  const x=Math.max(0,Math.min(10000,snap(n.x))),y=Math.max(0,Math.min(10000,snap(n.y)));
  const body=nodeBounds({...n,x:0,y:0}),obstacles=hasBody(n)?nodes.filter(o=>o.id!==n.id&&o.sheet===n.sheet&&hasBody(o)).map(nodeBounds):[];
  for(let radius=0;radius<=20000/SNAP;radius++)for(let dx=-radius;dx<=radius;dx++){
    const dy=radius-Math.abs(dx);
    for(const sign of dy?[1,-1]:[1]){
      const point={x:x+dx*SNAP,y:y+dy*sign*SNAP};
      if(point.x<0||point.y<0||point.x>10000||point.y>10000)continue;
      if(!obstacles.some(o=>overlaps({...body,x:body.x+point.x,y:body.y+point.y},o)))return point;
    }
  }
}
export function alignNode(n:Node,x:number,y:number,nodes:Node[],tolerance=8){
  const result:{x:number;y:number;guideX?:number;guideY?:number;blocked?:boolean}={x:snap(x),y:snap(y)};
  const own=ports(n).map(p=>portPosition({...n,x,y},p.name));
  for(const axis of ["x","y"] as const){
    let best=tolerance;
    for(const other of nodes){if(other.id===n.id||other.sheet!==n.sheet)continue;
      for(const p of ports(other)){const target=portPosition(other,p.name)[axis];
        for(const point of own)if(Math.abs(target-point[axis])<best){best=Math.abs(target-point[axis]);result[axis]=snap((axis==="x"?x:y)+target-point[axis]);result[axis==="x"?"guideX":"guideY"]=target;}
      }
    }
    result[axis]=Math.max(0,Math.min(10000,result[axis]));
  }
  return componentOverlap({...n,x:result.x,y:result.y},nodes)?{x:n.x,y:n.y,blocked:true}:result;
}
export function wirePoints(w:Wire,nodes:Map<string,Node>,previous:RoutedWire[]=[],labels:Rect[]=[],net?:string):Point[] {
  const [a,ap]=w.from.split(":"),[b,bp]=w.to.split(":"),na=nodes.get(a),nb=nodes.get(b);
  if(!na||!nb)return [];
  const start=portPosition(na,ap),end=portPosition(nb,bp);
  const stub=(n:Node,name:string,p:Point)=>{if(n.type==="tap")return p;const t=ports(n).find(t=>t.name===name)!,size=nodeSize(n),dx=t.x===0?-1:t.x===size.width?1:0,dy=dx?0:t.y===0?-1:1,a=n.rotation*Math.PI/180;return {x:p.x+SNAP*Math.round(dx*Math.cos(a)-dy*Math.sin(a)),y:p.y+SNAP*Math.round(dx*Math.sin(a)+dy*Math.cos(a))};};
  const obstacles=[...[...nodes.values()].filter(n=>kind(n)!=="junction").map(n=>padded(nodeBounds(n),8)),...labels.map(b=>padded(b,10))];
  return routeWire(start,stub(na,ap,start),stub(nb,bp,end),end,obstacles,previous,w.bends.map(p=>({x:snap(p.x),y:snap(p.y)})).filter(p=>!labels.some(b=>crossesBox(p,p,padded(b,10)))),net,labels.map(b=>padded(b,10)));
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
function candidates(body:Rect,w:number,h:number,sides:number[]) {
  const result:{box:Rect & {anchor:"start"|"middle"|"end"};distance:number}[]=[];
  for(const gap of [3,8,16,24,40,60,80,100,120])for(const side of sides)for(const offset of [0,20,-20,40,-40,60,-60,80,-80,100,-100,120,-120,160,-160,200,-200]){
    const cx=body.x+body.w/2,cy=body.y+body.h/2;
    const box=side===0?{x:cx-w/2+offset,y:body.y-gap-h,w,h}:side===1?{x:body.x+body.w+gap,y:cy-h/2+offset,w,h}:side===2?{x:cx-w/2+offset,y:body.y+body.h+gap,w,h}:{x:body.x-gap-w,y:cy-h/2+offset,w,h};
    result.push({box:{...box,anchor:side===1?"start":side===3?"end":"middle"},distance:gap+Math.abs(offset)/2});
  }
  return result.sort((a,b)=>a.distance-b.distance).map(c=>c.box);
}
/** One line, attached to an actual straight cable span. Reading direction is
 * screen-based: left-to-right horizontally, top-to-bottom (clockwise) vertically. */
function fitWireLabel(annotation:string,points:Point[],occupied:Rect[],segments:Segment[]):WireLabel|undefined {
  const text=annotation.replace(/\s+/g," ").trim(),unitWidth=textWidth(text,1,true),gap=3;
  const edges=points.slice(1).map((b,i)=>({a:points[i],b})).filter(e=>Math.hypot(e.b.x-e.a.x,e.b.y-e.a.y)>8)
    .sort((a,b)=>Math.hypot(b.b.x-b.a.x,b.b.y-b.a.y)-Math.hypot(a.b.x-a.a.x,a.b.y-a.a.y));
  for(const side of [1,-1]){
    let best:WireLabel|undefined;
    for(const {a,b} of edges){
      const vertical=Math.abs(a.x-b.x)<.001,axis=vertical?"y":"x",start=Math.min(a[axis],b[axis])+4,end=Math.max(a[axis],b[axis])-4;
      const upper=Math.min(14,(end-start)/Math.max(1,unitWidth));if(upper<.05||upper<=(best?.fontSize??0))continue;
      const fit=(fontSize:number):WireLabel|undefined=>{
        const thickness=fontSize*1.2,textLength=unitWidth*fontSize;
        const across=vertical?a.x+(side===1?gap:-gap-thickness):a.y+(side===1?-gap-thickness:gap);
        const stripe:Rect=vertical?{x:across,y:start,w:thickness,h:end-start}:{x:start,y:across,w:end-start,h:thickness};
        const blocked:[number,number][]=[];
        const block=(box:Rect)=>{if(overlaps(stripe,box))blocked.push([Math.max(start,box[axis]),Math.min(end,box[axis]+(vertical?box.h:box.w))]);};
        occupied.forEach(block);
        for(const segment of segments){
          // Leave space around a crossing bridge; parallel conductors only need
          // their stroke clearance so text can still fit inside a narrow lane.
          const parallel=(Math.abs(segment.a.x-segment.b.x)<.001)===vertical;
          const px=!vertical&&!parallel?8:2.5,py=vertical&&!parallel?8:2.5;
          block({x:Math.min(segment.a.x,segment.b.x)-px,y:Math.min(segment.a.y,segment.b.y)-py,w:Math.abs(segment.a.x-segment.b.x)+px*2,h:Math.abs(segment.a.y-segment.b.y)+py*2});
        }
        blocked.sort((a,b)=>a[0]-b[0]);let cursor=start,span:[number,number]|undefined;
        const consider=(from:number,to:number)=>{if(to-from>=textLength-1e-7&&(!span||to-from>span[1]-span[0]))span=[from,to];};
        for(const [from,to] of blocked){consider(cursor,from);cursor=Math.max(cursor,to);}consider(cursor,end);
        if(!span)return;
        const along=(span[0]+span[1]-textLength)/2;
        return {...(vertical?{x:across,y:along,w:thickness,h:textLength,rotation:90 as const}:{x:along,y:across,w:textLength,h:thickness}),lines:[text],fontSize,textLength};
      };
      let candidate=fit(upper);
      if(!candidate){
        let low=best?.fontSize??0,high=upper;
        for(let i=0;i<12;i++){const mid=(low+high)/2;if(fit(mid))low=mid;else high=mid;}
        if(low>=.05)candidate=fit(Math.floor(low*100)/100);
      }
      if(candidate&&candidate.fontSize>(best?.fontSize??0))best=candidate;
      if(best?.fontSize===14)return best;
    }
    if(best)return best;
  }
}
export function layoutDiagram(project:Project,sheet:Sheet){
  const sizing=sizeProjectCables(project).recommendations;
  const nodes=project.nodes.filter(n=>n.sheet===sheet),byId=new Map(nodes.map(n=>[n.id,n]));
  const bodies=nodes.filter(n=>n.type!=="tap").map(nodeBounds);
  const occupied:Rect[]=bodies.map(b=>padded(b,2));
  for(const n of nodes)if(n.type==="tap")occupied.push({x:n.x-8,y:n.y-8,w:16,h:16});
  const stems:Segment[]=[];
  for(const n of nodes)for(const port of ports(n)){
    if(n.type==="tap")continue;
    const t=terminalLabel(n,port.name);occupied.push(padded(t.box,2));
    const a=portPosition(n,port.name),directions=[{x:0,y:-1},{x:1,y:0},{x:0,y:1},{x:-1,y:0}],d=directions[t.side];
    stems.push({a,b:{x:a.x+d.x*SNAP,y:a.y+d.y*SNAP}});
  }
  const nodeLabels=new Map<string,Label>(),wireLabels=new Map<string,WireLabel>();
  // Anchor descriptions beside their symbol first, then route cables around them.
  // Never move a component label into a remote annotation bank.
  for(const n of nodes){
    if(n.type==="tap")continue;
    const body=nodeBounds(n),amperage=componentAmperage(n),canTrip=["breaker","rcd","overload","pfr","motor"].includes(kind(n));
    const counts=[0,0,0,0];for(const p of ports(n))counts[terminalLabel(n,p.name).side]++;
    const first=n.rotation/90,sides=[0,1,2,3].map(s=>(s+first)%4).sort((a,b)=>counts[a]-counts[b]);
    let picked:Label|undefined;
    const alternatives:Label[]=[];
    for(const wrap of n.type==="etc974"?[320,140]:[140,100]){
      const caption=[n.label===n.tag?"":n.label,String(n.params.model??"")].filter((s,i,all)=>s&&all.indexOf(s)===i).join(" · ");
      const lines=wrapLabel(caption,wrap);
      const w=Math.max(textWidth(n.tag+(canTrip?" · TRIP":""),18,true),textWidth(amperage??"",14),...lines.map(s=>textWidth(s,14)))+4,h=24+(lines.length+(amperage?1:0))*16;
      const choices=candidates(body,w,h,sides).map(b=>({...b,lines,amperage}));alternatives.push(...choices);
      picked=choices.find(b=>!occupied.some(o=>overlaps(b,o))&&!stems.some(s=>crossesBox(s.a,s.b,padded(b,3))));if(picked)break;
    }
    // A user can physically overlap devices; keep that conflict local and visible.
    picked??=alternatives.reduce((best,b)=>occupied.filter(o=>overlaps(b,o)).length<occupied.filter(o=>overlaps(best,o)).length?b:best);
    nodeLabels.set(n.id,picked);occupied.push(padded(picked,3));
  }
  const nets=wireNets(project),routes:{wire:Wire;points:Point[];net?:string}[]=[];
  const wires=project.wires.filter(w=>byId.has(w.from.split(":")[0])).sort((a,b)=>Number(!!b.bends.length)-Number(!!a.bends.length));
  for(const wire of wires){const net=nets.get(wire.id);routes.push({wire,net,points:wirePoints(wire,byId,routes,[...nodeLabels.values()],net)});}
  const routingConflicts=routes.filter((r,i)=>{const blocked=routingContext(routes.slice(0,i),r.points[0],r.points.at(-1)!,r.net);return r.points.slice(1).some((p,j)=>blocked(r.points[j],p));}).map(r=>r.wire.id);
  const segments:Segment[]=routes.flatMap(r=>r.points.slice(1).map((b,i)=>({a:r.points[i],b})));
  for(const {wire,points} of routes){
    if(points.length<2)continue;
    const annotation=`${wire.label?wire.label+" · ":""}${wire.cable?wire.cable.section.toLocaleString("id-ID")+" mm²":"mm² belum diisi"}${wire.cable?.sizing==="auto"&&sizing.get(wire.id)?.section===null?" · AUTO?":""}`;
    const label=fitWireLabel(annotation,points,occupied,segments);
    if(label){wireLabels.set(wire.id,label);occupied.push(padded(label,2));}
  }

  const all=[...bodies,...nodeLabels.values(),...wireLabels.values(),...segments.flatMap(s=>[s.a,s.b]).map(p=>({...p,w:0,h:0}))];
  const x=Math.min(0,...all.map(b=>b.x))-35,y=Math.min(0,...all.map(b=>b.y))-35;
  const bounds={x,y,w:Math.max(x+240,...all.map(b=>b.x+b.w))-x+35,h:Math.max(y+180,...all.map(b=>b.y+b.h))-y+35};
  return {nodes,routes,nodeLabels,wireLabels,bounds,routingConflicts};
}
