const assert = require("node:assert/strict");
const fs = require("node:fs");
const test = require("node:test");
const manifest = require("../config/retailers/10reps-reviewed-bindings-v1.json");
const exactOosManifest = require("../config/retailers/10reps-reviewed-bindings-v2-exact-oos-24.json");
const review22Manifest = require("../config/retailers/10reps-reviewed-bindings-v3-existing-variant-22.json");
const reviewRemaining14Manifest = require("../config/retailers/10reps-reviewed-bindings-v3-existing-variant-remaining-14.json");
const runner = require("./10reps-bootstrap-artifact-approver");
const { PROFILE, REMAINING_PROFILE, EXACT_OOS_PROFILE, REVIEW_22_PROFILE, REVIEW_REMAINING_14_PROFILE } = runner;
const options = { artifact: PROFILE.artifact, csv: PROFILE.csv, planFingerprint: PROFILE.fingerprint };
const remainingOptions = { artifact: REMAINING_PROFILE.artifact, csv: REMAINING_PROFILE.csv, planFingerprint: REMAINING_PROFILE.fingerprint };
const exactOosOptions = { artifact: EXACT_OOS_PROFILE.artifact, csv: EXACT_OOS_PROFILE.csv, planFingerprint: EXACT_OOS_PROFILE.fingerprint };
const review22Options = { artifact: REVIEW_22_PROFILE.artifact, csv: REVIEW_22_PROFILE.csv, planFingerprint: REVIEW_22_PROFILE.fingerprint };
const reviewRemaining14Options = { artifact: REVIEW_REMAINING_14_PROFILE.artifact, csv: REVIEW_REMAINING_14_PROFILE.csv, planFingerprint: REVIEW_REMAINING_14_PROFILE.fingerprint };
const remainingTimes = [
  "2026-09-06T06:06:33.228Z", "2026-09-06T06:06:33.231Z", "2026-09-06T06:06:33.232Z", "2026-09-06T06:06:33.232Z", "2026-09-06T06:06:33.233Z",
  "2026-09-06T06:06:33.235Z", "2026-09-06T06:06:33.235Z", "2026-09-06T06:06:33.236Z", "2026-09-06T06:06:33.237Z", "2026-09-06T06:06:33.237Z",
  "2026-09-06T06:06:33.238Z", "2026-09-06T06:06:33.238Z", "2026-09-06T06:06:33.239Z", "2026-09-06T06:06:33.240Z", "2026-09-06T06:06:33.240Z",
  "2026-09-06T06:06:33.241Z", "2026-09-06T06:06:33.241Z", "2026-09-06T06:06:33.242Z", "2026-09-06T06:06:33.243Z",
];
const exactOosTimes = [
  "2026-09-06T08:46:17.539Z", "2026-09-06T08:46:17.544Z", "2026-09-06T08:46:17.545Z", "2026-09-06T08:46:17.546Z",
  "2026-09-06T08:46:17.548Z", "2026-09-06T08:46:17.549Z", "2026-09-06T08:46:17.550Z", "2026-09-06T08:46:17.551Z",
  "2026-09-06T08:46:17.552Z", "2026-09-06T08:46:17.553Z", "2026-09-06T08:46:17.554Z", "2026-09-06T08:46:17.555Z",
  "2026-09-06T08:46:17.556Z", "2026-09-06T08:46:17.556Z", "2026-09-06T08:46:17.557Z", "2026-09-06T08:46:17.558Z",
  "2026-09-06T08:46:17.560Z", "2026-09-06T08:46:17.561Z", "2026-09-06T08:46:17.561Z", "2026-09-06T08:46:17.562Z",
  "2026-09-06T08:46:17.562Z", "2026-09-06T08:46:17.563Z", "2026-09-06T08:46:17.563Z", "2026-09-06T08:46:17.564Z",
];
const review22Times = [
  "2026-09-06T09:59:18.696Z", "2026-09-06T09:59:18.701Z", "2026-09-06T09:59:18.703Z", "2026-09-06T09:59:18.704Z",
  "2026-09-06T09:59:18.706Z", "2026-09-06T09:59:18.707Z", "2026-09-06T09:59:18.708Z", "2026-09-06T09:59:18.708Z",
  "2026-09-06T09:59:18.709Z", "2026-09-06T09:59:18.710Z", "2026-09-06T09:59:18.710Z", "2026-09-06T09:59:18.711Z",
  "2026-09-06T09:59:18.712Z", "2026-09-06T09:59:18.712Z", "2026-09-06T09:59:18.713Z", "2026-09-06T09:59:18.713Z",
  "2026-09-06T09:59:18.714Z", "2026-09-06T09:59:18.714Z", "2026-09-06T09:59:18.715Z", "2026-09-06T09:59:18.716Z",
  "2026-09-06T09:59:18.716Z", "2026-09-06T09:59:18.717Z",
];
const reviewRemaining14Times = [
  "2026-09-06T10:18:02.117Z", "2026-09-06T10:18:02.120Z", "2026-09-06T10:18:02.121Z", "2026-09-06T10:18:02.121Z",
  "2026-09-06T10:18:02.122Z", "2026-09-06T10:18:02.123Z", "2026-09-06T10:18:02.124Z", "2026-09-06T10:18:02.125Z",
  "2026-09-06T10:18:02.126Z", "2026-09-06T10:18:02.126Z", "2026-09-06T10:18:02.127Z", "2026-09-06T10:18:02.127Z",
  "2026-09-06T10:18:02.128Z", "2026-09-06T10:18:02.129Z",
];

