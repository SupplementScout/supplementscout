# KIOR Shopify adapter

The KIOR adapter combines the public Shopify catalogue with the locally supplied Shopify CSV and an approved product mapping. It generates the existing canonical retailer feed and always runs the existing importer in dry-run mode.

## Required inputs

- public JSON: `https://kior.uk/products.json?limit=250`;
- local Shopify export: `data/feeds/kior/products_export.csv`;
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

## Safety and review

The run fails before final CSV generation on an invalid or incomplete response, duplicate or missing configured IDs, changed handles or variants, ambiguous CSV joins, SKU conflicts, invalid or excessive price changes, excessive stock changes, incomplete shipping policy, or a mismatch between configured canonical ID and slug in the read-only Supabase check.

Products returned by Shopify but absent from the approved mapping are listed under `unmapped_products`; no canonical row is produced for them. Review and approve their canonical identity and product metadata before adding them to the config.

A configured product missing from Shopify blocks the complete run. Do not mark it out of stock. Confirm the source with a later successful fetch and investigate the Shopify product before changing the mapping.

Review the complete adapter report, hashes, row count, mapped/unmapped lists, price and stock changes, then review every section of the importer preflight. Generated output is evidence for review only and must not be used for automatic apply.

Never commit raw Shopify JSON, retailer exports, generated feeds, credentials, or `.env` files. The repository `tmp/` directory and `data/feeds/` exports remain ignored by Git.
