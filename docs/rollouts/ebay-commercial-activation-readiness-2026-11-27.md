# eBay commercial activation readiness — Phase 18

Phase 19 release authority, 27 November: the owner separately authorizes this
code release through normal PR/CI/merge and the existing deployment path,
with version 1, additions [] and Exact-237 preserved. Release review fixes
one concrete boundary issue: legacy native review is limited to the five
exact after-bindings recorded in the September remediation, rather than any
legacy member. Unknown drift, changed tuples and new-member drift fail closed.
The existing `vercel.json` also disables Preview for this exact feature branch
before its first push, preserving all previous rules and main deployment.
Phase 18's 71 sealed artifacts and package fingerprints remain immutable.
Actual release and postflight receipts are retained separately under
`tmp/ebay-commercial-phase19-2026-11-27/`; no import authority is implied.

This is local preparation on main `1b3b408f10a4c13f643a420e4785c6888243ac50`.
It grants no release, production approval, import, membership activation or
workflow-dispatch authority. The active manifest remains version 1, with its
237 historical scopes unchanged. No public application, SQL migration,
dependency, workflow or production configuration is changed.

## Existing mechanisms and membership

`scripts/lib/ebay-membership.js` moves the existing rollout loader and its
readback/canonical overrides out of `ebay-offer-refresh.js`. Historical CSVs,
approvals and the full legacy scope SHA-256 stay frozen. The single active
configuration is `config/retailers/ebay-approved-membership.json`.

The existing refresh, pending-batch loader, artifact contract, eBay worker,
reconciliation, postflight, sealer and watchdog derive their scope from this
module. The existing publisher and shared executor remain generic; no second
approval, membership, import or execution system is introduced. The existing
scheduler already invokes these consumers and needs no workflow change.

New evidence carries membership version and fingerprint inside the existing
file/manifest integrity boundary. Legacy Exact-237 artifacts retain their
historical semantic fingerprints and can still be loaded. An old artifact
cannot authorize a future expanded membership.

Future additions require actual mapping/offer IDs from real import readback,
exact canonical and native identities, seller, source affiliate URL, retained
owner-artifact SHA-256 and import-readback SHA-256. A reviewed manifest is the
scope authority; hash fields do not constitute a production approval. Existing
SQL expected-state, protected approval and executor guards still apply. The
existing owner-reviewed continuity rules accept versioned per-member policy
data for future additions, bound into the membership fingerprint. They never
authorize identity corrections or new GTIN claims.

Five existing native-ID differences (offers 2637, 2638, 2681, 2708 and 2770)
come from the reviewed remediation migration of 5 September 2026, before
Phase 17. Their canonical, mapping and offer identities remain unchanged.
The baseline may capture those historical native differences; execution and
postflight require them to remain exclusively in review. This compatibility
rule cannot admit native drift for a newly imported member. No historical
listing is rebound or silently promoted into executable maintenance.

## Qualification evidence

The Phase 18 evidence directory is
`tmp/ebay-commercial-phase18-2026-11-27/` in the original repository root.
Historical artifacts are retained separately and never overwritten.

- All 86 immutable packages loaded with their original SHA-256 and plan/source
  fingerprints. All 89 commercial decisions and 170 cases remain unchanged.
- Protected production READ ONLY snapshots found all 86 current variants,
  no existing eBay mapping for them, and no collision with Exact-237.
- The existing v4 builder prepared all 86 current plans. Both preserved-source
  and fresh-source plans passed the existing protected read-only validator.
  This is not proof of a protected production approval or apply.
- Fresh Browse reads covered 44 already approved listings and all 86 native
  identities. Seller, returned GTIN and selected item metadata are unchanged;
  the only title difference is trailing whitespace on 1476/4654.
- All 86 are currently in stock with known GBP delivery and source-returned
  affiliate URLs bound to the configured campaign and exact variation.
  Four have no returned GTIN; canonical GTINs are preserved independently.
- The API ledger contains 48 attempts: 44 Browse reads, one quota read, one
  successful OAuth request and two failed OAuth TLS handshakes. System CA
  trust resolved the local certificate-chain issue without disabling TLS.
  No listing read was retried. The 86-attempt cap leaves 38 unused attempts.
