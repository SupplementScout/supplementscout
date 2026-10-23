const assert = require("node:assert/strict");
const crypto = require("node:crypto");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const test = require("node:test");
const { loadReviewedPackage, loadReviewedPackageScope, normalizedManifestSha, planFingerprint, sha256, validateManifest } = require("./lib/reviewed-catalogue-package");
const { buildV3Envelope, isV3SourceExcluded, resolveOptionRoles } = require("./lib/reviewed-catalogue-v3");
const { APPROVAL_SQL, V3_APPROVAL_SQL, approveWithClient, parseArgs, parseCredential } = require("./reviewed-catalogue-artifact-approver");
const { TARGETS, assertManifestTarget, assertSafeUpdateDisabled, credentialPath, roleTransaction: targetRoleTransaction, targetContract } = require("./lib/reviewed-catalogue-target");
const { buildExecutionStateRequest, createStateClient, readState, validatePlans, V2_VALIDATION_SQL, V3_VALIDATION_SQL } = require("./lib/reviewed-catalogue-state");
const {
  APPLY_SQL: PACKAGE_APPLY_SQL,
  APPROVAL_SQL: PACKAGE_APPROVAL_SQL,
  apply: applyPackage,
  captureTarget,
  expectedDelta,
  opaqueDecimalId,
  parseArgs: parsePackageArgs,
  parseCredential: parsePackageCredential,
  roleTransaction,
  sameExpectedState,
  verifyTarget,
} = require("./reviewed-catalogue-package-executor");

function reseal(value) {
  fs.writeFileSync(value.artifactPath, `${JSON.stringify(value.artifact, null, 2)}\n`);
  value.manifest.profiles[0].artifact_sha256 = sha256(fs.readFileSync(value.artifactPath));
  fs.writeFileSync(value.manifestPath, `${JSON.stringify(value.manifest, null, 2)}\n`);
  value.manifestSha256 = normalizedManifestSha(fs.readFileSync(value.manifestPath));
  value.plan = value.artifact.plans[0].resolved_plan;
  return value;
}

function fixture() {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "reviewed-catalogue-"));
  fs.mkdirSync(path.join(root, "config/retailers"), { recursive: true });
  fs.mkdirSync(path.join(root, "tmp/retailer-feeds/shop"), { recursive: true });
  const csv = "retailer_name,external_product_id,external_variant_id,price\nExample Shop,p-7,v-short,10.00\n";
  const sourceRowFingerprint = crypto.createHash("sha256").update("source-row").digest("hex");
  const plan = {
    meta: { version: "1", plan_kind: "feed", operation_type: "standard_import", source_row_fingerprint: sourceRowFingerprint, plan_fingerprint: null, idempotency_key: "reviewed-test" },
    retailer: { action: "existing", id: "14", values: null },
    product: { action: "existing", id: "788", values: null },
    product_variant: { action: "existing", id: "1080", values: null },
    retailer_product: { action: "create", id: null, values: { retailer_id: "14", product_id: "788", product_variant_id: "1080", external_product_id: "p-7", external_variant_id: "v-short", external_sku: null, external_gtin: null, external_url: "https://shop.example/product/p-7", external_options: { Flavour: "Berry" }, external_name: "Example", external_slug: "example", match_method: "slug", match_confidence: "100" } },
    offer: { action: "create", id: null, values: { product_id: "788", retailer_id: "14", product_variant_id: "1080", retailer_product_id: null, price: "10.00", shipping_cost: "3.99", total_price: "13.99", in_stock: true, url: "https://shop.example/product/p-7", last_checked_at: "2026-09-07T10:00:00.000Z" } },
    price_history: { action: "create", values: { price: "10.00", shipping_cost: "3.99", total_price: "13.99", in_stock: true } },
    expected_state: { retailer: { id: "14", name: "Example Shop", slug: "example-shop", website: "https://shop.example/" }, product: { id: "788", name: "Example", is_active: true, merged_into_product_id: null }, product_variant: { id: "1080", product_id: "788", display_name: "Berry", is_active: true }, retailer_product: null, offer: null },
    approval: { approved: false, approval_type: "none" },
  };
  plan.meta.plan_fingerprint = planFingerprint(plan);
  const csvPath = path.join(root, "tmp/retailer-feeds/shop/reviewed.csv");
  fs.writeFileSync(csvPath, csv);
  const source = { row_number: "2", status: "planned", source_row_fingerprint: sourceRowFingerprint, plan_fingerprint: plan.meta.plan_fingerprint, normalized_source_row: { retailer_name: "Example Shop", external_product_id: "p-7", external_variant_id: "v-short", price: "10.00" } };
  const artifact = { artifact_version: "1", run_id: "reviewed-test-run", row_count: "1", source_file_sha256: sha256(Buffer.from(csv)), summary: { blocked_row_count: "0", plan_count: "1", skipped_row_count: "0" }, blocked_rows: [], source_rows: [source], plans: [{ row_number: "2", retailer_id: "14", plan_kind: "feed", source_row_fingerprint: sourceRowFingerprint, plan_fingerprint: plan.meta.plan_fingerprint, resolved_plan: plan }] };
  const artifactPath = path.join(root, "tmp/retailer-feeds/shop/reviewed-dry-run.json");
  fs.writeFileSync(artifactPath, `${JSON.stringify(artifact, null, 2)}\n`);
  const manifest = {
    schema_version: 1, kind: "reviewed-catalogue-package-v1", status: "OWNER_APPROVED", authorized_by: "owner", authorized_at: "2026-09-07T10:05:00.000Z",
    retailer: { id: 14, name: "Example Shop", slug: "example-shop", website: "https://shop.example/", expected_action: "existing", shipping_known: true, shipping_cost: 3.99 },
    policy: { reviewed_rows_only: true, allow_product_creation: false, allow_variant_creation: false, allow_canonical_product_updates: false, allow_canonical_variant_updates: false, allow_canonical_gtin_updates: false, allow_category_changes: false, sku_is_not_gtin: true, one_plan_at_a_time: true, fresh_single_use_approval_per_plan: true, strict_production_readback_after_each_apply: true },
    profiles: [{ id: "batch-1", status: "DRY_RUN_PASS", csv_path: "tmp/retailer-feeds/shop/reviewed.csv", csv_sha256: artifact.source_file_sha256, artifact_path: "tmp/retailer-feeds/shop/reviewed-dry-run.json", artifact_sha256: sha256(fs.readFileSync(artifactPath)), row_count: 1, blocked_row_count: 0, conflict_count: 0, expected_actions: { retailers_create: 0, products_create: 0, product_variants_create: 0, retailer_products_create: 1, offers_create: 1, price_history_create: 1 }, rows: [{ review_row: 1, external_product_id: "p-7", external_variant_id: "v-short", external_sku: null, external_gtin: null, source_url: "https://shop.example/product/p-7", product_id: 788, product_variant_id: 1080, action: "map_existing_variant", brand: "Example", category: "Amino Acids", product_name: "Example", variant_name: "Berry", flavour: "Berry", size_value: "420", size_unit: "g", pack_count: "1", product_format: "liquid", price: 10, in_stock: true, source_row_fingerprint: sourceRowFingerprint, plan_fingerprint: plan.meta.plan_fingerprint }] }],
  };
  const manifestPath = path.join(root, "config/retailers/example-reviewed.json");
  fs.writeFileSync(manifestPath, `${JSON.stringify(manifest, null, 2)}\n`);
  return { root, manifest, manifestPath, manifestSha256: normalizedManifestSha(fs.readFileSync(manifestPath)), artifact, artifactPath, plan };
}

function v2Fixture({ target = "staging", directUrl = "https://shop.example/product/p-7?variant=v-short", affiliateUrl = "https://shop.example/product/p-7?variant=v-short&sca_ref=tracked" } = {}) {
  const value = fixture();
  const contract = TARGETS[target];
  const row = value.manifest.profiles[0].rows[0];
  value.manifest.schema_version = 2;
  value.manifest.kind = "reviewed-catalogue-package-v2";
  value.manifest.target_environment = contract.environment;
  value.manifest.target_project_ref = contract.projectRef;
  delete row.source_url;
  row.external_url = directUrl;
  row.affiliate_url = affiliateUrl;
  const sourceRowFingerprint = crypto.createHash("sha256").update(JSON.stringify({ directUrl, affiliateUrl })).digest("hex");
  row.source_row_fingerprint = sourceRowFingerprint;
  value.plan.retailer_product.values.external_url = directUrl;
  value.plan.offer.values.url = affiliateUrl;
  value.plan.meta.source_row_fingerprint = sourceRowFingerprint;
  value.plan.meta.plan_fingerprint = planFingerprint(value.plan);
  row.plan_fingerprint = value.plan.meta.plan_fingerprint;
  value.artifact.plans[0].source_row_fingerprint = sourceRowFingerprint;
  value.artifact.plans[0].plan_fingerprint = value.plan.meta.plan_fingerprint;
  value.artifact.source_rows[0].source_row_fingerprint = sourceRowFingerprint;
  value.artifact.source_rows[0].plan_fingerprint = value.plan.meta.plan_fingerprint;
  return reseal(value);
}

