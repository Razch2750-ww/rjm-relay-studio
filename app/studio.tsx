"use client";
import { simulationWorker } from "../lib/browser-worker";
import { newId } from "../lib/id";
import { addWireBend } from "../lib/wire-routing";
import { layoutDiagram } from "../lib/diagram-layout";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { CircuitBoard,Play,Pause,RotateCcw,Undo2,Redo2,Download,Upload,FolderOpen,Plus,ZoomIn,ZoomOut,Maximize2,Trash2,Copy,RotateCw,Cloud,WifiOff,Search,FileText,MousePointer2,Cable,Settings2,ShieldAlert,Check,Printer,ChevronLeft,ChevronRight,ChevronUp,ChevronDown,Expand,Shrink } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { Tabs,TabsList,TabsTrigger,TabsContent } from "@/components/ui/tabs";
import { Dialog,DialogContent,DialogHeader,DialogTitle,DialogDescription } from "@/components/ui/dialog";
import { AlertDialog,AlertDialogContent,AlertDialogHeader,AlertDialogTitle,AlertDialogDescription,AlertDialogFooter,AlertDialogCancel,AlertDialogAction } from "@/components/ui/alert-dialog";
import { Sheet as Drawer,SheetContent,SheetHeader,SheetTitle } from "@/components/ui/sheet";
import { Toaster } from "@/components/ui/sonner";
import { toast } from "sonner";
import { CATALOG,CATEGORIES,CATEGORY_COLORS,blankProject,kind,newNode,nodeSize,validateProject,pin,selectorPositions,defaultCable,nextTag,projectSheets,ports,number } from "../lib/circuit";
import type { Node,Project,Sheet } from "../lib/circuit";
import { freshRuntime,interact,stateOf,stepCircuit,advanceCircuit } from "../lib/simulator";
import { cableSizingMode,sizeProjectCables } from "../lib/cable-sizing";
import { cableCapacity } from "../lib/engine/cable";
import { nominalCurrent } from "../lib/engine/load";
import { terminalName,simulationRecord } from "../lib/reports";
import { svgPNG } from "../lib/browser-exports";
import Engineering from "./engineering";
import PanelDesigner from "./panel-designer";
import { PROJECT_PRESETS, projectReferences } from "../lib/project-presets";
import type { PresetId } from "../lib/project-presets";
import { useWorkspace } from "./use-workspace";
import { Schematic,Symbol } from "./schematic";
import { WIRE_COLORS, WIRE_COLOR_LABELS } from "../lib/wire-colors";
import Calculator,{Choice,Numeric} from "./calculator";

