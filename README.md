# court-case-platform

Case tracking for criminal courts across India: a PostgreSQL schema (Neon) and
a Next.js 15 web app. A student project with synthetic case data; it is not an
official government service.

- **Public** (no login): a landing page with live figures, the case register,
  each case's progress as a stage tree, search by case number, party name or
  the text of orders (hybrid full-text and semantic), and limitation deadlines.
- **Admin** (`/admin`, sign-in required): a dashboard, the case register with
  add, edit, archive and delete, and forms for parties, hearings and orders.
  Every write is audited by database triggers, and the triggers that fired
  are shown after each save.

## Contents

- [Set up from a fresh clone](#set-up-from-a-fresh-clone)
- [Migrations, in order](#migrations-in-order)
- [Environment variables](#environment-variables)
- [Tests and evaluation](#tests-and-evaluation)
- [Architecture: why raw SQL, not an ORM](#architecture-why-raw-sql-not-an-orm)
- [Deployment checklist (Vercel)](#deployment-checklist-vercel)
- [Layout](#layout)

## Set up from a fresh clone

You need Node.js 22+, `psql` 16+, and PostgreSQL 16+ with the **pgvector**
extension available (Neon has it; locally, install your platform's
`postgresql-16-pgvector` package). All seed data is in the migrations, so a
fresh database becomes the full demo dataset in one pass.

1. **Install.**

   ```sh
   git clone https://github.com/Yusraf-2007/court-case-platform-.git
   cd court-case-platform-
   npm install
   ```

2. **Create a database.** On Neon, create a branch (or use a new project);
   locally, `createdb court`. Keep the *owner* connection string to hand as
   `OWNER_DATABASE_URL` (on Neon, the `neondb_owner` login). It is used only
   from your terminal, for migrations and maintenance; the app never gets it.

3. **Apply the migrations in order** (each file is its own transaction):

   ```sh
   for f in db/migrations/*.sql; do
     echo "== $f"
     psql "$OWNER_DATABASE_URL" -v ON_ERROR_STOP=1 -f "$f" || break
   done
   ```

   This creates the schema, seeds the reference data and the example cases
   (see [the list below](#migrations-in-order)), and creates the app's two
   database logins, `app_web` and `app_admin_user`, **without passwords**.
   On Neon, test on a temporary branch first, then apply to `production`.

4. **Give the two logins passwords.** Run in `psql "$OWNER_DATABASE_URL"`;
   `\password` hashes on your machine, so the password never reaches the
   server log or your shell history:

   ```
   \password app_web
   \password app_admin_user
   ```

   Create these roles only with SQL as above, never in the Neon console: roles
   made there join `neon_superuser`, which can write everywhere.

5. **Create an administrator.** psql prompts for the password:

   ```sh
   psql "$OWNER_DATABASE_URL" -v username=yusra -v role=admin -f db/scripts/create_user.sql
   psql "$OWNER_DATABASE_URL" -c "SELECT app_auth.set_email('yusra', 'yusra@court-platform.local')"
   ```

   Administrators sign in at `/login` with the username or the email.

6. **Configure the app.** `cp .env.example .env.local` and fill it in (see
   [Environment variables](#environment-variables)).

7. **Embed the orders (optional).** Needed only for the semantic half of the
   order search; without it, `/search` runs full-text alone and says so.

   ```sh
   npm run embed:orders -- --limit 20   # try a few first
   npm run embed:orders                 # then the rest; re-runnable
   ```

8. **Run.**

   ```sh
   npm run dev     # http://localhost:3000
   ```

## Migrations, in order

Apply every file, in numeric order. Seeds are reproducible: they never use
`now()` or `CURRENT_DATE` (synthetic hearing dates count from the fixed
anchor `2026-10-03` in 010), and they seed only what `DOMAIN.md` states; what
it does not state is recorded in each file's KNOWN GAPS block.

| # | What it does | Seeds |
|---|---|---|
| 001 | Reference layer: court levels, courts, judges, postings, case types, remedies, provisions, limitation rules; `usable_limitation_rules` view | court levels, case types and their remedies, the Supreme Court and Patna High Court, provisions, the three limitation rules (unverified) |
| 002 | | Begusarai courts, judges, further IPC/BNS provisions |
| 003 | CJM reporting line | the CJM court |
| 004 | Case layer: FIRs, cases, sections, persons, parties, advocates; six enums | |
| 005 | | the example cases, their FIRs, parties and advocates |
| 006 | Case relationship graph (appeals, revisions, transfers, ...) | the relationships between example cases |
| 007 | Conversion and stay; drops a redundant index (`ALTER TYPE ... ADD VALUE` commits separately) | the converted and stayed cases with their links |
| 008 | Proceedings layer: hearings, orders, witnesses, audit log | |
| 009 | | every dated order in the example cases |
| 010 | Listing statistics | stated listing counts and adjournment reasons; synthetic hearings from them (anchor date) |
| 011 | Five rule triggers (status/stage audit, court audit, FIR only on G.R., no hearing after disposal, final order disposes the case) | |
| 012 | `app_readonly` role: SELECT only | |
| 013 | Hearings date index (cause list) | |
| 014 | `app_web` login (read-only, `default_transaction_read_only`) | |
| 015 | `app_auth` schema: users, bcrypt passwords (pgcrypto), `authenticate()` | |
| 016 | | 24 High Courts with their states, district courts in 33 districts |
| 017 | `app_admin` group (read/write, audit log append-only) and `app_admin_user` login | |
| 018 | Admin sign-in by email; `record_login()` | |
| 019 | Archive (`cases.deleted_at`); audit log survives deletes; generic `audit_row()` triggers; triggers report their own names | |
| 020 | Order search: generated `tsvector` + GIN; `vector(1536)` + ivfflat; stale-embedding trigger | |

## Environment variables

The app reads six. `.env.example` has the template.

| Variable | Required | Value | Used by |
|---|---|---|---|
| `DATABASE_URL` | yes | `postgresql://app_web:<password>@<pooled host>/neondb?sslmode=require` | `src/lib/db-read.ts`: every page and every read. Read-only login. |
| `ADMIN_DATABASE_URL` | for `/admin` | `postgresql://app_admin_user:<password>@<pooled host>/neondb?sslmode=require` | `src/lib/db-write.ts`: admin writes only, after sign-in is verified. |
| `JWT_SECRET` | for `/admin` | 32+ random characters: `openssl rand -base64 48` | Signs the admin session cookie. Changing it signs everyone out. |
| `EMBEDDING_API_URL` | for semantic search | an OpenAI-compatible base URL, e.g. `https://api.openai.com/v1` | Query embeddings on `/search`; `embed:orders`; `search:eval` |
| `EMBEDDING_API_KEY` | for semantic search | that API's key | as above |
| `EMBEDDING_MODEL` | no | default `text-embedding-3-small`; must produce 1536 dimensions | as above. Must be the model the orders were embedded with. |

Notes:

- Use Neon's **pooled** host (`-pooler` in the name); the app disables
  prepared statements for it. End the URL with `?sslmode=require` and nothing
  else: drop the `channel_binding` parameter Neon's console adds, which
  postgres.js forwards to the server and the server rejects.
- `OWNER_DATABASE_URL` (the owner login) is for your terminal only. It must
  never be set in the app or on Vercel.

## Tests and evaluation

```sh
# Integrity: 11 tests of constraints, triggers and privileges, each in a
# savepoint; leaves nothing behind.
psql "$OWNER_DATABASE_URL" -f db/tests/integrity_test.sql

# Index benchmark, on a Neon branch only (it refuses the production endpoint).
DATABASE_URL=<branch owner url> npm run benchmark -- --scale 1000

# Search evaluation: precision@1/5/10 and MRR for full-text, semantic and
# hybrid on db/tests/search_eval.json (format: db/tests/search_eval.example.json).
# Read-only; semantic and hybrid are reported unavailable until orders are embedded.
DATABASE_URL=<app_web url> npm run search:eval -- --verbose
```

Results of the benchmark are in `db/tests/BENCHMARK_RESULTS.md`.

## Architecture: why raw SQL, not an ORM

The app talks to Postgres through `postgres.js` with hand-written SQL, either
tagged templates or the files in `db/queries/`. No ORM, for five reasons:

1. **The database enforces the rules, so the schema is the source of truth.**
   Constraints, triggers (a final order disposes its case; no hearing after
   disposal; audit rows that name the admin and survive deletion) and role
   privileges carry the guarantees. An ORM would add a second model of the
   schema that can drift from the migrations, and would encourage putting
   rules in application code where a direct `psql` session bypasses them.
2. **Security comes from Postgres privileges.** The public site connects as
   `app_web`, which holds SELECT only and defaults to read-only transactions;
   only authenticated admin code can open the second, writing connection
   (`app_admin_user`), and even that one cannot alter the audit log. With
   SQL written by hand, every statement's effect under those privileges is
   visible in review. Every request value is a bound parameter, never
   spliced into SQL text.
3. **The project uses Postgres features ORMs model poorly or not at all:**
   recursive CTEs (case families), `DISTINCT ON`, `LATERAL`, window
   aggregates, `FILTER`, partial and GIN indexes, enums, generated columns,
   `tsvector` full-text ranking, pgvector distance, and set-returning
   functions. Expressed directly, each can be `EXPLAIN ANALYZE`d as written.
4. **One query, many callers.** The SQL in `db/queries/` is read at runtime by
   the app, run in `psql`, timed by the benchmark and scored by the search
   evaluation. What is measured is exactly what serves users.
5. **The report needs the SQL to be visible.** `CLAUDE.md` tracks which SQL
   command categories the project uses and where each first appears.

The cost: no generated types (row types are written by hand next to each
query) and no automatic migrations (every change is a numbered SQL file,
tested on a Neon branch before production).

## Deployment checklist (Vercel)

Before the first deploy:

- [ ] All migrations, 001 through 020, applied to the production database.
- [ ] Passwords set for `app_web` and `app_admin_user` (`\password`, step 4).
- [ ] An administrator created (step 5).
- [ ] If the Neon–Vercel integration is installed: it injects `DATABASE_URL`
      and `PG*`/`POSTGRES_*` variables for the **owner** login. Replace
      `DATABASE_URL` with the `app_web` one below and delete the owner
      variables; the app must never hold owner credentials.

Set the variables in Vercel (Project → Settings → Environment Variables), in
this order, checking each layer before adding the next. Each change takes
effect on the next deployment, so redeploy after each step.

| Step | Variable | Connects as | Check after redeploying |
|---|---|---|---|
| 1 | `DATABASE_URL` | `app_web`: read-only (SELECT only, read-only transactions) | `/` shows the live figures; `/cases`, a case page and `/search` work |
| 2 | `JWT_SECRET` | none (signs cookies) | `/login` loads |
| 3 | `ADMIN_DATABASE_URL` | `app_admin_user`: read/write on case tables, audit log append-only | sign in; `/admin` loads; archive and restore a case and see the receipt |
| 4 | `EMBEDDING_API_URL`, `EMBEDDING_API_KEY`, `EMBEDDING_MODEL` | none (embedding API) | after `embed:orders`, `/search?q=...` shows semantic scores, not the full-text-only notice |

- Scope: set them for **Production**. For **Preview**, point the two database
  URLs at a Neon branch, never at production, so preview deployments cannot
  write production data.
- Region: put the functions next to the database. The Neon project is in AWS
  `us-east-2` (Ohio), so choose Vercel's `cle1` (Cleveland).
- The owner login (`neondb_owner`) appears nowhere in Vercel.

## Layout

- `db/migrations/`: schema and seed data, applied in order (001-020)
- `db/queries/`: SQL shared by the app, psql, the benchmark and the search evaluation
- `db/tests/`: integrity test (psql), index benchmark with results, search evaluation
- `db/scripts/`: `create_user.sql` (`-v role=admin` for an administrator; the
  default `viewer` role is reserved for a future litigant portal),
  `embed_orders.ts` (embedding backfill), `clear_synthetic_hearings.sql`
- `src/`: the web app (Next.js App Router). `src/lib/db-read.ts` and
  `src/lib/db-write.ts` are the two connections; `CLAUDE.md` has the
  conventions.
