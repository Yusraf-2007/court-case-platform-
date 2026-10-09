-- case_detail.sql
-- One case: number, court, stage, status, dates, its FIR (if any) and the
-- listing counts stated in the records.
--
-- Parameters (positional, sent separately from the SQL text):
--   $1  case id  bigint
--   $2  include archived  boolean  (true only on admin pages; public pages
--       pass false, so an archived case is not found)
-- Used by the /cases/[id] page (src/lib/case-detail.ts). Returns no row for
-- an unknown id.

SELECT c.id,
       ct.code || ' ' || c.case_number || '/' || c.case_year AS case_no,
       ct.code            AS case_type,
       ct.name            AS case_type_name,
       ct.is_appellate,
       ct.disposed_by,
       co.name            AS court,
       cl.name            AS court_level,
       c.stage,
       c.status,
       c.disposal_mode,
       c.filed_on,
       c.registered_on,
       c.disposed_on,
       c.deleted_at,
       f.police_station   AS fir_police_station,
       f.fir_number,
       f.fir_year,
       f.fir_date,
       s.times_listed,
       s.times_adjourned
FROM cases c
JOIN case_types ct              ON ct.id = c.case_type_id
JOIN courts co                  ON co.id = c.court_id
JOIN court_levels cl            ON cl.level = co.hierarchy_level
LEFT JOIN firs f                ON f.id = c.fir_id
LEFT JOIN case_listing_stats s  ON s.case_id = c.id
WHERE c.id = $1::bigint
  AND (c.deleted_at IS NULL OR $2::boolean);
