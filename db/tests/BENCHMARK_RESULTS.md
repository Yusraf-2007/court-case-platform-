# Index Benchmark: Results

## Summary

Five representative queries were timed with and without the indexes their
query plans use, at two data sizes: the real example dataset (57 cases) and the
same dataset cloned 1,000 times (57,057 cases).

At 57 cases, indexes make no measurable difference: every query completes in
under half a millisecond, because PostgreSQL reads each table in full whatever
indexes exist. At 57,057 cases the picture separates sharply:

- The **case family** (recursive graph) and **case timeline** queries run
  **244x and 335x faster** with their indexes.
- The **case list** gains only **1.6x**, because one court still holds about
  a tenth of all cases.
- The **adjournment analysis** has **no index to use**, because it aggregates
  about 42% of all hearings.
- The **cause list** was the one query the existing schema served badly: its
  indexes made it no faster, and in the first run slightly slower (0.84x).
  Its plan was reading every hearing. **Migration 013** added an index on
  `hearings(hearing_date)`, which made the cause list **10.4x faster**
  than the best plan available before the fix.

## 1. Environment and data

| | |
|---|---|
| Database | PostgreSQL 18.6 on Neon (project `late-glitter-91959782`) |
| Where | Throwaway branches copied from `production`, deleted after each run. Production was never benchmarked. |
| Small dataset | The seeded example data: 57 cases, 527 hearings, 47 orders, 28 case relationships |
| Large dataset | The same data cloned 1,000 times: 57,057 cases, 527,527 hearings, 47,047 orders, 28,028 relationships |

### The five queries

| Query | File | Parameters |
|---|---|---|
| Case list | `db/queries/case_list.sql` | JMFC Court No. 3, stage *prosecution evidence*, status *pending* |
| Case family | `db/queries/case_family.sql` | Case 1 (G.R. 412/2024), recursive walk of the relationship graph |
| Case timeline | `db/queries/case_timeline.sql` | Case 1, hearings and orders merged by date |
| Adjournment analysis | `db/queries/adjournment_analysis.sql` | none: grouped over every adjourned hearing |
| Cause list | `db/queries/cause_list.sql` | JMFC Court No. 3, 31-10-2024 |

## 2. Methodology

**Which indexes are "the query's".** For each query, the benchmark first asks
PostgreSQL for its plan with every index in place (`EXPLAIN (FORMAT JSON)`)
and collects the indexes that plan actually uses. Only those are removed. This
measures each index where it matters rather than dropping indexes the
query never touches.

**What is never removed.** Primary-key indexes stay in place: foreign keys
depend on them, and no realistic schema runs without them. An index that
backs a `UNIQUE` constraint is removed by dropping the constraint, and
restored by re-adding it with its original definition.

**Drop and restore inside a rolled-back transaction.** For each query, the
whole experiment runs as one transaction:

1. `BEGIN`
2. drop the query's indexes
3. run `EXPLAIN ANALYZE` five times (*without index*)
4. recreate the indexes
5. run `EXPLAIN ANALYZE` five times (*with index*)
6. `ROLLBACK`

PostgreSQL's DDL is transactional, so the final `ROLLBACK` returns the schema
to exactly its starting state, even if a step in between fails. Section 5
shows this guarantee being tested by a real bug.

**Five runs, median.** Each phase records the server-reported *Execution
Time* of five consecutive `EXPLAIN ANALYZE` runs, and the median is reported.
The median discards the cold-cache first run and any outlier without
having to choose which run to throw away. Execution Time excludes planning
and network time, so it measures only the work the indexes affect.

**Scale option.** At the real size every table fits in a handful of pages,
so the planner chooses full-table scans regardless and index effects cannot
be observed. The benchmark's `--scale N` option clones the whole case dataset
N times before measuring: cases, hearings, orders and relationships. Triggers
are disabled during the copy so the clones are exact. Clones receive case
numbers offset by multiples of 10,000. The option is meant only for
throwaway branches, and the script refuses to run against the production
endpoint.

**Tooling.** The procedure is implemented in `db/tests/benchmark.ts`
(Node.js, `pg` driver) and was verified end to end against a local
PostgreSQL. The Neon measurements reported here ran the identical procedure
through the Neon SQL interface, because the development environment's
network policy blocks direct database connections. A small PL/pgSQL function
ran the five `EXPLAIN ANALYZE` repetitions inside the database. The raw plans
are in `db/tests/explain_output.txt`.

## 3. Results

### 3.1 Real dataset: 57 cases

