# Catalog Health review counters — SQL design approval

**Status: NEEDS_OWNER_APPROVAL / implementation STOP.** This Draft contains a
read-only diagnosis and a tested SELECT-only design, not an implemented fix.
Production still displays Unavailable. No application code, historical migration,
new migration, schema, production data or automation runtime has been changed.

The owner requested stopping for separate approval if a correct bounded solution
needs new SQL aggregation. The smallest design extends the existing SQL reader,
without adding a differently named function. It still requires a migration and a
changed production SQL definition; this proposal treats that as the SQL approval
boundary in requirement 9 rather than silently widening the repair to SQL work.

## Confirmed current state

Main and Production are `81349995d2b29e249668071ef618794a634c256e`, CURRENT269.
PR558 is already released and is not reopened. The private READ ONLY audit at
14:34:48 UTC on 20 November reproduced the actual PostgREST request successfully:
7082 eligible rows, exactly 1000 returned, no database/API error. The unchanged
`loadAutomationReviewCounts()` returns null because `count > 1000`; page.tsx passes
null and components.tsx displays Unavailable for every retailer. Other Catalog
Health queries are independent, explaining why the rest of the page works.

The deployed `read_automation_review_queue_page_v1(jsonb)` body exactly matches its
checked-in migration. Its summary exposes decide/execute/processing/technical/
completed totals, not the three required counts or retailer IDs. A bounded page
does not contain enough information to reconstruct those missing aggregates.
For example, Source Unavailable is only a subset of technical work; technical
also includes identity and other review-only cards and execution evidence drift.
Mapping technical to blocked, or decide to all pending, would change meanings.

There is no existing public view over the queue. The other stable functions are
an exact legacy Fit baseline, verified stock transitions and owner-decision
validation; none is a general current-queue counter reader. A real PostgREST
aggregate probe returns PGRST123, "Use of aggregate functions is not allowed".
Enabling aggregates or building per-retailer raw count queries is not proposed.
Raw table predicates also miss the main queue's latest-per-offer and latest
execution projection. Scanning all pages or making 3 requests per retailer is
not a bounded, shared solution to this incident.

## Exact minimal design for separate implementation approval

1. Add one forward-only migration replacing the definition of the **existing**
   reader, preserving its name, JSON request, schema_version, security invoker,
   STABLE declaration, role check, ACL, search_path and existing page output.
   Do not edit `20261119150000_read_automation_review_queue_page.sql`.
2. Replace only its `retailer_summary` CTE with the following additive projection.
   Existing `current_summary` supplies the same latest-per-offer, non-superseded,
   non-autonomous records and derived lifecycle as the main queue.

```sql
retailer_summary as (
  select retailer_id, retailer,
    count(*) filter(where work_bucket='DECIDE') decide,
    count(*) filter(where work_bucket='EXECUTE') execute,
    count(*) filter(where work_bucket='PROCESSING') processing,
    count(*) filter(where work_bucket='TECHNICAL') technical,
    count(*) filter(where work_bucket='COMPLETED') completed,
    count(*) total,
    count(*) filter(where lifecycle='PENDING') pending,
    count(*) filter(where lifecycle='PENDING'
      and review_kind='SOURCE_FAILURE') source_unavailable,
    count(*) filter(where lifecycle='FAILED') blocked
  from current_summary
  group by retailer_id, retailer
)
```

3. Existing JSON serialization of `retailer_summary` automatically carries the
   additive fields. No second query, function, view, table, index or cache is
   needed. No publishing, execution or permission contract changes.
4. Change only `automationReviewHealth.ts` to call the existing
   `loadReviewQueuePage()` once, with history=false, scope=DECISIONS, status=ALL,
   bucket=ALL and display=WORK. This reuses the canonical request/capability
   builder and its bounded 10-card page. Map the small retailer summary to the
   existing pending/blocked/sourceUnavailable output; never walk the pages.
   Add or narrow the TypeScript summary shape as needed, without changing the
   main queue's filters or client-side summary calculations.
5. Validate unique numeric retailer IDs and present nonnegative safe integer
   counts, source_unavailable <= pending, pending + blocked <= total, and
   complete summary totals. RPC errors, missing additive fields, revision drift
   or malformed summaries return null, never an invented zero. Only a validated
   complete response permits zero for a retailer with no queue records.
6. Page and dashboard labels/links stay unchanged. No changes to other Catalog
   Health queries or publication, approvals, executor, cron, watchdog, catalogue,
   PR559 or Durable Artifacts.

