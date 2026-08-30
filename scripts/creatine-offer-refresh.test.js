const assert = require("node:assert/strict");
const crypto = require("node:crypto");
const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");

const ROOT = path.resolve(__dirname, "..");
const CONFIG_PATH = path.join(ROOT, "config", "retailers", "discount-supplements-offer-sync.json");
const MANIFEST_PATH = path.join(ROOT, "config", "retailers", "discount-supplements-approved-offer-manifest.json");
const WORKFLOW_PATH = path.join(ROOT, ".github", "workflows", "creatine-offer-refresh.yml");
const MIGRATION_PATH = path.join(ROOT, "supabase", "migrations", "20260820110000_add_discount_supplements_isolated_confirmed_price_refresh.sql");
const EXTENSION_PATH = path.join(ROOT, "supabase", "migrations", "20260830120000_expand_discount_supplements_freshness_scope_109.sql");
const config = require(CONFIG_PATH);
const manifest = require(MANIFEST_PATH);
const ownerPack = require("../docs/rollouts/automation-reliability-owner-pack-2026-08-30.json");
const refresh = require("./creatine-offer-refresh");
const { buildVerifiedNoChangePlan } = require("./verified-no-change-offer-refresh");
const { PROFILES: POSTFLIGHT_PROFILES, baselineHash, epoch, verifyPostflight } = require("./retailer-offer-refresh-postflight");

function sha256(file) {
  return crypto.createHash("sha256").update(fs.readFileSync(file, "utf8").replaceAll("\r\n", "\n")).digest("hex");
}

test("Discount refresh combines the unchanged exact 14 scope with the owner-approved 95 without overlap", () => {
  assert.equal(config.retailer_id, 4);
  assert.equal(config.retailer_slug, "discount-supplements");
  assert.equal(config.approved_mapping_count, 109);
  assert.equal(POSTFLIGHT_PROFILES["discount-supplements"].approvedMappingCount, 109);
  assert.equal(manifest.rows.length, 109);
  assert.equal(sha256(MANIFEST_PATH), config.manifest_sha256);
  assert.equal(manifest.authority.owner_pack_sha256, "419c758d55affd2e2bd2a0730a953a25a750c4f62fb53c14a6da3089ee8f1737");
  assert.equal(new Set(manifest.rows.map((row) => row.mapping_id)).size, 109);
  assert.equal(new Set(manifest.rows.map((row) => row.offer_id)).size, 109);
  assert.deepEqual(manifest.scope_segments.existing_14, [
    "762", "763", "834", "861", "862", "863", "864",
    "894", "895", "896", "897", "898", "2537", "2538",
  ]);
  const oldMappings = manifest.rows.filter((row) => manifest.scope_segments.existing_14.includes(row.offer_id)).map((row) => row.mapping_id);
  assert.deepEqual(oldMappings, [
    "948", "949", "1020", "1047", "1048", "1049", "1050",
    "1080", "1081", "1082", "1083", "1084", "2722", "2723",
  ]);
  const approved95 = ownerPack.scopes.discount_stale.rows.filter((row) => row.classification === "NO_CHANGE").map((row) => String(row.offer_id)).sort((a, b) => Number(a) - Number(b));
  assert.equal(approved95.length, 95);
  assert.deepEqual(manifest.scope_segments.group_a_freshness_95, approved95);
  assert.equal(manifest.scope_segments.existing_14.filter((id) => approved95.includes(id)).length, 0);
  assert.equal(new Set([...manifest.scope_segments.existing_14, ...approved95]).size, 109);
  const excluded = ownerPack.scopes.discount_stale.rows.filter((row) => row.classification !== "NO_CHANGE").map((row) => String(row.offer_id));
  assert.equal(excluded.length, 47);
  assert.equal(excluded.some((id) => manifest.rows.some((row) => row.offer_id === id)), false);
});

