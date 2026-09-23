export type Point={x:number;y:number};
export type Box={x:number;y:number;w:number;h:number};
export type RoutedWire={points:Point[]};
const EPS=.001,LANE=12;
const same=(a:Point,b:Point)=>Math.abs(a.x-b.x)<EPS&&Math.abs(a.y-b.y)<EPS;
const length=(a:Point,b:Point)=>Math.abs(a.x-b.x)+Math.abs(a.y-b.y);
const key=(n:number)=>Math.round(n*1000);

/** Normalize imported waypoints and pointer previews; never emit a diagonal. */
export function orthogonalPoints(points:Point[]):Point[]{
  const result:Point[]=[];
  for(const p of points){
    const a=result.at(-1);
    if(a&&same(a,p))continue;
    if(a&&Math.abs(a.x-p.x)>EPS&&Math.abs(a.y-p.y)>EPS)result.push({x:p.x,y:a.y});
    result.push({...p});
  }
  for(let i=1;i<result.length-1;){
    const a=result[i-1],b=result[i],c=result[i+1];
    if((Math.abs(a.x-b.x)<EPS&&Math.abs(b.x-c.x)<EPS)||(Math.abs(a.y-b.y)<EPS&&Math.abs(b.y-c.y)<EPS))result.splice(i,1);else i++;
  }
  return result;
}

/** Drag a whole interior segment perpendicular to itself, retaining square corners. */
export function moveWireSegment(points:Point[],index:number,position:Point):Point[]{
  if(index<1||index>=points.length-2)return points;
  const out=points.map(p=>({...p})),a=out[index],b=out[index+1];
  if(Math.abs(a.x-b.x)<EPS)a.x=b.x=Math.round(position.x/LANE)*LANE;
  else a.y=b.y=Math.round(position.y/LANE)*LANE;
  return orthogonalPoints(out);
}

export function addWireBend(points:Point[]):Point[]{
  if(points.length<2)return points;
  let index=0;for(let i=1;i<points.length-1;i++)if(length(points[i],points[i+1])>length(points[index],points[index+1]))index=i;
  const a=points[index],b=points[index+1],vertical=Math.abs(a.x-b.x)<EPS;
  const first={x:a.x+(b.x-a.x)/3,y:a.y+(b.y-a.y)/3},last={x:a.x+2*(b.x-a.x)/3,y:a.y+2*(b.y-a.y)/3};
  const offset=(p:Point)=>vertical?{x:p.x+36,y:p.y}:{x:p.x,y:p.y+36};
  return orthogonalPoints([...points.slice(0,index+1),first,offset(first),offset(last),last,...points.slice(index+1)]);
}

type Edge={a:Point;b:Point;ends:Point[]};
export function routingContext(previous:RoutedWire[],start:Point,end:Point){
  const horizontal=new Map<number,Edge[]>(),vertical=new Map<number,Edge[]>();
  for(const r of previous){
    const ends=[r.points[0],r.points.at(-1)!].filter(Boolean);
    r.points.slice(1).forEach((b,i)=>{const a=r.points[i],flat=Math.abs(a.y-b.y)<EPS,map=flat?horizontal:vertical,k=key(flat?a.y:a.x);if(!map.has(k))map.set(k,[]);map.get(k)!.push({a,b,ends});});
  }
  return (a:Point,b:Point)=>{
    const flat=Math.abs(a.y-b.y)<EPS,axis=flat?"x":"y",map=flat?horizontal:vertical;
    for(const other of map.get(key(flat?a.y:a.x))??[]){
      const lo=Math.max(Math.min(a[axis],b[axis]),Math.min(other.a[axis],other.b[axis]));
      const hi=Math.min(Math.max(a[axis],b[axis]),Math.max(other.a[axis],other.b[axis]));
      if(hi-lo<EPS)continue;
      // Only the terminal's short shared stem may coincide. Crossings are not joins.
      const shared=[start,end].find(p=>other.ends.some(q=>same(p,q))&&Math.abs(p[flat?"y":"x"]-a[flat?"y":"x"])<EPS&&Math.max(Math.abs(lo-p[axis]),Math.abs(hi-p[axis]))<=24+EPS);
      if(!shared)return true;
    }
    return false;
  };
}

