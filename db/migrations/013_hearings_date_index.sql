-- 013_hearings_date_index.sql
-- Index hearings by date, for the cause list (db/queries/cause_list.sql).
--
-- The benchmark (db/tests/BENCHMARK_RESULTS.md) found the cause list ran
-- SLOWER with its indexes than without them at 57,057 cases: no index
-- covered hearings.hearing_date, so every plan read the whole hearings table,
-- and with cases_court_id_idx present the planner chose a slightly worse
-- join. The existing hearings_one_per_case_per_day index is on
-- (case_id, hearing_date); it cannot serve a lookup by date alone because
-- hearing_date is its second column.

BEGIN;

CREATE INDEX hearings_hearing_date_idx ON hearings (hearing_date);

COMMIT;
