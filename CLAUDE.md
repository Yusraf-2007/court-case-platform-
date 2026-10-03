# CLAUDE.md

## Migrations

- Files live in `db/migrations/NNN_name.sql`, each wrapped in one transaction.
- Run every migration on a temporary Neon branch first, then on `production`.
- Seed only what `DOMAIN.md` states. Anything unstated goes in a KNOWN GAPS
  comment block in the migration, not into the data.

## SQL coverage

Tracks which SQL command categories the project uses, for the report. Counts
only SQL committed in a migration file, not ad-hoc queries. Record the
migration where each first appears, and update this list in the same commit
as every new migration.

### DDL

- [x] CREATE TABLE: 001
- [x] CREATE TYPE: 004 (six enums)
- [x] ALTER TABLE: 005 (`filed_on`, `stage` made nullable)
- [ ] DROP
- [x] CREATE INDEX: 001 (including a partial unique index)
- [x] CREATE VIEW: 001 (`usable_limitation_rules`)
- [ ] CREATE FUNCTION
- [ ] CREATE TRIGGER
  - [ ] planned for 007 (triggers): FIR only on G.R. cases (`cases.fir_id` must be
        NULL unless the case type is G.R.)

### DML

- [x] INSERT: 001 (including `INSERT ... SELECT`)
- [x] UPDATE: 003
- [ ] DELETE
- [x] SELECT: 001
  - [x] joins: 001 (`case_type_remedies` seed joins `case_types`)
  - [ ] aggregates
  - [x] subqueries: 003 (scalar subquery in `UPDATE ... SET`)
  - [ ] recursive CTE

### DCL

- [ ] GRANT
- [ ] REVOKE

### TCL

- [x] BEGIN: 001
- [x] COMMIT: 001
- [ ] ROLLBACK
- [ ] SAVEPOINT
