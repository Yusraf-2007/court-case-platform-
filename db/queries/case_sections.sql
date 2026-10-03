-- case_sections.sql
-- The sections one case cites, with sections dropped before charge last.
--
-- Parameters (positional, sent separately from the SQL text):
--   $1  case id  bigint
-- Used by the /cases/[id] page (src/lib/case-detail.ts).
--
-- Sections are text ('379', '115(2)'), so they sort by their leading number
-- first; otherwise '1000' would sort before '379'.

SELECT p.act_name,
       p.section,
       p.title,
       cp.is_dropped
FROM case_provisions cp
JOIN provisions p ON p.id = cp.provision_id
WHERE cp.case_id = $1::bigint
ORDER BY cp.is_dropped,
         p.act_name,
         (substring(p.section FROM '^[0-9]+'))::int NULLS LAST,
         p.section;
