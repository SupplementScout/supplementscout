const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");
const {
  OBSERVATION_KINDS,
  PRODUCER_CONTRACTS,
  buildIdentityFingerprintInput,
  estimateObservationVolume,
  identityFingerprint,
  validateObservationMoney,
} = require("./lib/price-observation-foundation");

function identity(overrides = {}) {
  return {
    offerId: "9007199254740993",
    retailerId: "7",
    retailerProductId: "9007199254740995",
    productId: "9007199254740997",
    productVariantId: "9007199254740999",
    externalProductId: "shop-100",
    externalVariantId: "variant-200",
    flavour: "Chocolate",
    sizeValue: "1000",
    sizeUnit: "g",
    packCount: "1",
    productFormat: "powder",
    unitCount: null,
    unitType: null,
    gtin: "05000000000001",
    retailerSource: "simply-supplements",
    ...overrides,
  };
}

test("identity fingerprint is deterministic, canonical and bigint-safe", () => {
  const first = identityFingerprint(identity());
  const reordered = identityFingerprint({
    productVariantId: "9007199254740999",
    offerId: 9007199254740993n,
    retailerProductId: 9007199254740995n,
    retailerId: 7n,
    productId: 9007199254740997n,
    externalVariantId: "variant-200",
    externalProductId: "shop-100",
    packCount: "1.0",
    sizeUnit: "g",
    sizeValue: "1000.0",
    flavour: "Chocolate",
    productFormat: "powder",
    gtin: "05000000000001",
    retailerSource: "simply-supplements",
  });
  assert.match(first, /^[0-9a-f]{64}$/);
  assert.equal(first, reordered);
  assert.equal(buildIdentityFingerprintInput(identity()).offer_id, "9007199254740993");
});

test("critical identity, variant and pack changes start a new series", () => {
  const baseline = identityFingerprint(identity());
  for (const changed of [
    { offerId: "9007199254741001" },
    { productVariantId: "9007199254741003" },
    { retailerProductId: "9007199254741005" },
    { externalVariantId: "variant-201" },
    { sizeValue: "908" },
    { sizeUnit: "ml" },
    { packCount: "2" },
    { unitCount: "12", unitType: "bar" },
  ]) assert.notEqual(identityFingerprint(identity(changed)), baseline);
});

test("money and currency evidence fail closed", () => {
  assert.deepEqual(validateObservationMoney({ price: "20.00", shippingCost: "3.99", totalPrice: "23.99" }), {
    price: "20", shippingCost: "3.99", totalPrice: "23.99", currency: "GBP",
  });
  assert.throws(() => validateObservationMoney({ price: "20", shippingCost: null, totalPrice: "20" }), /shippingCost/);
  assert.throws(() => validateObservationMoney({ price: "20", shippingCost: "0", totalPrice: "19.99" }), /delivered total/);
  assert.throws(() => validateObservationMoney({ price: "20", shippingCost: "0", totalPrice: "20", currency: "EUR" }), /GBP/);
  assert.throws(() => validateObservationMoney({ price: "NaN", shippingCost: "0", totalPrice: "20" }), /price/);
});

test("producer contracts are disabled by default and retain reviewed boundaries", () => {
  assert.deepEqual(OBSERVATION_KINDS, ["offer_created", "delivered_price_changed", "daily_confirmation"]);
  assert.equal(PRODUCER_CONTRACTS.every((contract) => contract.enabled === false), true);
  assert.equal(PRODUCER_CONTRACTS.every((contract) => contract.termsMode === "standard-single-purchase-only"), true);
  assert.equal(PRODUCER_CONTRACTS.find((contract) => contract.slug === "gym-high").publicUse, "owner-deferred");
  assert.equal(PRODUCER_CONTRACTS.find((contract) => contract.slug === "6-pack-supplements").technicallyCapable, false);
  assert.equal(PRODUCER_CONTRACTS.find((contract) => contract.slug === "ebay-uk").technicallyCapable, false);
  assert.equal(PRODUCER_CONTRACTS.find((contract) => contract.slug === "whey-okay").approvedScope, "approved-586-only");
});

