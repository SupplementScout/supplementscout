# eBay approved-price decimal normalization — 2026-11-05

## Scope

This bounded code-and-test repair corrects a false `APPROVED_PRICE_DRIFT`
result in the shared eBay Review Queue worker. It does not authorize or perform
Review Queue decisions, execution requests, worker dispatches, catalogue
writes, migrations, or any other production mutation.

## Evidence and root cause

`product_match_review_queue.source_price` is defined as `numeric(12,2)` by
`20260728110000_create_product_match_review_queue.sql`. PostgreSQL/PostgREST
numeric JSON values do not preserve display scale, so values stored as `18.50`,
`32.20`, or `8.60` can reach JavaScript as `18.5`, `32.2`, or `8.6`.

The worker compared `String(review.source_price)` with a two-decimal string
produced from the protected plan. That made numerically identical values fail
textual equality. The same scale-sensitive comparison existed in both the
generic commercial guard and the hard-price guard.

The following protected worker runs stopped before business writes:

| Review | Run | Approved/fresh price | Result | Business writes |
| --- | --- | ---: | --- | ---: |
| 3315 | 42083073046 | £18.50 | `APPROVED_PRICE_DRIFT` | 0 |
| 3316 | 42087101520 | £18.50 | `APPROVED_PRICE_DRIFT` | 0 |
| 3317 | 42088315714 | £32.20 | `APPROVED_PRICE_DRIFT` | 0 |

The successful comparison examples 1029 (`£10.99`) and 1088 (`£9.92`) did not
contain a removable trailing zero and therefore did not expose the bug.

## Repair

Both approval-price guards now compare the existing canonical decimal form
returned by `normalizeDecimalString`. This makes `18.5` equal to `18.50` while
keeping `18.49` different from `18.50`. No epsilon comparison, retailer ID,
offer ID, review ID, or other exception was introduced. Fingerprint, identity,
URL, stock, plan, and database-before-state guards remain unchanged.

Focused regression coverage proves:

- `18.5` equals `18.50` for the 3315 and 3316 shapes;
- `32.2` equals `32.20` for the 3317 shape;
- `8.6` equals `8.60` for the still-approved 3320 shape;
- `10.99` remains equal to `10.99`;
- `18.49/18.50`, `32.21/32.20`, and `8.61/8.60` still fail closed;
- the hard-price guard uses the same canonical rule;
- source fingerprint, plan fingerprint, database-before-state, and atomic
  `UPDATE_PRICE_AND_STOCK` protections remain strict.

Review 3318 at `£36.68` does not depend on trailing-zero normalization. Review
3320 at `£8.60` is vulnerable to the repaired false positive because its JSON
representation may be `8.6`. Neither review is executed by this change.

## Production boundary

There is no SQL migration and no data repair. The stored numeric values are
correct. Reviews 3315, 3316, and 3317 remain `EXPIRED`; 3318 and 3320 remain
`APPROVED`. Any later Review Queue action requires separate owner authorization
and fresh guarded execution evidence.
