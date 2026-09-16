import { calculationSchema } from "./circuit.ts";
import type { CalculationInput } from "./circuit.ts";

export const REFERENCES = {
  capacity:"https://www.electrical-installation.org/enwiki/Recommended_simplified_approach_for_cable_sizing",
  correction:"https://www.electrical-installation.org/enwiki/General_method_for_cable_sizing",
  drop:"https://www.electrical-installation.org/enwiki/Calculation_of_voltage_drop_in_steady_load_conditions",
};
// Schneider EIG figure G21, simplified IEC C.52.1; Cu/PVC, unburied, up to 25 mm².
// Numbers indexed by cross-section, NOT an all-purpose NYM/NYY ampacity table.
const sizes=[1.5,2.5,4,6,10,16,25];
const capacity={
  A2:{1:[13.5,18,24,31,42,56,73],3:[13,17.5,23,29,39,52,68]},
  B2:{1:[15.5,21,28,36,50,68,89],3:[14.5,19.5,26,34,46,61,80]},
  C:{1:[19.5,27,36,46,63,85,110],3:[17,23,31,40,54,73,95]},
};
const temperatures:[[number,number],...[number,number][]]=[[10,1.22],[15,1.17],[20,1.12],[25,1.06],[30,1],[35,.94],[40,.87],[45,.79],[50,.71],[55,.61],[60,.50]];
const groups:[number,number][]=[[1,1],[2,.8],[3,.7],[4,.7],[6,.55],[9,.5],[12,.45],[16,.4],[20,.4]];
export const voltageDrop=(current:number,lengthM:number,section:number,pf:number,phases:1|3)=>
  (phases===3?Math.sqrt(3):2)*current*((23.7/section)*pf+.08*Math.sqrt(Math.max(0,1-pf*pf)))*lengthM/1000;

export function calculate(input:CalculationInput) {
  const parsed=calculationSchema.safeParse(input);
  if(!parsed.success)return {error:"Periksa input: tegangan, faktor daya, efisiensi, dan panjang harus valid.",rows:[]};
  const c=parsed.data, factor=c.phases===3?Math.sqrt(3):1;
  if(c.mode==="quick"&&c.hpBasis!=="shaft")return {error:"PK/HP kapasitas pendinginan tidak dapat langsung dikonversi menjadi arus listrik. Isi ampere nameplate atau pastikan angka tersebut benar-benar daya poros motor.",rows:[]};
  const current=c.mode==="nameplate"?c.current:c.hp*(c.hpUnit==="HP"?745.7:735.5)/(c.efficiency*factor*c.voltage*c.powerFactor);
  if(current<=0||c.length<=0||c.breaker<=0)return {error:"Isi arus / daya poros, panjang jalur satu arah, dan rating pengaman terlebih dahulu.",rows:[]};
  // Round upward to the next temperature/group count: deliberately conservative, no interpolated ampacity.
  const kt=temperatures.find(([t])=>t>=c.ambient)![1],kg=groups.find(([n])=>n>=c.grouping)![1];
  const warnings=[
    "Hasil awal untuk Cu/PVC saja, metode "+c.method+". Bukan persetujuan instalasi atau sertifikasi PUIL.",
    "Belum memverifikasi ketahanan hubung singkat kabel, waktu pemutusan, selektivitas, terminal, harmonisa, serta kondisi jalur lain.",
    "Pengaman motor, kategori kontaktor AC-3, dan setelan overload harus dicocokkan dengan datasheet mesin/pabrikan.",
  ];
  if(c.mode==="quick")warnings.unshift("ESTIMASI: HP/PK diasumsikan daya poros, dengan faktor daya dan efisiensi yang lo masukkan.");
  if(c.breaker<current)warnings.unshift("Rating pengaman lebih kecil daripada arus beban yang dihitung.");
  if(c.faultKA===0)warnings.unshift("Arus hubung singkat prospektif belum diketahui; breaking capacity belum dapat diverifikasi.");
  else if(c.breakingKA<c.faultKA)warnings.unshift("Breaking capacity pengaman lebih kecil dari arus hubung singkat input.");
  const rows=sizes.map((size,i)=>{
    const base=capacity[c.method][c.phases][i],iz=base*kt*kg,drop=voltageDrop(current,c.length,size,c.powerFactor,c.phases),dropPercent=(drop+c.upstreamDrop)/c.voltage*100;
    const startDrop=voltageDrop(current*c.startFactor,c.length,size,c.startPowerFactor,c.phases);
    return {size,base,iz,drop,dropPercent,startDropPercent:(startDrop+c.upstreamDrop)/c.voltage*100,pass:current<=c.breaker&&c.breaker<=iz&&dropPercent<=c.maxDrop};
  });
  const candidate=rows.find(row=>row.pass);
  if(!candidate)warnings.unshift("Tidak ada kandidat dalam tabel 1,5–25 mm² yang lolos pemeriksaan ini. Jangan memakai ukuran terbesar secara otomatis.");
  return {error:null,rows,current,kw:factor*c.voltage*current*c.powerFactor/1000,kva:factor*c.voltage*current/1000,kt,kg,candidate,warnings,
    contactorMinA:current,overloadReferenceA:c.mode==="nameplate"?current:null};
}
