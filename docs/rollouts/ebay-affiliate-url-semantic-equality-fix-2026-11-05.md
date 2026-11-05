# eBay affiliate URL semantic equality contract fix — 2026-11-05

## Status and authority

- Starting authoritative `origin/main`:
  `5f7a37d6ac3a40aaee0ebe7791d872ce11a3bc12`.
- Source audit:
  `docs/rollouts/ebay-final-fresh-publication-preflight-2026-11-05.md`.
- Repository scope: comparison semantics, focused regressions and this evidence
  record only.
- Production database writes: `0`; Review Queue writes: `0`; executions: `0`.
- Database migrations created: `0`.
- Previous source run `42000205669`, artifact `13401888113` and reconciliation
  run `42001099184` are evidence context only. They were not reused for a
  publication request, owner decision or execution.

The first gate confirmed PR `#483` merged as the required starting SHA. Its
Project Guardian, full Quality Gate, GitGuardian and Vercel checks passed, with
zero unresolved review threads. A fresh fetch found no newer semantic URL fix.
Project Guardian passed before implementation: `SEO-20` remains the sole SEO
task `IN PROGRESS`, and broad P1 category cleanup remains closed.

## Confirmed root cause

The completely new source and reconciliation evidence observed all `237/237`
approved eBay mappings. Unknown reasons, unsupported publisher and execution
operations, duplicate or missing fingerprints, DB/protected-plan baseline
mismatches and catalogue writes were all zero.

The only blocker was 14 raw-string differences between the semantic source
affiliate URL and the protected plan URL. Their scheme, host, path and query
key/value pairs were identical, while query parameters were serialized in a
different order. The same 14 pairs had zero differences under the repository's
existing deterministic affiliate URL contract. Parameter order was therefore
being treated as a commercial change even though the destination was
unchanged.

## Reused canonical contract

No new URL helper or normalizer was created. Both corrected comparisons import
`stableAffiliateUrl()` from
`scripts/lib/ebay-artifact-bound-contract.js`, the same function already used
to build semantic eBay source evidence.

The existing function:

1. parses the URL with the platform URL implementation;
2. removes only the technical `amdata` parameter;
3. sorts search parameters deterministically;
4. serializes the result deterministically;
5. retains the existing raw-string fallback for invalid URL input.

It does not remove or ignore scheme, host, non-default port, path, meaningful
parameter names or meaningful parameter values. Repeated parameters are not
collapsed: their values remain present and stable same-key ordering remains
significant. Different or reordered repeated values therefore still fail.

## Changed comparisons

Exactly two source-to-plan comparisons are class `B` and now use
`stableAffiliateUrl()` on both sides:

| Path | Compared evidence | Reason semantic equality is correct |
|---|---|---|
| `scripts/automation-review-reconciliation-dry-run.js` | `semantic.affiliate_url_returned || semantic.affiliate_url` against protected `proposed_state.offer.url` | Both represent the same affiliate destination. Source serialization order and technical `amdata` are not commercial state. The authoritative protected-plan URL is preserved unchanged in the manifest. |
| `scripts/automation-review-ebay-worker.js` | fresh `evaluation.affiliate_url` against protected combined-operation `after.url` | Both represent the same revalidated affiliate destination. Every price, shipping, total, stock, identity, fingerprint, plan, history, postflight and idempotency check remains strict. |

No source fingerprint field, semantic problem identity, publisher lifecycle,
Review Queue schema, stored offer URL or production URL was changed.

## Comparisons deliberately left exact

The audit classified the following checks as class `A`; they deliberately
remain exact-string or exact canonical-state comparisons:

| Exact check | Why it remains strict |
|---|---|
| Reconciliation current DB `url` / mapping `external_url` against protected-plan `expected_state` | Proves the exact stored baseline and mapping identity before publication. |
| Worker live DB offer URL against protected-plan expected URL | Prevents execution against a database state different from the reviewed plan. |
| Review `before_state.url` and `proposed_state.offer.url` against their protected-plan counterparts | Binds the approved Review Queue row byte-for-byte to the immutable plan; source serialization is not involved. |
| Protected plan before URL against protected plan after URL | Proves price/stock review does not authorize a URL write and keeps expected delta counts exact. |
| Refresh-plan URL against the approved scope URL and verified-no-change URL classification | Controls what exact URL would be stored and detects a real planned URL delta. |
| Mapping `external_url` identity checks | The direct listing identity is not an affiliate-destination serialization comparison. |
| Postflight current offer/mapping URL against baseline and planned URL deltas | Detects any actual persisted URL mutation. |

The worker's reviewed before/proposed URL guards were intentionally not changed
to semantic comparison. A reordered URL inside an already published review row
still fails its exact protected-plan binding.

## Regression coverage

Generic fixtures prove:

- the same URL with query parameters in a different order passes;
- `amdata` present on only one side passes under the existing contract;
- different host, path, non-default port, query value or scheme fails;
- missing or extra meaningful query parameters fail;
- repeated query parameters remain deterministic and changed/reordered values
  do not collapse into equality;
- invalid URLs retain the existing raw fallback and different invalid strings
  fail;
- ordinary `UPDATE_PRICE` reconciliation passes with reordered affiliate
  parameters;
- `HARD_PRICE_ANOMALY` reconciliation passes with reordered parameters;
- `UPDATE_PRICE_AND_STOCK` reconciliation passes while preserving the exact DB
  and protected-plan before state;
- the combined worker accepts a reordered, `amdata`-only-different affiliate
  URL and rejects a changed destination;
- review-to-plan and DB-to-plan URLs remain exact;
- runtime code defines no replacement URL helper and adds no offer- or
  product-specific branch.

Focused eBay source, reconciliation and protected-worker suite:
`155/155 PASS`.

No test file was added, removed or renamed, so the sealed Quality Gate test
inventory does not require resealing. Local verification after implementation:

- Project Guardian before and after implementation: `PASS`;
- standalone TypeScript: `PASS`;
- standalone ESLint: `PASS`;
- standalone Next.js production build with the repository's isolated loopback
  Supabase placeholders: `PASS`;
- Quality Gate quick: `PASS`;
- Quality Gate full, including baseline migration validation and its isolated
  production build: `PASS`;
- `git diff --check`: `PASS`.

Remote PR checks and merge evidence are recorded in the PR and final handoff.

## Side effects and stop

- Migrations: `0`.
- Production database writes: `0`.
- Review Queue/control-plane writes: `0`.
- Owner approvals: `0`.
- Execution requests: `0`.
- Worker executions: `0`.
- Offer, price, stock, price-history and mapping writes: `0`.
- Old artifact reused for publication: `NO`.
- `SEO-20` changed: `NO`; it remains the sole SEO task `IN PROGRESS`.

Exact stop: after repository implementation, verification, documentation and
authorized merge, before Review Queue publication, owner approval, execution
request, worker execution, catalogue write, migration, freshness recovery,
retailer onboarding, nutrition work, SEO-20 change or category work.

The next safe task must create a completely new eBay source capture, a new
reconciliation and a new publication preflight. It must not reuse run
`42000205669`, artifact `13401888113` or reconciliation `42001099184` for
publication.
