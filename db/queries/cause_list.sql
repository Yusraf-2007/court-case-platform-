-- cause_list.sql
-- The cause list: every case heard in one court on one date.
--
-- Usage (psql):
--   \set court_id 6           -- JMFC Court No. 3, Begusarai on production
--   \set hearing_date '2024-10-31'
--   \i db/queries/cause_list.sql

SELECT h.hearing_date,
       ct.code || ' ' || c.case_number || '/' || c.case_year AS case_no,
       c.stage,
       h.purpose,
       h.outcome,
       h.next_date,
       h.is_synthetic
FROM hearings h
JOIN cases c       ON c.id = h.case_id
JOIN case_types ct ON ct.id = c.case_type_id
WHERE c.court_id     = :court_id
  AND h.hearing_date = :'hearing_date'
ORDER BY ct.code, c.case_year, c.case_number;
