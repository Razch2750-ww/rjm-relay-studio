import { blankProject, controllerPins, newNode, pin, portPosition } from "./circuit.ts";
import type { Node, Params, Project, Sheet } from "./circuit.ts";

type Endpoint = [string, string];
function drawing(name:string, referenceKey:Project["referenceKey"]){
  const p=blankProject(name),nodes:Record<string,Node>={};p.referenceKey=referenceKey;
  const add=(id:string,type:string,tag:string,label:string,sheet:Sheet,x:number,y:number,params:Params={})=>{
    const n={...newNode(type,sheet,x,y,tag),id,label};n.params={...n.params,...params};nodes[id]=n;p.nodes.push(n);return n;
  };
  const wire=(from:Endpoint,to:Endpoint,label="",color="auto",lane?:number)=>{
    const a=portPosition(nodes[from[0]],from[1]),z=portPosition(nodes[to[0]],to[1]);
    p.wires.push({id:"w"+p.wires.length,from:pin(...from),to:pin(...to),label,color,bends:lane===undefined?[]:[{x:a.x,y:lane},{x:z.x,y:lane}]});
  };
  const bus=(id:string,net:string,sheet:Sheet,x:number,y:number)=>add(id,"bus",net,net,sheet,x,y,{net});
  return {p,nodes,add,wire,bus};
}
type Drawing=ReturnType<typeof drawing>;
const phases=["R","S","T"];
const phaseFeed=phases.map(phase=>["p"+phase,"A"] as Endpoint);

function supply(b:Drawing,rating:number,voltage=380,tag="M1"){
  b.add("supply","source3","SUP",voltage+" V antar-fase · model", "power",40,40,{voltage});
  b.add("main","breaker3",tag,"UTAMA · "+rating+" A · 3P","power",70,240,{rating});
  phases.forEach((phase,i)=>{
    b.wire(["supply","L"+(i+1)],["main",String(i*2+1)],phase,phase);
    b.bus("p"+phase,phase,"power",300+i*160,250);
    b.wire(["main",String(i*2+2)],["p"+phase,"A"],phase,phase,390+i*20);
  });
  for(const [i,net]of ["N","PE"].entries()){
    b.bus("p"+net,net,"power",60,1640+i*100);b.wire(["supply",net],["p"+net,"A"],net,net);
  }
}

function controlSupply(b:Drawing,emergency=false,faultLamp=true){
  phases.forEach((phase,i)=>b.bus("c"+phase,phase,"control",40+i*160,40));
  b.bus("cN","N","control",40,2200);
  b.add("controlMCB","breaker1","MC","CONTROL · 4 A","control",560,180,{rating:4});
  b.add("pfr","pfr","PFR","Pemantau fase · T / S / R","control",180,190);
  ["T","S","R"].forEach((phase,i)=>b.wire(["c"+phase,"A"],["pfr","L"+(i+1)],phase,phase,120+i*20));
  b.wire(["cT","A"],["controlMCB","1"],"T","T",130);b.wire(["controlMCB","2"],["pfr","Tc"]);
  let feed:Endpoint=["pfr","Ta"];
  if(emergency){b.add("emergency","estop","S0","EMERGENCY STOP","control",760,180);b.wire(feed,["emergency","1"],"40","signal",340);feed=["emergency","2"];}
  b.bus("controlLive","CTRL","control",970,190);b.wire(feed,["controlLive","A"],"CTRL","signal",380);
  if(faultLamp){b.add("pfrFault","lamp","H-PFR","PFR FAULT","control",1180,180,{color:"#ed6b67"});b.wire(["pfr","Tb"],["pfrFault","X1"],"30","signal",360);b.wire(["pfrFault","X2"],["cN","A"],"N","N",2360);}
}

