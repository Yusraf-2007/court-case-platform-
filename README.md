# court-case-platform

Case tracking for the Begusarai criminal courts: a PostgreSQL schema (Neon) and
a Next.js 15 web app.

## Run locally

```sh
npm install
cp .env.example .env.local   # then set DATABASE_URL, ADMIN_DATABASE_URL, JWT_SECRET
npm run dev                  # http://localhost:3000/cases
```

## Layout

- `db/migrations/`: the schema and seed data, applied in order (001-015)
- `db/queries/`: SQL shared by the app, psql and the benchmark
- `db/tests/`: integrity test (psql) and index benchmark, with results
- `db/scripts/create_user.sql`: add a user (viewer by default, `-v role=admin` for admin)
- `src/`: the web app. Sign in at `/login`; viewers browse `/cases`, admins can also add and edit cases.
