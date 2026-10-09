import "server-only";
import postgres from "postgres";

import type { AdminSession } from "@/lib/auth";

// ---------------------------------------------------------------------------
// WRITE connection: ADMIN_DATABASE_URL, database login app_admin_user,
// a member of app_admin (migration 017): SELECT/INSERT/UPDATE/DELETE on the
// case tables, no DDL, and append-only access to case_audit_log.
//
// Use it ONLY inside authenticated admin server actions and route handlers.
// This is enforced in the type system: writeDb() requires an AdminSession,
// and the only way to get one is requireAdmin() in src/lib/auth.ts, which
// verifies the session cookie AND re-reads the user's role from the
// database. Public pages have no AdminSession, so they cannot call this.
//
// Each write runs in a transaction that sets app.user, so the audit triggers
// record which admin made the change (case_audit_log.changed_by).
//
// Reads go through db-read.ts (read-only login app_web).
// ---------------------------------------------------------------------------

const globalForDb = globalThis as unknown as { writeSql?: postgres.Sql };

function client(): postgres.Sql {
  if (globalForDb.writeSql) return globalForDb.writeSql;
  const url = process.env.ADMIN_DATABASE_URL;
  if (!url) throw new Error("ADMIN_DATABASE_URL is not set.");
  globalForDb.writeSql = postgres(url, { prepare: false, max: 3, idle_timeout: 20 });
  return globalForDb.writeSql;
}

// Run `fn` in one transaction as the given admin.
export function writeDb<T>(admin: AdminSession, fn: (sql: postgres.TransactionSql) => Promise<T>) {
  return client().begin(async (sql) => {
    await sql`SELECT set_config('app.user', ${admin.username}, true)`;
    return fn(sql);
  }) as Promise<T>;
}

export type WriteReceipt<T> = {
  value: T;
  fired: string[]; // triggers that ran, in order (migration 019's app.triggers_fired)
  logged: number; // case_audit_log rows this write added
};

// writeDb, plus a receipt of what the database did: which triggers fired and
// how many audit rows they wrote. Read inside the transaction, just before
// it commits. now() is the transaction's start time, which every audit row
// of this transaction carries as changed_at.
export function writeDbTracked<T>(
  admin: AdminSession,
  fn: (sql: postgres.TransactionSql) => Promise<T>,
): Promise<WriteReceipt<T>> {
  return writeDb(admin, async (sql) => {
    const [{ before }] = await sql<{ before: string }[]>`SELECT coalesce(max(id), 0) AS before FROM case_audit_log`;
    const value = await fn(sql);
    const [{ fired, logged }] = await sql<{ fired: string | null; logged: number }[]>`
      SELECT current_setting('app.triggers_fired', true) AS fired,
             (SELECT count(*)::int FROM case_audit_log
              WHERE id > ${before} AND changed_at = now() AND changed_by = ${admin.username}) AS logged`;
    return { value, fired: fired ? fired.split(",") : [], logged };
  });
}
