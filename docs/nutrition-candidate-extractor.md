# Nutrition Candidate Extractor

The Nutrition Candidate Extractor creates review-only numeric fact candidates
from approved local source snapshots. It does not fetch pages, query or update
the database, set verification flags, or create import SQL.

This is deliberately separate from
`scripts/import-verified-product-data.js`. Extraction produces candidates;
only a later human-reviewed artifact may enter the existing verified-data
workflow.

## Safety boundary

- Offline local files only. The CLI has no network or Supabase dependency.
- `--offline` and `--confirm-candidates-only=true` are mandatory.
- There is no `--apply` option.
- Output is confined to the ignored repository `tmp` directory. Real-path
  checks reject symbolic-link and junction escapes.
- Every snapshot is byte-size bounded and SHA-256 checked before parsing.
- Snapshot paths cannot escape the manifest directory.
- Source URLs must be credential-free HTTPS, cannot contain fragments, and
  cannot contain token, secret, signature, password, auth, credential, signed
  request, or API-key query parameters.
- Product, retailer, mapping, and optional variant IDs remain strings.
- Candidate artifacts never contain `nutrition_verified` or
  `unit_pricing_verified`.
- Raw source snapshots and generated candidate artifacts must not be committed.

## Supported candidate fields

- `protein_per_serving_g`
- `creatine_per_serving_g`
- `serving_size_g`
- `serving_count_verified`
- `net_weight_g`
- `net_volume_ml`
- `serving_size_ml`

One output row represents one candidate fact. The extractor never derives a
missing value from other values. Package arithmetic is used only to flag
inconsistency.

## Accepted evidence

The deterministic parser checks, in order:

1. dedicated JSON-LD numeric properties;
2. semantic HTML table cells, including an explicit `Per serving` column;
3. short visible label-value lines such as `Protein per serving: 24 g`;
4. dedicated numeric properties in a JSON feed snapshot.

Product names, headings, descriptions, scripts, styles, and general marketing
copy are not scanned for numbers. `Creatine monohydrate` is not automatically
treated as pure creatine. A direct `Creatine per serving` or `of which
creatine` value is required.

JSON numbers without a unit are accepted only when the property name encodes
the unit, such as `protein_per_serving_g` or `net_volume_ml`, or when the field
is an integer serving count.

## Source manifest

Keep the manifest and its referenced snapshots together below an ignored
directory such as `tmp/nutrition-source-batch-1/`.

```json
{
  "schema_version": 1,
  "kind": "nutrition-candidate-source-snapshot-v1",
  "mode": "OFFLINE",
  "captured_at": "2026-08-02T10:00:00.000Z",
  "records": [
    {
      "source_record_id": "retailer-product-501",
      "product_id": "178",
      "product_variant_id": "733",
      "retailer_id": "11",
      "retailer_product_id": "9001",
      "source_url": "https://retailer.example/product/example/?variant=733",
      "source_type": "retailer_product_page",
      "identity_binding": "EXACT_VARIANT",
      "snapshot_file": "product-501.html",
      "snapshot_sha256": "<lowercase SHA-256>",
      "content_type": "text/html",
      "current_values": {
        "net_weight_g": null,
        "serving_count_verified": null,
        "serving_size_g": null,
        "protein_per_serving_g": null,
        "creatine_per_serving_g": null,
        "net_volume_ml": null
      }
    }
  ]
}
```

Allowed source types are `retailer_product_page`, `retailer_feed`, and
`manufacturer_product_page`. Allowed identity bindings are:

- `EXACT_VARIANT`: requires `product_variant_id`; identity confidence `HIGH`.
- `EXACT_PRODUCT`: product is exact but variant applicability is not proved;
  identity confidence `MEDIUM`.
- `LEGACY_PRODUCT_URL`: legacy mapping without exact source variant identity;
  identity confidence `LOW`.

Create the lowercase snapshot hash in PowerShell:

```powershell
(Get-FileHash -Algorithm SHA256 'tmp/nutrition-source-batch-1/product-501.html').Hash.ToLowerInvariant()
```

## Run

All manifest records:

```powershell
npm run nutrition:candidates -- --offline --confirm-candidates-only=true --input=tmp/nutrition-source-batch-1/manifest.json
```

Filter the offline manifest by one or more canonical product or retailer IDs:

