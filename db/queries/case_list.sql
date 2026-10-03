-- case_list.sql
-- Cases in one court, filtered by stage and status.
--
-- Usage (psql):
--   \set court_id 6           -- JMFC Court No. 3, Begusarai on production
--   \set stage 'prosecution_evidence'
--   \set status 'pending'
--   \i db/queries/case_list.sql

SELECT c.id,
       ct.code || ' ' || c.case_number || '/' || c.case_year AS case_no,
       co.name AS court,
       c.stage,
       c.status,
       c.filed_on
FROM cases c
JOIN case_types ct ON ct.id = c.case_type_id
JOIN courts co     ON co.id = c.court_id
WHERE c.court_id = :court_id
  AND c.stage    = :'stage'
  AND c.status   = :'status'
ORDER BY c.filed_on, c.id;