test("GYM HIGH producer enablement is exact, production-only and rollback-safe", () => {
  const migration = fs.readFileSync(path.join(process.cwd(), "supabase/migrations/20260826090000_enable_gym_high_price_observation_producer.sql"), "utf8");
  const rollback = fs.readFileSync(path.join(process.cwd(), "supabase/rollbacks/20260826090000_enable_gym_high_price_observation_producer.sql"), "utf8");
  assert.match(migration, /owner-chat-2026-08-26-unlock-gym-high-producer/);
  assert.match(migration, /target_environment' <> 'PRODUCTION'/);
  assert.match(migration, /source_importer='gym-high-reviewed-full-catalogue-v1'/);
  assert.match(migration, /approved_scope='reviewed-66'/);
  assert.match(migration, /\) <> 40 then/);
  assert.match(migration, /set enabled=true,updated_at=clock_timestamp\(\)/);
  assert.match(migration, /public_use='owner-deferred'/);
  assert.doesNotMatch(migration, /update public\.(products|product_variants|retailer_products|offers|price_history)/i);
  assert.match(rollback, /set enabled=false,updated_at=clock_timestamp\(\)/);
  assert.doesNotMatch(rollback, /delete from public\.(price_history|price_identity_series)/i);
});

test("GYM HIGH exact-pack 9 reuses the guarded migration path and leaves 17 rows blocked", () => {
  const migration = fs.readFileSync(path.join(process.cwd(), "supabase/migrations/20260826100000_create_gym_high_exact_pack_9.sql"), "utf8");
  const rollback = fs.readFileSync(path.join(process.cwd(), "supabase/rollbacks/20260826100000_create_gym_high_exact_pack_9.sql"), "utf8");
  const evidence = JSON.parse(fs.readFileSync(path.join(process.cwd(), "docs/rollouts/gym-high-exact-pack-26-audit-2026-08-26.json"), "utf8"));
  const approved = [1, 535, 536, 540, 541, 542, 544, 551, 554];
  const blocked = [545, 546, 547, 548, 550, 552, 2500, 2501, 2502, 2503, 2504, 2505, 2506, 2507, 2508, 2509, 2510];
  assert.equal(evidence.summary.incomplete_offers, 26);
  assert.equal(evidence.summary.unique_canonical_variants, 26);
  assert.equal(evidence.summary.unique_products, 15);
  assert.deepEqual(evidence.approved_exact_pack.map((row) => row.offer_id), approved);
  assert.deepEqual(evidence.blocked.map((row) => row.offer_id), blocked);
  assert.match(migration, /owner-chat-2026-08-26-gym-high-exact-pack-9/);
  assert.match(migration, /v_exact_before <> 40/);
  assert.match(migration, /product_variants\)<>v_variants_before\+9/);
  assert.match(migration, /where rp\.retailer_id=1/);
  assert.match(migration, /where retailer_id=1\)<>66/);
  assert.match(migration, /price_identity_series where offer_id=e\.offer_id/);
  assert.match(migration, /to_jsonb\(rp\)-'product_variant_id'/);
  assert.match(migration, /to_jsonb\(o\)-'product_variant_id'/);
  assert.match(rollback, /version='20260826100000'/);
  assert.match(rollback, /price_identity_series where offer_id=e\.offer_id/);
  assert.doesNotMatch(migration, /record_price_observation|insert into public\.price_history/i);
  for (const offerId of blocked) {
    assert.doesNotMatch(migration, new RegExp(`\\"offer_id\\":${offerId}(?:,|})`));
  }
});

