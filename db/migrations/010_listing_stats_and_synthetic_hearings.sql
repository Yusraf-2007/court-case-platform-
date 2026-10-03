-- 010_listing_stats_and_synthetic_hearings.sql
--
-- ###########################################################################
-- THIS MIGRATION CREATES SYNTHETIC DATA.
--
-- DOMAIN.md states how many times each case was listed and adjourned, but
-- not WHEN. Part 1 stores those counts exactly as stated. Part 2 generates
-- one hearings row per stated listing so the timeline and adjournment
-- queries have rows to work on. Every generated row has is_synthetic = true.
-- The counts are real; the dates are demo padding.
--
-- To remove the synthetic data:  DELETE FROM hearings WHERE is_synthetic;
-- ###########################################################################

BEGIN;

-- ---------------------------------------------------------------------------
-- SEED ANCHOR DATE
-- Seeds must be reproducible: running this migration on any day, on any
-- branch, must produce identical rows. So "today" is this fixed constant,
-- never CURRENT_DATE. It is the date the dataset was frozen. Change it only
-- deliberately, and regenerate the synthetic hearings when you do.
-- SET LOCAL scopes it to this transaction.
-- ---------------------------------------------------------------------------
SET LOCAL app.seed_anchor_date = '2026-10-03';

-- How hearings are generated (Part 2), per case with a stated count and a
-- known filed_on:
--   - dates: spread evenly from filed_on to disposed_on (disposed cases,
--     whose last hearing falls on disposed_on with outcome 'disposed') or to
--     the seed anchor date (every other case, all hearings strictly before it).
--   - adjourned: exactly times_adjourned of the non-final hearings, spaced
--     evenly. If times_adjourned is not stated, none are adjourned.
--   - adjournment_reason: taken from the case's own stated breakdown, in
--     case_adjournment_reasons order; NULL where no breakdown covers it.
--   - next_date: the next generated hearing's date (NULL on the last one).
--   - judge_id: set only for Case 1 and Case 11, whose presiding officers
--     DOMAIN.md names. purpose is NULL throughout.
--
-- KNOWN GAPS
--   1. times_adjourned is NULL (not stated) for Cases 24, 27, 28, 32, 36, 37.
--   2. Breakdowns are stated only for Cases 1, 3, 19 and 54. Case 54's is
--      partial (6 of 9 for advocate strike). Case 52's "accused repeatedly
--      absent" is not a count and is not stored.
--   3. Cases 39, 40, 44, 47, 48, 49, 50, 53 have no stated counts and no
--      filed_on, so they get no hearings.
--   4. Case 7 reopened on remand, so its hearings run to the anchor date across
--      its 30-09-2025 acquittal. Case 51's hearings ignore its court transfer.
--   5. Stated orders are not linked to synthetic hearings (orders.hearing_id
--      stays NULL), so real and synthetic data never reference each other.
--   6. Pending cases' hearings end at the seed anchor date (2026-10-03), not
--      the day the migration runs; they do not move as time passes.

-- ===========================================================================
-- Part 1: stated counts
-- ===========================================================================
CREATE TABLE case_listing_stats (
    case_id          bigint  PRIMARY KEY REFERENCES cases (id),
    times_listed     integer NOT NULL,
    times_adjourned  integer,              -- NULL = not stated
    CONSTRAINT case_listing_stats_listed_positive
        CHECK (times_listed > 0),
    CONSTRAINT case_listing_stats_adjourned_within_listed
        CHECK (times_adjourned IS NULL OR times_adjourned BETWEEN 0 AND times_listed)
);

CREATE TABLE case_adjournment_reasons (
    case_id  bigint             NOT NULL REFERENCES cases (id),
    reason   adjournment_reason NOT NULL,
    count    integer            NOT NULL,
    PRIMARY KEY (case_id, reason),
    CONSTRAINT case_adjournment_reasons_count_positive CHECK (count > 0)
);

INSERT INTO case_listing_stats (case_id, times_listed, times_adjourned)
SELECT c.id, v.listed, v.adjourned
FROM (VALUES
    ('GR',  412, 2024, 23,  9),     -- 1
    ('GR',  415, 2024, 18,  7),     -- 2
    ('GR',  418, 2024, 11, 11),     -- 3
    ('CC',   55, 2023, 31, 13),     -- 4
    ('GR',  120, 2022, 29, 12),     -- 5
    ('NI',  201, 2024, 19,  6),     -- 6
    ('GR',   77, 2023, 26, 10),     -- 7
    ('CC',   33, 2024,  4,  1),     -- 8
    ('GR',  250, 2025, 12,  4),     -- 9
    ('GR',  251, 2025, 12,  4),     -- 10
    ('CRA',  88, 2026,  7,  2),     -- 11
    ('GR',  252, 2025,  9,  9),     -- 19
    ('CC',  101, 2025, 10,  3),     -- 20
    ('NI',  110, 2023, 21,  8),     -- 21
    ('NI',  145, 2024, 17,  6),     -- 22
    ('NI',  310, 2025,  5,  2),     -- 23
    ('NI',  180, 2024, 14, NULL),   -- 24
    ('NI',  220, 2025,  8,  3),     -- 25
    ('NI',   95, 2023, 16, 11),     -- 26
    ('NI',  275, 2025,  6, NULL),   -- 27
    ('NI',   48, 2026,  1, NULL),   -- 28
    ('GR',  500, 2025,  7,  2),     -- 29
    ('GR',  205, 2023, 24,  9),     -- 30
    ('GR',  330, 2024, 15,  5),     -- 31
    ('GR',   90, 2026,  2, NULL),   -- 32
    ('GR',  410, 2025,  9,  4),     -- 33
    ('GR',  155, 2024, 20,  7),     -- 34
    ('GR',  288, 2023, 27, 11),     -- 35
    ('GR',  601, 2025,  4, NULL),   -- 36
    ('GR',   44, 2026,  1, NULL),   -- 37
    ('GR',  199, 2024, 18,  6),     -- 38
    ('GR',  150, 2021, 38, 17),     -- 51
    ('CC',   40, 2021, 41, 28),     -- 52
    ('NI',   15, 2022, 22,  9)      -- 54
) AS v (code, num, yr, listed, adjourned)
JOIN case_types ct ON ct.code = v.code
JOIN cases c       ON (c.case_type_id, c.case_number, c.case_year) = (ct.id, v.num, v.yr);

