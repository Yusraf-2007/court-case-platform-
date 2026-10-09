-- 015_auth_and_admin_role.sql
-- Application users (viewer / admin) and the database login admins write
-- through.
--
-- Security model:
--   - Users and password hashes live in their own schema, app_auth. The
--     read-only role (app_readonly, 012) gets no rights on it, so neither the
--     web app's read path nor the future text-to-SQL layer can read hashes.
--   - Passwords are hashed in the database with bcrypt (pgcrypto, cost 12).
--     The app never sees a hash: app_auth.authenticate() checks a username and
--     password and returns only the user's id, name and role.
--   - New users are viewers unless created as admin.
--   - app_web (014) stays read-only. Admin edits use a separate login,
--     app_admin, which can INSERT and UPDATE cases and nothing else, and which
--     the app uses only after re-checking the user's role in the database.
--   - case_audit_log gains changed_by, filled from the app.user setting the
--     app sets in each write transaction.
--
-- No user and no password is created here. Create users with
-- db/scripts/create_user.sql. Set app_admin's password out of band
-- (psql: \password app_admin).

BEGIN;

-- ---------------------------------------------------------------------------
-- Schema, hashing, users
-- ---------------------------------------------------------------------------
CREATE SCHEMA app_auth;
REVOKE ALL ON SCHEMA app_auth FROM PUBLIC;

CREATE EXTENSION pgcrypto WITH SCHEMA app_auth;

CREATE TYPE app_auth.user_role AS ENUM ('viewer', 'admin');

CREATE TABLE app_auth.users (
    id             bigint             GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    username       text               NOT NULL,
    password_hash  text               NOT NULL,
    role           app_auth.user_role NOT NULL DEFAULT 'viewer',
    disabled       boolean            NOT NULL DEFAULT false,
    created_at     timestamptz        NOT NULL DEFAULT now(),
    CONSTRAINT users_username_key UNIQUE (username),
    CONSTRAINT users_username_format CHECK (username ~ '^[a-z0-9_.-]{3,32}$')
);
REVOKE ALL ON app_auth.users FROM PUBLIC;

-- ---------------------------------------------------------------------------
-- authenticate: returns one row for a valid, enabled login, else none.
-- An unknown username still costs one bcrypt hash, so response time does not
-- reveal which usernames exist.
-- ---------------------------------------------------------------------------
CREATE FUNCTION app_auth.authenticate(p_username text, p_password text)
RETURNS TABLE (user_id bigint, username text, role app_auth.user_role)
LANGUAGE plpgsql STABLE SECURITY DEFINER
SET search_path = app_auth, pg_temp
AS $$
DECLARE
    u app_auth.users;
BEGIN
    SELECT * INTO u FROM app_auth.users
    WHERE users.username = lower(p_username) AND NOT disabled;

    IF NOT FOUND THEN
        PERFORM crypt(p_password, gen_salt('bf', 12));
        RETURN;
    END IF;

    IF u.password_hash = crypt(p_password, u.password_hash) THEN
        RETURN QUERY SELECT u.id, u.username, u.role;
    END IF;
END;
$$;

-- current_role_of: the user's role right now (NULL if removed or disabled).
-- Writes re-check this, so demoting or disabling a user takes effect
-- immediately rather than when their session token expires.
CREATE FUNCTION app_auth.current_role_of(p_user_id bigint)
RETURNS app_auth.user_role
LANGUAGE sql STABLE SECURITY DEFINER
SET search_path = app_auth, pg_temp
AS $$
    SELECT role FROM app_auth.users WHERE id = p_user_id AND NOT disabled;
$$;

-- create_user: owner-only (no EXECUTE granted). Role defaults to viewer.
CREATE FUNCTION app_auth.create_user(p_username text, p_password text,
                                     p_role app_auth.user_role DEFAULT 'viewer')
RETURNS bigint
LANGUAGE plpgsql SECURITY DEFINER
SET search_path = app_auth, pg_temp
AS $$
DECLARE
    new_id bigint;
BEGIN
    IF length(p_password) < 8 THEN
        RAISE EXCEPTION 'create_user: password must be at least 8 characters'
            USING ERRCODE = 'check_violation';
    END IF;
    INSERT INTO app_auth.users (username, password_hash, role)
    VALUES (lower(p_username), crypt(p_password, gen_salt('bf', 12)), p_role)
    RETURNING id INTO new_id;
    RETURN new_id;
END;
$$;

-- set_password: owner-only, for resets.
CREATE FUNCTION app_auth.set_password(p_username text, p_password text)
RETURNS void
LANGUAGE plpgsql SECURITY DEFINER
SET search_path = app_auth, pg_temp
AS $$
BEGIN
    IF length(p_password) < 8 THEN
        RAISE EXCEPTION 'set_password: password must be at least 8 characters'
            USING ERRCODE = 'check_violation';
    END IF;
    UPDATE app_auth.users SET password_hash = crypt(p_password, gen_salt('bf', 12))
    WHERE username = lower(p_username);
    IF NOT FOUND THEN
        RAISE EXCEPTION 'set_password: no user %', p_username;
    END IF;
END;
$$;

-- Functions are executable by PUBLIC by default; grant only what the app needs.
REVOKE EXECUTE ON FUNCTION app_auth.authenticate(text, text)                     FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION app_auth.current_role_of(bigint)                      FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION app_auth.create_user(text, text, app_auth.user_role)  FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION app_auth.set_password(text, text)                     FROM PUBLIC;

GRANT USAGE ON SCHEMA app_auth TO app_web;
GRANT EXECUTE ON FUNCTION app_auth.authenticate(text, text) TO app_web;
GRANT EXECUTE ON FUNCTION app_auth.current_role_of(bigint)  TO app_web;

-- ---------------------------------------------------------------------------
-- app_admin: the login admin writes go through
-- ---------------------------------------------------------------------------
CREATE ROLE app_admin LOGIN IN ROLE app_readonly;
GRANT INSERT, UPDATE ON cases TO app_admin;
-- The audit triggers (011) run as the writing role and insert here.
GRANT INSERT ON case_audit_log TO app_admin;
ALTER ROLE app_admin SET statement_timeout = '15s';

-- ---------------------------------------------------------------------------
-- Audit log: who made the change
-- ---------------------------------------------------------------------------
ALTER TABLE case_audit_log ADD COLUMN changed_by text;

CREATE OR REPLACE FUNCTION cases_log_status_stage() RETURNS trigger
LANGUAGE plpgsql AS $$
DECLARE
    who text := nullif(current_setting('app.user', true), '');
BEGIN
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
    INSERT INTO case_audit_log (case_id, field_changed, old_value, new_value, changed_by)
    VALUES (NEW.id, 'court_id', OLD.court_id::text, NEW.court_id::text,
            nullif(current_setting('app.user', true), ''));
    RETURN NULL;
END;
$$;

COMMIT;
