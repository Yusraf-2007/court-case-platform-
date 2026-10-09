-- integrity_test.sql
-- Each test runs inside its own SAVEPOINT and is rolled back to it, so a
-- rejected write aborts only that test, the transaction survives, and the
-- next test runs. Nothing is left behind: the final COMMIT commits no test
-- data.
--
-- Tests 1-7 try writes the schema must reject. Each passes only when the
-- write is rejected AND the error names the expected rule, so a test cannot
-- pass by failing for another reason.
-- Tests 8-10 make writes that must be accepted and check what the triggers
-- did. Test 11 checks privileges.
--
--   1-5  constraints (migrations 004, 006)
--   6    trigger 3: FIR on a non-G.R. case            (migration 011)
--   7    trigger 4: hearing after disposal             (migration 011)
--   8    trigger 5 (and 1): final order disposes case  (migration 011)
--   9    a deleted case keeps its audit history         (migration 019)
--   10   archiving is logged                            (migration 019)
--   11   the admin role cannot rewrite the audit log    (migrations 017, 019)
--
-- Usage (psql, needs psql 12+ for LAST_ERROR_MESSAGE):
--   psql "$DATABASE_URL" -f db/tests/integrity_test.sql

\set ON_ERROR_STOP off
\set QUIET on
\pset footer off

BEGIN;

CREATE TEMP TABLE integrity_results (
    test_no      integer PRIMARY KEY,
    description  text    NOT NULL,
    expected     text    NOT NULL,
    passed       boolean NOT NULL,
    detail       text
) ON COMMIT DROP;

-- ---------------------------------------------------------------------------
-- Test 1: status = 'disposed' with disposed_on NULL
-- (disposal_mode is set, so only the disposed_on rule can fail)
-- ---------------------------------------------------------------------------
SAVEPOINT test_1;
INSERT INTO cases (case_type_id, case_number, case_year, court_id, filed_on,
                   stage, status, disposal_mode, disposed_on)
SELECT ct.id, 999001, 2026, co.id, '2026-01-01', 'disposal', 'disposed', 'conviction', NULL
FROM case_types ct, courts co
WHERE ct.code = 'GR' AND co.name = 'JMFC Court No. 1, Begusarai';
\set rejected :ERROR
ROLLBACK TO SAVEPOINT test_1;
INSERT INTO integrity_results
SELECT 1, 'disposed case with disposed_on NULL', 'rejected by cases_disposed_on_matches_status',
       :rejected AND position('cases_disposed_on_matches_status' IN :'LAST_ERROR_MESSAGE') > 0,
       CASE WHEN :rejected THEN :'LAST_ERROR_MESSAGE' ELSE 'write was accepted' END;

-- ---------------------------------------------------------------------------
-- Test 2: disposed_on before filed_on
-- ---------------------------------------------------------------------------
SAVEPOINT test_2;
INSERT INTO cases (case_type_id, case_number, case_year, court_id, filed_on,
                   stage, status, disposal_mode, disposed_on)
SELECT ct.id, 999002, 2026, co.id, '2026-03-01', 'disposal', 'disposed', 'conviction', '2026-02-01'
FROM case_types ct, courts co
WHERE ct.code = 'GR' AND co.name = 'JMFC Court No. 1, Begusarai';
\set rejected :ERROR
ROLLBACK TO SAVEPOINT test_2;
INSERT INTO integrity_results
SELECT 2, 'disposed_on before filed_on', 'rejected by cases_disposed_on_after_filed_on',
       :rejected AND position('cases_disposed_on_after_filed_on' IN :'LAST_ERROR_MESSAGE') > 0,
       CASE WHEN :rejected THEN :'LAST_ERROR_MESSAGE' ELSE 'write was accepted' END;

-- ---------------------------------------------------------------------------
-- Test 3: a case related to itself
-- ---------------------------------------------------------------------------
SAVEPOINT test_3;
INSERT INTO case_relationships (from_case_id, to_case_id, rel_type)
SELECT id, id, 'tagged_with' FROM cases ORDER BY id LIMIT 1;
\set rejected :ERROR
ROLLBACK TO SAVEPOINT test_3;
INSERT INTO integrity_results
SELECT 3, 'self-referencing relationship', 'rejected by case_relationships_no_self_link',
       :rejected AND position('case_relationships_no_self_link' IN :'LAST_ERROR_MESSAGE') > 0,
       CASE WHEN :rejected THEN :'LAST_ERROR_MESSAGE' ELSE 'write was accepted' END;

