import { kind,number } from "../circuit.ts";
import type { Project,ScenarioResult } from "../circuit.ts";
import { advanceCircuit,stepCircuit,interact,injectFault,freshRuntime } from "../simulator.ts";
export const SCENARIOS=[{id:"normal",name:"Startup normal"},{id:"phase-loss",name:"Phase failure"},{id:"phase-reversal",name:"Urutan fase"},{id:"overload",name:"Compressor overload"},{id:"hp",name:"HP trip"},{id:"lp",name:"LP trip"},{id:"evaporator",name:"Fan evaporator gagal"},{id:"defrost",name:"Defrost"},{id:"emergency",name:"Emergency stop"},{id:"probe",name:"Probe putus"},{id:"recovery",name:"Power recovery"},{id:"manual",name:"Mode manual"},{id:"auto",name:"Mode auto"}] as const;
export function runScenario(project:Project,id:string):ScenarioResult{
 const p=structuredClone(project),name=SCENARIOS.find(s=>s.id===id)?.name??id,steps:string[]=[],start=Date.now();
 const result=(status:ScenarioResult["status"]):ScenarioResult=>({id,name,status,at:new Date().toISOString(),steps,duration:(Date.now()-start)/1000});
 // Fixed probe temperature makes fault tests reproducible, independent of room thermal drift.
 if(p.room)p.room.enabled=false;
 const compressors=p.nodes.filter(n=>n.type.startsWith("compressor")),source=p.nodes.find(n=>n.type==="source3"),controller=p.nodes.find(n=>kind(n)==="controller"),estop=p.nodes.find(n=>kind(n)==="estop");
 if(!compressors.length){steps.push("Tidak ada compressor untuk memverifikasi respons skenario.");return result("WARNING");}
 const warmup=Math.min(120,Math.max(5,...p.nodes.map(n=>number(n,"restartDelay",0)))+2);
 let r=advanceCircuit(p,stepCircuit(p,freshRuntime()),warmup);
 if(r.halted){steps.push(...r.faults);return result("FAIL");}
 if(!compressors.some(n=>r.devices[n.id]?.on)){steps.push("Compressor tidak berjalan pada kondisi awal. Periksa mode selector, suhu, delay, dan wiring.");return result("WARNING");}
 steps.push("Startup: compressor menerima supply melalui wiring.");
 let expectedOff=true,expectedDefrost=false;
 if(id==="normal"){steps.push("Tidak ada trip selama startup; peak "+r.peak.toFixed(1)+" A.");return result(p.nodes.some(n=>r.devices[n.id]?.tripped)?"FAIL":"PASS");}
 if(["phase-loss","phase-reversal","recovery"].includes(id)){
  if(!source){steps.push("Sumber 3 fase tidak tersedia.");return result("WARNING");}
  r=id==="recovery"?interact(p,r,source.id):injectFault(p,r,source.id,id,true);
 }
 else if(id==="overload")r=injectFault(p,r,compressors[0].id,"overload",true);
 else if(id==="emergency"){if(!estop){steps.push("Emergency stop belum dirakit.");return result("WARNING");}r=injectFault(p,r,estop.id,"pressed",true);}
 else if(id==="hp"||id==="lp"){
  const n=p.nodes.find(n=>kind(n)==="pressure"&&n.params.pressureType===id.toUpperCase());if(!n){steps.push("Pressure switch "+id.toUpperCase()+" belum tersedia.");return result("WARNING");}r=injectFault(p,r,n.id,"pressure",true);
 }else if(id==="probe"){
  const n=p.nodes.find(n=>kind(n)==="probe");if(!n){steps.push("Sensor belum tersedia.");return result("WARNING");}r=injectFault(p,r,n.id,"failed",true);
 }else if(id==="defrost"){
  if(!controller){steps.push("Controller belum tersedia.");return result("WARNING");}r=interact(p,r,controller.id);expectedDefrost=true;
 }else if(id==="evaporator"){
  const n=p.nodes.find(n=>n.type.startsWith("evaporator"));if(!n){steps.push("Fan evaporator belum tersedia.");return result("WARNING");}r=injectFault(p,r,n.id,"locked",true);
 }else if(id==="manual"||id==="auto"){
  const selector=p.nodes.find(n=>kind(n)==="selector"&&String(n.params.position).match(/MAN|AUTO/));if(!selector){steps.push("Selector M-O-A belum tersedia.");return result("WARNING");}
  r=stepCircuit(p,{...r,manual:{...r.manual,[selector.id]:id==="manual"?"MAN":"AUTO"}},0);expectedOff=false;
 }
 const before=r.now;r=advanceCircuit(p,r,["overload","evaporator"].includes(id)?90:1);
 if(id==="recovery"){
  const stopped=compressors.every(n=>!r.devices[n.id]?.on);steps.push("Supply OFF: compressor "+(stopped?"STOP":"MASIH RUN"));if(!stopped)return result("FAIL");
  r=interact(p,r,source!.id);r=advanceCircuit(p,r,warmup);expectedOff=false;
 }
 const active=compressors.some(n=>r.devices[n.id]?.on),ok=expectedOff?!active:active;
 const tripped=p.nodes.filter(n=>r.devices[n.id]?.tripped).map(n=>n.tag);
 steps.push("Compressor "+(active?"RUN":"STOP"),"Proteksi trip: "+(tripped.join(", ")||"tidak ada"));
 const lamps=p.nodes.filter(n=>kind(n)==="lamp"&&r.devices[n.id]?.on).map(n=>n.tag);steps.push("Lampu menerima tegangan: "+(lamps.join(", ")||"tidak ada"));
 if(expectedDefrost){const heater=p.nodes.some(n=>kind(n)==="heater"&&r.devices[n.id]?.on);steps.push("Heater "+(heater?"ON":"OFF"));if(!heater)return result("FAIL");}
 if(r.halted)steps.push(...r.faults);steps.push("Observasi "+(r.now-before).toFixed(1)+" s setelah injeksi.");
 return result(ok&&!r.halted?"PASS":"FAIL");
}
