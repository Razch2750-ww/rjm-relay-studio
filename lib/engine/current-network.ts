import type { Project } from "../circuit.ts";
import type { Runtime } from "./state.ts";
import { fault } from "./state.ts";
import { makeNetwork,phasor } from "./network.ts";
import { resistance } from "./cable.ts";
type Vector={re:number;im:number};
// Sparse, diagonally preconditioned conjugate gradient: Kirchhoff current balance
// on each conductive net. Finite wire resistances split parallel paths; ideal
// contacts use a tiny numerical resistance. Motor dynamics remain lumped models.
export function currentNetwork(p:Project,r:Runtime,net:ReturnType<typeof makeNetwork>,demand:Map<string,Vector>){
 const pins=[...net.adj.keys()].filter(id=>net.unique(id)),fixed=new Set(net.sources.keys()),unknown=pins.filter(id=>!fixed.has(id));
 const index=new Map(unknown.map((id,i)=>[id,i])),count=unknown.length,diag=new Float64Array(count);
 const wires=new Map(p.wires.map(w=>["w:"+w.id,w]));
 const edges:{a:string;b:string;via:string;g:number}[]=[];
 for(const a of pins)for(const e of net.adj.get(a)??[])if(a<e.to&&net.unique(e.to)){
   const w=wires.get(e.via),ohms=w?resistance(w,r.cables[w.id]?.temperature,fault(r,w.id,"loose")):0;
   const g=1/Math.max(.000001,ohms);edges.push({a,b:e.to,via:e.via,g});
   const ai=index.get(a),bi=index.get(e.to);if(ai!==undefined)diag[ai]+=g;if(bi!==undefined)diag[bi]+=g;
 }
 const multiply=(v:Float64Array)=>{
  const out=new Float64Array(count);for(const e of edges){const a=index.get(e.a),b=index.get(e.b),delta=e.g*((a===undefined?0:v[a])-(b===undefined?0:v[b]));if(a!==undefined)out[a]+=delta;if(b!==undefined)out[b]-=delta;}return out;
 };
 const dot=(a:Float64Array,b:Float64Array)=>a.reduce((sum,v,i)=>sum+v*b[i],0);
 function solve(axis:"re"|"im"){
  const x=new Float64Array(count),res=Float64Array.from(unknown,id=>demand.get(id)?.[axis]??0),z=Float64Array.from(res,(v,i)=>v/(diag[i]||1)),dir=z.slice();let rz=dot(res,z);
  const tolerance=Math.max(1e-18,dot(res,res)*1e-18);
  for(let pass=0;pass<Math.min(3000,count*3+20)&&dot(res,res)>tolerance;pass++){
   const ad=multiply(dir),den=dot(dir,ad);if(den<=0)break;const alpha=rz/den;
   for(let i=0;i<count;i++){x[i]+=alpha*dir[i];res[i]-=alpha*ad[i];z[i]=res[i]/(diag[i]||1);}
   const next=dot(res,z),beta=rz===0?0:next/rz;for(let i=0;i<count;i++)dir[i]=z[i]+beta*dir[i];rz=next;
  }
  return x;
 }
 const re=solve("re"),im=solve("im"),drops=new Map<string,Vector>(),edgeCurrent=new Map<string,number>(),sourceCurrent=new Map<string,Vector>();
 for(const id of pins){const i=index.get(id);drops.set(id,{re:i===undefined?0:re[i],im:i===undefined?0:im[i]});}
 for(const e of edges){const a=drops.get(e.a)!,b=drops.get(e.b)!,v={re:(a.re-b.re)*e.g,im:(a.im-b.im)*e.g};edgeCurrent.set(e.via,Math.hypot(v.re,v.im));
  for(const [id,sign]of [[e.a,-1],[e.b,1]] as const)if(fixed.has(id)){const old=sourceCurrent.get(id)??{re:0,im:0};sourceCurrent.set(id,{re:old.re+v.re*sign,im:old.im+v.im*sign});}
 }
 const physicalRoots=new Set(p.wires.filter(w=>resistance(w,r.cables[w.id]?.temperature,fault(r,w.id,"loose"))>0).map(w=>net.root(w.from)));
 const nodeVoltage:Runtime["nodeVoltage"]={};
 for(const id of pins){const source=net.unique(id)!,v=phasor(source),d=physicalRoots.has(net.root(id))?drops.get(id)!:{re:0,im:0};nodeVoltage[id]={re:v.re-d.re,im:v.im-d.im,source:source.source,net:net.root(id)};}
 for(const [id,source]of net.sources)if(!nodeVoltage[id])nodeVoltage[id]={...phasor(source),source:source.source,net:net.root(id)};
 return {edgeCurrent,sourceCurrent,nodeVoltage};
}
