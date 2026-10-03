-- 007_conversion_stay_and_index_cleanup.sql
-- Resolves gaps 1 and 2 of migration 006 and removes a redundant index.
--
-- 1. Case 55: C.C. 112/2023 was renumbered as N.I. Act 240/2024 on
--    22-07-2024. Both register entries are seeded and linked by converted_to.
-- 2. Case 53: its stay comes from Cr. Misc. 3300/2023 in the Patna High
--    Court. A High Court Cr. Misc. case type and that case are seeded so the
--    stayed_by edge has a real target.
-- 3. case_relationships_from_case_id_idx is dropped: the unique constraint
--    case_relationships_unique_edge (from_case_id, to_case_id, rel_type)
--    already has from_case_id as its leading column, so it serves every
--    lookup by from_case_id. The to_case_id index stays; nothing else
--    covers it.
--
-- Values supplied by the project owner, not DOMAIN.md:
--   - C.C. 112/2023 is in JMFC Court No. 2, disposed with disposal_mode
--     'converted' (a new value).
--   - Cr. Misc. 3300/2023 is pending; its filing date is unknown.
--
-- KNOWN GAPS
--   a. N.I. Act 240/2024 is placed in JMFC Court No. 2, the court of the
--      entry it renumbers; DOMAIN.md does not state it.
--   b. N.I. Act 240/2024: filed_on is the original institution date
--      (14-06-2023), registered_on is the renumbering date (22-07-2024).
--   c. C.C. 112/2023 is disposed on 22-07-2024, the renumbering date.
--   d. No parties are named for Case 55 or Cr. Misc. 3300/2023.
--   e. Cr. Misc. 3300/2023 has no stage: none is stated.

-- A new enum value cannot be used in the transaction that adds it, so this
-- runs and commits on its own before the inserts below.
ALTER TYPE disposal_mode ADD VALUE 'converted';

BEGIN;

INSERT INTO case_types (code, name, min_court_level, instituted_by, disposed_by, is_appellate) VALUES
    ('CRMISC', 'Criminal Miscellaneous (High Court)', 4, 'application', 'order', false);

INSERT INTO cases (case_type_id, case_number, case_year, court_id,
                   filed_on, registered_on, stage, status, disposal_mode, disposed_on)
SELECT ct.id, v.num, v.yr, co.id,
       v.filed::date, v.registered::date, v.stage::case_stage,
       v.status::case_status, v.mode::disposal_mode, v.disposed::date
FROM (VALUES
    ('CC',     112, 2023, 'JMFC Court No. 2, Begusarai', '2023-06-14', NULL,         'disposal',             'disposed', 'converted', '2024-07-22'), -- 55 (old entry)
    ('NI',     240, 2024, 'JMFC Court No. 2, Begusarai', '2023-06-14', '2024-07-22', 'prosecution_evidence', 'pending',  NULL,        NULL),         -- 55 (new entry)
    ('CRMISC',3300, 2023, 'Patna High Court',            NULL,         NULL,         NULL,                   'pending',  NULL,        NULL)          -- stays Case 53
) AS v (code, num, yr, court, filed, registered, stage, status, mode, disposed)
JOIN case_types ct ON ct.code = v.code
JOIN courts co     ON co.name = v.court;

-- Case 55 is a complaint under s.138 N.I. Act in both registers.
INSERT INTO case_provisions (case_id, provision_id)
SELECT c.id, p.id
FROM cases c
JOIN case_types ct ON ct.id = c.case_type_id
JOIN provisions p  ON p.act_name = 'Negotiable Instruments Act, 1881' AND p.section = '138'
WHERE (ct.code, c.case_number, c.case_year) IN (('CC', 112, 2023), ('NI', 240, 2024));

INSERT INTO case_relationships (from_case_id, to_case_id, rel_type)
SELECT f.id, t.id, v.rel::rel_type
FROM (VALUES
    ('CC', 112, 2023, 'NI',     240, 2024, 'converted_to'),  -- 55 old -> 55 new
    ('GR', 222, 2022, 'CRMISC',3300, 2023, 'stayed_by')      -- 53 -> Cr. Misc. 3300/2023
) AS v (f_code, f_num, f_yr, t_code, t_num, t_yr, rel)
JOIN case_types fct ON fct.code = v.f_code
JOIN cases f        ON (f.case_type_id, f.case_number, f.case_year) = (fct.id, v.f_num, v.f_yr)
JOIN case_types tct ON tct.code = v.t_code
JOIN cases t        ON (t.case_type_id, t.case_number, t.case_year) = (tct.id, v.t_num, v.t_yr);

DROP INDEX case_relationships_from_case_id_idx;

COMMIT;
