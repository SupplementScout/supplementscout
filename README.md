# SupplementScout

SupplementScout is a UK supplement search and comparison platform. Its primary
goal is to help users decide what to buy, where to buy it and why an option
offers good value, using trustworthy canonical product identity and total
delivered prices.

## Source of truth

Start with
[SupplementScout Operating Plan](docs/SupplementScout-Operating-Plan-2026-07-15.md).
Its newest binding checkpoint overrides historical sections and records the
current goal, production state, active task, next task and deferred work.

Operational references:

- [Retailer Data Source Registry](docs/Retailer-Data-Source-Registry.md)
- [Retailer onboarding runbook](docs/retailer-onboarding-runbook.md)
- [Product matching review](docs/product-matching-review.md)
- [Database migrations](docs/database-migrations.md)

## Architecture

- `products` and `product_variants`: canonical product identity
- `retailer_products`: exact retailer-to-canonical mappings
- `offers` and `price_history`: volatile price, shipping, stock and history
- `app/lib/products.ts`: public search, ranking, filters and suggestions
- `scripts/`: reviewed import, matching, refresh, audit and verification tools
- `supabase/migrations/`: versioned database changes

Routine retailer automation may update approved mappings and volatile offer
fields only. It must not create or change canonical identity automatically.
SARMs, real/research peptides and products positively evidenced as already
expired at capture time are globally excluded.

## Local verification

```powershell
npm run verify:baseline
npm run lint
npm run build
```

Search regression tests:

```powershell
node --test scripts/search.test.js scripts/search-ux.test.js scripts/search-analytics.test.js scripts/search-analytics-report.test.js
```

The production branch is `main`. Production data writes require the relevant
reviewed, target-bound workflow and explicit approval; a successful local build
does not authorise a data write.