- Using fresh, available exact canonical comparables with known shipping,
  eBay is cheaper in 25 cases, dearer in 17, equal in zero, and lacks a full
  current comparison in 44. None is removed merely for its price position.
- Source URL to normalized offer, v4 offer URL and existing outbound/tracking
  code were checked with 86 in-memory adapters. No real click, purchase or
  EPN traffic was generated. Purchase attribution remains unobserved.

The source capture and current catalogue snapshot are bounded observations,
not permanent readiness. Final protected GTIN/quarantine checks must use the
existing authorized path immediately before a separately authorized approval.
The validator cannot directly read the migration schema or private quarantine;
no role privilege was expanded and no private quarantine rows were exported.

## Verification and retained production evidence

The new regressions cover frozen Exact-237, duplicate/unresolved identities,
wrong membership versions, exact affiliate/native/seller binding, reviewed
continuity and legacy review isolation. Synthetic memberships of 323 and 240
also traverse the existing refresh, immutable artifact loader, database
before-state contract, postflight and sealer with network calls and real DB
writes disabled. The test inventory is resealed at 373 files; the new test
file is included in quick and full gates. Final gate receipts, logs, patch
and integrity manifest belong to the Phase 18 evidence directory.

Phase 17's 4170 PASS / 3 historical SKIP is retained evidence, not a new run.
The current production readback remains 273 migrations with fingerprint
`9ca37b4d56ca2815b01eb48bd4d01c37db9e06b46d4cb0c0cec2fa90673bd25b`.
Repository Closeout is already closed. No staging change was made.

Natural Jon's run 46015672496 used final main, executed its ordinary 488-row
maintenance partition and passed the 506-row postflight. Its execution
receipts bind the fingerprint above. Its 20 stock changes and 485 daily
confirmation observations are natural automation activity, not Phase 18
agent writes. Natural Simply Supplements run 46020175278 also passed on final
main: 120-row scope, 117 executed, three review, the same migration fingerprint
in all six execution receipts, one stock change and no price-history delta.
Other retailers retain their Phase 17 read-only evidence while
awaiting a new natural run. The previously observed GYM HIGH Store API outage
is separate; no repair or dispatch is performed here.

## Future release and import sequence — separate authority required

1. Obtain owner authority for the exact automation patch and a normal reviewed
   PR/CI/release. Release with membership version 1 and unchanged Exact-237.
2. Select the actually qualified first cohort. If using a small canary, use
   the same importer/executor and a smaller membership version; no new batch
   executor is needed. Do not include the additional 16 undecided cases.
3. Re-read the selected exact listings and current canonical/peer/offer state
   just in time. Check seller, physical unit/flavour, GTIN/foreign claims,
   shipping, stock, price and source-returned EPN URL. Rebuild exact v4 plans.
   Invoke the existing protected GTIN/quarantine and concurrency preflight.
   Never reuse an expired source observation or a historical approval.
4. Obtain separate, exact protected technical approvals and apply authority.
   Import only that sealed cohort through the existing shared executor.
5. Read back actual mapping and offer IDs and all canonical/native/affiliate
   fields. Compare against the approved plan and retain the readback digest.
   Unresolved IDs remain null in the Phase 18 proposal; synthetic IDs are
   confined to local tests and are never production membership values.
6. Review and release the next manifest version containing precisely those
   successful readbacks. Before importing, reserve a release window that can
   activate and verify maintenance inside the existing 24-hour freshness
   window. Do not import if that maintenance handoff cannot be completed.
7. Observe the authorized existing refresh, Review Queue and postflight, with
   affiliate URL preservation and exact partition evidence. Keep unavailable
   or changed members in the existing review path; do not prune membership.
8. Stop further imports for any source/canonical/GTIN/campaign mismatch,
   protected-preflight failure, new Phase 17 regression, wrong migration
   fingerprint, membership/version mismatch, or failed maintenance handoff.
   Preserve existing safe maintenance and evidence. Any post-import repair
   or rollback must use the existing guarded path under separate authority;
   never delete/rebind offers or abandon imported members automatically.

The 16 additional cases, CNP 407/386, blocked Strom/Vanilla Cream and ABE
claims, 52 HOLD, three DEFERRED and 14 GTIN-without-promotion cases retain
their recorded status. Predators Gear and existing automations remain untouched.
