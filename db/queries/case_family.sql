-- case_family.sql
-- Every case connected to one case through case_relationships, in both
-- directions, with the shortest path to each.
--
-- Usage (psql):
--   \set case_id 28          -- a cases.id (28 is Case 1, G.R. 412/2024, on production)
--   \i db/queries/case_family.sql
--
-- Columns:
--   case_id    connected case (the starting case is returned at depth 0)
--   depth      number of edges on the shortest path from the starting case
--   rel_type   type of the last edge on that path (NULL for the start)
--   direction  how that edge is stored, relative to the walk:
--                forward  stored as previous case -> case_id
--                reverse  stored as case_id -> previous case
--              so an arrow is drawn path[depth] -> case_id when forward and
--              case_id -> path[depth] when reverse (NULL for the start)
--   path       case ids from the starting case to case_id
--
-- A case reached at its shortest depth by more than one edge type (e.g. Case
-- 20 from Case 9: tagged_with and arises_from_same_fir) gets one row per type.

WITH RECURSIVE
edges AS (
    -- Each stored edge, walked forwards ...
    SELECT from_case_id AS src, to_case_id AS dst, rel_type, 'forward' AS direction
    FROM case_relationships
    UNION ALL
    -- ... and backwards. This makes the symmetric types (tagged_with,
    -- arises_from_same_fir) traversable both ways, and lets a lower-court
    -- case reach its appeals and an appeal reach the case below it.
    SELECT to_case_id, from_case_id, rel_type, 'reverse'
    FROM case_relationships
),
family (case_id, depth, rel_type, direction, path) AS (
    -- Anchor: the starting case.
    SELECT c.id, 0, NULL::rel_type, NULL::text, ARRAY[c.id]
    FROM cases c
    WHERE c.id = :case_id

    UNION ALL

    -- Step: follow every edge out of the cases found so far.
    SELECT e.dst, f.depth + 1, e.rel_type, e.direction, f.path || e.dst
    FROM family f
    JOIN edges e ON e.src = f.case_id
    WHERE e.dst <> ALL (f.path)     -- never revisit a case on this path (remand cycles)
      AND f.depth < 25              -- hard depth cap
)
SELECT case_id, depth, rel_type, direction, path
FROM (
    SELECT family.*,
           min(depth) OVER (PARTITION BY case_id) AS shortest
    FROM family
) ranked
WHERE depth = shortest
ORDER BY depth, case_id, rel_type, direction;