| Query | Rows | Without index | With index | Speedup | Indexes dropped |
|---|---:|---:|---:|---:|---|
| Case list | 2 | 0.062 ms | 0.054 ms | n/a | none (plan uses only primary keys) |
| Case family | 5 | 0.141 ms | 0.139 ms | 1.0x | `case_relationships_unique_edge`, `case_relationships_to_case_id_idx` |
| Case timeline | 29 | 0.132 ms | 0.108 ms | 1.2x | `hearings_one_per_case_per_day` |
| Adjournment analysis | 18 | 0.436 ms | 0.418 ms | n/a | none (no index used) |
| Cause list | 1 | 0.077 ms | 0.070 ms | n/a | none (plan uses only primary keys) |

All differences are within run-to-run noise. At this size the dataset fits
in a few memory pages, and a full scan costs less than an index lookup.

### 3.2 Cloned dataset: 57,057 cases

| Query | Rows | Without index | With index | Speedup | Indexes dropped |
|---|---:|---:|---:|---:|---|
| Case list | 2,002 | 5.413 ms | 3.491 ms | 1.6x | `cases_court_id_idx` |
| Case family | 5 | 40.546 ms | 0.166 ms | **244x** | `case_relationships_unique_edge`, `case_relationships_to_case_id_idx` |
| Case timeline | 29 | 40.158 ms | 0.120 ms | **335x** | `hearings_one_per_case_per_day`, `orders_case_id_order_date_idx` |
| Adjournment analysis | 18 | 290.305 ms | 290.031 ms | n/a | none (no index used) |
| Cause list | 1,001 | 44.181 ms | 52.303 ms | **0.84x** | `case_types_code_key`, `cases_court_id_idx` |

### 3.3 Cause list after migration 013

Rerun on a fresh 57,057-case branch with `hearings_hearing_date_idx` present.
The three index states ran back to back in one transaction, so they are
directly comparable.

| Index state | Median | Hearings rows read | Buffers read | Speedup vs. no indexes |
|---|---:|---:|---:|---:|
| No indexes | 66.288 ms | 527,527 (full scan) | 7,519 | 1.0x |
| Before 013 (court and case-type indexes) | 58.604 ms | 527,527 (full scan) | 6,370 | 1.13x |
| **After 013 (date index added)** | **5.624 ms** | **1,001** | **1,637** | **11.8x** |

Adding the date index made the cause list **10.4x faster** than the best plan
available before it (58.604 ms to 5.624 ms).

## 4. Findings

### Finding 1: The graph and timeline queries gain two orders of magnitude

The case family query walks the relationship graph one step at a time. Each
step looks up edges whose `from_case_id` or `to_case_id` matches the cases
found so far. Without indexes, every step scans all 28,028 relationships,
in both directions. With `case_relationships_unique_edge` (whose leading
column is `from_case_id`) and `case_relationships_to_case_id_idx`, each step is
a handful of index lookups. Case 1's family is five cases, so the indexed walk
touches only a few dozen rows: **40.5 ms becomes 0.17 ms (244x)**.

The timeline query retrieves one case's hearings and orders. Without indexes
it scans all 527,527 hearings and 47,047 orders to find Case 1's 29 entries.
With `hearings_one_per_case_per_day (case_id, hearing_date)` and
`orders_case_id_order_date_idx (case_id, order_date)`, it reads exactly those
entries, already in date order: **40.2 ms becomes 0.12 ms (335x)**.

Both are the cases indexes exist for: a highly selective lookup, where
the answer is a tiny fraction of the table.

### Finding 2: The case list gains only 1.6x, because its filter is not selective

The case list asks for one court's pending cases at one stage. The only
indexed column is `court_id`, and JMFC Court No. 3 holds 6,006 of the 57,057
cases, about 10.5%. The index narrows the search to those 6,006 rows, but they
are spread across 624 table pages, and the stage and status filters must then
be checked on each one. A full scan of 57,057 compact rows is almost as fast.
The result is a modest **1.6x**.

A composite index on `(court_id, status, stage)` would let the index answer
the whole filter. It is not added here, because the gain on a 5 ms query does
not justify the extra write cost on every case update.

### Finding 3: The adjournment analysis has nothing to drop

The adjournment analysis groups every adjourned hearing by court, case type
and reason. Adjourned hearings are about 42% of all hearings, and the query
needs all of them. Fetching 42% of a table through an index is slower than
reading the table once, so the planner correctly uses no index at either
scale. With nothing to drop, the "without" and "with" timings measure the
same plan (290.3 ms vs 290.0 ms). Queries like this are made faster by
summarising data in advance, for example with a materialized view, not by
indexing.

