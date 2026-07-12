# KIOR Shopify adapter

The KIOR adapter combines the public Shopify catalogue with an approved product mapping. If a local Shopify CSV is present, it is used only as an additional drift check. The adapter generates the existing canonical retailer feed and always runs the existing importer in dry-run mode.

## Required inputs

- public JSON: `https://kior.uk/products.json?limit=250`;
- optional local Shopify export: `data/feeds/kior/products_export.csv`;
- approved mapping: `config/retailers/kior-shopify.json`;
- canonical header: `data/templates/retailer-feed-template.csv`.

Run from the repository root:

```powershell
node scripts/adapters/kior-shopify.js
```

Successful output is written atomically to ignored local paths:

- `tmp/retailer-feeds/kior/kior-canonical-generated.csv`;
- `tmp/retailer-feeds/kior/kior-adapter-report.json`.

The adapter then invokes only:

```powershell
node scripts/import-products.js --mode=feed --dry-run --csv=<generated.csv>
```

It never adds `--safe-create`, never applies changes, and never deletes records.

The adapter accepts no CLI arguments. It automatically runs JSON-only when the local export is absent. When the export exists, every configured handle must have exactly one main row and its SKU/barcode evidence must match the approved `expected_sku` and `expected_barcode` values in config. The CSV never overrides config and is never the source of canonical output. Canonical `external_gtin` comes only from `expected_barcode`; an approved `null` produces an empty cell.

## Safety and review

The run fails before final reporting on an invalid or incomplete response, duplicate or missing configured IDs, changed handles or variants, public JSON SKU/barcode drift, optional CSV drift or ambiguous joins, invalid images or URLs, invalid or excessive price changes, excessive stock changes, incomplete shipping policy, a mismatch between configured canonical ID and slug in the read-only Supabase check, or any incomplete importer dry-run result.

Products returned by Shopify but absent from the approved mapping are listed under `unmapped_products`; no canonical row is produced for them. Review and approve their canonical identity and product metadata before adding them to the config.

A configured product missing from Shopify blocks the complete run. Do not mark it out of stock. Confirm the source with a later successful fetch and investigate the Shopify product before changing the mapping.

Review the complete adapter report, hashes, row count, mapped/unmapped lists, price and stock changes, then review every section of the importer preflight. Generated output is evidence for review only and must not be used for automatic apply.

Never commit raw Shopify JSON, retailer exports, generated feeds, credentials, or `.env` files. The repository `tmp/` directory and `data/feeds/` exports remain ignored by Git.
