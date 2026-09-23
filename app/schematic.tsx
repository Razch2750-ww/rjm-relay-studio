"use client";
import { newId } from "../lib/id";
import { useEffect, useMemo, useRef, useState } from "react";
import { CATALOG, kind, nodeSize, pin, poles, portPosition, ports,defaultCable,number } from "../lib/circuit";
import { layoutDiagram, terminalLabel,alignNode } from "../lib/diagram-layout";
import type { Node, Project, Sheet } from "../lib/circuit";
import { stateOf } from "../lib/simulator";
import type { Runtime } from "../lib/simulator";

export const PHASE:Record<string,string>={R:"#f38b85",S:"#e4cf68",T:"#d6dce3",N:"#77b3f3",PE:"#a6d782","+":"#ef9287","-":"#80baf0",auto:"#7c8b99",signal:"#afc2d6"};
export function Symbol({node:n,runtime,mini=false,rotation=0}:{node:Node;runtime?:Runtime;mini?:boolean;rotation?:number}){
  const {width:w,height:h}=nodeSize(n),k=kind(n),s=runtime?stateOf(runtime,n):undefined,on=s?!!s.on:["nc","stop","estop"].includes(k)||!!n.params.on;
  const ink=s?.tripped?"#c12f34":runtime&&on?"#20834e":mini?"#c8d1dd":"#283a49";
  const line=(x1:number,y1:number,x2:number,y2:number,key?:string)=><line key={key} x1={x1} y1={y1} x2={x2} y2={y2}/>;
  const upright=(x:number,y:number)=>`rotate(${-rotation} ${x} ${y})`;
  const multi=["breaker","fuse","rcd","contactor","overload"].includes(k);
  return <g stroke={ink} fill="none" strokeWidth={2.1} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    {multi&&Array.from({length:poles(n)},(_,i)=>{
      const x=k==="overload"?25+i*35:(i+1)*w/(poles(n)+1),closed=k==="overload"||on;
      return <g key={i}>{line(x,0,x,28)}{line(x,72,x,h)}
        {k==="fuse"?<rect x={x-7} y={28} width={14} height={44}/>:k==="overload"?<path d={"M"+x+" 28v16h-7v15h14v13h-7"}/>:<>{line(x,72,closed?x:x+19,28)}<circle cx={x} cy={28} r={3}/>{k==="breaker"||k==="rcd"?<path d={"M"+(x-6)+" 52h12l-6-6"}/>:null}</>}
      </g>;
    })}
    {multi&&poles(n)>1&&<line x1={k==="overload"?25:w/(poles(n)+1)} y1={55} x2={k==="overload"?95:poles(n)*w/(poles(n)+1)} y2={55} strokeDasharray="5 5" opacity={.6}/>}
    {k==="overload"&&[150,195].map((x,i)=><g key={x}>{line(x,0,x,48)}{line(x,92,x,h)}{line(x,92,((i===0&&!s?.tripped)||(i===1&&s?.tripped))?x:x+15,48)}</g>)}
    {["motor","heater","lamp","buzzer","valve"].includes(k)&&<>
      {ports(n).filter(p=>p.name!=="PE").map(p=>line(p.x,p.y,p.x,p.y===0?30:h-30,p.name))}
      {k==="lamp"&&<><circle cx={w/2} cy={h/2} r={25} fill={runtime&&on?String(n.params.color??"#73da9b"):mini?"#141c25":"#f1f4f6"} stroke={on?String(n.params.color??"#73da9b"):ink}/><path d={"M"+(w/2-17)+" "+(h/2-17)+"l34 34m0-34-34 34"} stroke={on?"#15251c":ink}/></>}
      {k==="motor"&&<><circle cx={w/2} cy={h/2} r={29}/><text x={w/2} y={h/2} dominantBaseline="central" transform={upright(w/2,h/2)} stroke="none" fill={ink} fontSize="23" textAnchor="middle">M{poles(n)===3?"3~":poles(n)===0?"=":"1~"}</text></>}
      {k==="heater"&&<><rect x={w/2-29} y={h/2-20} width={58} height={40}/><path d={"M"+(w/2-20)+" "+(h/2)+"h7l5-10 8 20 7-20 5 10h8"}/></>}
      {k==="buzzer"&&<path d={"M"+(w/2-20)+" 30h25v40h-25zm25 6q27 14 0 28"}/>}
      {k==="valve"&&<path d={"M"+(w/2-25)+" 28l50 44V28l-50 44z"}/>}
      {(k==="motor"||k==="heater")&&<>{line(w/2,h-18,w/2,h)}<path d={"M"+(w/2-10)+" "+(h-18)+"h20m-16-5h12"}/></>}
    </>}
    {["coil","ton","toff","impulse","cyclic","schedule","interval"].includes(k)&&<>
      {line(w/2,0,w/2,32)}{line(w/2,68,w/2,h)}<rect x={w/2-27} y={32} width={54} height={36} fill={runtime&&on?"#def1e4":mini?"#141c25":"#f9fafb"}/>
      {k==="coil"?<path d={"M"+(w/2-27)+" 68l54-36"}/>:<text x={w/2} y={50} dominantBaseline="central" transform={upright(w/2,50)} textAnchor="middle" fill={ink} stroke="none" fontSize={rotation%180&&k==="cyclic"?9:16}>{k==="ton"?"t↑":k==="toff"?"t↓":k==="cyclic"?"NC/NO":k==="schedule"?"24h":k==="interval"?"t‖":"↕"}</text>}
    </>}
    {["switch","start","stop","estop","no","nc","pressure","selector","limit","changeover"].includes(k)&&<>
      {ports(n).map(p=>line(p.x,p.y,p.x,p.y===0?28:72,p.name))}
      {k==="selector"&&n.params.mapping?[1,2].map(i=>{const mode=String(runtime?.manual[n.id]??n.params.position),closed=String(n.params.mapping).split(";").find(p=>p.split(":")[0]===mode)?.includes(i===1?"13-14":"23-24"),x=i*w/3;return line(x,72,closed?x:x+16,28,String(i));}):k==="selector"&&(runtime?.manual[n.id]??n.params.position)==="OFF"?null:["pressure","selector","changeover"].includes(k)?<path d={"M"+w/2+" 28L"+(k==="changeover"?(on?w*2/3:w/3):k==="pressure"?(on?w/3:w*2/3):(["MAN","1"].includes(String(runtime?.manual[n.id]??n.params.position))?w/3:w*2/3))+" 72"}/>:line(w/2,72,on?w/2:w/2+20,28)}
      {["start","stop","estop"].includes(k)&&<><path d={"M"+(w/2-34)+" 45h25m-25-8v16"} strokeDasharray="4 3"/>{k==="estop"&&<circle cx={w/2-38} cy={45} r={12} fill={runtime?.manual[n.id]?"#cf4e4e":"#813c3d"}/>}</>}
      {k==="nc"||k==="stop"?line(w/2-8,28,w/2+8,28):null}
    </>}
    {k==="source"&&<><circle cx={w/2} cy={42} r={30}/><text x={w/2} y={42} dominantBaseline="central" transform={upright(w/2,42)} textAnchor="middle" fontSize="19" fill={ink} stroke="none">{poles(n)===3?"3~":poles(n)===0?"DC":"~"}</text>{ports(n).map(p=>line(p.x,80,p.x,h,p.name))}</>}
    {k==="pfr"&&<><rect x={15} y={22} width={w-30} height={h-44} rx={2}/><text x={w/2} y={h/2} dominantBaseline="central" transform={upright(w/2,h/2)} textAnchor="middle" fontSize="21" fill={ink} stroke="none">PFR</text>{ports(n).map(p=>line(p.x,p.y,p.x,p.y===0?22:h-22,p.name))}</>}
    {k==="controller"&&<><rect x={4} y={6} width={w-8} height={100} rx={3} fill={mini?"#101920":"#f0f3f5"}/>
      <g transform={upright(w/2,56)}><text x={w/2} y={43} textAnchor="middle" fontSize={mini?28:rotation%180?11:25} fill={ink} stroke="none" fontFamily="monospace">{s?.on?"TC  "+String(s.stage==="sensor-fault"?"ERR":s.temperature??"—")+" °C":"TC  — —"}</text>
      <text x={w/2} y={76} textAnchor="middle" fontSize={rotation%180?11:16} fill={ink} stroke="none">{s?.defrost?"DEFROST":s?.cool?"COMP":s?.on?"STANDBY":"CONTROLLER"}</text></g>
      {ports(n).map(p=>line(p.x,106,p.x,h,p.name))}</>}
    {k==="probe"&&<><path d={"M"+w/2+" 0v30m0 40v30"}/><rect x={w/2-12} y={30} width={24} height={40}/><path d={"M"+(w/2-20)+" 65l40-30"}/></>}
    {k==="terminal"&&<><path d={"M"+w/2+" 0v100"}/><rect x={w/2-18} y={25} width={36} height={50}/><circle cx={w/2} cy={42} r={5}/><circle cx={w/2} cy={58} r={5}/></>}
    {k==="junction"&&<><path d={"M"+w/2+" 0v"+h+"M0 "+h/2+"h"+w}/><circle cx={w/2} cy={h/2} r={5} fill={ink}/></>}
    {k==="bus"&&<><path d={"M"+w/2+" 40V16m-8 0h16l-8-10z"}/></>}
    {k==="meter"&&<><path d={`M${w/2} 0V25M${w/2} 75V100`}/><circle cx={w/2} cy={50} r={25}/><text x={w/2} y={54} transform={upright(w/2,50)} textAnchor="middle" fontSize={13} stroke="none" fill={ink}>{n.params.mode==="current"?"A":"V"}</text></>}
    {k==="transformer"&&<><path d={`M${w/3} 0V22M${w*2/3} 0V22M${w/3} 78V100M${w*2/3} 78V100`}/><circle cx={w/2} cy={37} r={22}/><circle cx={w/2} cy={63} r={22}/></>}
    {k==="text"&&<text x={0} y={40} fontSize="17" fill={ink} stroke="none">{n.label}</text>}
  </g>;
}
const pathData=(points:{x:number;y:number}[])=>points.map((p,i)=>(i?"L":"M")+p.x+" "+p.y).join(" ");
export function Schematic({project,sheet,runtime,running,editable,selected,onSelect,onInteract,onEdit,onCheckpoint,adding,onPlaced,canvasAction,printing,debug=false}:{
  project:Project;sheet:Sheet;runtime:Runtime;running:boolean;editable:boolean;selected:string|null;onSelect:(id:string|null)=>void;
  onInteract:(id:string,pressed?:boolean)=>void;onEdit:(fn:(p:Project)=>void,record?:boolean)=>void;onCheckpoint:()=>void;
  adding:string|null;onPlaced:(type:string,x:number,y:number)=>void;canvasAction:{id:number;action:string};printing:boolean;debug?:boolean;
}){
  const svg=useRef<SVGSVGElement>(null),host=useRef<HTMLDivElement>(null),drag=useRef<{id:string;x:number;y:number;nx:number;ny:number;index?:number}|null>(null);
  const [size,setSize]=useState({w:900,h:650}),[view,setView]=useState({x:0,y:0,z:.65}),[pending,setPending]=useState<string|null>(null),[bends,setBends]=useState<{x:number;y:number}[]>([]),[cursor,setCursor]=useState({x:0,y:0});
  const space=useRef(false);
  const [guides,setGuides]=useState<{guideX?:number;guideY?:number}>({});
  useEffect(()=>{const down=(e:KeyboardEvent)=>{if(e.code==="Space"&&!(e.target as Element)?.closest("input,textarea,select,button,[contenteditable=true]")&&!(running&&(e.target as Element)?.closest(".circuit-node"))){space.current=true;e.preventDefault();}},up=()=>{space.current=false;};window.addEventListener("keydown",down);window.addEventListener("keyup",up);window.addEventListener("blur",up);return()=>{window.removeEventListener("keydown",down);window.removeEventListener("keyup",up);window.removeEventListener("blur",up);};},[running]);
  const {nodes,routes,nodeLabels,wireLabels,bounds:box}=useMemo(()=>layoutDiagram(project,sheet),[project,sheet]);
  const fit=()=>setView({x:box.x,y:box.y,z:Math.max(.15,Math.min(1.5,size.w/box.w,size.h/box.h))});
  useEffect(()=>{if(!host.current)return;const observer=new ResizeObserver(entries=>{const r=entries[0].contentRect;setSize({w:r.width,h:r.height});});observer.observe(host.current);return()=>observer.disconnect();},[]);
  const fittedDocument=useRef<string|null>(null);
  // Fit a document once after measurement. Folding panels must preserve camera and pending wires.
  /* eslint-disable react-hooks/set-state-in-effect, react-hooks/exhaustive-deps -- Synchronize the SVG camera only on the command/viewport keys. */
  useEffect(()=>{const key=project.id+":"+sheet;if(!host.current||!size.w||!size.h||fittedDocument.current===key)return;const rect=host.current.getBoundingClientRect();if(rect.width!==size.w||rect.height!==size.h)return;const b=box;setView({x:b.x,y:b.y,z:Math.max(.15,Math.min(1.5,size.w/b.w,size.h/b.h))});setPending(null);setBends([]);fittedDocument.current=key;},[project.id,sheet,size.w,size.h]); // Changes to diagram data deliberately do not move the camera.
  useEffect(()=>{if(canvasAction.action==="fit")fit();if(canvasAction.action==="in")setView(v=>({...v,z:Math.min(3,v.z*1.25)}));if(canvasAction.action==="out")setView(v=>({...v,z:Math.max(.15,v.z/1.25)}));if(canvasAction.action==="escape"){setPending(null);setBends([]);}},[canvasAction.id]);
  useEffect(()=>{if(running){setPending(null);setBends([]);}},[running]);
  useEffect(()=>{if(canvasAction.action.startsWith("focus:")){const n=project.nodes.find(n=>n.id===canvasAction.action.slice(6));if(n&&n.sheet===sheet)setView(v=>({...v,x:n.x-size.w/v.z/2+60,y:n.y-size.h/v.z/2+50}));}},[canvasAction.id,sheet]);
  /* eslint-enable react-hooks/set-state-in-effect, react-hooks/exhaustive-deps */
  const world=(clientX:number,clientY:number)=>{const r=svg.current!.getBoundingClientRect();return {x:view.x+(clientX-r.left)/view.z,y:view.y+(clientY-r.top)/view.z};};
  const connect=(to:string)=>{
    if(!editable||running)return;
    if(!pending){setPending(to);setBends([]);return;}
    if(pending!==to&&!project.wires.some(w=>(w.from===pending&&w.to===to)||(w.to===pending&&w.from===to)))
      onEdit(p=>{let label=1;const labels=new Set(p.wires.map(w=>w.label));while(labels.has(String(label)))label++;if(p.wires.length<2000)p.wires.push({id:newId(),from:pending,to,label:String(label),color:"auto",bends,cable:{...defaultCable}});});
    setPending(null);setBends([]);
  };
  const start=pending?(()=>{const [id,port]=pending.split(":");const n=project.nodes.find(n=>n.id===id);return n?portPosition(n,port):null;})():null;
  return <div className={"canvas-host "+(adding?"placing":"")} ref={host}
    onDragOver={e=>{if(editable&&!running)e.preventDefault();}} onDrop={e=>{e.preventDefault();const type=e.dataTransfer.getData("application/x-rjm-component");if(editable&&!running&&Object.hasOwn(CATALOG,type)){const pt=world(e.clientX,e.clientY);onPlaced(type,pt.x,pt.y);}}}>
    <svg ref={svg} id="circuit-canvas" xmlns="http://www.w3.org/2000/svg" aria-label={"Diagram "+sheet+", "+nodes.length+" komponen"} role="group"
      viewBox={printing?[box.x,box.y,box.w,box.h].join(" "):[view.x,view.y,size.w/view.z,size.h/view.z].join(" ")}
      onWheel={e=>{e.preventDefault();const point=world(e.clientX,e.clientY),r=svg.current!.getBoundingClientRect();const z=Math.max(.15,Math.min(3,view.z*(e.deltaY<0?1.12:1/1.12)));setView({x:point.x-(e.clientX-r.left)/z,y:point.y-(e.clientY-r.top)/z,z});}}
      onPointerDown={e=>{if(e.button!==0&&e.button!==1)return;const point=world(e.clientX,e.clientY);if(adding&&editable&&!running&&!space.current&&e.button!==1){onPlaced(adding,point.x,point.y);return;}if(pending&&!space.current&&e.button!==1){setBends(b=>[...b,{x:Math.round(point.x/20)*20,y:Math.round(point.y/20)*20}]);return;}drag.current={id:"@pan",x:e.clientX,y:e.clientY,nx:view.x,ny:view.y};e.currentTarget.setPointerCapture(e.pointerId);onSelect(null);}}
      onPointerMove={e=>{const point=world(e.clientX,e.clientY);setCursor(point);const d=drag.current;if(!d)return;if(d.id==="@pan"){setView(v=>({...v,x:d.nx-(e.clientX-d.x)/v.z,y:d.ny-(e.clientY-d.y)/v.z}));return;}if(running||!editable)return;onEdit(p=>{if(d.index!==undefined){const wire=p.wires.find(w=>w.id===d.id);if(wire)wire.bends[d.index]={x:Math.round(point.x/20)*20,y:Math.round(point.y/20)*20};}else{const n=p.nodes.find(n=>n.id===d.id);if(n){const aligned=alignNode(n,d.nx+(e.clientX-d.x)/view.z,d.ny+(e.clientY-d.y)/view.z,p.nodes);n.x=aligned.x;n.y=aligned.y;setGuides(aligned);}}},false);}}
      onPointerUp={()=>{drag.current=null;setGuides({});}} onPointerCancel={()=>{drag.current=null;setGuides({});}}>
      <defs><pattern id="dot-grid" width="20" height="20" patternUnits="userSpaceOnUse"><circle cx="0" cy="0" r=".8" fill="#b8c2cc"/></pattern></defs>
      <rect x={view.x-2000} y={view.y-2000} width={20000} height={20000} fill="#f7f9fa" className="canvas-background"/>
      {!printing&&<rect x={view.x-2000} y={view.y-2000} width={20000} height={20000} fill="url(#dot-grid)" pointerEvents="none"/>}
      {routes.map(({wire:w,points})=>{
        const phase=runtime.energized[w.from],live=running&&phase&&!["N","PE","-"].includes(phase),label=wireLabels.get(w.id),path=pathData(points),color=running?(live?"#258251":"#89939c"):"#34414c";
        return <g key={w.id} onPointerDown={e=>{if(space.current||e.button===1)return;e.stopPropagation();onSelect(w.id);}}>
          {debug&&<title>{`Kabel ${w.label||w.id} · ${w.from} → ${w.to} · ${runtime.energized[w.from]??"floating"} · ${(runtime.wireCurrent[w.id]??0).toFixed(3)} A · ${w.cable?.section??"?"} mm² · ${(runtime.cables[w.id]?.temperature??30).toFixed(1)} °C`}</title>}
          <path d={path} stroke="transparent" strokeWidth={16} fill="none" style={{cursor:"pointer"}}/>
          <path d={path} stroke="#f7f9fa" strokeWidth={live?7:6} fill="none" pointerEvents="none"/>
          <path d={path} stroke={selected===w.id?"#316a9c":runtime.injected[w.id+":short"]?"#c33636":color} strokeWidth={live?3.1:1.6} opacity={live?1:.78} fill="none" pointerEvents="none"/>
          {label&&<text className="wire-annotation" x={label.x+6} y={label.y+17} fill="#566676" fontSize="14" fontFamily="monospace">{label.lines.map((line,i)=><tspan key={i} x={label.x+6} dy={i?18:0}>{line}</tspan>)}</text>}
          {selected===w.id&&!running&&w.bends.map((point,i)=><circle key={i} cx={point.x} cy={point.y} r={6} fill="#91a4ff" stroke="#fff" onPointerDown={e=>{e.stopPropagation();if(!editable)return;onCheckpoint();drag.current={id:w.id,x:e.clientX,y:e.clientY,nx:point.x,ny:point.y,index:i};e.currentTarget.setPointerCapture(e.pointerId);}}/>)}
        </g>;
      })}
      {!printing&&guides.guideX!==undefined&&<line x1={guides.guideX} x2={guides.guideX} y1={view.y} y2={view.y+size.h/view.z} stroke="#488ab6" strokeWidth={1/view.z} strokeDasharray="5 5" pointerEvents="none"/>}
      {!printing&&guides.guideY!==undefined&&<line x1={view.x} x2={view.x+size.w/view.z} y1={guides.guideY} y2={guides.guideY} stroke="#488ab6" strokeWidth={1/view.z} strokeDasharray="5 5" pointerEvents="none"/>}
      {nodes.map(n=>{
        const s=nodeSize(n),state=stateOf(runtime,n),isSelected=n.id===selected,label=nodeLabels.get(n.id)!,momentary=["start","stop"].includes(kind(n));
        return <g key={n.id} transform={"translate("+n.x+" "+n.y+")"} role="button" tabIndex={0} aria-label={n.tag+" "+n.label+(running?" "+(state.tripped?"trip":state.on?"aktif":"tidak aktif"):"")} className="circuit-node"
          onKeyDown={e=>{if(!e.repeat&&(e.key==="Enter"||e.key===" ")){e.preventDefault();if(running)onInteract(n.id,momentary?true:undefined);else onSelect(n.id);}}}
          onKeyUp={e=>{if(running&&momentary&&(e.key==="Enter"||e.key===" ")){e.preventDefault();onInteract(n.id,false);}}}
          onPointerDown={e=>{if(space.current||e.button===1)return;e.stopPropagation();onSelect(n.id);if(running){onInteract(n.id,momentary?true:undefined);if(momentary)e.currentTarget.setPointerCapture(e.pointerId);return;}if(editable){onCheckpoint();drag.current={id:n.id,x:e.clientX,y:e.clientY,nx:n.x,ny:n.y};e.currentTarget.setPointerCapture(e.pointerId);}}}
          onPointerUp={e=>{if(running&&momentary){onInteract(n.id,false);e.stopPropagation();}drag.current=null;}}
          onPointerCancel={()=>{if(running&&momentary)onInteract(n.id,false);drag.current=null;}}>
          {debug&&<title>{`${n.tag} · ${state.voltage.toFixed(2)} V · ${state.current.toFixed(3)} A · ${state.tripped?"TRIP":state.on?"ON":"OFF"} · rating ${number(n,"rating")} A · thermal ${(state.heat*100).toFixed(0)}%`}</title>}
          <g transform={`rotate(${n.rotation} ${s.width/2} ${s.height/2})`}>
            <rect x={-12} y={-12} width={s.width+24} height={s.height+24} rx={5} fill={isSelected?"#243454":"#111922"} fillOpacity={isSelected?0.3:0} stroke={isSelected?"#8194f2":"transparent"} strokeDasharray={isSelected?"6 4":undefined} className="node-hit"/>
            {kind(n)!=="text"&&<Symbol node={n} runtime={running?runtime:undefined} rotation={n.rotation}/>}
            {ports(n).map(port=><g key={port.name}>
              <circle cx={port.x} cy={port.y} r={12} fill="transparent" className="terminal-hit" onPointerDown={e=>{if(space.current||e.button===1)return;e.stopPropagation();connect(pin(n,port.name));}} role="button" tabIndex={!running&&editable?0:-1} aria-label={n.tag+" terminal "+port.name} onKeyDown={e=>{if(e.key==="Enter"){e.stopPropagation();connect(pin(n,port.name));}}}/>
              <circle cx={port.x} cy={port.y} r={pending===pin(n,port.name)?6:3.5} fill={pending===pin(n,port.name)?"#4f79a5":"#f7f9fa"} stroke={running&&runtime.energized[pin(n,port.name)]?"#258251":"#7b8e9e"} strokeWidth={1.5} pointerEvents="none"/>
            </g>)}
          </g>
          <g className="node-annotation">
            <text x={label.x+label.w/2-n.x} y={label.y+18-n.y} textAnchor="middle" fill={running&&state.tripped?"#b9262e":"#223440"} fontFamily="monospace" fontSize={18} fontWeight={600}>{n.tag}{running&&state.tripped?" · TRIP":""}</text>
            <text x={label.x+label.w/2-n.x} y={label.y+38-n.y} textAnchor="middle" fill="#506273" fontSize={14}>{label.lines.map((line,i)=><tspan key={i} x={label.x+label.w/2-n.x} dy={i?18:0}>{line}</tspan>)}</text>
          </g>
          {ports(n).map(port=>{const label=terminalLabel(n,port.name);return <text key={port.name} className="terminal-label" x={label.x-n.x} y={label.y-n.y} textAnchor={label.anchor} fontSize="12" fontFamily="monospace" fill="#54697b" pointerEvents="none">{port.name}</text>;})}
        </g>;
      })}
      {start&&<path d={pathData([start,...bends,cursor])} fill="none" stroke="#91a4ff" strokeWidth={2.5} strokeDasharray="8 5" pointerEvents="none"/>}
      {!nodes.length&&<text x={100} y={180} fill="#9caec2" fontSize="25">Pilih komponen, lalu klik area gambar.</text>}
    </svg>
    {!printing&&nodes.length>15&&<button className="diagram-minimap" aria-label="Navigasi minimap" onClick={e=>{const rect=e.currentTarget.getBoundingClientRect(),x=box.x+(e.clientX-rect.left)/rect.width*box.w,y=box.y+(e.clientY-rect.top)/rect.height*box.h;setView(v=>({...v,x:x-size.w/v.z/2,y:y-size.h/v.z/2}));}}><svg viewBox={`${box.x} ${box.y} ${box.w} ${box.h}`}><rect x={box.x} y={box.y} width={box.w} height={box.h} fill="#f7f9fa"/>{routes.map(r=><path key={r.wire.id} d={pathData(r.points)} stroke="#9aabb8" strokeWidth={7} fill="none"/>)}{nodes.map(n=><rect key={n.id} x={n.x} y={n.y} width={nodeSize(n).width} height={nodeSize(n).height} fill="#566c7d"/>)}<rect x={view.x} y={view.y} width={size.w/view.z} height={size.h/view.z} fill="#2f74a3" fillOpacity={.15} stroke="#2f74a3" strokeWidth={10}/></svg></button>}
    {!printing&&<div className="canvas-caption"><span>{pending?"Klik terminal tujuan · klik area kosong untuk belokan · Esc batal":adding?"Klik untuk menempatkan "+CATALOG[adding].name:running?"Klik sakelar untuk menguji · tahan push button":editable?"Tarik komponen · klik terminal untuk menyambung":"Mode lihat & simulasi · edit dari PC/laptop"}</span><span>{Math.round(view.z*100)}%</span></div>}
  </div>;
}
