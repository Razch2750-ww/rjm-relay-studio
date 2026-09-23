import type { Project } from "../circuit.ts";
import type { Runtime } from "./state.ts";
import { advanceCircuit } from "../simulator.ts";
import { runScenario } from "./scenarios.ts";

type Request = { project:Project } & ({ type:"advance"; runtime:Runtime; seconds:number } | { type:"scenario"; id:string });
const scope=self as unknown as {onmessage:(event:MessageEvent<Request>)=>void;postMessage:(value:unknown)=>void};
scope.onmessage=({data})=>{
  try {scope.postMessage(data.type==="advance"?{runtime:advanceCircuit(data.project,data.runtime,data.seconds)}:{result:runScenario(data.project,data.id)});}
  catch(error){scope.postMessage({error:error instanceof Error?error.message:"Simulasi gagal dihitung."});}
};
scope.postMessage({ready:true,url:self.location.href});
