import { defaultCable, newNode, pin, SNAP, snap } from "./circuit.ts";
import type { Project } from "./circuit.ts";
import { newId } from "./id.ts";
import { orthogonalPoints } from "./wire-routing.ts";
import type { Point, RoutedWire } from "./wire-routing.ts";

const distance=(a:Point,b:Point)=>Math.hypot(a.x-b.x,a.y-b.y);
export function pickWirePoint(points:Point[],cursor:Point){
  let best:{point:Point;index:number;distance:number}|null=null;
  for(let i=0;i<points.length-1;i++){
    const a=points[i],b=points[i+1],vertical=Math.abs(a.x-b.x)<.001,axis=vertical?"y":"x",other=vertical?"x":"y";
    // Project onto every straight span, then choose a grid point inside that
    // span. Clamping after snapping must never produce an off-grid endpoint.
    if(Math.abs(a[other]-b[other])>.001||Math.abs(a[other]-snap(a[other]))>.001||distance(a,b)<.001)continue;
    const lo=Math.ceil((Math.min(a[axis],b[axis])-.001)/SNAP)*SNAP,hi=Math.floor((Math.max(a[axis],b[axis])+.001)/SNAP)*SNAP;
    if(lo>hi)continue;
    const along=Math.max(lo,Math.min(hi,snap(cursor[axis])));
    const point=vertical?{x:snap(a.x),y:along}:{x:along,y:snap(a.y)},d=distance(point,cursor);
    if(!best||d<best.distance)best={point,index:i,distance:d};
  }
  return best;
}

/** Split one conductor, conserving its physical length and series resistance. No other wire is joined. */
export function insertWireTap(p:Project,wireId:string,points:Point[],cursor:Point):string|null{
  const wire=p.wires.find(w=>w.id===wireId),picked=pickWirePoint(points,cursor);
  if(!wire||!picked)return null;
  const {point,index}=picked;
  if(distance(point,points[0])<.001)return wire.from;
  if(distance(point,points.at(-1)!)<.001)return wire.to;
  if(p.nodes.length>=500||p.wires.length>=2000||point.x<0||point.y<0||point.x>10000||point.y>10000)return null;
  const source=p.nodes.find(n=>wire.from.startsWith(n.id+":"));if(!source)return null;
  const left=orthogonalPoints([...points.slice(0,index+1),point]),right=orthogonalPoints([point,...points.slice(index+1)]);
  const length=(ps:Point[])=>ps.slice(1).reduce((s,v,i)=>s+distance(ps[i],v),0),ratio=length(left)/(length(left)+length(right));
  let tag=1;while(p.nodes.some(n=>n.tag==="J"+tag))tag++;
  const tap=newNode("tap",source.sheet,point.x,point.y,"J"+tag);
  const endpoint=pin(tap,"A"),cable=wire.cable??{...defaultCable,sizing:"auto" as const};
  const tail={...wire,id:newId(),from:endpoint,bends:right.slice(1,-1),cable:{...cable,length:cable.length*(1-ratio),resistance:cable.resistance*(1-ratio)}};
  wire.to=endpoint;wire.bends=left.slice(1,-1);wire.cable={...cable,length:cable.length*ratio,resistance:cable.resistance*ratio};
  p.nodes.push(tap);p.wires.push(tail);
  return endpoint;
}

/** Later conductors jump over earlier ones. A crossing never changes the electrical graph. */
export function crossingPaths(routes:RoutedWire[]):string[]{
  return routes.map((route,i)=>{
    const ps=route.points;if(!ps.length)return "";
    let path=`M${ps[0].x} ${ps[0].y}`;
    for(let j=1;j<ps.length;j++){
      const a=ps[j-1],b=ps[j],horizontal=Math.abs(a.y-b.y)<.001,axis=horizontal?"x":"y",other=horizontal?"y":"x",direction=Math.sign(b[axis]-a[axis]);
      const hits:number[]=[];
      for(const earlier of routes.slice(0,i)){
        if(route.net&&earlier.net===route.net)continue;
        for(let k=1;k<earlier.points.length;k++){
          const c=earlier.points[k-1],d=earlier.points[k];if((Math.abs(c.y-d.y)<.001)===horizontal)continue;
          const at=c[axis];
          if(at>Math.min(a[axis],b[axis])+7&&at<Math.max(a[axis],b[axis])-7&&a[other]>=Math.min(c[other],d[other])-.001&&a[other]<=Math.max(c[other],d[other])+.001)hits.push(at);
        }
      }
      const sorted=[...new Set(hits)].sort((x,y)=>(x-y)*direction),merged:number[]=[];
      for(const hit of sorted)if(!merged.length||Math.abs(hit-merged.at(-1)!)>=14)merged.push(hit);
      for(const at of merged){
        const before=at-7*direction,after=at+7*direction;
        path+=horizontal?` L${before} ${a.y} C${before} ${a.y-10} ${after} ${a.y-10} ${after} ${a.y}`:` L${a.x} ${before} C${a.x+10} ${before} ${a.x+10} ${after} ${a.x} ${after}`;
      }
      path+=` L${b.x} ${b.y}`;
    }
    return path;
  });
}
