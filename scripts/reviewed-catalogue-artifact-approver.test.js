const assert = require("node:assert/strict");
const crypto = require("node:crypto");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const test = require("node:test");
const { loadReviewedPackage, loadReviewedPackageScope, normalizedManifestSha, planFingerprint, sha256 } = require("./lib/reviewed-catalogue-package");
const { APPROVAL_SQL, CREDENTIAL_PATH, approveWithClient, parseArgs, parseCredential } = require("./reviewed-catalogue-artifact-approver");
const {
  APPLY_SQL: PACKAGE_APPLY_SQL,
  APPROVAL_SQL: PACKAGE_APPROVAL_SQL,
  CREDENTIAL: PACKAGE_CREDENTIAL,
  apply: applyPackage,
  expectedDelta,
  parseArgs: parsePackageArgs,
  parseCredential: parsePackageCredential,
  roleTransaction,
  verifyTarget,
} = require("./reviewed-catalogue-package-executor");

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
  assert.deepEqual(parseArgs(["--manifest=config/retailers/a.json", `--manifest-sha256=${"a".repeat(64)}`, "--profile=batch-1", `--plan-fingerprint=${"b".repeat(32)}`]), { manifestPath: "config/retailers/a.json", manifestSha256: "a".repeat(64), profileId: "batch-1", planFingerprint: "b".repeat(32) });
  assert.throws(() => parseArgs(["--profile=batch-1"]), /required/);
});

test("credential is direct PostgreSQL approver-only", () => {
  assert.equal(CREDENTIAL_PATH, path.join(process.env.USERPROFILE || "", ".supplementscout/credentials/production-approver.env"));
  const direct = `REVIEWED_CATALOGUE_DATABASE_URL=postgresql://${encodeURIComponent("supplementscout_production_approver_login.aftboxmrdgyhizicfsfu")}:secret@aws-0-eu-west-2.pooler.supabase.com:5432/postgres?sslmode=require`;
  assert.match(parseCredential(direct), /^postgresql:/);
  assert.throws(() => parseCredential("SUPABASE_SERVICE_ROLE_KEY=secret"), /exactly one database URL/);
});