function v3Fixture({ target = "staging", rawOptions = { Flavours: "Berry", Size: "35 Servings", Weight: "420g" } } = {}) {
  const value = v2Fixture({
    target,
    directUrl: "https://shop.example/products/p-7?variant=v-short",
    affiliateUrl: "https://shop.example/products/p-7?variant=v-short&sca_ref=tracked",
  });
  const row = value.manifest.profiles[0].rows[0];
  value.manifest.schema_version = 3;
  value.manifest.kind = "reviewed-catalogue-package-v3";
  value.manifest.source_platform = "shopify";
  row.external_options = rawOptions;
  row.option_roles = resolveOptionRoles(rawOptions);
  row.source_structure = { product_variant_count: 2, meaningful_variant_axes: ["flavour"] };
  value.plan.retailer_product.values.external_options = rawOptions;
  const sourceRowFingerprint = crypto.createHash("sha256").update(JSON.stringify({ rawOptions, target })).digest("hex");
  row.source_row_fingerprint = sourceRowFingerprint;
  value.plan.meta.source_row_fingerprint = sourceRowFingerprint;
  value.plan.meta.plan_fingerprint = planFingerprint(value.plan);
  row.plan_fingerprint = value.plan.meta.plan_fingerprint;
  value.artifact.plans[0].source_row_fingerprint = sourceRowFingerprint;
  value.artifact.plans[0].plan_fingerprint = value.plan.meta.plan_fingerprint;
  value.artifact.source_rows[0].source_row_fingerprint = sourceRowFingerprint;
  value.artifact.source_rows[0].plan_fingerprint = value.plan.meta.plan_fingerprint;
  return reseal(value);
}

function load(value) {
  return loadReviewedPackage({ root: value.root, manifestPath: "config/retailers/example-reviewed.json", manifestSha256: value.manifestSha256, profileId: "batch-1", planFingerprint: value.plan.meta.plan_fingerprint });
}

test("one common reviewed package accepts arbitrary source IDs and reviewed product formats", () => {
  const value = fixture();
  const prepared = load(value);
  assert.equal(prepared.reviewed.external_variant_id, "v-short");
  assert.equal(prepared.reviewed.product_format, "liquid");
  assert.equal(prepared.entry.plan_fingerprint, value.plan.meta.plan_fingerprint);
});

test("reviewed catalogue v1 remains byte-compatible and keeps its single source URL contract", () => {
  const value = fixture();
  const before = JSON.stringify(value.manifest);
  const loaded = load(value);
  assert.equal(JSON.stringify(value.manifest), before);
  assert.equal(loaded.manifest.kind, "reviewed-catalogue-package-v1");
  assert.equal(loaded.reviewed.source_url, loaded.entry.resolved_plan.offer.values.url);
  assert.doesNotThrow(() => assertManifestTarget(loaded.manifest, "production"));
  assert.throws(() => assertManifestTarget(loaded.manifest, "staging"), /v1 remains production-only/);
});

test("reviewed catalogue v2 binds distinct direct and affiliate URLs including preserved query parameters", () => {
  const value = v2Fixture();
  const loaded = load(value);
  assert.equal(loaded.reviewed.external_url, "https://shop.example/product/p-7?variant=v-short");
  assert.equal(loaded.reviewed.affiliate_url, "https://shop.example/product/p-7?variant=v-short&sca_ref=tracked");
  assert.equal(loaded.entry.resolved_plan.retailer_product.values.external_url, loaded.reviewed.external_url);
  assert.equal(loaded.entry.resolved_plan.offer.values.url, loaded.reviewed.affiliate_url);
  assert.doesNotThrow(() => assertManifestTarget(loaded.manifest, "staging"));
});

test("reviewed catalogue v2 permits the backward-safe equal-URL case", () => {
  const url = "https://shop.example/product/p-7?variant=v-short";
  assert.doesNotThrow(() => load(v2Fixture({ directUrl: url, affiliateUrl: url })));
});

test("reviewed catalogue v2 rejects URL drift, swaps, missing affiliate URL and wrong direct host", () => {
  for (const [label, mutate, expected] of [
    ["direct drift", value => { value.manifest.profiles[0].rows[0].external_url += "&changed=1"; }, /direct URL mismatch/],
    ["affiliate drift", value => { value.manifest.profiles[0].rows[0].affiliate_url += "&changed=1"; }, /affiliate URL mismatch/],
    ["swapped", value => {
      const row = value.manifest.profiles[0].rows[0];
      [row.external_url, row.affiliate_url] = [row.affiliate_url, row.external_url];
    }, /direct URL mismatch/],
  ]) {
    const value = v2Fixture();
    mutate(value);
    reseal(value);
    assert.throws(() => load(value), expected, label);
  }
  const missing = v2Fixture();
  delete missing.manifest.profiles[0].rows[0].affiliate_url;
  assert.throws(() => validateManifest(missing.manifest, "batch-1"), /keys mismatch/);
  const wrongHost = v2Fixture({ directUrl: "https://other.example/product/p-7", affiliateUrl: "https://other.example/product/p-7?ref=tracked" });
  assert.throws(() => validateManifest(wrongHost.manifest, "batch-1"), /direct URL host mismatch/);
});

test("reviewed catalogue v2 fingerprints bind both URLs", () => {
  const base = v2Fixture();
  const affiliateChanged = v2Fixture({ affiliateUrl: "https://shop.example/product/p-7?variant=v-short&ref=other" });
  const directChanged = v2Fixture({ directUrl: "https://shop.example/product/p-7?variant=v-other" });
  for (const changed of [affiliateChanged, directChanged]) {
    assert.notEqual(changed.manifest.profiles[0].rows[0].source_row_fingerprint, base.manifest.profiles[0].rows[0].source_row_fingerprint);
    assert.notEqual(changed.manifest.profiles[0].rows[0].plan_fingerprint, base.manifest.profiles[0].rows[0].plan_fingerprint);
  }
});

test("reviewed catalogue v2 target environment and project ref are an exact pair", () => {
  for (const target of ["staging", "production"]) {
    const value = v2Fixture({ target });
    assert.equal(validateManifest(value.manifest, "batch-1").id, "batch-1");
    assert.doesNotThrow(() => assertManifestTarget(value.manifest, target));
  }
  const drift = v2Fixture();
  drift.manifest.target_project_ref = TARGETS.production.projectRef;
  assert.throws(() => validateManifest(drift.manifest, "batch-1"), /target project mismatch/);
});

test("reviewed catalogue v3 is explicit, closed and preserves raw Shopify option evidence", () => {
  const value = v3Fixture();
  const loaded = load(value);
  assert.equal(loaded.manifest.kind, "reviewed-catalogue-package-v3");
  assert.deepEqual(loaded.reviewed.external_options, { Flavours: "Berry", Size: "35 Servings", Weight: "420g" });
  assert.deepEqual(loaded.reviewed.option_roles, {
    flavour: { source_key: "Flavours", source_value: "Berry" },
    physical_size: { source_key: "Weight", source_value: "420g", size_value: "420", size_unit: "g" },
    count: { source_key: "Size", source_value: "35 Servings", count_value: "35", count_unit: "servings" },
  });
  const envelope = buildV3Envelope({ ...loaded, manifestSha256: value.manifestSha256 });
  assert.equal(envelope.kind, "reviewed-catalogue-authorization-v3");
  assert.equal(envelope.external_options.Size, "35 Servings");
  const drift = v3Fixture();
  drift.manifest.profiles[0].rows[0].unexpected = true;
  assert.throws(() => validateManifest(drift.manifest, "batch-1"), /keys mismatch/);
});

test("reviewed catalogue V3 is explicit at the protected target boundary", () => {
  const v2 = v2Fixture();
  const v3 = v3Fixture();
  assert.doesNotThrow(() => assertManifestTarget(v2.manifest, "staging"));
  assert.doesNotThrow(() => assertManifestTarget(v3.manifest, "staging"));
  assert.throws(
    () => assertManifestTarget({ ...v3.manifest, kind: "reviewed-catalogue-package-v4" }, "staging"),
    /Unsupported reviewed catalogue package kind/,
  );
});

test("reviewed catalogue v3 option semantics distinguish weight, servings and plural flavour aliases", () => {
  for (const alias of ["Flavour", "Flavor", "Flavours", "Flavors"]) {
    const roles = resolveOptionRoles({ [alias]: "Berry", Size: "35 Servings", Weight: "875g" });
    assert.equal(roles.flavour.source_key, alias);
    assert.equal(roles.physical_size.size_value, "875");
    assert.equal(roles.physical_size.size_unit, "g");
    assert.equal(roles.count.count_value, "35");
    assert.equal(roles.count.count_unit, "servings");
  }
  assert.equal(resolveOptionRoles({ Size: "35 Servings" }).physical_size, null);
});

test("reviewed catalogue v3 option roles support one exact composite count and physical size", () => {
  const singular = resolveOptionRoles({ Flavour: "Apple Burst", Size: "1 Serving (330ml)" });
  assert.deepEqual(singular.physical_size, {
    source_key: "Size", source_value: "1 Serving (330ml)", size_value: "330", size_unit: "ml",
  });
  assert.deepEqual(singular.count, {
    source_key: "Size", source_value: "1 Serving (330ml)", count_value: "1", count_unit: "servings",
  });

  const plural = resolveOptionRoles({ Size: "2 Servings (33cl)" });
  assert.deepEqual(plural.physical_size, {
    source_key: "Size", source_value: "2 Servings (33cl)", size_value: "330", size_unit: "ml",
  });
  assert.deepEqual(plural.count, {
    source_key: "Size", source_value: "2 Servings (33cl)", count_value: "2", count_unit: "servings",
  });
});

