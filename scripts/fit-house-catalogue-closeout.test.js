const assert = require("node:assert/strict");
const crypto = require("node:crypto");
const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");
const { parse } = require("csv-parse/sync");

const root = path.resolve(__dirname, "..");
const manifestPath = path.join(
  root,
  "config/retailers/fit-house-catalogue-closeout-a301eaa3.json",
);
const rebindPath = path.join(
  root,
  "data/feeds/fit-house/fit-house-approved-rebind-73.csv",
);
const closeoutPath = path.join(
  root,
  "data/feeds/fit-house/fit-house-closeout-128.csv",
);
const config = require("../config/retailers/fit-house-shopify.json");
const manifest = JSON.parse(fs.readFileSync(manifestPath, "utf8"));
const rebindBytes = fs.readFileSync(rebindPath);
const closeoutBytes = fs.readFileSync(closeoutPath);
const rebindRows = parse(rebindBytes, { columns: true, skip_empty_lines: true });
const closeoutRows = parse(closeoutBytes, { columns: true, skip_empty_lines: true });

const sha256 = (bytes) => crypto.createHash("sha256").update(bytes).digest("hex");
const key = (row) => `${row.external_product_id}:${row.external_variant_id}`;

test("Fit House closeout scope reconciles every approved non-duplicate catalogue variant", () => {
  assert.equal(manifest.source_fingerprint,
    "a301eaa3b9cb54910c2857aef3f46513f091c9dd447f94191be3e0f8f9a6d58e");
  assert.deepEqual(manifest.exclusions, {
    prohibited_sarm_or_real_peptide: 7,
    cosmetics: 4,
    dated_product_or_variant: 21,
    duplicate_source_listing: 1,
  });
  assert.equal(manifest.previously_approved_rebind_products, 67);
  assert.equal(manifest.new_review_source_products, 63);
  assert.equal(manifest.decisions.length, 63);
  assert.equal(manifest.decisions.filter((row) =>
    row.classification === "MAP_EXISTING_CANONICAL").length, 6);
  assert.equal(manifest.decisions.filter((row) =>
    row.classification === "CREATE_REVIEWED_CANONICAL").length, 56);
  assert.equal(manifest.decisions.filter((row) =>
    row.classification === "EXCLUDE_DUPLICATE_SOURCE_LISTING").length, 1);
  assert.equal(manifest.reviewed_new_canonical_products.length, 56);
  assert.equal(manifest.reviewed_new_canonical_variants.length, 117);
  assert.equal(manifest.reviewed_existing_product_variant_creates.length, 16);
  assert.equal(manifest.reviewed_new_source_bindings.length, 99);
  assert.equal(manifest.reviewed_existing_target_bindings.length, 7);
  assert.equal(manifest.reviewed_partial_source_bindings.length, 22);
});

test("Fit House closeout CSVs are immutable, disjoint and exactly source-bound", () => {
  assert.equal(rebindRows.length, 73);
  assert.equal(closeoutRows.length, 128);
  assert.equal(sha256(rebindBytes),
    "02e83c30ef98f6f345fa16623a06e53b5debea47c590610e3b66acacecb63bd5");
  assert.equal(sha256(closeoutBytes),
    "3dd4b505dd024ef33a77acbc923792d94c5c83a69e840657778fe163f3de16e1");
  const rebindKeys = new Set(rebindRows.map(key));
  const closeoutKeys = new Set(closeoutRows.map(key));
  assert.equal(rebindKeys.size, 73);
  assert.equal(closeoutKeys.size, 128);
  assert.equal([...rebindKeys].filter((value) => closeoutKeys.has(value)).length, 0);
  const configured = new Set(
    config.products
      .filter((row) => row.verification_only !== true)
      .map((row) => `${row.shopify_product_id}:${row.shopify_variant_id}`),
  );
  assert.deepEqual([...rebindKeys].sort(), [...configured].sort());
  const manifestBindings = [
    ...manifest.reviewed_new_source_bindings,
    ...manifest.reviewed_existing_target_bindings,
    ...manifest.reviewed_partial_source_bindings,
  ].map(key);
  assert.deepEqual([...closeoutKeys].sort(), manifestBindings.sort());
});

test("Fit House closeout preserves commercial and catalogue safety rules", () => {
  const rows = [...rebindRows, ...closeoutRows];
  const prohibited = /\b(?:sarms?|ostarine|ligandrol|testolone|cardarine|ibutamoren|bpc[-\s]?157|tb[-\s]?500|cortagen|selank|semax|ghk[-\s]?cu|kpv)\b/i;
  const dated = /\b(?:exp(?:iry|ires?)?\.?|bbe|best\s+before)\s*[:.]?\s*(?:\d|[a-z])/i;
  assert.ok(rows.every((row) => !prohibited.test(`${row.product_name} ${row.variant_name}`)));
  assert.ok(rows.every((row) => !dated.test(`${row.product_name} ${row.variant_name}`)));
  assert.ok(rows.every((row) => row.retailer_name === "Fit House"));
  assert.ok(rows.every((row) => row.shipping_known === "true" && row.shipping_cost === "3.99"));
  assert.ok(rows.every((row) =>
    new URL(row.external_url).hostname === "fithouse.uk"
    && row.external_url === row.affiliate_url));
  assert.ok(rows.every((row) => !row.total_price ||
    Number(row.total_price).toFixed(2)
      === (Number(row.price) + Number(row.shipping_cost)).toFixed(2)));
  assert.ok(manifest.reviewed_new_canonical_products.every((product) =>
    product.category !== "Cosmetics" && !prohibited.test(product.name) && !dated.test(product.name)));
});