test("GYM HIGH Shred Mode owner decision creates one exact 60-serving identity", () => {
  const migration = fs.readFileSync(path.join(process.cwd(), "supabase/migrations/20260826110000_create_gym_high_shred_mode_exact_pack.sql"), "utf8");
  const rollback = fs.readFileSync(path.join(process.cwd(), "supabase/rollbacks/20260826110000_create_gym_high_shred_mode_exact_pack.sql"), "utf8");
  const decision = JSON.parse(fs.readFileSync(path.join(process.cwd(), "docs/rollouts/gym-high-shred-mode-owner-decision-2026-08-26.json"), "utf8"));
  assert.deepEqual(decision.decision, { pack_count: 1, size_value: 60, size_unit: "servings", capsules_per_serving: 1 });
  assert.match(migration, /owner-chat-2026-08-26-gym-high-shred-mode-60-servings/);
  assert.match(migration, /id=550/);
  assert.match(migration, /id=136/);
  assert.match(migration, /product_id=508/);
  assert.match(migration, /'60-servings','60 Servings',null,null,60,'servings',1/);
  assert.match(migration, /exact-pack baseline is not 49/);
  assert.match(migration, /is not null\)<>50/);
  assert.match(migration, /to_jsonb\(rp\)-'product_variant_id'/);
  assert.match(migration, /to_jsonb\(o\)-'product_variant_id'/);
  assert.match(rollback, /version='20260826110000'/);
  assert.match(rollback, /price_identity_series where offer_id=550/);
  assert.doesNotMatch(migration, /record_price_observation|insert into public\.price_history/i);
});

test("Fit House exact-pack batch 15 creates 12 variants, reuses 3 and excludes conflicts", () => {
  const migration = fs.readFileSync(path.join(process.cwd(), "supabase/migrations/20260826120000_create_fit_house_exact_pack_batch_15.sql"), "utf8");
  const rollback = fs.readFileSync(path.join(process.cwd(), "supabase/rollbacks/20260826120000_create_fit_house_exact_pack_batch_15.sql"), "utf8");
  const evidence = JSON.parse(fs.readFileSync(path.join(process.cwd(), "docs/rollouts/fit-house-exact-pack-batch-15-2026-08-26.json"), "utf8"));
  const approvedMappings = [689,690,701,708,736,748,749,800,801,858,860,865,866,947,2098];
  assert.equal(evidence.status, "PRODUCTION_APPLIED_VERIFIED");
  assert.equal(evidence.production_apply.result, "PASS");
  assert.equal(evidence.production_apply.ledger_count, 144);
  assert.equal(evidence.production_read_only_postflight.database_writes, 0);
  assert.equal(evidence.production_transaction_rollback_rehearsal.result, "PASS");
  assert.equal(evidence.expected.created_variants, 12);
  assert.equal(evidence.expected.existing_variant_rebinds, 3);
  assert.equal(evidence.expected.fit_house_exact_ready_after, 181);
  assert.deepEqual(evidence.rows.map(row => row.mapping_id), approvedMappings);
  assert.deepEqual(evidence.excluded_conflicts, [687,2063,2084,2099,2107,2123]);
  assert.match(migration, /owner-chat-2026-08-26-complete-fit-house-safe-batch-15/);
  assert.match(migration, /jsonb_array_length\(v_scope\)<>15/);
  assert.match(migration, /x->>'mode'='create'\)<>12/);
  assert.match(migration, /x->>'mode'='rebind'\)<>3/);
  assert.match(migration, /v_variants_before\+12/);
  assert.match(migration, /\)<>181/);
  assert.match(migration, /to_jsonb\(rp\)-'product_variant_id'/);
  assert.match(migration, /to_jsonb\(o\)-'product_variant_id'/);
  assert.match(rollback, /version='20260826120000'/);
  assert.match(rollback, /v_variants_before-12/);
  assert.doesNotMatch(migration, /record_price_observation|insert into public\.price_history/i);
  for (const mappingId of evidence.excluded_conflicts) {
    assert.doesNotMatch(migration, new RegExp(`\\"mapping_id\\":${mappingId}(?:,|})`));
  }
});

