"use client";
import { newId } from "../lib/id";
import { useCallback, useEffect, useRef, useState } from "react";
import { z } from "zod";
import { validateProject } from "../lib/circuit";
import type { Project } from "../lib/circuit";
import { coldRoomTemplate } from "../lib/cold-room-template";
import { warmSimulationWorker } from "../lib/browser-worker";
import { acknowledge, entryFromRemote, reconcile } from "../lib/sync";
import type { Conflict, Entry, Remote, Workspace } from "../lib/sync";

const KEY="rjm-relay-workspace-v1";
const entry=(document:Project):Entry=>({document,baseRevision:0,dirty:true,deleted:false,updatedAt:new Date().toISOString()});
const remoteSchema=z.object({id:z.string(),document:z.unknown(),revision:z.number().int().positive(),deleted:z.boolean(),updatedAt:z.string()}).transform(x=>({...x,document:validateProject(x.document)}));
const listSchema=z.object({owner:z.string().min(1),name:z.string().nullish(),projects:z.array(remoteSchema).max(100)});
const savedSchema=z.object({revision:z.number().int().positive(),updatedAt:z.string()});
const localEntrySchema=z.object({document:z.unknown(),baseRevision:z.number().int().nonnegative(),dirty:z.boolean(),deleted:z.boolean(),updatedAt:z.string()}).transform(x=>({...x,document:validateProject(x.document)}));
const workspaceSchema=z.object({version:z.literal(1),owner:z.string().nullable(),active:z.string(),entries:z.array(localEntrySchema).max(100)});
function errorText(data:unknown,fallback:string){return typeof data==="object"&&data!==null&&"error" in data&&typeof data.error==="string"?data.error:fallback;}
export function useWorkspace(){
  const [workspace,setWorkspace]=useState<Workspace|null>(null),[status,setStatus]=useState("Memuat project…"),[account,setAccount]=useState<{owner:string;name:string}|null>(null),[conflicts,setConflicts]=useState<Conflict[]>([]),[online,setOnline]=useState(true),[offlineReady,setOfflineReady]=useState(false);
  const ref=useRef(workspace),busy=useRef(false),enabled=useRef(false),localError=useRef(false),loaded=useRef(false);
  useEffect(()=>{ref.current=workspace;},[workspace]);
  useEffect(()=>{
    let next:Workspace;
    try{
      const text=localStorage.getItem(KEY);
      if(text){
        next=workspaceSchema.parse(JSON.parse(text));
      }else{const p=coldRoomTemplate();next={version:1,owner:null,active:p.id,entries:[entry(p)]};}
      // eslint-disable-next-line react-hooks/set-state-in-effect -- Hydrate browser-only saved documents after the server render.
      setWorkspace(next);setStatus("Siap · tersimpan di perangkat");enabled.current=!!next.owner;
    }catch{localError.current=true;const p=coldRoomTemplate();setWorkspace({version:1,owner:null,active:p.id,entries:[entry(p)]});setStatus("Data lokal gagal dibaca. Salinan lama tidak ditimpa; ekspor data sebelum lanjut.");}
    setOnline(navigator.onLine);
    const update=()=>setOnline(navigator.onLine);window.addEventListener("online",update);window.addEventListener("offline",update);
    return()=>{window.removeEventListener("online",update);window.removeEventListener("offline",update);};
  },[]);
  useEffect(()=>{
    if(!workspace)return;
    if(!loaded.current){loaded.current=true;if(status.startsWith("Data lokal gagal")){localError.current=true;return;}}
    if(localError.current)return;
    try{localStorage.setItem(KEY,JSON.stringify(workspace));}
    // eslint-disable-next-line react-hooks/set-state-in-effect -- Report a real localStorage write failure to the user.
    catch{localError.current=true;setStatus("Penyimpanan perangkat penuh/ditolak. Ekspor project sekarang agar tidak hilang.");}
  },[workspace,status]);
  useEffect(()=>{
    if(!("serviceWorker" in navigator))return;
    let active=true;
    navigator.serviceWorker.register("/sw.js").then(()=>navigator.serviceWorker.ready).then(async reg=>{
      const workerURL=await warmSimulationWorker();
      const urls=[workerURL,...performance.getEntriesByType("resource").map(x=>x.name)].filter(x=>{const u=new URL(x);return u.origin===location.origin&&/\.(js|css|woff2?)(\?|$)/.test(u.pathname);});
      const channel=new MessageChannel();channel.port1.onmessage=e=>{if(active)setOfflineReady(!!e.data?.ready);channel.port1.close();};
      reg.active?.postMessage({type:"WARM",urls},[channel.port2]);
    }).catch(()=>{if(active)setOfflineReady(false);});
    return()=>{active=false;};
  },[]);
  const sync=useCallback(async(connect=false)=>{
    if(busy.current||!ref.current||!navigator.onLine)return;
    busy.current=true;setStatus("Menghubungkan akun…");
    try{
      const response=await fetch("/api/projects",{cache:"no-store"});
      const raw=await response.json();
      if(!response.ok)throw new Error(errorText(raw,"Akun belum tersambung."));
      const data=listSchema.parse(raw);
      setAccount({owner:data.owner,name:data.name??"Akun ChatGPT"});
      const current=ref.current!;
      if(current.owner&&current.owner!==data.owner){enabled.current=false;setStatus("Akun berbeda. Data offline tidak akan diunggah ke akun ini.");return;}
      if(!enabled.current&&!connect){setStatus("Tersimpan lokal · klik Sinkronkan untuk menghubungkan akun");return;}
      enabled.current=true;
      const remote:Remote[]=data.projects;
      const merged=reconcile(current.entries,remote);
      const connected:Workspace={...current,owner:data.owner,entries:merged.entries};
      if(JSON.stringify(connected)!==JSON.stringify(current)){ref.current=connected;setWorkspace(connected);}
      setConflicts(merged.conflicts);
      let conflictCount=merged.conflicts.length;
      const blocked=new Set(merged.conflicts.map(x=>x.local.document.id));
      for(const sent of merged.entries.filter(x=>x.dirty&&!blocked.has(x.document.id))){
        const result=await fetch("/api/projects",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({document:sent.document,baseRevision:sent.baseRevision,deleted:sent.deleted})});
        const rawSaved=await result.json();
        if(result.status===409){const remote=z.object({remote:remoteSchema}).parse(rawSaved).remote;conflictCount++;setConflicts(prev=>[...prev.filter(x=>x.local.document.id!==sent.document.id),{local:sent,remote}]);continue;}
        if(!result.ok)throw new Error(errorText(rawSaved,"Project belum tersinkron."));
        const saved=savedSchema.parse(rawSaved),live:Workspace=ref.current!;
        const next:Workspace={...live,entries:live.entries.map(e=>e.document.id===sent.document.id?acknowledge(e,sent,saved.revision,saved.updatedAt):e)};
        ref.current=next;setWorkspace(next);
      }
      setStatus(localError.current?"Penyimpanan lokal bermasalah · unduh cadangan project":conflictCount?"Ada konflik versi · pilih versi yang disimpan":"Sinkronisasi selesai");
    }catch(error){setStatus(error instanceof Error?error.message:"Koneksi gagal. Data lokal tetap ada.");}
    finally{busy.current=false;}
  },[]);
  useEffect(()=>{if(workspace&&online){const timer=setTimeout(()=>void sync(false),enabled.current?2500:300);return()=>clearTimeout(timer);}},[workspace,online,sync]);
  useEffect(()=>{const refresh=()=>{if(enabled.current&&document.visibilityState==="visible")void sync(false);};window.addEventListener("focus",refresh);return()=>window.removeEventListener("focus",refresh);},[sync]);
  const update=useCallback((document:Project)=>{
    setWorkspace(w=>{
      if(!w)return w;
      const existing=w.entries.find(e=>e.document.id===document.id);
      return {...w,active:document.id,entries:existing?w.entries.map(e=>e===existing?{...e,document,dirty:true,updatedAt:new Date().toISOString()}:e):[...w.entries,entry(document)]};
    });
  },[]);
  const resolve=(id:string,choice:"local"|"remote"|"copy")=>{
    const conflict=conflicts.find(c=>c.local.document.id===id);if(!conflict)return;
    setWorkspace(w=>{
      if(!w)return w;
      const local=w.entries.find(e=>e.document.id===id)??conflict.local;
      const entries=w.entries.map(e=>e.document.id!==id?e:choice==="local"?{...local,baseRevision:conflict.remote.revision,dirty:true}:entryFromRemote(conflict.remote));
      let active=w.active;
      if(choice==="copy"){const copy={...local.document,id:newId(),name:(local.document.name+" · salinan offline").slice(0,120)};entries.push(entry(copy));active=copy.id;}
      return {...w,entries,active};
    });
    setConflicts(cs=>cs.filter(c=>c.local.document.id!==id));
  };
  const remove=(id:string)=>setWorkspace(w=>w?{...w,entries:w.entries.map(e=>e.document.id===id?{...e,deleted:true,dirty:true,updatedAt:new Date().toISOString()}:e),active:w.entries.find(e=>e.document.id!==id&&!e.deleted)?.document.id??""}:w);
  return {workspace,setWorkspace,update,remove,resolve,status,online,offlineReady,account,conflicts,sync};
}
