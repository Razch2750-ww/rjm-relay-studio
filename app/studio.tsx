"use client";
import { useCallback, useEffect, useRef, useState } from "react";
import { CircuitBoard,Play,Pause,RotateCcw,Undo2,Redo2,Download,Upload,FolderOpen,Plus,ZoomIn,ZoomOut,Maximize2,Trash2,Copy,RotateCw,Cloud,WifiOff,Search,FileText,MousePointer2,Cable,Settings2,ShieldAlert,Check,Printer } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { Tabs,TabsList,TabsTrigger,TabsContent } from "@/components/ui/tabs";
import { Dialog,DialogContent,DialogHeader,DialogTitle,DialogDescription } from "@/components/ui/dialog";
import { AlertDialog,AlertDialogContent,AlertDialogHeader,AlertDialogTitle,AlertDialogDescription,AlertDialogFooter,AlertDialogCancel,AlertDialogAction } from "@/components/ui/alert-dialog";
import { Sheet as Drawer,SheetContent,SheetHeader,SheetTitle } from "@/components/ui/sheet";
import { Toaster } from "@/components/ui/sonner";
import { toast } from "sonner";
import { CATALOG,CATEGORIES,CATEGORY_COLORS,blankProject,kind,newNode,nodeSize,validateProject,pin,selectorPositions } from "../lib/circuit";
import type { Node,Project,Sheet } from "../lib/circuit";
import { freshRuntime,interact,stateOf,stepCircuit } from "../lib/simulator";
import { PROJECT_PRESETS, projectReferences } from "../lib/project-presets";
import type { PresetId } from "../lib/project-presets";
import { useWorkspace } from "./use-workspace";
import { Schematic,Symbol,PHASE } from "./schematic";
import Calculator,{Choice,Numeric} from "./calculator";

