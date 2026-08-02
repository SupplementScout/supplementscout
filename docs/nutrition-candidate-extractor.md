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
4. tightly bounded numeric facts in the primary content of an official
   manufacturer page, such as `22.5 g protein per 30 g serving`, `8 g per
   serving`, or `17 g serving - 25 servings per 425 g tub`;
5. dedicated numeric properties in a JSON feed snapshot.

Product names, headings, descriptions, scripts, styles, and general marketing
copy are not scanned generally for numbers. Manufacturer prose extraction is
enabled only for `manufacturer_product_page`, is restricted to explicit fact
patterns in the current product's primary content or page meta description,
and excludes reviews, related products, upsells and cross-sells. Qualified or
ambiguous claims such as `up to 24 g` and ranges such as `20-30 servings` are
ignored. Evidence is reduced to the matched numeric phrase and carries the
`EXPLICIT_PROSE_EVIDENCE` flag. `Creatine monohydrate` is not automatically
treated as pure creatine. A direct `Creatine per serving` or `of which
creatine` value is required.

The standard extractor does not fetch product-gallery images. The separate,
local-only OCR canary can inspect images embedded in an explicitly listed
official manufacturer product page. It never follows product links or crawls a
site. It downloads at most two images per product, and only when deterministic
filename, alt/title or gallery metadata classifies them as HIGH-confidence
nutrition, supplement-facts or back-label images. MEDIUM-only selection is
skipped with `IMAGE_SELECTION_UNCERTAIN`.

JSON numbers without a unit are accepted only when the property name encodes
the unit, such as `protein_per_serving_g` or `net_volume_ml`, or when the field
is an integer serving count.

## Local OCR canary

OCR is an additional evidence path, not an approval or database-write path. It
uses Windows Media OCR locally after `sharp` has decoded, bounded and normalized
the selected JPG, PNG or WebP image. It does not use cloud OCR, Supabase, the
verified-data importer or product update code. `caffeine_per_serving_mg` remains
a future field because the current candidate and verified schemas do not fully
support it.

Create `tmp/nutrition-ocr-batch-1/pages.json` with this exact schema (one to ten
explicit official manufacturer pages; the first canary processes at most five):

```json
{
  "schema_version": 1,
  "kind": "nutrition-ocr-page-source-list-v1",
  "pages": [
    {
      "source_record_id": "gym-high-whey-pro-synergy",
      "product_id": "337",
      "product_variant_id": null,
      "product_name": "GYM HIGH Whey Pro Synergy",
      "brand": "GYM HIGH",
      "manufacturer": "GYM HIGH",
      "identity_binding": "EXACT_PRODUCT",
      "source_page_url": "https://gymhigh.co.uk/product/whey-pro-synergy/",
      "expected_domain": "gymhigh.co.uk",
      "official_domains": ["gymhigh.co.uk"],
      "notes": "Official manufacturer page approved for this bounded canary."
    }
  ]
}
```

`EXACT_PRODUCT` requires a product ID and no variant ID. `EXACT_VARIANT`
requires both. Every page requires `official_domains`; `expected_domain`, the
initial URL domain and every canonical redirect must remain in that manufacturer
allowlist. Known retailer, marketplace and comparison domains are rejected even
when an operator supplies the confirmation flag. Page and image URLs must use
HTTPS, be credential-free, have no fragment or secret-looking query parameter.
Localhost and IP-literal domains are rejected. A CDN image is eligible only when
its exact URL is directly referenced by the approved page HTML or product JSON.

The dry plan performs no fetch, image download, OCR or file write:

```text
npm run nutrition:ocr-plan -- --input=tmp/nutrition-ocr-batch-1/pages.json
```

The guarded canary command is:

```text
npm run nutrition:ocr-canary -- --input=tmp/nutrition-ocr-batch-1/pages.json --max-products=5 --confirm-official-pages-only=true --confirm-local-candidate-only=true
```