test("reviewed catalogue v3 composite option grammar rejects ambiguous or partial values", () => {
  for (const value of [
    "1 Serving 330ml 500ml",
    "330ml or 500ml",
    "1 or 2 Servings (330ml)",
    "1 Serving (330ml) extra",
    "1 Unknown (330ml)",
    "0 Servings (330ml)",
  ]) {
    const roles = resolveOptionRoles({ Size: value });
    assert.equal(roles.physical_size, null, value);
    assert.equal(roles.count, null, value);
  }
  assert.deepEqual(resolveOptionRoles({ Size: "330ml" }).physical_size, {
    source_key: "Size", source_value: "330ml", size_value: "330", size_unit: "ml",
  });
  assert.deepEqual(resolveOptionRoles({ Weight: "2.27kg" }).physical_size, {
    source_key: "Weight", source_value: "2.27kg", size_value: "2270", size_unit: "g",
  });
  assert.deepEqual(resolveOptionRoles({ Size: "30 Servings" }).count, {
    source_key: "Size", source_value: "30 Servings", count_value: "30", count_unit: "servings",
  });
});

test("reviewed catalogue v3 default variant requires one source variant and no flavour axis", () => {
  const value = v3Fixture({ rawOptions: { Size: "60 Servings" } });
  const row = value.manifest.profiles[0].rows[0];
  row.action = "create_product_with_default_variant";
  row.flavour = null;
  row.size_value = null;
  row.size_unit = null;
  row.unit_count = 60;
  row.unit_type = "servings";
  row.source_structure = { product_variant_count: 1, meaningful_variant_axes: [] };
  assert.doesNotThrow(() => validateManifest(value.manifest, "batch-1"));
  row.source_structure.product_variant_count = 2;
  assert.throws(() => validateManifest(value.manifest, "batch-1"), /default variant requires one source variant/);
});

test("reviewed catalogue v3 keeps commercial exclusions without treating formula stack prose as a bundle", () => {
  assert.equal(isV3SourceExcluded({ product_name: "Whey Bundle", description: "ordinary" }), true);
  assert.equal(isV3SourceExcluded({ product_name: "LFT V3", description: "caffeine stack for serious energy" }), false);
  assert.equal(isV3SourceExcluded({ product_name: "LFT V3", description: "includes a free item" }), true);
});

test("common reviewed manifest supports an exact owner-reviewed count identity", () => {
  const value = fixture();
  const row = value.manifest.profiles[0].rows[0];
  row.size_value = null;
  row.size_unit = null;
  row.unit_count = 60;
  row.unit_type = "gummies";
  assert.equal(validateManifest(value.manifest, "batch-1").rows[0].unit_count, 60);
  row.unit_type = null;
  assert.throws(() => validateManifest(value.manifest, "batch-1"), /unit count and type/);
});

test("common reviewed package loads the complete owner-approved scope once", () => {
  const value = fixture();
  const loaded = loadReviewedPackageScope({ root: value.root, manifestPath: "config/retailers/example-reviewed.json", manifestSha256: value.manifestSha256, profileId: "batch-1" });
  assert.equal(loaded.profile.rows.length, 1);
  assert.equal(loaded.byFingerprint.get(value.plan.meta.plan_fingerprint).resolved_plan.meta.idempotency_key, "reviewed-test");
});

test("reviewed package accepts its bounded default-variant product-create action", () => {
  const value = fixture();
  const entry = value.artifact.plans[0];
  entry.resolved_plan.product = { action: "create", id: null, values: { name: "Example" } };
  entry.resolved_plan.product_variant = { action: "create_default", id: null, values: { display_name: "Default" } };
  entry.resolved_plan.approval = { approved: true, approval_type: "safe_create" };
  entry.resolved_plan.expected_state.product = null;
  entry.resolved_plan.expected_state.product_variant = null;
  entry.plan_fingerprint = planFingerprint(entry.resolved_plan);
  entry.resolved_plan.meta.plan_fingerprint = entry.plan_fingerprint;
  value.artifact.source_rows[0].plan_fingerprint = entry.plan_fingerprint;
  const reviewed = value.manifest.profiles[0].rows[0];
  reviewed.action = "create_product_with_default_variant";
  reviewed.product_id = null;
  reviewed.product_variant_id = null;
  reviewed.plan_fingerprint = entry.plan_fingerprint;
  value.manifest.policy.allow_product_creation = true;
  value.manifest.policy.allow_variant_creation = true;
  value.manifest.profiles[0].expected_actions.products_create = 1;
  value.manifest.profiles[0].expected_actions.product_variants_create = 1;
  fs.writeFileSync(value.artifactPath, `${JSON.stringify(value.artifact, null, 2)}\n`);
  value.manifest.profiles[0].artifact_sha256 = sha256(fs.readFileSync(value.artifactPath));
  fs.writeFileSync(value.manifestPath, `${JSON.stringify(value.manifest, null, 2)}\n`);
  value.manifestSha256 = normalizedManifestSha(fs.readFileSync(value.manifestPath));
  value.plan = entry.resolved_plan;
  const prepared = load(value);
  assert.equal(prepared.reviewed.action, "create_product_with_default_variant");
  assert.equal(prepared.entry.resolved_plan.product_variant.action, "create_default");
});

test("reviewed package rejects digest, scope, shipping, SKU-as-GTIN and canonical write drift", () => {
  const cases = [
    ["manifest digest", value => { value.manifestSha256 = "0".repeat(64); }, /manifest SHA-256/],
    ["artifact digest", value => { fs.appendFileSync(value.artifactPath, " "); }, /artifact SHA-256/],
    ["outside fingerprint", value => { value.plan.meta.plan_fingerprint = "f".repeat(32); }, /outside the reviewed manifest/],
  ];
  for (const [, mutate, expected] of cases) {
    const value = fixture(); mutate(value); assert.throws(() => load(value), expected);
  }
  for (const [label, mutate, expected] of [
    ["shipping", plan => { plan.offer.values.shipping_cost = "4.99"; }, /fingerprint mismatch/],
    ["SKU as GTIN", plan => { plan.retailer_product.values.external_sku = "ABC"; plan.retailer_product.values.external_gtin = "ABC"; }, /fingerprint mismatch/],
    ["product create", plan => { plan.product.action = "create"; }, /action counts mismatch/],
  ]) {
    const value = fixture(); mutate(value.artifact.plans[0].resolved_plan); fs.writeFileSync(value.artifactPath, `${JSON.stringify(value.artifact, null, 2)}\n`); value.manifest.profiles[0].artifact_sha256 = sha256(fs.readFileSync(value.artifactPath)); fs.writeFileSync(value.manifestPath, `${JSON.stringify(value.manifest, null, 2)}\n`); value.manifestSha256 = normalizedManifestSha(fs.readFileSync(value.manifestPath)); assert.throws(() => load(value), expected, label);
  }
});

test("closed CLI requires the manifest digest, profile and one exact fingerprint", () => {
  assert.deepEqual(parseArgs(["--target=staging", "--manifest=config/retailers/a.json", `--manifest-sha256=${"a".repeat(64)}`, "--profile=batch-1", `--plan-fingerprint=${"b".repeat(32)}`]), { target: "staging", manifestPath: "config/retailers/a.json", manifestSha256: "a".repeat(64), profileId: "batch-1", planFingerprint: "b".repeat(32) });
  assert.throws(() => parseArgs(["--profile=batch-1"]), /required/);
  assert.throws(() => parseArgs(["--target=other", "--manifest=a", `--manifest-sha256=${"a".repeat(64)}`, "--profile=p", `--plan-fingerprint=${"b".repeat(32)}`]), /staging or production/);
});

test("credentials are target-bound protected direct PostgreSQL roles", () => {
  const credentialRoot = path.resolve("private");
  const exactCredential = path.resolve("exact", "validator.env");
  for (const target of ["staging", "production"]) for (const kind of ["validator", "approver", "executor"]) {
    const contract = targetContract(target, kind);
    assert.equal(contract.credentialPath, path.join(process.env.USERPROFILE || process.env.HOME || "", ".supplementscout", "credentials", `${target}-${kind}.env`));
    const direct = `REVIEWED_CATALOGUE_DATABASE_URL=postgresql://${contract.login}.${contract.projectRef}:secret@aws-0-eu-west-2.pooler.supabase.com:5432/postgres?sslmode=verify-full`;
    assert.match(parseCredential(target, kind, direct), /^postgresql:/);
    const other = target === "staging" ? "production" : "staging";
    assert.throws(() => parseCredential(other, kind, direct), /endpoint\/login required/);
  }
  assert.throws(() => parseCredential("production", "approver", "SUPABASE_SERVICE_ROLE_KEY=secret"), /one database URL/);
  assert.throws(() => parseCredential("production", "approver", `X_DATABASE_URL=postgresql://wrong:secret@db.${TARGETS.production.projectRef}.supabase.co/postgres?sslmode=verify-full`), /endpoint\/login required/);
  assert.throws(() => parseCredential("production", "wrong", "X_DATABASE_URL=x"), /Unknown protected/);
  assert.equal(credentialPath("staging", "validator", { SUPPLEMENTSCOUT_CREDENTIAL_ROOT: credentialRoot }), path.join(credentialRoot, "staging-validator.env"));
  assert.equal(credentialPath("staging", "validator", { SUPPLEMENTSCOUT_REVIEWED_STAGING_VALIDATOR_CREDENTIAL_FILE: exactCredential }), path.normalize(exactCredential));
  assert.throws(() => credentialPath("staging", "validator", { SUPPLEMENTSCOUT_CREDENTIAL_ROOT: "relative" }), /absolute/);
});

