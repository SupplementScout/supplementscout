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
const config = require(CONFIG_PATH);
const manifest = require(MANIFEST_PATH);
const refresh = require("./creatine-offer-refresh");

function sha256(file) {
  return crypto.createHash("sha256").update(fs.readFileSync(file)).digest("hex");
}

test("Discount refresh is frozen to the exact approved 14 mapping and offer identities", () => {
  assert.equal(config.retailer_id, 4);
  assert.equal(config.retailer_slug, "discount-supplements");
  assert.equal(config.approved_mapping_count, 14);
  assert.equal(manifest.rows.length, 14);
  assert.equal(sha256(MANIFEST_PATH), config.manifest_sha256);
  assert.equal(new Set(manifest.rows.map((row) => row.mapping_id)).size, 14);
  assert.equal(new Set(manifest.rows.map((row) => row.offer_id)).size, 14);
  assert.deepEqual(manifest.rows.map((row) => row.mapping_id), [
    "948", "949", "1020", "1047", "1048", "1049", "1050",
    "1080", "1081", "1082", "1083", "1084", "2722", "2723",
  ]);
  assert.deepEqual(manifest.rows.map((row) => row.offer_id), [
    "762", "763", "834", "861", "862", "863", "864",
    "894", "895", "896", "897", "898", "2537", "2538",
  ]);
});

test("Discount source and discovery guards fail closed", () => {
  assert.equal(config.discovery_policy.catalogue_creates, false);
  assert.equal(config.discovery_policy.missing_mapped_variant_mode, "BLOCK");
  assert.equal(config.discovery_policy.maximum_missing_mapped_variants, 0);
  assert.equal(config.guardrails.required_matched_offers, 14);
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

test("CLI accepts only explicit target, mode and isolation", () => {
  assert.deepEqual(refresh.parseArgs(["--target=production", "--mode=dry-run", "--isolate-unsafe=true"]), {
    target: "production", mode: "dry-run", isolateUnsafe: true,
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
});

test("legacy entry point is now a thin profile wrapper with no direct database writes", () => {
  const source = fs.readFileSync(path.join(__dirname, "creatine-offer-refresh.js"), "utf8");
  assert.match(source, /RETAILER_REFRESH_PROFILE = "discount-supplements"/);
  assert.match(source, /require\("\.\/fit-house-offer-refresh"\)/);
  assert.doesNotMatch(source, /\.from\(|\.update\(|\.insert\(|SUPABASE_SERVICE_ROLE_KEY/);
});

test("production migration freezes the manifest and exposes only validator registration", () => {
  const sql = fs.readFileSync(MIGRATION_PATH, "utf8");
  assert.match(sql, /validate_discount_supplements_confirmed_price_read_only/);
  assert.match(sql, /register_discount_supplements_offer_sync_control_plan/);
  assert.match(sql, /cf09dcd18094e03ac5c02d62a631588f644439e72b94486b1c0a6723e1d3e9c8/);
  assert.match(sql, /ce13e2a72d12024aac98005d5d40288bd5f109b6f2a63b4f30c9016d46e017a7/);
  assert.match(sql, /grant execute .*retailer_catalogue_production_validator/s);
  assert.match(sql, /revoke all .*public,anon,authenticated,service_role/s);
  assert.match(sql, /target_environment'<>'PRODUCTION/);
});