The canary fetches only the listed page and any selected HIGH-confidence image.
It rejects image redirects, SVG and non-JPG/PNG/WebP responses, limits images to
8 MB each and 40 MB total, and limits decoded images to 10,000 pixels per side
and 40 million pixels. Raw bytes, normalized images, SHA-256 hashes, OCR text,
OCR metadata, the report and candidate JSON are written only below that ignored
`tmp/` batch directory without overwriting existing provenance.

OCR-only facts are LOW confidence. A fact matching independently extracted HTML
may be MEDIUM. Per-100-g ambiguity or an HTML conflict stays LOW and carries an
explicit warning. Evidence is limited to the short matched numeric phrase. All
records remain `CANDIDATE_REQUIRES_REVIEW`. The batch workflow normalizes OCR
facts into the existing private candidate schema. For this MVP, the image file,
image SHA-256, OCR text file and OCR locator are preserved in
`source_snapshot_ref`, `source_file_sha256` and `source_locator`. Fully
structured image provenance is a later improvement and is not required to
review a product-scoped candidate safely. Variant-scoped candidates are blocked
from storage because the current table has no `product_variant_id`; the workflow
will not silently discard that identity provenance.

Windows OCR metadata also preserves word bounding boxes. The extractor may use
those coordinates to recover `protein_per_serving_g` and
`creatine_per_serving_g` from a table only when all of these conditions hold:

- one explicit serving size was extracted independently;
- the table has a `Per serving` column, or a `Per (N g)` column matching that
  serving size exactly;
- the nutrient label and numeric value occupy the same visual row;
- the value belongs unambiguously to that column rather than a `Per 100 g`
  column;
- a protein label is supported by the surrounding nutrition-table label column,
  so front-of-pack marketing text cannot be paired with a nearby table value;
- the amount does not exceed the serving size.

Failure of any condition emits no geometry-derived fact. A direct `Creatine
Monohydrate` table row can produce a LOW-confidence creatine candidate with an
explicit warning; serving size alone never implies creatine or protein content.
These are source facts only. Existing application pricing code calculates
delivered price, price per kg/litre/unit/serving, cost per 25 g protein and cost
per 5 g creatine. OCR never copies those calculated values and never sets
`unit_pricing_verified` or `nutrition_verified`.

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

Do not rename or move the generated candidate CSV into `data/verified`. It is a
candidate-only review aid, never a verified import file.

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

## End-to-end reviewed workflow

Create and store a batch of at most ten explicitly listed official manufacturer
pages:

```powershell
npm run nutrition:candidate-batch -- --input=tmp/nutrition-batch-1/pages.json --max-products=10 --confirm-official-pages-only=true --store-candidates=true
```

This command reuses the bounded page collector, HTML extractor, HIGH-only image
selection, local Windows OCR, and private candidate-table writer. It does not
crawl, follow product links, use cloud OCR, update products, create a verified
CSV, or run an importer. One page failure is recorded and the remaining listed
pages continue. OCR-only facts remain LOW confidence. The candidate artifact,
candidate-only CSV, raw snapshots, hashes, OCR text and per-product report all
remain below ignored `tmp/`.

Review the run at `/admin/nutrition-candidates?run=<run_id>`. Approval only
changes candidate review metadata. After every intended fact has been reviewed,
generate a read-only before/after plan:

```powershell
npm run nutrition:approved-plan -- --run-id=<run_id>
```

The planner reads only `approved` candidates. It blocks unmapped products,
unsupported fields, conflicting approved values, and unsafe conflict or
ambiguity warnings. Its JSON output is written below
`tmp/nutrition-approved-plan/` and performs no database write.

After separately reviewing that plan, apply exactly its reviewed changes:

```powershell
npm run nutrition:approved-apply -- --plan=tmp/nutrition-approved-plan/<plan>.json --confirm-reviewed-product-update=true
```

Apply rechecks candidate approval and fingerprints plus each product's planned
before value inside one production-owner PostgreSQL transaction. It validates
the existing production project identity, locks the reviewed rows, and rolls the
whole batch back on an error. It can update only the seven nutrition fields
documented above on `products`; it cannot update offers, retailer products,
GTIN, prices, verification flags, or any pending/rejected candidate. A successful
audit JSON is written below `tmp/`.
