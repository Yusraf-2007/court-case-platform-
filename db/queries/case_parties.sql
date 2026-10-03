-- case_parties.sql
-- The parties to one case, each with the advocates appearing for them.
--
-- Parameters (positional, sent separately from the SQL text):
--   $1  case id  bigint
-- Used by the /cases/[id] page (src/lib/case-detail.ts).
--
-- Rows come in party_role enum order, so the page can group them by role.
-- advocates is a JSON array (empty when none is recorded) of
-- {name, enrolment, capacity}.

SELECT cp.id,
       cp.role,
       p.kind,
       p.full_name,
       p.relation,
       p.relative_name,
       p.address,
       p.district,
       t.full_name AS through_name,
       coalesce(
           json_agg(json_build_object('name',      a.full_name,
                                      'enrolment', a.enrolment_number,
                                      'capacity',  ca.capacity)
                    ORDER BY a.full_name)
               FILTER (WHERE a.id IS NOT NULL),
           '[]'::json) AS advocates
FROM case_parties cp
JOIN persons p             ON p.id = cp.person_id
LEFT JOIN persons t        ON t.id = cp.through_person_id
LEFT JOIN case_advocates ca ON ca.case_party_id = cp.id
LEFT JOIN advocates a      ON a.id = ca.advocate_id
WHERE cp.case_id = $1::bigint
GROUP BY cp.id, p.id, t.id
ORDER BY array_position(enum_range(NULL::party_role), cp.role), p.full_name;
