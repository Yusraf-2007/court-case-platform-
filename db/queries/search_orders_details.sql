-- search_orders_details.sql
-- Display rows for the fused results of the hybrid order search: the case,
-- the order, and the order text with the full-text matches marked.
--
-- Parameters (positional, sent separately from the SQL text):
--   $1  order ids  bigint[]
--   $2  query      text     for ts_headline's highlighting
--
-- ts_headline marks matches with «» (not HTML), which the page renders as
-- <mark>; order text is never inserted into the page as HTML.

SELECT o.id,
       c.id AS case_id,
       ct.code || ' ' || c.case_number || '/' || c.case_year AS case_no,
       co.name AS court,
       o.order_date,
       o.order_type::text AS order_type,
       o.is_final,
       ts_headline('english', o.order_text, websearch_to_tsquery('english', $2::text),
                   'StartSel=«, StopSel=», HighlightAll=true') AS text_marked
FROM orders o
JOIN cases c       ON c.id = o.case_id AND c.deleted_at IS NULL
JOIN case_types ct ON ct.id = c.case_type_id
JOIN courts co     ON co.id = c.court_id
WHERE o.id = ANY ($1::bigint[]);
