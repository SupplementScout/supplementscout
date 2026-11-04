# Automation Review Queue hard-price production migration closeout — 2026-11-04

## Authorization and scope

The owner explicitly authorized applying exactly
`supabase/migrations/20261104120000_allow_automation_review_hard_price_anomaly.sql`
with SHA-256
`26a7aa2155bebc49313e8827fe0377b4676af455b7aa964c293db0f30d5fce6d`
to production project `aftboxmrdgyhizicfsfu`. No other migration, Review Queue
publication, review decision, execution request, eBay retry, historical replay
or business-data change was authorized.

Starting repository main SHA:
`83844b49dec36cfe959d2fd055886297570ee760`. PR `#477` was merged and its
required Project Guardian, Baseline Validation, full Quality Gate, GitGuardian
and Vercel checks passed. SEO-20 remained the sole SEO task `IN PROGRESS`.

## Preflight

- Clean isolated worktree at exact `origin/main` SHA `83844b49dec36cfe959d2fd055886297570ee760`.
- Migration file SHA-256 matched the authorized value exactly.
- Rollback file `supabase/rollbacks/20261104120000_allow_automation_review_hard_price_anomaly_rollback.sql` existed.
- Project Guardian: `PASS`.
- Migration-selector tests: `62/62 PASS`.
- Read-only production selector: `PASS`; target identity was `supplementscout-production:aftboxmrdgyhizicfsfu`, environment `PRODUCTION`, database user `postgres`, ledger count `258`, ledger fingerprint `cd6b36c93aea368c61a048f4315724cb631e60defeb16ffd396ace61e11a72ce`.
- The selector found no remote-only or unexpected local migrations and selected exactly one pending migration with the authorized filename and SHA-256.
- Pre-migration function definition SHA-256 was `4e14d782e86cf3636d1af3900fd94b16c14aadf2398a48324190ddab692fd75a`; the reason validation did not contain `HARD_PRICE_ANOMALY` and unknown reasons remained fail-closed.

## Production baseline

Read-only snapshot captured at `2026-11-04T19:43:49.196Z`:

| Relation | Before |
|---|---:|
| `products` | 1399 |
| `product_variants` | 4070 |
| `retailer_products` | 4361 |
| `offers` | 4361 |
| `price_history` | 48366 |
| `product_match_review_queue` | 3445 |
| `product_match_review_events` | 9808 |
| `automation_review_queue_publications` | 195 |
| `automation_review_execution_requests` | 292 |

The live function identity was
`public.publish_automation_review_queue_changes(p_request jsonb)`. It had one
overload, owner `postgres`, `SECURITY DEFINER`, `search_path=""`, no execute
access for `PUBLIC`, `anon` or `authenticated`, and execute access for
`postgres` and `service_role` only.

## Exact migration execution

The repository-governed `scripts/apply-selected-migrations.js` mechanism was
used with environment `PRODUCTION`, exact project ref `aftboxmrdgyhizicfsfu`
and its hash-derived confirmation `4889e82a1a05ac35`.

1. `rehearse` returned `PASS`, selected only
   `20261104120000_allow_automation_review_hard_price_anomaly`, proved zero
   catalogue count deltas and rolled the transaction back.
2. `apply` returned `PASS` and committed exactly the same single migration.
3. The governed post-commit result recorded ledger count `259`, fingerprint
   `d21a4044df80270db476bd264a9a4da19e90fe15310b2b918487ce4c480978af`
   and exactly one applied identifier:
   `20261104120000_allow_automation_review_hard_price_anomaly`.

Unrelated migrations applied: `0`. Rollback executed: `NO`.

## Independent postflight

Read-only snapshot captured at `2026-11-04T19:44:31.425Z`:

| Relation | Before | After | Delta |
|---|---:|---:|---:|
| `products` | 1399 | 1399 | 0 |
| `product_variants` | 4070 | 4070 | 0 |
| `retailer_products` | 4361 | 4361 | 0 |
| `offers` | 4361 | 4361 | 0 |
| `price_history` | 48366 | 48366 | 0 |
| `product_match_review_queue` | 3445 | 3445 | 0 |
| `product_match_review_events` | 9808 | 9808 | 0 |
| `automation_review_queue_publications` | 195 | 195 | 0 |
| `automation_review_execution_requests` | 292 | 292 | 0 |

The independent governed verifier returned `PASS`, ledger count `259`, ledger
fingerprint `d21a4044df80270db476bd264a9a4da19e90fe15310b2b918487ce4c480978af`
and the exact applied migration once.

The live function definition SHA-256 is
`54c295ca09cbe948958980f92b918563a364b1a6546a57076202b7af09e90999`.
Static readback confirmed:

- exact identity `public.publish_automation_review_queue_changes(p_request jsonb)`;
- exactly one overload;
- `HARD_PRICE_ANOMALY` is present in the reason-code validation;
- the `NOT IN` allowlist and `AUTOMATION_REVIEW_PUBLICATION_ROW_CONTRACT_INVALID` failure remain, so unknown reasons fail closed;
- owner `postgres`, `SECURITY DEFINER` and `search_path=""` are unchanged;
- execute remains unavailable to `PUBLIC`, `anon` and `authenticated`;
- execute remains available only to `postgres` and `service_role`.

## Side-effect and stop record

- Catalogue writes: `0`.
- Review Queue row changes: `0`.
- Review event changes: `0`.
- Publication rows changed: `0`.
- Execution-request rows changed: `0`.
- Executions triggered: `0`.
- Historical run `41836635201` replayed: `NO`.
- Historical artifact `13328715529` reused: `NO`.
- Historical 85-row batch published: `NO`.
- eBay refresh or retry triggered: `NO`.
- Rollback executed: `NO`.
- SEO-20 status changed: `NO`; it remains the sole SEO task `IN PROGRESS`.

## Next safe step

Stop after documentation closeout. A separate task and authorization may take a
fresh eBay source capture and perform a non-historical publication verification.
It must not replay run `41836635201`, artifact `13328715529` or the old 85-row
batch. No Review Queue decision or execution is authorized by this migration.

## Documentation delivery

- Closeout branch: `production/hard-price-anomaly-migration-closeout`.
- Closeout PR: `#478`.
- Evidence commit: `3b753dcd1561451277a0f5888d977884fa166fc9`.
- Final PR head: recorded in PR metadata and final handoff because this document is part of that head.
- Local Project Guardian: `PASS`.
- Local Quality Gate quick: `PASS`.
- Local Quality Gate full, baseline validation and production build: `PASS`.
- `git diff --check`: `PASS`.
- Remote final gates: pending documentation-only PR validation.
