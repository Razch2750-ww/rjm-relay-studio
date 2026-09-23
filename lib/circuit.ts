import { newId } from "./id.ts";
import { z } from "zod";

export type Params = Record<string, string | number | boolean>;
export type Sheet = "power" | "control" | `sheet-${string}`;
export type Node = { id: string; type: string; tag: string; label: string; x: number; y: number; rotation: number; sheet: Sheet; params: Params };
export type Cable = { material:"Cu"|"Al"; section:number; length:number; cores:number; insulation:"PVC"|"XLPE"; ambient:number; method:"A2"|"B2"|"C"; grouping:number; mode:"simple"|"advanced"; ampacity:number; resistance:number; sizing?:"auto"|"manual" };
export const defaultCable:Cable={material:"Cu",section:2.5,length:10,cores:3,insulation:"PVC",ambient:30,method:"B2",grouping:1,mode:"advanced",ampacity:0,resistance:0};
export type Wire = { id: string; from: string; to: string; label: string; color: string; bends: { x: number; y: number }[]; cable?:Cable };
export type PanelPlacement={id:string;nodeId:string;x:number;y:number;width:number;height:number;rotation:number;kind:"device"|"rail"|"duct"};
export type PanelLayout={width:number;height:number;items:PanelPlacement[]};
export type RoomSettings={enabled:boolean;length:number;width:number;height:number;initial:number;ambient:number;productKg:number;productSpecificHeat:number;envelopeU:number;heatLoad:number;coolingKW:number;evaporatorKW:number;doorKW:number;suction:number;discharge:number};
export const defaultRoom:RoomSettings={enabled:false,length:5,width:4,height:3,initial:8,ambient:30,productKg:500,productSpecificHeat:3.5,envelopeU:.25,heatLoad:400,coolingKW:6,evaporatorKW:6,doorKW:2,suction:2,discharge:16};
export type ScenarioResult={id:string;name:string;status:"PASS"|"WARNING"|"FAIL";at:string;steps:string[];duration:number};
export type EventEntry={time:number;text:string;category?:string;nodeId?:string};
export type SimulationRecord={at:string;seconds:number;watts:number;maximumCurrent:number;phaseCurrent:Record<string,number>;warnings:string[];events:EventEntry[];scenarios:ScenarioResult[]};
export const REFERENCE_KEYS = ["jago", "lion-sdp", "lion-pump", "lion-freezer-chiller", "lion-chiller", "dsv"] as const;
export type Project = { format: "rjm-relay-studio"; version: 1; id: string; name: string; notes: string; referenceKey?: typeof REFERENCE_KEYS[number]; nodes: Node[]; wires: Wire[]; calculation: CalculationInput; sheets?:{id:Sheet;name:string}[]; front?:PanelLayout; internal?:PanelLayout; room?:RoomSettings; simulation?:SimulationRecord };
export type CalculationInput = {
  mode: "nameplate" | "quick"; current: number; hp: number; hpUnit: "HP" | "PK"; hpBasis: "shaft" | "cooling";
  phases: 1 | 3; voltage: number; powerFactor: number; efficiency: number; length: number;
  ambient: number; grouping: number; method: "A2" | "B2" | "C"; maxDrop: number; upstreamDrop: number;
  breaker: number; startFactor: number; startPowerFactor: number; faultKA: number; breakingKA: number;
};
export type Definition = { name: string; category: string; kind: string; poles?: number; width?: number; defaults: Params; description: string };
export const CATEGORIES = ["Sumber", "Proteksi", "Kontaktor", "Tombol & sakelar", "Kontak bantu", "Coil & timer", "Beban", "Refrigerasi", "Lainnya"];
export const CATEGORY_COLORS = ["#9dd77b", "#ef827b", "#70d1d2", "#c8a4ee", "#9abce6", "#e6c46f", "#e5a187", "#73b6ee", "#c9cbd5"];

