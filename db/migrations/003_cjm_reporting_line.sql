-- 003_cjm_reporting_line.sql
-- Adds the CJM court for Begusarai and points the eight JMFC courts at it.
--
-- parent_court_id is the administrative reporting line ONLY. Appeal and
-- revision routes come from case_type_remedies, which is why a JMFC appeal
-- still goes straight to Sessions despite the CJM sitting between them here.
--
-- The CJM court name is supplied by the project owner, not DOMAIN.md, which
-- names CJM only as the generic level-2 row of the hierarchy table.
-- Resolves KNOWN GAP 1 in 002.

BEGIN;

INSERT INTO courts (name, hierarchy_level, parent_court_id, district, state)
    SELECT 'Court of the Chief Judicial Magistrate, Begusarai', 2, id, 'Begusarai', 'Bihar'
    FROM courts WHERE name = 'Court of Sessions, Begusarai';

UPDATE courts
SET parent_court_id = (SELECT id FROM courts
                       WHERE name = 'Court of the Chief Judicial Magistrate, Begusarai')
WHERE hierarchy_level = 1
  AND district = 'Begusarai'
  AND name LIKE 'JMFC Court No. %, Begusarai';

COMMIT;
