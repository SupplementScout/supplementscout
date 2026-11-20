# Catalog Health review counters — implementation and release boundary

**Status: CODE COMPLETE / NEEDS_OWNER_APPROVAL.** The owner approved implementation
of design4348460a on the existing Draft PR560. This revision adds one pending
migration and repairs the existing loader. Production SQL apply, protected
production rehearsal, merge and production deployment remain NOT_RUN.

The [approved design and earlier STOP](CATALOG-HEALTH-REVIEW-COUNTS-2026-11-20.md)
and its evidence remain historical records. Current implementation receipts are
in [implementation evidence](evidence/CATALOG-HEALTH-REVIEW-COUNTS-IMPLEMENTATION-2026-11-20.json).

## Exact change

* `automationReviewHealth.ts` makes one call to existing `loadReviewQueuePage`,
  with page1, WORK display, history=false, scope=DECISIONS and ALL status/bucket.
  The response contains at most10 incidental cards and the retailer summary;
  the loader maps only the summary. No raw queue query or history pagination.
* The new migration copies the existing reader definition and changes only
  `retailer_summary`: adds retailer_id/pending/source_unavailable/blocked and
  groups by retailer_id plus the existing retailer name. All existing CTEs,
  fields, lifecycle rules and request/response versions are preserved.
* Name/signature, STABLE, security invoker, search_path and service-role check
  are unchanged. CREATE OR REPLACE preserves the existing owner and ACL;
  migration adds no GRANT/REVOKE, table, view, index, endpoint or second function.
* Counter validation rejects missing or malformed metadata, duplicate IDs,
  unsafe/negative/fractional numbers and inconsistent bucket/summary totals.
  It checks source_unavailable <= pending and the possible PENDING/FAILED work
  partition. RPC errors, malformed pages, old SQL fields and exceptions return
  null. Only a complete successful empty response produces the genuine empty
  count map. Existing dashboard rendering distinguishes null from zero.
* Pending includes current REVIEW_ONLY cards. Source Unavailable remains the
  SOURCE_FAILURE subset of current PENDING. Blocked remains derived FAILED,
  not every TECHNICAL card. Expired, superseded, older duplicate, processing
  and changed-execution-evidence cases follow the canonical reader.
* Existing test files cover the repair; the371-file sealed inventory is intact.
  The historical269 receipt test now explicitly freezes its original file
  inventory and pending=[] contract, preserving its assertions while a later
  proposal is pending. Applicator/runtime guards were not modified.

Historical `20261119150000_read_automation_review_queue_page.sql` is unchanged:
`062865129b774e8ff79631b241ee43a44a8a5b334640a91c7e51a5953eb187aa`.

## One pending migration

Filename: `20261120150000_add_catalog_health_review_counts.sql`.

SHA-256 using the existing LF-normalized ledger process:
`09d941a26ac97791dde4e5690f97b7cc97ea16630297b1637aa02373c3695072`.

BEGIN is the first instruction and COMMIT the last. The actual
`unwrapTransaction()` accepts the real file. Production has exactly this one
PENDING migration. Staging excludes it because its prerequisite reader remains
pending; staging120 and its three pending migrations are unchanged. Production
CURRENT269 and its ordinary fingerprint remain
`f54057cd49ea4422a3b8b849ac15ce38b518496a44a8d4dceb2f480f8f97eb66`.

`derivePostApplyMigrationBinding('PRODUCTION')` derives a prospective269-to270
transition and post-fingerprint
`ea11b69343c2100ecf38078a6920eb3b7478fc6ee4633bb65fc7657c39c2ae2a`.
This is a tool-derived release projection, not an applied ledger or replacement
CURRENT270 contract. No production row or current binding has been advanced.

## Actual data and compatibility evidence

READ ONLY15:08:52 UTC confirms production269 and the original reader body. The
queue now has7086 eligible records, versus7082 during design. Current counters
computed from the canonical projection are494 pending/9 source unavailable/0
blocked; all three independently match the main reader's filtered totals.
The change is dynamic: eBay pending is now75 rather than the earlier72. The
remaining retailer values are in the evidence; no reference count is hardcoded.

Production still uses the old SQL, so the live Catalog Health page is not
reported repaired. The new loader was exercised READ ONLY against that old SQL
and returned null, not false zero. Old application reader plus new SQL passes
on isolated PostgreSQL. Existing page rows, revision and all prior global and
per-retailer fields compare equal before/after, after removing only the four
new additive fields for the compatibility comparison.

## Verification