// Synthetic package built entirely from committed reviewed identities. No
// ignored artifact, credential file, network or real database is used by tests.
function fixture() {
  const reviewed = structuredClone(manifest);
  const csvRows = reviewed.rows.map(r => ({
    retailer_name: "10 Reps", retailer_website: "https://www.10reps.co.uk/", external_product_id: r.external_product_id, external_variant_id: r.external_variant_id,
    product_name: r.external_name, variant_name: r.variant_name, brand: r.brand, category: r.category, description: "", image: r.image_url, slug: r.canonical_slug,
    external_url: r.source_url, affiliate_url: r.source_url, external_gtin: r.external_gtin || "", price: r.price.toFixed(2), shipping_known: "true", shipping_cost: "3.99",
    in_stock: "true", is_for_sale: "true", size: String(r.size), size_unit: r.size_unit, flavour: r.flavour, product_format: r.product_format, pack_count: "",
    source_updated_at: r.source_updated_at, external_sku: r.external_sku || "", external_options: JSON.stringify({ Flavour: r.flavour, Size: r.source_size }), product_id: String(r.product_id), product_variant_id: String(r.product_variant_id),
  }));
  const artifact = { artifact_version: "1", row_count: "20", run_id: reviewed.dry_run.run_id, source_file_sha256: PROFILE.csvSha256, blocked_rows: [], plans: [], source_rows: [], summary: { blocked_row_count: "0", plan_count: "20", skipped_row_count: "0" } };
  for (let i = 0; i < 20; i++) {
    const r = reviewed.rows[i], csv = csvRows[i];
    const source = { ...csv, variant: r.variant_name, size: `${r.size} ${r.size_unit}` };
    const sourceHash = runner.sourceFingerprint(source);
    const flavour = r.flavour.toLowerCase().replace(/&/g, "and");
    const plan = {
      approval: { approval_type: "none", approved: false },
      expected_state: { offer: null, retailer: null, retailer_product: null,
        product: { id: String(r.product_id), is_active: true, merged_into_product_id: null, name: r.canonical_product, product_format: r.product_format },
        product_variant: { display_name: r.canonical_variant, flavour_code: flavour, flavour_label: r.canonical_flavour, id: String(r.product_variant_id), is_active: true, is_default: false, pack_count: String(r.pack_count), product_format: r.product_format, product_id: String(r.product_id), size_unit: r.size_unit, size_value: String(r.size), variant_key: `${flavour.replace(/\s+/g, "-")}-${r.size}${r.size_unit}` },
      },
      meta: { operation_type: "standard_import", plan_fingerprint: null, plan_kind: "feed", source_row_fingerprint: sourceHash, version: "2" },
      offer: { action: "create", values: { in_stock: true, last_checked_at: "2026-09-06T05:06:33.201Z", price: r.price.toFixed(2), shipping_cost: "3.99", total_price: r.delivered_price.toFixed(2), url: r.source_url } },
      price_history: { action: "create" }, product: { action: "existing", id: String(r.product_id) },
      product_variant: { action: "existing", evidence: { approved_mapping_id: null, external_options: { Flavour: r.flavour, Size: r.source_size }, flavour, pack_count: null, product_format: r.product_format, size_unit: r.size_unit, size_value: String(r.size) }, id: String(r.product_variant_id) },
      retailer: { action: "create", values: { name: "10 Reps", slug: "10-reps", website: "https://www.10reps.co.uk/" } },
      retailer_product: { action: "create", values: { external_gtin: r.external_gtin, external_name: r.external_name, external_options: { Flavour: r.flavour, Size: r.source_size }, external_product_id: r.external_product_id, external_sku: r.external_sku, external_slug: r.canonical_slug, external_url: r.source_url, external_variant_id: r.external_variant_id, match_confidence: "90", match_method: "slug", product_variant_id: String(r.product_variant_id) } },
    };
    const fingerprint = runner.planFingerprint(plan); plan.meta.plan_fingerprint = fingerprint; r.plan_fingerprint = fingerprint;
    artifact.plans.push({ operation_type: "standard_import", plan_fingerprint: fingerprint, plan_kind: "feed", resolved_plan: plan, retailer_id: null, row_number: String(i + 2), source_row_fingerprint: sourceHash });
    artifact.source_rows.push({ normalized_source_row: source, plan_fingerprint: fingerprint, row_number: String(i + 2), source_row_fingerprint: sourceHash, status: "planned" });
  }
  assert.equal(artifact.plans[0].plan_fingerprint, PROFILE.fingerprint);
  return { manifest: reviewed, artifact, csvRows };
}
function validate(f) { return runner.validatePackage(f.manifest, f.artifact, f.csvRows); }
function remainingFixture() {
  const original = fixture();
  const reviewed = original.manifest;
  const csvRows = original.csvRows.slice(1);
  const artifact = { artifact_version: "1", row_count: "19", run_id: "10reps-remaining-19-test", source_file_sha256: REMAINING_PROFILE.csvSha256, blocked_rows: [], plans: [], source_rows: [], summary: { blocked_row_count: "0", plan_count: "19", skipped_row_count: "0" } };
  for (let i = 0; i < 19; i++) {
    const reviewedRow = reviewed.rows[i + 1], source = { ...csvRows[i], variant: csvRows[i].variant_name, size: `${csvRows[i].size} ${csvRows[i].size_unit}` };
    const sourceHash = runner.sourceFingerprint(source);
    const plan = structuredClone(original.artifact.plans[i + 1].resolved_plan);
    plan.expected_state.retailer = { id: "14", name: "10 Reps", slug: "10-reps", website: "https://www.10reps.co.uk/" };
    plan.retailer = { action: "existing", id: "14" };
    plan.offer.values.last_checked_at = remainingTimes[i];
    plan.meta.source_row_fingerprint = sourceHash;
    plan.meta.plan_fingerprint = null;
    const fingerprint = runner.planFingerprint(plan);
    assert.equal(fingerprint, REMAINING_PROFILE.allowedFingerprints[i]);
    plan.meta.plan_fingerprint = fingerprint;
    assert.equal(plan.retailer_product.values.external_variant_id, reviewedRow.external_variant_id);
    artifact.plans.push({ operation_type: "standard_import", plan_fingerprint: fingerprint, plan_kind: "feed", resolved_plan: plan, retailer_id: "14", row_number: String(i + 2), source_row_fingerprint: sourceHash });
    artifact.source_rows.push({ normalized_source_row: source, plan_fingerprint: fingerprint, row_number: String(i + 2), source_row_fingerprint: sourceHash, status: "planned" });
  }
  return { manifest: reviewed, artifact, csvRows };
}
function validateRemaining(f, fingerprint = REMAINING_PROFILE.fingerprint) { return runner.validatePackage(f.manifest, f.artifact, f.csvRows, REMAINING_PROFILE, fingerprint); }
function exactOosFixture() {
  const reviewed = structuredClone(exactOosManifest);
  const csvRows = reviewed.rows.map(r => ({
    retailer_name: "10 Reps", retailer_website: "https://www.10reps.co.uk/", external_product_id: r.external_product_id, external_variant_id: r.external_variant_id,
    product_name: r.external_name, variant_name: r.variant_name, brand: r.brand, category: r.category, description: "", image: r.image_url, slug: r.canonical_slug,
    external_url: r.source_url, affiliate_url: r.source_url, external_gtin: r.external_gtin || "", price: r.price.toFixed(2), shipping_known: "true", shipping_cost: "3.99",
    in_stock: "false", is_for_sale: "true", size: String(r.size), size_unit: r.size_unit, flavour: r.flavour, product_format: r.product_format, pack_count: String(r.pack_count),
    source_updated_at: r.source_updated_at, external_sku: r.external_sku || "", external_options: JSON.stringify({ Flavour: r.flavour, Size: r.source_size }), product_id: String(r.product_id), product_variant_id: String(r.product_variant_id),
  }));
  const artifact = { artifact_version: "1", row_count: "24", run_id: "10reps-exact-oos-24-test", source_file_sha256: EXACT_OOS_PROFILE.csvSha256, blocked_rows: [], plans: [], source_rows: [], summary: { blocked_row_count: "0", plan_count: "24", skipped_row_count: "0" } };
  for (let i = 0; i < 24; i++) {
    const r = reviewed.rows[i], csv = csvRows[i];
    const source = { ...csv, variant: `${r.variant_name} pack of ${r.pack_count}`, size: `${r.size} ${r.size_unit}` };
    const sourceHash = runner.sourceFingerprint(source);
    const flavour = r.flavour.toLowerCase().replace(/&/g, "and");
    const plan = {
      approval: { approval_type: "none", approved: false },
      expected_state: {
        offer: null,
        product: { id: String(r.product_id), is_active: true, merged_into_product_id: null, name: r.canonical_product, product_format: r.product_format },
        product_variant: { display_name: r.canonical_variant, flavour_code: flavour, flavour_label: r.canonical_flavour, id: String(r.product_variant_id), is_active: true, is_default: false, pack_count: String(r.pack_count), product_format: r.product_format, product_id: String(r.product_id), size_unit: r.size_unit, size_value: String(r.size), variant_key: `${flavour.replace(/\s+/g, "-")}-${r.size}${r.size_unit}` },
        retailer: { id: "14", name: "10 Reps", slug: "10-reps", website: "https://www.10reps.co.uk/" },
        retailer_product: null,
      },
      meta: { operation_type: "standard_import", plan_fingerprint: null, plan_kind: "feed", source_row_fingerprint: sourceHash, version: "2" },
      offer: { action: "create", values: { in_stock: false, last_checked_at: exactOosTimes[i], price: r.price.toFixed(2), shipping_cost: "3.99", total_price: r.delivered_price.toFixed(2), url: r.source_url } },
      price_history: { action: "create" },
      product: { action: "existing", id: String(r.product_id) },
      product_variant: { action: "existing", evidence: { approved_mapping_id: null, external_options: { Flavour: r.flavour, Size: r.source_size }, flavour, pack_count: String(r.pack_count), product_format: r.product_format, size_unit: r.size_unit, size_value: String(r.size) }, id: String(r.product_variant_id) },
      retailer: { action: "existing", id: "14" },
      retailer_product: { action: "create", values: { external_gtin: r.external_gtin, external_name: r.external_name, external_options: { Flavour: r.flavour, Size: r.source_size }, external_product_id: r.external_product_id, external_sku: r.external_sku, external_slug: r.canonical_slug, external_url: r.source_url, external_variant_id: r.external_variant_id, match_confidence: "90", match_method: "slug", product_variant_id: String(r.product_variant_id) } },
    };
    const fingerprint = runner.planFingerprint(plan);
    assert.equal(fingerprint, EXACT_OOS_PROFILE.allowedFingerprints[i]);
    plan.meta.plan_fingerprint = fingerprint;
    artifact.plans.push({ operation_type: "standard_import", plan_fingerprint: fingerprint, plan_kind: "feed", resolved_plan: plan, retailer_id: "14", row_number: String(i + 2), source_row_fingerprint: sourceHash });
    artifact.source_rows.push({ normalized_source_row: source, plan_fingerprint: fingerprint, row_number: String(i + 2), source_row_fingerprint: sourceHash, status: "planned" });
  }
  return { manifest: reviewed, artifact, csvRows };
}
function validateExactOos(f, fingerprint = EXACT_OOS_PROFILE.fingerprint) { return runner.validatePackage(f.manifest, f.artifact, f.csvRows, EXACT_OOS_PROFILE, fingerprint); }
function review22Fixture() {
  const reviewed = structuredClone(review22Manifest);
  const csvRows = reviewed.rows.map(r => ({
    retailer_name: "10 Reps", retailer_website: "https://www.10reps.co.uk/", external_product_id: r.external_product_id, external_variant_id: r.external_variant_id,
    product_name: r.external_name, variant_name: r.is_default_variant ? "" : r.variant_name, brand: r.brand, category: r.category, description: "", image: r.image_url, slug: r.canonical_slug,
    external_url: r.source_url, affiliate_url: r.source_url, external_gtin: "", price: r.price.toFixed(2), shipping_known: "true", shipping_cost: "3.99",
    in_stock: String(r.in_stock), is_for_sale: "true", size: r.size == null ? "" : String(r.size), size_unit: r.size_unit || "", flavour: r.flavour || "",
    product_format: r.product_format || "", pack_count: r.pack_count == null ? "" : String(r.pack_count), source_updated_at: r.source_updated_at,
    external_sku: r.external_sku || "", external_options: JSON.stringify(r.is_default_variant ? {} : { Flavour: r.flavour, Size: r.source_size }),
    product_id: String(r.product_id), product_variant_id: String(r.product_variant_id),
  }));
  const artifact = { artifact_version: "1", row_count: "22", run_id: "10reps-existing-variant-22-test", source_file_sha256: REVIEW_22_PROFILE.csvSha256, blocked_rows: [], plans: [], source_rows: [], summary: { blocked_row_count: "0", plan_count: "22", skipped_row_count: "0" } };
  for (let i = 0; i < 22; i++) {
    const r = reviewed.rows[i], csv = csvRows[i];
    const source = { ...csv, variant: [csv.variant_name, csv.pack_count ? `pack of ${csv.pack_count}` : ""].filter(Boolean).join(" "), size: r.size == null ? "" : `${r.size} ${r.size_unit}` };
    const sourceHash = runner.sourceFingerprint(source);
    const externalOptions = r.is_default_variant ? {} : { Flavour: r.flavour, Size: r.source_size };
    const evidence = r.is_default_variant
      ? { approved_mapping_id: null, external_options: {}, flavour: null, pack_count: null, product_format: null, size_unit: null, size_value: null }
      : { approved_mapping_id: null, external_options: externalOptions, flavour: r.canonical_flavour_code, pack_count: String(r.pack_count), product_format: r.product_format, size_unit: r.size_unit, size_value: String(r.size) };
    const plan = {
      approval: { approval_type: "none", approved: false },
      expected_state: {
        offer: null,
        product: { id: String(r.product_id), is_active: true, merged_into_product_id: null, name: r.canonical_product, product_format: r.canonical_product_format },
        product_variant: { display_name: r.canonical_variant, flavour_code: r.canonical_flavour_code, flavour_label: r.canonical_flavour, id: String(r.product_variant_id), is_active: true, is_default: r.is_default_variant, pack_count: r.pack_count == null ? null : String(r.pack_count), product_format: r.product_format, product_id: String(r.product_id), size_unit: r.size_unit, size_value: r.size == null ? null : String(r.size), variant_key: r.canonical_variant_key },
        retailer: { id: "14", name: "10 Reps", slug: "10-reps", website: "https://www.10reps.co.uk/" },
        retailer_product: null,
      },
      meta: { operation_type: "standard_import", plan_fingerprint: null, plan_kind: "feed", source_row_fingerprint: sourceHash, version: "2" },
      offer: { action: "create", values: { in_stock: r.in_stock, last_checked_at: review22Times[i], price: r.price.toFixed(2), shipping_cost: "3.99", total_price: r.delivered_price.toFixed(2), url: r.source_url } },
      price_history: { action: "create" },
      product: { action: "existing", id: String(r.product_id) },
      product_variant: { action: "existing", evidence, id: String(r.product_variant_id) },
      retailer: { action: "existing", id: "14" },
      retailer_product: { action: "create", values: { external_gtin: null, external_name: r.external_name, external_options: externalOptions, external_product_id: r.external_product_id, external_sku: r.external_sku, external_slug: r.canonical_slug, external_url: r.source_url, external_variant_id: r.external_variant_id, match_confidence: "90", match_method: "slug", product_variant_id: String(r.product_variant_id) } },
    };
    const fingerprint = runner.planFingerprint(plan);
    assert.equal(fingerprint, REVIEW_22_PROFILE.allowedFingerprints[i]);
    plan.meta.plan_fingerprint = fingerprint;
    artifact.plans.push({ operation_type: "standard_import", plan_fingerprint: fingerprint, plan_kind: "feed", resolved_plan: plan, retailer_id: "14", row_number: String(i + 2), source_row_fingerprint: sourceHash });
    artifact.source_rows.push({ normalized_source_row: source, plan_fingerprint: fingerprint, row_number: String(i + 2), source_row_fingerprint: sourceHash, status: "planned" });
  }
  return { manifest: reviewed, artifact, csvRows };
}
function validateReview22(f, fingerprint = REVIEW_22_PROFILE.fingerprint) { return runner.validatePackage(f.manifest, f.artifact, f.csvRows, REVIEW_22_PROFILE, fingerprint); }
function reviewRemaining14Fixture() {
  const reviewed = structuredClone(reviewRemaining14Manifest);
  const sourceOptions = (r) => r.is_default_variant ? {} : {
    Flavour: REVIEW_REMAINING_14_PROFILE.sourceOptionFlavourAliases?.[r.external_variant_id] || r.flavour,
    Size: r.source_size,
  };
  const csvRows = reviewed.rows.map(r => ({
    retailer_name: "10 Reps", retailer_website: "https://www.10reps.co.uk/", external_product_id: r.external_product_id, external_variant_id: r.external_variant_id,
    product_name: r.external_name, variant_name: r.is_default_variant ? "" : r.variant_name, brand: r.brand, category: r.category, description: "", image: r.image_url, slug: r.canonical_slug,
    external_url: r.source_url, affiliate_url: r.source_url, external_gtin: "", price: r.price.toFixed(2), shipping_known: "true", shipping_cost: "3.99",
    in_stock: String(r.in_stock), is_for_sale: "true", size: r.size == null ? "" : String(r.size), size_unit: r.size_unit || "", flavour: r.flavour || "",
    product_format: r.product_format || "", pack_count: r.pack_count == null ? "" : String(r.pack_count), source_updated_at: r.source_updated_at,
    external_sku: r.external_sku || "", external_options: JSON.stringify(sourceOptions(r)), product_id: String(r.product_id), product_variant_id: String(r.product_variant_id),
  }));
  const artifact = { artifact_version: "1", row_count: "14", run_id: "10reps-existing-variant-remaining-14-test", source_file_sha256: REVIEW_REMAINING_14_PROFILE.csvSha256, blocked_rows: [], plans: [], source_rows: [], summary: { blocked_row_count: "0", plan_count: "14", skipped_row_count: "0" } };
  for (let i = 0; i < reviewed.rows.length; i++) {
    const r = reviewed.rows[i], csv = csvRows[i], externalOptions = sourceOptions(r);
    const source = { ...csv, variant: [csv.variant_name, csv.pack_count ? `pack of ${csv.pack_count}` : ""].filter(Boolean).join(" "), size: r.size == null ? "" : `${r.size} ${r.size_unit}` };
    const sourceHash = runner.sourceFingerprint(source);
    const evidence = r.is_default_variant
      ? { approved_mapping_id: null, external_options: {}, flavour: null, pack_count: null, product_format: null, size_unit: null, size_value: null }
      : { approved_mapping_id: null, external_options: externalOptions, flavour: r.canonical_flavour_code, pack_count: String(r.pack_count), product_format: r.product_format, size_unit: r.size_unit, size_value: String(r.size) };
    const plan = {
      approval: { approval_type: "none", approved: false },
      expected_state: {
        offer: null,
        product: { id: String(r.product_id), is_active: true, merged_into_product_id: null, name: r.canonical_product, product_format: r.canonical_product_format },
        product_variant: { display_name: r.canonical_variant, flavour_code: r.canonical_flavour_code, flavour_label: r.canonical_flavour, id: String(r.product_variant_id), is_active: true, is_default: r.is_default_variant, pack_count: r.pack_count == null ? null : String(r.pack_count), product_format: r.product_format, product_id: String(r.product_id), size_unit: r.size_unit, size_value: r.size == null ? null : String(r.size), variant_key: r.canonical_variant_key },
        retailer: { id: "14", name: "10 Reps", slug: "10-reps", website: "https://www.10reps.co.uk/" },
        retailer_product: null,
      },
      meta: { operation_type: "standard_import", plan_fingerprint: null, plan_kind: "feed", source_row_fingerprint: sourceHash, version: "2" },
      offer: { action: "create", values: { in_stock: r.in_stock, last_checked_at: reviewRemaining14Times[i], price: r.price.toFixed(2), shipping_cost: "3.99", total_price: r.delivered_price.toFixed(2), url: r.source_url } },
      price_history: { action: "create" },
      product: { action: "existing", id: String(r.product_id) },
      product_variant: { action: "existing", evidence, id: String(r.product_variant_id) },
      retailer: { action: "existing", id: "14" },
      retailer_product: { action: "create", values: { external_gtin: null, external_name: r.external_name, external_options: externalOptions, external_product_id: r.external_product_id, external_sku: r.external_sku, external_slug: r.canonical_slug, external_url: r.source_url, external_variant_id: r.external_variant_id, match_confidence: "90", match_method: "slug", product_variant_id: String(r.product_variant_id) } },
    };
    const fingerprint = runner.planFingerprint(plan);
    assert.equal(fingerprint, REVIEW_REMAINING_14_PROFILE.allowedFingerprints[i]);
    plan.meta.plan_fingerprint = fingerprint;
    artifact.plans.push({ operation_type: "standard_import", plan_fingerprint: fingerprint, plan_kind: "feed", resolved_plan: plan, retailer_id: "14", row_number: String(i + 2), source_row_fingerprint: sourceHash });
    artifact.source_rows.push({ normalized_source_row: source, plan_fingerprint: fingerprint, row_number: String(i + 2), source_row_fingerprint: sourceHash, status: "planned" });
  }
  return { manifest: reviewed, artifact, csvRows };
}
function validateReviewRemaining14(f, fingerprint = REVIEW_REMAINING_14_PROFILE.fingerprint) { return runner.validatePackage(f.manifest, f.artifact, f.csvRows, REVIEW_REMAINING_14_PROFILE, fingerprint); }
test("closed CLI accepts only the exact profile paths and allowed fingerprints", () => {
  assert.deepEqual(runner.parseArgs([`--artifact=${PROFILE.artifact}`, `--csv=${PROFILE.csv}`, `--plan-fingerprint=${PROFILE.fingerprint}`]), options);
  assert.deepEqual(runner.parseArgs([`--artifact=${REMAINING_PROFILE.artifact}`, `--csv=${REMAINING_PROFILE.csv}`, `--plan-fingerprint=${REMAINING_PROFILE.fingerprint}`]), remainingOptions);
  assert.deepEqual(runner.parseArgs([`--artifact=${EXACT_OOS_PROFILE.artifact}`, `--csv=${EXACT_OOS_PROFILE.csv}`, `--plan-fingerprint=${EXACT_OOS_PROFILE.fingerprint}`]), exactOosOptions);
  assert.deepEqual(runner.parseArgs([`--artifact=${REVIEW_22_PROFILE.artifact}`, `--csv=${REVIEW_22_PROFILE.csv}`, `--plan-fingerprint=${REVIEW_22_PROFILE.fingerprint}`]), review22Options);
  assert.deepEqual(runner.parseArgs([`--artifact=${REVIEW_REMAINING_14_PROFILE.artifact}`, `--csv=${REVIEW_REMAINING_14_PROFILE.csv}`, `--plan-fingerprint=${REVIEW_REMAINING_14_PROFILE.fingerprint}`]), reviewRemaining14Options);
  for (const fingerprint of REMAINING_PROFILE.allowedFingerprints) assert.doesNotThrow(() => runner.parseArgs([`--artifact=${REMAINING_PROFILE.artifact}`, `--csv=${REMAINING_PROFILE.csv}`, `--plan-fingerprint=${fingerprint}`]));
  for (const fingerprint of EXACT_OOS_PROFILE.allowedFingerprints) assert.doesNotThrow(() => runner.parseArgs([`--artifact=${EXACT_OOS_PROFILE.artifact}`, `--csv=${EXACT_OOS_PROFILE.csv}`, `--plan-fingerprint=${fingerprint}`]));
  for (const fingerprint of REVIEW_22_PROFILE.allowedFingerprints) assert.doesNotThrow(() => runner.parseArgs([`--artifact=${REVIEW_22_PROFILE.artifact}`, `--csv=${REVIEW_22_PROFILE.csv}`, `--plan-fingerprint=${fingerprint}`]));
  for (const fingerprint of REVIEW_REMAINING_14_PROFILE.allowedFingerprints) assert.doesNotThrow(() => runner.parseArgs([`--artifact=${REVIEW_REMAINING_14_PROFILE.artifact}`, `--csv=${REVIEW_REMAINING_14_PROFILE.csv}`, `--plan-fingerprint=${fingerprint}`]));
  for (const args of [[], [`--artifact=${PROFILE.artifact}`, `--artifact=${PROFILE.artifact}`], ["--apply"], ["--pilot-apply"], ["--profile=other"]]) assert.throws(() => runner.parseArgs(args));
  for (const key of ["artifact", "csv", "planFingerprint"]) assert.throws(() => runner.prepareApproval({ ...options, [key]: "wrong" }, () => { throw new Error("Must not read files"); }), /Invalid/);
  for (const row of manifest.rows.slice(1)) assert.throws(() => runner.prepareApproval({ ...options, planFingerprint: row.plan_fingerprint }), /bootstrap fingerprint/);
  assert.throws(() => runner.parseArgs([`--artifact=${REMAINING_PROFILE.artifact}`, `--csv=${REMAINING_PROFILE.csv}`, `--plan-fingerprint=${PROFILE.fingerprint}`]), /remaining-19 fingerprint/);
  assert.throws(() => runner.parseArgs([`--artifact=${REMAINING_PROFILE.artifact}`, `--csv=${PROFILE.csv}`, `--plan-fingerprint=${REMAINING_PROFILE.fingerprint}`]), /closed profile/);
  assert.throws(() => runner.parseArgs([`--artifact=${EXACT_OOS_PROFILE.artifact}`, `--csv=${EXACT_OOS_PROFILE.csv}`, `--plan-fingerprint=${REMAINING_PROFILE.fingerprint}`]), /exact-oos-24 fingerprint/);
  assert.throws(() => runner.parseArgs([`--artifact=${EXACT_OOS_PROFILE.artifact}`, `--csv=${REMAINING_PROFILE.csv}`, `--plan-fingerprint=${EXACT_OOS_PROFILE.fingerprint}`]), /closed profile/);
  assert.throws(() => runner.parseArgs([`--artifact=${REVIEW_22_PROFILE.artifact}`, `--csv=${REVIEW_22_PROFILE.csv}`, `--plan-fingerprint=${EXACT_OOS_PROFILE.fingerprint}`]), /existing-variant-22 fingerprint/);
  assert.throws(() => runner.parseArgs([`--artifact=${REVIEW_22_PROFILE.artifact}`, `--csv=${EXACT_OOS_PROFILE.csv}`, `--plan-fingerprint=${REVIEW_22_PROFILE.fingerprint}`]), /closed profile/);
  assert.throws(() => runner.parseArgs([`--artifact=${REVIEW_REMAINING_14_PROFILE.artifact}`, `--csv=${REVIEW_REMAINING_14_PROFILE.csv}`, `--plan-fingerprint=${REVIEW_22_PROFILE.fingerprint}`]), /remaining-14 fingerprint/);
});
test("wrong artifact and CSV SHA are rejected by the package digest guard", () => {
  assert.throws(() => runner.checkDigest(Buffer.from("corrupt artifact"), PROFILE.artifactSha256, "artifact"), /artifact SHA/);
  assert.throws(() => runner.checkDigest(Buffer.from("corrupt CSV"), PROFILE.csvSha256, "CSV"), /CSV SHA/);
  let reads = 0;
  assert.throws(() => runner.prepareApproval(options, file => { reads++; return file === PROFILE.manifest ? fs.readFileSync(file) : Buffer.from("corrupt artifact"); }), /artifact SHA/);
  assert.equal(reads, 2);
  assert.throws(() => runner.prepareApproval(options, () => Buffer.from("{}")), /manifest SHA/);
  assert.throws(() => runner.checkDigest(Buffer.from("corrupt remaining artifact"), REMAINING_PROFILE.artifactSha256, "artifact"), /artifact SHA/);
  assert.throws(() => runner.checkDigest(Buffer.from("corrupt remaining CSV"), REMAINING_PROFILE.csvSha256, "CSV"), /CSV SHA/);
  assert.throws(() => runner.checkDigest(Buffer.from("corrupt exact OOS artifact"), EXACT_OOS_PROFILE.artifactSha256, "artifact"), /artifact SHA/);
  assert.throws(() => runner.checkDigest(Buffer.from("corrupt exact OOS CSV"), EXACT_OOS_PROFILE.csvSha256, "CSV"), /CSV SHA/);
  assert.throws(() => runner.checkDigest(Buffer.from("corrupt reviewed 22 artifact"), REVIEW_22_PROFILE.artifactSha256, "artifact"), /artifact SHA/);
  assert.throws(() => runner.checkDigest(Buffer.from("corrupt reviewed 22 CSV"), REVIEW_22_PROFILE.csvSha256, "CSV"), /CSV SHA/);
  assert.throws(() => runner.checkDigest(Buffer.from("corrupt reviewed remaining 14 artifact"), REVIEW_REMAINING_14_PROFILE.artifactSha256, "artifact"), /artifact SHA/);
  assert.throws(() => runner.checkDigest(Buffer.from("corrupt reviewed remaining 14 CSV"), REVIEW_REMAINING_14_PROFILE.csvSha256, "CSV"), /CSV SHA/);
});
test("all 20 synthetic plans are checked and only the exact bootstrap is selected", () => {
  const f = fixture(), selected = validate(f);
  assert.equal(selected.entry.row_number, "2");
  assert.equal(selected.entry.resolved_plan.product.id, "788");
  assert.equal(selected.entry.resolved_plan.product_variant.id, "1080");
});
test("valid remaining-19 artifact checks every reviewed row and selects only an allowed fingerprint", () => {
  const selected = validateRemaining(remainingFixture());
  assert.equal(selected.profile, REMAINING_PROFILE);
  assert.equal(selected.artifact.plans.length, 19);
  assert.equal(selected.entry.plan_fingerprint, "0146b444423932cdac03d5175a354fc8");
  assert.equal(selected.entry.resolved_plan.retailer.id, "14");
  assert.equal(selected.entry.resolved_plan.retailer_product.values.external_variant_id, "8481");
  assert.ok(!selected.artifact.plans.some(entry => entry.plan_fingerprint === PROFILE.fingerprint || entry.resolved_plan.retailer_product.values.external_variant_id === "10003"));
});
test("valid exact OOS artifact checks all 24 reviewed rows and selects only an allowed fingerprint", () => {
  const selected = validateExactOos(exactOosFixture());
  assert.equal(selected.profile, EXACT_OOS_PROFILE);
  assert.equal(selected.artifact.plans.length, 24);
  assert.equal(selected.entry.plan_fingerprint, "80844944ed999b45ce749d1f16274304");
  assert.equal(selected.entry.resolved_plan.retailer.id, "14");
  assert.equal(selected.entry.resolved_plan.retailer_product.values.external_variant_id, "7712");
  assert.equal(selected.entry.resolved_plan.product.id, "788");
  assert.equal(selected.entry.resolved_plan.product_variant.id, "1073");
  assert.equal(selected.entry.resolved_plan.offer.values.in_stock, false);
});
test("valid reviewed existing-variant artifact checks all 22 owner-approved rows", () => {
  const selected = validateReview22(review22Fixture());
  assert.equal(selected.profile, REVIEW_22_PROFILE);
  assert.equal(selected.artifact.plans.length, 22);
  assert.equal(selected.entry.plan_fingerprint, "e478bcf2f818d98c2ff92e2cc35dc8d2");
  assert.equal(selected.entry.resolved_plan.retailer.id, "14");
  assert.equal(selected.entry.resolved_plan.retailer_product.values.external_variant_id, "8166");
  assert.equal(selected.entry.resolved_plan.product.id, "861");
  assert.equal(selected.entry.resolved_plan.product_variant.id, "2780");
  assert.equal(selected.artifact.plans[15].resolved_plan.product_variant.id, "24");
  assert.equal(selected.artifact.plans[15].resolved_plan.expected_state.product_variant.is_default, true);
});
test("valid reviewed remaining-14 artifact excludes the live prefix and accepts the reviewed flavour alias", () => {
  const selected = validateReviewRemaining14(reviewRemaining14Fixture());
  assert.equal(selected.profile, REVIEW_REMAINING_14_PROFILE);
  assert.equal(selected.artifact.plans.length, 14);
  assert.equal(selected.entry.resolved_plan.retailer_product.values.external_variant_id, "8176");
  assert.equal(selected.entry.resolved_plan.retailer_product.values.external_options.Flavour, "Cookies and Cream");
  assert.equal(selected.artifact.source_rows[0].normalized_source_row.flavour, "Cookies & Cream");
  assert.ok(!selected.artifact.plans.some(entry => REVIEW_REMAINING_14_PROFILE.forbiddenExternalVariantIds.includes(entry.resolved_plan.retailer_product.values.external_variant_id)));
});
for (const [label, mutate, message] of [
  ["retailer create", f => { f.artifact.plans[0].resolved_plan.retailer = { action: "create" }; }, /existing retailer/],
  ["product creation", f => { f.artifact.plans[0].resolved_plan.product.action = "create"; }, /existing product/],
  ["variant creation", f => { f.artifact.plans[0].resolved_plan.product_variant.action = "create"; }, /existing variant action/],
  ["shipping change", f => { f.artifact.plans[0].resolved_plan.offer.values.shipping_cost = "4.99"; }, /shipping/],
  ["unreviewed raw option spelling", f => { f.artifact.plans[0].resolved_plan.retailer_product.values.external_options.Flavour = "Cookies & Cream"; }, /source options/],
  ["already-applied source", f => { f.artifact.plans[13].resolved_plan.retailer_product.values.external_variant_id = "8166"; }, /mapping external_variant_id|Already-applied source/],
  ["fingerprint outside remaining scope", f => { f.artifact.plans[13].plan_fingerprint = "0".repeat(32); }, /source plan binding|plan integrity|remaining-14 fingerprints/],
]) test(`reviewed existing-variant remaining-14 rejects ${label}`, () => {
  const f = reviewRemaining14Fixture();
  mutate(f);
  assert.throws(() => validateReviewRemaining14(f), message);
});
for (const [label, mutate, message] of [
  ["retailer create", f => { f.artifact.plans[0].resolved_plan.retailer = { action: "create" }; }, /existing retailer/],
  ["product creation", f => { f.artifact.plans[0].resolved_plan.product.action = "create"; }, /existing product/],
  ["variant creation", f => { f.artifact.plans[0].resolved_plan.product_variant.action = "create"; }, /existing variant action/],
  ["shipping change", f => { f.artifact.plans[0].resolved_plan.offer.values.shipping_cost = "4.99"; }, /shipping/],
  ["stock substitution", f => { f.artifact.plans[0].resolved_plan.offer.values.in_stock = !f.manifest.rows[0].in_stock; }, /existing-variant-22 stock/],
  ["canonical category substitution", f => { f.artifact.source_rows[0].normalized_source_row.category = "Carbohydrates"; }, /source category|CSV to artifact source/],
  ["canonical brand substitution", f => { f.artifact.source_rows[17].normalized_source_row.brand = "Applied Nutrition"; }, /source brand|CSV to artifact source/],
  ["default variant size evidence", f => { f.artifact.plans[15].resolved_plan.retailer_product.values.external_options = { Size: "60 Capsules" }; }, /source options/],
  ["fingerprint outside approved 22", f => { f.artifact.plans[21].plan_fingerprint = "0".repeat(32); }, /source plan binding|plan integrity|existing-variant-22 fingerprints/],
]) test(`reviewed existing-variant-22 rejects ${label}`, () => {
  const f = review22Fixture();
  mutate(f);
  assert.throws(() => validateReview22(f), message);
});
for (const [label, mutate, message] of [
  ["retailer create", f => { f.artifact.plans[23].resolved_plan.retailer = { action: "create", values: { name: "10 Reps", slug: "10-reps", website: "https://www.10reps.co.uk/" } }; }, /existing retailer/],
  ["wrong retailer ID", f => { f.artifact.plans[23].retailer_id = "15"; }, /retailer ID/],
  ["product creation", f => { f.artifact.plans[23].resolved_plan.product.action = "create"; }, /existing product/],
  ["variant creation", f => { f.artifact.plans[23].resolved_plan.product_variant.action = "create_variant"; }, /existing variant/],
  ["in-stock substitution", f => { f.artifact.plans[23].resolved_plan.offer.values.in_stock = true; }, /exact-oos-24 stock/],
  ["shipping other than 3.99", f => { f.artifact.plans[23].resolved_plan.offer.values.shipping_cost = "0"; }, /shipping/],
  ["wrong product", f => { f.artifact.plans[23].resolved_plan.product.id = "1"; }, /existing product/],
  ["wrong variant", f => { f.artifact.plans[23].resolved_plan.product_variant.id = "1"; }, /existing variant/],
  ["fingerprint outside exact OOS scope", f => { f.artifact.plans[23].plan_fingerprint = "0".repeat(32); }, /source plan binding|plan integrity|exact-oos-24 fingerprints/],
  ["previous bootstrap fingerprint", f => { f.artifact.plans[23].plan_fingerprint = PROFILE.fingerprint; }, /source plan binding|plan integrity|exact-oos-24 fingerprints/],
  ["SKU promoted into GTIN", f => { f.artifact.plans[23].resolved_plan.retailer_product.values.external_gtin = f.manifest.rows[23].external_sku; }, /external_gtin/],
]) test(`exact-oos-24 rejects ${label}`, () => {
  const f = exactOosFixture(); mutate(f); assert.throws(() => validateExactOos(f), message);
});
for (const [label, mutate, message] of [
  ["retailer create", f => { f.artifact.plans[18].resolved_plan.retailer = { action: "create", values: { name: "10 Reps", slug: "10-reps", website: "https://www.10reps.co.uk/" } }; }, /existing retailer/],
  ["wrong retailer ID", f => { f.artifact.plans[18].retailer_id = "15"; }, /retailer ID/],
  ["product creation", f => { f.artifact.plans[18].resolved_plan.product.action = "create"; }, /existing product/],
  ["variant creation", f => { f.artifact.plans[18].resolved_plan.product_variant.action = "create_variant"; }, /existing variant/],
  ["shipping other than 3.99", f => { f.artifact.plans[18].resolved_plan.offer.values.shipping_cost = "0"; }, /shipping/],
  ["fingerprint outside remaining scope", f => { f.artifact.plans[18].plan_fingerprint = "0".repeat(32); }, /source plan binding|plan integrity|remaining fingerprints/],
  ["bootstrap row", f => { f.artifact.plans[0] = structuredClone(fixture().artifact.plans[0]); }, /source binding|reviewed plan fingerprint|existing retailer|profile external variant/],
]) test(`remaining-19 rejects ${label}`, () => {
  const f = remainingFixture(); mutate(f); assert.throws(() => validateRemaining(f), message);
});
for (const [label, mutate, message] of [
  ["product creation", p => { p.product.action = "create"; }, /existing product/],
  ["variant creation", p => { p.product_variant.action = "create_variant"; }, /existing variant/],
  ["wrong product", p => { p.product.id = "1"; }, /existing product/],
  ["wrong variant", p => { p.product_variant.id = "1"; }, /existing variant/],
  ["shipping other than 3.99", p => { p.offer.values.shipping_cost = "0"; }, /shipping/],
  ["wrong delivered total", p => { p.offer.values.total_price = "24.99"; }, /delivered price/],
  ["changed price", p => { p.offer.values.price = "1.00"; }, /effective price/],
  ["out of stock", p => { p.offer.values.in_stock = false; }, /bootstrap stock/],
  ["SKU promoted into GTIN", p => { p.retailer_product.values.external_gtin = "PER406"; }, /external_gtin/],
  ["source URL substitution", p => { p.offer.values.url = "https://example.test/"; }, /offer URL/],
  ["wrong variant parent", p => { p.expected_state.product_variant.product_id = "1"; }, /variant product_id/],
]) test(`${label} rejected even in an unselected plan`, () => {
  const f = fixture(); mutate(f.artifact.plans[19].resolved_plan); assert.throws(() => validate(f), message);
});
test("held rows, duplicate targets, extra plans and source/category tampering fail closed", () => {
  for (const mutate of [f => f.manifest.held_rows.push(1), f => { f.manifest.rows[19].product_variant_id = 1080; }, f => f.artifact.plans.pop(), f => f.artifact.blocked_rows.push({}), f => { f.csvRows[0].category = "Creatine"; }, f => { f.artifact.source_rows[0].normalized_source_row.image = "https://example.test/image.png"; }, f => { f.artifact.plans[0].plan_fingerprint = "0".repeat(32); }]) {
    const f = fixture(); mutate(f); assert.throws(() => validate(f));
  }
});
test("direct PG credential must target the production approver login", () => {
  const valid = `APPROVER_DATABASE_URL=postgresql://${PROFILE.login}:test-only@db.${PROFILE.project}.supabase.co:5432/postgres?sslmode=require`;
  assert.ok(runner.parseCredential(valid).startsWith("postgresql:"));
  for (const value of [valid.replace(PROFILE.login, "postgres"), valid.replace(PROFILE.project, "staging"), valid.replace("postgresql:", "https:"), valid + "\nSECOND_DATABASE_URL=postgresql://other", valid + "&options=unsafe", "MISSING=true"]) assert.throws(() => runner.parseCredential(value));
});
function fakeClient(prepared, changes = {}) {
  const calls = [];
  return { calls, async connect() { calls.push("CONNECT"); }, async end() { calls.push("END"); }, async query(sql, args) {
    calls.push({ sql, args });
    if (sql === "select current_user,session_user") return { rows: [{ current_user: changes.role || PROFILE.role, session_user: changes.login || PROFILE.login }] };
    if (sql.includes("approve_product_import_plan")) return { rows: [{ result: { approval_id: "11111111-1111-4111-8111-111111111111", status: "approved", artifact_sha256: prepared.profile.artifactSha256, run_id: prepared.artifact.run_id, plan_fingerprint: prepared.entry.plan_fingerprint, source_row_fingerprint: prepared.entry.source_row_fingerprint, retailer_id: prepared.profile.retailerId, plan_kind: "feed", expires_at: new Date(Date.now() + 15 * 60_000).toISOString(), ...changes.receipt } }] };
    return { rows: [] };
  } };
}
test("direct PG transaction checks role and login and submits exactly one approval", async () => {
  const prepared = validate(fixture()), client = fakeClient(prepared);
  const result = await runner.approveWithClient(prepared, client);
  assert.equal(result.approval_only, true);
  const queries = client.calls.filter(c => c.sql);
  assert.deepEqual(queries.map(c => c.sql), ["begin", "select set_config('app.retailer_catalogue_production_marker','1',true),set_config('app.retailer_catalogue_allow','1',true)", "SET LOCAL ROLE retailer_catalogue_production_approver", "select current_user,session_user", "select public.approve_product_import_plan($1::jsonb,$2,$3,$4,now()+interval '15 minutes') result", "commit"]);
  const approval = queries[4];
  assert.equal(approval.args[0].product_variant.id, "1080");
  assert.equal(approval.args[1], PROFILE.artifactSha256);
  assert.equal(client.calls.at(-1), "END");
});
test("remaining-19 uses the same direct PG transaction for exactly one selected approval", async () => {
  const prepared = validateRemaining(remainingFixture()), client = fakeClient(prepared);
  const result = await runner.approveWithClient(prepared, client);
  assert.deepEqual({ fingerprint: result.plan_fingerprint, product: result.product_id, variant: result.product_variant_id, source: result.external_variant_id, retailer: result.retailer_id }, { fingerprint: REMAINING_PROFILE.fingerprint, product: 882, variant: 1406, source: "8481", retailer: 14 });
  const queries = client.calls.filter(call => call.sql);
  assert.equal(queries.filter(call => call.sql.includes("approve_product_import_plan")).length, 1);
  assert.equal(queries[4].args[1], REMAINING_PROFILE.artifactSha256);
  assert.equal(queries[4].args[3], "10reps-reviewed-remaining-19");
  assert.equal(queries.at(-1).sql, "commit");
});
test("exact-oos-24 uses the same direct PG transaction for exactly one selected approval", async () => {
  const prepared = validateExactOos(exactOosFixture()), client = fakeClient(prepared);
  const result = await runner.approveWithClient(prepared, client);
  assert.deepEqual(
    { fingerprint: result.plan_fingerprint, product: result.product_id, variant: result.product_variant_id, source: result.external_variant_id, retailer: result.retailer_id },
    { fingerprint: EXACT_OOS_PROFILE.fingerprint, product: 788, variant: 1073, source: "7712", retailer: 14 },
  );
  const queries = client.calls.filter(call => call.sql);
  assert.equal(queries.filter(call => call.sql.includes("approve_product_import_plan")).length, 1);
  assert.equal(queries[4].args[1], EXACT_OOS_PROFILE.artifactSha256);
  assert.equal(queries[4].args[3], "10reps-reviewed-exact-oos-24");
  assert.equal(queries.at(-1).sql, "commit");
});
test("reviewed existing-variant-22 uses one direct PG approval and no apply", async () => {
  const prepared = validateReview22(review22Fixture()), client = fakeClient(prepared);
  const result = await runner.approveWithClient(prepared, client);
  assert.deepEqual(
    { fingerprint: result.plan_fingerprint, product: result.product_id, variant: result.product_variant_id, source: result.external_variant_id, retailer: result.retailer_id },
    { fingerprint: REVIEW_22_PROFILE.fingerprint, product: 861, variant: 2780, source: "8166", retailer: 14 },
  );
  const queries = client.calls.filter(call => call.sql);
  assert.equal(queries.filter(call => call.sql.includes("approve_product_import_plan")).length, 1);
  assert.equal(queries[4].args[1], REVIEW_22_PROFILE.artifactSha256);
  assert.equal(queries[4].args[3], "10reps-reviewed-existing-variant-22");
  assert.equal(queries.at(-1).sql, "commit");
});
test("wrong role/login never reaches approval; wrong receipt rolls back", async () => {
  for (const changes of [{ role: "postgres" }, { login: "wrong_login" }, { receipt: { plan_fingerprint: "wrong" } }, { receipt: { expires_at: new Date(0).toISOString() } }]) {
    const prepared = validate(fixture()), client = fakeClient(prepared, changes);
    await assert.rejects(runner.approveWithClient(prepared, client));
    assert.ok(client.calls.some(c => c.sql === "rollback"));
    assert.ok(!client.calls.some(c => c.sql === "commit"));
    if (changes.role || changes.login) assert.ok(!client.calls.some(c => c.sql?.includes("approve_product_import_plan")));
  }
});
test("runner has no elevated backend token, HTTP approval, execution RPC or business DML", () => {
  const code = fs.readFileSync(require.resolve("./10reps-bootstrap-artifact-approver"), "utf8");
  const tests = fs.readFileSync(__filename, "utf8");
  assert.doesNotMatch(code, /service_role|SERVICE_ROLE|createClient|PostgREST|supabase-js|fetch\s*\(|apply_approved|apply_product|pilot-apply|\b(?:insert\s+into|update\s+public\.|delete\s+from|alter\s+table|grant\s+execute)\b/i);
  const forbiddenFeedMarkers = new RegExp(`${["TEN", "REPS", "FEED", "URL"].join("_")}|${"trpf"}_${"feed"}`, "i");
  assert.doesNotMatch(code, forbiddenFeedMarkers);
  assert.doesNotMatch(tests, forbiddenFeedMarkers);
  assert.match(code, /require\("pg"\)/);
  assert.match(code, /SET LOCAL ROLE retailer_catalogue_production_approver/);
  assert.match(code, /credentials\/production-approver\.env/);
});
