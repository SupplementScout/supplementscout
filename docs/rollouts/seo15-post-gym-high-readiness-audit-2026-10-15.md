# SEO-15 post-GYM HIGH readiness audit — 15 October 2026

## Outcome

The GYM HIGH source release is healthy, but it does not yet add a public Stage
3 candidate. Public Stage 3 remains correctly disabled. The current bottleneck
is genuine qualifying price-drop breadth, not missing infrastructure or an
unreleased candidate queue.

The automatic inventory contains two released offer candidates, both from
Jon's Supplements and both for the same canonical product slug,
`hr-labs-defib-pre-workout`. GYM HIGH and Fit House have mature evidence but no
threshold-qualified drops. Against the binding `12 products / 30 offers / 4
retailers` public readiness gate, the strict current representation is one
canonical product, two candidate offers and one retailer. The remaining gap is
therefore at least 11 products, 28 offers and 3 retailers.

This audit is read-only. It does not authorize a public flag change, another
producer, a history backfill, an identity change or a production write.

## Evidence boundary

- Current repository: merge commit
  `da01167b8c53c4a9f0669bec3fe824892db14e11`.
- Latest ordinary scheduled audit: run `38736679434`, artifact `11974021909`,
  artifact digest
  `sha256:5d36b9f80b58005dadd4f0cafcaf72a9a8f25e00d508f054311c65b52e232ce5`.
- Scheduled artifact payload SHA-256:
  `3bb7149d7830d649302ca099cf1284611f31e9122b0506edb4d6521cd68280a3`.
- The scheduled payload was captured at `2026-10-15T12:42:48.598732Z`, before
  the GYM HIGH production release at `2026-10-15T12:43:02.457359Z`. It is valid
  pre-release evidence, not a natural post-release verification.
- Fresh production read-only audit captured at
  `2026-10-15T13:00:45.197467Z`; payload SHA-256
  `e6696476030bb841a34398ab59665ae4bc77b13af4176f250cbfcdc3d87053d8`.
- Both audits report `database_writes=0`.
- The next ordinary scheduled audit is expected from cron `23 7 * * *` on 16
  October at 07:23 UTC (08:23 Europe/London). Only that or a later ordinary run
  can supply the first natural post-release workflow proof.

## Current production state

The fresh audit reports:

- 34,823 price-history rows;
- 813 identity series;
- 30,673 identity-linked observations;
- two released retailer sources: Jon's Supplements and GYM HIGH;
- two released candidates and zero awaiting retailer approvals.

Producer evidence is:

| Retailer | Mature series | Proven observations | Currently eligible | Threshold-qualified drops | Public candidate contribution |
|---|---:|---:|---:|---:|---:|
| Jon's Supplements | 503 | 22,222 | 297 | 5 | 2 |
| Fit House | 260 | 6,251 | 163 | 0 | 0 |
| GYM HIGH | 50 | 1,966 | 26 | 0 | 0 |

Of the five Jon's threshold drops, offer `1284` and offer `1251` are out of
stock, offer `1192` fails current identity matching, and only offers `1337` and
`1339` satisfy all current gates. Both released candidates are fresh, in stock,
identity-matched and automatically selected by the existing inventory RPC.

## Interpretation

Releasing GYM HIGH expanded the number of approved sources from one to two; it
did not manufacture a historical event. That is the intended fail-closed
behaviour. Adding another table, RPC, importer, executor or manual offer list
would not solve the present constraint. Nor would releasing an eligible source
that has no qualifying price drop.

The base `/deals` comparison page and its Stage 1 indexability monitoring are
already live verified. This audit concerns only the separately gated historical
price-drop section. The shared `12 / 30 / 4` threshold remains the authoritative
public Stage 3 readiness rule because the current Operating and SEO execution
plans explicitly retain it; it must not be weakened to fit the current sample.

## Safe next actions

1. Inspect the first ordinary post-release SEO-15 audit on or after 16 October
   07:23 UTC and bind its run, artifact and payload digests into the ledger.
2. Continue the existing daily read-only inventory. Re-evaluate only when
   genuine source observations change the candidate set; do not retry or
   backfill to create evidence.
3. Keep `SEO15_STAGE3_ENABLED` off. A passing evidence gate would still require
   a separate owner release decision and live verification.
4. In parallel, permit only non-overlapping read-only work: weekly GSC/GA4
   measurement and a research-only SEO-17 readiness inventory. Do not implement
   or publish SEO-17 while SEO-15 remains the single active SEO implementation.
5. Do not reopen retailer automation: RA-STAB-01 and RA-STAB-02 are complete,
   and RA-004 remains separately blocked.

