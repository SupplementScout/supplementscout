# Retailer onboarding runbook

This runbook describes the current safe process for onboarding a retailer into SupplementScout. It applies to data received from an API, Shopify CSV, or a manually prepared sample. The canonical input contract is `data/templates/retailer-feed-template.csv`.

The importer is `scripts/import-products.js`. Feed mode has a complete preflight and supports `--dry-run`. The write path is not one database transaction and has no separate `--apply` flag. Running without `--dry-run` performs writes, so a production run must use a separately reviewed CSV containing no more than 5–20 variants.

## 1. Receive the source data

### API

Fetch products and variants without writing to SupplementScout. Preserve the retailer's stable product ID, variant ID, direct variant URL, barcode, price, availability, option values, and source update time. Never put API keys, access tokens, cookies, or signed URLs in a CSV or Git.

### Shopify CSV

Treat every Shopify variant as a separate candidate row. Preserve `Handle` or product ID separately from variant ID. Do not collapse different sizes, flavours, pack counts, or barcodes into one row.

### Manual sample

Start with 5–20 representative variants. Include at least one multi-variant product and, where applicable, examples of unknown, free, and paid shipping. Use stable retailer identifiers rather than invented sequential IDs whenever the source exposes them.

## 2. Preserve the raw snapshot outside the repository

Store the unmodified response, export, and retrieval metadata in an approved location outside the repository. Record:

- retailer and source;
- retrieval time and source update time;
- API endpoint or export method, without secrets;
- checksum or immutable object version;
- operator;
- number of products and variants.

Do not place raw API responses, Shopify exports, Awin feeds, customer data, credentials, or large retailer snapshots in Git. The repository should contain only reviewed canonical samples or templates that are safe to publish.

## 3. Map to the canonical retailer feed

Copy the header from `data/templates/retailer-feed-template.csv`. Produce exactly one row per retailer variant.

Required canonical columns are:

```text
retailer_name
retailer_website
external_product_id
external_variant_id
product_name
brand
category
slug
external_url
affiliate_url
price
shipping_known
in_stock
is_for_sale
```

The full template also contains description, image, external GTIN, variant name, size, unit, flavour, product format, pack count, and source update time.

Mapping rules:

- keep the same `external_product_id` for variants of one retailer product;
- give every variant its own `external_variant_id`;
- make `product_name`, `slug`, and `external_url` variant-specific;
- use the direct retailer variant URL in `external_url`;
- use the tracked click URL in `affiliate_url`; if no affiliate URL exists, use the direct URL;
- store the retailer barcode only in `external_gtin`;
- keep `size` numeric and put its unit in `size_unit`;
- use `pack_count` for multipack evidence, not canonical `unit_count`;
- use ISO 8601 UTC for `source_updated_at` when supplied.

The importer currently uses the three headers below together to recognise the canonical schema:

```text
external_product_id
external_variant_id
shipping_known
```

After recognition, it validates all required headers and required row values. `variant_name` is mapped to variant evidence, `size` and `size_unit` are joined, and `pack_count` is passed to the existing variant guards as `pack of N` evidence.

`external_product_id`, `external_variant_id`, and `source_updated_at` are not yet persisted or used for matching.

## 4. Validate the canonical schema

Before any production run:

1. Confirm the header is based on the committed template.
2. Confirm every required cell is non-blank.
3. Confirm prices are finite and greater than zero.
4. Confirm boolean values use accepted forms such as `true` and `false`.
5. Confirm every row describes one unambiguous variant.
6. Confirm direct and affiliate URLs point to the intended variant.
7. Confirm external GTINs are retailer evidence, not canonical product verification.
8. Confirm no forbidden column exists, even if every value in it is blank.

Canonical schema errors fail before feed preflight and before database writes.

## 5. Forbidden fields

The following columns must never appear in a retailer feed:

```text
gtin
product_gtin_verified
net_weight_g
net_volume_ml
serving_count_verified
serving_size_g
serving_size_ml
protein_per_serving_g
creatine_per_serving_g
unit_count
unit_type
unit_pricing_verified
nutrition_verified
```

These are canonical or manually verified product fields. A retailer feed must not establish or clear them. `product_format` is allowed as variant evidence and may initialise a new product, but retailer updates cannot change the protected product format of an existing product.

## 6. Shipping

Shipping must be expressed explicitly:

| Situation | `shipping_known` | `shipping_cost` |
| --- | --- | --- |
| Unknown | `false` | blank |
| Free | `true` | `0` |
| Paid | `true` | a finite number greater than `0` |

Rules:

