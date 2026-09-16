import type { Project } from "../lib/circuit.ts";
import type { Remote } from "../lib/sync.ts";

const memoryStore = new Map<string, Remote>();

export async function loadProjects(db: any, owner: string): Promise<Remote[]> {
  return Array.from(memoryStore.values());
}

export async function saveProject(db: any, owner: string, document: Project, baseRevision: number, deleted: boolean): Promise<{ok: true, revision: number, updatedAt: string} | {ok: false, remote: Remote | null}> {
  const updatedAt = new Date().toISOString();
  const remoteDoc = {
    id: document.id,
    document,
    revision: baseRevision + 1,
    deleted,
    updatedAt
  };
  memoryStore.set(document.id, remoteDoc);
  return { ok: true as const, revision: remoteDoc.revision, updatedAt };
}
