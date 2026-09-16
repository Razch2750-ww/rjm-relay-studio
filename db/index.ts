import * as schema from "./schema";

export function getDb() {
  console.warn('[AI Studio] Database not connected — using mock');
  const noOp = { findMany: async () => [], findFirst: async () => null,
    findUnique: async () => null, create: async (d: any) => d?.data ?? {},
    update: async (d: any) => d?.data ?? {}, delete: async () => ({}) };
  const dbMock = new Proxy({}, {
    get: (_, prop) => prop === 'query'
      ? new Proxy({}, { get: () => noOp }) : async () => [],
  });
  return dbMock as any;
}

export function rawDb() {
  return {} as any;
}