function enters(a:Point,b:Point,r:Box){
  if(Math.abs(a.y-b.y)<EPS)return a.y>r.y+EPS&&a.y<r.y+r.h-EPS&&Math.max(a.x,b.x)>r.x+EPS&&Math.min(a.x,b.x)<r.x+r.w-EPS;
  return a.x>r.x+EPS&&a.x<r.x+r.w-EPS&&Math.max(a.y,b.y)>r.y+EPS&&Math.min(a.y,b.y)<r.y+r.h-EPS;
}

// A small binary heap keeps the visibility-grid fallback responsive on dense sheets.
class Queue {
  items:{id:number;cost:number}[]=[];
  push(item:{id:number;cost:number}){let i=this.items.push(item)-1;while(i){const p=(i-1)>>1;if(this.items[p].cost<=item.cost)break;this.items[i]=this.items[p];i=p;}this.items[i]=item;}
  pop(){const first=this.items[0],last=this.items.pop()!;if(this.items.length){let i=0;while(i*2+1<this.items.length){let c=i*2+1;if(c+1<this.items.length&&this.items[c+1].cost<this.items[c].cost)c++;if(this.items[c].cost>=last.cost)break;this.items[i]=this.items[c];i=c;}this.items[i]=last;}return first;}
}

function connect(a:Point,b:Point,boxes:Box[],blocked:(a:Point,b:Point)=>boolean,previous:RoutedWire[]):Point[]{
  if(same(a,b))return [a];
  const trapped=(p:Point)=>[[1,0],[-1,0],[0,1],[0,-1]].every(([x,y])=>blocked(p,{x:p.x+x*.01,y:p.y+y*.01}));
  if(trapped(a)||trapped(b))return [];
  const clear=(x:Point,y:Point)=>!blocked(x,y)&&!boxes.some(box=>enters(x,y,box));
  const candidates:Point[][]=[];
  if(Math.abs(a.x-b.x)<EPS||Math.abs(a.y-b.y)<EPS)candidates.push([a,b]);
  candidates.push([a,{x:b.x,y:a.y},b],[a,{x:a.x,y:b.y},b]);
  const xs=new Set<number>([a.x,b.x]),ys=new Set<number>([a.y,b.y]);
  for(const p of [a,b])for(const offset of [12,-12,24,-24,36,-36,60,-60,96,-96,144,-144,240,-240]){xs.add(p.x+offset);ys.add(p.y+offset);}
  for(const box of boxes){xs.add(box.x-LANE);xs.add(box.x+box.w+LANE);ys.add(box.y-LANE);ys.add(box.y+box.h+LANE);}
  for(const x of xs)candidates.push([a,{x,y:a.y},{x,y:b.y},b]);
  for(const y of ys)candidates.push([a,{x:a.x,y},{x:b.x,y},b]);
  for(const dx of [12,-12,24,-24,48,-48])for(const dy of [12,-12,24,-24,48,-48]){
    candidates.push([a,{x:a.x+dx,y:a.y},{x:a.x+dx,y:b.y+dy},{x:b.x,y:b.y+dy},b]);
    candidates.push([a,{x:a.x,y:a.y+dy},{x:b.x+dx,y:a.y+dy},{x:b.x+dx,y:b.y},b]);
  }
  const valid=candidates.map(orthogonalPoints).filter(ps=>ps.slice(1).every((p,i)=>clear(ps[i],p)));
  if(valid.length)return valid.reduce((best,ps)=>cost(ps)<cost(best)?ps:best);

  // Adaptive lanes around existing elbows and device outlines, including outer escape lanes.
  for(const r of previous)for(const p of r.points){xs.add(p.x-LANE);xs.add(p.x+LANE);ys.add(p.y-LANE);ys.add(p.y+LANE);}
  const xValues=[...xs].map(n=>key(n)/1000).sort((a,b)=>a-b),yValues=[...ys].map(n=>key(n)/1000).sort((a,b)=>a-b);
  const X=[...new Set(xValues)],Y=[...new Set(yValues)],width=X.length;
  const point=(id:number)=>({x:X[Math.floor(id/2)%width],y:Y[Math.floor(id/2/width)]});
  const origin=(Y.indexOf(key(a.y)/1000)*width+X.indexOf(key(a.x)/1000))*2,target=(Y.indexOf(key(b.y)/1000)*width+X.indexOf(key(b.x)/1000))*2;
  const distances=new Map<number,number>([[origin,0],[origin+1,0]]),parents=new Map<number,number>(),queue=new Queue();
  queue.push({id:origin,cost:length(a,b)});queue.push({id:origin+1,cost:length(a,b)});
  const visited=new Set<number>();
  while(queue.items.length){
    const {id}=queue.pop();if(visited.has(id))continue;visited.add(id);
    if(Math.floor(id/2)===target/2){const path:Point[]=[];let step=id;while(parents.has(step)){path.push(point(step));step=parents.get(step)!;}path.push(a);return orthogonalPoints(path.reverse());}
    const p=point(id),xi=Math.floor(id/2)%width,yi=Math.floor(id/2/width);
    for(const [nx,ny,dir] of [[xi-1,yi,0],[xi+1,yi,0],[xi,yi-1,1],[xi,yi+1,1]]){
      if(nx<0||nx>=width||ny<0||ny>=Y.length)continue;
      const next=(ny*width+nx)*2+dir,q={x:X[nx],y:Y[ny]};
      if(visited.has(next)||!clear(p,q))continue;
      const distance=distances.get(id)!+length(p,q)+(dir===id%2?0:18);
      if(distance<(distances.get(next)??Infinity)){distances.set(next,distance);parents.set(next,id);queue.push({id:next,cost:distance+length(q,b)});}
    }
  }
  return [];
}
const cost=(ps:Point[])=>ps.slice(1).reduce((sum,p,i)=>sum+length(ps[i],p),ps.length*18);