* Existing application/selector/applicator tests:170 PASS, zero failures/skips.
* Actual isolated PostgreSQL17 suite:4 PASS, zero failures/skips. It applies the
  unchanged historical reader first, rehearses the new unwrapped body under a
  transaction and rolls back, then executes the real new BEGIN/COMMIT file.
  Rollback restores the function; commit preserves OID, owner, signature,
  volatility, security settings, ACL and queue data. Anonymous/authenticated
  calls remain denied. No production data or credentials enter these fixtures.
* SQL cases cover all14 retailer IDs, empty queues, expiry, supersession, an
  older unsuperseded duplicate, latest QUEUED execution, EVIDENCE_CHANGED,
  autonomous exclusion, SOURCE_FAILURE versus SOURCE_MISSING identity,
  current FAILED, history and canonical filtered-count parity.
* Real SQL responses exercise both the unchanged page loader and repaired
  health loader. New app/old nonempty SQL fails closed; old app/new SQL works.
* Unit regressions cover99/1000/1001/5000/10000/20000 rows, one RPC, no raw scan,
  every retailer, genuine zero, errors, missing/partial data and invalid counts.
* Project/baseline/inventory/quick/full, TypeScript, ESLint and build receipts
  are recorded in the implementation evidence. These are final implementation
  checks, separate from the earlier design-only baseline run.

Real old/new SQL functions, three local EXPLAIN ANALYZE samples each. Both read
the same synthetic fixture, return10 page rows and14 summary records:

| Queue records | Old median | New median |
| ---: | ---: | ---: |
| 1000 | 34.139 ms | 33.620 ms |
| 5000 | 86.567 ms | 93.036 ms |
| 10000 | 168.344 ms | 182.452 ms |
| 20000 | 323.813 ms | 320.563 ms |

The largest observed median increase is8.4% in this concurrent local run;20k
is slightly faster. There is no additional request or history-sized response.
The integration regression fails above25% plus5ms, rather than relaxing a
production guard to make a benchmark pass. Exact samples are retained; these
local timings are not a production latency guarantee.

## Controlled release plan — requires separate owner approval

1. Recheck exact PR SHA, main, CI and integration CI; independently confirm269,
   its fingerprint, original function/catalog/ACL, expected single pending hash
   and absence of conflicting control plans. Revalidate source/queue counter
   expectations from current production data; the historical494 is not a seal.
2. Establish a quiet cutover using existing owner controls. Inspect every
   materialized writer in in_progress/queued/waiting/pending/requested states,
   including SHA and job context. Drain old writers and use existing write
   serialization where applicable; no new scheduler/lock or disabled guards.
   GitHub's not-yet-materialized delayed cron events are not observable. A later
   old-SHA delivery must be inspected, not declared absent based on idle jobs.
   If existing controls cannot provide a safe window, STOP before SQL.
3. Run the existing protected selected-migration preflight and rehearsal for
   exactly this file/hash, with no apply confirmation. Require independent
   rollback readback PASS, function/ACL unchanged and no catalogue/queue writes.
   This protected production rehearsal has not been run in the current task.
4. Only after separate explicit production approval, use the existing selected
   applicator for this single migration; never blanket db push. Independently
   read back the real270 ledger, derived fingerprint, exact new body/ACL and
   unchanged business data. Any mismatch or extra pending migration means STOP.
5. Generate the existing repository-closeout receipt from the actual committed
   ledger. Only then consume the pending entry and update current bindings and
   their historical tests as directed by that receipt. Rerun gates/CI. Do not
   handwrite a fictitious270 state or treat this pre-apply Draft as closed.
6. Merge/deploy the coherent closeout revision only within the owner-approved
   release scope/window, after SQL readback. The additive SQL supports the old
   application. The new application requires the new aggregates for valid
   counts. Old269 automation must not write during the270 cutover; retain all
   fingerprint guards and inspect delayed pinned runs after migration/deploy.
   On incompatible/stale writer evidence, STOP rather than bypass or rerun apply.
7. Read back the live page and canonical queue on the deployed SHA: all retailer
   counters, genuine zeros, expired/superseded/history behavior, error display,
   query count and latency. Check real ordinary automation evidence without
   dispatching unapproved business writes. Record PASS/BLOCKED/NOT_RUN honestly.

Before release, production is unchanged and no data rollback is needed. After a
future additive SQL apply, application rollback can retain the additive reader;
do not delete history or roll the ledger back. Restoring the old reader would
make the new loader Unavailable and requires another separately reviewed SQL
decision. No additional migration or automatic rollback is authorized here.

Remaining blockers are the separate exact release approval, protected production
rehearsal/apply/readback/closeout, and genuine deployed-page verification. There
is no new publisher, approval path, executor, cache or retailer exception.