-- ---------------------------------------------------------------------------
-- Test 4: duplicate (from_case_id, to_case_id, rel_type) edge
-- ---------------------------------------------------------------------------
SAVEPOINT test_4;
INSERT INTO case_relationships (from_case_id, to_case_id, rel_type)
SELECT from_case_id, to_case_id, rel_type FROM case_relationships ORDER BY id LIMIT 1;
\set rejected :ERROR
ROLLBACK TO SAVEPOINT test_4;
INSERT INTO integrity_results
SELECT 4, 'duplicate relationship edge', 'rejected by case_relationships_unique_edge',
       :rejected AND position('case_relationships_unique_edge' IN :'LAST_ERROR_MESSAGE') > 0,
       CASE WHEN :rejected THEN :'LAST_ERROR_MESSAGE' ELSE 'write was accepted' END;

-- ---------------------------------------------------------------------------
-- Test 5: case_year 1800
-- ---------------------------------------------------------------------------
SAVEPOINT test_5;
INSERT INTO cases (case_type_id, case_number, case_year, court_id, filed_on,
                   stage, status)
SELECT ct.id, 999005, 1800, co.id, '2026-01-01', 'cognizance', 'pending'
FROM case_types ct, courts co
WHERE ct.code = 'GR' AND co.name = 'JMFC Court No. 1, Begusarai';
\set rejected :ERROR
ROLLBACK TO SAVEPOINT test_5;
INSERT INTO integrity_results
SELECT 5, 'case_year 1800', 'rejected by cases_case_year_check',
       :rejected AND position('cases_case_year_check' IN :'LAST_ERROR_MESSAGE') > 0,
       CASE WHEN :rejected THEN :'LAST_ERROR_MESSAGE' ELSE 'write was accepted' END;

-- ---------------------------------------------------------------------------
-- Test 6 (trigger 3): a Complaint Case with an FIR
-- ---------------------------------------------------------------------------
SAVEPOINT test_6;
INSERT INTO cases (case_type_id, case_number, case_year, court_id, fir_id,
                   filed_on, stage, status)
SELECT ct.id, 999006, 2026, co.id, (SELECT id FROM firs ORDER BY id LIMIT 1),
       '2026-01-01', 'cognizance', 'pending'
FROM case_types ct, courts co
WHERE ct.code = 'CC' AND co.name = 'JMFC Court No. 1, Begusarai';
\set rejected :ERROR
ROLLBACK TO SAVEPOINT test_6;
INSERT INTO integrity_results
SELECT 6, 'FIR on a Complaint Case', 'rejected by cases_fir_only_on_gr',
       :rejected AND position('cases_fir_only_on_gr' IN :'LAST_ERROR_MESSAGE') > 0,
       CASE WHEN :rejected THEN :'LAST_ERROR_MESSAGE' ELSE 'write was accepted' END;

-- ---------------------------------------------------------------------------
-- Test 7 (trigger 4): a hearing after Case 1 (G.R. 412/2024) was disposed
-- on 2026-01-08
-- ---------------------------------------------------------------------------
SAVEPOINT test_7;
INSERT INTO hearings (case_id, hearing_date, outcome)
SELECT c.id, '2026-02-01', 'proceeded'
FROM cases c JOIN case_types ct ON ct.id = c.case_type_id
WHERE (ct.code, c.case_number, c.case_year) = ('GR', 412, 2024);
\set rejected :ERROR
ROLLBACK TO SAVEPOINT test_7;
INSERT INTO integrity_results
SELECT 7, 'hearing after the case was disposed', 'rejected by hearings_not_after_disposal',
       :rejected AND position('hearings_not_after_disposal' IN :'LAST_ERROR_MESSAGE') > 0,
       CASE WHEN :rejected THEN :'LAST_ERROR_MESSAGE' ELSE 'write was accepted' END;

-- ---------------------------------------------------------------------------
-- Test 8 (trigger 5, and trigger 1): a final conviction order on pending
-- Case 2 (G.R. 415/2024) must dispose of the case and log the change.
-- ---------------------------------------------------------------------------
SAVEPOINT test_8;
INSERT INTO orders (case_id, order_date, order_type, order_text, is_final)
SELECT c.id, '2026-10-01', 'conviction', 'Integrity test: final order', true
FROM cases c JOIN case_types ct ON ct.id = c.case_type_id
WHERE (ct.code, c.case_number, c.case_year) = ('GR', 415, 2024);
\set accepted_error :ERROR
SELECT NOT :accepted_error
       AND c.status = 'disposed'
       AND c.disposed_on = DATE '2026-10-01'
       AND c.disposal_mode = 'conviction'
       AND c.stage = 'disposal'
       AND EXISTS (SELECT 1 FROM case_audit_log a
                   WHERE a.case_id = c.id AND a.field_changed = 'status'
                     AND a.old_value = 'pending' AND a.new_value = 'disposed') AS t8_passed,
       format('status=%s, disposed_on=%s, disposal_mode=%s, stage=%s, audit rows=%s',
              c.status, c.disposed_on, c.disposal_mode, c.stage,
              (SELECT count(*) FROM case_audit_log a WHERE a.case_id = c.id)) AS t8_detail
