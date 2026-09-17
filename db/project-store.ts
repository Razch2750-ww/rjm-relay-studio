import type { Project } from "../lib/circuit.ts";
import type { Remote } from "../lib/sync.ts";

// Standalone development store: isolated by owner, but intentionally not durable.
const memoryStore = new Map<string, Map<string, Remote>>();

export async function loadProjects(_db: unknown, owner: string): Promise<Remote[]> {
  return structuredClone(Array.from(memoryStore.get(owner)?.values() ?? []));
}

export async function saveProject(_db: unknown, owner: string, document: Project, baseRevision: number, deleted: boolean): Promise<{ok: true, revision: number, updatedAt: string} | {ok: false, remote: Remote | null}> {
  const projects = memoryStore.get(owner) ?? new Map<string, Remote>();
  const current = projects.get(document.id) ?? null;
  if ((current?.revision ?? 0) !== baseRevision) return {ok:false,remote:structuredClone(current)};
  const updatedAt = new Date().toISOString();
  const remoteDoc = {
    id: document.id,
    document: structuredClone(document),
    revision: baseRevision + 1,
    deleted,
    updatedAt
  };
  projects.set(document.id, remoteDoc);
  memoryStore.set(owner, projects);
  return { ok: true as const, revision: remoteDoc.revision, updatedAt };
}
