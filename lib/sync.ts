import type { Project } from "./circuit.ts";
export type Remote = { id:string; document:Project; revision:number; deleted:boolean; updatedAt:string };
export type Entry = { document:Project; baseRevision:number; dirty:boolean; deleted:boolean; updatedAt:string };
export type Workspace = { version:1; owner:string|null; entries:Entry[]; active:string };
export type Conflict = { local:Entry; remote:Remote };
export const entryFromRemote=(r:Remote):Entry=>({document:r.document,baseRevision:r.revision,dirty:false,deleted:r.deleted,updatedAt:r.updatedAt});
export function reconcile(local:Entry[],remote:Remote[]) {
  const entries=[...local],conflicts:Conflict[]=[];
  for(const server of remote){
    const index=entries.findIndex(x=>x.document.id===server.id);
    if(index<0){entries.push(entryFromRemote(server));continue;}
    const client=entries[index];
    if(client.dirty&&client.baseRevision!==server.revision)conflicts.push({local:client,remote:server});
    else if(!client.dirty&&client.baseRevision!==server.revision)entries[index]=entryFromRemote(server);
  }
  return {entries,conflicts};
}
export function acknowledge(current:Entry,sent:Entry,revision:number,updatedAt:string):Entry {
  // An edit made while upload was in flight must remain dirty.
  const unchanged=JSON.stringify(current.document)===JSON.stringify(sent.document)&&current.deleted===sent.deleted;
  return {...current,baseRevision:revision,dirty:!unchanged,updatedAt:unchanged?updatedAt:current.updatedAt};
}
