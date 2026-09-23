import { kind,number } from "./circuit.ts";
import type { Node,Project,PanelLayout,PanelPlacement } from "./circuit.ts";
export function panelNodes(p:Project,front:boolean){
 const kinds=front?["lamp","switch","selector","start","stop","estop","controller","meter","buzzer","schedule"]:["breaker","fuse","rcd","contactor","overload","coil","ton","toff","schedule","interval","pfr","terminal","controller","transformer"];
 const seen=new Set<string>();return p.nodes.filter(n=>{if(!kinds.includes(kind(n))||seen.has(n.tag))return false;seen.add(n.tag);return true;});
}
export function physicalSize(n:Node,front:boolean){
 const k=kind(n);return {width:number(n,front?"cutoutWidth":"physicalWidth",front?k==="controller"?75:k==="meter"?72:k==="schedule"?54:22:k==="contactor"||k==="overload"?65:k==="terminal"?12:k==="controller"?100:54),height:number(n,front?"cutoutHeight":"physicalHeight",front?k==="controller"?35:k==="meter"?72:k==="schedule"?75:22:k==="terminal"?50:85)};
}
export function automaticPanel(p:Project,front:boolean):PanelLayout{
 const ns=panelNodes(p,front),width=800,height=Math.max(1000,Math.ceil(ns.length/(front?5:8))*150+150),items:PanelPlacement[]=ns.map((n,i)=>({id:"panel-"+n.id,nodeId:n.id,x:60+(i%(front?5:8))*(front?145:90),y:100+Math.floor(i/(front?5:8))*150,...physicalSize(n,front),rotation:0,kind:"device"}));
 if(!front)for(let y=125;y<height-80;y+=150)items.unshift({id:"rail-"+y,nodeId:"",x:30,y,width:740,height:35,rotation:0,kind:"rail"});
 return {width,height,items};
}
export function physicalBounds(i:PanelPlacement){return {x:i.x,y:i.y,width:i.rotation%180?i.height:i.width,height:i.rotation%180?i.width:i.height};}
export function panelWarnings(l:PanelLayout){
 const issues:{id:string;text:string}[]=[];
 for(const item of l.items){const a=physicalBounds(item);if(a.x<0||a.y<0||a.x+a.width>l.width||a.y+a.height>l.height)issues.push({id:item.id,text:"Komponen melewati batas panel."});
  if(item.kind==="rail")continue;for(const other of l.items){if(other.id<=item.id||other.kind==="rail")continue;const b=physicalBounds(other);if(a.x<b.x+b.width&&a.x+a.width>b.x&&a.y<b.y+b.height&&a.y+a.height>b.y)issues.push({id:item.id,text:"Bertabrakan dengan "+(other.nodeId||other.kind)+"."});}
 }
 const occupied=l.items.filter(i=>i.kind!=="rail").reduce((s,i)=>s+i.width*i.height,0);
 return {issues,free:Math.max(0,100-occupied/(l.width*l.height)*100)};
}
