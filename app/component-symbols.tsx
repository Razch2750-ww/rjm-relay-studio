import { CATALOG, kind, nodeSize, poles, ports } from "../lib/circuit";
import type { Node } from "../lib/circuit";
import type { Runtime } from "../lib/simulator";
import { stateOf } from "../lib/simulator";

/** Precise schematic geometry, shared by palette, canvas, inspector and exports. */
export function extendedSymbol(n:Node,runtime:Runtime|undefined,mini:boolean,rotation:number,ink:string){
  const d=CATALOG[n.type],k=kind(n),{width:w,height:h}=nodeSize(n),ps=ports(n),s=runtime?stateOf(runtime,n):undefined;
  const text=(x:number,y:number,value:string,size=14)=><text x={x} y={y} textAnchor="middle" dominantBaseline="central" transform={`rotate(${n.type==="etc974"?(rotation>=180?180:0):-rotation} ${x} ${y})`} stroke="none" fill={ink} fontSize={size}>{value}</text>;
  if(n.type==="etc974"){
    const x=(terminal:number)=>ps[terminal-1].x,relay=(terminal:number,closed:boolean)=><g key={terminal} stroke={runtime&&closed?"#70dfa2":ink}><path d={`M${x(terminal)} 54V72M${x(terminal)} 112V142M${x(terminal)} 112L${x(terminal)+(closed?0:12)} ${closed?72:76}`}/><circle cx={x(terminal)} cy={72} r={2.5}/></g>;
    return <g className="etc974-diagram">
      <rect x={8} y={40} width={w-16} height={190} rx={12} fill="#000"/>
      {text(w/2,20,"ELITECH ETC-974",mini?27:24)}
      <path d={`M${x(1)} 142V54H${x(5)}`} stroke={runtime&&s?.on?"#9bb5ce":ink}/>
      <g stroke={runtime&&s?.defrost?"#70dfa2":ink}>
        <path d={`M${x(1)} 112L${x(2)} ${s?.defrost?112:86}M${x(2)} 112V142M${x(2)} 86H${x(3)}V142`}/>
        <circle cx={x(1)} cy={112} r={2.5}/><circle cx={x(2)} cy={112} r={2.5}/><circle cx={x(2)} cy={86} r={2.5}/>
      </g>
      {relay(4,!!s?.cool)}{relay(5,!!s?.fan)}
      {text((x(6)+x(7))/2,130,"Supply",14)}
      {text((x(8)+x(9))/2,112,"Pb2 · 8–9",12)}{text((x(9)+x(10))/2,130,"Pb1 · 9–10",12)}
      {ps.map((p,i)=><g key={p.name} className="controller-terminal">
        <rect x={p.x-20} y={142} width={40} height={50} fill="#11171d"/>
        {text(p.x,152,p.name,14)}<circle cx={p.x} cy={175} r={10}/><path d={`M${p.x-9} 172H${p.x+9}M${p.x-9} 178H${p.x+9}M${p.x} 192V${h}`}/>
        {i<5&&text(p.x,130,["Line","Def","N.C.","Comp","Fan"][i],12)}
      </g>)}
      <g className="copy-key"><title>Copy key · interface parameter, bukan terminal daya</title><path d="M447 178V164L452 158H464L470 164V178Z"/><rect x={451} y={167} width={15} height={5}/><path d="M454 167v5m4-5v5m4-5v5"/>{text(458,192,"Copy",10)}{text(458,204,"key",10)}</g>
    </g>;
  }
  if(d.winding)return <>
    {ps.filter(p=>p.name!=="PE").map(p=><path key={p.name} d={`M${p.x} ${p.y}V${p.y===0?40:h-40}`}/>)}
    <circle cx={w/2} cy={h/2} r={39}/>{text(w/2,h/2-10,"M3~",22)}
    {text(w/2,h/2+14,d.winding==="star-delta"?"Y / Δ":d.winding==="two-speed"?"2 SPEED":"Δ / YY",11)}
    <path d={`M${w-18} ${h/2}H${w}M${w-18} ${h/2-9}v18m-5-14v10`}/>
    {s?.on&&text(w/2,h/2+64,s.stage==="low-speed"?"LOW":s.stage==="high-speed"?"HIGH":s.stage.toUpperCase(),11)}
  </>;
  if(k==="isolator"||d.symbol==="switch-fuse"||d.symbol==="thermal"||d.symbol==="magnetic"||d.residual||k==="rcd"){
    const closed=s?s.on:!!n.params.on;
    return <>{Array.from({length:poles(n)},(_,i)=>{const x=ps[i].x;return <g key={i}>
      <path d={`M${x} 0V30M${x} 82V${h}M${x} 82L${x+(closed?0:17)} 32`}/>
      {d.symbol==="switch-fuse"&&<rect x={x-6} y={42} width={12} height={22} transform={closed?undefined:`rotate(18 ${x} 53)`}/>}
      {d.symbol==="thermal"&&<path d={`M${x-9} 57h6v-6h6v12h6`}/>}
      {(d.symbol==="magnetic"||d.residual)&&<path d={`M${x-10} 57l6-8 6 8h-12`}/>}
      {d.symbol==="load-switch"&&<path d={`M${x-7} 30h14m-7-6v12`}/>}
      {d.symbol==="isolator"&&<circle cx={x} cy={30} r={3}/>}</g>;})}
      {poles(n)>1&&<path d={`M${ps[0].x} 62H${ps[poles(n)-1].x}`} strokeDasharray="4 4"/>}
      {(k==="rcd"||d.residual)&&<><ellipse cx={w/2} cy={100} rx={poles(n)*18} ry={7}/>{text(w/2,18,"IΔ",12)}</>}
    </>;
  }
  if(k==="auxiliary"||k==="timedContact"||d.contact&&k!=="contactor"||["push","limit","rotary","key","switch"].includes(d.symbol??"")){
    const mode=d.contact??(k==="stop"?"NC":"NO"),active=k==="auxiliary"||k==="timedContact"?!!s?.on:k==="start"||k==="stop"?!!runtime?.manual[n.id]:!!(runtime?.manual[n.id]??n.params.on);
    const mark=d.symbol??(d.timing?"timer":"aux");
    return <>{ps.map(p=><path key={p.name} d={`M${p.x} ${p.y}V${p.y===0?30:82}`}/>)}
      {mode==="changeover"?<path d={`M${w/2} 30L${w/2+(active?20:-20)} 82`}/>:Array.from({length:mode==="NO+NC"?2:1},(_,i)=>{const x=ps[i].x,nc=mode==="NC"||i===1,closed=nc?!active:active;return <g key={i}><path d={`M${x} 82L${x+(closed?0:18)} 30`}/>{nc&&<path d={`M${x-7} 30h14`}/>}</g>;})}
      {mode==="NO+NC"&&<path d={`M${ps[0].x} 56H${ps[1].x}`} strokeDasharray="3 4"/>}
      {mark==="push"&&<path d={`M12 46v20m0-10h22`} strokeDasharray="3 3"/>}
      {mark==="limit"&&<path d="M10 61h20l7-12m-27 5v14"/>}
      {mark==="rotary"&&<><circle cx={17} cy={56} r={8}/><path d="M17 47v-8m0 25v8m8-16h10"/></>}
      {mark==="key"&&<><circle cx={12} cy={56} r={6}/><path d="M18 56h18m-10 0v6m6-6v6"/></>}
      {mark==="switch"&&<path d="M10 52h22m-22-7v14" strokeDasharray="3 3"/>}
      {d.timing&&<><path d="M18 44q-15 12 0 24m-4-12h20"/>{text(w/2,104,d.timing==="on"?"t↑":"t↓",13)}</>}
    </>;
  }
  if(k==="junction"&&d.junctionPorts)return <>{ps.map(p=><path key={p.name} d={`M${p.x} ${p.y}L${w/2} ${h/2}`}/>)}{ps.length>2&&<circle cx={w/2} cy={h/2} r={4} fill={ink}/>}</>;
  if(k==="bus"&&d.symbol){
    if(d.symbol==="phase")return <><path d={`M40 30V40`}/><circle cx={40} cy={16} r={14}/>{text(40,16,String(n.params.net),13)}</>;
    if(d.symbol==="earth")return <><path d="M40 40V20m-18 0h36m-30-6h24m-18-6h12"/></>;
    return <><path d="M40 40V6"/><path d={d.symbol==="arrow-down"?"M30 14h20l-10 16z":"M30 25h20L40 9z"} fill={ink}/></>;
  }
  if(k==="diode")return <><path d={`M${w/2} 0V40M${w/2} 76V${h}M${w/2-17} 40h34l-17 36zM${w/2-18} 76h36`}/></>;
  if(k==="converter")return <>{ps.map(p=><path key={p.name} d={`M${p.x} ${p.y}V${p.y===0?20:h-20}`}/>)}<rect x={12} y={20} width={w-24} height={h-40}/><path d={`M12 ${h-20}L${w-12} 20`}/>{text(38,44,"~",25)}{text(w-36,h-44,"=",23)}</>;
  if(k==="spd")return <><rect x={10} y={28} width={w-20} height={54}/>{ps.map(p=><path key={p.name} d={`M${p.x} ${p.y}V${p.name==="PE"?82:28}`}/>)}<path d={`M${w/2-15} 42h30l-15 28z`}/></>;
  if(d.symbol==="battery")return <><path d={`M${ps[0].x} ${h}V42H${w/2-8}M${ps[1].x} ${h}V42H${w/2+8}M${w/2-8} 22v40m16-30v20`}/>{text(w/2,82,"DC",17)}</>;
  if(d.symbol==="bell"||d.symbol==="siren")return <><path d={`M${w/2} 0V32M${w/2} 80V${h}`}/>{d.symbol==="bell"?<path d={`M${w/2-20} 72h40l-5-8V50a15 15 0 0 0-30 0v14zM${w/2-5} 78h10`}/>:<path d={`M${w/2-20} 45h15l25-17v54L${w/2-5} 65h-15z`}/>}</>;
  return null;
}