test("bounded reviewed state provider is read-only and validates every atomic plan", async () => {
  const value = v2Fixture();
  const loaded = load(value);
  const request = buildExecutionStateRequest(value.manifest, [loaded.entry]);
  const state = {
    schema_version: 1,
    target_environment: value.manifest.target_environment,
    target_project_ref: value.manifest.target_project_ref,
    retailer: value.manifest.retailer,
    products: [loaded.entry.resolved_plan.expected_state.product],
    product_variants: [loaded.entry.resolved_plan.expected_state.product_variant],
    retailer_products: [], offers: [], price_history: [],
    counts: { products: 1, product_variants: 1, retailer_products: 0, offers: 0, price_history: 0 },
  };
  const queries = [];
  const database = { async query(sql, params) {
    queries.push({ sql, params });
    if (sql.startsWith("select public.read_reviewed_catalogue_import_state")) return { rows: [{ state }] };
    return { rows: [{ result: { valid: true } }] };
  } };
  assert.deepEqual(await readState(database, request), state);
  const provider = createStateClient(state);
  assert.deepEqual((await provider.from("retailers").select().eq("slug", value.manifest.retailer.slug).maybeSingle()).data, state.retailer);
  assert.throws(() => provider.from("products").insert({}), /read only/);
  await validatePlans(database, [{ importPlan: loaded.entry.resolved_plan }]);
  assert.equal(queries.filter(query => query.sql.includes("validate_product_import_plan_read_only")).length, 1);
});

test("reviewed V3 validation sends the exact plan and authorization envelope to its separate RPC", async () => {
  const value = v3Fixture();
  const loaded = load(value);
  const queries = [];
  const database = { async query(sql, params) { queries.push({ sql, params }); return { rows: [{ result: { valid: true } }] }; } };
  await validatePlans(database, [{ importPlan: loaded.entry.resolved_plan }], {
    manifest: loaded.manifest,
    profile: loaded.profile,
    artifact: loaded.artifact,
    manifestSha256: value.manifestSha256,
  });
  assert.equal(queries[0].sql, V3_VALIDATION_SQL);
  assert.equal(queries[0].params[0], loaded.entry.resolved_plan);
  assert.equal(queries[0].params[1].kind, "reviewed-catalogue-authorization-v3");
  assert.equal(V2_VALIDATION_SQL, "select public.validate_product_import_plan_read_only($1::jsonb) result");
});

