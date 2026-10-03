-- 008_hearings_orders_witnesses_audit.sql
-- Proceedings layer: hearings, orders, witnesses, and the case audit log.
-- Schema only; seeded by 009.
--
-- Index notes:
--   - hearings(case_id, hearing_date) is provided by the unique constraint
--     hearings_one_per_case_per_day, which builds exactly that index. A
--     separate CREATE INDEX on the same columns would be redundant (see the
--     index dropped in 007).
--   - orders(case_id, order_date) is a plain index: a case can have several
--     orders on one date (e.g. cognizance and summons).

BEGIN;

-- ---------------------------------------------------------------------------
-- Enum types
-- ---------------------------------------------------------------------------
CREATE TYPE hearing_outcome AS ENUM ('proceeded', 'adjourned', 'disposed');

-- The seven reasons listed in DOMAIN.md "Adjournment reasons".
CREATE TYPE adjournment_reason AS ENUM (
    'accused_absent',
    'advocate_strike',
    'witness_not_produced',
    'presiding_officer_on_leave',
    'records_awaited_from_police',
    'time_sought_by_prosecution',
    'time_sought_by_defence'
);

-- The eight types listed in DOMAIN.md "Order types", plus 'other' for orders
-- outside that list (appearance recorded, appeal admitted, remand, stay...).
-- order_text always carries the order's own wording.
CREATE TYPE order_type AS ENUM (
    'bail',
    'cognizance',
    'summons_warrant',
    'adjournment',
    'charge_framing',             -- includes notice of accusation in summons cases
    'conviction',
    'acquittal',
    'dismissal',
    'other'
);

CREATE TYPE witness_type AS ENUM ('prosecution', 'defence', 'court');

-- ---------------------------------------------------------------------------
-- hearings: one row per listing of a case.
-- ---------------------------------------------------------------------------
CREATE TABLE hearings (
    id                  bigint             GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    case_id             bigint             NOT NULL REFERENCES cases (id),
    judge_id            bigint             REFERENCES judges (id),
    hearing_date        date               NOT NULL,
    purpose             text,
    outcome             hearing_outcome    NOT NULL,
    next_date           date,
    adjournment_reason  adjournment_reason,
    CONSTRAINT hearings_one_per_case_per_day
        UNIQUE (case_id, hearing_date),
    CONSTRAINT hearings_next_date_after_hearing_date
        CHECK (next_date IS NULL OR next_date > hearing_date),
    CONSTRAINT hearings_reason_only_when_adjourned
        CHECK (adjournment_reason IS NULL OR outcome = 'adjourned')
);

CREATE INDEX hearings_judge_id_idx ON hearings (judge_id);

-- ---------------------------------------------------------------------------
-- orders: is_final marks the order that disposes of the case it is passed in.
-- ---------------------------------------------------------------------------
CREATE TABLE orders (
    id          bigint     GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    case_id     bigint     NOT NULL REFERENCES cases (id),
    hearing_id  bigint     REFERENCES hearings (id),
    judge_id    bigint     REFERENCES judges (id),
    order_date  date       NOT NULL,
    order_type  order_type NOT NULL,
    order_text  text       NOT NULL,
    is_final    boolean    NOT NULL DEFAULT false
);

CREATE INDEX orders_case_id_order_date_idx ON orders (case_id, order_date);
CREATE INDEX orders_hearing_id_idx         ON orders (hearing_id);

-- ---------------------------------------------------------------------------
-- witnesses: hearing_id and examined_on stay NULL until the witness is
-- actually examined.
-- ---------------------------------------------------------------------------
CREATE TABLE witnesses (
    id            bigint       GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    case_id       bigint       NOT NULL REFERENCES cases (id),
    hearing_id    bigint       REFERENCES hearings (id),
    name          text         NOT NULL,
    witness_type  witness_type NOT NULL,
    examined_on   date,
    CONSTRAINT witnesses_examined_at_hearing
        CHECK ((hearing_id IS NULL) = (examined_on IS NULL))
);

CREATE INDEX witnesses_case_id_idx    ON witnesses (case_id);
CREATE INDEX witnesses_hearing_id_idx ON witnesses (hearing_id);

-- ---------------------------------------------------------------------------
-- case_audit_log: field-level history of cases (implication 5: a transfer is
-- a court_id update plus a row here). Values are stored as text, exactly as
-- held in the column (ids for foreign keys).
-- ---------------------------------------------------------------------------
CREATE TABLE case_audit_log (
    id             bigint      GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    case_id        bigint      NOT NULL REFERENCES cases (id),
    field_changed  text        NOT NULL,
    old_value      text,
    new_value      text,
    changed_at     timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX case_audit_log_case_id_changed_at_idx ON case_audit_log (case_id, changed_at);

COMMIT;
