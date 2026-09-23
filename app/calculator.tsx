"use client";
import { useState } from "react";
import { Select,SelectTrigger,SelectValue,SelectContent,SelectItem } from "@/components/ui/select";
import { Table,TableHeader,TableHead,TableRow,TableBody,TableCell } from "@/components/ui/table";
import { Input } from "@/components/ui/input";
import { calculate,REFERENCES } from "../lib/calculation";
import type { CalculationInput } from "../lib/circuit";
export function Choice({value,onChange,options,label,disabled=false}:{value:string;onChange:(v:string)=>void;options:{value:string;label:string}[];label:string;disabled?:boolean}){
  return <Select value={value||"__empty__"} disabled={disabled} onValueChange={v=>onChange(v==="__empty__"?"":v)}><SelectTrigger aria-label={label} className="choice"><SelectValue placeholder={label}/></SelectTrigger><SelectContent>{options.map(o=><SelectItem key={o.value} value={o.value||"__empty__"}>{o.label||"Tidak terikat"}</SelectItem>)}</SelectContent></Select>;
}
export function Numeric({label,value,onChange,min=-1e6,max=1e6,unit="",disabled=false}:{label:string;value:number;onChange:(v:number)=>void;min?:number;max?:number;unit?:string;disabled?:boolean}){
  const [draft,setDraft]=useState({source:value,text:String(value)}),text=draft.source===value?draft.text:String(value);
  return <label className="field"><span>{label}{unit&&<small>{unit}</small>}</span><Input type="number" inputMode="decimal" step="any" disabled={disabled} value={text} min={min} max={max} onChange={e=>setDraft({source:value,text:e.target.value})} onBlur={()=>{const x=Number(text);if(text.trim()&&Number.isFinite(x)&&x>=min&&x<=max){if(x!==value)onChange(x);}else setDraft({source:value,text:String(value)});}} onKeyDown={e=>{if(e.key==="Enter")e.currentTarget.blur();}}/></label>;
}
const fmt=(n:number|undefined,d=2)=>n===undefined?"—":n.toLocaleString("id-ID",{maximumFractionDigits:d});
export default function Calculator({value,onChange}:{value:CalculationInput;onChange:(v:CalculationInput)=>void}){
  const result=calculate(value);
  const set=(key:keyof CalculationInput,v:string|number)=>onChange({...value,[key]:v});
  return <div className="calculator scroll-panel">
    <div className="section-heading"><div><h2>Hitungan kabel & beban</h2><p>Periksa asal angka. Hasil adalah kandidat awal, bukan izin pemasangan.</p></div><a href={REFERENCES.capacity} target="_blank" rel="noreferrer">Acuan tabel ↗</a></div>
    <div className="calc-layout"><section className="calc-inputs">
      <h3>Data mesin</h3>
      <Choice label="Mode input" value={value.mode} onChange={v=>set("mode",v)} options={[{value:"nameplate",label:"Lengkap · ampere nameplate"},{value:"quick",label:"Cepat · HP / PK motor"}]}/>
      {value.mode==="nameplate"?<Numeric label="Arus nominal mesin" unit="A" value={value.current} min={0} onChange={v=>set("current",v)}/>:<>
        <div className="two-fields"><Numeric label="Daya" value={value.hp} min={0} onChange={v=>set("hp",v)}/><label className="field"><span>Satuan</span><Choice label="Satuan daya" value={value.hpUnit} onChange={v=>set("hpUnit",v)} options={[{value:"HP",label:"HP · 745,7 W"},{value:"PK",label:"PK · 735,5 W"}]}/></label></div>
        <Choice label="Arti HP/PK" value={value.hpBasis} onChange={v=>set("hpBasis",v)} options={[{value:"cooling",label:"Kapasitas pendinginan / belum pasti"},{value:"shaft",label:"Sudah pasti daya poros motor"}]}/>
        <Numeric label="Efisiensi motor" value={value.efficiency} min={.01} max={1} onChange={v=>set("efficiency",v)}/>
      </>}
      <div className="two-fields"><label className="field"><span>Sistem</span><Choice label="Sistem fase" value={String(value.phases)} onChange={v=>set("phases",Number(v))} options={[{value:"1",label:"1 fase"},{value:"3",label:"3 fase seimbang"}]}/></label><Numeric label={value.phases===3?"Tegangan L–L":"Tegangan L–N"} unit="V" value={value.voltage} min={1} max={1000} onChange={v=>set("voltage",v)}/></div>
      <Numeric label="Faktor daya / cos φ" value={value.powerFactor} min={.01} max={1} onChange={v=>set("powerFactor",v)}/>
      <h3>Jalur kabel · tembaga / PVC</h3>
      <Numeric label="Panjang jalur satu arah" unit="m" value={value.length} min={0} onChange={v=>set("length",v)}/>
      <Choice label="Cara pemasangan" value={value.method} onChange={v=>set("method",v)} options={[{value:"A2",label:"A2 · kabel dalam dinding berinsulasi"},{value:"B2",label:"B2 · kabel multikore dalam conduit"},{value:"C",label:"C · kabel dipasang langsung"}]}/>
      <div className="two-fields"><Numeric label="Suhu sekitar" unit="°C" value={value.ambient} min={10} max={60} onChange={v=>set("ambient",v)}/><Numeric label="Sirkuit dikelompokkan" value={value.grouping} min={1} max={20} onChange={v=>set("grouping",Math.ceil(v))}/></div>
      <div className="two-fields"><Numeric label="Batas drop desain" unit="%" value={value.maxDrop} min={.1} max={20} onChange={v=>set("maxDrop",v)}/><Numeric label="Drop sisi hulu" unit="V" value={value.upstreamDrop} min={0} onChange={v=>set("upstreamDrop",v)}/></div>
      <h3>Pengaman & starting</h3>
      <Numeric label="Rating MCB/MCCB yang diuji" unit="A" value={value.breaker} min={0} onChange={v=>set("breaker",v)}/>
      <div className="two-fields"><Numeric label="Arus start / nominal" unit="×" value={value.startFactor} min={1} max={20} onChange={v=>set("startFactor",v)}/><Numeric label="cos φ saat start" value={value.startPowerFactor} min={.01} max={1} onChange={v=>set("startPowerFactor",v)}/></div>
      <div className="two-fields"><Numeric label="Ik prospektif (0: belum ada)" unit="kA" value={value.faultKA} min={0} onChange={v=>set("faultKA",v)}/><Numeric label="Breaking capacity" unit="kA" value={value.breakingKA} min={0} onChange={v=>set("breakingKA",v)}/></div>
    </section><section className="calc-results">
      {result.error?<div className="empty-result"><h3>Lengkapi data sebelum memilih kabel</h3><p>{result.error}</p></div>:<>
        <div className="calculation-summary"><div><span>Arus beban</span><strong>{fmt(result.current)} <small>A</small></strong></div><div><span>Daya aktif</span><strong>{fmt(result.kw)} <small>kW</small></strong></div><div><span>Kandidat awal</span><strong>{result.candidate?fmt(result.candidate.size,1):"—"} <small>mm²</small></strong></div></div>
        <p className="formula">Iz terkoreksi = Iz tabel × {fmt(result.kt)} (suhu) × {fmt(result.kg)} (kelompok). Uji: Ib ≤ In ≤ Iz, lalu cek drop tegangan.</p>
        <Table><TableHeader><TableRow><TableHead>mm²</TableHead><TableHead>Iz tabel</TableHead><TableHead>Iz koreksi</TableHead><TableHead>Drop total</TableHead><TableHead>Saat start</TableHead><TableHead>Uji awal</TableHead></TableRow></TableHeader><TableBody>
          {result.rows.map(row=><TableRow key={row.size} className={row.size===result.candidate?.size?"candidate-row":""}><TableCell>{fmt(row.size,1)}</TableCell><TableCell>{fmt(row.base,1)} A</TableCell><TableCell>{fmt(row.iz)} A</TableCell><TableCell>{fmt(row.dropPercent)}%</TableCell><TableCell>{fmt(row.startDropPercent)}%</TableCell><TableCell>{row.pass?"Lolos awal":"Tidak lolos"}</TableCell></TableRow>)}
        </TableBody></Table>
        <div className="calculation-note"><h3>Kontaktor & overload</h3><p>Arus beban acuan: {fmt(result.contactorMinA)} A. Untuk motor, periksa rating AC-3 pada tegangan aktual, duty dan koordinasi pabrikan. Ini belum memilih kode produk.</p><p>{result.overloadReferenceA?"Arus nameplate acuan overload: "+fmt(result.overloadReferenceA)+" A. Setelan akhir mengikuti motor dan cara pemasangan.":"Mode cepat tidak menghasilkan setelan overload final. Lengkapi nameplate dulu."}</p></div>
        <h3>Batas hasil</h3><ul className="warning-list">{result.warnings?.map(w=><li key={w}>{w}</li>)}</ul>
      </>}
      <div className="calculation-note"><h3>Metode yang dipakai</h3><p>Tabel sederhana Cu/PVC 1,5–25 mm², tidak ditanam. Faktor pengelompokan konservatif untuk susunan enclosed. Suhu dibulatkan ke kondisi berikutnya yang lebih panas.</p><p>ΔU = {value.phases===3?"√3":"2"} × I × L × (R cosφ + X sinφ), R = 23,7 / S Ω/km dan X = 0,08 Ω/km. Panjang input dalam meter, dikonversi ke kilometer. Drop saat start tidak menaksir kenaikan drop sisi hulu.</p><a href={REFERENCES.correction} target="_blank" rel="noreferrer">Faktor koreksi ↗</a> · <a href={REFERENCES.drop} target="_blank" rel="noreferrer">Rumus voltage drop ↗</a></div>
    </section></div>
  </div>;
}
