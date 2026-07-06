# Verified Product Data Import

This workflow reviews verified normalized product-data updates from CSV. Data must come from an authoritative product label, manufacturer, or retailer source. Do not infer verified values from product names, categories, package weights, or blends.

## CSV format

Required column:

- `id`

Optional update columns:

- `net_weight_g`
- `net_volume_ml`
- `serving_count_verified`
- `serving_size_g`
- `serving_size_ml`
- `protein_per_serving_g`
- `creatine_per_serving_g`
- `unit_count`
- `unit_type`
- `product_format`
- `unit_pricing_verified`
- `nutrition_verified`

Optional audit-only columns:

- `expected_name`
- `source`
- `notes`

`expected_name` is only a safety check. When present, it must exactly match the current product name after trimming. It is never used to identify or update a product.

Blank cells mean unchanged. Blank cells never clear existing database values in V1.

## Validation rules

IDs must be positive integer strings and must identify an existing product. Duplicate IDs in one CSV are rejected. Product names are not used for matching.

Numeric fields:

- `net_weight_g` must be greater than 0.
- `net_volume_ml` must be greater than 0.
- `serving_count_verified` must be a positive integer.
- `serving_size_g` must be greater than 0.
- `serving_size_ml` must be greater than 0.
- `protein_per_serving_g` must be 0 or greater.
- `creatine_per_serving_g` must be 0 or greater.
- `unit_count` must be a positive integer.

Cross-field rules use the effective value after applying the proposed update to the current row:

- `protein_per_serving_g` cannot exceed `serving_size_g` when both are known.
- `creatine_per_serving_g` cannot exceed `serving_size_g` when both are known.

Liquid-specific rules:

- Liquid products must use `product_format = liquid`.
- Liquid products must use `net_volume_ml` instead of `net_weight_g`.
- Liquid products must use `serving_size_ml` instead of `serving_size_g`.
- `net_volume_ml` and `serving_size_ml` are rejected for non-liquid products.
- Liquid rows with `unit_pricing_verified = true` require `net_volume_ml`.
- `serving_size_ml` is optional for price-per-litre calculations.

Boolean fields accept `true`, `1`, `yes`, `y`, `false`, `0`, `no`, and `n`, case-insensitively.

Allowed `product_format` values:

- `powder`
- `capsule`
- `tablet`
- `gummy`
- `liquid`
- `food`
- `bar`
- `sachet`
- `accessory`
- `clothing`
- `other`

Allowed `unit_type` values:

- `capsule`
- `tablet`
- `gummy`
- `sachet`
- `serving`
- `scoop`

Verification flag requirements:

- `unit_pricing_verified = true` requires `serving_count_verified`, `net_weight_g`, or `unit_count` after the update for non-liquid products.
- Liquid `unit_pricing_verified = true` requires `net_volume_ml` after the update.
- `nutrition_verified = true` requires `protein_per_serving_g` or `creatine_per_serving_g` after the update.

## Commands

Dry run:

```bash
node scripts/import-verified-product-data.js data/verified/gym-high-verified-products.csv
```

Apply:

```bash
node scripts/import-verified-product-data.js data/verified/gym-high-verified-products.csv --apply
```

`--apply` is intentionally disabled in V1. The current Supabase JavaScript client path cannot guarantee one transaction across multiple updates, and this milestone does not add a service-role RPC because schema changes are out of scope.

## Reviewing output

The dry run prints each row with:

- product ID
- current product name
- changed fields only
- old value
- proposed value
- validation result
- row errors

The summary prints:

- total rows
- valid rows
- invalid rows
- products to update
- fields to change
- apply allowed

When valid rows have changes, the script also prints review SQL wrapped in `begin;` and `rollback;` for manual review. Replace `rollback;` only after reviewing all proposed changes and row counts.

## Atomicity

V1 is dry-run only for writes. No database writes are performed by the script, and `--apply` fails closed. A future apply implementation should use a service-role-only PostgreSQL RPC so all rows update in one transaction.

## Example CSV

```csv
id,expected_name,net_weight_g,net_volume_ml,serving_count_verified,serving_size_g,serving_size_ml,protein_per_serving_g,creatine_per_serving_g,unit_count,unit_type,product_format,unit_pricing_verified,nutrition_verified,source,notes
529,GYM HIGH Creatine Monohydrate 400g,400,,80,,,,5,,,powder,true,true,manufacturer label,verified from label
```
