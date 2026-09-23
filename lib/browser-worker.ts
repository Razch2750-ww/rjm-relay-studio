// Next bundles the worker through its native URL import.
export function simulationWorker(){
  return new Worker(new URL("./engine/worker.ts", import.meta.url), {type:"module"});
}
export function warmSimulationWorker():Promise<string>{
  return new Promise((resolve,reject)=>{
    const worker=simulationWorker(),timeout=setTimeout(()=>{worker.terminate();reject(new Error("Worker cache timeout"));},10000);
    worker.onmessage=({data})=>{if(data.ready){clearTimeout(timeout);worker.terminate();resolve(data.url);}};
    worker.onerror=()=>{clearTimeout(timeout);worker.terminate();reject(new Error("Worker cache failed"));};
  });
}