export function routeWire(start:Point,sa:Point,sb:Point,end:Point,boxes:Box[],previous:RoutedWire[],bends:Point[]=[]):Point[]{
  const blocked=routingContext(previous,start,end);
  const manual=orthogonalPoints([start,...bends,end]);
  if(bends.length&&manual.slice(1).every((p,i)=>!blocked(manual[i],p)))return manual;
  const waypoints=bends.length?[start,...bends,end]:[start,sa,sb,end],result:Point[]=[start];
  for(let i=1;i<waypoints.length;i++){
    const a=waypoints[i-1],b=waypoints[i];
    // Terminal stems are permitted through their own device clearance, never another wire.
    const relevant=boxes.filter(box=>!enters(a,a,box)&&!enters(b,b,box));
    let path=connect(a,b,relevant,blocked,previous);
    // Crowded/overlapping devices can obstruct escape: preserve electrical endpoints and
    // conductor separation; the component overlap remains visible for the drafter to fix.
    if(!path.length)path=connect(a,b,[],blocked,previous);
    if(!path.length&&i<waypoints.length-1){
      // An imported elbow can sit on an existing crossing; move that elbow to a free lane.
      for(const [dx,dy] of [[12,0],[-12,0],[0,12],[0,-12],[24,12],[-24,-12]]){
        const shifted={x:b.x+dx,y:b.y+dy},candidate=connect(a,shifted,[],blocked,previous);
        if(candidate.length){waypoints[i]=shifted;path=candidate;break;}
      }
    }
    if(!path.length&&bends.length)return routeWire(start,sa,sb,end,boxes,previous);
    if(!path.length){
      const escaped=connect(start,end,[],blocked,previous);
      if(escaped.length)return escaped;
      // A terminal placed exactly on an unrelated crossing has no free exit.
      // Keep its connection visible; the editor reports this placement conflict.
      return orthogonalPoints([start,sa,sb,end]);
    }
    result.push(...path.slice(1));
  }
  return orthogonalPoints(result);
}
