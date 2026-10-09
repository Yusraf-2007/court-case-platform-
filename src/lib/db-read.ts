import "server-only";
import postgres from "postgres";

// ---------------------------------------------------------------------------
// READ connection: DATABASE_URL, database login app_web (migration 014).
//
// Every public page (/, /cases, /cases/[id], /search, /deadlines) and every
// read in the admin area goes through here. app_web holds SELECT only and
// starts every transaction read-only, so nothing reached through this
// connection can change data, whatever SQL it is given. That guarantee is
// enforced by Postgres, not by this code.
//
// Writes go through db-write.ts, which is a different database login.
// ---------------------------------------------------------------------------

const globalForDb = globalThis as unknown as { readSql?: postgres.Sql };

export function readDb(): postgres.Sql {
  if (globalForDb.readSql) return globalForDb.readSql;
  const url = process.env.DATABASE_URL;
  if (!url) throw new Error("DATABASE_URL is not set.");
  // One client per server process (kept on globalThis so dev hot reloads
  // reuse it). prepare: false because Neon's pooler runs PgBouncer in
  // transaction mode; values are still sent as bound parameters.
  globalForDb.readSql = postgres(url, { prepare: false, max: 5, idle_timeout: 20 });
  return globalForDb.readSql;
}
