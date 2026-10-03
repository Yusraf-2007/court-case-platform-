import "server-only";
import postgres from "postgres";

// One postgres.js client per server process. In development, hot reloads would
// otherwise open a new pool on every edit, so the client is kept on globalThis.
const globalForDb = globalThis as unknown as { sql?: postgres.Sql };

export function db(): postgres.Sql {
  if (globalForDb.sql) return globalForDb.sql;

  const url = process.env.DATABASE_URL;
  if (!url) throw new Error("DATABASE_URL is not set.");

  const sql = postgres(url, {
    // Neon's pooled endpoint runs PgBouncer in transaction mode, which does not
    // keep named prepared statements across transactions. With prepare: false,
    // postgres.js still sends every value as a bound parameter (extended
    // protocol), just through an unnamed statement.
    prepare: false,
    max: 5,
    idle_timeout: 20,
  });
  globalForDb.sql = sql;
  return sql;
}
