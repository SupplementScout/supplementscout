# Product matching review

## Purpose

The admin area has two connected, deliberately non-automatic workflows:

- `/admin/duplicates` reviews possible duplicates already in the canonical
  catalogue.
- `/admin/product-matching` reviews uncertain rows from a new retailer before
  they enter an adapter's approved plan.

## Decision workflow

1. Open `/admin/duplicates`.
2. Filter by name, brand, ID, or similarity level.
3. Review the structured product size, format, active variants, retailer
   mappings, retailer names, positive identity signals, cautions, and blockers.
4. Select one or more pairs and choose:
   - **Keep selected separate** for confirmed distinct products.
   - **Defer selected** for a family relationship or when expert evidence is
     still required; write `MERGE FAMILY` in the note only after confirming it
     is the same product with a different flavour, size or colour.
5. Use **Preview: keep A/B** only when the queue-level evidence supports a
   merge. The preview performs a fresh server-side preflight.

Saved decisions are pair-specific. Keeping products A and B separate does not
prevent either product from being compared with another product.

For the owner-reviewed 31 July 2026 batch, the operational shorthand is:
`DEFER + MERGE FAMILY` means approved for later variant-aware consolidation,
while `Separate` means do not merge. Saving the family decision does not itself
change the public catalogue. A guarded execution plan must identify the exact
canonical product and target variant, preserve offers and evidence, and pass a
rollback rehearsal before it is applied.

## Fail-closed merge policy

A merge is blocked when:

- either product has an active non-default variant;
- the candidate has retailer mappings that require automation reconciliation;
- structured size, count, format, brand, category, or GTIN evidence conflicts;
- product, offer, mapping, or merge state changed after the preview;
- safety evidence cannot be loaded;
- the server does not receive the exact `MERGE <candidate id>` confirmation.

The database remains the final authority and performs its own transactional
checks. Queue similarity is never merge authority.

## New retailer queue

The existing read-only retailer matcher remains the only component that
generates candidates. Its fingerprinted review JSON can be published into
`product_match_review_queue`. Publishing can only insert review rows; it has no
code path for products, variants, mappings, offers, or price history.

An administrator can save one of the following first-stage decisions:

- use a selected existing canonical product variant;
- add the retailer row as a new variant of an existing canonical product;
- treat the source row as a new product;
- treat related source rows as flavours or variants of one new product family;
- defer the decision;
- reject or exclude the source identity.

Every decision is bound to the exact source-row fingerprint. Selecting an
existing product is accepted only when the selected product and variant are
still active and related. The review page can search the whole catalogue,
including retailer offer names, so a valid existing product is not limited to
the matcher's initial shortlist.

The matcher also treats reviewed brand families, such as Animal and Universal
Nutrition, as compatible and uses existing retailer offer names as additional
search aliases. Before a new-product decision is accepted, a full-catalogue
similarity guard performs one final duplicate check. The administrator must
explicitly confirm the full-catalogue search when no likely existing product is
found.

Saving or reopening a decision never changes the public catalogue. Decisions
can be exported back to the standard tamper-evident review JSON/CSV format.
Only a later adapter-specific, reviewed plan may turn those decisions into
catalogue changes. Exporting does not mark decisions as consumed.

## Deployment order

1. Apply
   `20260728100000_extend_duplicate_review_decisions.sql` through the reviewed
   migration process.
2. Apply
   `20260728110000_create_product_match_review_queue.sql` through the same
   reviewed process.
3. Verify that the existing duplicate decision rows were backfilled as
   `separate` and the new retailer queue is empty.
4. Deploy the application build.
5. Open both queues and confirm their counts load.
6. Exercise one defer/reopen cycle in each queue before using batch decisions
   or publishing a real retailer review artifact.

Do not deploy the application before the migration. Do not use `supabase db
push` against an unreconciled staging or production ledger.