const numberText=(n:number,d=1)=>n.toLocaleString("id-ID",{maximumFractionDigits:d});
const PARAM_LABELS:Record<string,string>={offDuration:"Durasi NC (detik)",onDuration:"Durasi NO (detik)",neutralRequired:"Netral wajib tersambung",voltage:"Tegangan nominal (V)",rating:"Rating / setelan (A)",curve:"Kurva pengaman",on:"Posisi awal ON",va:"Beban coil (VA)",delay:"Delay (detik)",current:"Arus nominal (A)",powerFactor:"Faktor daya",loadFactor:"Faktor beban (×)",startFactor:"Pengali arus start",startSeconds:"Durasi start (detik)",watts:"Daya listrik (W)",value:"Suhu sensor (°C)",setpoint:"Setpoint (°C)",differential:"Differential (°C)",restartDelay:"Jeda restart (detik)",defrostInterval:"Interval defrost (detik)",defrostDuration:"Maksimum defrost (detik)",defrostEnd:"Suhu akhir defrost (°C)",drip:"Waktu tetes (detik)",fanDelay:"Jeda fan (detik)",fanWithComp:"Fan mengikuti compressor",minVoltage:"Batas tegangan PFR (V)",expected:"Urutan fase yang diharapkan",position:"Posisi awal",net:"Nama koneksi antarlembar",thermalSeconds:"Konstanta trip model (detik)",leakageMA:"Kebocoran simulasi (mA)",thresholdMA:"Ambang RCCB (mA)",color:"Warna lampu"};
function download(content:string,name:string,type="application/json"){
  const url=URL.createObjectURL(new Blob([content],{type})),a=document.createElement("a");a.href=url;a.download=name;a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);
}
function filename(name:string){return name.replace(/[^a-zA-Z0-9_-]+/g,"_").slice(0,90)||"rangkaian";}
export default function Studio(){
  const data=useWorkspace(),project=data.workspace?.entries.find(e=>e.document.id===data.workspace?.active&&!e.deleted)?.document??data.workspace?.entries.find(e=>!e.deleted)?.document;
  const projectRef=useRef(project);useEffect(()=>{projectRef.current=project;},[project]);
  const [tab,setTab]=useState("power"),[selected,setSelected]=useState<string|null>(null),[adding,setAdding]=useState<string|null>(null),[running,setRunning]=useState(false),[runtime,setRuntime]=useState(freshRuntime),[speed,setSpeed]=useState(1),[query,setQuery]=useState(""),[category,setCategory]=useState("Semua"),[desktop,setDesktop]=useState(true);
  const [projectsOpen,setProjectsOpen]=useState(false),[drawerOpen,setDrawerOpen]=useState(false),[confirm,setConfirm]=useState<"node"|"project"|null>(null),[printing,setPrinting]=useState(false);
  const [canvasAction,setCanvasAction]=useState({id:0,action:"fit"}),[history,setHistory]=useState({past:0,future:0});
  const past=useRef<Project[]>([]),future=useRef<Project[]>([]),fileInput=useRef<HTMLInputElement>(null),timer=useRef<ReturnType<typeof setInterval>|null>(null);
  const checkpoint=()=>{if(!projectRef.current)return;past.current.push(structuredClone(projectRef.current));past.current=past.current.slice(-25);future.current=[];setHistory({past:past.current.length,future:0});};
  const edit=(fn:(p:Project)=>void,record=true)=>{const current=projectRef.current;if(!current)return;if(record)checkpoint();const copy=structuredClone(current);fn(copy);data.update(copy);projectRef.current=copy;};
  const reset=()=>{setRunning(false);setRuntime(freshRuntime());};
  const action=(name:string)=>setCanvasAction(x=>({id:x.id+1,action:name}));
  const exportProject=useCallback(()=>{const p=projectRef.current;if(!p)return;try{validateProject(p);download(JSON.stringify(p,null,2),filename(p.name)+".rjm.json");toast.success("File project diunduh.");}catch{toast.error("Ada data tidak valid. Periksa isian sebelum ekspor.");}},[]);
  const undo=(redo=false)=>{const p=projectRef.current;if(!p||running)return;const from=redo?future.current:past.current,to=redo?past.current:future.current,target=from.pop();if(target){to.push(structuredClone(p));data.update(target);projectRef.current=target;setHistory({past:past.current.length,future:future.current.length});setSelected(null);}};
  // eslint-disable-next-line react-hooks/set-state-in-effect -- Subscribe to the browser viewport after hydration.
  useEffect(()=>{const mq=window.matchMedia("(min-width: 900px)");setDesktop(mq.matches);const change=()=>setDesktop(mq.matches);mq.addEventListener("change",change);return()=>mq.removeEventListener("change",change);},[]);
  // eslint-disable-next-line react-hooks/set-state-in-effect -- Transient engine/history state belongs to one document identity.
  useEffect(()=>{reset();setSelected(null);past.current=[];future.current=[];setHistory({past:0,future:0});},[project?.id]);
  useEffect(()=>{
    if(!running)return;
    timer.current=setInterval(()=>{const p=projectRef.current;if(p)setRuntime(previous=>stepCircuit(p,previous,.25*speed));},250);
    return()=>{if(timer.current)clearInterval(timer.current);};
  },[running,speed]);
  // eslint-disable-next-line react-hooks/set-state-in-effect -- Stop the clock and notify when the engine reports an electrical fault.
  useEffect(()=>{if(runtime.halted&&running){setRunning(false);toast.error("Simulasi dihentikan. Periksa diagnostik.");}},[runtime.halted,running]);
  useEffect(()=>{const stop=()=>{const p=projectRef.current;if(p)setRuntime(r=>{let next=r;for(const n of p.nodes)if(["start","stop"].includes(kind(n)))next=interact(p,next,n.id,false);return next;});};window.addEventListener("blur",stop);return()=>window.removeEventListener("blur",stop);},[]);
  useEffect(()=>{
    const key=(e:KeyboardEvent)=>{
      const typing=(e.target as Element)?.closest("input,textarea,select,[contenteditable=true]");
      if(e.key==="Escape"){setAdding(null);action("escape");}
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
    const prefix=CATALOG[type].kind==="contactor"||["coil","no","nc"].includes(CATALOG[type].kind)?"K":CATALOG[type].category==="Proteksi"?"Q":"X";
    let i=1;while(project.nodes.some(n=>n.tag===prefix+i))i++;
    const n=newNode(type,tab==="control"?"control":"power",x,y,prefix+i);edit(p=>p.nodes.push(n));setAdding(null);setSelected(n.id);
  };
  const addProject=(type:"blank"|PresetId)=>{
    if((data.workspace?.entries.length??0)>=90){toast.error("Terlalu banyak project di perangkat; ekspor dan rapikan dulu.");return;}
    const p=PROJECT_PRESETS.find(p=>p.id===type)?.create()??blankProject();data.update(p);setProjectsOpen(false);setTab(type==="dol"?"control":"power");reset();
  };
  const importFile=async(file:File)=>{
    if((data.workspace?.entries.length??0)>=90){toast.error("Batas project di perangkat tercapai.");return;}
    if(file.size>2_000_000){toast.error("File maksimal 2 MB.");return;}
    try{const p=validateProject(JSON.parse(await file.text()));p.id=crypto.randomUUID();p.name=(p.name+" · impor").slice(0,120);data.update(p);reset();toast.success("Diimpor sebagai project baru; versi lama tetap ada.");}catch{toast.error("Bukan file project RJM yang valid. Data lama tidak diubah.");}
  };
  const exportSVG=()=>{
    const svg=document.getElementById("circuit-canvas") as SVGSVGElement|null;if(!svg||!project)return;
    const clone=svg.cloneNode(true) as SVGSVGElement,nodes=project.nodes.filter(n=>n.sheet===tab);
    const xs=nodes.flatMap(n=>[n.x-60,n.x+nodeSize(n).width+60]),ys=nodes.flatMap(n=>[n.y-60,n.y+nodeSize(n).height+70]);
    project.wires.filter(w=>nodes.some(n=>w.from.startsWith(n.id+":"))).flatMap(w=>w.bends).forEach(p=>{xs.push(p.x);ys.push(p.y);});
    const x=Math.min(0,...xs),y=Math.min(0,...ys),w=Math.max(1200,...xs)-x+60,h=Math.max(800,...ys)-y+60;
    clone.setAttribute("viewBox",[x,y,w,h].join(" "));clone.setAttribute("width",String(w));clone.setAttribute("height",String(h));
    clone.querySelectorAll('[tabindex]').forEach(el=>el.removeAttribute("tabindex"));
    download(new XMLSerializer().serializeToString(clone),filename(project.name)+"_"+tab+".svg","image/svg+xml");
  };
  // Expose only the real read-only circuit inspection path; unsupported browsers simply omit this.
  useEffect(()=>{
    const context=(document as unknown as {modelContext?:{registerTool:(tool:unknown,options:unknown)=>Promise<void>|void}}).modelContext;
    if(!context?.registerTool)return;const lifecycle=new AbortController();
    const tool={name:"read_relay_project",title:"Baca rangkaian aktif",description:"Baca komponen dan kabel project aktif; tidak mengubah atau menjalankan simulasi.",inputSchema:{type:"object",properties:{},additionalProperties:false},annotations:{readOnlyHint:true,untrustedContentHint:true},execute:(input:unknown)=>{if(!input||typeof input!=="object"||Object.keys(input).length)throw new Error("Gunakan objek kosong.");const p=projectRef.current;return p?{name:p.name,nodes:p.nodes.map(n=>({id:n.id,tag:n.tag,type:n.type,sheet:n.sheet})),wires:p.wires.map(w=>({from:w.from,to:w.to})),notes:p.notes}:{error:"Belum ada project aktif."};}};
    try{void Promise.resolve(context.registerTool(tool,{signal:lifecycle.signal})).catch(()=>{});}catch{}return()=>lifecycle.abort();
  },[]);
  const currentNode=project?.nodes.find(n=>n.id===selected),currentWire=project?.wires.find(w=>w.id===selected),selectedState=currentNode?stateOf(runtime,currentNode):null;
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
      {Object.entries(currentNode.params).map(([key,value])=>{
        const label=PARAM_LABELS[key]??key;
        if(running&&!["value","current","watts","loadFactor","setpoint","leakageMA"].includes(key))return null;
        if(typeof value==="number")return <Numeric key={key} label={label} disabled={!desktop&&!running} value={running?(runtime.values[currentNode.id+":"+key]??value):value} min={["value","setpoint","defrostEnd"].includes(key)?-100:0} max={key==="powerFactor"?1:1000000} onChange={v=>updateParam(key,v)}/>;
        if(typeof value==="boolean")return <div key={key} className="switch-field"><label htmlFor={"prop-"+key}>{label}</label><Switch id={"prop-"+key} checked={value} disabled={!desktop||running} onCheckedChange={v=>updateParam(key,v)}/></div>;
        const options=key==="curve"?["B","C","D"]:key==="position"?[...selectorPositions(currentNode)].reverse():key==="expected"?["any","RST","TSR"]:null;
        return <label className="field" key={key}><span>{label}</span>{options?<Choice label={label} disabled={!desktop||running} value={String(value)} onChange={v=>updateParam(key,v)} options={options.map(v=>({value:v,label:v==="any"?"Kehadiran fase saja":v}))}/>:<Input type={key==="color"?"color":"text"} value={String(value)} maxLength={120} disabled={!desktop||running} onChange={e=>updateParam(key,e.target.value)}/>}</label>;
      })}
      {running&&kind(currentNode)==="source"&&<Choice label="Simulasi fase hilang" value={String(runtime.manual[currentNode.id+":phase"]??"normal")} onChange={v=>setRuntime(r=>stepCircuit(project!,{...r,manual:{...r.manual,[currentNode.id+":phase"]:v}},0))} options={["normal","R","S","T"].map(v=>({value:v,label:v==="normal"?"Semua fase normal":"Hilangkan fase "+v}))}/>}
      {running&&kind(currentNode)==="probe"&&<Button variant="outline" onClick={()=>setRuntime(r=>stepCircuit(project!,{...r,manual:{...r.manual,[currentNode.id+":fault"]:!r.manual[currentNode.id+":fault"]}},0))}>Putus / pulihkan sensor</Button>}
      {running&&!["motor","heater","lamp","buzzer","valve","probe","text","bus","terminal","no","nc","changeover","contactor","coil","ton","toff","impulse","cyclic","junction"].includes(kind(currentNode))&&<Button variant="outline" {...operationEvents(currentNode)}>{kind(currentNode)==="controller"?"Mulai defrost manual":"Operasikan / reset"}</Button>}
      {!running&&desktop&&<div className="inspector-actions"><Button variant="outline" size="sm" onClick={()=>edit(p=>{p.nodes.find(n=>n.id===selected)!.rotation=(currentNode.rotation+90)%360;})}><RotateCw/>Putar</Button><Button variant="outline" size="sm" onClick={()=>edit(p=>{if(p.nodes.length<500)p.nodes.push({...structuredClone(currentNode),id:crypto.randomUUID(),tag:(currentNode.tag+"-COPY").slice(0,32),x:currentNode.x+160,y:currentNode.y+40});})}><Copy/>Salin</Button><Button variant="outline" size="sm" onClick={()=>setConfirm("node")}><Trash2/>Hapus</Button></div>}
    </>:currentWire?<>
      <h2>Kabel {currentWire.label||"tanpa nomor"}</h2><p className="mono">{currentWire.from}<br/>{currentWire.to}</p>
      <p>{numberText(runtime.wireCurrent[currentWire.id]??0,3)} A · estimasi model</p>
      {!running&&desktop&&<><label className="field"><span>Nomor / label kabel</span><Input value={currentWire.label} maxLength={40} onChange={e=>edit(p=>{p.wires.find(w=>w.id===selected)!.label=e.target.value;})}/></label><Choice label="Warna kabel" value={currentWire.color} onChange={v=>edit(p=>{p.wires.find(w=>w.id===selected)!.color=v;})} options={["auto","R","S","T","N","PE","signal"].map(v=>({value:v,label:v==="auto"?"Otomatis":v}))}/><Button variant="outline" onClick={()=>edit(p=>{p.wires.find(w=>w.id===selected)!.bends=[];})}>Rapikan belokan otomatis</Button><Button variant="outline" onClick={()=>setConfirm("node")}><Trash2/>Hapus kabel</Button></>}
    </>:<>
      <CircuitBoard size={30}/><h2>Inspektor rangkaian</h2><p>Klik komponen atau kabel untuk melihat terminal, mengubah parameter, dan mencoba gangguan.</p>
      <dl className="summary-list"><div><dt>Komponen</dt><dd>{project?.nodes.length??0}</dd></div><div><dt>Kabel</dt><dd>{project?.wires.length??0}</dd></div><div><dt>Model</dt><dd>Kontak ideal</dd></div></dl>
      <h3>Cara mulai</h3><ol className="steps"><li>Pilih komponen di sebelah kiri.</li><li>Klik area gambar untuk menaruhnya.</li><li>Klik terminal asal, lalu tujuan.</li><li>Tekan Jalankan untuk mencoba.</li></ol>
      <p>Tag coil dan kontaktor yang sama saling terhubung. Dua garis bersilangan tidak otomatis tersambung.</p>
    </>}
    <div className="safety-note"><ShieldAlert size={17}/><p>Untuk simulasi dan pemeriksaan awal. Tidak mengendalikan perangkat nyata dan tidak menyatakan instalasi aman.</p></div>
  </div>;
  if(!data.workspace)return <main className="loading-workspace"><CircuitBoard size={34}/><p>Memuat rangkaian di perangkat…</p></main>;
  if(!project)return <main className="loading-workspace"><CircuitBoard size={34}/><h1>Ruang kerja kosong</h1><Button onClick={()=>addProject("blank")}>Buat project</Button><Button variant="outline" onClick={()=>addProject("jago")}>Buka contoh Jago Coffee</Button><Button variant="outline" onClick={()=>void data.sync(true)}>Muat dari akun</Button></main>;
  const diagram=tab==="power"||tab==="control";
  const matching=Object.entries(CATALOG).filter(([,d])=>(category==="Semua"||d.category===category)&&(d.name+" "+d.category).toLowerCase().includes(query.toLowerCase()));
  return <main className="studio-shell">
    <Toaster theme="dark" position="bottom-right"/>
    <header className="app-header"><div className="brand"><span className="brand-mark"><CircuitBoard size={24}/></span><span>RJM <b>Relay Studio</b></span></div>
      <div className="project-name"><Input aria-label="Nama project" value={project.name} maxLength={120} onChange={e=>{if(e.target.value.trim())edit(p=>{p.name=e.target.value;});}}/><span>Template & rangkaian pribadi</span></div>
      <div className="header-actions"><Button variant="ghost" title="Kelola project" onClick={()=>setProjectsOpen(true)}><FolderOpen/><span>Proyek</span></Button><Button variant="outline" onClick={()=>void data.sync(true)} title={data.status}>{data.online?<Cloud/>:<WifiOff/>}<span>Sinkronkan</span></Button><Button variant="ghost" className="mobile-only" aria-label="Buka inspektor" onClick={()=>setDrawerOpen(true)}><Settings2/></Button></div>
    </header>
    <Tabs value={tab} onValueChange={v=>{setTab(v);setSelected(null);setAdding(null);}} className="studio-tabs">
      <div className="sheet-bar"><TabsList variant="line" className="sheet-tabs">{[["power","Power"],["control","Control"],["panel","Panel uji"],["calc","Hitungan"],["reference","Referensi"]].map(([value,label])=><TabsTrigger key={value} value={value}>{label}</TabsTrigger>)}</TabsList>
        <div className="run-controls"><Choice label="Kecepatan simulasi" value={String(speed)} onChange={v=>setSpeed(Number(v))} options={[1,5,20].map(v=>({value:String(v),label:v+"×"}))}/><Button variant="ghost" title="Reset simulasi" aria-label="Reset simulasi" onClick={reset}><RotateCcw size={18}/></Button><Button className={running?"pause-button":"run-button"} onClick={()=>{setAdding(null);if(!running)setRuntime(r=>stepCircuit(project,r,0));setRunning(v=>!v);}}>{running?<Pause size={17}/>:<Play size={17}/>} {running?"Jeda":"Jalankan"}</Button></div>
      </div>
      <div className="workspace-layout">
        <aside className={"component-palette "+(!diagram?"non-diagram":"")}>
          <div className="palette-heading"><h2>Komponen</h2><span>{Object.keys(CATALOG).length}</span></div>
          <div className="search-field"><Search size={16}/><Input aria-label="Cari komponen" placeholder="Cari komponen…" value={query} onChange={e=>setQuery(e.target.value)}/></div>
          <Choice label="Kategori komponen" value={category} onChange={setCategory} options={["Semua",...CATEGORIES].map(v=>({value:v,label:v}))}/>
          <div className="palette-scroll">{CATEGORIES.filter(c=>matching.some(([,d])=>d.category===c)).map(c=><section key={c}><h3><i style={{background:CATEGORY_COLORS[CATEGORIES.indexOf(c)]}}/>{c}</h3><div className="component-grid">
            {matching.filter(([,d])=>d.category===c).map(([type,d])=>{
              const n={id:"preview",type,tag:"",label:"",x:0,y:0,rotation:0,sheet:"power" as const,params:d.defaults},s=nodeSize(n);
              return <button key={type} className={"palette-component "+(adding===type?"chosen":"")} disabled={running||!diagram} draggable={!running&&diagram} onDragStart={e=>e.dataTransfer.setData("application/x-rjm-component",type)} onClick={()=>setAdding(adding===type?null:type)} title={d.description}><svg viewBox={"-10 -5 "+(s.width+20)+" "+(s.height+10)}><Symbol node={n} mini/></svg><span>{d.name}</span></button>;
            })}
          </div></section>)}</div>
          <div className="palette-bottom"><span>Kabel & label bebas</span><small>Undo Ctrl+Z · putar R</small></div>
        </aside>
        <section className="main-workspace">
          {diagram&&<div className="drawing-toolbar"><div><Button size="sm" variant="ghost" className={!adding?"active-tool":""} onClick={()=>{setAdding(null);action("escape");}}><MousePointer2 size={16}/><span>Pilih</span></Button><span className="wire-hint"><Cable size={16}/>Klik dua terminal</span><span className="toolbar-divider"/><Button size="icon" variant="ghost" aria-label="Undo" disabled={!history.past||running||!desktop} onClick={()=>undo(false)}><Undo2 size={17}/></Button><Button size="icon" variant="ghost" aria-label="Redo" disabled={!history.future||running||!desktop} onClick={()=>undo(true)}><Redo2 size={17}/></Button></div><div><Button size="icon" variant="ghost" aria-label="Zoom keluar" onClick={()=>action("out")}><ZoomOut size={17}/></Button><Button size="icon" variant="ghost" aria-label="Zoom masuk" onClick={()=>action("in")}><ZoomIn size={17}/></Button><Button size="icon" variant="ghost" aria-label="Tampilkan seluruh rangkaian" onClick={()=>action("fit")}><Maximize2 size={17}/></Button><Button size="sm" variant="ghost" title="Unduh SVG" onClick={exportSVG}><Download size={16}/><span>SVG</span></Button><Button size="icon" variant="ghost" aria-label="Cetak ke PDF" onClick={()=>{setPrinting(true);setTimeout(()=>window.print(),100);}}><Printer size={17}/></Button></div></div>}
          {["power","control"].map(s=><TabsContent className="diagram-panel" key={s} value={s}><Schematic project={project} sheet={s as Sheet} runtime={runtime} running={running} editable={desktop} selected={selected} onSelect={setSelected} onInteract={runInteraction} onEdit={edit} onCheckpoint={checkpoint} adding={adding} onPlaced={place} canvasAction={canvasAction} printing={printing}/></TabsContent>)}
          <TabsContent value="panel" className="scroll-panel panel-view">
            <div className="section-heading"><div><h2>Panel uji</h2><p>Operasikan perangkat yang ada pada rangkaian aktif.</p></div><span className="model-label">Model fungsional</span></div>
            <div className="test-panel"><div className="phase-lights">{["R","S","T"].map(phase=>{
              const bus=project.nodes.find(n=>kind(n)==="bus"&&n.params.net===phase),live=bus?runtime.energized[pin(bus,"A")]===phase:Object.values(runtime.energized).includes(phase);
              return <div key={phase}><span className="pilot" style={{background:running&&live?PHASE[phase]:"#283440"}}/><b>{phase}</b></div>;
            })}</div>
              {project.nodes.filter(n=>kind(n)==="controller").map(n=><div className="controller-screen" key={n.id}><span>{n.tag} · {n.label}</span><strong>{running&&stateOf(runtime,n).on?String(stateOf(runtime,n).temperature??"ERR"):"— —"} <small>°C</small></strong><span>{running?stateOf(runtime,n).stage:"SIMULASI BELUM BERJALAN"}</span><Button variant="outline" disabled={!running} onClick={()=>runInteraction(n.id)}>Defrost manual</Button></div>)}
              {project.nodes.filter(n=>kind(n)==="cyclic").map(n=><div className="timer-readout" key={n.id}><span>{n.tag} · {n.label}</span><b>{running?stateOf(runtime,n).stage:"Siap diuji"} · {numberText(stateOf(runtime,n).elapsed,1)} s</b></div>)}
              <div className="pilot-grid">{project.nodes.filter(n=>kind(n)==="lamp").map(n=><div key={n.id}><span className="pilot" style={{background:running&&stateOf(runtime,n).on?String(n.params.color):"#283440"}}/><b>{n.label}</b><small>{running&&stateOf(runtime,n).on?"ON":"OFF"}</small></div>)}</div>
              <div className="panel-switches">{project.nodes.filter(n=>["switch","estop","start","stop","selector"].includes(kind(n))).map(n=><button key={n.id} className={kind(n)==="estop"?"emergency-control":"panel-control"} disabled={!running} {...operationEvents(n)}><span>{n.tag}</span><strong>{n.label}</strong><small>{running?(kind(n)==="selector"?String(runtime.manual[n.id]??n.params.position):stateOf(runtime,n).on?"Tertutup":"Terbuka"):"Siap diuji"}</small></button>)}</div>
            </div>
          </TabsContent>
          <TabsContent value="calc" className="full-panel"><Calculator value={project.calculation} onChange={value=>edit(p=>{p.calculation=value;})}/></TabsContent>
          <TabsContent value="reference" className="scroll-panel reference-panel">
            <h2>Acuan & batas model</h2><p>PDF asli tidak diubah. Rangkaian template adalah penelusuran fungsional yang dapat diedit, bukan gambar as-built yang telah disahkan.</p>
            <div className="reference-links">{projectReferences(project).map(({file,label,page})=><a key={file+page} href={"/reference/"+file+"#page="+page} target="_blank" rel="noreferrer"><FileText/>{label}<span>Buka PDF ↗</span></a>)}</div>
            <label className="field"><span>Catatan project & asumsi yang harus diverifikasi</span><textarea value={project.notes} maxLength={12000} onChange={e=>edit(p=>{p.notes=e.target.value;})} rows={17}/></label>
            <h3>Yang dihitung dan yang tidak</h3><p>Engine menyelesaikan koneksi sumber, kabel, kontak, coil dan beban. Arus beban memakai nilai nameplate/input, bukan solver analog. Jalur arus memakai satu jalur konduktif; pembagian arus pada kabel paralel, impedansi sumber, transien motor, arcing, termodinamika refrigerant, serta koordinasi proteksi nyata tidak dimodelkan.</p><p>Model trip arus lebih bersifat pembelajaran. Hubung singkat ideal menghentikan simulasi dan tidak menghasilkan nilai arus palsu. Data tidak lengkap ditandai, bukan disetujui otomatis.</p>
            <h3>Penyimpanan</h3><p>Data offline berada di browser perangkat ini. Gunakan Unduh project sebagai cadangan. Sinkronisasi memerlukan sesi akun ChatGPT yang didukung host. Versi standalone saat ini memakai penyimpanan server sementara: data server hilang ketika proses restart. Gunakan ekspor JSON untuk cadangan permanen. Data dua akun berbeda tidak digabung otomatis. Konflik diselesaikan per project; opsi salinan mempertahankan kedua versi.</p>
          </TabsContent>
          {tab!=="calc"&&tab!=="reference"&&<section className="simulation-tray">
            <div className="simulation-heading"><span className={"run-dot "+(running?"live":"")}/><b>{runtime.halted?"Simulasi dihentikan":running?"Simulasi berjalan":"Simulasi jeda"}</b><span className="mono">{numberText(runtime.now,1)} s</span><span className="muted">Beban diketahui {numberText(runtime.watts/1000,2)} kW</span></div>
            <div className="simulation-columns"><div className="test-inputs">{project.nodes.filter(n=>kind(n)==="probe").map(n=><Numeric key={n.id} label={n.label} unit="°C" value={runtime.values[n.id+":value"]??Number(n.params.value)} min={-100} max={100} onChange={value=>setRuntime(r=>stepCircuit(project,{...r,values:{...r.values,[n.id+":value"]:value}},0))}/>)}
              <div className="fault-buttons">{project.nodes.filter(n=>["overload","pfr","pressure"].includes(kind(n))).map(n=><Button key={n.id} size="sm" variant="outline" disabled={!running} className={stateOf(runtime,n).tripped?"fault-button":""} onClick={()=>runInteraction(n.id)}>{n.tag} {kind(n)==="overload"?(stateOf(runtime,n).tripped?"Reset":"Trip"):kind(n)==="pressure"?"HP/LP":"Fault"}</Button>)}</div></div>
              <div className="event-log" aria-label="Diagnostik dan riwayat">{runtime.faults.map(x=><p className="error-text" key={x}><ShieldAlert size={14}/>{x}</p>)}{runtime.warnings.slice(0,5).map(x=><p className="warning-text" key={x}>{x}</p>)}{runtime.log.slice(-5).reverse().map((x,i)=><p key={i}><time>{numberText(x.time,1)}s</time>{x.text}</p>)}{!runtime.log.length&&!runtime.faults.length&&<p>Klik Jalankan, lalu coba tombol atau ubah suhu sensor.</p>}</div>
            </div>
          </section>}
        </section>
        <aside className="inspector"><div className="inspector-heading"><h2>Properti</h2><Settings2 size={16}/></div>{inspector}</aside>
      </div>
    </Tabs>
    <footer className="status-bar"><span>{data.online?<Cloud size={14}/>:<WifiOff size={14}/>}<span role="status">{data.status}</span></span><span>{data.offlineReady?"Offline siap":"Offline belum terverifikasi"}<i/>Model edukasi · v1</span><div><Button variant="ghost" size="sm" onClick={()=>fileInput.current?.click()}><Upload size={14}/>Impor</Button><Button variant="ghost" size="sm" onClick={exportProject}><Download size={14}/>Unduh project</Button></div></footer>
    <input ref={fileInput} type="file" hidden accept=".json,.rjm.json,application/json" onChange={e=>{const file=e.target.files?.[0];if(file)void importFile(file);e.target.value="";}}/>
    {data.conflicts.length>0&&<Dialog open><DialogContent showCloseButton={false} className="project-dialog"><DialogHeader><DialogTitle>Ada dua versi project</DialogTitle><DialogDescription>Tidak ada versi yang ditimpa otomatis. Pilih cara menyimpan perubahan.</DialogDescription></DialogHeader>{data.conflicts.map(c=><div key={c.local.document.id} className="conflict-row"><h3>{c.local.document.name}</h3><p>Lokal: {new Date(c.local.updatedAt).toLocaleString("id-ID")} · akun: {new Date(c.remote.updatedAt).toLocaleString("id-ID")}</p><p>{c.local.document.nodes.length} komponen lokal / {c.remote.document.nodes.length} komponen akun{c.remote.deleted?" · versi akun dihapus":""}</p><div className="dialog-actions"><Button onClick={()=>data.resolve(c.local.document.id,"copy")}>Simpan keduanya</Button><Button variant="outline" onClick={()=>data.resolve(c.local.document.id,"local")}>Pakai lokal</Button><Button variant="outline" onClick={()=>data.resolve(c.local.document.id,"remote")}>Pakai akun</Button></div></div>)}</DialogContent></Dialog>}
    <Dialog open={projectsOpen} onOpenChange={setProjectsOpen}><DialogContent className="project-dialog"><DialogHeader><DialogTitle>Project lo</DialogTitle><DialogDescription>Setiap rangkaian disimpan terpisah. Contoh tidak menimpa pekerjaan yang sudah ada.</DialogDescription></DialogHeader><div className="project-list">{data.workspace.entries.filter(e=>!e.deleted).map(e=><button key={e.document.id} onClick={()=>{data.setWorkspace(w=>w?{...w,active:e.document.id}:w);setProjectsOpen(false);}}><CircuitBoard/><span><b>{e.document.name}</b><small>{e.document.nodes.length} komponen · {e.dirty?"Belum sinkron":"Versi "+e.baseRevision}</small></span>{e.document.id===project.id&&<Check size={18}/>}</button>)}</div><div className="new-project-actions"><Button onClick={()=>addProject("blank")}><Plus/>Kosong</Button></div><h3>Mulai dari wiring proyek</h3><div className="preset-list">{PROJECT_PRESETS.map(p=><button key={p.id} onClick={()=>addProject(p.id)}><b>{p.name}</b><small>{p.description}</small></button>)}</div><Button variant="ghost" onClick={()=>setConfirm("project")}><Trash2 size={16}/>Hapus project aktif</Button></DialogContent></Dialog>
    <Drawer open={drawerOpen} onOpenChange={setDrawerOpen}><SheetContent side="right" className="mobile-inspector"><SheetHeader><SheetTitle>Properti rangkaian</SheetTitle></SheetHeader>{inspector}</SheetContent></Drawer>
    <AlertDialog open={!!confirm} onOpenChange={open=>{if(!open)setConfirm(null);}}><AlertDialogContent><AlertDialogHeader><AlertDialogTitle>{confirm==="project"?"Hapus project ini?":"Hapus pilihan?"}</AlertDialogTitle><AlertDialogDescription>{confirm==="project"?"Penghapusan ikut disinkronkan. Unduh project dulu jika perlu cadangan.":"Kabel yang menempel pada komponen juga ikut dihapus. Bisa dipulihkan dengan Undo selama sesi ini."}</AlertDialogDescription></AlertDialogHeader><AlertDialogFooter><AlertDialogCancel>Batal</AlertDialogCancel><AlertDialogAction onClick={()=>{if(confirm==="project"){data.remove(project.id);setProjectsOpen(false);}else edit(p=>{p.nodes=p.nodes.filter(n=>n.id!==selected);p.wires=p.wires.filter(w=>w.id!==selected&&!w.from.startsWith(selected+":")&&!w.to.startsWith(selected+":"));});setSelected(null);setConfirm(null);}}>Hapus</AlertDialogAction></AlertDialogFooter></AlertDialogContent></AlertDialog>
  </main>;
}
