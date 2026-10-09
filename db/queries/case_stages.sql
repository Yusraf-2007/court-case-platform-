-- case_stages.sql
-- The date a case reached each lifecycle stage, read from its order history.
-- Feeds the stage tree on /cases/[id] and the stage table on
-- /admin/cases/[id]: the same rows, presented two ways.
--
-- Parameters (positional, sent separately from the SQL text):
--   $1  case id  bigint
-- Used by src/lib/case-stages.ts.
--
-- Usage (psql): PREPARE case_stages AS <this query>;
--               EXECUTE case_stages(28);   -- Case 1, G.R. 412/2024
--
-- One row per stage that has evidence, at most one per stage (the earliest):
--   stage       case_stage value
--   reached_on  date the stage was reached
--   order_id, order_type, order_text, judge
--               the order that moved the case there (NULL for institution
--               and registration, which come from the case itself)
--
-- Stages with no row have no recorded date. Orders map to stages as follows;
-- anything not listed (prosecution evidence, defence evidence, final
-- arguments) has no order of its own in the records, so it is never dated:
--   cognizance order                              -> cognizance
--   cognizance order "... process/summons issued" -> also issue_of_process
--   summons_warrant order                         -> issue_of_process
--   interim bail order, or "Accused appeared ..." -> appearance_of_accused
--   charge_framing order                          -> framing_of_charge
--   "Statement of accused ..."                    -> statement_of_accused
--   final conviction or acquittal (not compounded) -> judgment
--   the final order, whatever its type            -> disposal

WITH c AS (
  SELECT id, filed_on, registered_on, disposed_on FROM cases WHERE id = $1::bigint
),
mapped AS (
  SELECT m.stage, o.id AS order_id, o.order_date, o.order_type, o.order_text, j.full_name AS judge
  FROM orders o
  LEFT JOIN judges j ON j.id = o.judge_id
  CROSS JOIN LATERAL unnest(ARRAY[
    CASE WHEN o.order_type = 'cognizance' THEN 'cognizance' END,
    CASE WHEN o.order_type = 'summons_warrant'
           OR (o.order_type = 'cognizance' AND o.order_text ~* '(process|summons) issued')
         THEN 'issue_of_process' END,
    CASE WHEN (o.order_type = 'bail' AND NOT o.is_final)
           OR (o.order_type = 'other' AND o.order_text ILIKE 'Accused appeared%')
         THEN 'appearance_of_accused' END,
    CASE WHEN o.order_type = 'charge_framing' THEN 'framing_of_charge' END,
    CASE WHEN o.order_type = 'other' AND o.order_text ILIKE 'Statement of accused%'
         THEN 'statement_of_accused' END,
    CASE WHEN o.is_final AND o.order_type IN ('conviction', 'acquittal')
           AND o.disposal_mode IS DISTINCT FROM 'compounded'
         THEN 'judgment' END,
    CASE WHEN o.is_final THEN 'disposal' END
  ]) AS m(stage)
  WHERE o.case_id = $1::bigint AND m.stage IS NOT NULL
),
events AS (
  SELECT 'institution' AS stage, filed_on AS reached_on,
         NULL::bigint AS order_id, NULL::text AS order_type, NULL::text AS order_text, NULL::text AS judge
  FROM c WHERE filed_on IS NOT NULL
  UNION ALL
  SELECT 'registration', registered_on, NULL, NULL, NULL, NULL
  FROM c WHERE registered_on IS NOT NULL
  UNION ALL
  SELECT stage, order_date, order_id, order_type::text, order_text, judge FROM mapped
  UNION ALL
  -- A disposed case with no final order on file: the case's own date.
  SELECT 'disposal', disposed_on, NULL, NULL, NULL, NULL
  FROM c WHERE disposed_on IS NOT NULL
)
SELECT DISTINCT ON (stage)
       stage, reached_on, order_id, order_type, order_text, judge
FROM events
-- earliest first, except that disposal prefers the row carrying the order
ORDER BY stage, (stage = 'disposal' AND order_id IS NULL), reached_on, order_id;
