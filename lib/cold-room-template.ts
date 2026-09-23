import { blankProject,newNode,pin,defaultCable,defaultRoom } from "./circuit.ts";
import type { Node,Params,Sheet } from "./circuit.ts";
import { automaticPanel } from "./panel-layout.ts";
export function coldRoomTemplate(){
 const p=blankProject("Cold storage · commissioning"),nodes:Record<string,Node>={};
 const add=(id:string,type:string,tag:string,sheet:Sheet,x:number,y:number,params:Params={},label?:string)=>{const n={...newNode(type,sheet,x,y,tag),id};n.params={...n.params,...params};if(label)n.label=label;nodes[id]=n;p.nodes.push(n);return n;};
 const w=(a:string,ap:string,b:string,bp:string,section=1.5,length=1)=>p.wires.push({id:"csw"+p.wires.length,from:pin(a,ap),to:pin(b,bp),label:String(p.wires.length+1),color:"auto",bends:[],cable:{...defaultCable,section,length}});
 const bus=(id:string,net:string,sheet:Sheet,x:number,y:number)=>add(id,"bus",net,sheet,x,y,{net},net);
 add("supply","source3","G1","power",40,40,{voltage:380,faultKA:6},"380 V / 50 Hz · Isc contoh 6 kA");
 add("main","mccb","QF1","power",70,250,{rating:40,tripSetting:40},"MCCB UTAMA 40 A");
 for(let i=0;i<3;i++){w("supply","L"+(i+1),"main",String(2*i+1),10);bus("p"+i,"L"+(i+1),"power",340+i*180,260);w("main",String(2*i+2),"p"+i,"A",10);bus("c"+i,"L"+(i+1),"control",40+i*180,20);}
 for(const [name,y]of [["N",1240],["PE",1380]] as const){bus("p"+name,name,"power",40,y);w("supply",name,"p"+name,"A",10);bus("c"+name,name,"control",40,1480+(name==="PE"?140:0));}
 const branches:{id:string;type:string;tag:string;k:string;x:number;current:number;rating:number;ol:number;params:Params}[]=[{id:"comp",type:"compressor",tag:"M1",k:"KM1",x:360,current:8,rating:16,ol:8,params:{lra:35,startSeconds:.7,powerFactor:.8}},
  {id:"fan",type:"evaporator",tag:"M2",k:"KM2",x:820,current:1.2,rating:6,ol:2.6,params:{fanCount:2,lra:6,startSeconds:.3,powerFactor:.8}},
  {id:"heat",type:"heater3",tag:"EH1",k:"KM3",x:1280,current:0,rating:10,ol:0,params:{watts:4500}}];
 for(const b of branches){
  add("b"+b.id,"breaker3","QF"+(p.nodes.filter(n=>n.type==="breaker3").length+2),"power",b.x,450,{rating:b.rating,voltage:380});
  add("k"+b.id,"contactor3",b.k,"power",b.x,650,{rating:25});
  if(b.ol)add("ol"+b.id,"overload",b.id==="comp"?"OL1":"OL2","power",b.x-40,830,{rating:b.ol,thermalSeconds:30,minCurrent:b.id==="comp"?7:2,maxCurrent:b.id==="comp"?10:3});
  add(b.id,b.type,b.tag,"power",b.x,1110,{voltage:380,current:b.current,...b.params},b.id==="comp"?"COMPRESSOR":b.id==="fan"?"EVAPORATOR · 2 FAN":"DEFROST · 3 × 1.5 kW");
  for(let i=0;i<3;i++){w("p"+i,"A","b"+b.id,String(i*2+1),10);w("b"+b.id,String(i*2+2),"k"+b.id,String(i*2+1),2.5);if(b.ol)w("k"+b.id,String(i*2+2),"ol"+b.id,String(i*2+1),2.5);w(b.ol?"ol"+b.id:"k"+b.id,String(i*2+2),b.id,["U","V","W"][i],2.5,10);}
  w(b.id,"PE","pPE","A",2.5,10);
 }
 add("condenser","condenser","M3","power",1690,1110,{voltage:380,current:.8,lra:4,startSeconds:.3},"CONDENSER FAN");
 add("bcond","breaker3","QF5","power",1690,450,{rating:4});add("kcond","contactor3","KM4","power",1690,650,{rating:25});
 for(let i=0;i<3;i++){w("p"+i,"A","bcond",String(i*2+1),10);w("bcond",String(i*2+2),"kcond",String(i*2+1));w("kcond",String(i*2+2),"condenser",["U","V","W"][i],1.5,8);}w("condenser","PE","pPE","A",1.5,8);
 for(const [i,type,tag]of [[0,"roomLamp","HLR"],[1,"ventilator","M4"]] as const){add("auxb"+i,"breaker1","QF"+(i+6),"power",2000+i*200,450,{rating:2});add("auxsw"+i,"switch","S"+(i+5),"power",2000+i*200,700,{on:true});add("aux"+i,type,tag,"power",2000+i*200,1110,{voltage:220,current:.4,watts:15});w("p0","A","auxb"+i,"1",10);w("auxb"+i,"2","auxsw"+i,"1");w("auxsw"+i,"2","aux"+i,type==="roomLamp"?"X1":"L");w("aux"+i,type==="roomLamp"?"X2":"N","pN","A");if(i)w("aux"+i,"PE","pPE","A");}
 add("bc","breaker1","QFC","control",600,180,{rating:2},"MCB CONTROL");w("c2","A","bc","1",10);
 add("pfr","pfr","KF1","control",100,220,{expected:"RST",minVoltage:340,maxVoltage:420,imbalance:8,delay:.5});add("bpfr","breaker3","QFP","control",100,90,{rating:2},"MCB SENSING PFR");for(let i=0;i<3;i++){w("c"+i,"A","bpfr",String(i*2+1),10);w("bpfr",String(i*2+2),"pfr","L"+(i+1));}w("bc","2","pfr","Tc");
 add("estop","estop","S0","control",580,400);w("pfr","Ta","estop","1");
 add("hp","hp","SP1","control",800,400);add("lp","lp","SP2","control",1020,400);w("estop","2","hp","C");w("hp","OK","lp","C");
 add("fanSafe","nc","OL2","control",1240,400);w("lp","OK","fanSafe","1");
 bus("safe","SAFE","control",1460,500);w("fanSafe","2","safe","A");
 add("ctl","controller","TC1","control",560,750,{voltage:220,setpoint:2,restartDelay:3,defrostInterval:21600,defrostDuration:120},"ETC-974 · model fungsional");w("safe","A","ctl","6");w("ctl","7","cN","A");w("safe","A","ctl","1");
 add("roomProbe","probe","BT1","control",1960,750,{value:8,roomBinding:"room"},"SENSOR RUANG");add("evapProbe","probe","BT2","control",2160,750,{value:-8,roomBinding:"evaporator"},"SENSOR EVAP");
 w("ctl","10","roomProbe","1");w("ctl","9","roomProbe","2");w("ctl","8","evapProbe","1");w("ctl","9","evapProbe","2");
 add("timer","schedule","KT1","control",1680,200,{voltage:220,schedule:"1,2,3,4,5,6,7@00:00-00:05"});w("safe","A","timer","A1");w("timer","A2","cN","A");
 const groups=[{id:"comp",k:"KM1",x:460,output:"4"},{id:"fan",k:"KM2",x:1000,output:"5"},{id:"heat",k:"KM3",x:1540,output:"2"}];
 for(const b of groups){
  add("sel"+b.id,"selector4","S"+(groups.indexOf(b)+1),"control",b.x,1050,{position:"AUTO"},b.id.toUpperCase()+" M–O–A");
  w("safe","A","sel"+b.id,"13");w("ctl",b.output,"sel"+b.id,"23");
  add("coil"+b.id,"coil",b.k,"control",b.x,1580,{voltage:220});w("coil"+b.id,"A2","cN","A");
  let target="coil"+b.id,tp="A1";
  if(b.id==="comp"){add("compSafe","nc","OL1","control",b.x,1360);w("compSafe","2",target,tp);target="compSafe";tp="1";}
  add("timer"+b.id,b.id==="heat"?"no":"nc","KT1","control",b.x+200,1270);
  if(b.id!=="heat"){w("timer"+b.id,"2",target,tp);target="timer"+b.id;tp="1";}else {w("safe","A","timerheat","1");w("timerheat","2","selheat","23");}
  w("sel"+b.id,"14",target,tp);w("sel"+b.id,"24",target,tp);
 }
 add("coilcond","coil","KM4","control",2260,1580,{voltage:220},"COIL CONDENSER");w("coilcomp","A1","coilcond","A1");w("coilcond","A2","cN","A");
 // Heater uses a real NC compressor auxiliary interlock, including manual mode.
 const heaterInputs=p.wires.filter(wire=>wire.to==="coilheat:A1");add("heatInterlock","nc","KM1","control",1540,1390);for(const wire of heaterInputs)wire.to="heatInterlock:1";w("heatInterlock","2","coilheat","A1");
 for(const [id,label,tag,x,from,port,color]of [["powerLamp","POWER","HL1",280,"bc","2","#2d965d"],["runLamp","RUN","HL2",650,"coilcomp","A1","#2d965d"],["defLamp","DEFROST","HL3",1120,"coilheat","A1","#c28424"]] as const){add(id,"lamp",tag,"control",Number(x),1850,{voltage:220,color},label);w(from,port,id,"X1");w(id,"X2","cN","A");}
 add("faultLamp","lamp","HL4","control",1600,1850,{voltage:220,color:"#ce4545"},"FAULT");add("buzzer","buzzer","HA1","control",1860,1850,{voltage:220});w("faultLamp","X2","cN","A");w("buzzer","X2","cN","A");w("faultLamp","X1","buzzer","X1");
 for(const [id,tag,x]of [["alarmComp","OL1",2020],["alarmFan","OL2",2240]] as const){add(id,"no",tag,"control",Number(x),1220);w("bc","2",id,"1");w(id,"2","faultLamp","X1");}
 for(const [id,port]of [["pfr","Tb"],["hp","FAULT"],["lp","FAULT"]])w(id,port,"faultLamp","X1");
 p.room={...defaultRoom,enabled:true};
 p.front=automaticPanel(p,true);p.internal=automaticPanel(p,false);
 p.notes="Contoh commissioning, bukan salinan proyek klien. Nameplate dan panjang kabel merupakan input latihan. 380/220 V, compressor 8 A / LRA 35 A, OL1 8 A, fan 2 × 1.2 A, heater 4.5 kW. Isc sumber contoh 6 kA; sesuaikan hasil pengukuran/perhitungan instalasi. Kurva proteksi dan thermal ruangan adalah pendekatan. Semua lampu dan selector mengikuti terminal listrik. Timer KT1 memblok compressor/fan saat defrost terjadwal. Mode heater melalui interlock NC KM1. Kontaktor KM4 condenser mengikuti supply coil KM1 melalui wiring. Feeder sebelum MCB cabang memakai 10 mm² dan sensing PFR memiliki MCB tersendiri.";
 return p;
}