function feeder(b:Drawing,id:string,tag:string,rating:number,x:number,y=500):Endpoint[]{
  b.add(id,"breaker3",tag,rating+" A · 3P","power",x,y,{rating});
  phaseFeed.forEach((feed,i)=>b.wire(feed,[id,String(i*2+1)],phases[i],phases[i],390+i*20));
  return phases.map((_,i)=>[id,String(i*2+2)]);
}
function motorBranch(b:Drawing,id:string,x:number,config:{m?:string;rating?:number;k:string;f?:string;type:string;label:string;single?:boolean;part?:string;feed?:Endpoint[]}){
  const {single,k,f,type,label}=config;let feeds=config.feed??phaseFeed;
  if(config.m){
    if(single){b.add("b-"+id,"breaker1",config.m,config.rating+" A · 1P","power",x,520,{rating:config.rating??0});b.wire(phaseFeed[0],["b-"+id,"1"],"R","R",390);feeds=[["b-"+id,"2"]];}
    else feeds=feeder(b,"b-"+id,config.m,config.rating??0,x,520);
  }
  b.add("k-"+id,"contactor3",k,label,"power",x,730);
  if(f)b.add("f-"+id,"overload",f,config.part??"Setelan belum diisi","power",x-30,940,{rating:0});
  b.add(id,type,id.toUpperCase(),label,"power",x,1210,{voltage:single?230:Number(b.nodes.supply.params.voltage)});
  const inputs=single?[feeds[0],["pN","A"] as Endpoint]:feeds;
  inputs.forEach((feed,i)=>{
    const color=single&&i===1?"N":phases[i];b.wire(feed,["k-"+id,String(i*2+1)],color,color,single&&i===1?690:undefined);
    if(f)b.wire(["k-"+id,String(i*2+2)],["f-"+id,String(i*2+1)],"",color);
    b.wire([f?"f-"+id:"k-"+id,String(i*2+2)],[id,single?["L","N"][i]:["U","V","W"][i]],"",color);
  });
  b.wire([id,"PE"],["pPE","A"],"PE · model","PE",1840);
}

function auxiliaries(b:Drawing,x:number,lampRating:number,ventRating:number,lampTag:string,ventTag:string){
  for(const [i,type]of ["lamp","motor1"].entries()){
    const id=i?"vent":"roomLamp",rating=i?ventRating:lampRating;
    b.add("b-"+id,"breaker1",i?ventTag:lampTag,rating+" A · 1P","power",x+i*240,520,{rating});
    b.add(id,type,i?"VENT":"H-ROOM",i?"Ventilator":"Lampu ruang","power",x+i*240,1210,i?{}:{watts:0});
    b.wire(phaseFeed[0],["b-"+id,"1"],"R","R",390);b.wire(["b-"+id,"2"],[id,i?"L":"X1"]);
    b.wire([id,i?"N":"X2"],["pN","A"],"N","N",1680);
    if(i)b.wire([id,"PE"],["pPE","A"],"PE · model","PE",1840);
  }
}