test("Fit House retailer-evidence batch 11 is explicit, guarded and keeps conflicts blocked", () => {
  const migration = fs.readFileSync(path.join(process.cwd(), "supabase/migrations/20260826130000_create_fit_house_retailer_evidence_exact_pack_11.sql"), "utf8");
  const rollback = fs.readFileSync(path.join(process.cwd(), "supabase/rollbacks/20260826130000_create_fit_house_retailer_evidence_exact_pack_11.sql"), "utf8");
  const evidence = JSON.parse(fs.readFileSync(path.join(process.cwd(), "docs/rollouts/fit-house-retailer-evidence-batch-11-2026-08-26.json"), "utf8"));
  const approvedMappings = [683,684,688,703,709,710,796,859,864,867,873];
  assert.equal(evidence.status, "PRODUCTION_APPLIED_VERIFIED");
  assert.equal(evidence.production_transaction_rollback_rehearsal.result, "PASS");
  assert.equal(evidence.production_transaction_rollback_rehearsal.database_writes_committed, 0);
  assert.equal(evidence.owner_review.approved, true);
  assert.equal(evidence.production_apply.ledger_count, 145);
  assert.equal(evidence.production_read_only_postflight.fit_house_exact_ready, 192);
  assert.equal(evidence.production_read_only_audit.database_writes, 0);
  assert.equal(evidence.evidence_contract.product_name_used_as_evidence, false);
  assert.equal(evidence.evidence_contract.base_product_values_copied, false);
  assert.equal(evidence.expected.created_variants, 11);
  assert.equal(evidence.expected.fit_house_exact_ready_after, 192);
  assert.deepEqual(evidence.rows.map((row) => row.mapping_id), approvedMappings);
  assert.deepEqual(evidence.excluded_conflicts, [686,687,2063,2084,2099,2107,2123]);
  assert.match(migration, /jsonb_array_length\(v_scope\)<>11/);
  assert.match(migration, /v_variants_before\+11/);
  assert.match(migration, /\)<>192/);
  assert.match(migration, /to_jsonb\(rp\)-'product_variant_id'/);
  assert.match(migration, /to_jsonb\(o\)-'product_variant_id'/);
  assert.match(rollback, /version='20260826130000'/);
  assert.match(rollback, /v_variants_before-11/);
  assert.doesNotMatch(migration, /record_price_observation|insert into public\.price_history/i);
  for (const mappingId of evidence.excluded_conflicts) {
    assert.doesNotMatch(migration, new RegExp(`\\"mapping_id\\":${mappingId}(?:,|})`));
  }
});

test("Fit House owner-reviewed retailer-evidence batch 27 is explicit, guarded and excludes unavailable products", () => {
  const migration = fs.readFileSync(path.join(process.cwd(), "supabase/migrations/20260826140000_create_fit_house_retailer_evidence_exact_pack_27.sql"), "utf8");
  const rollback = fs.readFileSync(path.join(process.cwd(), "supabase/rollbacks/20260826140000_create_fit_house_retailer_evidence_exact_pack_27.sql"), "utf8");
  const evidence = JSON.parse(fs.readFileSync(path.join(process.cwd(), "docs/rollouts/fit-house-retailer-evidence-batch-27-2026-08-26.json"), "utf8"));
  const approvedMappings = [682,685,702,704,705,706,707,711,712,735,740,742,744,745,746,750,789,793,794,795,798,855,856,861,862,863,868];
  assert.equal(evidence.status, "PRODUCTION_APPLIED_VERIFIED");
  assert.equal(evidence.owner_review.approved, true);
  assert.deepEqual(evidence.owner_review.unavailable_not_in_scope, [869,870,874]);
  assert.equal(evidence.production_transaction_rollback_rehearsal.database_writes_committed, 0);
  assert.equal(evidence.production_transaction_rollback_rehearsal.result, "PASS");
  assert.equal(evidence.production_apply.result, "PASS");
  assert.equal(evidence.production_read_only_postflight.fit_house_exact_ready, 219);
  assert.equal(evidence.evidence_contract.product_name_used_as_evidence, false);
  assert.equal(evidence.evidence_contract.base_product_values_copied, false);
  assert.equal(evidence.expected.created_variants, 27);
  assert.equal(evidence.expected.fit_house_exact_ready_after, 219);
  assert.deepEqual(evidence.rows.map((row) => row.mapping_id), approvedMappings);
  assert.match(migration, /jsonb_array_length\(v_scope\)<>27/);
  assert.match(migration, /v_variants_before\+27/);
  assert.match(migration, /\)<>219/);
  assert.match(migration, /to_jsonb\(rp\)-'product_variant_id'/);
  assert.match(migration, /to_jsonb\(o\)-'product_variant_id'/);
  assert.match(rollback, /version='20260826140000'/);
  assert.match(rollback, /v_variants_before-27/);
  assert.doesNotMatch(migration, /record_price_observation|insert into public\.price_history/i);
  for (const mappingId of [...evidence.excluded_conflicts, ...evidence.owner_review.unavailable_not_in_scope]) {
    assert.doesNotMatch(migration, new RegExp(`\\"mapping_id\\":${mappingId}(?:,|})`));
  }
});