function verificationRecord(row, index) {
  const capturedAt = "2026-08-30T12:30:00.000Z";
  const price = Number(row.offer.price).toFixed(2);
  const shipping = Number(row.offer.shipping_cost).toFixed(2);
  return {
    source_snapshot_sha256: "a".repeat(64), source_captured_at: capturedAt,
    source: { external_product_id: String(row.external_product_id), external_variant_id: String(row.external_variant_id), price, in_stock: row.offer.in_stock, url: row.retailer_url, external_url: row.retailer_url },
    target: {
      product: { id: String(row.current_product.id), name: row.current_product.name, is_active: true, merged_into_product_id: null, product_format: null },
      retailer: { id: "4", name: "Discount Supplements", slug: "discount-supplements", website: config.store_url },
      product_variant: { id: String(row.current_variant.id), product_id: String(row.current_product.id), variant_key: `approved-${index}`, display_name: row.current_variant.name, flavour_code: null, flavour_label: null, size_value: null, size_unit: null, pack_count: null, product_format: null, is_active: true, is_default: row.current_variant.name === "Default" },
      retailer_product: { id: String(row.mapping_id), retailer_id: "4", product_id: String(row.current_product.id), product_variant_id: String(row.current_variant.id), external_product_id: String(row.external_product_id), external_variant_id: String(row.external_variant_id), external_sku: null, external_options: null, external_name: row.full_name, external_slug: null, external_gtin: row.gtin, external_url: row.retailer_url, match_method: "slug", match_confidence: "90" },
      offer: { id: String(row.offer_id), product_id: String(row.current_product.id), retailer_id: "4", product_variant_id: String(row.current_variant.id), retailer_product_id: String(row.mapping_id), price, shipping_cost: shipping, total_price: row.offer.total_price == null ? null : Number(row.offer.total_price).toFixed(2), in_stock: row.offer.in_stock, url: row.retailer_url, last_checked_at: row.offer.last_checked_at },
    },
  };
}

test("all 95 owner-approved additions build only timestamp-changing VERIFY_NO_CHANGE plans", () => {
  const rows = ownerPack.scopes.discount_stale.rows.filter((row) => row.classification === "NO_CHANGE");
  const plans = rows.map((row, index) => buildVerifiedNoChangePlan(verificationRecord(row, index), { targetEnvironment: "PRODUCTION", targetProjectRef: "aftboxmrdgyhizicfsfu", sourceSnapshotSha256s: new Set(["a".repeat(64)]), now: new Date("2026-08-30T12:30:00.000Z") }).plan);
  assert.equal(plans.length, 95);
  for (const plan of plans) {
    assert.equal(plan.meta.operation_type, "verify_offer_no_change");
    assert.equal(plan.offer.action, "verify_no_change");
    assert.equal(plan.price_history.action, "noop");
    assert.equal(plan.retailer_product.action, "noop");
    assert.equal(plan.product.action, "existing");
    assert.equal(plan.product_variant.action, "existing");
    for (const field of ["price", "shipping_cost", "total_price", "in_stock", "url"]) assert.deepEqual(plan.offer.values[field], plan.expected_state.offer[field]);
    assert.notEqual(Date.parse(plan.offer.values.last_checked_at), Date.parse(plan.expected_state.offer.last_checked_at));
  }
});

test("Discount segment report proves 95 executable confirmations and isolates one-row drift to review", () => {
  const ids = manifest.scope_segments.group_a_freshness_95;
  const rows = ids.map((offer_id) => ({ offer_id, action: "VERIFY_NO_CHANGE" }));
  const pass = refresh.scopeSegmentSummary(manifest, { rows, quarantined_rows: [] }, [{ rows }]);
  assert.deepEqual(pass.group_a_freshness_95, { approved_mapping_count: 95, executable_plan_count: 95, executed_plan_count: 0, review_row_count: 0, blocked_row_count: 0, classification: { VERIFY_NO_CHANGE: 95 } });
  const isolated = refresh.scopeSegmentSummary(manifest, { rows: rows.slice(1), quarantined_rows: [{ offer_id: ids[0], reason: "HARD_PRICE_ANOMALY" }] }, [{ rows: rows.slice(1) }]);
  assert.equal(isolated.group_a_freshness_95.executable_plan_count, 94);
  assert.equal(isolated.group_a_freshness_95.review_row_count, 1);
  assert.equal(isolated.group_a_freshness_95.classification.VERIFY_NO_CHANGE, 94);
});

