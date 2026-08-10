const assert = require("node:assert/strict");
const crypto = require("node:crypto");
const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");
const config = require("../config/retailers/fit-house-offer-sync.json");
const { sha256 } = require("./lib/shopify-snapshot-reader");

const migrationPath = path.resolve("supabase/migrations/20260811010000_add_fit_house_stable_oos_validator.sql");
const rollbackPath = path.resolve("supabase/rollbacks/20260811010000_add_fit_house_stable_oos_validator.sql");
const migration = fs.readFileSync(migrationPath, "utf8");
const rollback = fs.readFileSync(rollbackPath, "utf8");
const POLICY = "6838770659dc772a3454846ad8e2e9e9620839b3ca688b118e9337231e520db6";

test("stable Fit House OOS policy fingerprint binds exact owner baseline without raising 35 percent", () => {
  const effective = { ...config.guardrails, required_matched_offers: config.approved_mapping_count, store_url: config.store_url };
  assert.equal(sha256({ config, effective_guardrails: effective }), POLICY);
  assert.deepEqual(config.approved_stable_oos_baseline, {
    retailer_id: 9, approved_mapping_count: 286, count: 103, maximum_new_oos_count: 3,
    require_total_oos_not_above_previous: true,
    authority: "owner-approved-chat-2026-08-10-all-three-fit-house-points-47-current-changes",
    reviewed_manifest_sha256: "168b5c604482280dc17842b93b9b27c24db42952b0873b14b0b326a6c10883f1",
  });
  assert.equal(config.guardrails.maximum_total_oos_ratio, 0.35);
});

test("production-only clone is exact to retailer 9, 286 rows, policy and global OOS 103", () => {
  for (const token of [POLICY, "target_environment}''<>''PRODUCTION", "retailer_id}''<>''9",
    "retailer_products where retailer_id=9)<>286", "offers where retailer_id=9)<>286",
    "offers where retailer_id=9 and not in_stock)>103", "Fit House stable OOS validator scope mismatch"])
    assert.ok(migration.includes(token), `missing ${token}`);
  assert.match(migration, /'retailer_offer_sync_validate_batch_read_only_unreviewed_interna',\s+'validate_fit_house_stable_oos_read_only'/);
  assert.match(migration, /validate_fit_house_stable_oos_read_only/);
  assert.match(migration, /v_total_anchor text:='or v_total_oos::numeric\/v_row_count>v_maximum_total_oos'/);
  assert.match(migration, /v_total_replacement text:='or v_total_oos>v_previous_oos'/);
});

test("63-byte PostgreSQL source identifier is exact and its definition hash must remain unchanged", () => {
  const sourceName = "retailer_offer_sync_validate_batch_read_only_unreviewed_interna";
  assert.equal(Buffer.byteLength(sourceName), 63);
  assert.match(migration, new RegExp(`${sourceName}\\(jsonb\\)'::regprocedure`));
  assert.match(migration, /v_source_sha_before<>'41f6add31de41778cf7d20b94f8c67647121815bbee1e50f8ef2f434f9eb19b8'/);
  assert.match(migration, /pg_get_functiondef\(v_source\)/);
  assert.match(migration, /<>v_source_sha_before then\s+raise exception 'Fit House stable OOS clone changed the shared source validator'/);
});

test("clone retains all ordinary per-child safety guards and other dispatch paths", () => {
  for (const guard of [
    "v_maximum_new_oos not between 0 and 3",
    "v_maximum_oos_increase not between 0 and 0.15",
    "v_maximum_changed not between 0 and 0.25",
    "v_mass_price_ratio<=0 or v_mass_price_ratio>0.20",
  ]) assert.match(migration, new RegExp(guard.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")));
  assert.match(migration, /reviewed_mixed_change_contract/);
  assert.doesNotMatch(migration, /maximum_total_oos_ratio["']\s*:\s*0\.36/);
  assert.doesNotMatch(migration, /(?:insert into|update|delete from) public\.(?:products|product_variants|retailer_products|offers|price_history)/i);
});

test("reviewed Fit requests stay on reviewed validation; only routine Fit uses stable clone", () => {
  const reviewed = "if p_request ? 'reviewed_mixed_change_contract' then";
  const routineFit = "if p_request#>>'{artifact,target_environment}'='PRODUCTION'";
  const reviewedIndex = migration.indexOf(reviewed, migration.indexOf("v_dispatch_replacement"));
  const routineIndex = migration.indexOf(routineFit, migration.indexOf("v_dispatch_replacement"));
  assert.ok(reviewedIndex >= 0 && routineIndex > reviewedIndex);
  assert.match(migration, /if p_request \? 'reviewed_mixed_change_contract' then\s+return public\.retailer_offer_sync_validate_reviewed_mixed_change_internal\(p_request\);\s+end if;\s+if p_request#>>'\{artifact,target_environment\}'='PRODUCTION'[\s\S]+return public\.validate_fit_house_stable_oos_read_only\(p_request\);/);
});

test("rollback restores exact dispatch and removes only the cloned validator", () => {
  assert.match(rollback, new RegExp(POLICY));
  assert.match(rollback, /drop function public\.validate_fit_house_stable_oos_read_only\(jsonb\)/);
  assert.match(rollback, /rollback anchor mismatch/);
  assert.doesNotMatch(rollback, /(?:insert into|update|delete from) public\.(?:products|product_variants|retailer_products|offers|price_history)/i);
});

test("rollback refuses active Fit House control state but permits completed evidence", () => {
  assert.match(rollback, /retailer_catalogue_parent_plans p[\s\S]+p\.retailer_id=9[\s\S]+p\.status in \('PLANNED','APPROVED','PARTIALLY_APPLIED','FAILED'\)/);
  assert.match(rollback, /retailer_catalogue_child_plans c[\s\S]+c\.retailer_id=9[\s\S]+c\.status in \('PLANNED','APPROVED','APPLYING','FAILED'\)/);
  assert.match(rollback, /retailer_offer_sync_batch_approvals a[\s\S]+join public\.retailer_catalogue_child_plans c on c\.id=a\.child_plan_id[\s\S]+a\.consumed_at is null/);
  assert.match(rollback, /retailer_catalogue_apply_runs r[\s\S]+join public\.retailer_catalogue_child_plans c on c\.id=r\.child_plan_id[\s\S]+r\.status='STARTED'/);
  assert.match(rollback, /rollback blocked by active control state/);
  assert.doesNotMatch(rollback, /p\.status in \([^)]*'COMPLETED'/);
  assert.doesNotMatch(rollback, /c\.status in \([^)]*'APPLIED'/);
});

test("migration and rollback hashes are frozen by tests", () => {
  assert.equal(crypto.createHash("sha256").update(fs.readFileSync(migrationPath)).digest("hex"),
    "770c216405db745cbffd9260006910bdab9708664859fe22cfac56e3e0ef2169");
  assert.equal(crypto.createHash("sha256").update(fs.readFileSync(rollbackPath)).digest("hex"),
    "0ec54b3ab0819eb15539dd819fa1f853e6495db3cc70bb49c5b021f371af8b6f");
});
