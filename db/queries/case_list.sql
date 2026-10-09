-- case_list.sql
-- Cases, filtered by court, case type, stage and status, one page at a time.
-- Used by /cases and /admin/cases (src/lib/cases.ts).
-- Archived cases (deleted_at set, migration 019) are excluded unless $7 asks
-- for them; only the admin list ever does.
--
-- Parameters (positional, sent separately from the SQL text; never spliced in):
--   $1  court_id      bigint       NULL = any court
--   $2  case_type_id  bigint       NULL = any case type
--   $3  stage         case_stage   NULL = any stage
--   $4  status        case_status  NULL = any status
--   $5  page size     bigint       NULL = no limit
--   $6  offset        bigint
--   $7  archived      text         NULL or 'live' = not archived,
--                                  'all' = both, 'archived' = archived only
--
-- total_count is the number of matching cases before LIMIT/OFFSET, so one
-- round trip returns both the page and the pager's total.
--
-- Usage (psql): paste the query into PREPARE, then EXECUTE it, e.g.
--   PREPARE case_list AS <this query>;
--   EXECUTE case_list(6, NULL, 'prosecution_evidence', 'pending', 20, 0, NULL);

SELECT c.id,
       ct.code || ' ' || c.case_number || '/' || c.case_year AS case_no,
       ct.code  AS case_type,
       co.name  AS court,
       c.stage,
       c.status,
       c.filed_on,
       c.deleted_at,
       count(*) OVER () AS total_count
FROM cases c
JOIN case_types ct ON ct.id = c.case_type_id
JOIN courts co     ON co.id = c.court_id
WHERE ($1::bigint      IS NULL OR c.court_id     = $1::bigint)
  AND ($2::bigint      IS NULL OR c.case_type_id = $2::bigint)
  AND ($3::case_stage  IS NULL OR c.stage        = $3::case_stage)
  AND ($4::case_status IS NULL OR c.status       = $4::case_status)
  AND CASE coalesce($7::text, 'live')
          WHEN 'all'      THEN true
          WHEN 'archived' THEN c.deleted_at IS NOT NULL
          ELSE                 c.deleted_at IS NULL
      END
ORDER BY c.filed_on, c.id
LIMIT $5::bigint OFFSET $6::bigint;
