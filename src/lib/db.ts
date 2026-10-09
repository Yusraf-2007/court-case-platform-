import "server-only";
import postgres from "postgres";

// Two connections, two database logins:
//   db()       DATABASE_URL        app_web: read-only (014). Every page read.
//   adminDb()  ADMIN_DATABASE_URL  app_admin: may INSERT/UPDATE cases (015).
//              Only for writes, and only after requireAdmin() has confirmed
//              the user's role in the database (src/lib/auth.ts).
//
// One postgres.js client per server process each. In development, hot reloads
// would otherwise open a new pool on every edit, so clients live on globalThis.
const globalForDb = globalThis as unknown as { sql?: postgres.Sql; adminSql?: postgres.Sql };

function connect(envVar: "DATABASE_URL" | "ADMIN_DATABASE_URL"): postgres.Sql {
  const url = process.env[envVar];
  if (!url) throw new Error(`${envVar} is not set.`);
  return postgres(url, {
    // Neon's pooled endpoint runs PgBouncer in transaction mode, which does not
    // keep named prepared statements across transactions. With prepare: false,
    // postgres.js still sends every value as a bound parameter (extended
    // protocol), just through an unnamed statement.
    prepare: false,
    max: 5,
    idle_timeout: 20,
  });
}

export function db(): postgres.Sql {
  return (globalForDb.sql ??= connect("DATABASE_URL"));
}

export function adminDb(): postgres.Sql {
  return (globalForDb.adminSql ??= connect("ADMIN_DATABASE_URL"));
}
