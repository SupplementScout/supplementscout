# SEO-15 producer continuity follow-up — 9 September 2026

Read-only investigation complete. Stage 3 remains BLOCKED. No production writes,
backfill, producer enablement or identity changes were performed.

Production at **10:31:11 UTC** confirms 813 series, 8,173 linked observations and
4,053 excluded legacy rows. September 9 has 260 Fit House and 502 Jon's
observations; GYM HIGH remains on September 8. These counts include the previously
documented quarantined rows and do not imply publication eligibility.

## Historical gaps

Each missing whole date has a failed scheduled Actions run:

| Retailer / date | Run | Recorded failure |
|---|---|---|
| Fit House Aug 30 | 33301837700 | `RSBI_EXPECTED_DELTA_MISMATCH` |
| Fit House Aug 31 | 33375075028 | `RSBI_REPLAY_BLOCKED`: equivalent control plan active |
| Fit House Sep 1 | 33484720317 | Same replay block |
| Fit House Sep 2 | 33602964059 | Same replay block |
| Jon's Aug 28 | 33192345923 | Dry-run `RSBI_SOURCE_HASH_MISMATCH` |
| Jon's Sep 1 | 33493099424 | Unreviewed mapped variants absent from source |
| Jon's Sep 2 | 33612184737 | Same missing-variant classifier stop |
| Jon's Sep 5 | 33955790162 | `RSBI_EXPECTED_DELTA_MISMATCH`; also `MASS_OOS` diagnostic |
| Jon's Sep 6 | 34023282163 | `RSBI_REPLAY_BLOCKED`; also `MASS_OOS` diagnostic |
| Jon's Sep 7 | 34107810620 | Same replay block and `MASS_OOS` diagnostic |

Nine downloaded diagnostics report zero business writes. Fit House Aug 30 and
Jon's Sep 5 each report one control write. The Aug 28 cause comes from its failed
dry-run log. Do not infer that these retailer sources were unavailable.

Existing repairs include the September 3 expired Fit House control-plan closure
and September 8 atomic-history reuse / Jon's retry closure. Today's verified Fit
House run `34335094373`, Jon's scheduled run `34333495023` and current observations
establish resumed execution. They do not prove all historical failures share one
underlying defect or guarantee future continuity. This investigation establishes
no new recorder defect requiring another code change.

## GYM HIGH

Run `34331843129` logged `SOURCE_IDENTITY_DRIFT: Product 701 page identity drift`,
then recovered the source-monitor artifact captured **September 8 at
18:57:15.568 UTC**. The existing builder permits evidence up to 24 hours old and
preserves its capture timestamp. The preceding SQL audit verified 50 September 8
observation replays and 16 skips for missing/conflicting exact identity. A green
execution is therefore not proof of a new September 9 observation.

A fresh local read-only catalogue audit failed on product 3627 after three
bounded request timeouts (`SOURCE_UNAVAILABLE`). No fresh report was obtained;
resolution of product 701's discrepancy is **not verified**. Preserve the identity
guard and genuine source time. Public use remains `owner-deferred`.

## Next evidence

Inspect the next ordinary daily runs and actual UTC observation dates. Require
a fresh successful source capture before claiming a new GYM HIGH daily
confirmation; investigate product 701 again if its discrepancy recurs. Do not
backfill gaps or stamp old evidence with execution time.

Keep the September 16 accrual recheck and conditional September 24–25 30-day
reviews. Age alone does not establish continuity or a qualifying price drop.
The weekly GSC/GA4 read is complete in the
[preceding audit](seo15-accrual-and-growth-audit-2026-09-09.md).

[Machine-readable evidence](seo15-producer-continuity-2026-09-09.json) contains
daily counts, run identifiers, errors and SHA-256 digests. Raw readbacks,
metadata, logs and artifacts remain private in
`tmp/seo15-continuity-2026-09-09/`. Project Guardian passed before recording.
