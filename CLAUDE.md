# CLAUDE.md

## Migrations

- Files live in `db/migrations/NNN_name.sql`, each wrapped in one transaction
  (except `ALTER TYPE ... ADD VALUE`, which must commit before the new value
  is used; see 007).
- Reusable queries live in `db/queries/`; tests in `db/tests/` and maintenance
  scripts in `db/scripts/` (run both with psql).
- Seeds must be reproducible: never use `CURRENT_DATE` or `now()` to generate
  data. Use a fixed anchor date (see 010's `app.seed_anchor_date`).
- Run every migration on a temporary Neon branch first, then on `production`.
- Benchmark: `DATABASE_URL=<branch url> npm run benchmark -- --scale 1000`
  (`db/tests/benchmark.ts`). Branches only; it refuses the production endpoint.
- Seed only what `DOMAIN.md` states. Anything unstated goes in a KNOWN GAPS
  comment block in the migration, not into the data.

## Web app

- Next.js 15 (App Router, `src/`), TypeScript, Tailwind v4, shadcn/ui
  (`components.json`; components live in `src/components/ui`).
- Database access: the `postgres` package, no ORM, through two connections:
  - `src/lib/db-read.ts` (`readDb()`, `DATABASE_URL`, login `app_web`): every
    public page and every read.
  - `src/lib/db-write.ts` (`writeDb(admin, fn)`, `ADMIN_DATABASE_URL`, login
    `app_admin_user`, migration 017): writes only. It takes an
    `AdminSession`, a branded type that only `requireAdmin()` and
    `authenticateAdmin()` in `src/lib/auth.ts` can produce, so code outside
    an authenticated admin handler cannot open a write transaction.
- The app connects as `app_web` (migration 014), never as `neondb_owner`.
  `app_web` holds only `app_readonly`'s rights (012): SELECT on every table,
  no INSERT/UPDATE/DELETE/TRUNCATE, no CREATE. Every session also defaults to
  a read-only transaction. So the application physically cannot write to the
  database: the guarantee comes from Postgres privileges, not from app code.
  The text-to-SQL layer will connect the same way and inherit that protection
  for free. Even a prompt-injected or hallucinated `DELETE` is refused by the
  database, rather than relying on prompt instructions to prevent it.
  - Create app logins with SQL `CREATE ROLE`, not the Neon console/API: those
    roles join `neon_superuser`, which holds `pg_write_all_data`.
  - Keep passwords out of the repo; set them as SCRAM verifiers out of band.
  - Use `?sslmode=require` in the URL. postgres.js passes unknown URL
    parameters (such as Neon's `channel_binding`) to the server, which rejects
    them.
- Auth (migrations 015, 018): public pages (`/`, `/cases`, `/cases/[id]`,
  `/search`, `/deadlines`) need no login. Only admins sign in, at `/login`,
  with a username or an email. JWT (HS256, `jose`) in an httpOnly, Secure,
  SameSite=Lax cookie, 8-hour expiry, signed with `JWT_SECRET` (32+ chars).
  - The `viewer` role (the default for new users) is kept but unused: it is
    reserved for a future litigant portal. A viewer cannot sign in today.
  - Users live in schema `app_auth`; passwords are bcrypt-hashed in the
    database. No app role can read `app_auth.users`. The app calls only
    `app_auth.authenticate()` (returns id, name, role, never the hash),
    `app_auth.current_role_of()` and, via the write connection,
    `app_auth.record_login()`.
  - Create users with `db/scripts/create_user.sql` as the owner; reset with
    `SELECT app_auth.set_password(...)` and `app_auth.set_email(...)`. Never
    put passwords in migrations.
  - Three checks guard `/admin`: middleware (`src/middleware.ts`) redirects
    anyone without an admin session; each page and server action calls
    `requireAdmin()`; and `requireAdmin()` re-reads the role from the
    database, so demoting or disabling a user ends their session at once.
  - `app_admin` (017) is a NOLOGIN group with SELECT/INSERT/UPDATE/DELETE on
    `public` tables, except `case_audit_log`, which is append-only.
    `app_admin_user` is its login. Each write transaction sets `app.user`,
    which the audit triggers record in `case_audit_log.changed_by`.
  - The future text-to-SQL layer must get its own login without USAGE on
    `app_auth`, so it cannot call `authenticate()`.
- Every value from a request goes to Postgres as a bound parameter: tagged
  templates (`sql\`...${v}\``) or `sql.unsafe(fileText, [values])` with `$n`
  placeholders. Never build SQL text from request data.
- Shared queries live in `db/queries/*.sql` and are read at runtime; list each
  route that reads them in `outputFileTracingIncludes` in `next.config.ts`.
- Validate search params against known values before they reach a query
  (see `parseFilters` in `src/lib/cases.ts`).

## SQL coverage

Tracks which SQL command categories the project uses, for the report. Counts
only SQL committed in `db/migrations/`, `db/queries/`, `db/tests/` or
`db/scripts/`, not ad-hoc queries. Record the file where each first appears,
and update this list in the same commit as every new migration, query, test
or script.

### DDL

- [x] CREATE TABLE: 001
- [x] CREATE TYPE: 004 (six enums)
- [x] ALTER TABLE: 005 (`filed_on`, `stage` made nullable)
  - also ALTER TYPE: 007 (`disposal_mode` gains `converted`)
- [x] DROP: 007 (`DROP INDEX case_relationships_from_case_id_idx`)
- [x] CREATE INDEX: 001 (including a partial unique index)
- [x] CREATE VIEW: 001 (`usable_limitation_rules`)
- [x] CREATE FUNCTION: 011 (five PL/pgSQL trigger functions)
- [x] CREATE TRIGGER: 011 (status/stage audit, court audit, FIR only on
      G.R., no hearing after disposal, final order disposes case)
  - [ ] deferred: appeal-direction trigger, until the four
        `case_type_remedies` gaps in 001 are verified

### DML

- [x] INSERT: 001 (including `INSERT ... SELECT`)
- [x] UPDATE: 003
- [x] DELETE: `scripts/clear_synthetic_hearings.sql`
- [x] SELECT: 001
  - [x] joins: 001 (`case_type_remedies` seed joins `case_types`)
  - [x] aggregates: `queries/adjournment_analysis.sql` (GROUP BY with
        `count(*)`, `count(*) FILTER`, and `sum(count(*)) OVER` for shares);
        window aggregates also in `queries/case_family.sql`
  - [x] subqueries: 003 (scalar subquery in `UPDATE ... SET`)
  - [x] recursive CTE: `queries/case_family.sql`
  - [x] set operations: `queries/case_stages.sql` (`UNION ALL` of case dates
        and orders, then `DISTINCT ON` per stage; `LATERAL unnest` maps one
        order to several stages)

### DCL

- [x] GRANT: 012 (`app_readonly`: USAGE, SELECT, default privileges); 014 (`app_web` IN ROLE `app_readonly`); 015 (`app_admin`: INSERT/UPDATE on `cases`; EXECUTE on `app_auth` functions to `app_web`); 017 (`app_admin`: SELECT/INSERT/UPDATE/DELETE on `public`, `app_admin_user` IN ROLE `app_admin`); 018 (USAGE on `app_auth` and EXECUTE on `record_login` to `app_admin`)
- [x] REVOKE: 012 (INSERT, UPDATE, DELETE from `app_readonly`); 015 (EXECUTE on `app_auth` functions from PUBLIC); 017 (UPDATE, DELETE on `case_audit_log` from `app_admin`)

### TCL

- [x] BEGIN: 001
- [x] COMMIT: 001 (also ends `tests/integrity_test.sql` after its rollbacks)
- [x] ROLLBACK: `tests/integrity_test.sql` (`ROLLBACK TO SAVEPOINT`)
- [x] SAVEPOINT: `tests/integrity_test.sql` (one per test)