test("approval transaction uses only the approver role and approval RPC", async () => {
  const value = fixture();
  const prepared = load(value); prepared.manifestSha256 = value.manifestSha256;
  const queries = [];
  const client = { async connect() {}, async end() {}, async query(sql, params) { queries.push({ sql, params }); if (sql === "select current_user,session_user") return { rows: [{ current_user: "retailer_catalogue_production_approver", session_user: "supplementscout_production_approver_login" }] }; if (sql === APPROVAL_SQL) return { rows: [{ result: { approval_id: "123e4567-e89b-42d3-a456-426614174000", status: "approved", artifact_sha256: prepared.profile.artifact_sha256, run_id: prepared.artifact.run_id, plan_fingerprint: prepared.entry.plan_fingerprint, source_row_fingerprint: prepared.entry.source_row_fingerprint, retailer_id: "14", plan_kind: "feed", expires_at: new Date(Date.now() + 10 * 60_000).toISOString() } }] }; return { rows: [] }; } };
  const result = await approveWithClient(prepared, client);
  assert.equal(result.approval_only, true);
  assert.deepEqual(queries.map(query => query.sql), ["begin", "select set_config('app.retailer_catalogue_production_marker','1',true),set_config('app.retailer_catalogue_allow','1',true)", "SET LOCAL ROLE retailer_catalogue_production_approver", "select current_user,session_user", APPROVAL_SQL, "commit"]);
  const source = fs.readFileSync(path.join(__dirname, "reviewed-catalogue-artifact-approver.js"), "utf8");
  assert.doesNotMatch(source, /apply_approved_product_import_plan|pilot-apply|service_role|\.from\(|\b(insert into|update (products|product_variants|retailer_products|offers|price_history)|delete from)\b/i);
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

test("package executor CLI binds one complete manifest profile and explicit mode", () => {
  assert.deepEqual(parsePackageArgs([
    "--mode=apply",
    "--manifest=config/retailers/example.json",
    `--manifest-sha256=${"a".repeat(64)}`,
    "--profile=batch-1",
    "--output=tmp/retailer-feeds/example/result.json",
  ]), {
    mode: "apply", manifestPath: "config/retailers/example.json", manifestSha256: "a".repeat(64),
    profileId: "batch-1", outputPath: "tmp/retailer-feeds/example/result.json",
  });
  assert.throws(() => parsePackageArgs(["--mode=apply"]), /required/);
  assert.throws(() => parsePackageArgs([
    "--mode=bulk", "--manifest=config/retailers/example.json", `--manifest-sha256=${"a".repeat(64)}`,
    "--profile=batch-1", "--output=tmp/retailer-feeds/example/result.json",
  ]), /preflight or apply/);
});

test("package executor requires three distinct protected direct PostgreSQL credentials", () => {
  for (const kind of ["approver", "executor", "validator"]) {
    assert.equal(PACKAGE_CREDENTIAL[kind], path.join(process.env.USERPROFILE || "", `.supplementscout/credentials/production-${kind}.env`));
    const login = `supplementscout_production_${kind}_login.aftboxmrdgyhizicfsfu`;
    assert.match(parsePackageCredential(kind, `CATALOGUE_DATABASE_URL=postgresql://${login}:secret@aws-0-eu-west-2.pooler.supabase.com:5432/postgres?sslmode=require`), /^postgresql:/);
  }
  assert.throws(() => parsePackageCredential("executor", "SUPABASE_SERVICE_ROLE_KEY=secret"), /one database URL/);
});

test("package role transactions set the exact role, commit success and roll back errors", async () => {
  const queries = [];
  const client = { async query(sql) {
    queries.push(sql);
    if (sql.startsWith("select current_user")) return { rows: [{ current_user: "retailer_catalogue_production_executor", session_user: "supplementscout_production_executor_login", transaction_read_only: "off" }] };
    return { rows: [] };
  } };
  assert.equal(await roleTransaction(client, "executor", async () => "done"), "done");
  assert.deepEqual(queries, ["begin", "select set_config('app.retailer_catalogue_production_marker','1',true),set_config('app.retailer_catalogue_allow','1',true)", "set local role retailer_catalogue_production_executor", "select current_user,session_user,current_setting('transaction_read_only') transaction_read_only", "commit"]);
  queries.length = 0;
  await assert.rejects(() => roleTransaction(client, "executor", async () => { throw new Error("stop"); }), /stop/);
  assert.equal(queries.at(-1), "rollback");
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
    if (sql.startsWith("select current_user")) return { rows: [{ current_user: "retailer_catalogue_production_executor", session_user: "supplementscout_production_executor_login", transaction_read_only: "off" }] };
    if (sql === PACKAGE_APPLY_SQL) return { rows: [{ result: baseResult }] };
    return { rows: [] };
  } };
  assert.deepEqual(await applyPackage(client, prepared, receipt), baseResult);
  assert.equal(queries.at(-1), "commit");
  queries.length = 0;
  const replayClient = { ...client, async query(sql) {
    queries.push(sql);
    if (sql.startsWith("select current_user")) return { rows: [{ current_user: "retailer_catalogue_production_executor", session_user: "supplementscout_production_executor_login", transaction_read_only: "off" }] };
    if (sql === PACKAGE_APPLY_SQL) return { rows: [{ result: { ...baseResult, already_applied: true } }] };
    return { rows: [] };
  } };
  await assert.rejects(() => applyPackage(replayClient, prepared, receipt), /receipt invalid/);
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
  assert.throws(() => verifyTarget(entry, { product: { ...product, name: "Changed" }, variant, mapping, offer, history }), /existing product mismatch/);
  assert.throws(() => verifyTarget(entry, { product, variant, mapping, offer: { ...offer, shipping_cost: "4.99" }, history }), /price mismatch/);
});

test("package executor uses only approval/apply RPCs and contains no direct business DML or service role", () => {
  const source = fs.readFileSync(path.join(__dirname, "reviewed-catalogue-package-executor.js"), "utf8");
  assert.match(PACKAGE_APPROVAL_SQL, /approve_reviewed_catalogue_import_plan/);
  assert.match(PACKAGE_APPLY_SQL, /apply_approved_product_import_plan/);
  assert.doesNotMatch(source, /SUPABASE_SERVICE_ROLE_KEY|service_role|createClient|\.from\(|postgrest/i);
  assert.doesNotMatch(source, /\b(?:insert\s+into|update|delete\s+from)\s+(?:public\.)?(?:retailers|products|product_variants|retailer_products|offers|price_history)\b/i);
  assert.doesNotMatch(source, /spawnSync|forEach\([^)]*approve|Promise\.all\([^)]*apply/i);
});
