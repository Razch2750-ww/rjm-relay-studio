import { getChatGPTUser } from "../../chatgpt-auth";
import { rawDb } from "../../../db";
import { loadProjects,saveProject } from "../../../db/project-store";
import { validateProject } from "../../../lib/circuit";
import { z } from "zod";

export const dynamic = "force-dynamic";
const headers={"Cache-Control":"no-store"};
const respond=(value:unknown,status=200)=>Response.json(value,{status,headers});
export async function GET() {
  const user=await getChatGPTUser();
  if(!user)return respond({error:"Masuk dengan akun ChatGPT untuk sinkronisasi."},401);
  try {
    return respond({owner:user.userId,name:user.displayName,projects:await loadProjects(rawDb(),user.userId)});
  }catch(error){console.error("relay load",error);return respond({error:"Data akun belum dapat dimuat. Perubahan offline tetap ada."},503);}
}
const envelope=z.object({baseRevision:z.number().int().min(0).max(1e9),deleted:z.boolean(),document:z.unknown()}).strict();
export async function POST(request:Request) {
  const user=await getChatGPTUser();
  if(!user)return respond({error:"Sesi berakhir. Masuk lagi; data offline tidak dihapus."},401);
  const origin=request.headers.get("origin");
  if(origin&&origin!==new URL(request.url).origin)return respond({error:"Asal permintaan tidak valid."},403);
  if(Number(request.headers.get("content-length"))>2_000_000)return respond({error:"Project terlalu besar; maksimum 2 MB."},413);
  let payload:ReturnType<typeof envelope.parse>,document:ReturnType<typeof validateProject>;
  try{
    const text=await request.text();if(text.length>2_000_000)return respond({error:"Project terlalu besar."},413);
    payload=envelope.parse(JSON.parse(text));document=validateProject(payload.document);
  }catch{return respond({error:"Format project tidak valid. Tidak ada data yang diubah."},400);}
  try{
    const saved=await saveProject(rawDb(),user.userId,document,payload.baseRevision,payload.deleted);
    return saved.ok?respond({revision:saved.revision,updatedAt:saved.updatedAt}):respond({error:"Konflik versi. Pilih versi sebelum menyimpan.",remote:saved.remote},409);
  }catch(error){console.error("relay save",error);return respond({error:"Sinkronisasi gagal. Project tetap tersimpan di perangkat."},503);}
}