```powershell
npm run nutrition:candidates -- --offline --confirm-candidates-only=true --input=tmp/nutrition-source-batch-1/manifest.json --product-id=178 --retailer-id=11
```

The default output is:

```text
tmp/nutrition-candidates/nutrition-candidates-<run-id>.json
tmp/nutrition-candidates/nutrition-candidates-<run-id>.csv
```

The same manifest bytes, filters, and source snapshots produce byte-stable
artifacts. Existing output is accepted only when it is byte-identical.

## Review rules

Every JSON candidate and CSV row is explicitly marked
`candidate_status=CANDIDATE_REQUIRES_REVIEW` and starts with
`review_status=PENDING`. `HIGH` confidence is not verification.

Reviewers must confirm:

- exact product and variant identity;
- package size and flavour applicability;
- per-serving rather than per-100-g basis;
- dry product rather than prepared-product basis;
- active ingredient rather than compound weight;
- reformulation and retailer inventory risk;
- agreement with the current authoritative label;
- every conflict or consistency flag.

Important flags include:

- `APPROXIMATE_VALUE`
- `MULTIPLE_PARSER_EVIDENCE`
- `MULTIPLE_JSON_LD_PRODUCTS`
- `CONFLICTING_SOURCE_VALUES`
- `CROSS_SOURCE_CONFLICT`
- `NUTRIENT_EXCEEDS_SERVING_SIZE`
- `PACKAGE_SERVING_MISMATCH`

Conflicting or inconsistent candidates remain visible and are forced to `LOW`
overall confidence. The extractor never chooses a winning value.

## Handoff to verified data

There is intentionally no automatic handoff. After owner review, create a
separate reviewed CSV matching `docs/verified-product-data-import.md`, or a
reviewed variant nutrition manifest where the existing variant pathway is
applicable. Run that existing workflow independently with its own evidence,
hash, dry run, and approval.

Do not rename or move the generated candidate CSV into `data/verified`.

## Controlled manufacturer collection

The collector accepts one to ten explicit official manufacturer URLs. It does
not crawl, discover links, read sitemaps, or follow cross-domain redirects.
Dry-plan mode validates the list and performs zero requests and zero writes:

```powershell
npm run nutrition:manufacturer-plan -- --dry-plan --input=tmp/manufacturer-source-batch-1/sources.json
```

Collection is deliberately unavailable without both confirmations below.
They mean an owner has reviewed robots.txt, Terms/permission, and every exact
URL in the input list:

```powershell
npm run nutrition:manufacturer-plan -- --collect-approved --confirm-explicit-urls-only=true --confirm-robots-terms-reviewed=true --input=tmp/manufacturer-source-batch-1/sources.json
```

The collector enforces HTTPS, expected-domain matching, credential and secret
query rejection, same-domain redirects only, a 15-second timeout, a 1.5-second
inter-request delay, a 2 MB streamed response limit, and exact-byte snapshot
hashing. Raw HTML and its v2 extractor manifest stay below ignored `tmp/`.
Manufacturer records never invent retailer IDs. An unknown product mapping is
recorded as `UNMAPPED_SOURCE` and forces low identity confidence.

No manufacturer request should be made merely because a URL appears in a
catalogue. Dry-plan output is not fetch approval.

## Private admin review queue

Migration `20260802100000_create_nutrition_candidates.sql` creates a private,
RLS-enabled candidate table. It grants access only to `service_role`, has no
public policies, constrains fields and units, and makes source evidence
immutable after insert. A candidate can move only once, from `pending` to
`approved` or `rejected`.

Validate an extracted JSON artifact without touching Supabase:

```powershell
npm run nutrition:candidates:store -- --dry-run --input=tmp/nutrition-candidates/nutrition-candidates-<run-id>.json
```

Only after the migration and artifact have been reviewed, explicitly stage
the candidates in the private table:

```powershell
npm run nutrition:candidates:store -- --store-candidates --confirm-candidate-table-only=true --input=tmp/nutrition-candidates/nutrition-candidates-<run-id>.json
```

The storage command uses server-side service-role credentials and writes only
`nutrition_candidates`. Duplicate fingerprints are ignored. It never updates
`products`, creates a verified CSV, or runs the verified importer.

The authenticated page `/admin/nutrition-candidates` shows pending, approved,
and rejected candidates. Approve and Reject update review metadata only;
approval is not product verification and has no automatic downstream effect.
