-- search_orders_vector.sql
-- Semantic half of the hybrid order search (/search, src/lib/order-search.ts).
-- Nearest orders to the query's embedding by cosine distance (<=>), using
-- orders_embedding_idx (020, ivfflat). Only vectors from the same model as
-- the query are compared. Archived cases excluded.
--
-- Parameters (positional, sent separately from the SQL text):
--   $1  embedding  text   the query vector as '[0.1, 0.2, ...]' (1536 values)
--   $2  model      text   the model that produced it
--   $3  depth      int    how many ranked candidates to return
--
-- score is cosine similarity (1 - distance): 1 identical, 0 unrelated.

SELECT o.id,
       1 - (o.embedding <=> $1::vector)                     AS score,
       row_number() OVER (ORDER BY o.embedding <=> $1::vector, o.id) AS rank
FROM orders o
JOIN cases c ON c.id = o.case_id AND c.deleted_at IS NULL
WHERE o.embedding IS NOT NULL
  AND o.embedding_model = $2::text
ORDER BY o.embedding <=> $1::vector, o.id
LIMIT $3::int;