type RefrigerationUnit={id:string;name:string;x:number;kComp:string;kFan:string;kHeat:string;fComp:string;fFan:string;freezer?:boolean;dsv?:boolean;tbStart?:number};
function refrigerationControl(b:Drawing,u:RefrigerationUnit,feed:Endpoint){
  const id=(s:string)=>u.id+"-"+s,x=u.x;
  const add=(s:string,type:string,tag:string,label:string,dx:number,y:number,params:Params={})=>b.add(id(s),type,tag,label,"control",x+dx,y,params);
  const w=(a:string,ap:string,z:string,zp:string,label="",lane?:number)=>b.wire([id(a),ap],[id(z),zp],label,"signal",lane);
  const ctl=add("ctl",u.dsv?"controller":"xr70","TC-"+u.id,u.name+" · "+(u.dsv?"ETC-974":"XR70CX"),700,780,{setpoint:u.freezer?-18:2});
  const cp=controllerPins(ctl),n=(s:string)=>[id(s),"A"] as Endpoint;
  b.bus(id("feed"),"CTRL-"+u.id,"control",x+40,550);b.wire(feed,n("feed"),"","signal",480);
  b.bus(id("N"),"N","control",x+40,2090);
  add("hlp","pressure","HLP-"+u.id,u.name+" · HP/LP eksternal",80,930);
  add("fanNC","nc",u.fFan,"FAN · 95–96",310,930);
  add("fanNO","no",u.fFan,"FAN · 97–98",1340,1120);
  add("compNC","nc",u.fComp,"OL comp · model penghubung",800,1120);
  add("compNO","no",u.fComp,"Feedback fault comp · model",1150,930);
  const labels=u.dsv?{s:u.id==="u1"?"11":"20",common:u.id==="u1"?"12":"21",def:u.id==="u1"?"13":"22",comp:u.id==="u1"?"14":"23",fan:u.id==="u1"?"15":"24",hlp:u.id==="u1"?"16":"25",ff:u.id==="u1"?"17":"26",cf:u.id==="u1"?"18":"27",hf:u.id==="u1"?"19":"28"}:{s:"26",common:"20",def:"23",comp:"24",fan:"25",hlp:"21",ff:"22",cf:"19",hf:"31"};
  for(let t=1;t<=5;t++)add("tb"+t,"terminal","TB"+String((u.tbStart??1)+t-1).padStart(2,"0")+(u.dsv?"":"-"+u.id),["IN HLP","OUT HLP","HLP FAULT","SIGNAL COMP","COMP FAULT"][t-1],40+(t-1)*180,1490);
  b.wire(n("feed"),[id("ctl"),cp.line],labels.s,"signal",690);b.wire([id("ctl"),cp.neutral],n("N"),"N","N",2180);
  b.wire(n("feed"),[id("tb1"),"1"],labels.s,"signal",650);w("tb1","2","hlp","C");w("hlp","OK","tb2","2",labels.hlp);w("tb2","1","fanNC","1",labels.hlp);
  w("fanNC","2","ctl",cp.common,labels.common,1080);
  // XR70CX terminal 6 is visibly unconnected on Lion sheets 10 and 14.
  // Keep that gap: a defrost request must NOT invent power to the heater.
  if(!u.dsv)add("defGap","text","COM6-"+u.id,"COM 6 kosong di PDF · verifikasi suplai",1210,700);
  w("hlp","FAULT","tb3","2",labels.hf);
  for(const s of ["fanNO","compNO"])b.wire(n("feed"),[id(s),"1"],labels.s,"signal",670);
  w("compNO","2","tb5","2",labels.cf);
  for(const [s,tag,dx,label]of [["heatCoil",u.kHeat,480,"HEATER"],["compCoil",u.kComp,800,"COMP"],["fanCoil",u.kFan,1050,"EVAP"]] as const){add(s,"coil",tag,u.name+" · "+label,dx,1660);b.wire([id(s),"A2"],n("N"),"N","N",2180);}
  w("ctl",cp.defrost,"heatCoil","A1",labels.def,1250);w("ctl",cp.comp,"tb4","1",labels.comp,1010);w("tb4","2","compNC","1",labels.comp);w("compNC","2","compCoil","A1");w("ctl",cp.fan,"fanCoil","A1",labels.fan,1320);
  for(const [i,s]of ["defOn","compOn","fanOn","compFault","fanFault","hlpFault"].entries()){
    add(s,"lamp","H-"+u.id+"-"+s,u.name+" · "+["DEFROST","COMP ON","EVAP ON","COMP FAULT","FAN FAULT","HP/LP FAULT"][i],440+i*260,1900,{color:s.includes("Fault")?"#ed6b67":s==="defOn"?"#f0d06c":"#70d69e"});b.wire([id(s),"X2"],n("N"),"N","N",2230);
  }
  w("ctl",cp.defrost,"defOn","X1",labels.def,1250);w("ctl",cp.comp,"compOn","X1",labels.comp,1010);w("ctl",cp.fan,"fanOn","X1",labels.fan,1320);
  w("tb5","1","compFault","X1",labels.cf);w("fanNO","2","fanFault","X1",labels.ff);w("tb3","1","hlpFault","X1",labels.hf);
  add("roomProbe","probe","PB1-"+u.id,u.name+" · sensor ruang",1910,1160,{value:u.freezer?-10:8});
  add("evapProbe","probe","PB2-"+u.id,u.name+" · sensor defrost",1660,1160,{value:u.freezer?-22:-8});
  if(u.dsv){w("ctl",cp.evap,"evapProbe","1");w("ctl",cp.sensorCommon,"evapProbe","2");w("ctl",cp.sensorCommon,"roomProbe","1");w("ctl",cp.room,"roomProbe","2");}
  else{
    for(let t=6;t<=12;t++)add("tb"+t,"terminal","TB"+String(t).padStart(2,"0")+"-"+u.id,t<10?"CADANGAN":"SENSOR",t<10?40+(t-6)*170:1480+(t-10)*180,t<10?2040:820);
    w("ctl",cp.evap,"tb10","1","27",990);w("ctl",cp.sensorCommon,"tb11","1","28",970);w("ctl",cp.room,"tb12","1","29",950);
    w("tb10","2","evapProbe","1","27");w("tb11","2","evapProbe","2","28");w("tb11","2","roomProbe","1","28");w("tb12","2","roomProbe","2","29");
  }
}

