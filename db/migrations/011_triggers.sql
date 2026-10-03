-- 011_triggers.sql
-- Five triggers on cases, hearings and orders.
--
--   1. cases_log_status_stage   AFTER UPDATE   log status/stage changes
--   2. cases_log_court          AFTER UPDATE   log court_id changes (transfers)
--   3. cases_fir_only_on_gr     BEFORE INSERT  reject an FIR on a non-G.R. case
--      (also BEFORE UPDATE OF fir_id, case_type_id, so it cannot be bypassed
--      by inserting without an FIR and adding one afterwards)
--   4. hearings_not_after_disposal  BEFORE INSERT  reject a hearing dated after
--      its case was disposed. Hearings ON or BEFORE disposed_on are allowed:
--      a disposed case's own history (and the synthetic hearings from 010)
--      must still be insertable.
--   5. orders_dispose_case      AFTER INSERT WHEN is_final  set the case to
--      disposed, disposed_on = order_date, stage = 'disposal'. The status and
--      stage change is itself logged by trigger 1.
--
-- Trigger 5 needs a disposal_mode (cases_disposal_mode_matches_status), but
-- an order's type does not always say which: a final 'bail' order may be
-- 'allowed' or 'rejected', and 'dismissal' covers several modes. So orders
-- gains an optional disposal_mode. Trigger 5 uses it when given, otherwise
-- maps conviction -> conviction, acquittal -> acquittal, dismissal ->
-- dismissed, and rejects the order if neither gives a mode.
--
-- Error messages start with the rule's name so a rejection says which rule
-- was broken.
--
-- Deliberately NOT here: the appeal-direction trigger. case_type_remedies
-- still has four unverified gaps (see 001) and would reject the seeded
-- appeal chains.

BEGIN;

-- ---------------------------------------------------------------------------
-- orders.disposal_mode (used by trigger 5)
-- ---------------------------------------------------------------------------
ALTER TABLE orders ADD COLUMN disposal_mode disposal_mode;
ALTER TABLE orders ADD CONSTRAINT orders_disposal_mode_only_when_final
    CHECK (disposal_mode IS NULL OR is_final);

-- Backfill existing final orders from the cases they disposed.
UPDATE orders o
SET disposal_mode = c.disposal_mode
FROM cases c
WHERE c.id = o.case_id
  AND o.is_final
  AND c.status = 'disposed'
  AND o.order_date = c.disposed_on;

-- ---------------------------------------------------------------------------
-- Trigger 1: log status and stage changes
-- ---------------------------------------------------------------------------
CREATE FUNCTION cases_log_status_stage() RETURNS trigger
LANGUAGE plpgsql AS $$
BEGIN
    IF NEW.status IS DISTINCT FROM OLD.status THEN
        INSERT INTO case_audit_log (case_id, field_changed, old_value, new_value)
        VALUES (NEW.id, 'status', OLD.status::text, NEW.status::text);
    END IF;
    IF NEW.stage IS DISTINCT FROM OLD.stage THEN
        INSERT INTO case_audit_log (case_id, field_changed, old_value, new_value)
        VALUES (NEW.id, 'stage', OLD.stage::text, NEW.stage::text);
    END IF;
    RETURN NULL;   -- AFTER trigger: return value is ignored
END;
$$;

CREATE TRIGGER cases_log_status_stage
    AFTER UPDATE OF status, stage ON cases
    FOR EACH ROW
    EXECUTE FUNCTION cases_log_status_stage();

-- ---------------------------------------------------------------------------
-- Trigger 2: log court_id changes (transfers, implication 5)
-- ---------------------------------------------------------------------------
CREATE FUNCTION cases_log_court() RETURNS trigger
LANGUAGE plpgsql AS $$
BEGIN
    INSERT INTO case_audit_log (case_id, field_changed, old_value, new_value)
    VALUES (NEW.id, 'court_id', OLD.court_id::text, NEW.court_id::text);
    RETURN NULL;
END;
$$;

CREATE TRIGGER cases_log_court
    AFTER UPDATE OF court_id ON cases
    FOR EACH ROW
    WHEN (NEW.court_id IS DISTINCT FROM OLD.court_id)
    EXECUTE FUNCTION cases_log_court();

-- ---------------------------------------------------------------------------
-- Trigger 3: an FIR only on a G.R. case
-- ---------------------------------------------------------------------------
CREATE FUNCTION cases_fir_only_on_gr() RETURNS trigger
LANGUAGE plpgsql AS $$
DECLARE
    type_code text;
BEGIN
    SELECT code INTO type_code FROM case_types WHERE id = NEW.case_type_id;
    IF type_code <> 'GR' THEN
        RAISE EXCEPTION 'cases_fir_only_on_gr: an FIR can only be attached to a G.R. case, not %', type_code
            USING ERRCODE = 'check_violation';
    END IF;
    RETURN NEW;
END;
$$;

CREATE TRIGGER cases_fir_only_on_gr
    BEFORE INSERT OR UPDATE OF fir_id, case_type_id ON cases
    FOR EACH ROW
    WHEN (NEW.fir_id IS NOT NULL)
    EXECUTE FUNCTION cases_fir_only_on_gr();

-- ---------------------------------------------------------------------------
-- Trigger 4: no hearing after the case was disposed
-- ---------------------------------------------------------------------------
CREATE FUNCTION hearings_not_after_disposal() RETURNS trigger
LANGUAGE plpgsql AS $$
DECLARE
    c_status      case_status;
    c_disposed_on date;
BEGIN
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

CREATE TRIGGER hearings_not_after_disposal
    BEFORE INSERT ON hearings
    FOR EACH ROW
    EXECUTE FUNCTION hearings_not_after_disposal();

-- ---------------------------------------------------------------------------
-- Trigger 5: a final order disposes of its case
-- ---------------------------------------------------------------------------
CREATE FUNCTION orders_dispose_case() RETURNS trigger
LANGUAGE plpgsql AS $$
DECLARE
    mode disposal_mode;
BEGIN
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

CREATE TRIGGER orders_dispose_case
    AFTER INSERT ON orders
    FOR EACH ROW
    WHEN (NEW.is_final)
    EXECUTE FUNCTION orders_dispose_case();

COMMIT;
