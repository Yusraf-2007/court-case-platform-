-- 004_cases_and_parties.sql
-- Case layer: FIRs, cases, case provisions, persons, case parties, advocates,
-- case advocates. Schema only; example cases are seeded in a later migration.
--
-- Per DOMAIN.md "Schema implications to act on":
--   - status and disposal_mode are separate columns (implication 2)
--   - provisions can be cited from both IPC and BNS on one case (implication 3)
--   - a transfer updates cases.court_id plus an audit-log row; it is not a
--     status and not a new case row (implication 5)

BEGIN;

-- ---------------------------------------------------------------------------
-- Enum types
-- ---------------------------------------------------------------------------
CREATE TYPE case_stage AS ENUM (
    'institution',
    'registration',
    'cognizance',
    'issue_of_process',
    'appearance_of_accused',
    'framing_of_charge',          -- includes "framing of notice" in summons cases
    'prosecution_evidence',
    'statement_of_accused',
    'defence_evidence',
    'final_arguments',
    'judgment',
    'disposal'
);

CREATE TYPE case_status AS ENUM ('pending', 'disposed', 'stayed', 'abated');

CREATE TYPE disposal_mode AS ENUM (
    -- trial outcomes
    'conviction',
    'acquittal',
    'compounded',
    'dismissed_for_default',      -- includes "dismissed for want of prosecution"
    'dismissed_at_cognizance',
    -- appellate, revisional and Misc. outcomes
    'allowed',
    'allowed_in_part',
    'rejected',
    'dismissed'
);

CREATE TYPE person_kind AS ENUM ('individual', 'organisation', 'state');

CREATE TYPE party_role AS ENUM (
    'accused',
    'complainant',
    'informant',
    'prosecution',
    'appellant',
    'respondent',
    'petitioner',
    'applicant'
);

CREATE TYPE advocate_capacity AS ENUM ('private', 'public_prosecutor');

-- ---------------------------------------------------------------------------
-- firs: "same FIR" is how tagged siblings are found, so it must be a join on
-- fir_id, never a text match.
-- Unique within one district. Covering more than one district would need
-- district (or a police_stations table) in this key.
-- ---------------------------------------------------------------------------
CREATE TABLE firs (
    id              bigint   GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    police_station  text     NOT NULL,
    fir_number      integer  NOT NULL CHECK (fir_number > 0),
    fir_year        smallint NOT NULL CHECK (fir_year BETWEEN 1950 AND 2100),
    fir_date        date,
    UNIQUE (police_station, fir_number, fir_year),
    CHECK (fir_date IS NULL OR EXTRACT(YEAR FROM fir_date) = fir_year)
);

-- ---------------------------------------------------------------------------
-- cases
-- ---------------------------------------------------------------------------
CREATE TABLE cases (
    id             bigint        GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    case_type_id   bigint        NOT NULL REFERENCES case_types (id),
    case_number    integer       NOT NULL CHECK (case_number > 0),
    case_year      smallint      NOT NULL CHECK (case_year BETWEEN 1950 AND 2100),
    court_id       bigint        NOT NULL REFERENCES courts (id),   -- current court
    fir_id         bigint        REFERENCES firs (id),
    filed_on       date          NOT NULL,
    registered_on  date,
    stage          case_stage    NOT NULL,
    status         case_status   NOT NULL DEFAULT 'pending',
    disposal_mode  disposal_mode,
    disposed_on    date,
    -- Unique within one district. If the system ever covers more than one
    -- district, this key needs court_id's district (court_id itself cannot
    -- be used: a transfer changes it).
    UNIQUE (case_type_id, case_number, case_year),
    CONSTRAINT cases_disposed_on_matches_status
        CHECK ((status = 'disposed') = (disposed_on IS NOT NULL)),
    CONSTRAINT cases_disposal_mode_matches_status
        CHECK ((status = 'disposed') = (disposal_mode IS NOT NULL)),
    CONSTRAINT cases_registered_on_after_filed_on
        CHECK (registered_on IS NULL OR registered_on >= filed_on),
    CONSTRAINT cases_disposed_on_after_filed_on
        CHECK (disposed_on IS NULL OR disposed_on >= filed_on)
);

CREATE INDEX cases_court_id_idx ON cases (court_id);
CREATE INDEX cases_fir_id_idx   ON cases (fir_id);
CREATE INDEX cases_status_idx   ON cases (status);

-- ---------------------------------------------------------------------------
-- case_provisions: sections cited in a case; one case may cite IPC and BNS.
-- is_dropped marks a section cited at institution but not carried into the charge.
-- ---------------------------------------------------------------------------
CREATE TABLE case_provisions (
    case_id       bigint  NOT NULL REFERENCES cases (id),
    provision_id  bigint  NOT NULL REFERENCES provisions (id),
    is_dropped    boolean NOT NULL DEFAULT false,
    PRIMARY KEY (case_id, provision_id)
);

CREATE INDEX case_provisions_provision_id_idx ON case_provisions (provision_id);

-- ---------------------------------------------------------------------------
-- persons: one row per real-world party, reused across cases.
-- ---------------------------------------------------------------------------
CREATE TABLE persons (
    id             bigint      GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    kind           person_kind NOT NULL DEFAULT 'individual',
    full_name      text        NOT NULL,
    relation       text        CHECK (relation IN ('s/o', 'w/o', 'd/o')),
    relative_name  text,
    address        text,
    district       text,
    CHECK ((relation IS NULL) = (relative_name IS NULL)),
    CHECK (kind = 'individual' OR relation IS NULL)
);

-- ---------------------------------------------------------------------------
-- case_parties: a person's role in one case.
-- through_person_id: "M/s Sharma Traders, through proprietor Vinod Sharma".
-- ---------------------------------------------------------------------------
CREATE TABLE case_parties (
    id                 bigint     GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    case_id            bigint     NOT NULL REFERENCES cases (id),
    person_id          bigint     NOT NULL REFERENCES persons (id),
    role               party_role NOT NULL,
    through_person_id  bigint     REFERENCES persons (id),
    UNIQUE (case_id, person_id, role),
    CHECK (through_person_id IS NULL OR through_person_id <> person_id)
);

CREATE INDEX case_parties_person_id_idx ON case_parties (person_id);

-- ---------------------------------------------------------------------------
-- advocates + case_advocates: an advocate appears for a party, not a case.
-- ---------------------------------------------------------------------------
CREATE TABLE advocates (
    id                bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    full_name         text   NOT NULL,
    enrolment_number  text   UNIQUE           -- e.g. BR/1142/2009; NULL if not known
);

CREATE TABLE case_advocates (
    id             bigint            GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    case_party_id  bigint            NOT NULL REFERENCES case_parties (id),
    advocate_id    bigint            NOT NULL REFERENCES advocates (id),
    capacity       advocate_capacity NOT NULL DEFAULT 'private',
    UNIQUE (case_party_id, advocate_id)
);

CREATE INDEX case_advocates_advocate_id_idx ON case_advocates (advocate_id);

COMMIT;