### Finding 4: The cause list regressed, and migration 013 fixed it

The cause list was the only query that did **not** speed up with its indexes.
In the first run it was slower with them: **44.2 ms without, 52.3 ms with
(0.84x)**.

**Diagnosis.** The plans in `explain_output.txt` (Part 1) show why. The
query filters hearings by date, and **no index covered `hearing_date`**.
The existing index `hearings_one_per_case_per_day` is on
`(case_id, hearing_date)`. Because `hearing_date` is its second column, it
cannot serve a lookup by date alone. So every plan, with or without indexes,
read all 527,527 hearings (*Parallel Seq Scan on hearings, Rows Removed by
Filter: 175,509* per worker). The court index changed only the join around
that scan. In the first run that join was slightly worse; in the rerun
(Section 3.3) it was slightly better (1.13x). Either way it was not the
bottleneck.

**Remedy.** Migration 013 adds `hearings_hearing_date_idx` on
`hearings(hearing_date)`. The plan now reads only the 1,001 hearings listed on
that date, through a bitmap index scan. Buffer reads drop from 6,370 to
1,637, and execution time from 58.6 ms to **5.6 ms (10.4x)**.

**Lesson.** The benchmark found a missing index that design review had not.
Every query had *some* index, and the cause list looked covered because
`hearing_date` appears in an index. The plan showed that index was unusable
for this query.

## 5. A bug in the benchmark, and how the transaction contained it

The first run of the benchmark at 57,057 cases failed with:

```
error: constraint "case_parties_case_id_fkey" of relation "cases" does not exist
```

**Cause.** To restore a dropped index correctly, the benchmark checks whether
the index belongs to a constraint, by looking up `pg_constraint` rows whose
`conindid` points at the index. That lookup was too broad. `conindid`
identifies the index a *primary-key or unique* constraint owns, but it is also
set on every *foreign key* that references that key. The case family plan used
`cases_pkey`, and several tables have foreign keys to `cases.id`. The lookup
returned one of those foreign keys, `case_parties_case_id_fkey`, and the
benchmark tried to drop it from the `cases` table, where it does not exist.

**Containment.** The failing statement ran inside the query's
`BEGIN … ROLLBACK` transaction. The error aborted the transaction, and the
`ROLLBACK` in the script's `finally` block undid everything that transaction
had done. To confirm this, the bug was reproduced against a fresh database
and the schema was fingerprinted before and after. The fingerprint was an
MD5 hash over every index definition, constraint definition and trigger state:

| | Fingerprint | Objects |
|---|---|---:|
| Before the failed run | `e4207b72304784d11964f2de98323274` | 158 |
| After the failed run | `e4207b72304784d11964f2de98323274` | 158 |

The schema was unchanged and no transaction was left open.

**Fix.** The lookup now matches only the constraint the index itself
implements: the same table (`conrelid = indrelid`), and a primary-key, unique
or exclusion constraint (`contype IN ('p', 'u', 'x')`).

**Lesson.** Running destructive experiment steps inside a transaction that is
always rolled back made a bug in the experiment harmless. Without it, a
partial run could have left the database missing an index or constraint. On
a shared database that would have distorted every later measurement, and
weakened data integrity.

## 6. Limitations

- **Cloned data repeats itself.** The 57,057-case dataset is 1,000 copies of
  the same 57 cases, so value distributions are unchanged and the cause list's
  date returns 1,001 identical hearings. Real data would be more varied, and
  selectivity, and so the speedups, would differ.
- **Run-to-run variance.** The cause list's "before 013" state measured 0.84x
  in one run and 1.13x in another, on different branch computes. Differences
  under about 1.2x should be read as noise. The 244x, 335x and 10.4x results
  are far outside that range.
- **The case list query has since changed.** After these measurements,
  `case_list.sql` gained optional filters, pagination and a total count
  (`count(*) OVER ()`) to serve the `/cases` page. The figures above are for
  the earlier version, which took all three filters and no page limit.
- **Execution time only.** Planning time and network latency are excluded by
  design. They are the same with and without indexes, and would dilute the
  comparison.

## 7. Reproducing

```sh
npm install
DATABASE_URL=<branch connection string> npm run benchmark -- --scale 1000
```

This prints the results table and writes every plan to
`db/tests/explain_output.txt`. Use a throwaway branch: `--scale` adds about
half a million rows, and the script refuses the production endpoint.