test("approval transaction uses only the approver role and approval RPC", async () => {
  const value = fixture();
  const prepared = load(value); prepared.manifestSha256 = value.manifestSha256;
  const queries = [];
  const client = { async connect() {}, async end() {}, async query(sql, params) { queries.push({ sql, params }); if (sql.startsWith("select current_user")) return { rows: [{ current_user: "retailer_catalogue_production_approver", session_user: "supplementscout_production_approver_login", current_database: "postgres", transaction_read_only: "off", target_marker: "1", opposite_marker: null, catalogue_allow: "1", safe_update: null }] }; if (sql === APPROVAL_SQL) return { rows: [{ result: { approval_id: "123e4567-e89b-42d3-a456-426614174000", status: "approved", artifact_sha256: prepared.profile.artifact_sha256, run_id: prepared.artifact.run_id, plan_fingerprint: prepared.entry.plan_fingerprint, source_row_fingerprint: prepared.entry.source_row_fingerprint, retailer_id: "14", plan_kind: "feed", expires_at: new Date(Date.now() + 10 * 60_000).toISOString() } }] }; return { rows: [] }; } };
  const result = await approveWithClient(prepared, client, "production");
  assert.equal(result.approval_only, true);
  assert.deepEqual(queries.map(query => query.sql), ["begin", "select set_config($1,'1',true),set_config('app.retailer_catalogue_allow','1',true)", "set local role retailer_catalogue_production_approver", "select current_user,session_user,current_database(),current_setting('transaction_read_only') transaction_read_only,current_setting($1,true) target_marker,current_setting($2,true) opposite_marker,current_setting('app.retailer_catalogue_allow',true) catalogue_allow,current_setting('app.safe_update',true) safe_update", APPROVAL_SQL, "commit"]);
  const source = fs.readFileSync(path.join(__dirname, "reviewed-catalogue-artifact-approver.js"), "utf8");
  assert.doesNotMatch(source, /apply_approved_product_import_plan|pilot-apply|service_role|\.from\(|\b(insert into|update (products|product_variants|retailer_products|offers|price_history)|delete from)\b/i);
});

test("reviewed V3 approval uses only the separately versioned approver RPC", async () => {
  const value = v3Fixture();
  const prepared = load(value); prepared.manifestSha256 = value.manifestSha256;
  const queries = [];
  const client = { async connect() {}, async end() {}, async query(sql, params) {
    queries.push({ sql, params });
    if (sql.startsWith("select current_user")) return { rows: [{ current_user: "retailer_catalogue_staging_approver", session_user: "supplementscout_staging_approver_login", current_database: "postgres", transaction_read_only: "off", target_marker: "1", opposite_marker: null, catalogue_allow: "1", safe_update: null }] };
    if (sql === V3_APPROVAL_SQL) return { rows: [{ result: {
      approval_id: "123e4567-e89b-42d3-a456-426614174000", status: "approved",
      artifact_sha256: prepared.profile.artifact_sha256, run_id: prepared.artifact.run_id,
      plan_fingerprint: prepared.entry.plan_fingerprint, source_row_fingerprint: prepared.entry.source_row_fingerprint,
      retailer_id: "14", plan_kind: "feed", contract_kind: "reviewed-catalogue-package-v3",
      manifest_sha256: prepared.manifestSha256, target_environment: "STAGING", target_project_ref: TARGETS.staging.projectRef,
      expires_at: new Date(Date.now() + 10 * 60_000).toISOString(),
    } }] };
    return { rows: [] };
  } };
  const result = await approveWithClient(prepared, client, "staging");
  assert.equal(result.approval_only, true);
  assert.equal(queries.find(query => query.sql === V3_APPROVAL_SQL).params[1].kind, "reviewed-catalogue-authorization-v3");
  assert.ok(!queries.some(query => query.sql === APPROVAL_SQL));
});

test("database contract accepts only ledger-bound reviewed plans and keeps role separation", () => {
  const sql = fs.readFileSync(path.join(__dirname, "../supabase/migrations/20260907100000_add_reviewed_catalogue_package_v1.sql"), "utf8");
  assert.match(sql, /approved_import_plans a[\s\S]+a\.status = 'approved'[\s\S]+a\.plan_json = p_plan/i);
  assert.match(sql, /perform public\.validate_reviewed_catalogue_import_plan\(p_plan\)/i);
  assert.match(sql, /v_mapping->>'external_product_id'[\s\S]+v_mapping->>'external_variant_id'/i);
  assert.match(sql, /external_gtin[\s\S]+external_sku/i);
  assert.match(sql, /total_price'[\s\S]+price'[\s\S]+shipping_cost'/i);
  assert.match(sql, /grant execute on function public\.approve_reviewed_catalogue_import_plan[\s\S]+to retailer_catalogue_production_approver/i);
  assert.match(sql, /has_function_privilege\('service_role',[\s\S]+approve_reviewed_catalogue_import_plan/i);
  assert.match(sql, /has_function_privilege\('retailer_catalogue_production_approver',[\s\S]+apply_approved_product_import_plan/i);
  assert.doesNotMatch(sql, /grant execute[\s\S]+approve_reviewed_catalogue_import_plan[\s\S]+to (?:service_role|anon|authenticated|retailer_catalogue_production_executor)/i);
  assert.doesNotMatch(sql, /insert into public\.(?:products|product_variants|retailer_products|offers|price_history)/i);
});

test("shared database contract accepts reviewed count identity without retailer-specific allowlists", () => {
  const sql = fs.readFileSync(path.join(__dirname, "../supabase/migrations/20260907210000_allow_reviewed_catalogue_count_identity.sql"), "utf8");
  assert.match(sql, /create or replace function public\.validate_reviewed_catalogue_import_plan\(p_plan jsonb\)/i);
  assert.match(sql, /evidence,unit_count[\s\S]+tablets\|capsules\|gummies\|chews/i);
  assert.match(sql, /v_product_values->>'unit_count'[\s\S]+public\.products p[\s\S]+p\.unit_count/i);
  assert.match(sql, /v_variant_values->'size_value' = 'null'::jsonb[\s\S]+v_variant_values->'size_unit' = 'null'::jsonb/i);
  assert.doesNotMatch(sql, /10\s*Reps|\b(?:8361|8366|8395|1705|9325|9282|9522|9182|9187|9666|9293|9754|9194|8164|9288)\b/i);
  assert.doesNotMatch(sql, /\b(?:insert\s+into|update|delete\s+from)\s+public\.(?:retailers|products|product_variants|retailer_products|offers|price_history)\b/i);
  assert.doesNotMatch(sql, /grant execute/i);
});

test("package executor CLI binds one complete manifest profile and explicit mode", () => {
  assert.deepEqual(parsePackageArgs([
    "--target=staging",
    "--mode=apply",
    "--manifest=config/retailers/example.json",
    `--manifest-sha256=${"a".repeat(64)}`,
    "--profile=batch-1",
    "--output=tmp/retailer-feeds/example/result.json",
  ]), {
    target: "staging", mode: "apply", manifestPath: "config/retailers/example.json", manifestSha256: "a".repeat(64),
    profileId: "batch-1", outputPath: "tmp/retailer-feeds/example/result.json",
  });
  assert.throws(() => parsePackageArgs(["--mode=apply"]), /required/);
  assert.throws(() => parsePackageArgs([
    "--target=production", "--mode=bulk", "--manifest=config/retailers/example.json", `--manifest-sha256=${"a".repeat(64)}`,
    "--profile=batch-1", "--output=tmp/retailer-feeds/example/result.json",
  ]), /preflight or apply/);
});

test("package executor requires three distinct protected direct PostgreSQL credentials", () => {
  for (const target of ["staging", "production"]) for (const kind of ["approver", "executor", "validator"]) {
    const contract = targetContract(target, kind);
    const login = `${contract.login}.${contract.projectRef}`;
    assert.match(parsePackageCredential(target, kind, `CATALOGUE_DATABASE_URL=postgresql://${login}:secret@aws-0-eu-west-2.pooler.supabase.com:5432/postgres?sslmode=verify-full`), /^postgresql:/);
  }
  assert.throws(() => parsePackageCredential("production", "executor", "SUPABASE_SERVICE_ROLE_KEY=secret"), /one database URL/);
});

test("package role transactions set the exact role, commit success and roll back errors", async () => {
  const queries = [];
  const client = { async query(sql, params) {
    queries.push({ sql, params });
    if (sql.startsWith("select current_user")) return { rows: [{ current_user: "retailer_catalogue_staging_executor", session_user: "supplementscout_staging_executor_login", current_database: "postgres", transaction_read_only: "off", target_marker: "1", opposite_marker: null, catalogue_allow: "1", safe_update: null }] };
    return { rows: [] };
  } };
  assert.equal(await roleTransaction(client, "staging", "executor", async () => "done"), "done");
  assert.deepEqual(queries.map(query => query.sql), ["begin", "select set_config($1,'1',true),set_config('app.retailer_catalogue_allow','1',true)", "set local role retailer_catalogue_staging_executor", "select current_user,session_user,current_database(),current_setting('transaction_read_only') transaction_read_only,current_setting($1,true) target_marker,current_setting($2,true) opposite_marker,current_setting('app.retailer_catalogue_allow',true) catalogue_allow,current_setting('app.safe_update',true) safe_update", "commit"]);
  assert.deepEqual(queries[1].params, ["app.retailer_catalogue_staging_marker"]);
  queries.length = 0;
  await assert.rejects(() => roleTransaction(client, "staging", "executor", async () => { throw new Error("stop"); }), /stop/);
  assert.equal(queries.at(-1).sql, "rollback");
});

function sessionClient(target, kind, overrides = {}) {
  const contract = targetContract(target, kind);
  const queries = [];
  const identity = {
    current_user: contract.role,
    session_user: contract.login,
    current_database: "postgres",
    transaction_read_only: kind === "validator" ? "on" : "off",
    target_marker: kind === "validator" ? null : "1",
    opposite_marker: null,
    catalogue_allow: kind === "validator" ? null : "1",
    safe_update: null,
    ...overrides,
  };
  return {
    queries,
    client: { async query(sql, params) {
      queries.push({ sql, params });
      if (sql.startsWith("select current_user")) return { rows: [identity] };
      return { rows: [] };
    } },
  };
}

test("staging and production validator preflights are read-only and target-bound", async () => {
  for (const target of ["staging", "production"]) {
    const { client, queries } = sessionClient(target, "validator");
    assert.equal(await targetRoleTransaction(client, target, "validator", async () => "PASS", { readOnly: true }), "PASS");
    assert.equal(queries[1].sql, "set transaction read only");
    assert.equal(queries.at(-1).sql, "rollback");
  }
});

test("staging and production apply sessions require their exact marker and role", async () => {
  for (const target of ["staging", "production"]) {
    const { client, queries } = sessionClient(target, "executor");
    assert.equal(await targetRoleTransaction(client, target, "executor", async () => "PASS"), "PASS");
    assert.deepEqual(queries[1].params, [TARGETS[target].marker]);
    assert.equal(queries.at(-1).sql, "commit");
  }
});

test("reviewed sessions reject wrong login, group role, database, marker and SAFE_UPDATE", async () => {
  for (const [label, overrides, expected] of [
    ["login", { session_user: "supplementscout_production_executor_login" }, /identity mismatch/],
    ["role", { current_user: "retailer_catalogue_production_executor" }, /identity mismatch/],
    ["database", { current_database: "other" }, /database mismatch/],
    ["missing marker", { target_marker: null }, /marker mismatch/],
    ["wrong marker", { opposite_marker: "1" }, /Cross-environment/],
    ["SAFE_UPDATE", { safe_update: "on" }, /SAFE_UPDATE/],
  ]) {
    const { client, queries } = sessionClient("staging", "executor", overrides);
    await assert.rejects(() => targetRoleTransaction(client, "staging", "executor", async () => "unexpected"), expected, label);
    assert.equal(queries.at(-1).sql, "rollback");
  }
  assert.throws(() => assertSafeUpdateDisabled({ SAFE_UPDATE: "true" }), /SAFE_UPDATE/);
  assert.doesNotThrow(() => assertSafeUpdateDisabled({ SAFE_UPDATE: "false" }));
});

test("reviewed target path accepts legacy require input but always delegates verified TLS", () => {
  const contract = targetContract("production", "validator");
  const legacy = `X_DATABASE_URL=postgresql://${contract.login}.${contract.projectRef}:secret@aws-0-eu-west-2.pooler.supabase.com:5432/postgres?sslmode=require`;
  assert.doesNotMatch(parseCredential("production", "validator", legacy), /sslmode/);
  const sources = [
    "lib/reviewed-catalogue-target.js",
    "reviewed-catalogue-artifact-approver.js",
    "reviewed-catalogue-package-executor.js",
  ].map(file => fs.readFileSync(path.join(__dirname, file), "utf8")).join("\n");
  assert.doesNotMatch(sources, /rejectUnauthorized\s*:\s*false/);
  assert.match(sources, /secure-postgres/);
});

test("package executor accepts the standard atomic receipt without a replay flag and rejects an explicit replay", async () => {
  const value = fixture();
  const loaded = load(value);
  const prepared = { ...loaded, entry: loaded.entry, reviewed: loaded.reviewed, manifestSha256: value.manifestSha256 };
  const receipt = { approval_id: "123e4567-e89b-42d3-a456-426614174000" };
  const baseResult = {
    approval_status: "consumed",
    artifact_sha256: prepared.profile.artifact_sha256,
    plan_fingerprint: prepared.entry.plan_fingerprint,
    source_row_fingerprint: prepared.entry.source_row_fingerprint,
    retailer_id: prepared.entry.retailer_id,
    plan_kind: prepared.entry.plan_kind,
    run_id: prepared.artifact.run_id,
  };
  const queries = [];
  const client = { async query(sql) {
    queries.push(sql);
    if (sql.startsWith("select current_user")) return { rows: [{ current_user: "retailer_catalogue_production_executor", session_user: "supplementscout_production_executor_login", current_database: "postgres", transaction_read_only: "off", target_marker: "1", opposite_marker: null, catalogue_allow: "1", safe_update: null }] };
    if (sql === PACKAGE_APPLY_SQL) return { rows: [{ result: baseResult }] };
    return { rows: [] };
  } };
  assert.deepEqual(await applyPackage(client, prepared, receipt, "production"), baseResult);
  assert.equal(queries.at(-1), "commit");
  queries.length = 0;
  const replayClient = { ...client, async query(sql) {
    queries.push(sql);
    if (sql.startsWith("select current_user")) return { rows: [{ current_user: "retailer_catalogue_production_executor", session_user: "supplementscout_production_executor_login", current_database: "postgres", transaction_read_only: "off", target_marker: "1", opposite_marker: null, catalogue_allow: "1", safe_update: null }] };
    if (sql === PACKAGE_APPLY_SQL) return { rows: [{ result: { ...baseResult, already_applied: true } }] };
    return { rows: [] };
  } };
  await assert.rejects(() => applyPackage(replayClient, prepared, receipt, "production"), /receipt invalid/);
  assert.equal(queries.at(-1), "rollback");
});

test("package executor treats strict database readback as authoritative when the standard receipt omits business IDs", () => {
  const source = fs.readFileSync(path.join(__dirname, "reviewed-catalogue-package-executor.js"), "utf8");
  assert.match(source, /if \(execution\[field\] != null\) invariant\(String\(execution\[field\]\) === row\[field\]/);
  assert.match(source, /for \(const field of \["product_id", "product_variant_id", "retailer_product_id", "offer_id", "price_history_id"\]\)/);
  assert.match(source, /verifyTarget\(entry, checked\.target\)/);
});

test("package executor keeps per-plan atomic deltas and strict commercial readback", () => {
  const plan = fixture().plan;
  assert.deepEqual(expectedDelta(plan), { products: 0, product_variants: 0, retailer_products: 1, offers: 1, price_history: 1 });
  const entry = { plan_fingerprint: plan.meta.plan_fingerprint, resolved_plan: plan };
  const product = { ...plan.expected_state.product, brand: "Extra captured database field" };
  const variant = { ...plan.expected_state.product_variant, product_id: "788" };
  const mapping = { id: "3010", product_id: "788", product_variant_id: "1080", ...plan.retailer_product.values, match_confidence: "100.00" };
  const offer = { id: "2823", ...plan.offer.values, retailer_product_id: "3010" };
  const history = [{ id: "9001", offer_id: "2823", checked_at: plan.offer.values.last_checked_at, ...plan.price_history.values }];
  const checked = verifyTarget(entry, { product, variant, mapping, offer, history });
  assert.equal(checked.offer_id, "2823");
  const numericVariant = { ...variant, size_value: 40, pack_count: 1 };
  const numericEntry = { ...entry, resolved_plan: { ...plan, expected_state: { ...plan.expected_state, product_variant: { ...plan.expected_state.product_variant, size_value: "40", pack_count: "1" } } } };
  assert.equal(verifyTarget(numericEntry, { product, variant: numericVariant, mapping, offer, history }).offer_id, "2823");
  assert.throws(() => verifyTarget(numericEntry, { product, variant: { ...numericVariant, pack_count: 2 }, mapping, offer, history }), /existing variant mismatch/);
  assert.throws(() => verifyTarget(entry, { product: { ...product, name: "Changed" }, variant, mapping, offer, history }), /existing product mismatch/);
  assert.throws(() => verifyTarget(entry, { product, variant, mapping, offer: { ...offer, shipping_cost: "4.99" }, history }), /price mismatch/);
});

test("package executor compares offer and price-history money by canonical decimal value", () => {
  const plan = fixture().plan;
  plan.offer.values = { ...plan.offer.values, price: "2.4", shipping_cost: "6.99", total_price: "9.39" };
  plan.price_history.values = { ...plan.price_history.values, price: "2.4", shipping_cost: "6.99", total_price: "9.39" };
  const entry = { plan_fingerprint: plan.meta.plan_fingerprint, resolved_plan: plan };
  const product = { ...plan.expected_state.product };
  const variant = { ...plan.expected_state.product_variant };
  const mapping = { id: "3010", ...plan.retailer_product.values };
  const offer = {
    id: "2823", ...plan.offer.values, retailer_product_id: "3010",
    price: "2.40", shipping_cost: "6.990", total_price: "9.3900",
  };
  const history = [{
    id: "9001", offer_id: "2823", checked_at: plan.offer.values.last_checked_at,
    ...plan.price_history.values, price: "2.40", shipping_cost: "6.990", total_price: "9.3900",
  }];

  assert.doesNotThrow(() => verifyTarget(entry, { product, variant, mapping, offer, history }));
  for (const [field, value] of [["price", "2.41"], ["shipping_cost", "7"], ["total_price", "9.40"]]) {
    assert.throws(() => verifyTarget(entry, { product, variant, mapping, offer: { ...offer, [field]: value }, history }), /Offer price mismatch/);
    assert.throws(() => verifyTarget(entry, { product, variant, mapping, offer, history: [{ ...history[0], [field]: value }] }), /Price history mismatch/);
  }
  assert.throws(() => verifyTarget(entry, { product, variant, mapping, offer: { ...offer, price: "not-money" }, history }), /offer price must be a valid decimal/);
});

test("package postflight normalizes only safe decimal database identities", () => {
  assert.equal(opaqueDecimalId(338), "338");
  assert.equal(opaqueDecimalId("338"), "338");
  assert.equal(opaqueDecimalId(null), null);
  assert.equal(opaqueDecimalId("900719925474099312345"), "900719925474099312345");
  assert.equal(opaqueDecimalId(Number.MAX_SAFE_INTEGER + 1), Number.MAX_SAFE_INTEGER + 1);

  assert.doesNotThrow(() => sameExpectedState(
    { id: 338, product_id: 338, merged_into_product_id: null, name: "Clear Whey" },
    { id: "338", product_id: "338", merged_into_product_id: null, name: "Clear Whey" },
    "existing product",
  ));
  assert.doesNotThrow(() => sameExpectedState(
    { id: "900719925474099312345", product_id: "900719925474099312344" },
    { id: "900719925474099312345", product_id: "900719925474099312344" },
    "large identity",
  ));
  assert.throws(() => sameExpectedState(
    { id: "900719925474099312346" },
    { id: "900719925474099312345" },
    "large identity",
  ), /large identity mismatch/);
  assert.throws(() => sameExpectedState(
    { id: 339, name: "Clear Whey" },
    { id: "338", name: "Clear Whey" },
    "existing product",
  ), /existing product mismatch/);
  assert.throws(() => sameExpectedState(
    { id: 338, merged_into_product_id: 99 },
    { id: "338", merged_into_product_id: null },
    "merged product",
  ), /merged product mismatch/);
  assert.throws(() => sameExpectedState(
    { id: 338, name: 338 },
    { id: "338", name: "338" },
    "ordinary string",
  ), /ordinary string mismatch/);
});

test("package postflight accepts numeric IDs captured from PostgreSQL JSON", () => {
  const plan = fixture().plan;
  const entry = { plan_fingerprint: plan.meta.plan_fingerprint, retailer_id: "14", resolved_plan: plan };
  const state = {
    products: [{ ...plan.expected_state.product, id: 788 }],
    product_variants: [{ ...plan.expected_state.product_variant, id: 1080, product_id: 788 }],
    retailer_products: [{ id: 3010, ...plan.retailer_product.values, retailer_id: 14, product_id: 788, product_variant_id: 1080, match_confidence: "100.00" }],
    offers: [{ id: 2823, ...plan.offer.values, retailer_id: 14, product_id: 788, product_variant_id: 1080, retailer_product_id: 3010 }],
    price_history: [{ id: 9001, offer_id: 2823, checked_at: plan.offer.values.last_checked_at, ...plan.price_history.values }],
  };
  const target = captureTarget(state, entry);
  const checked = verifyTarget(entry, target);
  assert.equal(checked.product_id, "788");
  assert.equal(checked.product_variant_id, "1080");
  assert.equal(checked.retailer_product_id, "3010");
  assert.equal(checked.offer_id, "2823");
});

test("package executor uses only approval/apply RPCs and contains no direct business DML or service role", () => {
  const source = fs.readFileSync(path.join(__dirname, "reviewed-catalogue-package-executor.js"), "utf8");
  assert.match(PACKAGE_APPROVAL_SQL, /approve_reviewed_catalogue_import_plan/);
  assert.match(PACKAGE_APPLY_SQL, /apply_approved_product_import_plan/);
  assert.doesNotMatch(source, /SUPABASE_SERVICE_ROLE_KEY|service_role|createClient|\.from\(|postgrest/i);
  assert.doesNotMatch(source, /client\.query\(["'`]select[\s\S]{0,120}(?:retailers|products|product_variants|retailer_products|offers|price_history)/i);
  assert.match(source, /readState\(client, request\)/);
  assert.doesNotMatch(source, /\b(?:insert\s+into|update|delete\s+from)\s+(?:public\.)?(?:retailers|products|product_variants|retailer_products|offers|price_history)\b/i);
  assert.doesNotMatch(source, /spawnSync|forEach\([^)]*approve|Promise\.all\([^)]*apply/i);
});

test("bounded reviewed state RPC is validator-only and adds no table grants", () => {
  const sql = fs.readFileSync(path.join(__dirname, "../supabase/migrations/20261017130000_add_reviewed_catalogue_bounded_state.sql"), "utf8");
  assert.match(sql, /stable\s+security definer\s+set search_path = pg_catalog, public, pg_temp/i);
  assert.match(sql, /jsonb_array_length\(p_request->'rows'\)[\s\S]+v_row_count>200/i);
  assert.match(sql, /transaction_read_only'\)<>'on'/i);
  assert.match(sql, /grant execute on function public\.read_reviewed_catalogue_import_state\(jsonb\)[\s\S]+retailer_catalogue_staging_validator, retailer_catalogue_production_validator/i);
  assert.match(sql, /revoke all on function public\.read_reviewed_catalogue_import_state\(jsonb\)[\s\S]+service_role[\s\S]+approver[\s\S]+executor/i);
  assert.doesNotMatch(sql, /grant\s+select\s+on/i);
  assert.doesNotMatch(sql, /\b(?:insert\s+into|update|delete\s+from)\s+public\.(?:retailers|products|product_variants|retailer_products|offers|price_history)\b/i);
  assert.doesNotMatch(sql, /execute\s+format|\bexecute\s+['"]/i);
});

test("V3 database boundary is additive, role-separated and contains no retailer policy", () => {
  const migration = fs.readFileSync(path.join(__dirname, "../supabase/migrations/20261018120000_add_reviewed_catalogue_v3_boundary.sql"), "utf8");
  const rollback = fs.readFileSync(path.join(__dirname, "../supabase/rollbacks/20261018120000_add_reviewed_catalogue_v3_boundary_rollback.sql"), "utf8");
  const validator = migration.match(/create function public\.atomic_import_validate_reviewed_catalogue_v3_plan[\s\S]+?(?=create function public\.validate_reviewed_catalogue_v3_plan_read_only)/i)?.[0] || "";
  assert.match(migration, /create function public\.validate_reviewed_catalogue_v3_plan_read_only\(p_plan jsonb,p_envelope jsonb\)/i);
  assert.match(migration, /create function public\.approve_reviewed_catalogue_v3_plan\([\s\S]+perform public\.atomic_import_validate_reviewed_catalogue_v3_plan\(p_plan,p_envelope\)/i);
  assert.match(migration, /create function public\.apply_approved_reviewed_catalogue_v3_plan\([\s\S]+public\.apply_approved_product_import_plan/i);
  assert.match(migration, /70f134e6f7d3afa25de52353ff5e8aca3cc0f7c34a58d9da3577ead4ac11f4a9/);
  assert.match(migration, /b9d99d9245ff2ea493fa9ed4d160f0e9ff4c450764cb40a5a23325d0ca069583/);
  assert.match(migration, /rename to atomic_import_validate_product_before_reviewed_v3/i);
  assert.match(migration, /create function public\.validate_product_import_plan_read_only\(p_plan jsonb\)[\s\S]+atomic_import_validate_product_before_reviewed_v3\(p_plan\)/i);
  assert.match(migration, /app\.reviewed_catalogue_v3_approval_id[\s\S]+status='approved'[\s\S]+authorization_envelope[\s\S]+session_user[\s\S]+app\.retailer_catalogue_allow[\s\S]+transaction_read_only/i);
  assert.match(migration, /if not exists\([\s\S]+column_name='execution_result'[\s\S]+add column execution_result jsonb/i);
  assert.match(migration, /grant execute on function public\.validate_reviewed_catalogue_v3_plan_read_only[\s\S]+validator/i);
  assert.match(migration, /grant execute on function public\.approve_reviewed_catalogue_v3_plan[\s\S]+approver/i);
  assert.match(migration, /grant execute on function public\.apply_approved_reviewed_catalogue_v3_plan[\s\S]+executor/i);
  assert.doesNotMatch(migration, /grant\s+(?:select|insert|update|delete)\s+on/i);
  assert.doesNotMatch(migration, /grant execute[\s\S]{0,180}\b(?:service_role|anon|authenticated)\b/i);
  assert.doesNotMatch(migration, /gladiator/i);
  assert.doesNotMatch(migration, /create or replace function public\.atomic_import_reviewed_catalogue_plan_allowed/i);
  assert.doesNotMatch(migration, /rename to atomic_import_validate_reviewed_catalogue_before_v3/i);
  assert.doesNotMatch(validator, /\b(?:insert\s+into|update|delete\s+from)\s+public\./i);
  assert.doesNotMatch(validator, /execute\s+format|\bexecute\s+['"]/i);
  assert.match(rollback, /rollback blocked by durable approval evidence/i);
  assert.match(rollback, /rename to validate_product_import_plan_read_only/i);
  assert.match(rollback, /approved_import_plans_v3_created_execution_result_check[\s\S]+execution_result is not null[\s\S]+drop column execution_result/i);
  assert.doesNotMatch(rollback, /create or replace function public\.atomic_import_reviewed_catalogue_plan_allowed/i);
  assert.doesNotMatch(rollback, /\b(?:insert\s+into|update|delete\s+from)\s+public\.(?:retailers|products|product_variants|retailer_products|offers|price_history)\b/i);
});

test("V3 apply option-role compatibility is validation-only and fail-closed", () => {
  const migration = fs.readFileSync(path.join(__dirname, "../supabase/migrations/20261018190000_fix_reviewed_catalogue_v3_apply_option_roles.sql"), "utf8");
  const rollback = fs.readFileSync(path.join(__dirname, "../supabase/rollbacks/20261018190000_fix_reviewed_catalogue_v3_apply_option_roles_rollback.sql"), "utf8");
  const rollbackExecutable = rollback.replace(/\$patch\$[\s\S]*?\$patch\$/gi, "");
  const helper = migration.match(/create function public\.atomic_import_reviewed_v3_legacy_validation_evidence[\s\S]+?(?=alter function public\.atomic_import_reviewed_v3_legacy_validation_evidence)/i)?.[0] || "";
  assert.match(migration, /69311caa0dda83010f986dfbd76bc0017d3a0f999c64b1dd5e35dcb87b7d4c48/);
  assert.match(migration, /0b0bccb01e521228db93f495db7984372df5b177cf7009edc205620c1ddef634/);
  assert.match(migration, /f560a7a93e3458db20d4a71451da35b53fe1fac9379bfedcd86ab98b76d3d648/);
  assert.match(migration, /atomic_import_reviewed_catalogue_v3_plan_allowed\(p_plan\)[\s\S]+authorization_envelope[\s\S]+atomic_import_reviewed_v3_legacy_validation_evidence/i);
  assert.match(helper, /atomic_import_validate_reviewed_catalogue_v3_plan\(p_plan,p_envelope\)/i);
  assert.match(helper, /v_evidence->'external_options' is distinct from v_raw_options/i);
  assert.match(helper, /v_validation_options := v_validation_options-v_count_key/i);
  assert.match(helper, /to_jsonb\(v_physical->>'source_value'\)/i);
  assert.doesNotMatch(helper, /\b(?:insert\s+into|update|delete\s+from)\s+public\./i);
  assert.match(migration, /insert into public\.retailer_products\([\s\S]+p_plan#>'\{retailer_product,values,external_options\}'/i);
  assert.match(migration, /atomic_import_reviewed_catalogue_v3_plan_allowed\(p_plan\)[\s\S]+atomic_import_validate_pre_source_metadata_plan_core\(p_plan\)[\s\S]+validate_product_import_plan_read_only\(p_plan\)/i);
  assert.doesNotMatch(migration, /gladiator|41660010332205|8158fb71-46f3-4e09-91a3-69f50cdaa683/i);
  assert.doesNotMatch(migration, /grant\s+(?:select|insert|update|delete)\s+on/i);
  assert.match(rollback, /rollback blocked by runtime drift/i);
  assert.match(rollback, /cannot restore known lineage/i);
  assert.match(rollback, /pre-source rollback cannot restore known lineage/i);
  assert.match(rollback, /drop function public\.atomic_import_reviewed_v3_legacy_validation_evidence/i);
  assert.doesNotMatch(rollbackExecutable, /\b(?:insert\s+into|update|delete\s+from)\s+public\.(?:retailers|products|product_variants|retailer_products|offers|price_history|approved_import_plans)\b/i);
});

test("V3 post-create option-role compatibility preserves the trusted plan and raw DML", () => {
  const migration = fs.readFileSync(path.join(__dirname, "../supabase/migrations/20261019100000_fix_reviewed_v3_post_create_option_roles.sql"), "utf8");
  const rollback = fs.readFileSync(path.join(__dirname, "../supabase/rollbacks/20261019100000_fix_reviewed_v3_post_create_option_roles_rollback.sql"), "utf8");
  const migrationExecutable = migration.replace(/\$patch\$[\s\S]*?\$patch\$/gi, "");
  const rollbackExecutable = rollback.replace(/\$patch\$[\s\S]*?\$patch\$/gi, "");

  assert.match(migration, /atomic_import_reviewed_catalogue_v3_plan_allowed\(p_plan\)[\s\S]+plan_json=p_plan[\s\S]+authorization_envelope=p_envelope/i);
  assert.match(migration, /current_setting\('app\.reviewed_catalogue_v3_approval_id',true\)/i);
  assert.match(migration, /atomic_import_reviewed_v3_legacy_validation_evidence\(p_plan,v_reviewed_v3_envelope\)/i);
  assert.match(migration, /p_plan#>'\{retailer_product,values,external_options\}'/i);
  assert.match(migration, /906cb5abad08deb8452fa9ae4fed8be8669b760e6f2ef088ae8846f5536b27db/i);
  assert.match(rollback, /849df8441e8994daf1acb514705808fde17467e033185e30cc432ad165a13905/i);
  assert.match(rollback, /rollback blocked by live approval/i);
  assert.doesNotMatch(migration, /gladiator|naughty boy|7555942383661|41805313015853/i);
  assert.doesNotMatch(migrationExecutable, /\b(?:insert\s+into|update|delete\s+from)\s+public\.(?:retailers|products|product_variants|retailer_products|offers|price_history|approved_import_plans)\b/i);
  assert.doesNotMatch(migrationExecutable, /\bgrant\b/i);
  assert.doesNotMatch(rollbackExecutable, /\b(?:insert\s+into|update|delete\s+from)\s+public\.(?:retailers|products|product_variants|retailer_products|offers|price_history|approved_import_plans)\b/i);
});

test("trusted V3 reviewed-parent bridge replaces only legacy family and transport authorization", () => {
  const migration = fs.readFileSync(path.join(__dirname, "../supabase/migrations/20261019120000_bridge_trusted_v3_reviewed_parent_policy.sql"), "utf8");
  const rollback = fs.readFileSync(path.join(__dirname, "../supabase/rollbacks/20261019120000_bridge_trusted_v3_reviewed_parent_policy_rollback.sql"), "utf8");
  const migrationExecutable = migration.replace(/\$patch\$[\s\S]*?\$patch\$/gi, "");
  const rollbackExecutable = rollback.replace(/\$patch\$[\s\S]*?\$patch\$/gi, "");

  assert.match(migration, /47913d9e685b0b0804cac3349a7e8d037878834071a7ad4a69be0c826090e44e/);
  assert.match(migration, /7771649ee17b055e5f90ad343a33abf6c950c90c293c575442ee3cb61d671c6e/);
  assert.match(migration, /v_trusted_v3 := public\.atomic_import_reviewed_catalogue_v3_plan_allowed\(p_plan\)/i);
  assert.match(migration, /not v_trusted_v3 and not public\.atomic_import_reviewed_parent_variant_allowed/i);
  assert.match(migration, /\)\) or p_plan#>>'\{approval,approved_category\}' is distinct from v_product_values->>'category'/i);
  assert.match(migration, /if v_trusted_v3 then[\s\S]+elsif v_retailer_actual->>'slug' = 'jon-s-supplements'/i);
  assert.match(migration, /8f938dc266a7f2d9f2e1cb8d6b4f2a82e5d8841ee72b64f8fc610edf6fa48e99/);
  assert.match(migration, /f1f5697a7ca6c3064b358e9296b98a1e411907a127b03248d14f9d75f90b4307/);
  assert.match(migration, /b6670a735282f9d04d0064ce2a3bdbbca055d1b99201a4db87fed2d50a25c734/);
  assert.doesNotMatch(migration, /gladiator|naughty boy|7555942383661|41805313015853/i);
  assert.doesNotMatch(migration, /create\s+(?:or\s+replace\s+)?function\s+public\.atomic_import_(?:reviewed_parent_variant_allowed|predators|10reps)/i);
  assert.doesNotMatch(migrationExecutable, /\b(?:insert\s+into|update|delete\s+from)\s+public\.(?:retailers|products|product_variants|retailer_products|offers|price_history|approved_import_plans)\b/i);
  assert.doesNotMatch(migrationExecutable, /\b(?:grant|revoke)\b/i);
  assert.match(rollback, /rollback blocked by live approval/i);
  assert.match(rollback, /47913d9e685b0b0804cac3349a7e8d037878834071a7ad4a69be0c826090e44e/);
  assert.match(rollback, /7771649ee17b055e5f90ad343a33abf6c950c90c293c575442ee3cb61d671c6e/);
  assert.doesNotMatch(rollbackExecutable, /\b(?:insert\s+into|update|delete\s+from)\s+public\.(?:retailers|products|product_variants|retailer_products|offers|price_history|approved_import_plans)\b/i);
  assert.doesNotMatch(rollbackExecutable, /\b(?:grant|revoke)\b/i);
});

test("trusted V3 reviewed-parent format parity reuses the existing trust boundary and stays fail-closed", () => {
  const migration = fs.readFileSync(path.join(__dirname, "../supabase/migrations/20261021120000_align_trusted_v3_reviewed_parent_format_policy.sql"), "utf8");
  const rollback = fs.readFileSync(path.join(__dirname, "../supabase/rollbacks/20261021120000_align_trusted_v3_reviewed_parent_format_policy_rollback.sql"), "utf8");
  const migrationExecutable = migration.replace(/\$patch\$[\s\S]*?\$patch\$/gi, "");
  const rollbackExecutable = rollback.replace(/\$patch\$[\s\S]*?\$patch\$/gi, "");

  assert.match(migration, /v_trusted_v3 := public\.atomic_import_reviewed_catalogue_v3_plan_allowed\(p_plan\)/i);
  assert.match(migration, /not v_trusted_v3 and v_product_values->>'product_format' not in \('powder','bar'\)/i);
  assert.match(migration, /0f2308eb0759cff2a4d97708a3bdfca24d50820483310117771f1bd3a2a3149a/);
  assert.match(migration, /80e9f09e1b9ad414689d0f42876bb8f169f528b4efad61d9713f3dad6850a942/);
  assert.match(migration, /c82e291550787e553fc906a669c348f0b7d6cd034bfb8bd326d7a9c646e7511a/);
  assert.match(migration, /c8370ee49d873f9cf8f6f375653848248b2cbe19f0e0b869f392e45405ae5daf/);
  assert.match(migration, /blocked by live approval/i);
  assert.match(rollback, /blocked by live approval/i);
  assert.match(rollback, /blocked by later durable approval evidence/i);
  assert.doesNotMatch(migration, /gladiator|3d energy|7555942383661|41805313015853/i);
  assert.doesNotMatch(migration, /create\s+(?:or\s+replace\s+)?function\s+public\.atomic_import_reviewed_catalogue_v3_plan_allowed/i);
  assert.doesNotMatch(migrationExecutable, /\b(?:insert\s+into|update|delete\s+from)\s+public\.(?:retailers|products|product_variants|retailer_products|offers|price_history|approved_import_plans)\b/i);
  assert.doesNotMatch(migrationExecutable, /\b(?:grant|revoke)\b/i);
  assert.doesNotMatch(rollbackExecutable, /\b(?:insert\s+into|update|delete\s+from)\s+public\.(?:retailers|products|product_variants|retailer_products|offers|price_history|approved_import_plans)\b/i);
  assert.doesNotMatch(rollbackExecutable, /\b(?:grant|revoke)\b/i);
});

test("trusted V3 plural flavour compatibility is validation-only, generic and bounded", () => {
  const migration = fs.readFileSync(path.join(__dirname, "../supabase/migrations/20261019130000_fix_reviewed_v3_plural_flavour_compatibility.sql"), "utf8");
  const rollback = fs.readFileSync(path.join(__dirname, "../supabase/rollbacks/20261019130000_fix_reviewed_v3_plural_flavour_compatibility_rollback.sql"), "utf8");
  const migrationExecutable = migration.replace(/\$patch\$[\s\S]*?\$patch\$/gi, "");
  const rollbackExecutable = rollback.replace(/\$patch\$[\s\S]*?\$patch\$/gi, "");

  assert.match(migration, /906cb5abad08deb8452fa9ae4fed8be8669b760e6f2ef088ae8846f5536b27db/);
  assert.match(migration, /3f25c76ae3407552f99e035d60f2629838ab878d5f127b20d29be02aa834fdfc/);
  assert.match(migration, /p_envelope#>'\{option_roles,flavour\}'/i);
  assert.match(migration, /not in \('flavour','flavor','flavours','flavors'\)/i);
  assert.match(migration, /v_flavour_alias_count<>1/i);
  assert.match(migration, /array\['Flavour'\][\s\S]+to_jsonb\(v_flavour->>'source_value'\)/i);
  assert.match(migration, /jsonb_set\(v_evidence,'\{external_options\}',v_validation_options,false\)/i);
  assert.match(migration, /p\.proowner=v_owner[\s\S]+p\.provolatile=v_volatility[\s\S]+p\.prosecdef=v_security_definer[\s\S]+p\.proconfig is not distinct from v_config[\s\S]+p\.proacl is not distinct from v_acl/i);
  assert.doesNotMatch(migration, /gladiator|twp|5298105778221|41306097385517|georgie/i);
  assert.doesNotMatch(migrationExecutable, /\b(?:insert\s+into|update|delete\s+from)\s+public\.(?:retailers|products|product_variants|retailer_products|offers|price_history|approved_import_plans)\b/i);
  assert.doesNotMatch(migrationExecutable, /\b(?:grant|revoke)\b/i);
  assert.match(rollback, /rollback blocked by live approval/i);
  assert.match(rollback, /906cb5abad08deb8452fa9ae4fed8be8669b760e6f2ef088ae8846f5536b27db/);
  assert.match(rollback, /3f25c76ae3407552f99e035d60f2629838ab878d5f127b20d29be02aa834fdfc/);
  assert.doesNotMatch(rollbackExecutable, /\b(?:insert\s+into|update|delete\s+from)\s+public\.(?:retailers|products|product_variants|retailer_products|offers|price_history|approved_import_plans)\b/i);
  assert.doesNotMatch(rollbackExecutable, /\b(?:grant|revoke)\b/i);
});

test("trusted V3 role-aware legacy size projection is shared, generic and fail-closed", () => {
  const migration = fs.readFileSync(path.join(__dirname, "../supabase/migrations/20261020180000_fix_reviewed_v3_role_aware_legacy_size_projection.sql"), "utf8");
  const rollback = fs.readFileSync(path.join(__dirname, "../supabase/rollbacks/20261020180000_fix_reviewed_v3_role_aware_legacy_size_projection_rollback.sql"), "utf8");
  const migrationExecutable = migration.replace(/\$patch\$[\s\S]*?\$patch\$/gi, "");
  const rollbackExecutable = rollback.replace(/\$patch\$[\s\S]*?\$patch\$/gi, "");

  assert.match(migration, /3f25c76ae3407552f99e035d60f2629838ab878d5f127b20d29be02aa834fdfc/);
  assert.match(migration, /f1f5697a7ca6c3064b358e9296b98a1e411907a127b03248d14f9d75f90b4307/);
  assert.match(migration, /48ce4f1bf0cb9c9d5dd75f2617b92482a19806bc272bd9ee95adab3518e5d92a/);
  assert.match(migration, /a5b8a05c0dc9cba672cbb4607c8d63660744165f88d2807e26d299159277b0f8/);
  assert.match(migration, /04392ff0eff0e814ba54e41d0b9af38478174eda6f427e7eefcc35d18c7b3e0c/);
  assert.match(migration, /atomic_import_reviewed_v3_legacy_validation_projection\(p_plan,p_envelope\)/i);
  assert.match(migration, /v_size_key_count>1[\s\S]+ambiguous size aliases/i);
  assert.match(migration, /v_physical_key is not null and v_count_key is null[\s\S]+v_validation_options-v_size_key/i);
  assert.match(migration, /jsonb_typeof\(p_plan#>'\{product_variant,evidence\}'\)='object'[\s\S]+perform public\.atomic_import_reviewed_v3_legacy_validation_projection/i);
  assert.match(migration, /blocked by live approval/i);
  assert.match(rollback, /blocked by later durable approval evidence/i);
  assert.match(rollback, /3f25c76ae3407552f99e035d60f2629838ab878d5f127b20d29be02aa834fdfc/);
  assert.match(rollback, /f1f5697a7ca6c3064b358e9296b98a1e411907a127b03248d14f9d75f90b4307/);
  assert.doesNotMatch(migration, /gladiator|kayow|twp|57418273358198|41779916898349/i);
  assert.doesNotMatch(migrationExecutable, /\b(?:insert\s+into|update|delete\s+from)\s+public\.(?:retailers|products|product_variants|retailer_products|offers|price_history|approved_import_plans)\b/i);
  assert.doesNotMatch(rollbackExecutable, /\b(?:insert\s+into|update|delete\s+from)\s+public\.(?:retailers|products|product_variants|retailer_products|offers|price_history|approved_import_plans)\b/i);
  assert.doesNotMatch(migration, /\bgrant\b/i);
});

test("existing workflows and scheduled retailer entry points do not opt into V3", () => {
  const workflowRoot = path.join(__dirname, "../.github/workflows");
  const workflowText = fs.readdirSync(workflowRoot)
    .filter(file => /\.ya?ml$/i.test(file))
    .map(file => fs.readFileSync(path.join(workflowRoot, file), "utf8"))
    .join("\n");
  assert.doesNotMatch(workflowText, /reviewed-catalogue-package-v3|reviewed_catalogue_v3/i);
  assert.equal(V2_VALIDATION_SQL, "select public.validate_product_import_plan_read_only($1::jsonb) result");
  assert.equal(APPROVAL_SQL, "select public.approve_reviewed_catalogue_import_plan($1::jsonb,$2,$3,$4,$5,now()+interval '15 minutes') result");
  assert.equal(PACKAGE_APPROVAL_SQL, APPROVAL_SQL);
});
