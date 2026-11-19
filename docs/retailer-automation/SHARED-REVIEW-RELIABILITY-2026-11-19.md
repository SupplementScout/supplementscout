# Shared retailer and Review Queue repair — 19 November 2026

Status: implementation prepared for owner review; NOT DEPLOYED. The companion
[evidence record](evidence/SHARED-REVIEW-RELIABILITY-2026-11-19.json) records test
results separately from production verification. This task does not reopen
RA-001, RA-004, nutrition, discovery or the deferred GYM HIGH public hub.

Final local gates: Project Guardian, baseline, Quick and Full PASS; Full runs
4098 safe tests plus TypeScript, ESLint and the isolated production build.
The complete 58-file Docker gate passes198 tests with zero failures/skips.
Draft [PR556](https://github.com/SupplementScout/supplementscout/pull/556) holds
the exact branch and current CI readback. These results do not authorize release.

## Findings and implementation

The existing path remains:

source adapter → normalization → canonical identity → shared classification and
quarantine → immutable execution artifact → native READ ONLY validator → existing
approval → atomic apply → DB postflight → fresh-capture idempotency → watchdog.
The existing review source binding and reconciliation publisher consume the
pre-execution partition. Publication has its own job and can proceed from valid
sealed evidence even when an independent execution batch subsequently fails.

* GYM HIGH run [44528441465](https://github.com/SupplementScout/supplementscout/actions/runs/44528441465)
  produced 61 plans and four `unit-count conflict` blocks after the 14 November
  guard change. The exact canonical parent independently records the capsule
  count, while its approved variant records servings. The shared guard now
  checks those separate facts against the exact parent/variant binding. It
  never derives capsules from servings. Wrong counts, formats, servings and
  multipacks remain blocked. The converter uses the existing partition helper
  to account for every approved offer, including local importer identity reviews.
* Discount run [44341714238](https://github.com/SupplementScout/supplementscout/actions/runs/44341714238)
  failed the standard atomic SQL Default invariant for offer 762. The shared
  state assessment now recognizes Default-with-explicit-sibling conflicts
  before planning, including freshness-only rows. Current canonical state has
  three such offers: 762, 2537 and 2538. The earlier 108-row exclusion replay
  missed the latter two latent conflicts because their prices had not changed.
  Unrecognized SQL failures remain fatal. Diagnostics retain SQLSTATE, batch
  offer IDs, a safe error fingerprint and the allowlisted Default message.
* The admin panel's old complete-read contract fails at 6694 eligible historical
  rows against its 5000 bound. The publisher itself is still active: shared run
  44508522817 created 145 10 Reps cards and refreshed 38 Fit House cards. GYM HIGH
  and Discount lacked publication integration. Their new profiles use the
  existing action, source binding, sealed registration and reconciliation RPC.
  Identity cards remain manual and cannot grant catalogue execution authority.

The admin now requests one 10/50-row page. SQL filters, ranks current records,
joins only each selected review's latest execution, counts and sorts in one
statement snapshot. A revision binds subsequent pages to queue/execution state
and capability presentation. Concurrent changes fail closed and require a fresh
view. History stays available; nothing is deleted and no row limit is raised.
Existing decision/execute routes still revalidate status and fingerprints.

## Measured evidence and limits

* Archived GYM HIGH capture of 19 November plus current canonical READ ONLY data:
  66 approved = 65 freshness plans + one existing source-identity review, zero
  importer blocks. Shared publication capture validation also passes against a
  freshly read 66-offer DB baseline. All 65 also pass the existing native atomic
  READ ONLY SQL validator at 15:13:10Z. Executed offers: **0**.
* Archived Discount capture of 18 November plus current DB: 109 approved = 106
  executable + three reviews. All six batches pass the existing native production
  READ ONLY validator. This is an archived-source diagnostic replay, not a
  newly captured store feed or permission to execute. Fresh Shopify requests
  returned HTTP 429. The historical diagnostic uses a reconstructed source time
  and is not execution evidence. A later real standard full capture succeeded
  at 15:16:29.931Z: 343 products / 999 variants, fingerprint
  `30f563aa986ec64c6c6670da492816542da6de5ce1d003b808c0601039f9e2da`.
  Its local immutable replay against current DB passes all six native READ ONLY
  SQL batches at 15:18:59Z: 90 freshness plans, 16 stock plans and the same three
  reviews. No second confirmation capture is synthesized. The next live request
  returned 429 again, so protected release still requires a new successful
  preflight. The other 47 offers remain outside automatic scope.
* Isolated PostgreSQL tests cover 5000, 6694, 10000 and 20000 rows, filters,
  current/history counters, latest execution, fingerprint mismatch, supersession,
  concurrent publication, capability drift, role denial and invalid requests.
  The final exact 20k projection EXPLAIN ANALYZE took about 495 ms locally;
  this is a development measurement, not a production latency guarantee.
* Production READ ONLY owner audit at 15:01:45Z confirms ledger CURRENT268,
  fingerprint `4da87e64288e023969f69149f28e31090c8bccd840ee668d63b0dab35b38482a`,
  latest `20261117212000_register_holland_barrett_existing_offer_sync`, and no
  active PLANNED/APPROVED/PARTIALLY_APPLIED/FAILED plans for retailers 1 or 4.
  Existing indexes were inspected. The current-ranking query's production
  EXPLAIN ANALYZE took 9.343 ms. The new function/index were not applied there.

No production business/control/queue writes, approvals, applies or migrations
were performed by this task. Production postflight, idempotency, queue
publication and watchdog verification remain NOT_RUN for the new code.

## Exact additive migration and release order

`supabase/migrations/20261119150000_read_automation_review_queue_page.sql`
has normalized SHA-256
`76dfc9989d6c24a8b3905a1bc41e09759ccbdcd7c97809e3dd2999b2cf70adb8`.
It adds one current-page index and one STABLE SECURITY INVOKER function, callable
only by service_role. Its function body reads existing tables and writes none.
It is registered as pending through `environment-migrations`; no old SQL changes.
Current business migration bindings remain CURRENT268 until actual activation.

After explicit owner release approval, use the existing selected-migration
workflow in this order. Never run a blanket `supabase db push`.

1. Pin the reviewed commit, successful Full/Integration CI and this migration
   hash. Repeat the owner READ ONLY ledger/index/control-plan preflight. Stop on
   any drift; do not repair a ledger or supersede a control plan automatically.
2. Use `apply-selected-migrations.js --environment=PRODUCTION
   --project-ref=aftboxmrdgyhizicfsfu --mode=rehearse` with the existing protected
   owner credential. It must select exactly this one pending migration and
   produce the unchanged catalogue-count/rollback proof. An isolated PostgreSQL
   rehearsal does not replace this protected applicator check.
3. Only with owner approval, run the same applicator in `--mode=apply` using
   `--confirm=adaa4f9df7b89a21`. Expected ledger transition: 268 → 269;
   post fingerprint
   `f54057cd49ea4422a3b8b849ac15ce38b518496a44a8d4dceb2f480f8f97eb66`.
   Use its generated repository closeout to advance the current binding and
   consume pending only after exact committed readback. Do not claim 269 here.
   Staging has two older pending migrations as well; its three-item selection
   is a separate scope and is not authorized by this production release request.
4. Recheck all shared producer migration bindings against the actual post-state,
   then merge/deploy the reviewed application and workflows. SQL must precede
   the new admin RPC caller. Preserve all existing protected environments,
   credentials, owner guards, schedules, concurrency and sealed enforcement flag.
5. Capture fresh sources and run the existing native READ ONLY preflights.
   Discount HTTP 429, incomplete capture, global guard or unexpected SQL error
   means STOP. Never relabel the archived replay as a fresh execution artifact.
6. Through the existing protected workflows, verify exact executable/review
   partitions, then authorized apply, DB postflight and a fresh-capture idempotency
   pass with the same partition and no commercial delta. Reconcile/publicize
   review evidence through the shared action; repeat publication to prove no
   duplicate active cards, and prove supersession on changed evidence. Check
   expiry/rejection, stale fingerprint denial and unchanged business counts.
7. Read back owner-visible current/history pages and counters, then the existing
   watchdog at the exact deployed commit. Do not widen backlog limits to make
   its known identity backlog green. Record actual run/artifact IDs and all
   0/nonzero deltas before marking this task LIVE VERIFIED.

Rollback: revert the application/workflow commit through the existing release
path. Leave the additive read function/index and truthful migration ledger in
place; the old caller can ignore them. The old full-history UI will retain its
known 5000-row defect, so rollback restores prior behavior, not a healthy queue.
Do not delete cards/history, reverse prices, rewrite old SQL or reset approvals.
Any later SQL correction is another reviewed forward-only migration.

## Offer 762 correction packet — held for owner identity decision

Current approved tuple: retailer 4, mapping 948, offer 762, canonical product 407,
variant 386 Default. Candidate: existing active variant 2015, Unflavoured / 250g.
Shopify product `6788065329348`, variant `54879874810234`, SKU `CNP-0508`, recorded
options Size=250g / Flavour=Unflavoured, GTIN absent. URL:
`https://www.discount-supplements.co.uk/products/cnp-pro-creatine-250g?variant=54879874810234`.
Stored commerce is £12.99 + £4.99 = £17.98, in stock. The real full source capture
at 15:16:29.931Z independently confirms title CNP Creatine Monohydrate 250g,
variant title 250g / Unflavoured, the same Shopify IDs and SKU, price £9.99 and
availability true. The 14:59:21Z readback finds one historical price row 764,
linked through `offer_id=762`; its identity_series_id is null.

The existing generic reviewed-create packages do not authorize rebind to an
already existing variant. The applicable established path is an exact
owner-reviewed mapping-correction migration through the selected applicator,
as used by `20260810260000_rebind_two_reviewed_fit_house_variants.sql`.
It must bind a new fresh source, the exact before tuple and owner-selected
target, lock/check the affected scope, reject active control plans/collisions,
update mapping and offer identity together, and update the frozen approved
manifest plus its registration hash. Preserve offer/mapping IDs, commercial
fields and the complete history digest/count/FK associations. READ ONLY
postflight must prove only the intended two identity references changed.

That correction is **not executable or approved** now: target 2015 is a candidate,
not an agent identity decision, and a new successful live preflight is required
at execution time because retrieval is intermittent. Offers 2537/2538
need their own evidence and exact owner decisions. The prepared shared repair
can restore independent updates while keeping all three in review. No runtime
product/retailer exception or automatic Default replacement is introduced.

Owner decision requested at handoff: authorize the reviewed code release and
the one exact additive queue-read migration above, followed by protected
verification. Identity corrections remain outside that approval.
