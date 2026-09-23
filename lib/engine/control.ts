import { controllerPins, kind, number, pin } from "../circuit.ts";
import type { Node, Project } from "../circuit.ts";
import { setting,switched,fault } from "./state.ts";
import type { Runtime,DeviceState } from "./state.ts";
import { makeNetwork } from "./network.ts";
function sensed(p:Project,r:Runtime,n:Node,a:string,b:string,net:ReturnType<typeof makeNetwork>):number|undefined {
  const ra=net.root(pin(n,a)),rb=net.root(pin(n,b));
  if(ra===rb||net.potential(pin(n,a)).length||net.potential(pin(n,b)).length)return undefined;
  const probe=p.nodes.find(x=>kind(x)==="probe"&&((net.root(pin(x,"1"))===ra&&net.root(pin(x,"2"))===rb)||(net.root(pin(x,"2"))===ra&&net.root(pin(x,"1"))===rb)));
  if(!probe||r.manual[probe.id+":fault"]||fault(r,probe.id,"failed"))return undefined;
  return setting(r,probe,"value",8);
}

export function controllerState(p:Project,r:Runtime,n:Node,old:DeviceState,net:ReturnType<typeof makeNetwork>,dt:number):DeviceState {
  const cp=controllerPins(n),s={...old,current:0},v=net.voltage(pin(n,cp.line),pin(n,cp.neutral)),nominal=number(n,"voltage",230);
  const room=sensed(p,r,n,cp.sensorCommon,cp.room,net),evap=sensed(p,r,n,cp.evap,cp.sensorCommon,net);
  s.voltage=v;s.on=v>=nominal*0.85&&v<=nominal*1.15&&!fault(r,n.id,"failed");s.temperature=room;
  s.alarm=room===undefined||room>number(n,"highAlarm",12)||room<number(n,"lowAlarm",-10);
  if(!s.on||room===undefined||evap===undefined)return {...s,cool:false,fan:false,defrost:false,stage:s.on?"sensor-fault":"off",stageTime:0,cycleTime:0,offAt:r.now};
  if(["off","sensor-fault"].includes(s.stage)){s.stage="cooling";s.stageTime=0;}
  s.stageTime+=dt;s.cycleTime+=dt;
  const interval=Math.max(1,number(n,"defrostInterval",3600));
  if(s.stage==="cooling"&&(r.requests[n.id]||s.cycleTime>=interval)){s.stage="defrost";s.stageTime=0;s.cycleTime=0;}
  if(s.stage==="defrost" && (s.stageTime>=Math.max(1,number(n,"defrostDuration",60))||evap>=number(n,"defrostEnd",8))){s.stage="drip";s.stageTime=0;}
  if(s.stage==="drip" && s.stageTime>=Math.max(0,number(n,"drip",10))){s.stage="fan-delay";s.stageTime=0;}
  if(s.stage==="fan-delay" && s.stageTime>=Math.max(0,number(n,"fanDelay",10))){s.stage="cooling";s.stageTime=0;}
  const setpoint=setting(r,n,"setpoint",2),diff=Math.max(.1,number(n,"differential",2));
  let demand=old.cool;if(room>=setpoint+diff)demand=true;if(room<=setpoint)demand=false;
  if(!["cooling","fan-delay"].includes(s.stage))demand=false;
  if(old.cool&&!demand)s.offAt=r.now;
  s.cool=demand && r.now-s.offAt>=Math.max(0,number(n,"restartDelay",10));
  s.defrost=s.stage==="defrost";
  s.fan=s.stage==="cooling"&&(!n.params.fanWithComp||s.cool);
  return s;
}

export function pressureState(n:Node,r:Runtime,old:DeviceState):DeviceState{
 if(!n.params.pressureType)return {...old,on:switched(r,n)&&!fault(r,n.id,"pressure")};
 const hp=n.params.pressureType==="HP",pressure=r.values[n.id+":pressure"]??(hp?r.values["room:discharge"]??r.room.discharge:r.values["room:suction"]??r.room.suction);
 const abnormal=hp?pressure>=number(n,"cutOut",24):pressure<=number(n,"cutOut",.5);
 const recovered=hp?pressure<=number(n,"cutIn",18):pressure>=number(n,"cutIn",1.5);
 let tripped=old.tripped||abnormal||fault(r,n.id,"pressure");
 if(recovered&&!fault(r,n.id,"pressure")&&(n.params.resetMode==="auto"||r.requests[n.id]))tripped=false;
 return {...old,tripped,on:n.params.contact==="NO"?tripped:!tripped,voltage:0,temperature:pressure};
}
export function timerScheduled(n:Node,r:Runtime){
 const override=String(r.manual[n.id+":override"]??n.params.override??"AUTO");if(override!=="AUTO")return override==="ON";
 const seconds=r.clockStart+r.now,day=((Math.floor(seconds/86400)%7)+7)%7+1,minute=(seconds%86400)/60;
 return String(n.params.schedule??"").split(";").some(entry=>{
  const match=entry.trim().match(/^([1-7](?:,[1-7])*)@(\d{2}):(\d{2})-(\d{2}):(\d{2})$/);if(!match)return false;
  const [,days,ah,am,bh,bm]=match,a=+ah*60+ +am,b=+bh*60+ +bm;if(+ah>23||+bh>23||+am>59||+bm>59)return false;
  if(a<=b)return days.split(",").includes(String(day))&&minute>=a&&minute<b;
  return days.split(",").includes(String(day))&&minute>=a||days.split(",").includes(String(day===1?7:day-1))&&minute<b;
 });
}
