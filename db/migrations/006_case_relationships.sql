-- 006_case_relationships.sql
-- Case relationship graph, traversed by the recursive family-tree query.
-- Seeds every relationship stated in DOMAIN.md's Example cases whose both
-- ends exist as cases.
--
-- Edge direction follows DOMAIN.md's arrows ("Case 1: appeal_from -> Case 11"
-- is from_case = 1, to_case = 11):
--   appeal_from, revision_of     lower-court case -> appellate/revisional case
--   remanded_to                  remanding case   -> case remanded to
--   arises_in, subsequent_to,
--   arises_from_same_fir         dependent case   -> case it depends on
--   tagged_with                  symmetric; stored once per pair, from the
--                                earlier case in DOMAIN.md order
--
-- ===========================================================================
-- KNOWN GAPS
--   1. Case 55 converted_to is NOT seeded here (resolved in 007). Its court
--      number is not stated, and the conversion needs two case rows
--      (C.C. 112/2023 and N.I. Act 240/2024); the old row's status is not
--      stated.
--   2. Case 53 stayed_by is NOT seeded here (resolved in 007). Its target,
--      Cr. Misc. 3300/2023 in the Patna High Court, is not a case in the
--      dataset and there is no High Court Cr. Misc. case type.
--   3. Case 51 transferred_to is NOT seeded. DOMAIN.md gives no target case:
--      a transfer is a court_id update plus an audit-log row (implication 5).
--   4. Cases 9, 10 and 19 list tagged_with -> Case 20, while Case 20 lists
--      only arises_from_same_fir -> Case 9 and the dataset summary calls
--      9/10/19 a three-way sibling set with 20 as a cross-case. Both are
--      seeded as stated.
-- ===========================================================================

BEGIN;

CREATE TYPE rel_type AS ENUM (
    'appeal_from',
    'revision_of',
    'remanded_to',
    'transferred_to',
    'tagged_with',
    'arises_from_same_fir',
    'arises_in',
    'converted_to',
    'stayed_by',
    'subsequent_to'
);

CREATE TABLE case_relationships (
    id            bigint   GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    from_case_id  bigint   NOT NULL REFERENCES cases (id),
    to_case_id    bigint   NOT NULL REFERENCES cases (id),
    rel_type      rel_type NOT NULL,
    CONSTRAINT case_relationships_no_self_link CHECK (from_case_id <> to_case_id),
    CONSTRAINT case_relationships_unique_edge  UNIQUE (from_case_id, to_case_id, rel_type)
);

-- The graph is traversed in both directions. (The from_case_id index is
-- dropped in 007: the unique constraint already covers it.)
CREATE INDEX case_relationships_from_case_id_idx ON case_relationships (from_case_id);
CREATE INDEX case_relationships_to_case_id_idx   ON case_relationships (to_case_id);

-- ---------------------------------------------------------------------------
-- Seed: each end identified by (case type code, number, year)
-- ---------------------------------------------------------------------------
INSERT INTO case_relationships (from_case_id, to_case_id, rel_type)
SELECT f.id, t.id, v.rel::rel_type
FROM (VALUES
    -- appeals
    ('GR',  412, 2024, 'CRA',   88, 2026, 'appeal_from'),           -- 1  -> 11
    ('CC',   55, 2023, 'CRA',   12, 2026, 'appeal_from'),           -- 4  -> 13
    ('GR',  120, 2022, 'CRA',   30, 2024, 'appeal_from'),           -- 5  -> 14
    ('NI',  201, 2024, 'CRA',   44, 2026, 'appeal_from'),           -- 6  -> 15
    ('GR',   77, 2023, 'CRA',   70, 2025, 'appeal_from'),           -- 7  -> 16
    -- revisions
    ('CC',   33, 2024, 'CRR',  455, 2024, 'revision_of'),           -- 8  -> 17
    ('CRA',  88, 2026, 'CRR', 1204, 2026, 'revision_of'),           -- 11 -> 12
    ('CRA',  30, 2024, 'CRR',  880, 2025, 'revision_of'),           -- 14 -> 18
    -- remands (Case 1 stays disposed, Case 7 reopened: see 005 gap 5)
    ('CRR', 1204, 2026, 'GR',  412, 2024, 'remanded_to'),           -- 12 -> 1
    ('CRA',   70, 2025, 'GR',   77, 2023, 'remanded_to'),           -- 16 -> 7
    -- FIR siblings, stored once per pair
    ('GR',  412, 2024, 'GR',  415, 2024, 'tagged_with'),            -- 1  - 2
    ('GR',  412, 2024, 'GR',  418, 2024, 'tagged_with'),            -- 1  - 3
    ('GR',  415, 2024, 'GR',  418, 2024, 'tagged_with'),            -- 2  - 3
    ('GR',  250, 2025, 'GR',  251, 2025, 'tagged_with'),            -- 9  - 10
    ('GR',  250, 2025, 'GR',  252, 2025, 'tagged_with'),            -- 9  - 19
    ('GR',  250, 2025, 'CC',  101, 2025, 'tagged_with'),            -- 9  - 20 (gap 4)
    ('GR',  251, 2025, 'GR',  252, 2025, 'tagged_with'),            -- 10 - 19
    ('GR',  251, 2025, 'CC',  101, 2025, 'tagged_with'),            -- 10 - 20 (gap 4)
    ('GR',  252, 2025, 'CC',  101, 2025, 'tagged_with'),            -- 19 - 20 (gap 4)
    -- cross-case
    ('CC',  101, 2025, 'GR',  250, 2025, 'arises_from_same_fir'),   -- 20 -> 9
    -- interlocutory applications
    ('MISC', 92, 2026, 'GR',  500, 2025, 'arises_in'),              -- 41 -> 29
    ('MISC',118, 2025, 'GR',  410, 2025, 'arises_in'),              -- 42 -> 33
    ('MISC', 44, 2026, 'GR',  410, 2025, 'arises_in'),              -- 43 -> 33
    ('MISC', 77, 2024, 'NI',  145, 2024, 'arises_in'),              -- 45 -> 22
    ('MISC',303, 2025, 'GR',  601, 2025, 'arises_in'),              -- 46 -> 36
    ('MISC', 44, 2026, 'MISC',118, 2025, 'subsequent_to')           -- 43 -> 42
) AS v (f_code, f_num, f_yr, t_code, t_num, t_yr, rel)
JOIN case_types fct ON fct.code = v.f_code
JOIN cases f        ON (f.case_type_id, f.case_number, f.case_year) = (fct.id, v.f_num, v.f_yr)
JOIN case_types tct ON tct.code = v.t_code
JOIN cases t        ON (t.case_type_id, t.case_number, t.case_year) = (tct.id, v.t_num, v.t_yr);

COMMIT;
