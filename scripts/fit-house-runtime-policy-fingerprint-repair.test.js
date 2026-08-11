const assert = require("node:assert/strict");
const crypto = require("node:crypto");
const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");
const { sha256 } = require("./lib/shopify-snapshot-reader");

const configPath = path.resolve("config/retailers/fit-house-offer-sync.json");
const rawConfig = JSON.parse(fs.readFileSync(configPath, "utf8"));
const engine = require("./fit-house-offer-refresh");
const migrationPath = path.resolve("supabase/migrations/20260811020000_repair_fit_house_runtime_policy_fingerprint.sql");
const rollbackPath = path.resolve("supabase/rollbacks/20260811020000_repair_fit_house_runtime_policy_fingerprint.sql");
const migration = fs.readFileSync(migrationPath, "utf8");
const rollback = fs.readFileSync(rollbackPath, "utf8");
const OLD = "6838770659dc772a3454846ad8e2e9e9620839b3ca688b118e9337231e520db6";
const RUNTIME = "d72ab8f4b44cdc799d7743544b346eb73ae4e335d3b40b596d597a1165d21abf";

test("runtime fingerprint is calculated only after shared profile defaults", () => {
  const rawPolicy = { ...rawConfig.guardrails, required_matched_offers: rawConfig.approved_mapping_count, store_url: rawConfig.store_url };
  assert.equal(sha256({ config: rawConfig, effective_guardrails: rawPolicy }), OLD);
  assert.equal(rawConfig.output_directory, undefined);
  assert.equal(engine.runtimePolicyFingerprint(), RUNTIME);
  assert.deepEqual(engine.effectiveOfferPolicy(), {
    ...rawConfig.guardrails,
    required_matched_offers: 286,
    store_url: "https://fithouse.uk",
  });
});

test("forward repair changes only exact installed Fit clone and dispatcher fingerprints", () => {
  for (const token of [
    OLD, RUNTIME,
    "6eb5e7dac346ec21660537f57d6105b95205a8fcf224e5fcb250a2d0e26b1a2f",
    "0ae5fe76ad6bbed34f8fbf65a7df9c436710f101af83fb04a5992b4ce8301b15",
    "fc698a59b88e293322bad5dd5726d9530a7a3c64345f11008478d830b9a44d71",
    "9fdd5fa3256f4a64a127c02a575f01b777e97119321efab044eb9300fab27de6",
    "41f6add31de41778cf7d20b94f8c67647121815bbee1e50f8ef2f434f9eb19b8",
  ]) assert.ok(migration.includes(token), `missing ${token}`);
  assert.match(migration, /execute replace\(v_fit_definition,v_old,v_new\)/);
  assert.match(migration, /execute replace\(v_dispatch_definition,v_old,v_new\)/);
  assert.doesNotMatch(migration, /execute replace\([^\n]*v_source/);
  assert.doesNotMatch(migration, /(?:insert into|update|delete from) public\.(?:products|product_variants|retailer_products|offers|price_history)/i);
});

test("repair preserves reviewed order and every stable safety limit", () => {
  assert.match(migration, /position\('reviewed_mixed_change_contract' in v_dispatch_definition\)>=position\('validate_fit_house_stable_oos_read_only' in v_dispatch_definition\)/);
  for (const guard of [
    "retailer_id=9 and not in_stock)>103",
    "or v_total_oos>v_previous_oos",
    "v_maximum_new_oos not between 0 and 3",
    "v_maximum_oos_increase not between 0 and 0.15",
    "v_maximum_changed not between 0 and 0.25",
    "v_mass_price_ratio<=0 or v_mass_price_ratio>0.20",
  ]) assert.ok(migration.includes(guard), `missing ${guard}`);
  assert.doesNotMatch(migration, /maximum_total_oos_ratio["']\s*:\s*0\.36/);
});

test("rollback is exact and blocks active Fit House control state", () => {
  assert.match(rollback, /execute replace\(v_fit_definition,v_new,v_old\)/);
  assert.match(rollback, /execute replace\(v_dispatch_definition,v_new,v_old\)/);
  assert.match(rollback, /p\.status in \('PLANNED','APPROVED','PARTIALLY_APPLIED','FAILED'\)/);
  assert.match(rollback, /c\.status in \('PLANNED','APPROVED','APPLYING','FAILED'\)/);
  assert.match(rollback, /a\.consumed_at is null/);
  assert.match(rollback, /r\.status='STARTED'/);
  assert.doesNotMatch(rollback, /(?:insert into|update|delete from) public\.(?:products|product_variants|retailer_products|offers|price_history)/i);
});

test("repair migration and rollback bytes are frozen", () => {
  assert.equal(crypto.createHash("sha256").update(fs.readFileSync(migrationPath)).digest("hex"),
    "64e76dcedbbbaa4e05823ed2e5c62cf7e58c63f13915dddfa9a48e082395cbab");
  assert.equal(crypto.createHash("sha256").update(fs.readFileSync(rollbackPath)).digest("hex"),
    "57761048781b3e388f9da819105f8543d4707c219ffaaf9ab16adac034796fd3");
});
