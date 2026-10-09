-- pending_deadlines.sql
-- Appeals and revisions still in time: for each final order, the remedies
-- whose limitation period has not yet run out on $1, and no appeal or
-- revision has been filed against the case.
--
-- Computed ONLY from usable_limitation_rules (001), which holds verified
-- rules alone. While no rule is verified this returns no rows, by design: a
-- deadline from an unverified period would be worse than none.
--
-- Parameters (positional, sent separately from the SQL text):
--   $1  as of  date   (the app passes today)
-- Used by the /admin dashboard (src/lib/admin/dashboard.ts).
--
-- Usage (psql): PREPARE pending_deadlines AS <this query>;
--               EXECUTE pending_deadlines('2026-10-09');
--
-- Rule matching:
--   judgment_of_conviction  a final conviction order
--   order_of_acquittal      a final acquittal order
--   order_to_be_revised     any final order (interim orders are revisable
--                           too, but are not counted here)
--   forum_level             the remedy lies to a court above the case's
--                           court; NULL forum = any
-- A case already appealed or revised (case_relationships, stored as
-- lower case -> appeal/revision) has no pending deadline.

SELECT c.id                                                 AS case_id,
       ct.code || ' ' || c.case_number || '/' || c.case_year AS case_no,
       r.remedy,
       r.trigger_event,
       o.order_date,
       r.days,
       o.order_date + r.days                                AS deadline,
       (o.order_date + r.days) - $1::date                   AS days_left
FROM orders o
JOIN cases c        ON c.id = o.case_id AND c.deleted_at IS NULL
JOIN case_types ct  ON ct.id = c.case_type_id
JOIN courts co      ON co.id = c.court_id
JOIN usable_limitation_rules r
  ON r.trigger_event = CASE o.order_type
                           WHEN 'conviction' THEN 'judgment_of_conviction'
                           WHEN 'acquittal'  THEN 'order_of_acquittal'
                       END
  OR r.trigger_event = 'order_to_be_revised'
WHERE o.is_final
  AND (r.forum_level IS NULL OR r.forum_level > co.hierarchy_level)
  AND o.order_date + r.days >= $1::date
  AND NOT EXISTS (
      SELECT 1 FROM case_relationships cr
      WHERE cr.from_case_id = c.id
        AND cr.rel_type IN ('appeal_from', 'revision_of'))
ORDER BY deadline, case_no, r.remedy;
