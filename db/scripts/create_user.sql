-- create_user.sql
-- Create an application user. New users are viewers unless a role is given.
-- Run as the database owner; the password is hashed (bcrypt) in the database.
--
-- Usage (psql):
--   psql "$OWNER_DATABASE_URL" -v username=asha -f db/scripts/create_user.sql
--   psql "$OWNER_DATABASE_URL" -v username=asha -v role=admin -f db/scripts/create_user.sql
-- psql prompts for the password without echoing it.

\if :{?username}
\else
  \echo 'Set the username: -v username=<name>'
  \quit
\endif
\if :{?role}
\else
  \set role viewer
\endif

\prompt -s 'Password: ' password

SELECT app_auth.create_user(:'username', :'password', :'role') AS user_id;
