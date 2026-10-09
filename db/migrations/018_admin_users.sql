-- 018_admin_users.sql
-- Extends app_auth.users (015) for admin sign-in by email:
--   - email: unique, case-insensitive (stored lower-case), optional so the
--     existing user 'yusra' stays valid until an email is set
--   - last_login: stamped on each successful sign-in
--
-- Hashing stays in the database (pgcrypto bcrypt, cost 12), as in 015.
--
-- authenticate() runs on the read-only app_web connection and cannot write,
-- so the login stamp is a separate function, record_login(), executable only
-- by app_admin (the write role, 017).

BEGIN;

ALTER TABLE app_auth.users
    ADD COLUMN email      text,
    ADD COLUMN last_login timestamptz,
    ADD CONSTRAINT users_email_key UNIQUE (email),
    ADD CONSTRAINT users_email_lower CHECK (email = lower(email)),
    ADD CONSTRAINT users_email_format CHECK (email ~ '^[^@\s]+@[^@\s]+\.[^@\s]+$');

-- Sign in by username or email. Same contract and timing behaviour as 015.
CREATE OR REPLACE FUNCTION app_auth.authenticate(p_username text, p_password text)
RETURNS TABLE (user_id bigint, username text, role app_auth.user_role)
LANGUAGE plpgsql STABLE SECURITY DEFINER
SET search_path = app_auth, pg_temp
AS $$
DECLARE
    u app_auth.users;
BEGIN
    SELECT * INTO u FROM app_auth.users
    WHERE (users.username = lower(p_username) OR users.email = lower(p_username))
      AND NOT disabled;

    IF NOT FOUND THEN
        PERFORM crypt(p_password, gen_salt('bf', 12));
        RETURN;
    END IF;

    IF u.password_hash = crypt(p_password, u.password_hash) THEN
        RETURN QUERY SELECT u.id, u.username, u.role;
    END IF;
END;
$$;

CREATE FUNCTION app_auth.record_login(p_user_id bigint)
RETURNS void
LANGUAGE sql SECURITY DEFINER
SET search_path = app_auth, pg_temp
AS $$
    UPDATE app_auth.users SET last_login = now() WHERE id = p_user_id;
$$;

-- set_email: owner-only, like create_user.
CREATE FUNCTION app_auth.set_email(p_username text, p_email text)
RETURNS void
LANGUAGE plpgsql SECURITY DEFINER
SET search_path = app_auth, pg_temp
AS $$
BEGIN
    UPDATE app_auth.users SET email = lower(p_email) WHERE username = lower(p_username);
    IF NOT FOUND THEN
        RAISE EXCEPTION 'set_email: no user %', p_username;
    END IF;
END;
$$;

REVOKE EXECUTE ON FUNCTION app_auth.record_login(bigint)   FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION app_auth.set_email(text, text)  FROM PUBLIC;

GRANT USAGE ON SCHEMA app_auth TO app_admin;
GRANT EXECUTE ON FUNCTION app_auth.record_login(bigint)    TO app_admin;
GRANT EXECUTE ON FUNCTION app_auth.current_role_of(bigint) TO app_admin;

COMMIT;