test("approved execution segment selects exactly the 95 owner-approved rows and never the existing 14", () => {
  const rows = manifest.rows.map((row) => ({ offer_id: row.offer_id, action: "VERIFY_NO_CHANGE" }));
  const selected = refresh.selectApprovedScopeSegment(rows, { rows, quarantined_rows: [] }, manifest, "group_a_freshness_95");
  assert.equal(selected.length, 95);
  assert.deepEqual(selected.map((row) => row.offer_id).sort((a, b) => Number(a) - Number(b)), manifest.scope_segments.group_a_freshness_95);
  assert.equal(selected.some((row) => manifest.scope_segments.existing_14.includes(row.offer_id)), false);
  assert.throws(() => refresh.selectApprovedScopeSegment(rows, { rows, quarantined_rows: [] }, manifest, "missing"), /unknown approved scope segment/);
});

test("postflight requires freshness only for the explicitly executed segment", () => {
  const row = (offer_id, last_checked_at) => ({ mapping_id: offer_id, retailer_id: "4", mapping_product_id: "1", mapping_variant_id: offer_id, external_product_id: offer_id, external_variant_id: offer_id, external_sku: null, external_gtin: null, external_options: null, external_url: `https://example.test/${offer_id}`, offer_id, offer_product_id: "1", offer_variant_id: offer_id, price: "10.00", shipping_cost: "4.99", total_price: "14.99", in_stock: true, url: `https://example.test/${offer_id}`, last_checked_at });
  const baseline = { schema_version: 1, kind: "retailer-offer-refresh-db-baseline", result: "PASS", profile: "discount-supplements", snapshot: { row_count: 2, price_history_count: 0, rows: [row("1", "2026-08-29T00:00:00Z"), row("2", "2026-08-29T00:00:00Z")] } };
  baseline.evidence_hash = baselineHash(baseline);
  const execution = { result: "PASS", approved_mapping_count: 2, executable_plan_count: 1, executed_plan_count: 1, execution_offer_ids: ["2"], review_row_count: 0, blocked_row_count: 0, review_rows: [], expected_deltas: { row_count_deltas: { price_history: 0 }, logical_field_deltas: { last_checked_at_updates: 1 } } };
  const report = verifyPostflight(baseline, { row_count: 2, price_history_count: 0, rows: [row("1", "2026-08-29T00:00:00Z"), row("2", "2026-08-30T00:00:00Z")] }, execution);
  assert.equal(report.freshness_change_count, 1);
  assert.throws(() => verifyPostflight(baseline, { row_count: 2, price_history_count: 0, rows: [row("1", "2026-08-30T00:00:00Z"), row("2", "2026-08-30T00:00:00Z")] }, execution), /Non-executed offer 1 changed/);
});

test("postflight compares PostgreSQL Date values without dropping milliseconds", () => {
  const iso = "2026-08-30T12:14:39.744Z";
  assert.equal(epoch(iso), epoch(new Date(iso)));
});

test("Discount source and discovery guards fail closed", () => {
  assert.equal(config.discovery_policy.catalogue_creates, false);
  assert.equal(config.discovery_policy.missing_mapped_variant_mode, "BLOCK");
  assert.equal(config.discovery_policy.maximum_missing_mapped_variants, 0);
  assert.equal(config.guardrails.required_matched_offers, 109);
  assert.equal(config.shipping_policy.cost_gbp, "4.99");
  const healthy = refresh.sourceHealth(
    { products: Array.from({ length: 341 }, () => ({ variants: [{}, {}, {}] })), source_diagnostic: { pagination_completed: true } },
    Array.from({ length: 993 }, () => ({})),
  );
  assert.equal(healthy.result, "PASS");
  const collapsed = refresh.sourceHealth(
    { products: Array.from({ length: 100 }, () => ({ variants: [{}] })), source_diagnostic: { pagination_completed: true } },
    Array.from({ length: 100 }, () => ({})),
  );
  assert.equal(collapsed.result, "BLOCK");
  assert.equal(collapsed.code, "GENUINE_SOURCE_COLLAPSE");
});

