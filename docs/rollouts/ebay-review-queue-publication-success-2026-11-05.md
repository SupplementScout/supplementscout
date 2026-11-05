# eBay Review Queue publication success closeout — 5 November 2026

## Outcome

The exact owner-authorized eBay UK Review Queue changeset was published once
to production project `aftboxmrdgyhizicfsfu` through the shared
`authorized-artifact-retry` service-role path. GitHub Actions run
[`42047138740`](https://github.com/SupplementScout/supplementscout/actions/runs/42047138740)
completed successfully. The existing RPC
`public.publish_automation_review_queue_changes(jsonb)` returned `APPLIED`.

The publication made the expected 83 Review Queue lifecycle changes, wrote 83
review events and one publication seal. It made no catalogue, offer, mapping,
price, stock, price-history, owner-decision or execution-request change. No
Review Queue worker ran.

## Owner authorization and immutable evidence

The owner authorized exactly one dispatch of
`.github/workflows/automation-review-publication-retry.yml` on authoritative
main `fd323ca85d135a89cc718cc37eece76e8550d5ae`, for eBay UK retailer `12`,
using only the following evidence:

| Binding | Authorized value |
|---|---|
| Source run | `42012062652` |
| Source artifact | `13407363148` |
| Source artifact digest | `24f81c1ecc883dde7a0a27b44667b95de88d06f3a4a151ad86c3a03c38e44996` |
| Reconciliation run | `42040860633` |
| Reconciliation artifact | `13420468979` |
| Reconciliation artifact digest | `d5ff8a6c1c5095c1714f72aa1d683fcfabbf543c2ad37773fa8483c7f13cbe0a` |
| Publisher batch fingerprint | `48c5c23e8ebaad72913c3f45a0575a94c2f37030116b8a6d0e39a0630517deaa` |
| Changeset fingerprint | `c14a93eb13a41f82d18cf5032dd4443c8215ef34db14895187aa57a72dbba41a` |
| Idempotency key | `f4b804eb03969119e62be355fc4c609c5c30eafa40d9f507a271cd21589da258` |
| Canonical request hash | `27d6d9eb4a946872bd93cb128b1181399ad4e47a1c8104c6599de0a27437ddf1` |

The exact owner confirmation was:

```text
OWNER_AUTHORIZED_REVIEW_QUEUE_PUBLICATION_RETRY:42040860633:13420468979:d5ff8a6c1c5095c1714f72aa1d683fcfabbf543c2ad37773fa8483c7f13cbe0a:48c5c23e8ebaad72913c3f45a0575a94c2f37030116b8a6d0e39a0630517deaa:c14a93eb13a41f82d18cf5032dd4443c8215ef34db14895187aa57a72dbba41a:f4b804eb03969119e62be355fc4c609c5c30eafa40d9f507a271cd21589da258:27d6d9eb4a946872bd93cb128b1181399ad4e47a1c8104c6599de0a27437ddf1
```

The source and reconciliation runs, artifacts and GitHub artifact digests were
verified independently before dispatch. Both artifacts were present and
unexpired, and the source contract remained valid until
`2026-11-06T10:36:55.740Z`.

## Pre-dispatch gate

The isolated worktree was clean at the exact authoritative main SHA. PR `#487`
was merged. The only earlier retry was failed run `42030297419`; no later retry
had consumed this authorization. Immediately before dispatch, the exact
idempotency key had zero publication seals and all request-baseline, active-lock,
CREATE-collision and commercial execution-binding checks passed. All commercial
rows had exact `source_url == proposed_state.offer.url` equality.

| Relation | Pre-dispatch |
|---|---:|
| `products` | 1399 |
| `product_variants` | 4070 |
| `retailer_products` | 4361 |
| `offers` | 4361 |
| `price_history` | 48415 |
| `product_match_review_queue` | 3487 |
| `product_match_review_events` | 9896 |
| `automation_review_queue_publications` | 196 |
| `automation_review_execution_requests` | 292 |
| Active eBay Review Queue rows | 81 |

The canonical catalogue-count hash was
`6a0af71360fc18af842d047cae44c6f9c697cbf2421cca21229f1e407b0536b1`.

## Single authorized publication

Run `42047138740` used the production service-role context and the exact
authorized inputs. Its one mutation attempt returned:

| Result | Actual |
|---|---:|
| RPC status | `APPLIED` |
| RPC mutation attempts | 1 |
| `already_applied` | `false` |
| `CREATE` | 6 |
| `REFRESH` | 75 |
| `SUPERSEDE` | 2 |
| `RESOLVE_BY_SOURCE` | 0 |
| `EXPIRE` | 0 |
| Lifecycle mutations | 83 |
| Review event delta | 83 |
| Publication seal delta | 1 |
| RPC database writes | 167 |
| Catalogue writes | 0 |

The bounded retry evidence was uploaded as artifact `13424642591`, named
`automation-review-publication-retry-42047138740-1`, with GitHub artifact digest
`05f8e0ee8cc169d02721cc5519118b5d3bad5cbf444bd617d7fdf01d342f2329`.

## Independent production postflight

Read-only production verification completed at `2026-11-05T14:47:08.224Z`.

| Relation | Before | After | Delta |
|---|---:|---:|---:|
| `products` | 1399 | 1399 | 0 |
| `product_variants` | 4070 | 4070 | 0 |
| `retailer_products` | 4361 | 4361 | 0 |
| `offers` | 4361 | 4361 | 0 |
| `price_history` | 48415 | 48415 | 0 |
| `product_match_review_queue` | 3487 | 3493 | +6 |
| `product_match_review_events` | 9896 | 9979 | +83 |
| `automation_review_queue_publications` | 196 | 197 | +1 |
| `automation_review_execution_requests` | 292 | 292 | 0 |
| Active eBay Review Queue rows | 81 | 85 | +4 |

The final 85 active eBay rows comprise 81 `PENDING` and four `APPROVED` rows.
The catalogue-count hash remained exactly
`6a0af71360fc18af842d047cae44c6f9c697cbf2421cca21229f1e407b0536b1`.

Exactly one publication seal exists for the authorized idempotency key. It
binds retailer `12`, the exact batch and changeset fingerprints, request hash,
idempotency key, source run `42012062652`, source artifact `13407363148`, 83
operations and result `APPLIED`. The seal's `already_applied=false` proves this
was the first application. There was no duplicate publication and no second RPC
mutation attempt.

## Approved-row freeze

The four pre-existing `APPROVED` rows remained byte-semantically unchanged.
Their canonical full-row SHA-256 values before and after publication matched:

| Review ID | Offer ID | Canonical full-row SHA-256 |
|---:|---:|---|
| 619 | 2695 | `d2c7733924802880410da9c6be3614efc7d6c6445977a89f0acc4cbe7856cf0c` |
| 1159 | 2703 | `698c9e4dabae8669808e2efe21e9f2c68b9172ad00c9ca17e051be6835cda852` |
| 1160 | 2704 | `86c01274b05001cbef431c5363bacd27ebf3edd742350d32e800a795c63fb0f6` |
| 1632 | 2744 | `f82ee120ddfc7203a1ee3d4f88c6d4b20d26c198e7425ba555bbf1e375041cc9` |

No owner approval or rejection was created. Execution-request delta was zero,
and no request was queued, dispatched or executing.

## Final eBay admin projection

The final shared admin projection is `DECIDE=12`, `EXECUTE=0`, and
`PROCESSING=0`. The DECIDE split is nine `UPDATE_PRICE`, zero `UPDATE_STOCK`,
three `UPDATE_PRICE_AND_STOCK`, and zero `VERIFY_NO_CHANGE`.

| Review | Offer | Operation | Reason | Product | Variant | Current price | Proposed price | Current stock | Proposed stock |
|---:|---:|---|---|---|---|---:|---:|---|---|
| 1027 | 2749 | `UPDATE_PRICE_AND_STOCK` | `PRICE_AND_STOCK_CHANGE` | Trec Vitargo Electro Energy 1050g | Orange / 1.05kg | £27.99 | £26.99 | No | Yes |
| 1029 | 2774 | `UPDATE_PRICE_AND_STOCK` | `PRICE_AND_STOCK_CHANGE` | Trec Nutrition Caffeine 200 Plus - 60 caps | Default | £9.49 | £10.99 | No | Yes |
| 1088 | 2769 | `UPDATE_PRICE_AND_STOCK` | `PRICE_AND_STOCK_CHANGE` | SmartShake DC Comics SuperGirl 800ml | Default | £9.75 | £9.92 | No | Yes |
| 3315 | 2543 | `UPDATE_PRICE` | `PRICE_CHANGE` | Nutrend Pump Pre-Workout | Rainbow / 225g | £18.10 | £18.50 | Yes | Yes |
| 3316 | 2601 | `UPDATE_PRICE` | `PRICE_CHANGE` | Nutrend Pump Pre-Workout | Bubble Gum / 225g | £18.10 | £18.50 | Yes | Yes |
| 3317 | 2603 | `UPDATE_PRICE` | `PRICE_CHANGE` | JNX Sports The Ripper Fat Burner Powder 150g | Watermelon Candy / 150g | £26.80 | £32.20 | Yes | Yes |
| 3318 | 2689 | `UPDATE_PRICE` | `PRICE_CHANGE` | Optimum Nutrition 100% Plant Protein 684g | Chocolate / 684g | £34.85 | £36.68 | Yes | Yes |
| 3319 | 2690 | `UPDATE_PRICE` | `PRICE_CHANGE` | Barebells High Protein Milkshake 330ml | Strawberry / 330ml | £27.45 | £28.80 | Yes | Yes |
| 3320 | 2715 | `UPDATE_PRICE` | `PRICE_CHANGE` | Osavi Potassium 300mg | Default | £8.81 | £8.60 | Yes | Yes |
| **3603** | **2544** | **`UPDATE_PRICE`** | **`HARD_PRICE_ANOMALY`** | **Applied Nutrition ISO-XP 1.8kg** | **Cafe Latte / 1.8kg** | **£84.81** | **£108.77** | **Yes** | **Yes** |
| 3607 | 2688 | `UPDATE_PRICE` | `PRICE_CHANGE` | 7Nutrition Cream Crunch 750g | Coconut / 750g | £14.99 | £12.44 | Yes | Yes |
| 3608 | 2735 | `UPDATE_PRICE` | `PRICE_CHANGE` | Reflex Instant Mass Heavyweight 2kg | Chocolate Perfection / 2kg | £45.52 | £45.08 | Yes | Yes |

The `HARD_PRICE_ANOMALY` is review `3603`, offer `2544`. These rows now require
manual owner review. This closeout does not approve, reject or execute them.

## Side-effect boundary and stop point

- Dispatches of the authorized retry workflow: `1`.
- RPC mutation attempts: `1`; second attempt: `NO`.
- Duplicate publication: `NO`.
- Catalogue/business writes: `0`.
- Owner approvals or rejections: `0`.
- Execution requests created: `0`.
- Worker executions: `0`.
- Price, stock, price-history, offer or mapping writes: `0`.
- New source capture, reconciliation, migration or freshness recovery: `NO`.
- SEO-20 changed: `NO`; it remains the sole SEO task `IN PROGRESS`.

The exact stop point is the successful documentation-only closeout merge and
final-main verification. The next product action, outside this authorization,
is manual owner review of the 12 `DECIDE` rows. No review decision, execution,
worker run, additional publication or unrelated task is authorized here.
