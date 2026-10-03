-- 014_app_web_login.sql
-- app_web: the login the web app connects as. It inherits app_readonly's
-- rights (012) and nothing else, so the application can read every table
-- but cannot insert, update, delete or change the schema. The text-to-SQL
-- layer will connect the same way and inherit the same guarantee.
--
-- Why a SQL role and not a Neon console/API role: on Neon, roles created
-- through the console or API are made members of neon_superuser, which holds
-- pg_write_all_data. A role created with CREATE ROLE is not.
--
-- The password is NOT in this file. Set it out of band, as a SCRAM-SHA-256
-- verifier so the plain text never appears in SQL or server logs:
--   ALTER ROLE app_web PASSWORD 'SCRAM-SHA-256$4096:<salt>$<stored>:<server>';
-- Until then app_web cannot log in.

BEGIN;

CREATE ROLE app_web LOGIN IN ROLE app_readonly;

-- Second line of defence: every transaction app_web opens is read-only, so a
-- write is refused even if a broader grant is ever added by mistake.
ALTER ROLE app_web SET default_transaction_read_only = on;

-- Bound runaway queries (relevant once generated SQL runs as this role).
ALTER ROLE app_web SET statement_timeout = '15s';

COMMIT;