test("Fit House owner-reviewed exact-pack 24 is guarded, reversible and keeps flavour conflicts blocked", () => {
  const migration = fs.readFileSync(path.join(process.cwd(), "supabase/migrations/20260826150000_create_fit_house_owner_reviewed_exact_pack_24.sql"), "utf8");
  const rollback = fs.readFileSync(path.join(process.cwd(), "supabase/rollbacks/20260826150000_create_fit_house_owner_reviewed_exact_pack_24.sql"), "utf8");
  const evidence = JSON.parse(fs.readFileSync(path.join(process.cwd(), "docs/rollouts/fit-house-owner-reviewed-exact-pack-24-2026-08-26.json"), "utf8"));
  const approvedMappings = [797,802,1124,2058,2062,2069,2075,2076,2083,2100,2101,2104,2114,2115,2118,2120,2121,2122,2125,2126,2131,2132,2152,2161];
  assert.equal(evidence.owner_review.approved, true);
  assert.equal(evidence.owner_review.pack_count_1_confirmed, true);
  assert.equal(evidence.expected.target_rows, 24);
  assert.equal(evidence.expected.created_variants, 22);
  assert.equal(evidence.expected.enriched_variants, 2);
  assert.equal(evidence.expected.fit_house_exact_ready_after, 243);
  assert.deepEqual(evidence.rows.map((row) => row[0]), approvedMappings);
  assert.deepEqual(evidence.excluded_identity_conflicts, [2095, 2096]);
  assert.match(migration, /jsonb_array_length\(v_scope\)<>24/);
  assert.match(migration, /v_variants_before\+22/);
  assert.match(migration, /\)<>243/);
  assert.match(migration, /e\.mode='enrich'/);
  assert.match(migration, /to_jsonb\(rp\)=v_mapping_before/);
  assert.match(rollback, /version='20260826150000'/);
  assert.match(rollback, /v_variants_before-22/);
  assert.doesNotMatch(migration, /record_price_observation|insert into public\.price_history/i);
  for (const mappingId of evidence.excluded_identity_conflicts) {
    assert.doesNotMatch(migration, new RegExp(`\\"mapping_id\\":${mappingId}(?:,|})`));
  }
});

test("daily volume estimates are bounded by one confirmation per offer", () => {
  assert.equal(estimateObservationVolume(2761, 30), 82_830);
  assert.equal(estimateObservationVolume(1564, 30), 46_920);
  assert.equal(estimateObservationVolume(1498, 365), 546_770);
  assert.equal(estimateObservationVolume(2761, 365), 1_007_765);
  assert.throws(() => estimateObservationVolume(1.5, 30), /integers/);
});