test("CLI accepts only explicit target, mode, isolation and an approved scope segment selector", () => {
  assert.deepEqual(refresh.parseArgs(["--target=production", "--mode=dry-run", "--isolate-unsafe=true", "--scope-segment=group_a_freshness_95"]), {
    target: "production", mode: "dry-run", isolateUnsafe: true, scopeSegment: "group_a_freshness_95",
  });
  assert.throws(() => refresh.parseArgs(["--mode=apply"]), /required --target/);
  assert.throws(() => refresh.parseArgs(["--target=production", "--mode=apply", "--unsafe=true"]), /invalid argument/);
});

test("workflow uses isolated role-separated execution and never invokes the legacy direct-write CLI", () => {
  const workflow = fs.readFileSync(WORKFLOW_PATH, "utf8");
  assert.match(workflow, /cron: "47 6 \* \* \*"/);
  assert.equal((workflow.match(/--isolate-unsafe=true/g) || []).length, 3);
  assert.match(workflow, /DISCOUNT_SUPPLEMENTS_REFRESH_VALIDATOR_DATABASE_URL/);
  assert.match(workflow, /DISCOUNT_SUPPLEMENTS_REFRESH_APPROVER_DATABASE_URL/);
  assert.match(workflow, /DISCOUNT_SUPPLEMENTS_REFRESH_EXECUTOR_DATABASE_URL/);
  assert.doesNotMatch(workflow, /SUPABASE_SERVICE_ROLE_KEY/);
  assert.doesNotMatch(workflow, /creatine-offer-refresh\.js --(?:dry-run|apply)(?:\s|$)/);
  assert.equal(config.approved_mapping_count, 109);
  assert.match(workflow, /scope_segment:/);
  assert.match(workflow, /group_a_freshness_95/);
  assert.match(workflow, /node scripts\/creatine-offer-refresh\.js --target=production --mode=apply --isolate-unsafe=true \$SCOPE_ARG/);
});

test("legacy entry point is now a thin profile wrapper with no direct database writes", () => {
  const source = fs.readFileSync(path.join(__dirname, "creatine-offer-refresh.js"), "utf8");
  const engineSource = fs.readFileSync(path.join(__dirname, "fit-house-offer-refresh.js"), "utf8");
  assert.match(source, /RETAILER_REFRESH_PROFILE = "discount-supplements"/);
  assert.match(source, /require\("\.\/fit-house-offer-refresh"\)/);
  assert.doesNotMatch(source, /\.from\(|\.update\(|\.insert\(|SUPABASE_SERVICE_ROLE_KEY/);
  assert.match(engineSource, /roleCredential\(target,"validator"\)/);
  assert.match(engineSource, /default_transaction_read_only=on/);
  assert.match(engineSource, /set role retailer_catalogue_\$\{target\}_validator/);
  assert.doesNotMatch(engineSource, /target==="staging"&&!process\.env\.GITHUB_ACTIONS/);
});

test("production migration freezes the manifest and exposes only validator registration", () => {
  const sql = fs.readFileSync(MIGRATION_PATH, "utf8");
  const extension = fs.readFileSync(EXTENSION_PATH, "utf8");
  assert.match(sql, /validate_discount_supplements_confirmed_price_read_only/);
  assert.match(sql, /register_discount_supplements_offer_sync_control_plan/);
  assert.match(sql, /cf09dcd18094e03ac5c02d62a631588f644439e72b94486b1c0a6723e1d3e9c8/);
  assert.match(sql, /ce13e2a72d12024aac98005d5d40288bd5f109b6f2a63b4f30c9016d46e017a7/);
  assert.match(sql, /grant execute .*retailer_catalogue_production_validator/s);
  assert.match(sql, /revoke all .*public,anon,authenticated,service_role/s);
  assert.match(sql, /target_environment'<>'PRODUCTION/);
  assert.match(extension, /e8eb51a75a31fa41b5cc9eab009a87ee5fe3491ddc130c0caafd621f2fd843e2/);
  assert.match(extension, /308ab2f082abaf1c541210917b168b2ce6bc69ffd78026bf8d18c9801f898746/);
  assert.match(extension, /jsonb_array_length\(v_manifest\) <> 109/);
  assert.match(extension, /exactly 109 approved/);
  assert.doesNotMatch(extension, /(?:insert into|update|delete from)\s+public\.(?:products|product_variants|retailer_products|offers|price_history)/i);
});