- blank shipping never means free shipping;
- `shipping_known=false` with a non-blank cost is invalid;
- `shipping_known=true` with a blank or negative cost is invalid;
- canonical feeds cannot use `delivery_cost` as an alternative;
- unknown shipping remains `null` for a new offer;
- unknown shipping preserves the known shipping of an existing offer;
- a real shipping change, including a paid-to-free change, updates delivered price and creates price history.

Simply Supplements retains its existing retailer-specific inferred-shipping policy for its legacy Awin feed. That feed does not activate canonical normalisation.

## 7. Matching and variant safety

The current importer resolves candidates in this order:

1. **Retailer:** resolve the retailer by its generated slug.
2. **Retailer mapping and external URL:** find `retailer_products` using `retailer_id + external_url`; when found, reuse the product connected to that mapping.
3. **Verified product GTIN:** if no mapping resolved a product, the importer has a legacy path for explicitly product-verified GTINs. Canonical retailer feeds prohibit `gtin` and `product_gtin_verified`, so never promote `external_gtin` into `products.gtin`.
4. **Slug:** if no verified GTIN match exists, look for an existing canonical product with the supplied slug.
5. **Variant guards:** compare product family, brand, size, pack count, format, and recognised flavour. Ambiguous or conflicting variants are skipped for review.

The external GTIN is stored on `retailer_products`, not on `products`. Multiple feed variants that would collide with the single `offers(product_id, retailer_id)` relationship are blocked.

## 8. Dry-run

Run canonical data only in explicit feed mode. Safe-create is required when the reviewed sample may create a retailer or product.

```powershell
node scripts/import-products.js --mode=feed --safe-create --dry-run --csv=<reviewed-canonical-sample.csv>
```

For a match-only run, omit `--safe-create`:

```powershell
node scripts/import-products.js --mode=feed --dry-run --csv=<reviewed-canonical-sample.csv>
```

Expected confirmation includes `Dry run: no database writes performed.` Never continue if the command, input path, row count, or mode differs from the reviewed plan.

## 9. Review the preflight report

Review every section, not only `approved rows`:

- **New:** `new retailers would be created`, `new products would be created`, and `retailer_products would be created` must match the approved sample.
- **Matched:** infer existing matches from approved rows that are absent from the new retailer/product lists. The current report does not have a separate matched counter.
- **Ambiguous:** every ambiguous row stays out of apply until manually resolved.
- **Conflicts:** review GTIN, external GTIN, size, pack-count, format, and collision groups. Expected value is zero unless the run is intentionally collecting issues.
- **Offers:** check the expected variant count and confirm no two distinct variants collapse into one product-retailer offer.
- **Shipping:** review all inferred-policy entries and compare canonical unknown/free/paid values with the source.
- **Variants:** inspect incomplete evidence warnings and verify names, sizes, flavours, formats, pack counts, URLs, and external GTINs.
- **Invalid, unmatched, and exclusions:** explain every row. Do not silently drop unexplained products.

The report labels planned offer and price-history rows generically; it is not a full field-level diff for existing offers. Treat those counters as preflight scope, not proof that every row will create a new record.

## 10. Small apply

Only proceed after a clean dry-run and human approval.

1. Create a separate CSV containing exactly the approved 5–20 variants.
2. Re-run dry-run against that exact file and save the output outside Git.
3. Confirm the checksum and row count have not changed.
4. Run without `--dry-run` only after explicit production approval.

The write command is structurally the dry-run command with `--dry-run` removed. There is no separate `--apply` switch. Absence of `--dry-run` means writes are enabled.

Do not:

- import the full catalogue on the first production run;
- add extra rows after approval;
- treat products missing from a source response as deleted or out of stock;
- delete products, offers, mappings, or history;
- run simultaneous imports for the same retailer.

## 11. Post-import QA

Verify the small batch directly after the run:

### Retailer

- one expected retailer exists;
- name, slug, and website are correct;
- no duplicate retailer was created.

### `retailer_products`

- one mapping exists for every imported variant;
- each mapping points to the correct canonical product;
- direct external URL is correct and unique;
- `external_gtin` matches the retailer variant barcode;
- match method and confidence are plausible.

### Offers and price history

- one intended offer exists per canonical product and retailer;
- affiliate URL opens the intended variant;
- price, stock, shipping, total price, and `last_checked_at` are correct;
- free shipping is stored as `0`, not `null`;
- unknown shipping is `null`;
- new offers have an initial price-history row;
- real price or shipping changes have a new history row;
- missing shipping information did not create a false history entry.

### Product pages

- imported products render successfully;
- image, brand, category, name, and description are sensible;
- variant-specific size and flavour were not merged incorrectly;
- delivered price agrees with product price plus known shipping;
- stock status agrees with the source;
- retailer link reaches the correct product variant.