const commonNotes="\nModel kontak ideal; arus mesin, daya heater, setelan overload dan panjang kabel belum diberikan. Nilai 0 berarti belum diketahui, bukan tanpa beban nyata. Konektor PE ditambahkan sebagai jalur model; detail PE lapangan perlu gambar terpisah. Suhu diatur pengguna; tidak ada termodinamika. PFR memeriksa keberadaan fase, bukan urutan putaran. Crossing tanpa terminal bukan sambungan.\nSetpoint, differential, jeda restart 10 s, defrost 60 s, drip 10 s dan fan delay 10 s adalah contoh latihan, bukan setelan commissioning. Lampu ON menunjukkan perintah coil, bukan feedback putaran motor.";
const xrNotes="\nTEMUAN: terminal 6 (common defrost) XR70CX tidak terlihat tersuplai di sheet CONTROL. Template sengaja membiarkannya kosong: permintaan defrost aktif tetapi heater tetap OFF. Verifikasi sumber COM6 sebelum menambahkan kabel; jangan menganggap relay memberi tegangan sendiri.\nTerminal XR70CX mengikuti blok PDF: 1 common fan/comp, 2 fan, 3 comp, 4/5 supply, 6 common defrost, 7 defrost, 8 NC, 10/11 Pb2, 11/12 Pb1; 9 tidak dipakai. Ini pemetaan gambar, bukan jaminan kecocokan varian controller fisik.\nHP/LP dan NC overload fan memutus common 1. Hubungan NC/NO overload compressor ke coil/fault dilengkapi sebagai model latihan karena detail internal/feedback unit tidak lengkap.";

export function lionColdTemplate(combined=true):Project{
  const b=drawing(combined?"Lion Super Indo · Freezer & chiller":"Lion Super Indo · Chiller",combined?"lion-freezer-chiller":"lion-chiller");
  supply(b,combined?32:25);controlSupply(b);
  const units:RefrigerationUnit[]=combined?[
    {id:"fz",name:"FREEZER",x:0,kComp:"K1",kFan:"K3",kHeat:"K5",fComp:"F1",fFan:"F3",freezer:true},
    {id:"ch",name:"CHILLER",x:2280,kComp:"K2",kFan:"K4",kHeat:"K6",fComp:"F2",fFan:"F4"}
  ]:[{id:"ch",name:"CHILLER",x:0,kComp:"K1",kFan:"K2",kHeat:"K3",fComp:"F1",fFan:"F2"}];
  units.forEach((u,i)=>{
    const x=350+i*1000;
    motorBranch(b,u.id+"-comp",x,{m:combined?"M"+(2+i):"M2",rating:u.freezer?25:16,k:u.kComp,f:u.fComp,type:"compressor1",single:true,label:"WATERLOOP "+u.name,part:u.freezer?"LRD21 · setelan belum diisi":"LRD12 · setelan belum diisi"});
    motorBranch(b,u.id+"-fan",x+310,{m:combined?"M"+(4+i):"M3",rating:4,k:u.kFan,f:u.fFan,type:"evaporator1",single:true,label:"EVAPORATOR "+u.name,part:"LRD07 · setelan belum diisi"});
    motorBranch(b,u.id+"-heat",x+620,{m:combined?"M"+(6+i):"M4",rating:10,k:u.kHeat,type:"heater1",single:true,label:"HEATER "+u.name});
    b.bus(u.id+"-live","CTRL","control",u.x+50,340);b.add(u.id+"-switch","switch","S-"+u.id,"ON/OFF "+u.name,"control",u.x+240,350,{on:true});b.wire([u.id+"-live","A"],[u.id+"-switch","1"]);
    refrigerationControl(b,u,[u.id+"-switch","2"]);
  });
  auxiliaries(b,combined?2440:1440,combined?6:4,4,combined?"M8":"M5",combined?"M9":"M6");
  b.p.calculation={...b.p.calculation,phases:1,voltage:230,breaker:16};
  b.p.notes="ACUAN: 15092026_WIRING_LION SUPER INDO.pdf, "+(combined?"halaman 9 power, 10 control, 11 layout. Panel 500×600 mm. SDP M2 40 A memberi panel M1 32 A.":"halaman 13 power, 14 control, 15 layout. Panel 400×500 mm. SDP M3 32 A memberi panel M1 25 A.")
    +"\nIncoming tertulis 380/230 V; model memakai 380 V antar-fase (219,4 V fase-netral). Semua cabang gambar ini mengambil R–N, bukan beban tiga fase. Dua kutub kontaktor/overload yang digunakan mengikuti gambar, kutub ketiga kosong. Tidak mengasumsikan pembagian fase otomatis."
    +(combined?"\nNORMALISASI: tag overload fan menjadi F3/F4 mengikuti power; control menggandakan F2. K1/K2 waterloop, K3/K4 fan, K5/K6 heater mengikuti power. Layout tidak menggambar overload fan selengkap sheet power.":"\nNORMALISASI: K1 waterloop, K2 fan, K3 heater mengikuti power. Sheet control mencantumkan K3 fan dan K5 heater, bertentangan dengan power. Semua kontak terkait memakai tag yang telah dinormalisasi.")
    +xrNotes+commonNotes;return b.p;
}

