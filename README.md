# court-case-platform

Case tracking for criminal courts across India: a PostgreSQL schema (Neon) and
a Next.js 15 web app.

## Run locally

```sh
npm install
cp .env.example .env.local   # then set DATABASE_URL, ADMIN_DATABASE_URL, JWT_SECRET
npm run dev                  # http://localhost:3000
```

## Layout

- `db/migrations/`: the schema and seed data, applied in order (001-019)
- `db/queries/`: SQL shared by the app, psql and the benchmark
- `db/tests/`: integrity test (psql) and index benchmark, with results
- `db/scripts/create_user.sql`: add a user (`-v role=admin` for an administrator; the default `viewer` role is reserved for a future litigant portal)
- `src/`: the web app. Public pages need no login; administrators sign in at `/login` (username or email) to reach `/admin`: a dashboard, the case register, and forms for cases, parties, hearings and orders. Every write is audited, and the triggers it fired are shown after saving.
