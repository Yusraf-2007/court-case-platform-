import "server-only";
import { readFileSync } from "node:fs";
import { join } from "node:path";

import { readDb as db } from "@/lib/db-read";

// Shared queries live in db/queries/*.sql so the app, psql and the benchmark
// all run the same SQL. Each file is read once per server process.
const cache = new Map<string, string>();

function queryText(name: string): string {
  let text = cache.get(name);
  if (text === undefined) {
    text = readFileSync(join(process.cwd(), "db/queries", `${name}.sql`), "utf8");
    cache.set(name, text);
  }
  return text;
}

type Param = string | number | null;

// Run db/queries/<name>.sql with positional parameters ($1, $2, ...).
// sql.unsafe() means only that the SQL *text* is not a tagged template: it is
// our own file, never user input. Every value goes in `params` and reaches
// Postgres as a bound parameter.
export function runQuery<T extends object>(name: string, params: Param[]) {
  return db().unsafe<T[]>(queryText(name), params);
}
