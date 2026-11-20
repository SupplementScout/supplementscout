# Catalog Health PR560 controlled production release

**20 November 2026,17:16 UTC: SQL APPLIED / REPOSITORY CLOSED / CODE RELEASE PENDING.**
The owner renewed exact3e64e69b/09d941a2 release approval after the earlier STOP.
Fresh production269/f54057cd and staging120/31dc3e6e preflights passed, with one
production pending migration and the unchanged three staging pending migrations.
All parent/child control plans are terminal; no queued/dispatched/executing
Review Queue requests or materialized production writer runs were present.

Protected rehearsal PASS; independent rollback readback PASS. The first local
response comparison incorrectly required identical as_of timestamps. That native
assertion and its two timestamps remain in the evidence. The unchanged SQL
returns now(), so the corrected read-only audit validates a present, parseable,
nondecreasing as_of separately and still requires exact equality for all other
old page fields, every data hash, function metadata and non-reader definition.
The complete corrected independent readback passed before apply. No production
validator, timeout, SQL or application code was altered to obtain PASS.

Production selected apply committed exactly the approved migration. Independent
readback confirms270/ea11b69343c2100ecf38078a6920eb3b7478fc6ee4633bb65fc7657c39c2ae2a,
exact approved reader body, same OID/owner/ACL/STABLE/security invoker/search_path,
all213 other functions unchanged and equal full data hashes for19 tables.
Products1494, variants4228, mappings/offers4580 and price_history58013 are unchanged.
Queue cards/events, approvals, requests, publications, parent/child plans/apply
runs, approved imports and Durable registry data are unchanged as well.

[Actual applicator closeout receipt](evidence/PR560-CATALOG-HEALTH-PRODUCTION-270-CLOSEOUT-2026-11-20.json)
is retained byte-for-byte. Its three repository updates have been consumed:
production pending=[], ledger270 and the actual post fingerprint. The existing
derivation now returns ALREADY_CLOSED. Staging remains120/pending3 and excludes
the counter migration. Historical migrations and historical269 receipts remain
unchanged. Required tests update the current binding and freeze historical
bindings against their original receipts; no automation behavior is changed.

Production counters remain494 pending/9 source unavailable/0 blocked, dynamically
read and matching canonical queue projection and filtered totals for all14
retailers. Production SQL EXPLAIN ANALYZE median61.911ms before to51.329ms after
(seven samples each); identical9897 shared-hit blocks, zero shared-read blocks.
The isolated actual PostgreSQL suite passes4/4 with no skips;1k/5k/10k/20k old/new
medians are24.768/24.225,73.833/69.067,125.488/124.092 and237.819/234.804ms.
Focused closeout/application tests263/263, project/baseline/inventory PASS.
Local quick/full, TypeScript, ESLint and build PASS. Final CI, merge,
deployment, writer restoration and post-release
browser verification are still pending at this checkpoint. The browser before
release confirms actual HTTP200/rendered Unavailable; no repaired UI claim yet.

The preexisting watchdog run44705626833 already reports FAILED_SYSTEM with
REVIEW_QUEUE_WORKER_SCHEDULE_BROKEN. Worker schedule and thresholds are outside
this release and remain unchanged; no global automation-health PASS is claimed.

The27 originally active writer workflows remain temporarily disabled under the
approved maintenance controls. All other workflow states and all schedule
expressions/guards are unchanged. Restore only after exact new main/schema and
production deployment compatibility proof. No new publication or business write
is authorized. [Release receipts](evidence/CATALOG-HEALTH-REVIEW-COUNTS-RELEASE-2026-11-20.json).

## Historical STOP ? retained unchanged below

### Catalog Health PR560 controlled release — STOP before rehearsal

**20 November 2026, 16:24 UTC: BLOCKED / NOT RELEASED.** The owner approved
implementation3e64e69bdcd5b758e6de3891b9b996193edf587e and exactly one migration.
The production preflight could not complete. No protected rehearsal, SQL apply,
repository closeout, merge or deployment was performed. This record supplements
the [implementation history](CATALOG-HEALTH-REVIEW-COUNTS-IMPLEMENTATION-2026-11-20.md);
it does not overwrite earlier approval or test evidence.

[Structured STOP evidence](evidence/CATALOG-HEALTH-REVIEW-COUNTS-RELEASE-STOP-2026-11-20.json).

## Exact release boundary