export const CATALOG: Record<string, Definition> = {
  source3: { name: "Sumber 3 fase + N", category: "Sumber", kind: "source", poles: 3, width: 180, defaults: { voltage: 400, on: true }, description: "Tegangan antar-fase; netral dan PE terpisah. Klik saat simulasi untuk ON/OFF." },
  source1: { name: "Sumber 1 fase", category: "Sumber", kind: "source", poles: 1, defaults: { voltage: 230, on: true }, description: "Sumber AC fase-netral." },
  sourceDC: { name: "Sumber DC", category: "Sumber", kind: "source", poles: 0, defaults: { voltage: 24, on: true }, description: "Sumber tegangan DC ideal + dan −." },
  breaker1: { name: "MCB 1P", category: "Proteksi", kind: "breaker", poles: 1, defaults: { rating: 6, curve: "C", on: true }, description: "Sakelar pemutus dengan model trip pembelajaran, bukan kurva pabrikan." },
  breaker2: { name: "MCB 2P", category: "Proteksi", kind: "breaker", poles: 2, defaults: { rating: 16, curve: "C", on: true }, description: "Dua kutub beroperasi bersama." },
  breaker3: { name: "MCB 3P", category: "Proteksi", kind: "breaker", poles: 3, defaults: { rating: 20, curve: "C", on: true }, description: "Tiga kutub beroperasi bersama." },
  breaker4: { name: "MCB 4P", category: "Proteksi", kind: "breaker", poles: 4, width: 160, defaults: { rating: 40, curve: "C", on: true }, description: "Empat kutub beroperasi bersama." },
  fuse: { name: "Sekering", category: "Proteksi", kind: "fuse", poles: 1, defaults: { rating: 4, on: true }, description: "Model sekering ideal dengan trip simulasi; reset berarti mengganti sekering." },
  rcd: { name: "RCCB 2P", category: "Proteksi", kind: "rcd", poles: 2, defaults: { leakageMA: 0, thresholdMA: 30, on: true }, description: "Trip berdasarkan kebocoran yang disuntikkan; bukan proteksi arus lebih." },
  overload: { name: "Thermal overload", category: "Proteksi", kind: "overload", poles: 3, width: 220, defaults: { rating: 4, thermalSeconds: 20 }, description: "Elemen daya tetap tersambung saat trip. Kontak 95–96 membuka; 97–98 menutup. Hubungkan ke coil!" },
  pfr: { name: "Phase failure relay", category: "Proteksi", kind: "pfr", width: 180, defaults: { minVoltage: 320, expected: "any" }, description: "Memeriksa tiga fase. Tc common, Ta sehat, Tb gangguan; terminal generik mengikuti referensi." },
  contactor1: { name: "Kontaktor 1P", category: "Kontaktor", kind: "contactor", poles: 1, defaults: {}, description: "Dikendalikan coil dengan tag yang sama." },
  contactor2: { name: "Kontaktor 2P", category: "Kontaktor", kind: "contactor", poles: 2, defaults: {}, description: "Dikendalikan coil dengan tag yang sama." },
  contactor3: { name: "Kontaktor 3P", category: "Kontaktor", kind: "contactor", poles: 3, defaults: {}, description: "Dikendalikan coil dengan tag yang sama, lintas lembar." },
  contactor4: { name: "Kontaktor 4P", category: "Kontaktor", kind: "contactor", poles: 4, width: 160, defaults: {}, description: "Empat kutub, satu tag coil." },
  switch: { name: "Sakelar ON/OFF", category: "Tombol & sakelar", kind: "switch", defaults: { on: false }, description: "Klik untuk beralih; posisi bertahan." },
  start: { name: "Push button NO", category: "Tombol & sakelar", kind: "start", defaults: {}, description: "Tahan klik/Space: menutup. Lepaskan: membuka." },
  stop: { name: "Push button NC", category: "Tombol & sakelar", kind: "stop", defaults: {}, description: "Tahan klik/Space: membuka. Lepaskan: menutup." },
  estop: { name: "Emergency stop", category: "Tombol & sakelar", kind: "estop", defaults: {}, description: "Mengunci saat ditekan. Klik lagi untuk reset simulasi." },
  selector: { name: "MAN–OFF–AUTO", category: "Tombol & sakelar", kind: "selector", defaults: { position: "AUTO" }, description: "Common ke MAN atau AUTO; OFF membuka keduanya. Jalur MAN harus dirakit sendiri." },
  limit: { name: "Limit switch", category: "Tombol & sakelar", kind: "switch", defaults: { on: false }, description: "Sakelar posisi ideal, diaktifkan dengan klik." },
  no: { name: "Kontak bantu NO", category: "Kontak bantu", kind: "no", defaults: {}, description: "Menutup ketika coil/tag proteksi aktif." },
  nc: { name: "Kontak bantu NC", category: "Kontak bantu", kind: "nc", defaults: {}, description: "Membuka ketika coil/tag proteksi aktif." },
  changeover: { name: "Kontak tukar", category: "Kontak bantu", kind: "changeover", defaults: {}, description: "11–12 saat lepas, 11–14 saat tag aktif." },
  coil: { name: "Coil relay / kontaktor", category: "Coil & timer", kind: "coil", defaults: { voltage: 230, va: 5 }, description: "A1–A2; menggerakkan seluruh kontak dengan tag yang sama." },
  ton: { name: "Timer ON-delay", category: "Coil & timer", kind: "ton", defaults: { voltage: 230, delay: 5, va: 3 }, description: "Kontak tag aktif setelah coil terus-menerus mendapat suplai selama delay." },
  toff: { name: "Timer OFF-delay", category: "Coil & timer", kind: "toff", defaults: { voltage: 230, delay: 5, va: 3 }, description: "Kontak tag bertahan selama delay setelah suplai coil terputus." },
  impulse: { name: "Impulse relay", category: "Coil & timer", kind: "impulse", defaults: { voltage: 230, va: 3 }, description: "Beralih pada setiap tepi naik suplai coil." },
  motor3: { name: "Motor 3 fase", category: "Beban", kind: "motor", poles: 3, defaults: { voltage: 400, current: 0, powerFactor: 0.8, loadFactor: 1, startFactor: 1, startSeconds: 0 }, description: "Harus menerima tiga fase berbeda. Isi arus nameplate untuk estimasi beban." },
  motor1: { name: "Motor 1 fase", category: "Beban", kind: "motor", poles: 1, defaults: { voltage: 230, current: 0, powerFactor: 0.8, loadFactor: 1, startFactor: 1, startSeconds: 0 }, description: "Motor AC fase-netral; model beban keadaan tunak." },
  motorDC: { name: "Motor DC", category: "Beban", kind: "motor", poles: 0, defaults: { voltage: 24, current: 0, powerFactor: 1, loadFactor: 1 }, description: "Beban motor DC ideal, tanpa pemodelan torsi atau kecepatan." },
  heater3: { name: "Heater 3 fase", category: "Beban", kind: "heater", poles: 3, defaults: { voltage: 400, watts: 0 }, description: "Beban pemanas seimbang. Isi daya listrik total dalam watt." },
  heater1: { name: "Heater 1 fase", category: "Beban", kind: "heater", poles: 1, defaults: { voltage: 230, watts: 0 }, description: "Beban resistif satu fase." },
  lamp: { name: "Lampu indikator", category: "Beban", kind: "lamp", poles: 1, defaults: { voltage: 230, watts: 2, color: "#73da9b" }, description: "Menyala hanya jika kedua terminal mendapat beda potensial yang sesuai." },
  buzzer: { name: "Buzzer / alarm", category: "Beban", kind: "buzzer", poles: 1, defaults: { voltage: 230, watts: 3 }, description: "Indikator alarm visual, tanpa bunyi otomatis." },
  compressor: { name: "Compressor / CDU", category: "Refrigerasi", kind: "motor", poles: 3, defaults: { voltage: 400, current: 0, powerFactor: 0.8, loadFactor: 1, startFactor: 1, startSeconds: 0 }, description: "Beban CDU tiga fase. Detail kontrol internal adalah model latihan yang ditandai." },
  evaporator: { name: "Fan evaporator", category: "Refrigerasi", kind: "motor", poles: 3, defaults: { voltage: 400, current: 0, powerFactor: 0.8, loadFactor: 1, startFactor: 1, startSeconds: 0 }, description: "Beban motor evaporator tiga fase." },
  valve: { name: "Solenoid valve", category: "Refrigerasi", kind: "valve", poles: 1, defaults: { voltage: 230, watts: 10 }, description: "Aktuator ON/OFF. Model ini tidak menghitung tekanan refrigerant." },
  controller: { name: "Kontrol cold room", category: "Refrigerasi", kind: "controller", width: 340, defaults: { voltage: 230, setpoint: 2, differential: 2, restartDelay: 10, defrostInterval: 3600, defrostDuration: 60, defrostEnd: 8, drip: 10, fanDelay: 10, fanWithComp: false }, description: "Model fungsional terinspirasi wiring ETC-974; bukan emulasi firmware. Semua nilai awal adalah contoh latihan." },
  probe: { name: "Sensor suhu", category: "Refrigerasi", kind: "probe", defaults: { value: 8, roomBinding: "" }, description: "Sensor dua terminal. Suhu manual, atau roomBinding room / evaporator untuk suhu dinamis." },
  pressure: { name: "HP/LP switch", category: "Refrigerasi", kind: "pressure", defaults: { on: true }, description: "Kontak NC keselamatan dengan keluaran alarm. Klik untuk mensimulasikan tekanan abnormal." },
  junction: { name: "Titik sambung", category: "Lainnya", kind: "junction", width: 80, defaults: {}, description: "Keempat terminal terhubung. Kabel bersilangan tidak otomatis tersambung." },
  terminal: { name: "Terminal block", category: "Lainnya", kind: "terminal", defaults: {}, description: "Sambungan terminal 1–2." },
  bus: { name: "Koneksi antarlembar", category: "Lainnya", kind: "bus", defaults: { net: "NET1" }, description: "Semua konektor dengan nama net persis sama terhubung." },
  text: { name: "Catatan", category: "Lainnya", kind: "text", width: 220, defaults: {}, description: "Anotasi bebas; tidak mempengaruhi rangkaian." },
};
CATALOG.xr70 = { ...CATALOG.controller, name:"Kontrol Dixell XR70CX", width:420, defaults:{...CATALOG.controller.defaults}, description:"Model fungsi dan terminal mengikuti gambar Lion: 1 common fan/comp, 6 common defrost, 4–5 suplai, 10–11–12 sensor. Bukan emulasi firmware." };
CATALOG.cyclic = { name:"Timer pergantian berulang", category:"Coil & timer", kind:"cyclic", defaults:{voltage:230,va:3,offDuration:60,onDuration:60}, description:"Selama mendapat suplai, kontak tag bergantian NC lalu NO. Durasi contoh dalam detik; bukan jadwal kalender Theben." };
CATALOG.selector12 = { ...CATALOG.selector, name:"Selector 1–0–2", defaults:{position:"1"}, description:"Common memilih keluaran 1 atau 2; OFF membuka keduanya." };
CATALOG.compressor1 = { ...CATALOG.motor1, name:"Compressor / waterloop 1 fase", category:"Refrigerasi", defaults:{...CATALOG.motor1.defaults} };
CATALOG.evaporator1 = { ...CATALOG.motor1, name:"Fan evaporator 1 fase", category:"Refrigerasi", defaults:{...CATALOG.motor1.defaults} };
CATALOG.mccb={...CATALOG.breaker3,name:"MCCB 3P adjustable",defaults:{...CATALOG.breaker3.defaults,rating:63,tripSetting:63,magnetic:10,breakingKA:25,voltage:415},description:"Trip thermal dan magnetic dengan setelan Ir. Kurva model dapat diatur, bukan kurva sertifikasi pabrikan."};
CATALOG.interval={...CATALOG.ton,name:"Timer interval",kind:"interval",description:"Kontak aktif selama durasi sejak tepi naik suplai coil."};
CATALOG.schedule={...CATALOG.ton,name:"Timer mingguan / Theben",kind:"schedule",defaults:{voltage:230,va:3,schedule:"1,2,3,4,5,6,7@08:00-17:00",override:"AUTO"},description:"Jam virtual hari 1=Senin. Format jadwal: 1,2,3@08:00-17:00;4,5@09:00-18:00. Kontak menggunakan tag timer."};
CATALOG.selector4={...CATALOG.selector,name:"Selector M–O–A · 4 terminal",defaults:{position:"AUTO",mapping:"MAN:13-14;OFF:;AUTO:23-24"},description:"Dua blok kontak terpisah. Mapping posisi dapat diubah; pisahkan pasangan dengan koma."};
CATALOG.selector102={...CATALOG.selector4,name:"Selector 1–0–2 · 4 terminal",defaults:{position:"1",mapping:"1:13-14;OFF:;2:23-24"}};
CATALOG.hp={...CATALOG.pressure,name:"HP pressure switch",defaults:{on:true,pressureType:"HP",cutOut:24,cutIn:18,resetMode:"manual",contact:"NC"}};
CATALOG.lp={...CATALOG.pressure,name:"LP / KP1 pressure switch",defaults:{on:true,pressureType:"LP",cutOut:.5,cutIn:1.5,resetMode:"auto",contact:"NC"}};
CATALOG.condenser={...CATALOG.evaporator,name:"Fan condenser",defaults:{...CATALOG.evaporator.defaults}};
CATALOG.ventilator={...CATALOG.motor1,name:"Ventilator",category:"Refrigerasi",defaults:{...CATALOG.motor1.defaults}};
CATALOG.roomLamp={...CATALOG.lamp,name:"Lampu ruang",defaults:{...CATALOG.lamp.defaults,watts:15}};
for(const [id,name] of [["drainHeater","Drain heater"],["doorHeater","Door heater"],["crankcaseHeater","Crankcase heater"],["customLoad","Beban resistif custom"]])CATALOG[id]={...CATALOG.heater1,name,defaults:{...CATALOG.heater1.defaults}};
CATALOG.neutral={...CATALOG.terminal,name:"Terminal netral",defaults:{function:"N"}};
CATALOG.earth={...CATALOG.terminal,name:"Terminal PE",defaults:{function:"PE"}};
CATALOG.voltmeter={name:"Voltmeter",category:"Lainnya",kind:"meter",defaults:{mode:"voltage",voltage:400},description:"Pengukuran beda potensial terminal V1–V2, tanpa menghubungkannya secara konduktif."};
CATALOG.ammeter={...CATALOG.voltmeter,name:"Ampere meter / CT",defaults:{mode:"current",wire:""},description:"Pilih ID kabel yang diukur oleh CT; terminal tegangan tetap terisolasi."};
CATALOG.multimeter={...CATALOG.voltmeter,name:"Multifunction meter",defaults:{mode:"multi",wire:"",voltage:400}};
CATALOG.transformer={name:"Trafo kontrol",category:"Sumber",kind:"transformer",defaults:{voltage:400,secondary:230,va:100,frequency:50},description:"Trafo ideal terisolasi P1–P2 / S1–S2. Beban sekunder dipantulkan ke primer, dibatasi rating VA."};
for(const d of Object.values(CATALOG)){
  if(!["text","junction","bus"].includes(d.kind))Object.assign(d.defaults,{brand:"Custom",model:""});
  if(d.kind==="source")Object.assign(d.defaults,{frequency:d.poles===0?0:50,faultKA:0});
  if(["coil","ton","toff","impulse","cyclic","interval","schedule"].includes(d.kind))Object.assign(d.defaults,{frequency:50});
  if(d.kind==="motor")Object.assign(d.defaults,{inputMode:"nameplate",hp:0,hpUnit:"HP",hpBasis:"shaft",efficiency:.85,lra:0,fanCount:1,startingMethod:"DOL"});
  if(d.kind==="contactor")Object.assign(d.defaults,{rating:25,brand:"Custom",model:""});
  if(d.kind==="overload")Object.assign(d.defaults,{minCurrent:0,maxCurrent:100,resetMode:"manual",coolingSeconds:30});
  if(d.kind==="pfr")Object.assign(d.defaults,{maxVoltage:460,imbalance:10,delay:0});
  if(d.kind==="controller")Object.assign(d.defaults,{highAlarm:12,lowAlarm:-10});
  if(d.kind==="breaker"||d.kind==="fuse")Object.assign(d.defaults,{breakingKA:d.defaults.breakingKA??6,voltage:d.defaults.voltage??415});
}
export const projectSheets=(p:Project)=>[{id:"power" as Sheet,name:"Power"},{id:"control" as Sheet,name:"Control"},...(p.sheets??[])];
export function nextTag(p:Project,type:string){
 const k=CATALOG[type].kind, prefix=({breaker:"QF",fuse:"FU",overload:"OL",contactor:"KM",coil:"KM",no:"KM",nc:"KM",lamp:"HL",source:"G",controller:"TC",motor:"M",probe:"BT",pressure:"SP",terminal:"TB",heater:"EH",pfr:"KF",ton:"KT",toff:"KT",interval:"KT",schedule:"KT",cyclic:"KT"} as Record<string,string>)[k]??"S";
 let i=1;while(p.nodes.some(n=>n.tag===prefix+i))i++;return prefix+i;
}
export const controllerPins = (n: Node) => n.type === "xr70"
  ? { common:"1",comp:"3",fan:"2",defCommon:"6",defrost:"7",defNC:"8",line:"4",neutral:"5",evap:"10",sensorCommon:"11",room:"12" }
  : { common:"1",comp:"4",fan:"5",defCommon:"1",defrost:"2",defNC:"3",line:"6",neutral:"7",evap:"8",sensorCommon:"9",room:"10" };
