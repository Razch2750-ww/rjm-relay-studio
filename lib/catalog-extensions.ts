import type { Definition } from "./circuit.ts";

/** Families shown in the supplied symbol sheets; existing IDs remain compatible. */
export function extendCatalog(c:Record<string,Definition>){
  const add=(id:string,base:string,changes:Partial<Definition>)=>{c[id]={...c[base],...changes,defaults:{...c[base].defaults,...changes.defaults}};};
  for(const [id,name,winding] of [["motorStarDelta","Motor 3 fase · star–delta","star-delta"],["motorTwoSpeed","Motor 3 fase · dua kecepatan","two-speed"],["motorDahlander","Motor Dahlander · Δ/YY","dahlander"]] as const)
    add(id,"motor3",{name,winding,defaults:winding==="star-delta"?{}:{lowCurrent:0,highCurrent:0},description:winding==="star-delta"?"Enam ujung kumparan U1/V1/W1–U2/V2/W2. Susun kontaktor Y dan Δ di luar motor; model beban seimbang, tanpa dinamika torsi.":winding==="two-speed"?"Dua kumparan terpisah 1U/1V/1W dan 2U/2V/2W. Hanya satu kelompok boleh menerima tiga fase.":"Model sambungan Δ/YY: kecepatan rendah pada 1U/1V/1W; tinggi pada 2U/2V/2W dengan 1U/1V/1W disatukan. Bukan seluruh varian nameplate Dahlander; arus internal/jumper belum dihitung."});
  for(let p=1;p<=4;p++){
    if(p>1)add("fuse"+p,"fuse",{name:`Sekering ${p}P`,poles:p});
    if(p<3)add("overload"+p,"overload",{name:`Thermal overload ${p}P`,poles:p});
    add("switchFuse"+p,"fuse",{name:`Sakelar sekering ${p}P`,poles:p,symbol:"switch-fuse"});
    c["isolator"+p]={name:`Pemisah / isolator ${p}P`,category:"Proteksi",kind:"isolator",poles:p,symbol:"isolator",defaults:{on:true,rating:32},description:"Pemisah manual semua kutub. Tidak mempunyai trip arus lebih."};
    add("loadSwitch"+p,"isolator"+p,{name:`Sakelar pemutus beban ${p}P`,symbol:"load-switch"});
    add("magneticBreaker"+p,"breaker"+p,{name:`Pemutus magnetik ${p}P`,tripMode:"magnetic",symbol:"magnetic",description:"Trip magnetik instan pada kelipatan setelan; tidak memodelkan trip termal."});
    add("thermalBreaker"+p,"breaker"+p,{name:`Pemutus termal ${p}P`,tripMode:"thermal",symbol:"thermal",description:"Trip berdasarkan akumulasi panas; tanpa elemen magnetik."});
    add("contactorNC"+p,"contactor"+p,{name:`Kontaktor NC ${p}P`,contact:"NC",description:"Kontak daya tertutup saat coil dengan tag sama lepas; membuka saat coil menarik."});
  }
  add("rcd4","rcd",{name:"RCCB 4P",poles:4});
  for(const p of [2,3,4])add("rcbo"+p,"breaker"+p,{name:`RCBO ${p}P`,residual:true,symbol:"rcbo",defaults:{leakageMA:0,thresholdMA:30},description:"Gabungan trip arus lebih dan kebocoran yang disuntikkan pada simulasi."});
  c.spd={name:"Proteksi lonjakan · SPD 3P",category:"Proteksi",kind:"spd",poles:3,defaults:{rating:0},description:"Simbol proteksi lonjakan dengan PE terpisah. Menunjukkan koneksi dan suplai; gelombang impuls dan energi lonjakan tidak dihitung."};
  for(const [family,label,base,symbol] of [["switch","Sakelar","switch","switch"],["push","Push button","start","push"],["limit","Limit switch","limit","limit"],["rotary","Sakelar putar","switch","rotary"],["key","Sakelar kunci","switch","key"]]){
    for(const [suffix,contact] of [["NO","NO"],["NC","NC"],["NOnc","NO+NC"],["Changeover","changeover"]] as const){
      const existing=family==="switch"&&suffix==="NO"?"switch":family==="push"&&suffix==="NO"?"start":family==="push"&&suffix==="NC"?"stop":family==="limit"&&suffix==="NO"?"limit":null;
      if(existing){c[existing].symbol=symbol;continue;}
      add(family+suffix,base,{name:`${label} ${contact==="changeover"?"kontak tukar":contact}`,symbol,contact,description:`${label} ${contact}; ${family==="push"?"tahan untuk mengaktifkan, lepaskan untuk kembali":"klik untuk mengubah posisi"}. Blok NO dan NC bergerak bersama.`});
    }
  }
  add("auxMixed","no",{name:"Kontak bantu NO+NC",kind:"auxiliary",contact:"NO+NC"});
  for(const timing of ["on","off"] as const)for(const [suffix,contact] of [["NO","NO"],["NC","NC"],["Mixed","NO+NC"],["Changeover","changeover"]] as const)
    add(`aux${timing==='on'?'On':'Off'}${suffix}`,"no",{name:`Kontak ${contact} · ${timing==='on'?'ON':'OFF'}-delay`,kind:"timedContact",contact,timing,defaults:{delay:5},description:`Kontak tertunda ${timing==='on'?'saat coil menarik':'saat coil lepas'}. Isi tag yang sama dengan coil penggerak dan atur delay.`});
  add("coilRelay","coil",{name:"Coil relay",symbol:"relay"});
  add("tonoff","ton",{name:"Timer ON + OFF delay",kind:"tonoff",defaults:{delay:5,offDelay:5},description:"Output tag menunda saat suplai masuk maupun terputus. Delay ON dan OFF terpisah."});
  add("flashingLamp","lamp",{name:"Lampu indikator berkedip",symbol:"flashing",defaults:{blinkPeriod:1},description:"Berkedip saat kedua terminal mendapat suplai. Periode dalam detik; beban listrik dianggap menyala kontinu."});
  add("bell","buzzer",{name:"Bel listrik",symbol:"bell"});
  add("siren","buzzer",{name:"Sirene / horn",symbol:"siren"});
  for(const [id,name,ps] of [["connectionStraight","Koneksi lurus",["T","B"]],["connectionElbow","Koneksi siku",["T","R"]],["connectionT","Koneksi T",["T","B","R"]],["connectionCross","Koneksi silang bertitik",["T","B","L","R"]]] as const)
    add(id,"junction",{name,junctionPorts:[...ps],description:"Semua pin simbol ini terhubung. Untuk persilangan tanpa sambungan, lintaskan dua kabel biasa."});
  add("arrowDown","bus",{name:"Koneksi keluar ↓",symbol:"arrow-down"});
  add("arrowUp","bus",{name:"Koneksi masuk ↑",symbol:"arrow-up"});
  c.diode={name:"Dioda DC",category:"Lainnya",kind:"diode",defaults:{rating:0},description:"Dioda ideal DC: A anoda → K katoda. Memblokir arah balik. Tidak menghitung drop maju, recovery, atau penyearahan gelombang AC."};
  for(const phase of ["-","+","L1","L2","L3","N","PE"])add("supply"+({"-":"Minus","+":"Plus"}[phase]??phase),"bus",{name:`Konektor sumber ${phase}`,category:"Sumber",symbol:"phase",defaults:{net:phase},description:`Terhubung ke semua konektor dengan net ${phase}. Hubungkan salah satunya ke sumber yang sesuai; konektor sendiri tidak menghasilkan tegangan.`});
  add("ground","bus",{name:"Ground / bumi",category:"Sumber",symbol:"earth",defaults:{net:"PE"},description:"Referensi net PE. Tetap terpisah dari netral; hubungkan ke PE sumber."});
  add("source3Only","source3",{name:"Sumber 3 fase · L1 L2 L3",terminals:["L1","L2","L3"]});
  add("source3N","source3",{name:"Sumber 3 fase + netral",terminals:["L1","L2","L3","N"]});
  add("battery","sourceDC",{name:"Baterai DC",symbol:"battery"});
  add("generator","source3",{name:"Generator sinkron 3 fase",symbol:"generator",description:"Sumber tiga fase ideal yang bisa ON/OFF. Tidak memodelkan governor, AVR, maupun sinkronisasi generator."});
  for(const p of [1,3])c["converter"+p]={name:`Catu daya AC/DC ${p} fase`,category:"Sumber",kind:"converter",poles:p,defaults:{voltage:p===3?400:230,secondary:24,va:100},description:"Catu daya terisolasi ideal: input AC, output +/− DC. Beban output dipantulkan ke input; ripple dan switching tidak dihitung."};
  for(const id of ["motor1","motor3","motorDC","motorStarDelta","motorTwoSpeed","motorDahlander"])c[id].category="Motor";
  c.controller.name="Elitech ETC-974 · ringkas";
  add("etc974","controller",{name:"Elitech ETC-974 · detail",symbol:"etc974",defaults:{brand:"Elitech",model:"ETC-974",rating:0},description:"Terminal 1 common relay; 2 Def; 3 NC; 4 Comp; 5 Fan; 6–7 supply; 8–9 Pb2 evaporator; 9–10 Pb1 ruang. Copy key bukan terminal daya. Fungsi simulasi, bukan emulasi firmware."});
}