INSERT INTO case_adjournment_reasons (case_id, reason, count)
SELECT c.id, v.reason::adjournment_reason, v.n
FROM (VALUES
    ('GR', 412, 2024, 'witness_not_produced',        4),   -- 1
    ('GR', 412, 2024, 'advocate_strike',             2),
    ('GR', 412, 2024, 'presiding_officer_on_leave',  2),
    ('GR', 412, 2024, 'records_awaited_from_police', 1),
    ('GR', 418, 2024, 'accused_absent',             11),   -- 3: "accused absent throughout"
    ('GR', 252, 2025, 'accused_absent',              9),   -- 19: "(accused absent)"
    ('NI',  15, 2022, 'advocate_strike',             6)    -- 54: "6 were on account of advocate strike"
) AS v (code, num, yr, reason, n)
JOIN case_types ct ON ct.code = v.code
JOIN cases c       ON (c.case_type_id, c.case_number, c.case_year) = (ct.id, v.num, v.yr);

-- ===========================================================================
-- Part 2: synthetic hearings
-- ===========================================================================
ALTER TABLE hearings ADD COLUMN is_synthetic boolean NOT NULL DEFAULT false;

INSERT INTO hearings (case_id, judge_id, hearing_date, purpose, outcome,
                      next_date, adjournment_reason, is_synthetic)
WITH base AS (
    -- One row per case with a stated count and a known filing date.
    SELECT s.case_id,
           s.times_listed                         AS n,
           coalesce(s.times_adjourned, 0)         AS a,
           c.filed_on                             AS f,
           coalesce(c.disposed_on,
                    current_setting('app.seed_anchor_date')::date) AS e,
           (c.status = 'disposed')                AS ends_in_disposal
    FROM case_listing_stats s
    JOIN cases c ON c.id = s.case_id
    WHERE c.filed_on IS NOT NULL
),
slots AS (
    -- n evenly spaced dates. Disposed cases end on disposed_on; others stop
    -- short of the seed anchor date.
    SELECT b.*, i,
           CASE WHEN b.ends_in_disposal
                THEN b.f + (i * (b.e - b.f)) / b.n
                ELSE b.f + (i * (b.e - b.f)) / (b.n + 1)
           END AS hearing_date,
           CASE WHEN b.ends_in_disposal THEN b.n - 1 ELSE b.n END AS m   -- non-final hearings
    FROM base b
    CROSS JOIN LATERAL generate_series(1, b.n) AS i
),
outcomes AS (
    -- The final hearing of a disposed case is 'disposed'. Of the other m,
    -- exactly a are 'adjourned', spread evenly: hearing i is adjourned when
    -- floor(i*a/m) steps up from floor((i-1)*a/m).
    SELECT s.*,
           CASE WHEN s.ends_in_disposal AND s.i = s.n THEN 'disposed'
                WHEN (s.i * s.a) / NULLIF(s.m, 0) > ((s.i - 1) * s.a) / NULLIF(s.m, 0) THEN 'adjourned'
                ELSE 'proceeded'
           END::hearing_outcome AS outcome
    FROM slots s
),
numbered AS (
    -- Running number of each adjourned hearing within its case, and the
    -- date of the next hearing.
    SELECT o.*,
           CASE WHEN o.outcome = 'adjourned'
                THEN count(*) FILTER (WHERE o.outcome = 'adjourned')
                         OVER (PARTITION BY o.case_id ORDER BY o.i)
           END AS adj_no,
           lead(o.hearing_date) OVER (PARTITION BY o.case_id ORDER BY o.i) AS next_hearing
    FROM outcomes o
),
reason_slots AS (
    -- Each stated reason repeated count times, numbered 1.. within the case.
    SELECT r.case_id, r.reason,
           row_number() OVER (PARTITION BY r.case_id ORDER BY r.reason, g) AS slot
    FROM case_adjournment_reasons r
    CROSS JOIN LATERAL generate_series(1, r.count) AS g
),
presiding AS (
    -- Presiding officers named in DOMAIN.md (Case 1, Case 11).
    SELECT c.id AS case_id, j.id AS judge_id
    FROM (VALUES ('GR', 412, 2024, 'A. K. Verma'),
                 ('CRA', 88, 2026, 'S. N. Pandey')) AS v (code, num, yr, judge)
    JOIN case_types ct ON ct.code = v.code
    JOIN cases c       ON (c.case_type_id, c.case_number, c.case_year) = (ct.id, v.num, v.yr)
    JOIN judges j      ON j.full_name = v.judge
)
SELECT n.case_id,
       p.judge_id,
       n.hearing_date,
       NULL,
       n.outcome,
       CASE WHEN n.outcome = 'disposed' THEN NULL ELSE n.next_hearing END,
       rs.reason,
       true
FROM numbered n
LEFT JOIN reason_slots rs ON rs.case_id = n.case_id AND rs.slot = n.adj_no
LEFT JOIN presiding p     ON p.case_id = n.case_id;

COMMIT;