* PR560 remains Draft at3e64e69bdcd5b758e6de3891b9b996193edf587e.
* Main remains81349995d2b29e249668071ef618794a634c256e.
* Migration20261120150000_add_catalog_health_review_counts.sql still has SHA-256
  09d941a26ac97791dde4e5690f97b7cc97ea16630297b1637aa02373c3695072.
* The actual unwrapTransaction accepts the unchanged file. SQL and application
  source were not edited. This STOP documentation is local and uncommitted;
  no additional PR revision or release was pushed.

## Why the release stopped

The independent PostgreSQL audit explicitly used a READ ONLY transaction with
verified TLS. It reached production reader metadata and data-snapshot reads,
but ended with `Query read timeout`; its last progress record was hashing
`public.offers`. A separate READ ONLY PostgreSQL diagnostic connection ended
with `timeout expired`. The complete baseline receipt was not generated.
No timeout, guard, SQL, credential, cache or workflow was changed to force PASS.

The audit was serial: staging would follow a completed production snapshot.
Therefore staging's current live state remains NOT_RUN. The partial production
read is insufficient to approve a migration. The last complete production
ledger receipt remains15:24:33 UTC,269/f54057cd49ea4422a3b8b849ac15ce38b518496a44a8d4dceb2f480f8f97eb66;
it is historical evidence, not a fresh release preflight.

These failures establish an incomplete preflight. They do not establish whether
the cause lies in connectivity, the database or the audit query. No new
production attempt or architectural workaround followed the STOP.

## Release results

| Required result | Status and evidence |
| --- | --- |
| Final main SHA | PASS:81349995d2b29e249668071ef618794a634c256e, unchanged at16:24 UTC |
| Protected rehearsal / rollback readback | NOT_RUN: incomplete initial preflight |
| Production SQL apply | NOT_RUN; zero migration commits |
| CURRENT270 / expected fingerprint | NOT_RUN; never set or claimed |
| Repository closeout | NOT_RUN; production repository contract remains269/f54057cd with exactly the approved migration PENDING |
| CI / Guardian / deployment | Approved code CI Full44762343249 and Guardian44762343082 SUCCESS; integration44762407486 attempt2 SUCCESS at the same SHA. No production deployment |
| Current three counts and retailer parity | NOT_RUN: no completed fresh SQL snapshot or post-release comparison. Earlier494/9/0 remains a historical reference |
| Actual Catalog Health response | Normal production admin login succeeded. Three authenticated HTTP200 responses reproduce Unavailable. No browser-rendered or repaired-page claim |
| Production performance | Before-release full response1491.90/1765.50/1882.30ms; median1765.50ms. New SQL and post-release page comparison NOT_RUN |
| Unauthorised business changes | Zero writes from this task; all database audits READ ONLY. No publication, approval, execution, mapping, price, stock or catalogue mutation |
| Workflow states | PASS: all38 recorded states still active and unchanged. No disable/enable calls; no restoration needed |
| Remaining blockers | Complete fresh production/staging preflight, safe writer window, rehearsal, apply, independent readback, receipt-based closeout, final CI, merge/deploy and live verification |

The before-release page was read through the normal login endpoint using the
existing admin credential; no session was forged and no account was created.
The apex domain redirects towww.supplementscout.co.uk. All three page responses
were200/MISS. The84 literal Unavailable occurrences include the server-rendered
cells and serialized React output; they are not84 separate counters. No browser
was launched. The approved implementation's isolated SQL and scale/performance
tests remain valid historical code evidence, not production release evidence.

## Workflow and data safety

Paginated Actions queries covered queued/requested/waiting/pending/in_progress.
At16:24 UTC only two old PR quality jobs were queued:43098583586 and43098583532,
both at3c2c14736b6b2fc6499ca5fefa5813196654d3a7. They are Quality Gate and Project
Guardian jobs without production-write authority. No materialized production
writer was listed. This cannot rule out delayed, unmaterialized scheduled runs.

The inventory identified27 potential writer workflows, including the existing
Review Queue worker and manual publication/execution paths. None was paused:
the release stopped before entering maintenance. Read-only monitors, schedule
expressions, migration guards, worker configuration, publishers and Durable
Artifacts were not changed. There is no closeout receipt because no migration
was committed. The pending migration and historical269 receipt remain intact.

No global LIVE VERIFIED claim is made. The panel remains on the old production
application. Resume requires a complete successful fresh preflight under the
owner's release procedure; this STOP must remain part of the history.
