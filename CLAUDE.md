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

### DCL

- [x] GRANT: 012 (`app_readonly`: USAGE, SELECT, default privileges)
- [x] REVOKE: 012 (INSERT, UPDATE, DELETE from `app_readonly`)

### TCL

- [x] BEGIN: 001
- [x] COMMIT: 001 (also ends `tests/integrity_test.sql` after its rollbacks)
- [x] ROLLBACK: `tests/integrity_test.sql` (`ROLLBACK TO SAVEPOINT`)
- [x] SAVEPOINT: `tests/integrity_test.sql` (one per test)
