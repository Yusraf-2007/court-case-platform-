-- 001_reference_layer.sql
-- Reference layer: court levels, courts, judges, judge postings, case types,
-- case type remedies, provisions, limitation rules.
-- Seed data is limited to what DOMAIN.md states; nothing is invented.

BEGIN;

-- ---------------------------------------------------------------------------
-- court_levels: level names live in the database, not the UI
-- ---------------------------------------------------------------------------
CREATE TABLE court_levels (
    level   integer PRIMARY KEY CHECK (level > 0),
    name    text    NOT NULL UNIQUE
);

-- ---------------------------------------------------------------------------
-- courts: parent_court_id is the administrative reporting line ONLY.
-- Appeal/revision direction comes from case_type_remedies, never from here.
-- ---------------------------------------------------------------------------
CREATE TABLE courts (
    id               bigint  GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    name             text    NOT NULL,
    hierarchy_level  integer NOT NULL REFERENCES court_levels (level),
    parent_court_id  bigint  REFERENCES courts (id),
    district         text,
    state            text,
    UNIQUE (name, district),
    CHECK (parent_court_id IS NULL OR parent_court_id <> id)
);

CREATE INDEX courts_parent_court_id_idx ON courts (parent_court_id);
CREATE INDEX courts_hierarchy_level_idx ON courts (hierarchy_level);

-- ---------------------------------------------------------------------------
-- judges + judge_postings: a judge's court is a dated posting, so transfers
-- keep their history.
-- ---------------------------------------------------------------------------
CREATE TABLE judges (
    id           bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    full_name    text   NOT NULL,
    designation  text   NOT NULL          -- JMFC, CJM, ADJ, District & Sessions Judge, ...
);

CREATE TABLE judge_postings (
    id           bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    judge_id     bigint NOT NULL REFERENCES judges (id),
    court_id     bigint NOT NULL REFERENCES courts (id),
    posted_from  date   NOT NULL,
    posted_to    date,                     -- NULL = current posting
    CHECK (posted_to IS NULL OR posted_to >= posted_from)
);

CREATE INDEX judge_postings_judge_id_idx ON judge_postings (judge_id);
CREATE INDEX judge_postings_court_id_idx ON judge_postings (court_id);
-- at most one open (current) posting per judge
CREATE UNIQUE INDEX judge_postings_one_current_idx
    ON judge_postings (judge_id) WHERE posted_to IS NULL;

-- ---------------------------------------------------------------------------
-- case_types
-- ---------------------------------------------------------------------------
CREATE TABLE case_types (
    id               bigint  GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    code             text    NOT NULL UNIQUE,
    name             text    NOT NULL,
    min_court_level  integer NOT NULL REFERENCES court_levels (level),
    instituted_by    text    NOT NULL CHECK (instituted_by IN
                         ('police_fir', 'private_complaint', 'application', 'appellate')),
    disposed_by      text    NOT NULL CHECK (disposed_by IN ('judgment', 'order')),
    is_appellate     boolean NOT NULL DEFAULT false
);

-- ---------------------------------------------------------------------------
-- case_type_remedies: which remedy lies from a case type, and to which level.
-- The appeal-direction trigger will validate against this table.
-- ---------------------------------------------------------------------------
CREATE TABLE case_type_remedies (
    id            bigint  GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    case_type_id  bigint  NOT NULL REFERENCES case_types (id),
    remedy        text    NOT NULL CHECK (remedy IN ('appeal', 'revision')),
    forum_level   integer NOT NULL REFERENCES court_levels (level),
    UNIQUE (case_type_id, remedy, forum_level)
);

-- ---------------------------------------------------------------------------
-- provisions: act_name + section, because IPC and BNS sections coexist.
-- corresponds_to_id maps an old section to its replacement (e.g. IPC -> BNS).
-- ---------------------------------------------------------------------------
CREATE TABLE provisions (
    id                 bigint  GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    act_name           text    NOT NULL,
    section            text    NOT NULL,   -- text: '498A', '138'
    title              text,
    is_cognizable      boolean,
    is_bailable        boolean,
    corresponds_to_id  bigint  REFERENCES provisions (id),
    UNIQUE (act_name, section),
    CHECK (corresponds_to_id IS NULL OR corresponds_to_id <> id)
);

