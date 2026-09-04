const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");

const migration = fs.readFileSync(path.join(__dirname, "../supabase/migrations/20260904100000_apply_reviewed_whey_okay_existing_variant_3.sql"), "utf8");
const rollback = fs.readFileSync(path.join(__dirname, "../supabase/rollbacks/20260904100000_apply_reviewed_whey_okay_existing_variant_3.sql"), "utf8");
const config = require("../config/retailers/whey-okay-offer-sync.json");
const manifest = require("../config/retailers/whey-okay-approved-offer-manifest.json");

test("reviewed Whey Okay remediation is exact, expiring and creates no catalogue rows", () => {
  assert.match(migration, /run 33838335548 \/ artifact 9924141590/);
  assert.match(migration, /2026-09-05T05:01:08\.003Z/);
  assert.match(migration, /supplementscout-production:aftboxmrdgyhizicfsfu/);
  assert.match(migration, /production catalogue baseline changed/);
  assert.doesNotMatch(migration, /insert into public\.(?:products|product_variants|retailer_products|offers)/i);
  assert.doesNotMatch(migration, /delete from public\.(?:products|product_variants|retailer_products|offers)/i);
  assert.match(migration, /values \(235,23\.72,3\.99,27\.71/);
});

test("the three reviewed mappings rebind only to existing non-default variants", () => {
  for (const [mapping, offer, product, before, after, sourceKey] of [
    [18,23,19,3,770,"65:66"],
    [171,162,158,149,747,"847:848"],
    [204,235,231,194,783,"1504:1504"],
  ]) {
    assert.match(migration, new RegExp(`\\(${mapping},${offer},${product},${before},${after},`));
    assert.match(rollback, new RegExp(`\\(${mapping},${offer},${product},${after},`));
    const row = manifest.rows.find((candidate) => candidate.source_key === sourceKey);
    assert.equal(row.environment_bindings.production.mapping_id, mapping);
    assert.equal(row.environment_bindings.production.offer_id, offer);
    assert.equal(row.environment_bindings.production.canonical_variant_id, after);
    assert.equal(row.canonical_target.is_default, false);
  }
  assert.match(migration, /target variant collision/);
});

test("the same Whey Okay automation expands to 589 while staging retains its frozen 586 scope", () => {
  assert.equal(config.approved_mapping_count, 589);
  assert.equal(config.legacy_mapping_count, 281);
  assert.equal(config.guardrails.required_matched_offers, 589);
  assert.equal(config.staging_scope.approved_mapping_count, 586);
  assert.equal(config.staging_scope.legacy_mapping_count, 284);
  assert.equal(manifest.approved_mapping_count, 589);
  assert.equal(manifest.legacy_mapping_count_excluded, 281);
  assert.equal(manifest.rows.length, 589);
  assert.match(migration, /exactly 589 approved Whey Okay mappings/);
  assert.match(migration, /v_approved_count <> 589 or v_legacy_count <> 281/);
});

test("reviewed Whey Okay rollback is bounded", () => {
  assert.match(rollback, /delete from public\.price_history/);
  assert.match(rollback, /product_variant_id=x\.old_variant_id/);
  assert.match(rollback, /external_product_id=null/);
  assert.doesNotMatch(rollback, /\b(?:drop|truncate)\b/i);
});
