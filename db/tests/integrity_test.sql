-- integrity_test.sql
-- Tries five writes the schema must reject, each inside its own SAVEPOINT.
-- A rejected write aborts only back to its savepoint, so the transaction
-- survives and the next test runs. Nothing is left behind: every test rolls
-- back to its savepoint, so the final COMMIT commits no test data.
--
-- Usage (psql, needs psql 12+ for LAST_ERROR_MESSAGE):
--   psql "$DATABASE_URL" -f db/tests/integrity_test.sql
--
-- Each test passes when the write is rejected AND the error names the
-- expected constraint, so a test cannot pass by failing for another reason.

\set ON_ERROR_STOP off
\set QUIET on
\pset footer off

BEGIN;

CREATE TEMP TABLE integrity_results (
    test_no              integer PRIMARY KEY,
    description          text    NOT NULL,
    expected_constraint  text    NOT NULL,
    rejected             boolean NOT NULL,
    error_message        text
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
INSERT INTO integrity_results VALUES
    (1, 'disposed case with disposed_on NULL', 'cases_disposed_on_matches_status',
     :rejected, CASE WHEN :rejected THEN :'LAST_ERROR_MESSAGE' END);

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
INSERT INTO integrity_results VALUES
    (2, 'disposed_on before filed_on', 'cases_disposed_on_after_filed_on',
     :rejected, CASE WHEN :rejected THEN :'LAST_ERROR_MESSAGE' END);

-- ---------------------------------------------------------------------------
-- Test 3: a case related to itself
-- ---------------------------------------------------------------------------
SAVEPOINT test_3;
INSERT INTO case_relationships (from_case_id, to_case_id, rel_type)
SELECT id, id, 'tagged_with' FROM cases ORDER BY id LIMIT 1;
\set rejected :ERROR
ROLLBACK TO SAVEPOINT test_3;
INSERT INTO integrity_results VALUES
    (3, 'self-referencing relationship', 'case_relationships_no_self_link',
     :rejected, CASE WHEN :rejected THEN :'LAST_ERROR_MESSAGE' END);

-- ---------------------------------------------------------------------------
-- Test 4: duplicate (from_case_id, to_case_id, rel_type) edge
-- ---------------------------------------------------------------------------
SAVEPOINT test_4;
INSERT INTO case_relationships (from_case_id, to_case_id, rel_type)
SELECT from_case_id, to_case_id, rel_type FROM case_relationships ORDER BY id LIMIT 1;
\set rejected :ERROR
ROLLBACK TO SAVEPOINT test_4;
INSERT INTO integrity_results VALUES
    (4, 'duplicate relationship edge', 'case_relationships_unique_edge',
     :rejected, CASE WHEN :rejected THEN :'LAST_ERROR_MESSAGE' END);

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
INSERT INTO integrity_results VALUES
    (5, 'case_year 1800', 'cases_case_year_check',
     :rejected, CASE WHEN :rejected THEN :'LAST_ERROR_MESSAGE' END);

-- ---------------------------------------------------------------------------
-- Report
-- ---------------------------------------------------------------------------
\pset footer on
SELECT test_no,
       description,
       CASE WHEN rejected AND position(expected_constraint IN error_message) > 0
            THEN 'PASS: rejected by ' || expected_constraint
            WHEN rejected
            THEN 'FAIL: rejected, but not by ' || expected_constraint
            ELSE 'FAIL: write was accepted'
       END AS result,
       error_message
FROM integrity_results
ORDER BY test_no;

COMMIT;
