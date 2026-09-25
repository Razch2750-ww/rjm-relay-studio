"use client";
import type { Node } from "../lib/circuit";
import { COIL_CODES,productsFor,selectedProduct } from "../lib/schneider-catalog";
import { Choice } from "./calculator";

export default function DeviceProduct({node,disabled,onSelect}:{node:Node;disabled:boolean;onSelect:(id:string,coilCode?:string)=>void}){
  const product=selectedProduct(node),items=productsFor(node),p=node.params;
  const fmt=(n:unknown)=>typeof n==="number"?n.toLocaleString("id-ID"):String(n??"");
  return <section className="device-product" aria-label="Pilihan produk Schneider">
    <div className="device-product-heading"><b>Schneider Electric</b><span>{product?product.family:"Custom"}</span></div>
    <label className="field"><span>Tipe produk</span><Choice label="Tipe produk Schneider" value={product?.id??"custom"} disabled={disabled} onChange={id=>onSelect(id)} options={[{value:"custom",label:"Custom · isi sendiri"},...items.map(p=>({value:p.id,label:p.name}))]}/></label>
    {product?<>
      {node.type==="contactor3"&&<label className="field"><span>Tegangan coil · AC 50/60 Hz</span><Choice label="Tegangan coil Schneider" disabled={disabled} value={String(p.coilCode)} onChange={code=>onSelect(product.id,code)} options={COIL_CODES.map(c=>({value:c.value,label:`${c.value} · ${c.voltage} V AC`}))}/></label>}
      <strong className="device-product-code">{String(p.model)}</strong>
      <dl className="device-product-specs">
        <dt>Kutub daya</dt><dd>{node.type.startsWith("breaker")?node.type.slice(-1):3}P{node.type==="contactor3"?" · 3 NO":""}</dd>
        {node.type==="contactor3"&&<><dt>Arus AC-3</dt><dd>{fmt(p.rating)} A · 400 V</dd><dt>Kontak bantu</dt><dd>1 NO + 1 NC</dd><dt>Coil A1–A2</dt><dd>{fmt(p.coilVoltage)} V AC</dd><dt>Coil saat menahan</dt><dd>{fmt(p.coilVA)} VA · 50 Hz</dd></>}
        {node.type==="overload"&&<><dt>Rentang setelan</dt><dd>{fmt(p.minCurrent)}–{fmt(p.maxCurrent)} A</dd><dt>Trip class</dt><dd>{fmt(p.tripClass)}</dd><dt>Kontak bantu</dt><dd>95–96 NC · 97–98 NO</dd></>}
        {node.type.startsWith("breaker")&&<><dt>Arus / kurva</dt><dd>{fmt(p.rating)} A · C</dd><dt>Kapasitas putus</dt><dd>6 kA · {fmt(p.voltage)} V</dd><dt>Standar Icn</dt><dd>IEC 60898-1</dd><dt>Lebar × tinggi</dt><dd>{fmt(p.physicalWidth)} × {fmt(p.physicalHeight)} mm</dd></>}
        {node.type==="mccb"&&<><dt>Kode pesanan</dt><dd>{fmt(p.orderCode)}</dd><dt>Rating In</dt><dd>{fmt(p.rating)} A</dd><dt>Setelan Ir</dt><dd>{fmt(p.minCurrent)}–{fmt(p.maxCurrent)} A</dd><dt>Ambang Im</dt><dd>{fmt(p.magneticAmps)} A</dd><dt>Icu · 415 V</dt><dd>25 kA · IEC 60947-2</dd></>}
      </dl>
      <p>{node.type==="overload"?"Setel ampere overload di bawah sesuai beban. ":node.type==="mccb"?"Setelan Ir tetap bisa diatur dalam rentangnya. ":node.type==="contactor3"?"Coil dengan tag sama mengikuti tegangan ini. ":""}Pilih Custom untuk mengubah spesifikasi di luar katalog.</p>
      <a href={product.source} target="_blank" rel="noreferrer">Acuan Schneider ↗</a>
    </>:<p>{items.length?"Pilih tipe untuk mengisi detail otomatis, atau isi merek, model, dan spesifikasi sendiri di bawah.":"Simbol ini memakai spesifikasi custom. Seri LC1D dan LRD tersedia pada simbol 3 kutub."}</p>}
  </section>;
}
