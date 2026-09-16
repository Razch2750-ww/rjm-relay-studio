import type { Project } from "../lib/circuit.ts";
import type { Remote } from "../lib/sync.ts";

type Row = { id:string; document:string; revision:number; deleted:number; updated_at:string };
const remote=(row:Row):Remote=>({id:row.id,document:JSON.parse(row.document),revision:row.revision,deleted:!!row.deleted,updatedAt:row.updated_at});

export async function loadProjects(db:D1Database,owner:string):Promise<Remote[]> {
  const result=await db.prepare("SELECT id, document, revision, deleted, updated_at FROM relay_projects WHERE owner = ? ORDER BY updated_at DESC LIMIT 100").bind(owner).all<Row>();
  return result.results.map(remote);
}

export async function saveProject(db:D1Database,owner:string,document:Project,baseRevision:number,deleted:boolean) {
  const updatedAt=new Date().toISOString(),json=JSON.stringify(document);
  const statement=baseRevision===0
    ?db.prepare("INSERT INTO relay_projects (owner,id,document,revision,deleted,updated_at) VALUES (?,?,?,1,?,?) ON CONFLICT(owner,id) DO NOTHING RETURNING revision").bind(owner,document.id,json,Number(deleted),updatedAt)
    :db.prepare("UPDATE relay_projects SET document = ?, deleted = ?, revision = revision + 1, updated_at = ? WHERE owner = ? AND id = ? AND revision = ? RETURNING revision").bind(json,Number(deleted),updatedAt,owner,document.id,baseRevision);
  const saved=await statement.first<{revision:number}>();
  if(saved)return {ok:true as const,revision:saved.revision,updatedAt};
  const row=await db.prepare("SELECT id,document,revision,deleted,updated_at FROM relay_projects WHERE owner = ? AND id = ?").bind(owner,document.id).first<Row>();
  return {ok:false as const,remote:row?remote(row):null};
}