export const selectorPositions = (n: Node) => ["selector12","selector102"].includes(n.type) ? ["2","OFF","1"] : ["AUTO","OFF","MAN"];
export type Port = { name: string; x: number; y: number };
export const nodeSize = (n: Node) => ({ width: n.type==="bus"?90:CATALOG[n.type]?.width ?? 120, height: n.type==="bus"?40:n.type === "overload" || CATALOG[n.type]?.kind === "controller" ? 140 : 100 });
export const number = (n: Node, key: string, fallback = 0) => typeof n.params[key] === "number" && Number.isFinite(n.params[key]) ? n.params[key] as number : fallback;
export const kind = (n: Node) => CATALOG[n.type]?.kind ?? "text";
export const poles = (n: Node) => CATALOG[n.type]?.poles ?? 1;
export const pin = (n: Node | string, name: string) => (typeof n === "string" ? n : n.id) + ":" + name;
export function ports(n: Node): Port[] {
  const d = CATALOG[n.type], { width: w, height: h } = nodeSize(n);
  const row = (names: string[], y: number) => names.map((name, i) => ({ name, x: (i + 1) * w / (names.length + 1), y }));
  const pair = (a: string, b: string) => [{ name: a, x: w / 2, y: 0 }, { name: b, x: w / 2, y: h }];
  if (d.kind === "text") return [];
  if (d.kind === "source") return row(d.poles === 3 ? ["L1", "L2", "L3", "N", "PE"] : d.poles === 0 ? ["+", "-"] : ["L", "N", "PE"], h);
  if (d.kind === "controller") return row(Array.from({length:n.type==="xr70"?12:10},(_,i)=>String(i+1)), h);
  if (d.kind === "pfr") return [...row(["L1","L2","L3"], 0), ...row(["Tc","Tb","Ta"], h)];
  if (d.kind === "transformer") return [...row(["P1","P2"],0),...row(["S1","S2"],h)];
  if (d.kind === "meter") return pair("V1","V2");
  if (d.kind === "bus") return [{ name: "A", x: w / 2, y: h }];
  if (d.kind === "junction") return [{ name: "T", x: w/2,y:0 }, { name:"B",x:w/2,y:h },{name:"L",x:0,y:h/2},{name:"R",x:w,y:h/2}];
  if (["motor","heater"].includes(d.kind)) return [...row(d.poles === 3 ? (n.params.neutralRequired?["U","V","W","N"]:["U","V","W"]) : d.poles === 0 ? ["+","-"] : ["L","N"],0), { name:"PE",x:w/2,y:h }];
  if (["coil","ton","toff","impulse","cyclic","interval","schedule"].includes(d.kind)) return pair("A1","A2");
  if (["lamp","buzzer","valve"].includes(d.kind)) return pair("X1","X2");
  if (d.kind === "changeover") return [...row(["11"],0),...row(["12","14"],h)];
  if (d.kind === "selector") return n.params.mapping?[...row(["13","23"],0),...row(["14","24"],h)]:[...row(["C"],0),...row(n.type==="selector12"?["1","2"]:["MAN","AUTO"],h)];
  if (d.kind === "pressure") return [...row(["C"],0),...row(["OK","FAULT"],h)];
  if (d.kind === "overload") return [
    {name:"1",x:25,y:0},{name:"3",x:60,y:0},{name:"5",x:95,y:0},{name:"95",x:150,y:0},{name:"97",x:195,y:0},
    {name:"2",x:25,y:h},{name:"4",x:60,y:h},{name:"6",x:95,y:h},{name:"96",x:150,y:h},{name:"98",x:195,y:h},
  ];
  if (["breaker","fuse","rcd","contactor"].includes(d.kind)) return [...row(Array.from({length:d.poles!},(_,i)=>String(i*2+1)),0),...row(Array.from({length:d.poles!},(_,i)=>String(i*2+2)),h)];
  return pair("1","2");
}
export function portPosition(n: Node, name: string) {
  const p = ports(n).find(p => p.name === name);
  if (!p) return { x: n.x, y: n.y };
  const s = nodeSize(n), angle = n.rotation * Math.PI/180;
  return { x: n.x+s.width/2+(p.x-s.width/2)*Math.cos(angle)-(p.y-s.height/2)*Math.sin(angle), y:n.y+s.height/2+(p.x-s.width/2)*Math.sin(angle)+(p.y-s.height/2)*Math.cos(angle) };
}
export const defaultCalculation: CalculationInput = { mode:"nameplate",current:0,hp:0,hpUnit:"HP",hpBasis:"cooling",phases:3,voltage:400,powerFactor:0.8,efficiency:0.85,length:0,ambient:30,grouping:1,method:"B2",maxDrop:3,upstreamDrop:0,breaker:20,startFactor:1,startPowerFactor:0.35,faultKA:0,breakingKA:6 };
const id = z.string().regex(/^[a-zA-Z0-9_-]{1,80}$/);
const finite = z.number().finite();
const positive = finite.min(0).max(1e8);
export const calculationSchema = z.object({
  mode:z.enum(["nameplate","quick"]),current:positive,hp:positive,hpUnit:z.enum(["HP","PK"]),hpBasis:z.enum(["shaft","cooling"]),
  phases:z.union([z.literal(1),z.literal(3)]),voltage:finite.min(1).max(1000),powerFactor:finite.gt(0).max(1),efficiency:finite.gt(0).max(1),
  length:positive,ambient:finite.min(10).max(60),grouping:finite.int().min(1).max(20),method:z.enum(["A2","B2","C"]),maxDrop:finite.gt(0).max(20),
  upstreamDrop:positive,breaker:positive,startFactor:finite.min(1).max(20),startPowerFactor:finite.gt(0).max(1),faultKA:positive,breakingKA:positive,
}).strict();
const point = z.object({x:finite.min(-2000).max(12000),y:finite.min(-2000).max(12000)}).strict();
const sheetSchema=z.string().refine(v=>v==="power"||v==="control"||/^sheet-[a-zA-Z0-9_-]{1,60}$/.test(v));
const cableSchema=z.object({material:z.enum(["Cu","Al"]),section:finite.gt(0).max(1000),length:positive,cores:finite.int().min(1).max(100),insulation:z.enum(["PVC","XLPE"]),ambient:finite.min(-20).max(90),method:z.enum(["A2","B2","C"]),grouping:finite.gt(0).max(1),mode:z.enum(["simple","advanced"]),ampacity:positive,resistance:positive,sizing:z.enum(["auto","manual"]).optional()}).strict();
const panelSchema=z.object({width:finite.min(100).max(5000),height:finite.min(100).max(5000),items:z.array(z.object({id,nodeId:z.string().max(80),x:finite,y:finite,width:finite.gt(0).max(5000),height:finite.gt(0).max(5000),rotation:z.union([z.literal(0),z.literal(90),z.literal(180),z.literal(270)]),kind:z.enum(["device","rail","duct"])}).strict()).max(1000)}).strict();
const eventSchema=z.object({time:positive,text:z.string().max(1000),category:z.string().max(32).optional(),nodeId:z.string().max(80).optional()});
const scenarioSchema=z.object({id:z.string().max(100),name:z.string().max(160),status:z.enum(["PASS","WARNING","FAIL"]),at:z.string().max(40),steps:z.array(z.string().max(1000)).max(100),duration:positive});
const nodeSchema = z.object({
  id,type:z.string().refine(v=>Object.hasOwn(CATALOG,v)),tag:z.string().min(1).max(32),label:z.string().max(160),
  x:finite.min(0).max(10000),y:finite.min(0).max(10000),rotation:z.union([z.literal(0),z.literal(90),z.literal(180),z.literal(270)]),sheet:sheetSchema,
  params:z.record(z.union([finite.min(-1e8).max(1e8),z.string().max(2000),z.boolean()])).refine(v=>Object.keys(v).length<=80 && !Object.keys(v).some(k=>["__proto__","prototype","constructor"].includes(k))),
}).strict();
const schema = z.object({
  format:z.literal("rjm-relay-studio"),version:z.literal(1),id,name:z.string().min(1).max(120),notes:z.string().max(12000),
  referenceKey:z.enum(REFERENCE_KEYS).optional(),
  nodes:z.array(nodeSchema).max(500),wires:z.array(z.object({id,from:z.string().max(110),to:z.string().max(110),label:z.string().max(40),color:z.enum(["auto","R","S","T","N","PE","signal"]),bends:z.array(point).max(128),cable:cableSchema.optional()}).strict()).max(2000),
  calculation:calculationSchema,
  sheets:z.array(z.object({id:sheetSchema,name:z.string().min(1).max(100)}).strict()).max(30).optional(),
  front:panelSchema.optional(),internal:panelSchema.optional(),
  room:z.object({enabled:z.boolean(),length:finite.gt(0).max(1000),width:finite.gt(0).max(1000),height:finite.gt(0).max(100),initial:finite.min(-100).max(100),ambient:finite.min(-100).max(100),productKg:positive,productSpecificHeat:finite.gt(0).max(100),envelopeU:positive,heatLoad:positive,coolingKW:positive,evaporatorKW:positive,doorKW:positive,suction:positive,discharge:positive}).strict().optional(),
  simulation:z.object({at:z.string().max(40),seconds:positive,watts:positive,maximumCurrent:positive,phaseCurrent:z.record(positive),warnings:z.array(z.string().max(1000)).max(1000),events:z.array(eventSchema).max(1000),scenarios:z.array(scenarioSchema).max(100)}).strict().optional(),
}).strict();
export function validateProject(input: unknown): Project {
  const p = schema.parse(input) as Project;
  const ids = new Set<string>(), pins = new Set<string>();
  const sheetIds=projectSheets(p).map(s=>s.id);
  if(new Set(sheetIds).size!==sheetIds.length)throw new Error("ID sheet duplikat.");
  for (const n of p.nodes) {
    if(!sheetIds.includes(n.sheet))throw new Error("Sheet tidak ditemukan: "+n.sheet);
    if (ids.has(n.id)) throw new Error("ID komponen duplikat: "+n.id);
    ids.add(n.id); ports(n).forEach(port=>pins.add(pin(n,port.name)));
  }
  for (const w of p.wires) {
    if (ids.has(w.id) || !pins.has(w.from) || !pins.has(w.to) || w.from===w.to) throw new Error("Kabel tidak valid: "+w.id);
    ids.add(w.id);
    const a=p.nodes.find(n=>w.from.startsWith(n.id+":"))!, b=p.nodes.find(n=>w.to.startsWith(n.id+":"))!;
    if (a.sheet!==b.sheet) throw new Error("Gunakan koneksi antarlembar untuk kabel lintas sheet.");
  }
  for(const layout of [p.front,p.internal])if(layout){const ids=new Set<string>();for(const item of layout.items){if(ids.has(item.id)||item.kind==="device"&&!p.nodes.some(n=>n.id===item.nodeId))throw new Error("Referensi layout panel tidak valid.");ids.add(item.id);}}
  return p;
}
export function newNode(type: string, sheet: Sheet, x: number, y: number, tag: string): Node {
  if (!Object.hasOwn(CATALOG,type)) throw new Error("Jenis komponen tidak dikenal.");
  return { id:newId(),type,sheet,x:Math.min(10000,Math.max(0,Math.round(x/20)*20)),y:Math.min(10000,Math.max(0,Math.round(y/20)*20)),rotation:0,tag,label:CATALOG[type].name,params:{...CATALOG[type].defaults} };
}
export function blankProject(name = "Rangkaian baru"): Project {
  return {format:"rjm-relay-studio",version:1,id:newId(),name,notes:"",nodes:[],wires:[],calculation:{...defaultCalculation}};
}
