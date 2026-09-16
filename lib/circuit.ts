import { z } from "zod";

export type Params = Record<string, string | number | boolean>;
export type Sheet = "power" | "control";
export type Node = { id: string; type: string; tag: string; label: string; x: number; y: number; rotation: number; sheet: Sheet; params: Params };
export type Wire = { id: string; from: string; to: string; label: string; color: string; bends: { x: number; y: number }[] };
export type Project = { format: "rjm-relay-studio"; version: 1; id: string; name: string; notes: string; nodes: Node[]; wires: Wire[]; calculation: CalculationInput };
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
  probe: { name: "Sensor suhu", category: "Refrigerasi", kind: "probe", defaults: { value: 8 }, description: "Sensor dua terminal. Suhu dapat diubah saat simulasi." },
  pressure: { name: "HP/LP switch", category: "Refrigerasi", kind: "pressure", defaults: { on: true }, description: "Kontak NC keselamatan dengan keluaran alarm. Klik untuk mensimulasikan tekanan abnormal." },
  junction: { name: "Titik sambung", category: "Lainnya", kind: "junction", width: 80, defaults: {}, description: "Keempat terminal terhubung. Kabel bersilangan tidak otomatis tersambung." },
  terminal: { name: "Terminal block", category: "Lainnya", kind: "terminal", defaults: {}, description: "Sambungan terminal 1–2." },
  bus: { name: "Koneksi antarlembar", category: "Lainnya", kind: "bus", defaults: { net: "NET1" }, description: "Semua konektor dengan nama net persis sama terhubung." },
  text: { name: "Catatan", category: "Lainnya", kind: "text", width: 220, defaults: {}, description: "Anotasi bebas; tidak mempengaruhi rangkaian." },
};
export type Port = { name: string; x: number; y: number };
export const nodeSize = (n: Node) => ({ width: n.type==="bus"?90:CATALOG[n.type]?.width ?? 120, height: n.type==="bus"?40:n.type === "overload" || n.type === "controller" ? 140 : 100 });
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
  if (d.kind === "controller") return row(["1","2","3","4","5","6","7","8","9","10"], h);
  if (d.kind === "pfr") return [...row(["L1","L2","L3"], 0), ...row(["Tc","Tb","Ta"], h)];
  if (d.kind === "bus") return [{ name: "A", x: w / 2, y: h }];
  if (d.kind === "junction") return [{ name: "T", x: w/2,y:0 }, { name:"B",x:w/2,y:h },{name:"L",x:0,y:h/2},{name:"R",x:w,y:h/2}];
  if (["motor","heater"].includes(d.kind)) return [...row(d.poles === 3 ? ["U","V","W"] : d.poles === 0 ? ["+","-"] : ["L","N"],0), { name:"PE",x:w/2,y:h }];
  if (["coil","ton","toff","impulse"].includes(d.kind)) return pair("A1","A2");
  if (["lamp","buzzer","valve"].includes(d.kind)) return pair("X1","X2");
  if (d.kind === "changeover") return [...row(["11"],0),...row(["12","14"],h)];
  if (d.kind === "selector") return [...row(["C"],0),...row(["MAN","AUTO"],h)];
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
const nodeSchema = z.object({
  id,type:z.string().refine(v=>Object.hasOwn(CATALOG,v)),tag:z.string().min(1).max(32),label:z.string().max(160),
  x:finite.min(0).max(10000),y:finite.min(0).max(10000),rotation:z.union([z.literal(0),z.literal(90),z.literal(180),z.literal(270)]),sheet:z.enum(["power","control"]),
  params:z.record(z.union([finite.min(-1e8).max(1e8),z.string().max(200),z.boolean()])).refine(v=>Object.keys(v).length<=40 && !Object.keys(v).some(k=>["__proto__","prototype","constructor"].includes(k))),
}).strict();
const schema = z.object({
  format:z.literal("rjm-relay-studio"),version:z.literal(1),id,name:z.string().min(1).max(120),notes:z.string().max(12000),
  nodes:z.array(nodeSchema).max(500),wires:z.array(z.object({id,from:z.string().max(110),to:z.string().max(110),label:z.string().max(40),color:z.enum(["auto","R","S","T","N","PE","signal"]),bends:z.array(point).max(20)}).strict()).max(2000),
  calculation:calculationSchema,
}).strict();
export function validateProject(input: unknown): Project {
  const p = schema.parse(input) as Project;
  const ids = new Set<string>(), pins = new Set<string>();
  for (const n of p.nodes) {
    if (ids.has(n.id)) throw new Error("ID komponen duplikat: "+n.id);
    ids.add(n.id); ports(n).forEach(port=>pins.add(pin(n,port.name)));
  }
  for (const w of p.wires) {
    if (ids.has(w.id) || !pins.has(w.from) || !pins.has(w.to) || w.from===w.to) throw new Error("Kabel tidak valid: "+w.id);
    ids.add(w.id);
    const a=p.nodes.find(n=>w.from.startsWith(n.id+":"))!, b=p.nodes.find(n=>w.to.startsWith(n.id+":"))!;
    if (a.sheet!==b.sheet) throw new Error("Gunakan koneksi antarlembar untuk kabel lintas sheet.");
  }
  return p;
}
export function newNode(type: string, sheet: Sheet, x: number, y: number, tag: string): Node {
  if (!Object.hasOwn(CATALOG,type)) throw new Error("Jenis komponen tidak dikenal.");
  return { id:crypto.randomUUID(),type,sheet,x:Math.min(10000,Math.max(0,Math.round(x/20)*20)),y:Math.min(10000,Math.max(0,Math.round(y/20)*20)),rotation:0,tag,label:CATALOG[type].name,params:{...CATALOG[type].defaults} };
}
export function blankProject(name = "Rangkaian baru"): Project {
  return {format:"rjm-relay-studio",version:1,id:crypto.randomUUID(),name,notes:"",nodes:[],wires:[],calculation:{...defaultCalculation}};
}
