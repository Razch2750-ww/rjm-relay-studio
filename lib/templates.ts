import { blankProject, newNode, pin, portPosition } from "./circuit.ts";
import type { Node, Params, Project, Sheet } from "./circuit.ts";

export function jagoTemplate():Project {
  const p=blankProject("Jago Coffee · Panel cold room");
  p.referenceKey="jago";
  const nodes:Record<string,Node>={};
  const add=(id:string,type:string,tag:string,label:string,sheet:Sheet,x:number,y:number,params:Params={})=>{
    const n={...newNode(type,sheet,x,y,tag),id,label};n.params={...n.params,...params};nodes[id]=n;p.nodes.push(n);return n;
  };
  const wire=(a:string,ap:string,b:string,bp:string,label="",color="auto",lane?:number)=>{
    const start=portPosition(nodes[a],ap),end=portPosition(nodes[b],bp);
    p.wires.push({id:"wire"+p.wires.length,from:pin(a,ap),to:pin(b,bp),label,color,bends:lane===undefined?[]:[{x:start.x,y:lane},{x:end.x,y:lane}]});
  };
  const bus=(id:string,net:string,sheet:Sheet,x:number,y:number)=>add(id,"bus",net,net,sheet,x,y,{net});
  add("supply","source3","SUP","400 V · 50 Hz (asumsi)","power",40,40);
  add("main","breaker3","M1","UTAMA · 40 A","power",60,230,{rating:40});
  for(let i=0;i<3;i++)wire("supply","L"+(i+1),"main",String(i*2+1),"",["R","S","T"][i]);
  ["R","S","T"].forEach((phase,i)=>{bus("p"+phase,phase,"power",280+i*150,260);wire("main",String(i*2+2),"p"+phase,"A",phase,phase,380+i*20);});
  bus("pN","N","power",80,1130);wire("supply","N","pN","A","N","N");
  bus("pPE","PE","power",80,1190);wire("supply","PE","pPE","A","PE","PE");
  const branch=[{id:"cdu",x:340,m:"M2",a:20,k:"K1",load:"compressor",label:"CONDENSING UNIT"},
    {id:"heater",x:700,m:"M3",a:20,k:"K2",load:"heater3",label:"HEATER DEFROST"},
    {id:"fan",x:1060,m:"M4",a:4,k:"K3",load:"evaporator",label:"FAN EVAPORATOR"}];
  for(const b of branch){
    add("b"+b.id,"breaker3",b.m,b.a+" A · 3P","power",b.x,490,{rating:b.a});
    add("k"+b.id,"contactor3",b.k,b.id==="cdu"?"Di dalam CDU":"Kontaktor "+b.id,"power",b.x,660);
    add(b.id,b.load,b.id==="cdu"?"CDU1":b.id==="fan"?"EV1":"HT1",b.label,"power",b.x,1050);
    let from="k"+b.id;
    if(b.id!=="heater"){add("f"+b.id,"overload",b.id==="cdu"?"F1":"F2",b.id==="cdu"?"CDU · rating belum diisi":"FAN · rating belum diisi","power",b.x-40,820,{rating:0});from="f"+b.id;}
    ["R","S","T"].forEach((phase,i)=>{
      wire("p"+phase,"A","b"+b.id,String(i*2+1),phase,phase,380+i*20);
      wire("b"+b.id,String(i*2+2),"k"+b.id,String(i*2+1),"",phase);
      if(b.id!=="heater")wire("k"+b.id,String(i*2+2),"f"+b.id,String(i*2+1),"",phase);
      wire(from,String(i*2+2),b.id,["U","V","W"][i],"",phase);
    });
    wire("pPE","A",b.id,"PE","PE","PE",1230);
  }
  for(const [i,label,type]of [[0,"Lampu cold room","lamp"],[1,"Ventilator","motor1"]] as const){
    const x=1420+i*200;
    add("auxB"+i,"breaker1",i===0?"M5":"M6","2 A · 1P","power",x,490,{rating:2});
    add("auxL"+i,type,i===0?"H-ROOM":"VENT",label,"power",x,890,type==="lamp"?{watts:0}:{});
    wire("pR","A","auxB"+i,"1","R","R",380);wire("auxB"+i,"2","auxL"+i,type==="lamp"?"X1":"L");
    wire("auxL"+i,type==="lamp"?"X2":"N","pN","A","N","N",1170);
    if(type==="motor1")wire("auxL"+i,"PE","pPE","A","PE","PE",1230);
  }
  ["R","S","T"].forEach((phase,i)=>bus("c"+phase,phase,"control",70+i*150,40));
  bus("cN","N","control",40,1370);
  add("pfr","pfr","PFR","Phase failure relay","control",80,190);
  add("controlMCB","breaker1","MC","CONTROL · 4 A","control",440,190,{rating:4});
  // The supplied CONTROL maps T/S/R to L1/L2/L3. Model checks presence; phase-order verification remains pending.
  ["T","S","R"].forEach((phase,i)=>wire("c"+phase,"A","pfr","L"+(i+1),phase,phase,120+i*20));
  wire("cT","A","controlMCB","1","T","T",130);wire("controlMCB","2","pfr","Tc");
  add("emergency","estop","S0","EMERGENCY STOP","control",440,370);
  add("switch","switch","S1","ON / OFF","control",440,550,{on:true});
  wire("pfr","Ta","emergency","1");wire("emergency","2","switch","1");
  add("ctl","controller","TC1","ETC-974 · model latihan","control",720,670);
  add("hlp","pressure","HLP","HP/LP eksternal","control",80,770);
  add("f2nc","nc","F2","OVERLOAD FAN · 95–96","control",270,770);
  add("f2no","no","F2","OVERLOAD FAN · 97–98","control",1370,920);
  const terminals=[1,2,3,4,5,6,7,8,9,10,11,12];
  for(const t of terminals)add("tb"+t,"terminal","TB"+String(t).padStart(2,"0"),String(t).padStart(2,"0"),"control",t<=5?60+(t-1)*180: t<10?60+(t-6)*180:1510+(t-10)*150,t<=5?1130:t<10?1300:680);
  wire("switch","2","ctl","6","26","signal",640);
  wire("ctl","7","cN","A","N","N",1420);
  wire("switch","2","tb1","1","26","signal",690);wire("tb1","2","hlp","C","IN HLP");
  wire("hlp","OK","tb2","2","OUT HLP");wire("tb2","1","f2nc","1","21");
  wire("f2nc","2","ctl","1","20","signal",930);
  wire("hlp","FAULT","tb3","2","31");
  wire("switch","2","f2no","1","26","signal",690);
  add("f1nc","nc","F1","INTERNAL CDU · asumsi","control",830,930);
  add("f1no","no","F1","FAULT CDU · model","control",1190,770);
  wire("switch","2","f1no","1","26","signal",640);wire("f1no","2","tb5","2","19");
  for(const [id,tag,label,x]of [["coilH","K2","COIL HEATER",500],["coilC","K1","COIL CDU",830],["coilF","K3","COIL EVAP",1060]]){
    add(id as string,"coil",tag as string,label as string,"control",x as number,1210);
    wire(id as string,"A2","cN","A","N","N",1420);
  }
  wire("ctl","2","coilH","A1","23","signal",960);
  wire("ctl","4","tb4","1","24","signal",870);wire("tb4","2","f1nc","1","24");wire("f1nc","2","coilC","A1");
  wire("ctl","5","coilF","A1","25","signal",1020);
  const lamps=[["compOn","COMP ON",660],["evapOn","EVAP ON",1010],["defLamp","DEFROST",440],["pfrFault","PFR FAULT",1420],["compFault","COMP FAULT",1590],["fanFault","FAN FAULT",1760],["hlpFault","HP/LP FAULT",1930]] as const;
  for(const [id,label,x]of lamps){add(id,"lamp","H-"+id,label,"control",x,1530,{color:id.includes("Fault")?"#ed6b67":id==="defLamp"?"#f0d06c":"#70d69e"});wire(id,"X2","cN","A","N","N",1660);}
  wire("ctl","2","defLamp","X1","23","signal",960);wire("ctl","4","compOn","X1","24","signal",870);wire("ctl","5","evapOn","X1","25","signal",1020);
  wire("pfr","Tb","pfrFault","X1","30","signal",340);wire("tb5","1","compFault","X1","19");
  wire("f2no","2","fanFault","X1","22");wire("tb3","1","hlpFault","X1","31");
  add("roomProbe","probe","Pb1","SENSOR RUANG","control",1760,950,{value:8});
  add("evapProbe","probe","Pb2","SENSOR DEFROST","control",1530,950,{value:-8});
  wire("ctl","8","tb10","1","27","signal",850);wire("ctl","9","tb11","1","28","signal",830);wire("ctl","10","tb12","1","29","signal",810);
  wire("tb10","2","evapProbe","1","27");wire("tb11","2","evapProbe","2","28");wire("tb11","2","roomProbe","1","28");wire("tb12","2","roomProbe","2","29");
  p.notes="ACUAN: POWER.pdf, CONTROL.pdf, CONTROL PANEL LAMP.pdf (Jago Coffee, Oktober 2025).\n"
    +"M1 40A 3P; M2 CDU 20A 3P; M3 heater 20A 3P; M4 fan 4A 3P; M5/M6 2A 1P; control 4A 1P. Ini data gambar, bukan hasil validasi rating.\n"
    +"NORMALISASI: K1 CDU, K2 heater, K3 fan mengikuti POWER. CONTROL asli menukar K2/K3. PDF asli tidak diubah.\n"
    +"F2 95–96 berada pada common output controller, sehingga trip fan memutus suplai seluruh output relay. Kontak F2 di sheet control tertaut dengan overload power berdasarkan tag.\n"
    +"ASUMSI: 400/230V 50Hz; label incoming asli tidak utuh. Arus mesin, daya heater, setelan overload, panjang kabel belum tersedia dan sengaja bernilai 0/belum diisi.\n"
    +"Coil serta kontak NC/NO F1 di dalam CDU adalah model latihan; detail internal outdoor tidak disertakan. Feedback fault CDU dimodelkan sebagai kontak, bukan klaim terminal unit sebenarnya.\n"
    +"Controller mengikuti fungsi cooling/defrost/fan, bukan firmware ETC-974. Parameter 2°C, differential 2°C, jeda restart 10s, defrost 60s, drip 10s, fan delay 10s adalah contoh yang harus diganti. Sensor 8/9/10 mengikuti gambar block; anotasi 12/13/14 di sumber masih perlu konfirmasi model fisik.\n"
    +"PFR terhubung T/S/R ke L1/L2/L3 sebagaimana CONTROL; pengecekan urutan fase dinonaktifkan sampai tipe PFR dikonfirmasi. Model mendeteksi kehilangan fase/tegangan.\n"
    +"Panel fisik 500×600 mm. HP/LP fault ada di CONTROL tetapi tidak tampak pada layout pintu; ditampilkan sebagai diagnostik tambahan.\n"
    +"Suhu digerakkan pengguna, bukan simulasi termodinamika ruangan. Crossing kabel tidak menjadi sambungan kecuali ujung bertemu terminal/junction.";
  return p;
}

export function dolTemplate():Project {
  const p=blankProject("Latihan · START / STOP & self-hold"),nodes:Record<string,Node>={};
  const add=(id:string,type:string,tag:string,x:number,y:number,params:Params={})=>{const n={...newNode(type,"control",x,y,tag),id};n.params={...n.params,...params};p.nodes.push(n);nodes[id]=n;};
  add("src","source1","SUP",80,40);add("stop","stop","STOP",120,220);add("start","start","START",120,430);
  add("seal","no","K1",340,430);add("coil","coil","K1",120,650);add("lamp","lamp","RUN",540,650);
  const w=(a:string,ap:string,b:string,bp:string)=>p.wires.push({id:"w"+p.wires.length,from:pin(a,ap),to:pin(b,bp),label:"",color:"auto",bends:[]});
  w("src","L","stop","1");w("stop","2","start","1");w("stop","2","seal","1");w("start","2","coil","A1");w("seal","2","coil","A1");
  w("coil","A2","src","N");w("coil","A1","lamp","X1");w("lamp","X2","src","N");
  p.notes="Latihan self-hold: tahan START, lalu lepas; coil K1 tetap hidup lewat kontak NO K1. Tahan STOP untuk memutus.";
  return p;
}