const numberText=(n:number,d=1)=>n.toLocaleString("id-ID",{maximumFractionDigits:d});
const PARAM_LABELS:Record<string,string>={offDuration:"Durasi NC (detik)",onDuration:"Durasi NO (detik)",neutralRequired:"Netral wajib tersambung",voltage:"Tegangan nominal (V)",rating:"Rating / setelan (A)",curve:"Kurva pengaman",on:"Posisi awal ON",va:"Beban coil (VA)",delay:"Delay (detik)",current:"Arus nominal (A)",powerFactor:"Faktor daya",loadFactor:"Faktor beban (×)",startFactor:"Pengali arus start",startSeconds:"Durasi start (detik)",watts:"Daya listrik (W)",value:"Suhu sensor (°C)",setpoint:"Setpoint (°C)",differential:"Differential (°C)",restartDelay:"Jeda restart (detik)",defrostInterval:"Interval defrost (detik)",defrostDuration:"Maksimum defrost (detik)",defrostEnd:"Suhu akhir defrost (°C)",drip:"Waktu tetes (detik)",fanDelay:"Jeda fan (detik)",fanWithComp:"Fan mengikuti compressor",minVoltage:"Batas tegangan PFR (V)",expected:"Urutan fase yang diharapkan",position:"Posisi awal",net:"Nama koneksi antarlembar",thermalSeconds:"Konstanta trip model (detik)",leakageMA:"Kebocoran simulasi (mA)",thresholdMA:"Ambang RCCB (mA)",color:"Warna lampu"};
Object.assign(PARAM_LABELS,{inputMode:"Input beban",hp:"Daya HP / PK",hpUnit:"Satuan daya",hpBasis:"Dasar daya · shaft=poros",efficiency:"Efisiensi",lra:"LRA / arus start nameplate (A)",fanCount:"Jumlah fan identik",startingMethod:"Metode starting",tripSetting:"Setelan Ir (A)",magnetic:"Magnetic (× Ir)",breakingKA:"Breaking capacity (kA)",faultKA:"Isc prospektif sumber (kA)",frequency:"Frekuensi (Hz · 0 = DC / bebas)",maxVoltage:"Batas atas PFR (V)",imbalance:"Batas imbalance (%)",resetMode:"Reset mode",coolingSeconds:"Waktu pendinginan model (s)",minCurrent:"Range minimum (A)",maxCurrent:"Range maksimum (A)",highAlarm:"Alarm suhu tinggi (°C)",lowAlarm:"Alarm suhu rendah (°C)",pressureType:"Jenis pressure switch",cutOut:"Cut-out (bar)",cutIn:"Cut-in (bar)",contact:"Kontak normal",mapping:"Mapping posisi → pasangan terminal",schedule:"Jadwal · hari@HH:MM-HH:MM",override:"Manual override",secondary:"Tegangan sekunder (V)",roomBinding:"Probe thermal ruangan",wire:"ID kabel CT",brand:"Brand",model:"Model",physicalWidth:"Lebar fisik (mm)",physicalHeight:"Tinggi fisik (mm)"});
function download(content:string,name:string,type="application/json"){
  const url=URL.createObjectURL(new Blob([content],{type})),a=document.createElement("a");a.href=url;a.download=name;a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);
}
function filename(name:string){return name.replace(/[^a-zA-Z0-9_-]+/g,"_").slice(0,90)||"rangkaian";}
type PanelSide = "left" | "right" | "top" | "bottom";
type PanelLayout = Record<PanelSide,boolean>;
const PANEL_LAYOUT_KEY = "rjm-relay-panel-layout-v1";
const OPEN_PANELS:PanelLayout = {left:false,right:false,top:false,bottom:false};
const CLOSED_PANELS:PanelLayout = {left:true,right:true,top:true,bottom:true};
const PANEL_NAMES = {left:"kiri",right:"kanan",top:"atas",bottom:"bawah"};
function PanelToggle({side,collapsed,onToggle,rail=false}:{side:PanelSide;collapsed:boolean;onToggle:()=>void;rail?:boolean}){
  const Icon = side==="left"?(collapsed?ChevronRight:ChevronLeft):side==="right"?(collapsed?ChevronLeft:ChevronRight):side==="top"?(collapsed?ChevronDown:ChevronUp):(collapsed?ChevronUp:ChevronDown);
  const label = `${collapsed?"Buka":"Minimalkan"} panel ${PANEL_NAMES[side]}`;
  return <Button variant="ghost" className={"panel-toggle "+(rail&&collapsed?"rail-toggle":"")} aria-label={label} title={label} aria-expanded={!collapsed} aria-controls={`panel-${side}-content`} onClick={onToggle}>
    <Icon size={17}/>{rail&&collapsed&&<span className="rail-label">{side==="left"?"Komponen":"Properti"}</span>}
  </Button>;
}
export default function Studio(){
  const data=useWorkspace(),sourceProject=data.workspace?.entries.find(e=>e.document.id===data.workspace?.active&&!e.deleted)?.document??data.workspace?.entries.find(e=>!e.deleted)?.document;
  const sized=useMemo(()=>sourceProject?sizeProjectCables(sourceProject):undefined,[sourceProject]),project=sized?.project;
  const projectRef=useRef(project);useEffect(()=>{projectRef.current=project;},[project]);
  const [tab,setTab]=useState("power"),[selected,setSelected]=useState<string|null>(null),[adding,setAdding]=useState<string|null>(null),[running,setRunning]=useState(false),[runtime,setRuntime]=useState(freshRuntime),[speed,setSpeed]=useState(1),[query,setQuery]=useState(""),[category,setCategory]=useState("Semua"),[desktop,setDesktop]=useState(true);
  const [projectsOpen,setProjectsOpen]=useState(false),[drawerOpen,setDrawerOpen]=useState(false),[confirm,setConfirm]=useState<"node"|"project"|null>(null),[printing,setPrinting]=useState(false);
  const [canvasAction,setCanvasAction]=useState({id:0,action:"fit"}),[history,setHistory]=useState({past:0,future:0});
  const [engineeringView,setEngineeringView]=useState("overview"),[debug,setDebug]=useState(false);
  const runtimeRef=useRef(runtime);useEffect(()=>{runtimeRef.current=runtime;},[runtime]);
  const openEngineering=(view:string)=>{if(view==="check"&&projectRef.current)setRuntime(r=>stepCircuit(projectRef.current!,r,0));setEngineeringView(view);setTab("simulation");setAdding(null);};
  const locate=(id:string)=>{const p=projectRef.current,n=p?.nodes.find(n=>n.id===id)??p?.nodes.find(n=>p.wires.find(w=>w.id===id)?.from.startsWith(n.id+":"));if(n){setTab(n.sheet);setSelected(id);setCollapsedPanels(c=>({...c,right:false}));setCanvasAction(x=>({id:x.id+1,action:"focus:"+n.id}));}};
  const [collapsedPanels,setCollapsedPanels]=useState<PanelLayout>(OPEN_PANELS),[layoutReady,setLayoutReady]=useState(false);
  const beforeFocus=useRef<PanelLayout>(OPEN_PANELS);
  const focusMode=Object.values(collapsedPanels).every(Boolean);
  const togglePanel=(side:PanelSide)=>setCollapsedPanels(p=>({...p,[side]:!p[side]}));
  const toggleFocus=()=>{
    if(focusMode)setCollapsedPanels(beforeFocus.current);
    else {beforeFocus.current=collapsedPanels;setCollapsedPanels(CLOSED_PANELS);}
  };
  // Layout preferences belong to this browser, separately from circuit/project data.
  useEffect(()=>{
    try{
      const saved=JSON.parse(localStorage.getItem(PANEL_LAYOUT_KEY)??"null");
      if(saved&&typeof saved==="object")setCollapsedPanels({left:saved.left===true,right:saved.right===true,top:saved.top===true,bottom:saved.bottom===true});
    }catch{}
    setLayoutReady(true);
  },[]);
  useEffect(()=>{if(layoutReady)try{localStorage.setItem(PANEL_LAYOUT_KEY,JSON.stringify(collapsedPanels));}catch{}},[collapsedPanels,layoutReady]);
  const past=useRef<Project[]>([]),future=useRef<Project[]>([]),fileInput=useRef<HTMLInputElement>(null),timer=useRef<ReturnType<typeof setInterval>|null>(null);
  const checkpoint=()=>{if(!projectRef.current)return;past.current.push(structuredClone(projectRef.current));past.current=past.current.slice(-25);future.current=[];setHistory({past:past.current.length,future:0});};
  const edit=(fn:(p:Project)=>void,record=true)=>{const current=projectRef.current;if(!current)return;if(record)checkpoint();const copy=structuredClone(current);fn(copy);const resolved=sizeProjectCables(copy).project;data.update(resolved);projectRef.current=resolved;};
  const reset=()=>{setRunning(false);setRuntime(freshRuntime());};
  const action=(name:string)=>setCanvasAction(x=>({id:x.id+1,action:name}));
  const exportProject=useCallback(()=>{const p=projectRef.current;if(!p)return;try{const saved={...p,...(runtimeRef.current.now>0?{simulation:simulationRecord(runtimeRef.current,p.simulation?.scenarios)}:{})};validateProject(saved);download(JSON.stringify(saved,null,2),filename(p.name)+".rjm.json");toast.success("File project diunduh.");}catch{toast.error("Ada data tidak valid. Periksa isian sebelum ekspor.");}},[]);
  const undo=(redo=false)=>{const p=projectRef.current;if(!p||running)return;const from=redo?future.current:past.current,to=redo?past.current:future.current,target=from.pop();if(target){to.push(structuredClone(p));data.update(target);projectRef.current=target;setHistory({past:past.current.length,future:future.current.length});setSelected(null);}};
  // eslint-disable-next-line react-hooks/set-state-in-effect -- Subscribe to the browser viewport after hydration.
  useEffect(()=>{const mq=window.matchMedia("(min-width: 900px)");setDesktop(mq.matches);const change=()=>setDesktop(mq.matches);mq.addEventListener("change",change);return()=>mq.removeEventListener("change",change);},[]);
  // eslint-disable-next-line react-hooks/set-state-in-effect -- Transient engine/history state belongs to one document identity.
  useEffect(()=>{reset();setSelected(null);past.current=[];future.current=[];setHistory({past:0,future:0});},[project?.id]);
  useEffect(()=>{
    if(!running)return;
    const worker=simulationWorker();
    let pending=false,base=runtimeRef.current,document=projectRef.current;
    worker.onmessage=({data})=>{
      if(data.ready)return;
      pending=false;
      if(data.error){setRunning(false);toast.error(data.error);return;}
      // A click, parameter edit, project switch or reset invalidates the in-flight tick.
      if(document===projectRef.current)setRuntime(previous=>previous===base?data.runtime:previous);
    };
    worker.onerror=()=>{setRunning(false);toast.error("Mesin simulasi tidak dapat dimuat. Muat ulang halaman.");};
    timer.current=setInterval(()=>{if(pending||!projectRef.current)return;pending=true;base=runtimeRef.current;document=projectRef.current;worker.postMessage({type:"advance",project:document,runtime:base,seconds:.1*speed});},100);
    return()=>{if(timer.current)clearInterval(timer.current);worker.terminate();};
  },[running,speed,project?.id]);
  // eslint-disable-next-line react-hooks/set-state-in-effect -- Stop the clock and notify when the engine reports an electrical fault.
  useEffect(()=>{if(runtime.halted&&running){setRunning(false);toast.error("Simulasi dihentikan. Periksa diagnostik.");}},[runtime.halted,running]);
  useEffect(()=>{const stop=()=>{const p=projectRef.current;if(p)setRuntime(r=>{let next=r;for(const n of p.nodes)if(["start","stop"].includes(kind(n)))next=interact(p,next,n.id,false);return next;});};window.addEventListener("blur",stop);return()=>window.removeEventListener("blur",stop);},[]);
  useEffect(()=>{
    const key=(e:KeyboardEvent)=>{
      const typing=(e.target as Element)?.closest("input,textarea,select,[contenteditable=true]");
      if(e.key==="Escape"){setAdding(null);action("escape");if(focusMode&&!projectsOpen&&!drawerOpen&&!confirm&&!data.conflicts.length)setCollapsedPanels(beforeFocus.current);}
      if((e.ctrlKey||e.metaKey)&&e.key.toLowerCase()==="s"){e.preventDefault();exportProject();return;}
      if(typing||!desktop)return;
      if((e.ctrlKey||e.metaKey)&&e.key.toLowerCase()==="z"){e.preventDefault();undo(e.shiftKey);}
      if((e.ctrlKey||e.metaKey)&&e.key.toLowerCase()==="y"){e.preventDefault();undo(true);}
      if(e.key==="Delete"&&selected&&!running)setConfirm("node");
      if(e.key.toLowerCase()==="r"&&selected&&!running)edit(p=>{const n=p.nodes.find(n=>n.id===selected);if(n)n.rotation=(n.rotation+90)%360;});
    };
    window.addEventListener("keydown",key);return()=>window.removeEventListener("keydown",key);
  });
  useEffect(()=>{const handler=()=>setPrinting(false);window.addEventListener("afterprint",handler);return()=>window.removeEventListener("afterprint",handler);},[]);
  const runInteraction=(id:string,pressed?:boolean)=>{if(!project)return;setRuntime(r=>interact(project,r,id,pressed));};
  const operationEvents=(n:Node)=>{
    const momentary=["start","stop"].includes(kind(n));
    return {
      onPointerDown:(e:React.PointerEvent<HTMLButtonElement>)=>{if(e.button!==0)return;e.currentTarget.setPointerCapture(e.pointerId);runInteraction(n.id,momentary?true:undefined);},
      onPointerUp:()=>{if(momentary)runInteraction(n.id,false);},
      onPointerCancel:()=>{if(momentary)runInteraction(n.id,false);},
      onKeyDown:(e:React.KeyboardEvent<HTMLButtonElement>)=>{if(!e.repeat&&(e.key===" "||e.key==="Enter")){e.preventDefault();runInteraction(n.id,momentary?true:undefined);}},
      onKeyUp:(e:React.KeyboardEvent<HTMLButtonElement>)=>{if(momentary&&(e.key===" "||e.key==="Enter")){e.preventDefault();runInteraction(n.id,false);}},
    };
  };
  const place=(type:string,x:number,y:number)=>{
    if(!project||!desktop||running)return;
    if(project.nodes.length>=500){toast.error("Batas 500 komponen per project.");return;}
    const n=newNode(type,tab as Sheet,x,y,nextTag(project,type));edit(p=>p.nodes.push(n));setAdding(null);setSelected(n.id);
  };
  const addProject=(type:"blank"|PresetId)=>{
    if((data.workspace?.entries.length??0)>=90){toast.error("Terlalu banyak project di perangkat; ekspor dan rapikan dulu.");return;}
    const p=PROJECT_PRESETS.find(p=>p.id===type)?.create()??blankProject();data.update(p);setProjectsOpen(false);setTab(type==="dol"?"control":"power");reset();
  };
  const importFile=async(file:File)=>{
    if((data.workspace?.entries.length??0)>=90){toast.error("Batas project di perangkat tercapai.");return;}
    if(file.size>2_000_000){toast.error("File maksimal 2 MB.");return;}
    try{const p=validateProject(JSON.parse(await file.text()));p.id=newId();p.name=(p.name+" · impor").slice(0,120);data.update(p);reset();toast.success("Diimpor sebagai project baru; versi lama tetap ada.");}catch{toast.error("Bukan file project RJM yang valid. Data lama tidak diubah.");}
  };
  const exportSVG=()=>{
    const svg=document.getElementById("circuit-canvas") as SVGSVGElement|null;if(!svg||!project)return;
    const clone=svg.cloneNode(true) as SVGSVGElement,{bounds}=layoutDiagram(project,tab as Sheet);
    clone.setAttribute("viewBox",[bounds.x,bounds.y,bounds.w,bounds.h].join(" "));clone.setAttribute("width",String(Math.ceil(bounds.w)));clone.setAttribute("height",String(Math.ceil(bounds.h)));
    clone.querySelectorAll('[tabindex]').forEach(el=>el.removeAttribute("tabindex"));
    download(new XMLSerializer().serializeToString(clone),filename(project.name)+"_"+tab+".svg","image/svg+xml");
  };
  const exportPNG=async()=>{const svg=document.getElementById("circuit-canvas") as SVGSVGElement|null;if(!svg||!project)return;const clone=svg.cloneNode(true) as SVGSVGElement,{bounds}=layoutDiagram(project,tab as Sheet);clone.setAttribute("viewBox",[bounds.x,bounds.y,bounds.w,bounds.h].join(" "));try{await svgPNG(clone,filename(project.name)+"_"+tab);}catch{toast.error("PNG gagal dibuat; coba ekspor SVG.");}};
  // Expose only the real read-only circuit inspection path; unsupported browsers simply omit this.
  useEffect(()=>{
    const context=(document as unknown as {modelContext?:{registerTool:(tool:unknown,options:unknown)=>Promise<void>|void}}).modelContext;
    if(!context?.registerTool)return;const lifecycle=new AbortController();
    const tool={name:"read_relay_project",title:"Baca rangkaian aktif",description:"Baca komponen dan kabel project aktif; tidak mengubah atau menjalankan simulasi.",inputSchema:{type:"object",properties:{},additionalProperties:false},annotations:{readOnlyHint:true,untrustedContentHint:true},execute:(input:unknown)=>{if(!input||typeof input!=="object"||Object.keys(input).length)throw new Error("Gunakan objek kosong.");const p=projectRef.current;return p?{name:p.name,nodes:p.nodes.map(n=>({id:n.id,tag:n.tag,type:n.type,sheet:n.sheet})),wires:p.wires.map(w=>({from:w.from,to:w.to})),notes:p.notes}:{error:"Belum ada project aktif."};}};
    try{void Promise.resolve(context.registerTool(tool,{signal:lifecycle.signal})).catch(()=>{});}catch{}return()=>lifecycle.abort();
  },[]);
  const currentNode=project?.nodes.find(n=>n.id===selected),currentWire=project?.wires.find(w=>w.id===selected),selectedState=currentNode?stateOf(runtime,currentNode):null;
  const wireSizing=currentWire?sized?.recommendations.get(currentWire.id):undefined;
  const selectedDefinition=currentNode?CATALOG[currentNode.type]:null;
  const updateParam=(key:string,value:string|number|boolean)=>{
    if(!currentNode)return;
    if(running&&typeof value==="number"){setRuntime(r=>stepCircuit(project!,{...r,values:{...r.values,[currentNode.id+":"+key]:value}},0));return;}
    edit(p=>{const n=p.nodes.find(x=>x.id===selected);if(n)n.params[key]=value;});
  };
  const renameTag=(value:string)=>{if(!value.trim()||!currentNode)return;edit(p=>p.nodes.forEach(n=>{if(n.tag===currentNode.tag)n.tag=value.slice(0,32);}));};
  const inspector=<div className="inspector-content">
    {currentNode&&selectedDefinition?<>
      <div className="inspector-symbol"><svg viewBox={"-15 -10 "+(nodeSize(currentNode).width+30)+" "+(nodeSize(currentNode).height+20)}><Symbol node={currentNode} runtime={running?runtime:undefined}/></svg></div>
      <h2>{currentNode.tag}</h2><p>{selectedDefinition.description}</p>
      {running&&<div className={"device-status "+(selectedState?.tripped?"fault":"")}><span>{selectedState?.tripped?"TRIP":selectedState?.on?"AKTIF":"TIDAK AKTIF"}</span><span>{numberText(selectedState?.voltage??0)} V · {numberText(selectedState?.current??0,3)} A</span></div>}
      {!running&&desktop&&<><label className="field"><span>Tag perangkat · ikut tertaut</span><Input value={currentNode.tag} maxLength={32} onChange={e=>renameTag(e.target.value)}/></label><label className="field"><span>Keterangan</span><Input value={currentNode.label} maxLength={160} onChange={e=>edit(p=>{p.nodes.find(n=>n.id===selected)!.label=e.target.value;})}/></label></>}
      {Object.entries({...selectedDefinition.defaults,...currentNode.params}).map(([key,value])=>{
        const label=PARAM_LABELS[key]??key;
        if(running&&!["value","current","watts","loadFactor","setpoint","leakageMA","voltage","frequency"].includes(key))return null;
        if(typeof value==="number")return <Numeric key={key} label={label} disabled={!desktop&&!running} value={running?(runtime.values[currentNode.id+":"+key]??value):value} min={["value","setpoint","defrostEnd","lowAlarm","highAlarm"].includes(key)?-100:0} max={["powerFactor","efficiency"].includes(key)?1:1000000} onChange={v=>updateParam(key,v)}/>;
        if(typeof value==="boolean")return <div key={key} className="switch-field"><label htmlFor={"prop-"+key}>{label}</label><Switch id={"prop-"+key} checked={value} disabled={!desktop||running} onCheckedChange={v=>updateParam(key,v)}/></div>;
        const options=key==="curve"?["B","C","D"]:key==="inputMode"?["nameplate","quick"]:key==="hpUnit"?["HP","PK"]:key==="hpBasis"?["shaft","cooling"]:key==="resetMode"?["manual","auto"]:key==="startingMethod"?["DOL","star-delta","soft-start"]:key==="pressureType"?["HP","LP"]:key==="contact"?["NC","NO"]:key==="override"?["AUTO","ON","OFF"]:key==="roomBinding"?["","room","evaporator"]:key==="position"?[...selectorPositions(currentNode)].reverse():key==="expected"?["any","RST","TSR"]:null;
        return <label className="field" key={key}><span>{label}</span>{options?<Choice label={label} disabled={!desktop||running} value={String(value)} onChange={v=>updateParam(key,v)} options={options.map(v=>({value:v,label:v==="any"?"Kehadiran fase saja":v}))}/>:<Input type={key==="color"?"color":"text"} value={String(value)} maxLength={key==="schedule"||key==="mapping"?2000:120} disabled={!desktop||running} onChange={e=>updateParam(key,e.target.value)}/>}</label>;
      })}
      {!running&&!Object.hasOwn(currentNode.params,"rating")&&["source","switch","start","stop","estop","no","nc","pressure","selector","limit","changeover","pfr","terminal","meter"].includes(kind(currentNode))&&<Numeric label="Rating kontak / perangkat (A · isi datasheet)" value={0} min={0} max={100000} disabled={!desktop} onChange={v=>updateParam("rating",v)}/>}
      {running&&kind(currentNode)==="source"&&<Choice label="Simulasi fase hilang" value={String(runtime.manual[currentNode.id+":phase"]??"normal")} onChange={v=>setRuntime(r=>stepCircuit(project!,{...r,manual:{...r.manual,[currentNode.id+":phase"]:v}},0))} options={["normal","R","S","T"].map(v=>({value:v,label:v==="normal"?"Semua fase normal":"Hilangkan fase "+v}))}/>}
      {running&&kind(currentNode)==="probe"&&<Button variant="outline" onClick={()=>setRuntime(r=>stepCircuit(project!,{...r,manual:{...r.manual,[currentNode.id+":fault"]:!r.manual[currentNode.id+":fault"]}},0))}>Putus / pulihkan sensor</Button>}
      {running&&!["motor","heater","lamp","buzzer","valve","probe","text","bus","terminal","no","nc","changeover","contactor","coil","ton","toff","impulse","cyclic","junction"].includes(kind(currentNode))&&<Button variant="outline" {...operationEvents(currentNode)}>{kind(currentNode)==="controller"?"Mulai defrost manual":"Operasikan / reset"}</Button>}
      {kind(currentNode)==="motor"&&<p>Arus acuan: {numberText(nominalCurrent(currentNode).current,2)} A {nominalCurrent(currentNode).estimated?"· estimasi HP/PK poros":"· nameplate"}. {nominalCurrent(currentNode).error??""}</p>}
      {["overload","breaker"].includes(kind(currentNode))&&running&&<p>Thermal level: {numberText(Math.min(1,selectedState?.heat??0)*100,0)}% <progress max={1} value={selectedState?.heat??0}/></p>}
      <details><summary>Terminal & cross-reference</summary>{ports(currentNode).map(t=><p className="mono" key={t.name}>{currentNode.tag}-{t.name}</p>)}{project!.nodes.filter(n=>n.tag===currentNode.tag&&n.id!==currentNode.id).map(n=><Button key={n.id} variant="ghost" onClick={()=>locate(n.id)}>{n.sheet} · {n.label} · {String.fromCharCode(65+Math.floor(n.x/300)%26)}{Math.floor(n.y/300)+1}</Button>)}</details>
      {!running&&desktop&&<div className="inspector-actions"><Button variant="outline" size="sm" onClick={()=>edit(p=>{p.nodes.find(n=>n.id===selected)!.rotation=(currentNode.rotation+90)%360;})}><RotateCw/>Putar</Button><Button variant="outline" size="sm" onClick={()=>edit(p=>{if(p.nodes.length<500)p.nodes.push({...structuredClone(currentNode),id:newId(),tag:nextTag(p,currentNode.type),x:currentNode.x+160,y:currentNode.y+40});})}><Copy/>Salin</Button><Button variant="outline" size="sm" onClick={()=>setConfirm("node")}><Trash2/>Hapus</Button></div>}
    </>:currentWire?<>
      <h2>Kabel {currentWire.label||"tanpa nomor"}</h2><p className="mono">{terminalName(project!,currentWire.from)}<br/>{terminalName(project!,currentWire.to)}</p>
      <p>{numberText(runtime.wireCurrent[currentWire.id]??0,3)} A · {runtime.cables[currentWire.id]?.status??"Belum diuji"}</p>
      <p>{runtime.cables[currentWire.id]?`${numberText(runtime.cables[currentWire.id].temperature)} °C · drop ${numberText(runtime.cables[currentWire.id].drop,3)} V`:""}</p>
      <p>Warna mengikuti fase sumber, termasuk saat suplai OFF. Pilihan warna dipakai bila jalur belum terhubung ke sumber.</p><h3>Spesifikasi kabel</h3>
      <Choice label="Ukuran kabel" value={cableSizingMode(currentWire)} disabled={running||!desktop} onChange={v=>edit(p=>{const w=p.wires.find(w=>w.id===selected)!;w.cable={...(w.cable??defaultCable),sizing:v as "auto"|"manual"};})} options={[{value:"auto",label:"Otomatis · ikuti beban"},{value:"manual",label:"Manual · ukuran sendiri"}]}/>
      {wireSizing&&<div className="cable-sizing-summary" role="status"><strong>{wireSizing.section!==null?`Rekomendasi ${numberText(wireSizing.section)} mm²`:"Data hitungan belum lengkap"}</strong><span>Ib {numberText(wireSizing.current,3)} A · In {numberText(wireSizing.protection)} A</span><span>Drop total jalur {numberText(wireSizing.dropPercent,2)}% / {project!.calculation.maxDrop}%</span>{wireSizing.estimated&&<span>Memakai estimasi beban.</span>}{wireSizing.messages.map(message=><span key={message} className="sizing-note">{message}</span>)}</div>}
      <p>Kapasitas {cableCapacity(currentWire.cable??defaultCable)?.toFixed(1)??"perlu datasheet"} A. Tabel Cu/PVC, tiga konduktor berbeban. Panjang di bawah adalah panjang fisik kabel, bukan panjang garis.</p>
      <Numeric label="Batas drop total jalur (%)" value={project!.calculation.maxDrop} min={.1} max={20} disabled={running||!desktop} onChange={v=>edit(p=>{p.calculation.maxDrop=v;})}/>
      {Object.entries(currentWire.cable??defaultCable).filter(([key])=>key!=="sizing").map(([key,value])=>{
        const label=({material:"Konduktor",section:"Penampang (mm²)",length:"Panjang (m)",cores:"Jumlah core",insulation:"Isolasi",ambient:"Ambient (°C)",method:"Metode instalasi",grouping:"Faktor grouping (0–1)",mode:"Mode hitungan",ampacity:"Kapasitas datasheet (A; 0=tabel)",resistance:"Resistansi sambungan (Ω)"} as Record<string,string>)[key];
        const set=(value:string|number)=>edit(p=>{const w=p.wires.find(w=>w.id===selected)!;w.cable={...(w.cable??defaultCable),[key]:value,...(key==="section"?{sizing:"manual" as const}:{})};});
        const options=key==="material"?["Cu","Al"]:key==="insulation"?["PVC","XLPE"]:key==="method"?["A2","B2","C"]:key==="mode"?["simple","advanced"]:null;
        return options?<Choice key={key} label={label} value={String(value)} disabled={running||!desktop} onChange={set} options={options.map(v=>({value:v,label:v}))}/>:<Numeric key={key} label={label} value={Number(value)} min={key==="ambient"?-20:["section","grouping"].includes(key)?.01:key==="cores"?1:0} max={key==="grouping"?1:key==="ambient"?90:key==="cores"?100:key==="section"?1000:100000} disabled={running||!desktop} onChange={v=>set(key==="cores"?Math.round(v):v)}/>;
      })}
      {!running&&desktop&&<><label className="field"><span>Nomor / label kabel</span><Input value={currentWire.label} maxLength={40} onChange={e=>edit(p=>{p.wires.find(w=>w.id===selected)!.label=e.target.value;})}/></label><Choice label="Warna kabel" value={currentWire.color} onChange={v=>edit(p=>{p.wires.find(w=>w.id===selected)!.color=v;})} options={["auto","R","S","T","N","PE","signal"].map(v=>({value:v,label:WIRE_COLOR_LABELS[v]??v}))}/><p>Klik kabel, lalu tarik pegangan di tengah ruas untuk memindahkan belokan. Panah keyboard juga bisa dipakai.</p><Button variant="outline" onClick={()=>edit(p=>{const w=p.wires.find(w=>w.id===selected)!,sheet=p.nodes.find(n=>w.from.startsWith(n.id+":"))!.sheet,route=layoutDiagram(p,sheet).routes.find(r=>r.wire.id===w.id)!;w.bends=addWireBend(route.points).slice(1,-1);})}>Tambah belokan</Button><Button variant="outline" onClick={()=>edit(p=>{p.wires.find(w=>w.id===selected)!.bends=[];})}>Rapikan belokan otomatis</Button><Button variant="outline" onClick={()=>setConfirm("node")}><Trash2/>Hapus kabel</Button></>}
    </>:<>
      <CircuitBoard size={30}/><h2>Inspektor rangkaian</h2><p>Klik komponen atau kabel untuk melihat terminal, mengubah parameter, dan mencoba gangguan.</p>
      <dl className="summary-list"><div><dt>Komponen</dt><dd>{project?.nodes.length??0}</dd></div><div><dt>Kabel</dt><dd>{project?.wires.length??0}</dd></div><div><dt>Model</dt><dd>Kontak + jaringan resistif</dd></div></dl>
      <h3>Cara mulai</h3><ol className="steps"><li>Pilih komponen di sebelah kiri.</li><li>Klik area gambar untuk menaruhnya.</li><li>Klik terminal asal, lalu tujuan.</li><li>Tekan Jalankan untuk mencoba.</li></ol>
      <p>Tag coil dan kontaktor yang sama saling terhubung. Dua garis bersilangan tidak otomatis tersambung.</p>
    </>}
    <div className="safety-note"><ShieldAlert size={17}/><p>Untuk simulasi dan pemeriksaan awal. Tidak mengendalikan perangkat nyata dan tidak menyatakan instalasi aman.</p></div>
  </div>;
  if(!data.workspace)return <main className="loading-workspace"><CircuitBoard size={34}/><p>Memuat rangkaian di perangkat…</p></main>;
  if(!project)return <main className="loading-workspace"><CircuitBoard size={34}/><h1>Ruang kerja kosong</h1><Button onClick={()=>addProject("blank")}>Buat project</Button><Button variant="outline" onClick={()=>addProject("jago")}>Buka contoh Jago Coffee</Button><Button variant="outline" onClick={()=>void data.sync(true)}>Muat dari akun</Button></main>;
  const diagram=projectSheets(project).some(s=>s.id===tab);
  const matching=Object.entries(CATALOG).filter(([,d])=>(category==="Semua"||d.category===category)&&(d.name+" "+d.category).toLowerCase().includes(query.toLowerCase()));
  return <main className={"studio-shell"+(collapsedPanels.top?" top-collapsed":"")+(collapsedPanels.bottom?" bottom-collapsed":"")+(focusMode?" focus-mode":"")}>
    <Toaster theme="dark" position="bottom-right"/>
    <header className="app-header" id="panel-top-content" hidden={collapsedPanels.top}><div className="brand"><span className="brand-mark"><CircuitBoard size={24}/></span><span>RJM <b>Relay Studio</b></span></div>
      <div className="project-name"><Input aria-label="Nama project" value={project.name} maxLength={120} onChange={e=>{if(e.target.value.trim())edit(p=>{p.name=e.target.value;});}}/><span>Template & rangkaian pribadi</span></div>
      <div className="header-actions"><Button variant="ghost" title="Kelola project" onClick={()=>setProjectsOpen(true)}><FolderOpen/><span>Proyek</span></Button><Button variant="outline" onClick={()=>void data.sync(true)} title={data.status}>{data.online?<Cloud/>:<WifiOff/>}<span>Sinkronkan</span></Button><Button variant="ghost" className="mobile-only" aria-label="Buka inspektor" onClick={()=>setDrawerOpen(true)}><Settings2/></Button></div>
    </header>
    <Tabs value={tab} onValueChange={v=>{setTab(v);setSelected(null);setAdding(null);}} className="studio-tabs">
      <div className="sheet-bar"><TabsList variant="line" className="sheet-tabs">{[...projectSheets(project).map(s=>[s.id,s.name]),["panel","Front Panel"],["internal","Panel Internal"],["simulation","Simulation"],["calc","Hitungan"],["reference","Referensi"]].map(([value,label])=><TabsTrigger key={value} value={value}>{label}</TabsTrigger>)}</TabsList>
        <div className="sheet-controls"><div className="run-controls"><Choice label="Kecepatan simulasi" value={String(speed)} onChange={v=>setSpeed(Number(v))} options={[1,5,10,60].map(v=>({value:String(v),label:v+"×"}))}/><Button variant="ghost" title="Reset simulasi" aria-label="Reset simulasi" onClick={reset}><RotateCcw size={18}/></Button><Button className={running?"pause-button":"run-button"} onClick={()=>{setAdding(null);if(!running)setRuntime(r=>stepCircuit(project,r,0));else edit(p=>{p.simulation=simulationRecord(runtimeRef.current,p.simulation?.scenarios);},false);setRunning(v=>!v);}}>{running?<Pause size={17}/>:<Play size={17}/>} {running?"Jeda":"Jalankan"}</Button></div>
          <div className="layout-controls"><PanelToggle side="top" collapsed={collapsedPanels.top} onToggle={()=>togglePanel("top")}/><Button variant="ghost" className="focus-toggle" aria-label={focusMode?"Keluar mode fokus":"Mode fokus"} aria-pressed={focusMode} title={focusMode?"Kembalikan panel (Esc)":"Minimalkan semua panel"} onClick={toggleFocus}>{focusMode?<Shrink size={17}/>:<Expand size={17}/>}<span>{focusMode?"Keluar fokus":"Fokus"}</span></Button></div>
        </div>
      </div>
      <div className="workspace-layout">
        <aside className={"component-palette "+(!diagram?"non-diagram ":"")+(collapsedPanels.left?"panel-collapsed":"")}>
          <div className="palette-heading"><h2>Komponen</h2><span>{Object.keys(CATALOG).length}</span><PanelToggle side="left" collapsed={collapsedPanels.left} onToggle={()=>togglePanel("left")} rail/></div>
          <div className="palette-content" id="panel-left-content" hidden={collapsedPanels.left}>
          <div className="search-field"><Search size={16}/><Input aria-label="Cari komponen" placeholder="Cari komponen…" value={query} onChange={e=>setQuery(e.target.value)}/></div>
          <Choice label="Kategori komponen" value={category} onChange={setCategory} options={["Semua",...CATEGORIES].map(v=>({value:v,label:v}))}/>
          <div className="palette-scroll">{CATEGORIES.filter(c=>matching.some(([,d])=>d.category===c)).map(c=><section key={c}><h3><i style={{background:CATEGORY_COLORS[CATEGORIES.indexOf(c)]}}/>{c}</h3><div className="component-grid">
            {matching.filter(([,d])=>d.category===c).map(([type,d])=>{
              const n={id:"preview",type,tag:"",label:"",x:0,y:0,rotation:0,sheet:"power" as const,params:d.defaults},s=nodeSize(n);
              return <button key={type} className={"palette-component "+(adding===type?"chosen":"")} disabled={running||!diagram} draggable={!running&&diagram} onDragStart={e=>e.dataTransfer.setData("application/x-rjm-component",type)} onClick={()=>setAdding(adding===type?null:type)} title={d.description}><svg viewBox={"-10 -5 "+(s.width+20)+" "+(s.height+10)}><Symbol node={n} mini/></svg><span>{d.name}</span></button>;
            })}
          </div></section>)}</div>
          <div className="palette-bottom"><span>Kabel & label bebas</span><small>Undo Ctrl+Z · putar R</small></div>
          </div>
        </aside>
        <section className="main-workspace">
          {diagram&&<div className="drawing-toolbar"><div><Button size="sm" variant="ghost" className={!adding?"active-tool":""} onClick={()=>{setAdding(null);action("escape");}}><MousePointer2 size={16}/><span>Pilih</span></Button><span className="wire-hint" title="Klik dua terminal untuk menyambung kabel"><Cable size={16}/>{["R","S","T","N","PE"].map(phase=><span key={phase} title={WIRE_COLOR_LABELS[phase]} style={{color:WIRE_COLORS[phase],fontWeight:600}}>{phase}</span>)}</span><Button size="sm" variant="ghost" onClick={()=>openEngineering("check")}>Check wiring</Button><Button size="sm" variant="ghost" onClick={()=>openEngineering("faults")}>Fault</Button><Button size="sm" variant="ghost" aria-pressed={debug} onClick={()=>setDebug(v=>!v)}>Debug</Button><span className="toolbar-divider"/><Button size="icon" variant="ghost" aria-label="Undo" disabled={!history.past||running||!desktop} onClick={()=>undo(false)}><Undo2 size={17}/></Button><Button size="icon" variant="ghost" aria-label="Redo" disabled={!history.future||running||!desktop} onClick={()=>undo(true)}><Redo2 size={17}/></Button></div><div><Button size="icon" variant="ghost" aria-label="Zoom keluar" onClick={()=>action("out")}><ZoomOut size={17}/></Button><Button size="icon" variant="ghost" aria-label="Zoom masuk" onClick={()=>action("in")}><ZoomIn size={17}/></Button><Button size="icon" variant="ghost" aria-label="Tampilkan seluruh rangkaian" onClick={()=>action("fit")}><Maximize2 size={17}/></Button><Button size="sm" variant="ghost" title="Unduh SVG" onClick={exportSVG}><Download size={16}/><span>SVG</span></Button><Button size="sm" variant="ghost" onClick={()=>void exportPNG()}>PNG</Button><Button size="icon" variant="ghost" aria-label="Cetak ke PDF" onClick={()=>{setPrinting(true);setTimeout(()=>window.print(),100);}}><Printer size={17}/></Button></div></div>}
          {diagram&&<div className="sheet-tools"><Button variant="ghost" size="sm" disabled={running||!desktop} onClick={()=>{const id=("sheet-"+newId().slice(0,12)) as Sheet;edit(p=>{p.sheets=[...(p.sheets??[]),{id,name:"Sheet "+((p.sheets?.length??0)+3)}];});setTab(id);}}>+ Sheet</Button>{project.sheets?.some(s=>s.id===tab)&&<Input aria-label="Nama sheet" value={project.sheets.find(s=>s.id===tab)?.name??""} disabled={running||!desktop} maxLength={100} onChange={e=>{if(e.target.value.trim())edit(p=>{p.sheets!.find(s=>s.id===tab)!.name=e.target.value;});}}/>}<Button variant="ghost" size="sm" disabled={running||!desktop} onClick={()=>edit(p=>{let n=1;const used=new Set(p.wires.map(w=>w.label));for(const w of p.wires)if(!w.label){while(used.has(String(n)))n++;w.label=String(n);used.add(w.label);}})}>Nomori kabel kosong</Button><Button variant="ghost" size="sm" disabled={running||!desktop||!project.wires.length} onClick={()=>{edit(p=>{for(const w of p.wires)w.cable={...(w.cable??defaultCable),sizing:"auto"};});toast.success("Ukuran otomatis aktif. Kabel yang datanya belum lengkap ditandai AUTO?.");}}>Ukuran otomatis semua kabel</Button></div>}
          {projectSheets(project).map(({id:s})=><TabsContent className="diagram-panel" key={s} value={s}><Schematic project={project} sheet={s as Sheet} runtime={runtime} running={running} editable={desktop} selected={selected} onSelect={setSelected} onInteract={runInteraction} onEdit={edit} onCheckpoint={checkpoint} adding={adding} onPlaced={place} canvasAction={canvasAction} printing={printing} debug={debug}/></TabsContent>)}
          <TabsContent value="panel" className="scroll-panel"><PanelDesigner project={project} runtime={runtime} running={running} editable={desktop} front onEdit={edit} onInteract={runInteraction}/></TabsContent>
          <TabsContent value="internal" className="scroll-panel"><PanelDesigner project={project} runtime={runtime} running={running} editable={desktop} front={false} onEdit={edit} onInteract={runInteraction}/></TabsContent>
          <TabsContent value="simulation" className="scroll-panel"><Engineering project={project} runtime={runtime} running={running} editable={desktop} view={engineeringView} onView={openEngineering} onEdit={edit} onRuntime={setRuntime} onLocate={locate}/></TabsContent>
          <TabsContent value="calc" className="full-panel"><Calculator value={project.calculation} onChange={value=>edit(p=>{p.calculation=value;})}/></TabsContent>
          <TabsContent value="reference" className="scroll-panel reference-panel">
            <h2>Acuan & batas model</h2><p>PDF asli tidak diubah. Rangkaian template adalah penelusuran fungsional yang dapat diedit, bukan gambar as-built yang telah disahkan.</p>
            <div className="reference-links">{projectReferences(project).map(({file,label,page})=><a key={file+page} href={"/reference/"+file+"#page="+page} target="_blank" rel="noreferrer"><FileText/>{label}<span>Buka PDF ↗</span></a>)}</div>
            <label className="field"><span>Catatan project & asumsi yang harus diverifikasi</span><textarea value={project.notes} maxLength={12000} onChange={e=>edit(p=>{p.notes=e.target.value;})} rows={17}/></label>
            <h3>Model dan acuan perhitungan</h3><p>Koneksi memakai node terminal, kontak ideal, dan penyelesaian arus berbasis Kirchhoff untuk konduktor resistif. Beban motor memakai nameplate atau estimasi HP/PK daya poros, inrush, dan faktor daya. Kabel mempunyai kapasitas, derating, resistansi, drop tegangan, dan model pemanasan. PFR, pressure switch, timer, coil, dan controller mengubah kontak listrik.</p><p>Kurva proteksi memakai pendekatan thermal / inverse-time dan ambang magnetic B/C/D, bukan kurva pabrikan tersertifikasi. Short circuit memerlukan Isc sumber dan breaking capacity. Suhu ruangan memakai model thermal sederhana; tidak menghitung siklus refrigeran, CFD, harmonisa, arcing, atau transien elektromagnetik rinci. Pemanasan kabel adalah estimasi dengan konstanta thermal 120 s.</p><p>Tabel kapasitas otomatis dibatasi pada Cu/PVC, tiga konduktor berbeban, metode A2/B2/C. Aluminium, XLPE, ukuran kecil/custom memerlukan kapasitas datasheet. Nilai SAFE hanya hasil model untuk input tersebut.</p><p><a href="https://www.electrical-installation.org/enwiki/General_method_for_cable_sizing" target="_blank" rel="noreferrer">Schneider Electric · metode penentuan kabel & faktor koreksi ↗</a></p><p><a href="https://www.electrical-installation.org/enwiki/Calculation_of_voltage_drop_in_steady_load_conditions" target="_blank" rel="noreferrer">Schneider Electric · perhitungan voltage drop ↗</a></p>
            <h3>Penyimpanan</h3><p>Data offline berada di browser perangkat ini. Gunakan Unduh project sebagai cadangan. Klik Sinkronkan untuk menyimpan project ke akun ChatGPT dan membukanya dari perangkat lain. Data akun tersimpan di server dan dipisahkan per pemilik. Konflik diselesaikan per project; opsi salinan mempertahankan kedua versi.</p>
          </TabsContent>
          <section className="simulation-tray" id="panel-bottom-content" hidden={collapsedPanels.bottom||["calc","reference","simulation","internal"].includes(tab)}>
            <div className="simulation-heading"><span className={"run-dot "+(running?"live":"")}/><b>{runtime.halted?"Simulasi dihentikan":running?"Simulasi berjalan":"Simulasi jeda"}</b><span className="mono">{numberText(runtime.now,1)} s</span><span className="muted">Beban diketahui {numberText(runtime.watts/1000,2)} kW</span></div>
            <div className="simulation-columns"><div className="test-inputs">{project.nodes.filter(n=>kind(n)==="probe").map(n=><Numeric key={n.id} label={n.label} unit="°C" value={runtime.values[n.id+":value"]??Number(n.params.value)} min={-100} max={100} onChange={value=>setRuntime(r=>stepCircuit(project,{...r,values:{...r.values,[n.id+":value"]:value}},0))}/>)}
              <div className="fault-buttons">{project.nodes.filter(n=>["overload","pfr","pressure"].includes(kind(n))).map(n=><Button key={n.id} size="sm" variant="outline" disabled={!running} className={stateOf(runtime,n).tripped?"fault-button":""} onClick={()=>runInteraction(n.id)}>{n.tag} {kind(n)==="overload"?(stateOf(runtime,n).tripped?"Reset":"Trip"):kind(n)==="pressure"?"HP/LP":"Fault"}</Button>)}</div></div>
              <div className="event-log" aria-label="Diagnostik dan riwayat">{runtime.faults.map(x=><p className="error-text" key={x}><ShieldAlert size={14}/>{x}</p>)}{runtime.warnings.slice(0,5).map(x=><p className="warning-text" key={x}>{x}</p>)}{runtime.log.slice(-5).reverse().map((x,i)=><p key={i}><time>{numberText(x.time,1)}s</time>{x.text}</p>)}{!runtime.log.length&&!runtime.faults.length&&<p>Klik Jalankan, lalu coba tombol atau ubah suhu sensor.</p>}</div>
            </div>
          </section>
        </section>
        <aside className={"inspector "+(collapsedPanels.right?"panel-collapsed":"")}><div className="inspector-heading"><h2>Properti</h2><PanelToggle side="right" collapsed={collapsedPanels.right} onToggle={()=>togglePanel("right")} rail/></div><div id="panel-right-content" hidden={collapsedPanels.right}>{inspector}</div></aside>
      </div>
    </Tabs>
    <footer className="status-bar">
      <span>{collapsedPanels.bottom?<><span className={"run-dot "+(running?"live":"")}/><span className={runtime.halted?"error-text":""}>{runtime.halted?"Simulasi dihentikan":running?"Simulasi berjalan":"Simulasi jeda"} · {numberText(runtime.now,1)} s{runtime.faults.length?` · ${runtime.faults.length} gangguan`:""}</span></>:<>{data.online?<Cloud size={14}/>:<WifiOff size={14}/>}<span role="status">{data.status}</span></>}</span>
      <span className="status-details" hidden={collapsedPanels.bottom}>{data.offlineReady?"Offline siap":"Offline belum terverifikasi"}<i/>Engineering model · v2</span>
      <div className="status-details" hidden={collapsedPanels.bottom}><Button variant="ghost" size="sm" onClick={()=>fileInput.current?.click()}><Upload size={14}/>Impor</Button><Button variant="ghost" size="sm" onClick={exportProject}><Download size={14}/>Unduh project</Button></div>
      <div className="bottom-panel-control">{collapsedPanels.bottom&&<span>Diagnostik</span>}<PanelToggle side="bottom" collapsed={collapsedPanels.bottom} onToggle={()=>togglePanel("bottom")}/></div>
    </footer>
    <input ref={fileInput} type="file" hidden accept=".json,.rjm.json,application/json" onChange={e=>{const file=e.target.files?.[0];if(file)void importFile(file);e.target.value="";}}/>
    {data.conflicts.length>0&&<Dialog open><DialogContent showCloseButton={false} className="project-dialog"><DialogHeader><DialogTitle>Ada dua versi project</DialogTitle><DialogDescription>Tidak ada versi yang ditimpa otomatis. Pilih cara menyimpan perubahan.</DialogDescription></DialogHeader>{data.conflicts.map(c=><div key={c.local.document.id} className="conflict-row"><h3>{c.local.document.name}</h3><p>Lokal: {new Date(c.local.updatedAt).toLocaleString("id-ID")} · akun: {new Date(c.remote.updatedAt).toLocaleString("id-ID")}</p><p>{c.local.document.nodes.length} komponen lokal / {c.remote.document.nodes.length} komponen akun{c.remote.deleted?" · versi akun dihapus":""}</p><div className="dialog-actions"><Button onClick={()=>data.resolve(c.local.document.id,"copy")}>Simpan keduanya</Button><Button variant="outline" onClick={()=>data.resolve(c.local.document.id,"local")}>Pakai lokal</Button><Button variant="outline" onClick={()=>data.resolve(c.local.document.id,"remote")}>Pakai akun</Button></div></div>)}</DialogContent></Dialog>}
    <Dialog open={projectsOpen} onOpenChange={setProjectsOpen}><DialogContent className="project-dialog"><DialogHeader><DialogTitle>Project lo</DialogTitle><DialogDescription>Setiap rangkaian disimpan terpisah. Contoh tidak menimpa pekerjaan yang sudah ada.</DialogDescription></DialogHeader><div className="project-list">{data.workspace.entries.filter(e=>!e.deleted).map(e=><button key={e.document.id} onClick={()=>{data.setWorkspace(w=>w?{...w,active:e.document.id}:w);setProjectsOpen(false);}}><CircuitBoard/><span><b>{e.document.name}</b><small>{e.document.nodes.length} komponen · {e.dirty?"Belum sinkron":"Versi "+e.baseRevision}</small></span>{e.document.id===project.id&&<Check size={18}/>}</button>)}</div><div className="new-project-actions"><Button variant="outline" onClick={()=>{const copy=structuredClone(project);copy.id=newId();copy.name=(copy.name+" · salinan").slice(0,120);data.update(copy);setProjectsOpen(false);reset();}}>Simpan sebagai salinan</Button><Button onClick={()=>addProject("blank")}><Plus/>Kosong</Button></div><h3>Mulai dari wiring proyek</h3><div className="preset-list">{PROJECT_PRESETS.map(p=><button key={p.id} onClick={()=>addProject(p.id)}><b>{p.name}</b><small>{p.description}</small></button>)}</div><Button variant="ghost" onClick={()=>setConfirm("project")}><Trash2 size={16}/>Hapus project aktif</Button></DialogContent></Dialog>
    <Drawer open={drawerOpen} onOpenChange={setDrawerOpen}><SheetContent side="right" className="mobile-inspector"><SheetHeader><SheetTitle>Properti rangkaian</SheetTitle></SheetHeader>{inspector}</SheetContent></Drawer>
    <AlertDialog open={!!confirm} onOpenChange={open=>{if(!open)setConfirm(null);}}><AlertDialogContent><AlertDialogHeader><AlertDialogTitle>{confirm==="project"?"Hapus project ini?":"Hapus pilihan?"}</AlertDialogTitle><AlertDialogDescription>{confirm==="project"?"Penghapusan ikut disinkronkan. Unduh project dulu jika perlu cadangan.":"Kabel yang menempel pada komponen juga ikut dihapus. Bisa dipulihkan dengan Undo selama sesi ini."}</AlertDialogDescription></AlertDialogHeader><AlertDialogFooter><AlertDialogCancel>Batal</AlertDialogCancel><AlertDialogAction onClick={()=>{if(confirm==="project"){data.remove(project.id);setProjectsOpen(false);}else edit(p=>{p.nodes=p.nodes.filter(n=>n.id!==selected);for(const layout of [p.front,p.internal])if(layout)layout.items=layout.items.filter(i=>i.nodeId!==selected);p.wires=p.wires.filter(w=>w.id!==selected&&!w.from.startsWith(selected+":")&&!w.to.startsWith(selected+":"));});setSelected(null);setConfirm(null);}}>Hapus</AlertDialogAction></AlertDialogFooter></AlertDialogContent></AlertDialog>
  </main>;
}
