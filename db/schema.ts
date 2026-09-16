import { sqliteTable, text, integer, primaryKey } from "drizzle-orm/sqlite-core";
export const projects = sqliteTable("relay_projects", {
  owner: text("owner").notNull(),
  id: text("id").notNull(),
  document: text("document").notNull(),
  revision: integer("revision").notNull().default(1),
  deleted: integer("deleted").notNull().default(0),
  updatedAt: text("updated_at").notNull(),
}, t => [primaryKey({columns:[t.owner,t.id]})]);