Pending means the current derived PENDING lifecycle, including REVIEW_ONLY
cards, not just executable DECIDE work. Source Unavailable preserves the existing
SOURCE_FAILURE subset of pending. It does not silently relabel every
SOURCE_MISSING identity card. Blocked preserves FAILED lifecycle; it does not
mean all TECHNICAL work. Expired/superseded/older duplicate cards and pending
rows already in processing are excluded as in the main reader.

## Production counts before and projected after

Before: every cell is Unavailable. The following are **READ ONLY computed
expectations**, not deployed dashboard results. The main reader's own filtered
totals independently match 491 pending, 9 source unavailable and 0 failed.

| Retailer | Pending | Source Unavailable | Blocked |
| --- | ---: | ---: | ---: |
| GYM HIGH | 1 | 0 | 0 |
| Whey Okay | 10 | 0 | 0 |
| Discount Supplements | 3 | 0 | 0 |
| Dolphin Fitness | 0 | 0 | 0 |
| Simply Supplements | 0 | 0 | 0 |
| KIOR Health | 0 | 0 | 0 |
| Fit House | 38 | 0 | 0 |
| Jon's Supplements | 15 | 0 | 0 |
| 6 Pack Supplements | 223 | 0 | 0 |
| eBay UK | 72 | 9 | 0 |
| Predators Gear | 0 | 0 | 0 |
| 10 Reps | 0 | 0 | 0 |
| Gladiator Nutrition | 0 | 0 | 0 |
| Holland & Barrett | 129 | 0 | 0 |

Naive raw-status counts would instead include old expired work: for example,
Whey pending292 versus current10 and 10 Reps pending145 versus current0. Raw
FAILED2 versus current0 is also independently confirmed by the canonical reader.
The zero values above therefore mean a successful current projection, not an
unavailable request replaced with zero.

## Local design validation and remaining implementation tests

The disposable PostgreSQL17 fixture reuses the existing integration test schema
and existing reader migration. The proposed change was executed only as a raw
SELECT; no new aggregation function or proposed migration was installed.
Status cases PASS: expired PENDING/APPROVED, superseded rows, older unsuperseded
duplicates, latest QUEUED execution, EVIDENCE_CHANGED, autonomous exclusion,
SOURCE_FAILURE versus SOURCE_MISSING identity, and current FAILED. Expected
fixture counts4/1/1 match the original reader's filtered totals. Existing page
rows and pre-existing global summary fields remain equal.

Three EXPLAIN ANALYZE samples per shape, warmed local execution medians:

| Queue rows | Existing projection | Proposed projection | Client page |
| ---: | ---: | ---: | ---: |
| 1000 | 14.200 ms | 14.428 ms | 10 |
| 5000 | 63.855 ms | 63.833 ms | 10 |
| 10000 | 120.792 ms | 126.229 ms | 10 |
| 20000 | 240.752 ms | 238.085 ms | 10 |

Each uses one request and one small retailer summary, with response about10 KB
at all four sizes. These are isolated PostgreSQL design measurements, not a live
page load SLO or a deployed fix. No production scale fixtures were inserted.
The actual 7082-row API response plus unchanged loader reproduces the incident.

After SQL-design approval, add the fix regression to existing catalog-health
tests (1001+ queue total, one RPC, no raw scan), null-on-error/malformed/missing
fields and valid empty-queue cases. Extend the existing pagination integration
test with the counter/scale fixtures and future migration. No new test file is
needed; verify and retain the sealed inventory. Those runtime fix regressions
are **NOT_IMPLEMENTED** because the SQL implementation is stopped.

Project/baseline/quick/full checks validate the unchanged application baseline
and documentation, not an implemented runtime repair. Exact receipts are in the
[evidence](evidence/CATALOG-HEALTH-REVIEW-COUNTS-2026-11-20.json).

## Release boundary

No migration is registered or pending in this proposal; CURRENT269/PENDING[]
remains unchanged. A later approved implementation needs one new migration,
its exact hash, migration-selector registration and the existing controlled
269-to270 repository closeout. SQL must precede the dependent application,
preserving all retailer migration-fingerprint guards during that cutover. The
old application ignores additive summary fields. New application code must
fail closed on the old SQL response. Never write a fictitious ledger or weaken
guards to obtain compatibility.

This Draft asks only for approval to implement that minimal existing-reader
extension and loader repair. It grants no production apply, merge or deployment.
