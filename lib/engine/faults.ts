import { kind } from "../circuit.ts";
import type { Node } from "../circuit.ts";
export const FAULTS=[
 {id:"phase-loss",name:"Phase failure L1",kinds:["source"]},
 {id:"phase-reversal",name:"Urutan fase terbalik",kinds:["source"]},
 {id:"imbalance",name:"Ketidakseimbangan fase 15%",kinds:["source"]},
 {id:"undervoltage",name:"Tegangan turun 20%",kinds:["source"]},
 {id:"overvoltage",name:"Tegangan naik 20%",kinds:["source"]},
 {id:"neutral-lost",name:"Netral terputus",kinds:["source"]},
 {id:"failed",name:"PFR / controller / probe rusak",kinds:["pfr","controller","probe"]},
 {id:"overload",name:"Beban berlebih 300% · kabel: beban hilir",kinds:["motor","heater","wire"]},
 {id:"locked",name:"Locked rotor / fan macet",kinds:["motor"]},
 {id:"coil-open",name:"Coil / winding putus",kinds:["coil","ton","toff","interval","cyclic","impulse","schedule","motor"]},
 {id:"welded",name:"Kontak utama melekat",kinds:["contactor"]},
 {id:"trip",name:"Trip proteksi",kinds:["overload","breaker","fuse","rcd"]},
 {id:"pressure",name:"Tekanan abnormal HP / LP",kinds:["pressure"]},
 {id:"pressed",name:"Emergency stop ditekan",kinds:["estop"]},
 {id:"short",name:"Hubung singkat",kinds:["heater","motor","lamp","wire"]},
 {id:"open",name:"Rangkaian putus",kinds:["wire"]},
 {id:"loose",name:"Sambungan longgar · 2 Ω",kinds:["wire"]},
 {id:"derating",name:"Kapasitas kabel turun 50%",kinds:["wire"]},
] as const;
export const availableFaults=(n:Node|undefined)=>FAULTS.filter(f=>(f.kinds as readonly string[]).includes(n?kind(n):"wire"));
