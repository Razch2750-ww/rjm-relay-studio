"use client";
import { useRef,useState } from "react";
import { Button } from "@/components/ui/button";
import { Choice,Numeric } from "./calculator";
import { CATALOG,kind } from "../lib/circuit";
import type { Project,PanelPlacement } from "../lib/circuit";
import { stateOf } from "../lib/simulator";
import type { Runtime } from "../lib/simulator";
import { automaticPanel,panelNodes,physicalBounds,physicalSize,panelWarnings } from "../lib/panel-layout";
import { newId } from "../lib/id";
export default function PanelDesigner({project,runtime,running,editable,front,onEdit,onInteract}:{project:Project;runtime:Runtime;running:boolean;editable:boolean;front:boolean;onEdit:(fn:(p:Project)=>void,record?:boolean)=>void;onInteract:(id:string,pressed?:boolean)=>void}){
 const key=front?"front":"internal",layout=project[key]??automaticPanel(project,front),svg=useRef<SVGSVGElement>(null),drag=useRef<{id:string;x:number;y:number;ox:number;oy:number}|null>(null),[selected,setSelected]=useState<string|null>(null),[adding,setAdding]=useState("");
 const item=layout.items.find(i=>i.id===selected),available=panelNodes(project,front).filter(n=>!layout.items.some(i=>i.nodeId===n.id)),audit=panelWarnings(layout);
 const edit=(fn:(l:typeof layout)=>void,record=true)=>onEdit(p=>{p[key]??=structuredClone(layout);fn(p[key]!);},record);
 const pt=(e:React.PointerEvent)=>{const rect=svg.current!.getBoundingClientRect();return {x:(e.clientX-rect.left)/rect.width*(layout.width+80)-40,y:(e.clientY-rect.top)/rect.height*(layout.height+80)-40};};
 const add=(type:"device"|"rail"|"duct")=>{const n=project.nodes.find(n=>n.id===(adding||available[0]?.id));if(type==="device"&&!n)return;const id=newId();edit(l=>l.items.push({id,nodeId:type==="device"?n!.id:"",x:40,y:40,width:type==="device"?physicalSize(n!,front).width:type==="rail"?l.width-80:40,height:type==="device"?physicalSize(n!,front).height:type==="rail"?35:l.height-80,rotation:0,kind:type}));setSelected(id);};
 return <div className="engineering-surface panel-designer">
  <div className="engineering-title"><div><h2>{front?"Front Panel":"Panel Internal"}</h2><p>{layout.width} × {layout.height} mm · ruang bebas estimasi {audit.free.toFixed(0)}%</p></div><Button variant="outline" onClick={()=>window.print()}>Cetak / PDF</Button></div>
  <div className="panel-designer-layout"><aside className="layout-properties">
   <Numeric label="Lebar panel (mm)" value={layout.width} min={100} max={5000} disabled={running||!editable} onChange={v=>edit(l=>{l.width=v;})}/><Numeric label="Tinggi panel (mm)" value={layout.height} min={100} max={5000} disabled={running||!editable} onChange={v=>edit(l=>{l.height=v;})}/>
   <Button variant="outline" disabled={running||!editable} onClick={()=>onEdit(p=>{p[key]=automaticPanel(p,front);})}>Susun otomatis</Button>
   <Choice label="Perangkat pada wiring" value={adding||available[0]?.id||""} onChange={setAdding} options={available.map(n=>({value:n.id,label:n.tag+" · "+CATALOG[n.type].name}))}/>
   <Button variant="outline" disabled={running||!editable||!available.length} onClick={()=>add("device")}>Tempatkan perangkat</Button>
   {!front&&<div className="button-row"><Button variant="outline" disabled={running||!editable} onClick={()=>add("rail")}>DIN rail</Button><Button variant="outline" disabled={running||!editable} onClick={()=>add("duct")}>Wiring duct</Button></div>}
   {item&&<><h3>{project.nodes.find(n=>n.id===item.nodeId)?.tag??item.kind}</h3>{(["x","y","width","height"] as const).map(k=><Numeric key={k} label={({x:"Posisi X",y:"Posisi Y",width:"Lebar",height:"Tinggi"})[k]+" (mm)"} value={item[k]} min={k==="width"||k==="height"?1:0} max={5000} disabled={running||!editable} onChange={v=>edit(l=>{l.items.find(i=>i.id===item.id)![k]=v;})}/>)}
   <div className="button-row"><Button variant="outline" disabled={running||!editable} onClick={()=>edit(l=>{l.items.find(i=>i.id===item.id)!.rotation=(item.rotation+90)%360;})}>Putar</Button><Button variant="outline" disabled={running||!editable} onClick={()=>edit(l=>{l.items=l.items.filter(i=>i.id!==item.id);})}>Lepas dari layout</Button></div></>}
   <p className="muted">Ukuran awal perkiraan; isi ukuran dan cutout dari datasheet. Snap 5 mm. Perangkat panel memakai ID yang sama dengan wiring.</p>
   {audit.issues.map((i,k)=><button className="diagnostic-row" key={k} onClick={()=>setSelected(i.id)}><b>WARNING</b>{i.text}</button>)}
  </aside><div className="physical-panel-scroll">
   <svg id={front?"front-panel-svg":"internal-panel-svg"} ref={svg} viewBox={`-40 -40 ${layout.width+80} ${layout.height+80}`} role="group" aria-label={front?"Tata letak pintu panel":"Tata letak internal panel"}
   onPointerMove={e=>{if(!drag.current||running||!editable)return;const pos=pt(e),d=drag.current;edit(l=>{const item=l.items.find(i=>i.id===d.id)!;item.x=Math.max(0,Math.min(l.width-item.width,Math.round((d.ox+pos.x-d.x)/5)*5));item.y=Math.max(0,Math.min(l.height-item.height,Math.round((d.oy+pos.y-d.y)/5)*5));},false);}} onPointerUp={()=>{drag.current=null;}} onPointerCancel={()=>{drag.current=null;}}>
    <rect x={0} y={0} width={layout.width} height={layout.height} fill={front?"#dce1e5":"#f3f4f5"} stroke="#788590" strokeWidth={3}/>
    {Array.from({length:Math.floor(layout.width/50)+1},(_,i)=><g key={i}><line x1={i*50} y1={-7} x2={i*50} y2={0} stroke="#697784"/><text x={i*50} y={-14} textAnchor="middle" fontSize={10} fill="#41505e">{i*50}</text></g>)}
    {Array.from({length:Math.floor(layout.height/50)+1},(_,i)=><g key={i}><line x1={-7} y1={i*50} x2={0} y2={i*50} stroke="#697784"/><text x={-12} y={i*50+3} textAnchor="end" fontSize={10} fill="#41505e">{i*50}</text></g>)}
    {layout.items.map(i=>{
      const n=project.nodes.find(n=>n.id===i.nodeId),s=n?stateOf(runtime,n):null,k=n?kind(n):i.kind,b=physicalBounds(i),momentary=k==="start"||k==="stop",active=!!s?.on;
      const operate=()=>{if(n&&running)onInteract(n.id,momentary?true:undefined);};
      return <g key={i.id} transform={`translate(${i.x} ${i.y})`} role="button" tabIndex={0} aria-label={n?n.tag+" "+n.label:i.kind} style={{cursor:running?"pointer":"move"}}
      onKeyDown={e=>{if(e.key==="Enter"||e.key===" "){e.preventDefault();if(!e.repeat)operate();}}} onKeyUp={e=>{if(n&&running&&momentary&&(e.key==="Enter"||e.key===" "))onInteract(n.id,false);}}
      onPointerDown={e=>{e.stopPropagation();setSelected(i.id);e.currentTarget.setPointerCapture(e.pointerId);if(running){operate();return;}if(editable){const pos=pt(e);edit(()=>{});drag.current={id:i.id,x:pos.x,y:pos.y,ox:i.x,oy:i.y};}}}
      onPointerUp={e=>{if(n&&running&&momentary)onInteract(n.id,false);drag.current=null;e.stopPropagation();}} onPointerCancel={()=>{if(n&&running&&momentary)onInteract(n.id,false);drag.current=null;}}>
       <title>{n?n.tag+" · "+n.label+" · "+(s?.tripped?"TRIP":active?"ON":"OFF")+" · "+(s?.current??0).toFixed(2)+" A":i.kind}</title>
       {i.kind!=="device"?<g><rect width={b.width} height={b.height} fill={i.kind==="rail"?"#aab3bc":"#c7cdd3"} stroke="#78848e"/><path d={i.kind==="rail"?`M0 8H${b.width}M0 ${b.height-8}H${b.width}`:`M8 0V${b.height}M${b.width-8} 0V${b.height}`} stroke="#71808c"/></g>:
       front&&["lamp","switch","selector","start","stop","estop","buzzer"].includes(k)?<g>
        <circle cx={b.width/2} cy={b.height/2} r={Math.min(b.width,b.height)/2} fill={k==="lamp"?(running&&active?String(n!.params.color??"#278448"):"#8c959c"):k==="estop"?"#c52d2d":"#343e46"} stroke="#66747e" strokeWidth={2}/>
        {k==="selector"&&<line x1={b.width/2} y1={b.height/2} x2={b.width/2+(String(runtime.manual[n!.id]??n!.params.position)==="OFF"?0:["MAN","1"].includes(String(runtime.manual[n!.id]??n!.params.position))?-7:7)} y2={3} stroke="white" strokeWidth={4}/>}
        {k==="buzzer"&&<text x={b.width/2} y={b.height/2+4} textAnchor="middle" fontSize={11} fill={active&&running?"#ffcf70":"white"}>{active&&running?"ON":"BZ"}</text>}
       </g>:<g>
        <rect width={b.width} height={b.height} rx={2} fill={k==="controller"||k==="meter"?"#24303a":"#e5e8eb"} stroke={s?.tripped?"#c12d2d":"#758592"} strokeWidth={s?.tripped?3:1}/>
        <text x={b.width/2} y={b.height/2} dominantBaseline="middle" textAnchor="middle" fontSize={k==="controller"?13:11} fill={k==="controller"||k==="meter"?"#f3f7fa":"#24313b"}>{k==="controller"?running&&active?(s?.temperature??0).toFixed(1)+"°C":"— —":k==="meter"?n!.params.mode==="current"?(s?.current??0).toFixed(1)+" A":(s?.voltage??0).toFixed(0)+" V":n?.tag}</text>
        {!front&&<rect x={b.width/2-7} y={b.height-20} width={14} height={10} fill={s?.tripped?"#c12d2d":running&&active?"#2e955d":"#8d969e"}/>}
       </g>}
       {n&&<><text x={b.width/2} y={b.height+15} textAnchor="middle" fontSize={11} fontWeight={600} fill="#24313b">{n.tag}</text><text x={b.width/2} y={b.height+29} textAnchor="middle" fontSize={9} fill="#4a5c69">{n.label.slice(0,28)}</text>{front&&k==="selector"&&<text x={b.width/2} y={b.height+41} textAnchor="middle" fontSize={9} fill="#314657">{String(runtime.manual[n.id]??n.params.position)}</text>}</>}
       {selected===i.id&&<rect x={-4} y={-4} width={b.width+8} height={b.height+8} stroke="#386ea1" strokeWidth={2} fill="none" strokeDasharray="5 4"/>}
      </g>;
    })}
   </svg>
  </div></div>
 </div>;
}
