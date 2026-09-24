import { CATALOG, pin } from "../circuit.ts";
import type { Node } from "../circuit.ts";
import type { makeNetwork } from "./network.ts";

export function motorWinding(n:Node,net:ReturnType<typeof makeNetwork>){
  const mode=CATALOG[n.type].winding;
  const first=mode==="star-delta"?["U1","V1","W1"]:["1U","1V","1W"],second=mode==="star-delta"?["U2","V2","W2"]:["2U","2V","2W"];
  const three=(names:string[])=>net.three(names.map(t=>pin(n,t)));
  const star=(names:string[])=>new Set(names.map(t=>net.root(pin(n,t)))).size===1&&names.every(t=>!net.potential(pin(n,t)).length);
  const free=(names:string[])=>names.every(t=>!net.potential(pin(n,t)).length);
  if(mode==="star-delta"){
    const v=three(first),delta=[["U1","W2"],["V1","U2"],["W1","V2"]].every(([a,b])=>net.root(pin(n,a))===net.root(pin(n,b)));
    return {voltage:v&&(star(second)||delta)?v:0,pins:first,stage:v&&star(second)?"star":v&&delta?"delta":"wiring-open"};
  }
  const low=three(first),high=three(second);
  if(low&&high)return {voltage:0,pins:first,stage:"speed-conflict"};
  if(high&&(mode==="dahlander"?star(first):free(first)))return {voltage:high,pins:second,stage:"high-speed"};
  if(low&&free(second))return {voltage:low,pins:first,stage:"low-speed"};
  return {voltage:0,pins:first,stage:"wiring-open"};
}