-- ---------------------------------------------------------------------------
-- limitation_rules: verified defaults to false. A rule cannot be marked
-- verified without a day count. The deadline engine must read
-- usable_limitation_rules, never this table directly.
-- ---------------------------------------------------------------------------
CREATE TABLE limitation_rules (
    id             bigint  GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    trigger_event  text    NOT NULL CHECK (trigger_event IN
                       ('judgment_of_conviction', 'order_of_acquittal', 'order_to_be_revised')),
    remedy         text    NOT NULL CHECK (remedy IN ('appeal', 'revision')),
    forum_level    integer REFERENCES court_levels (level),  -- NULL = any forum for this remedy
    days           integer CHECK (days > 0),                -- NULL = not yet known
    provision_id   bigint  REFERENCES provisions (id),      -- statutory basis, once verified
    verified       boolean NOT NULL DEFAULT false,
    notes          text,
    UNIQUE NULLS NOT DISTINCT (trigger_event, remedy, forum_level),
    CHECK (NOT verified OR days IS NOT NULL)
);

CREATE VIEW usable_limitation_rules AS
    SELECT * FROM limitation_rules WHERE verified;

-- ===========================================================================
-- Seed data (DOMAIN.md only)
--
-- KNOWN GAPS in case_type_remedies. DOMAIN.md does not state these, so they
-- are deliberately NOT seeded. Resolve in DOMAIN.md first, then seed in a
-- later migration. The appeal-direction trigger validates against this table.
--   1. C.C. revision lists the High Court only; G.R. lists Sessions or High
--      Court. Confirm whether C.C. revision also lies to Sessions.
--   2. N.I. Act (s.138) lists no revision route at all.
--   3. Cr. Appeal and Cr. Revision list no onward remedies, so appeal chains
--      2-3 levels deep cannot be validated yet.
--   4. Appeal against acquittal is not modelled: remedies record forum only,
--      not who may appeal (complainant's appeal goes to the High Court with
--      special leave, not to Sessions).
--
-- OTHER GAPS: DOMAIN.md's "Example cases" section is still a placeholder, so
-- no district courts, judges, or IPC/BNS provisions are seeded here.
-- ===========================================================================

INSERT INTO court_levels (level, name) VALUES
    (1, 'Judicial Magistrate First Class'),
    (2, 'Chief Judicial Magistrate'),
    (3, 'Sessions Court'),
    (4, 'High Court'),
    (5, 'Supreme Court');

-- Only the two courts DOMAIN.md names. District courts are added per district later.
INSERT INTO courts (name, hierarchy_level, parent_court_id, district, state) VALUES
    ('Supreme Court of India', 5, NULL, NULL, NULL);
INSERT INTO courts (name, hierarchy_level, parent_court_id, district, state)
    SELECT 'Patna High Court', 4, id, NULL, 'Bihar'
    FROM courts WHERE name = 'Supreme Court of India';

INSERT INTO case_types (code, name, min_court_level, instituted_by, disposed_by, is_appellate) VALUES
    ('GR',   'G.R. Case (General Register)', 1, 'police_fir',        'judgment', false),
    ('CC',   'Complaint Case',               1, 'private_complaint', 'judgment', false),
    ('NI',   'N.I. Act Case (s.138)',        1, 'private_complaint', 'judgment', false),
    ('MISC', 'Misc. Case',                   1, 'application',       'order',    false),
    ('CRA',  'Criminal Appeal',              3, 'appellate',         'judgment', true),
    ('CRR',  'Criminal Revision',            3, 'appellate',         'judgment', true);

-- Exactly the routes DOMAIN.md lists. Misc., Cr. Appeal and Cr. Revision have none yet.
INSERT INTO case_type_remedies (case_type_id, remedy, forum_level)
    SELECT ct.id, r.remedy, r.forum_level
    FROM (VALUES
        ('GR', 'appeal',   3),
        ('GR', 'revision', 3),
        ('GR', 'revision', 4),
        ('CC', 'appeal',   3),
        ('CC', 'revision', 4),
        ('NI', 'appeal',   3)
    ) AS r (code, remedy, forum_level)
    JOIN case_types ct ON ct.code = r.code;

INSERT INTO provisions (act_name, section, title, is_cognizable, is_bailable) VALUES
    ('Negotiable Instruments Act, 1881', '138',
     'Dishonour of cheque for insufficiency, etc., of funds in the account', NULL, NULL);

-- All three rows are marked VERIFY in DOMAIN.md, so none is verified.
INSERT INTO limitation_rules (trigger_event, remedy, forum_level, days, verified, notes) VALUES
    ('judgment_of_conviction', 'appeal',   3,    30,   false, 'DOMAIN.md: appeal to Sessions - VERIFY'),
    ('order_of_acquittal',     'appeal',   NULL, NULL, false, 'DOMAIN.md: days and forum unknown - VERIFY'),
    ('order_to_be_revised',    'revision', NULL, 90,   false, 'DOMAIN.md: revision - VERIFY');

COMMIT;
