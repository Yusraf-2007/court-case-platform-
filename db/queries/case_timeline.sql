-- case_timeline.sql
-- Hearings and orders of one case, merged into one chronological stream.
--
-- Usage (psql):
--   \set case_id 28          -- a cases.id (28 is Case 1, G.R. 412/2024, on production)
--   \i db/queries/case_timeline.sql
--
-- Columns:
--   entry_date  hearing_date or order_date
--   entry_type  'hearing' or 'order'
--   kind        hearing outcome, or order type
--   detail      hearing purpose (and adjournment reason), or order text
--   next_date   next date fixed at a hearing (NULL for orders)
--   judge       presiding officer, where recorded
--   is_final    true for the order that disposes of the case (NULL for hearings)
--
-- On the same date a hearing is listed before the orders passed at it.

SELECT entry_date, entry_type, kind, detail, next_date, judge, is_final
FROM (
    SELECT h.hearing_date                AS entry_date,
           'hearing'                     AS entry_type,
           0                             AS same_day_rank,
           h.id                          AS entry_id,
           h.outcome::text               AS kind,
           concat_ws(' - ', h.purpose, h.adjournment_reason::text) AS detail,
           h.next_date,
           j.full_name                   AS judge,
           NULL::boolean                 AS is_final
    FROM hearings h
    LEFT JOIN judges j ON j.id = h.judge_id
    WHERE h.case_id = :case_id

    UNION ALL

    SELECT o.order_date,
           'order',
           1,
           o.id,
           o.order_type::text,
           o.order_text,
           NULL::date,
           j.full_name,
           o.is_final
    FROM orders o
    LEFT JOIN judges j ON j.id = o.judge_id
    WHERE o.case_id = :case_id
) timeline
ORDER BY entry_date, same_day_rank, entry_id;
