-- 012_readonly_role.sql
-- app_readonly: the role the text-to-SQL layer will use later. Generated SQL
-- runs as this role, so it can read every table but never change data.
--
-- It is NOLOGIN (the CREATE ROLE default): the text-to-SQL service will log
-- in as its own user that is granted app_readonly.
--
-- The REVOKE is belt-and-braces: these privileges are never granted, so it
-- changes nothing today, but it states the intent and stays correct if a
-- broader grant is ever added by mistake.

BEGIN;

CREATE ROLE app_readonly;

GRANT USAGE ON SCHEMA public TO app_readonly;
GRANT SELECT ON ALL TABLES IN SCHEMA public TO app_readonly;
REVOKE INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA public FROM app_readonly;

-- Tables created by later migrations are readable too.
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT SELECT ON TABLES TO app_readonly;

COMMIT;