export function dsvTemplate():Project{
  const b=drawing("DSV Solutions · Dua CDU 8 HP","dsv");supply(b,60,400);controlSupply(b,true);
  b.add("dutyTimer","cyclic","T-DUTY","Pergantian CDU · 60 / 60 s contoh","control",1500,180);
  b.add("dutyContact","changeover","T-DUTY","NC unit 1 / NO unit 2","control",1770,180);
  b.wire(["controlLive","A"],["dutyTimer","A1"],"40","signal",420);b.wire(["dutyTimer","A2"],["cN","A"],"N","N",2320);b.wire(["controlLive","A"],["dutyContact","11"],"40","signal",400);
  for(let i=0;i<2;i++){
    const id="u"+(i+1),u:RefrigerationUnit={id,name:"MESIN "+(i+1),x:i*2280,kComp:"K"+(1+i),kHeat:"K"+(3+i),kFan:"K"+(5+i),fComp:"F"+(1+i),fFan:"F"+(3+i),dsv:true,tbStart:i?8:1};
    motorBranch(b,id+"-comp",350+i*1080,{m:"M"+(2+i),rating:20,k:u.kComp,f:u.fComp,type:"compressor",label:"CDU 8 HP · "+(i+1)});
    motorBranch(b,id+"-heat",690+i*1080,{m:"M"+(4+i),rating:20,k:u.kHeat,type:"heater3",label:"HEATER "+(i+1)});
    motorBranch(b,id+"-fan",1030+i*1080,{m:"M"+(6+i),rating:4,k:u.kFan,f:u.fFan,type:"evaporator",label:"EVAPORATOR "+(i+1)});
    b.bus(id+"-manualFeed","CTRL","control",u.x+70,340);
    b.add(id+"-selector","selector","S-"+id,"MESIN "+(i+1)+" · MAN / OFF / AUTO","control",u.x+320,350);
    // A selector contact is bidirectional: C is the output, MAN/AUTO are alternative feeds.
    b.wire([id+"-manualFeed","A"],[id+"-selector","MAN"],"40","signal",510);
    b.bus(id+"-autoFeed","AUTO-"+id,"control",u.x+510,360);b.bus(id+"-timerOut","AUTO-"+id,"control",1990+i*170,190);
    b.wire(["dutyContact",i?"14":"12"],[id+"-timerOut","A"],i?"20":"10");b.wire([id+"-autoFeed","A"],[id+"-selector","AUTO"],i?"20":"10","signal",530);
    refrigerationControl(b,u,[id+"-selector","C"]);
  }
  for(let t=6;t<=7;t++)b.add("spare"+t,"terminal","TB0"+t,"CADANGAN","control",3000+(t-6)*160,2040);
  auxiliaries(b,2580,4,4,"M8","M9");
  b.p.calculation={...b.p.calculation,mode:"quick",hp:8,hpBasis:"cooling"};
  b.p.notes="ACUAN: 22082026_WIRING_PT. DSV SOLUTIONS INDONESIA.pdf: halaman 2 power, 3 control, 4 layout; title block 24-06-2026. Panel 500×700 mm.\nKONFLIK RATING: main M1 tertulis 60 A pada power, tetapi 80 A pada layout. Template memilih 60 A dari power sebagai data gambar, bukan rekomendasi ukuran breaker. Incoming tidak terbaca utuh; 400/230 V adalah asumsi model.\nM2/M3 CDU 20 A 3P; M4/M5 heater 20 A 3P; M6/M7 evap 4 A 3P; M8/M9 lampu/vent 4 A 1P; control 4 A 1P. K1/K2 compressor, K3/K4 heater, K5/K6 evaporator; F1/F2 compressor, F3/F4 evaporator.\nAUTO mengikuti kontak timer: NC mesin 1, NO mesin 2. MAN melewati timer tetapi tetap melewati controller dan proteksi. Kedua MAN dapat menjalankan kedua mesin bersamaan; tidak ada interlock antar-MAN pada gambar. E-stop bersama memutus kontrol kedua mesin. Timer 60/60 s adalah contoh pergantian berulang, bukan jadwal kalender Theben; suplai timer dimodelkan karena detail terminal dayanya tidak ditampilkan.\nTB01–05 mesin 1; TB06–07 cadangan; TB08–12 mesin 2. Sensor memakai 8/9/10 pada blok controller; anotasi 12/13/14 di gambar masih perlu konfirmasi varian. HP/LP menggantikan jumper field dengan kontak fungsional latihan. F1/F2 internal CDU dan feedback fault belum dirinci sumber.\nHP/LP serta overload fan memutus common seluruh output relay pada unit terkait. Lampu HP/LP per unit ada di control, tetapi layout pintu hanya menampilkan satu: template menampilkan keduanya sebagai diagnostik.\n8 HP belum cukup untuk memastikan arus: basis daya poros/kapasitas pendinginan belum jelas. Input kalkulator sengaja tidak mengubah 8 HP menjadi arus atau ukuran kabel yang dianggap pasti."+commonNotes;
  return b.p;
}

