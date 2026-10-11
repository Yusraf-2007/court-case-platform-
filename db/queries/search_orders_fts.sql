-- search_orders_fts.sql
-- Full-text half of the hybrid order search (/search, src/lib/order-search.ts).
-- Ranked by ts_rank_cd (cover density: rewards query terms that appear close
-- together) over orders.order_tsv (020, GIN index). Archived cases excluded.
--
-- Parameters (positional, sent separately from the SQL text):
--   $1  query     text    the user's words; websearch_to_tsquery accepts
--                         "quoted phrases", OR and -exclusions and never
--                         raises a syntax error on user input
--   $2  depth     int     how many ranked candidates to return
--
-- Usage (psql): PREPARE fts AS <this query>;  EXECUTE fts('bail surety', 50);

SELECT o.id,
       ts_rank_cd(o.order_tsv, q)                                  AS score,
       row_number() OVER (ORDER BY ts_rank_cd(o.order_tsv, q) DESC, o.id) AS rank
FROM orders o
JOIN cases c ON c.id = o.case_id AND c.deleted_at IS NULL,
     websearch_to_tsquery('english', $1::text) AS q
WHERE o.order_tsv @@ q
ORDER BY rank
LIMIT $2::int;
