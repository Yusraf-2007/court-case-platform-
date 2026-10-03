# CLAUDE.md

## Migrations

- Files live in `db/migrations/NNN_name.sql`, each wrapped in one transaction
  (except `ALTER TYPE ... ADD VALUE`, which must commit before the new value
  is used; see 007).
- Reusable queries live in `db/queries/`.
- Run every migration on a temporary Neon branch first, then on `production`.
- Seed only what `DOMAIN.md` states. Anything unstated goes in a KNOWN GAPS
  comment block in the migration, not into the data.

## SQL coverage

Tracks which SQL command categories the project uses, for the report. Counts
only SQL committed in `db/migrations/` or `db/queries/`, not ad-hoc queries.
Record the file where each first appears, and update this list in the same
commit as every new migration or query.

### DDL

- [x] CREATE TABLE: 001
- [x] CREATE TYPE: 004 (six enums)
- [x] ALTER TABLE: 005 (`filed_on`, `stage` made nullable)
  - also ALTER TYPE: 007 (`disposal_mode` gains `converted`)
- [x] DROP: 007 (`DROP INDEX case_relationships_from_case_id_idx`)
- [x] CREATE INDEX: 001 (including a partial unique index)
- [x] CREATE VIEW: 001 (`usable_limitation_rules`)
- [ ] CREATE FUNCTION
- [ ] CREATE TRIGGER
  - [ ] planned for 008 (triggers): FIR only on G.R. cases (`cases.fir_id` must be
        NULL unless the case type is G.R.)

### DML

- [x] INSERT: 001 (including `INSERT ... SELECT`)
- [x] UPDATE: 003
- [ ] DELETE
- [x] SELECT: 001
  - [x] joins: 001 (`case_type_remedies` seed joins `case_types`)
  - [ ] aggregates (`min() OVER` window in `queries/case_family.sql`;
        a GROUP BY aggregate is still outstanding)
  - [x] subqueries: 003 (scalar subquery in `UPDATE ... SET`)
  - [x] recursive CTE: `queries/case_family.sql`

### DCL

- [ ] GRANT
- [ ] REVOKE

### TCL

- [x] BEGIN: 001
- [x] COMMIT: 001
- [ ] ROLLBACK
- [ ] SAVEPOINT