export function lionPumpTemplate():Project{
  const b=drawing("Lion Super Indo · Water pump & dry cooler","lion-pump");supply(b,32);controlSupply(b,false,false);
  const dry=feeder(b,"dryBreaker","M2",25,340),pump=feeder(b,"pumpBreaker","M3",16,1580);
  for(let i=1;i<=5;i++)motorBranch(b,i<=3?"fan"+i:"pump"+(i-3),340+(i-1)*410,{k:"K"+i,f:"F"+i,type:"motor3",label:i<=3?"DRY COOLER "+i:"WATER PUMP "+(i-3),part:"LRD10 · setelan belum diisi",feed:i<=3?dry:pump});
  b.add("mode","selector","S-MODE","PUMP · MAN / OFF / AUTO","control",1550,520);
  b.add("kp1","pressure","KP1","Pressure switch · jalur MAN","control",1370,750);
  b.add("pumpSelect","selector12","S-PUMP","Pilih pump 1 / 0 / 2","control",1370,960);
  b.add("dutyTimer","cyclic","T-DUTY","Pergantian pump · 60 / 60 s contoh","control",1780,750);
  b.add("dutyContact","changeover","T-DUTY","NC pump 1 / NO pump 2","control",2050,750);
  b.wire(["controlLive","A"],["mode","C"],"","signal",460);b.wire(["mode","MAN"],["kp1","C"]);b.wire(["kp1","OK"],["pumpSelect","C"]);
  b.wire(["mode","AUTO"],["dutyTimer","A1"],"AUTO","signal",710);b.wire(["dutyTimer","A2"],["cN","A"],"N","N",2320);b.wire(["mode","AUTO"],["dutyContact","11"],"AUTO","signal",690);
  for(let i=1;i<=5;i++){
    const x=140+(i-1)*470,id=i<=3?"fan"+i:"pump"+(i-3);
    b.add(id+"-nc","nc","F"+i,"OVERLOAD · 95–96","control",x,1390);b.add(id+"-no","no","F"+i,"OVERLOAD · 97–98","control",x+190,1390);
    b.add(id+"-coil","coil","K"+i,id.toUpperCase(),"control",x,1590);
    b.add(id+"-on","lamp","H-"+id,id.toUpperCase()+" ON","control",x,1830);
    b.add(id+"-fault","lamp","HF-"+id,id.toUpperCase()+" FAULT","control",x+190,1830,{color:"#ed6b67"});
    b.wire([id+"-nc","2"],[id+"-coil","A1"]);b.wire([id+"-coil","A1"],[id+"-on","X1"]);
    b.wire(["controlLive","A"],[id+"-no","1"],"","signal",1320);b.wire([id+"-no","2"],[id+"-fault","X1"]);
    for(const [node,port]of [[id+"-coil","A2"],[id+"-on","X2"],[id+"-fault","X2"]])b.wire([node,port],["cN","A"],"N","N",2280);
    if(i<=3){b.add(id+"-switch","switch","S-FAN"+i,"ON/OFF FAN "+i,"control",x,820,{on:true});b.wire(["controlLive","A"],[id+"-switch","1"],"","signal",460);b.wire([id+"-switch","2"],[id+"-nc","1"]);}
    else{
      const j=i-3,td="tdr"+j;
      b.add(td,"ton","TDR"+j,"Delay pump "+j+" · 2 s contoh","control",2560+(j-1)*320,750,{delay:2});
      b.add(td+"-contact","no","TDR"+j,"Kontak delay · asumsi fungsional","control",2560+(j-1)*320,1050);
      b.wire(["dutyContact",j===1?"12":"14"],[td,"A1"]);b.wire([td,"A2"],["cN","A"],"N","N",2340);
      b.wire(["dutyContact",j===1?"12":"14"],[td+"-contact","1"]);b.wire([td+"-contact","2"],[id+"-nc","1"],"AUTO","signal",1280);
      b.wire(["pumpSelect",String(j)],[id+"-nc","1"],"MAN","signal",1240+j*20);
    }
  }
  b.p.notes="ACUAN: 15092026_WIRING_LION SUPER INDO.pdf: halaman 5 power, 6 control, 7 layout. Panel 500×600 mm. SDP M1 40 A memberi panel M1 32 A. M2 25 A untuk tiga fan dry cooler; M3 16 A untuk dua water pump. Motor tiga fase, LC1D09M7 + LRD10; arus dan setelan belum tersedia.\nNORMALISASI: overload pump 2 memakai F5 dari power; control menulis F4 dua kali. Fan K1–K3/F1–F3; pump K4/K5 dan F4/F5.\nSesuai control, KP1 hanya berada di jalur MAN sebelum selector 1–0–2; AUTO melewati KP1. Jangan menganggap KP1 melindungi semua mode. Selector OFF memutus kedua pump; tiga fan punya ON/OFF masing-masing. Trip satu overload hanya memutus coil motor terkait.\nASUMSI TIMER: layout mencantumkan Theben dan dua TDR, tetapi jenis kontak/terminal/setelan TDR tidak lengkap pada control. Model memakai timer bergantian 60/60 s dan ON-delay 2 s pada setiap jalur AUTO. Coil A1/A2 serta kontak NO TDR digambar eksplisit sebagai pelengkapan fungsi latihan. MAN melewati delay. Ini bukan reproduksi terminal fisik TDR dan bukan validasi interlock instalasi.\nIncoming model 380 V antar-fase (219,4 V fase-netral); PDF menulis 380/230 V. Breaker kecil tambahan pada layout tidak memiliki penelusuran control lengkap; tidak dibuatkan koneksi tebakan."+commonNotes;return b.p;
}

