-- 019_archive_and_write_audit.sql
-- What the admin area needs from the schema.
--
--   1. cases.deleted_at: archiving. An archived case leaves every public
--      listing but keeps all its history; restoring clears the column.
--      Partial index on (deleted_at) WHERE deleted_at IS NULL, the predicate
--      every public query now carries.
--
--   2. case_audit_log keeps history through a delete. The FK to cases is
--      dropped (a log row must outlive the row it describes), and three
--      columns say what each row is about:
--        table_name  the table written (existing rows: 'cases')
--        row_id      that table's id (existing rows: the case id)
--        action      insert | update | delete (existing rows: update)
--      Inserts and deletes log the whole row as JSON in new_value/old_value
--      with field_changed = '*'; updates log one row per changed column.
--
--   3. Audit triggers on every table the admin forms write: cases (insert,
--      delete, and updates to columns triggers 1-2 of 011 do not already
--      log), case_parties, case_advocates, persons, hearings and orders.
--      One function, audit_row(), serves them all. Its arguments name the
--      column holding the case id (or how to find it) and the columns not
--      to log on update.
--        - persons has no case: a change to a person is logged once for
--          each case they are a party to. A person's insert is logged
--          inside the case_parties row that links them (audit_row adds the
--          person's details to it).
--        - case_advocates finds its case through case_parties.
--
--   4. Which triggers fired. Every trigger function in the schema now
--      appends its trigger's name to the transaction-local setting
--      app.triggers_fired. db-write.ts reads it back before commit, so the
--      admin area can show what a write set off. A BEFORE trigger that
--      rejects a write rolls the transaction back; its error message names
--      it instead.
--
--   5. hearings_not_after_disposal (011) also runs BEFORE UPDATE OF
--      hearing_date, case_id: an edit must not move a hearing past disposal
--      either. orders_dispose_case stays AFTER INSERT only; the app does
--      not let an edit make an existing order final.
--
-- KNOWN GAPS
--   - case_provisions, case_relationships, witnesses, case_listing_stats and
--     case_adjournment_reasons get no audit trigger: the admin area does not
--     write them yet. Add one with the same function when it does.
--   - Persons are never deleted by the app: removing a party removes the
--     link, not the person, who may be a party to other cases.

BEGIN;

-- ---------------------------------------------------------------------------
-- 1. Archive
-- ---------------------------------------------------------------------------
ALTER TABLE cases ADD COLUMN deleted_at timestamptz;

CREATE INDEX cases_not_archived_idx ON cases (deleted_at) WHERE deleted_at IS NULL;

-- ---------------------------------------------------------------------------
-- 2. Audit log that survives deletes
-- ---------------------------------------------------------------------------
ALTER TABLE case_audit_log DROP CONSTRAINT case_audit_log_case_id_fkey;

ALTER TABLE case_audit_log
    ADD COLUMN table_name text   NOT NULL DEFAULT 'cases',
    ADD COLUMN row_id     bigint,
    ADD COLUMN action     text   NOT NULL DEFAULT 'update'
        CHECK (action IN ('insert', 'update', 'delete'));

UPDATE case_audit_log SET row_id = case_id WHERE row_id IS NULL;

-- ---------------------------------------------------------------------------
-- 4. Trigger-fired tracking (defined first: every function below uses it)
-- ---------------------------------------------------------------------------
CREATE FUNCTION note_trigger_fired(name text) RETURNS void
LANGUAGE sql AS $$
    SELECT set_config('app.triggers_fired',
                      concat_ws(',', nullif(current_setting('app.triggers_fired', true), ''), name),
                      true);
$$;

-- ---------------------------------------------------------------------------
-- 3. Generic row audit
--   TG_ARGV[0]  how to find the case id:
--                 'id'            the row is a case
--                 'case_id'       a column of the row
--                 'case_party_id' look it up in case_parties
--                 'person'        every case the person is a party to
--   TG_ARGV[1]  comma-separated columns not to log on update (optional)
-- ---------------------------------------------------------------------------
CREATE FUNCTION audit_row() RETURNS trigger
LANGUAGE plpgsql AS $$
DECLARE
    who    text  := nullif(current_setting('app.user', true), '');
    o      jsonb := CASE WHEN TG_OP <> 'INSERT' THEN to_jsonb(OLD) END;
    n      jsonb := CASE WHEN TG_OP <> 'DELETE' THEN to_jsonb(NEW) END;
    r      jsonb := coalesce(n, o);
    skip   text[] := string_to_array(coalesce(TG_ARGV[1], ''), ',');
    cases  bigint[];
    act    text  := lower(TG_OP);
    k      text;
    c      bigint;
BEGIN
    PERFORM note_trigger_fired(TG_NAME);

    cases := CASE TG_ARGV[0]
        WHEN 'id'            THEN ARRAY[(r ->> 'id')::bigint]
        WHEN 'case_id'       THEN ARRAY[(r ->> 'case_id')::bigint]
        WHEN 'case_party_id' THEN ARRAY(SELECT case_id FROM case_parties
                                        WHERE id = (r ->> 'case_party_id')::bigint)
        WHEN 'person'        THEN ARRAY(SELECT DISTINCT case_id FROM case_parties
                                        WHERE person_id = (r ->> 'id')::bigint)
    END;

    -- A party row carries the person it links, so adding a new person to a
    -- case is logged in full.
    IF TG_TABLE_NAME = 'case_parties' THEN
        IF n IS NOT NULL THEN
            n := n || jsonb_build_object('person',
                 (SELECT to_jsonb(p) FROM persons p WHERE p.id = (n ->> 'person_id')::bigint));
        END IF;
        IF o IS NOT NULL THEN
            o := o || jsonb_build_object('person',
                 (SELECT to_jsonb(p) FROM persons p WHERE p.id = (o ->> 'person_id')::bigint));
        END IF;
    END IF;

    FOREACH c IN ARRAY coalesce(cases, '{}') LOOP
        IF TG_OP = 'UPDATE' THEN
            FOR k IN
                SELECT key FROM jsonb_each(n)
                WHERE n -> key IS DISTINCT FROM o -> key AND NOT key = ANY (skip)
            LOOP
                INSERT INTO case_audit_log
                    (case_id, table_name, row_id, action, field_changed, old_value, new_value, changed_by)
                VALUES (c, TG_TABLE_NAME, (r ->> 'id')::bigint, act, k, o ->> k, n ->> k, who);
            END LOOP;
        ELSE
            INSERT INTO case_audit_log
                (case_id, table_name, row_id, action, field_changed, old_value, new_value, changed_by)
            VALUES (c, TG_TABLE_NAME, (r ->> 'id')::bigint, act, '*', o::text, n::text, who);
        END IF;
    END LOOP;

    RETURN NULL;   -- AFTER trigger
END;
$$;

-- cases: status, stage and court_id are already logged by 011's triggers.
CREATE TRIGGER audit_cases
    AFTER INSERT OR UPDATE OR DELETE ON cases
    FOR EACH ROW EXECUTE FUNCTION audit_row('id', 'status,stage,court_id');

CREATE TRIGGER audit_case_parties
    AFTER INSERT OR UPDATE OR DELETE ON case_parties
    FOR EACH ROW EXECUTE FUNCTION audit_row('case_id');

CREATE TRIGGER audit_case_advocates
    AFTER INSERT OR UPDATE OR DELETE ON case_advocates
    FOR EACH ROW EXECUTE FUNCTION audit_row('case_party_id');

CREATE TRIGGER audit_persons
    AFTER UPDATE ON persons
    FOR EACH ROW EXECUTE FUNCTION audit_row('person');

CREATE TRIGGER audit_hearings
    AFTER INSERT OR UPDATE OR DELETE ON hearings
    FOR EACH ROW EXECUTE FUNCTION audit_row('case_id');

CREATE TRIGGER audit_orders
    AFTER INSERT OR UPDATE OR DELETE ON orders
    FOR EACH ROW EXECUTE FUNCTION audit_row('case_id');

-- ---------------------------------------------------------------------------
-- 4 (cont.). The five rule triggers of 011 note that they fired. Bodies are
-- unchanged apart from the PERFORM line (011, with changed_by from 015).
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION cases_log_status_stage() RETURNS trigger
LANGUAGE plpgsql AS $$
DECLARE
    who text := nullif(current_setting('app.user', true), '');
BEGIN
    PERFORM note_trigger_fired(TG_NAME);
    IF NEW.status IS DISTINCT FROM OLD.status THEN
        INSERT INTO case_audit_log (case_id, field_changed, old_value, new_value, changed_by)
        VALUES (NEW.id, 'status', OLD.status::text, NEW.status::text, who);
    END IF;
    IF NEW.stage IS DISTINCT FROM OLD.stage THEN
        INSERT INTO case_audit_log (case_id, field_changed, old_value, new_value, changed_by)
        VALUES (NEW.id, 'stage', OLD.stage::text, NEW.stage::text, who);
    END IF;
    RETURN NULL;
END;
$$;

CREATE OR REPLACE FUNCTION cases_log_court() RETURNS trigger
LANGUAGE plpgsql AS $$
BEGIN
    PERFORM note_trigger_fired(TG_NAME);
    INSERT INTO case_audit_log (case_id, field_changed, old_value, new_value, changed_by)
    VALUES (NEW.id, 'court_id', OLD.court_id::text, NEW.court_id::text,
            nullif(current_setting('app.user', true), ''));
    RETURN NULL;
END;
$$;

CREATE OR REPLACE FUNCTION cases_fir_only_on_gr() RETURNS trigger
LANGUAGE plpgsql AS $$
DECLARE
    type_code text;
BEGIN
    PERFORM note_trigger_fired(TG_NAME);
    SELECT code INTO type_code FROM case_types WHERE id = NEW.case_type_id;
    IF type_code <> 'GR' THEN
        RAISE EXCEPTION 'cases_fir_only_on_gr: an FIR can only be attached to a G.R. case, not %', type_code
            USING ERRCODE = 'check_violation';
    END IF;
    RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION hearings_not_after_disposal() RETURNS trigger
LANGUAGE plpgsql AS $$
DECLARE
    c_status      case_status;
    c_disposed_on date;
BEGIN
    PERFORM note_trigger_fired(TG_NAME);
    SELECT status, disposed_on INTO c_status, c_disposed_on
    FROM cases WHERE id = NEW.case_id;
    IF c_status = 'disposed' AND NEW.hearing_date > c_disposed_on THEN
        RAISE EXCEPTION 'hearings_not_after_disposal: case % was disposed on %, so it cannot be heard on %',
                        NEW.case_id, c_disposed_on, NEW.hearing_date
            USING ERRCODE = 'check_violation';
    END IF;
    RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION orders_dispose_case() RETURNS trigger
LANGUAGE plpgsql AS $$
DECLARE
    mode disposal_mode;
BEGIN
    PERFORM note_trigger_fired(TG_NAME);
    mode := coalesce(NEW.disposal_mode,
                     CASE NEW.order_type
                         WHEN 'conviction' THEN 'conviction'
                         WHEN 'acquittal'  THEN 'acquittal'
                         WHEN 'dismissal'  THEN 'dismissed'
                     END::disposal_mode);
    IF mode IS NULL THEN
        RAISE EXCEPTION 'orders_dispose_case: a final % order needs orders.disposal_mode to dispose of case %',
                        NEW.order_type, NEW.case_id
            USING ERRCODE = 'check_violation';
    END IF;

    UPDATE cases
    SET status        = 'disposed',
        stage         = 'disposal',
        disposal_mode = mode,
        disposed_on   = NEW.order_date
    WHERE id = NEW.case_id;

    RETURN NULL;
END;
$$;

-- ---------------------------------------------------------------------------
-- 5. No hearing after disposal, on edit as well as insert
-- ---------------------------------------------------------------------------
DROP TRIGGER hearings_not_after_disposal ON hearings;
CREATE TRIGGER hearings_not_after_disposal
    BEFORE INSERT OR UPDATE OF hearing_date, case_id ON hearings
    FOR EACH ROW
    EXECUTE FUNCTION hearings_not_after_disposal();

COMMIT;