FROM cases c JOIN case_types ct ON ct.id = c.case_type_id
WHERE (ct.code, c.case_number, c.case_year) = ('GR', 415, 2024)
\gset
ROLLBACK TO SAVEPOINT test_8;
INSERT INTO integrity_results
SELECT 8, 'final order disposes of a pending case',
       'case disposed on order_date, change logged',
       :'t8_passed'::boolean, :'t8_detail';

-- ---------------------------------------------------------------------------
-- Test 9 (019): insert a case and delete it. Both writes must stay in
-- case_audit_log after the case row is gone.
-- ---------------------------------------------------------------------------
SAVEPOINT test_9;
WITH c AS (
    INSERT INTO cases (case_type_id, case_number, case_year, court_id, registered_on, stage, status)
    SELECT ct.id, 999009, 2026, co.id, DATE '2026-01-01', 'cognizance', 'pending'
    FROM case_types ct, courts co
    WHERE ct.code = 'CC' AND co.hierarchy_level = 1
    LIMIT 1
    RETURNING id
)
SELECT id AS t9_case FROM c \gset
DELETE FROM cases WHERE id = :t9_case;
\set t9_error :ERROR
SELECT NOT :t9_error
       AND NOT EXISTS (SELECT 1 FROM cases WHERE id = :t9_case)
       AND (SELECT array_agg(action ORDER BY id) FROM case_audit_log
            WHERE case_id = :t9_case AND table_name = 'cases') = ARRAY['insert', 'delete'] AS t9_passed,
       (SELECT string_agg(action, ', ' ORDER BY id) FROM case_audit_log WHERE case_id = :t9_case) AS t9_detail
\gset
ROLLBACK TO SAVEPOINT test_9;
INSERT INTO integrity_results
SELECT 9, 'deleted case keeps its audit history', 'insert and delete rows remain in case_audit_log',
       :'t9_passed'::boolean, 'audit rows: ' || :'t9_detail';

-- ---------------------------------------------------------------------------
-- Test 10 (019): archiving Case 1 (G.R. 412/2024) is logged.
-- ---------------------------------------------------------------------------
SAVEPOINT test_10;
UPDATE cases c SET deleted_at = TIMESTAMPTZ '2026-10-01 10:00+05:30'
FROM case_types ct
WHERE ct.id = c.case_type_id AND (ct.code, c.case_number, c.case_year) = ('GR', 412, 2024);
SELECT EXISTS (SELECT 1 FROM case_audit_log a
               JOIN cases c ON c.id = a.case_id
               JOIN case_types ct ON ct.id = c.case_type_id
               WHERE (ct.code, c.case_number, c.case_year) = ('GR', 412, 2024)
                 AND a.field_changed = 'deleted_at' AND a.old_value IS NULL
                 AND a.new_value IS NOT NULL) AS t10_passed \gset
ROLLBACK TO SAVEPOINT test_10;
INSERT INTO integrity_results
SELECT 10, 'archiving a case is logged', 'deleted_at change in case_audit_log',
       :'t10_passed'::boolean, CASE WHEN :'t10_passed'::boolean THEN 'logged' ELSE 'no audit row' END;

-- ---------------------------------------------------------------------------
-- Test 11 (017, 019): the admin group may add to the audit log but never
-- change or remove an entry.
-- ---------------------------------------------------------------------------
INSERT INTO integrity_results
SELECT 11, 'admin role cannot rewrite the audit log', 'INSERT only: no UPDATE, DELETE or TRUNCATE',
       has_table_privilege('app_admin', 'case_audit_log', 'INSERT')
       AND NOT has_table_privilege('app_admin', 'case_audit_log', 'UPDATE')
       AND NOT has_table_privilege('app_admin', 'case_audit_log', 'DELETE')
       AND NOT has_table_privilege('app_admin', 'case_audit_log', 'TRUNCATE'),
       format('insert=%s update=%s delete=%s truncate=%s',
              has_table_privilege('app_admin', 'case_audit_log', 'INSERT'),
              has_table_privilege('app_admin', 'case_audit_log', 'UPDATE'),
              has_table_privilege('app_admin', 'case_audit_log', 'DELETE'),
              has_table_privilege('app_admin', 'case_audit_log', 'TRUNCATE'));

-- ---------------------------------------------------------------------------
-- Report
-- ---------------------------------------------------------------------------
\pset footer on
SELECT test_no,
       description,
       CASE WHEN passed THEN 'PASS: ' ELSE 'FAIL: expected ' END || expected AS result,
       detail
FROM integrity_results
ORDER BY test_no;

COMMIT;
