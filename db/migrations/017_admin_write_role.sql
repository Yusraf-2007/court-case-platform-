-- 017_admin_write_role.sql
-- Splits the admin database access into a group role and a login:
--   app_admin       NOLOGIN. SELECT, INSERT, UPDATE, DELETE on the public
--                   schema's tables. No DDL: it owns nothing and has no
--                   CREATE on the schema, so it cannot create, alter or drop.
--   app_admin_user  LOGIN, member of app_admin. ADMIN_DATABASE_URL uses this.
--
-- app_admin was created in 015 as a login with INSERT/UPDATE on cases only.
-- It becomes NOLOGIN here; any password set on it stops being usable.
--
-- Deliberate exception to "all tables": case_audit_log is append-only for
-- admins (SELECT and INSERT, no UPDATE or DELETE), so an admin cannot erase
-- the record of their own writes.
--
-- app_web and app_readonly are unchanged. app_auth (users and hashes) stays
-- out of reach: no rights on that schema are granted here.

BEGIN;

ALTER ROLE app_admin NOLOGIN;

GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA public TO app_admin;
REVOKE UPDATE, DELETE ON case_audit_log FROM app_admin;

-- Tables added by later migrations get the same rights.
ALTER DEFAULT PRIVILEGES IN SCHEMA public
    GRANT SELECT, INSERT, UPDATE, DELETE ON TABLES TO app_admin;

CREATE ROLE app_admin_user LOGIN IN ROLE app_admin;
ALTER ROLE app_admin_user SET statement_timeout = '15s';

COMMIT;
