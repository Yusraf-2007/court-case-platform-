# court-case-platform

Case tracking for the Begusarai criminal courts: a PostgreSQL schema (Neon) and
a Next.js 15 web app.

## Run locally

```sh
npm install
cp .env.example .env.local   # then set DATABASE_URL
npm run dev                  # http://localhost:3000/cases
```

## Layout

- `db/migrations/`: the schema and seed data, applied in order (001-013)
- `db/queries/`: SQL shared by the app, psql and the benchmark
- `db/tests/`: integrity test (psql) and index benchmark, with results
- `src/`: the web app (`/cases`: paginated, server-side filtered case list)