export function lionSdpTemplate():Project{
  const b=drawing("Lion Super Indo · Sub distribution panel","lion-sdp");supply(b,200,380,"MC1");
  for(const [i,rating]of [40,40,32].entries()){
    const feeds=feeder(b,"feeder"+(i+1),"M"+(i+1),rating,330+i*480);
    ["R","S","T","N"].forEach((phase,j)=>{
      const id="out"+(i+1)+phase;b.add(id,"terminal","OUT"+(i+1)+"-"+phase,["TO WATER PUMP","TO CH & FZ","TO CHILLER"][i],"power",300+i*480+j*110,800);
      b.wire(j===3?["pN","A"]:feeds[j],[id,"1"],phase,phase,740+j*20);
    });
  }
  for(const [i,name]of ["MUAN","PAJU 1","PAJU 2","PAJU 3","MAPO 1","MAPO 2"].entries()){
    const x=1900+i*410,feeds=feeder(b,"showcaseBreaker"+i,"M"+(4+i),i?16:25,x);
    b.add("showcase"+i,"motor3","SC"+(i+1),"SHOWCASE "+name+" · beban ekuivalen","power",x,940,{voltage:380,neutralRequired:true});
    b.add("waterloop"+i,"compressor1","WL"+(i+1),"WATERLOOP "+name+" · S–N","power",x+170,1290);
    feeds.forEach((feed,j)=>b.wire(feed,["showcase"+i,["U","V","W"][j]],phases[j],phases[j]));
    b.wire(feeds[1],["waterloop"+i,"L"],"S","S",1140);
    for(const id of ["showcase"+i,"waterloop"+i]){b.wire([id,"N"],["pN","A"],"N","N",1690);b.wire([id,"PE"],["pPE","A"],"PE · model","PE",1840);}
  }
  for(let i=0;i<2;i++){
    const x=4500+i*280,id="sydney"+(i+1);b.add(id+"Breaker","breaker1","M"+(10+i),"16 A · 1P","power",x,500,{rating:16});b.add(id,"motor1","SYD"+(i+1),"SHOWCASE SYDNEY "+(i+1)+" · ekuivalen","power",x,1290);
    b.wire(phaseFeed[0],[id+"Breaker","1"],"R","R",390);b.wire([id+"Breaker","2"],[id,"L"]);b.wire([id,"N"],["pN","A"],"N","N",1690);b.wire([id,"PE"],["pPE","A"],"PE · model","PE",1840);
  }
  const heater=feeder(b,"heaterBreaker","M12",10,5090);b.add("heater","heater3","HT-MUAN","HEATER MUAN","power",5090,1290,{voltage:380,neutralRequired:true});
  heater.forEach((feed,i)=>b.wire(feed,["heater",["U","V","W"][i]],phases[i],phases[i]));b.wire(["heater","N"],["pN","A"],"N","N",1690);b.wire(["heater","PE"],["pPE","A"],"PE · model","PE",1840);
  b.add("scope","text","SDP","SDP: distribusi daya; buka template panel tujuan untuk kontrol.","control",100,150);
  b.p.notes="ACUAN: 15092026_WIRING_LION SUPER INDO.pdf, halaman 2 power dan 3 layout. Panel SDP 600×800 mm; MC1 MCCB 200 A 3P dimodelkan sebagai pemutus ideal tiga kutub, bukan kurva MCCB pabrikan.\nM1 water pump 40 A 3P; M2 freezer/chiller 40 A 3P; M3 chiller 32 A 3P. Tiga feeder berakhir pada terminal keluaran, tidak terhubung lintas project. Buka template panel tujuan untuk mensimulasikan kontrolnya.\nM4 MUAN 25 A 3P; M5–M9 PAJU1/2/3 dan MAPO1/2 masing-masing 16 A 3P. Showcase menerima R/S/T/N; waterloop bercabang dari S setelah breaker yang sama, sesuai titik sambung kuning di power. M10/M11 SYDNEY 16 A 1P R–N. M12 heater MUAN 10 A 3P.\nShowcase digambar sebagai beban ekuivalen dengan netral wajib, karena detail internalnya tidak disertakan. Model arus tiga fase seimbang tidak menghitung ketidakseimbangan atau arus netral aktual. Timer/kontrol internal showcase tidak direka. Lampu R/S/T pada Panel uji adalah indikator net bus, bukan cabang wiring pintu. MCB control 2 A ada di layout tanpa sheet control; sambungannya belum dimodelkan.\nIncoming tertulis 380/230 V; model 380 V antar-fase memberi 219,4 V fase-netral. Tidak ada rekomendasi kabel feeder 200 A: tabel kalkulator terbatas dan perlu data beban/instalasi lengkap."+commonNotes;return b.p;
}