### Canonical data protection

- `products.gtin` was not populated from `external_gtin`;
- verified weight, volume, serving, nutrition, unit count, unit type, product format, and verification flags did not change on existing products;
- no unrelated product was updated.

## 12. Idempotency

Without a source change, a second dry-run should resolve the same retailer, product mappings, and variants without proposing new retailers, new products, or new mappings. It must not introduce new conflicts or ambiguity.

The current preflight still reports generic offer and price-history scope for approved rows, even when an offer already exists. Therefore idempotency is assessed primarily through stable matching and the absence of new entity proposals, not by expecting every report counter to be zero.

If the second dry-run proposes a new retailer, product, or mapping, stop and investigate URL stability, slug generation, external GTIN, and variant evidence before proceeding.

## 13. Rollback and partial-failure response

The current write path is not wrapped in one database transaction. A network or database failure can leave a partially completed batch.

If any row fails:

1. Stop. Do not immediately rerun the whole file.
2. Preserve the command output and approved canonical CSV outside Git.
3. Record successful, failed, and skipped row numbers.
4. Run read-only queries to identify created or updated retailers, mappings, offers, and price-history rows.
5. Compare the database state with the pre-import snapshot and approved report.
6. Prepare a targeted, human-reviewed recovery plan.
7. Prefer correcting or completing the small batch over deleting shared canonical products.
8. Do not remove price history or mappings without confirming their ownership and downstream impact.
9. Run a new dry-run after recovery and repeat QA.

There is no automatic rollback command in the importer. Database restoration, targeted SQL, or manual correction requires separate approval and must not be improvised during the failed run.

## 14. Safety rules

- Never commit API keys, access tokens, cookies, `.env` contents, or signed private URLs.
- Never commit raw retailer feeds or API snapshots.
- Never map a retailer barcode to `products.gtin`; use `external_gtin`.
- Never include verified product metrics in a retailer feed.
- Never bypass canonical schema errors by renaming forbidden fields.
- Never perform a full-catalogue write before a successful 5–20 variant sample.
- Never run without a reviewed dry-run from the exact same input file.
- Never infer deletion or stock changes solely because a product is absent from one response.
- Never resolve ambiguity by forcing multiple variants onto one offer.
- Never run destructive cleanup as part of onboarding.

## Pre-production checklist

### Source and security

- [ ] Source owner and retailer are identified.
- [ ] Raw snapshot is stored outside Git with retrieval time and checksum.
- [ ] No credentials, customer data, or private raw feeds are in the repository.
- [ ] The sample contains no more than 5–20 variants.

### Canonical CSV

- [ ] Header matches `data/templates/retailer-feed-template.csv`.
- [ ] There is exactly one row per variant.
- [ ] Product and variant IDs are stable and distinct.
- [ ] Direct and affiliate URLs point to the intended variant.
- [ ] Product names and slugs distinguish size, flavour, and pack variants.
- [ ] External GTINs are stored only in `external_gtin`.
- [ ] No forbidden field is present.
- [ ] `shipping_known=false` has blank `shipping_cost`.
- [ ] `shipping_known=true` has `shipping_cost >= 0`.
- [ ] `0` is used only for confirmed free shipping.
- [ ] `in_stock` and `is_for_sale` reflect the source.

### Dry-run review

- [ ] Command uses `--mode=feed --dry-run`.
- [ ] `--safe-create` is present only when creation is intended.
- [ ] Parsed row count equals the approved sample count.
- [ ] New retailers, products, and mappings match expectations.
- [ ] Invalid, unmatched, excluded, and ambiguous rows are explained.
- [ ] GTIN, external GTIN, size, pack-count, format, and collision conflicts are zero or explicitly resolved.
- [ ] Shipping and variant evidence were manually checked.
- [ ] Dry-run confirms that no database writes occurred.

### Production approval

- [ ] The exact dry-run CSV checksum is recorded.
- [ ] Human approval for the 5–20 variant write is recorded.
- [ ] No full catalogue, deletion, or missing-product reconciliation is included.
- [ ] An operator is available to stop on the first unexpected failure.
- [ ] Post-import QA queries and product-page checks are ready.
- [ ] Partial-failure recovery ownership is assigned.

### After the write

- [ ] Retailer and mappings are correct and non-duplicated.
- [ ] Offers, prices, shipping, stock, and URLs are correct.
- [ ] Price history contains only expected entries.
- [ ] Delivered prices are correct.
- [ ] External GTINs stayed external.
- [ ] Existing verified metrics and `products.gtin` did not change.
- [ ] Product pages render and link to the intended variants.
- [ ] A second dry-run shows stable matching and no new entity proposals.
