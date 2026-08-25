const assert = require("node:assert/strict");
const crypto = require("node:crypto");
const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");

const ROOT = path.resolve(__dirname, "..");
const migration = fs.readFileSync(
  path.join(ROOT, "supabase/migrations/20260810240000_create_reviewed_jons_17_explicit_variants.sql"),
  "utf8",
);
const rollback = fs.readFileSync(
  path.join(ROOT, "supabase/rollbacks/20260810240000_create_reviewed_jons_17_explicit_variants.sql"),
  "utf8",
);
const canaryMigration = fs.readFileSync(
  path.join(ROOT, "supabase/migrations/20260825163000_create_jons_exact_pack_canary_5.sql"),
  "utf8",
);
const canaryRollback = fs.readFileSync(
  path.join(ROOT, "supabase/rollbacks/20260825163000_create_jons_exact_pack_canary_5.sql"),
  "utf8",
);
const canaryEvidencePath = path.join(
  ROOT,
  "docs/rollouts/jons-exact-pack-review/canary-5-evidence.json",
);
const canaryEvidenceText = fs.readFileSync(canaryEvidencePath, "utf8");
const canaryEvidence = JSON.parse(canaryEvidenceText);

const expected = [
  [835, 1182, 1296, 1110, "53818329792850", "APX14001", "vanilla-2000g", "Vanilla / 2000g", 2000, "g"],
  [836, 1183, 1297, 1111, "52499552797010", "EFEC-0206", "biscuit-spread-1800g", "Biscuit Spread / 1800g", 1800, "g"],
  [837, 1184, 1298, 1112, "52499565314386", "MTJ14006", "chocolate-peanut-butter-1800g", "Chocolate Peanut Butter / 1800g", 1800, "g"],
  [839, 1186, 1300, 1114, "53185997013330", "GMK02001", "cherry-bubblegum-25servings", "Cherry Bubblegum / 25servings", 25, "servings"],
  [840, 1187, 1301, 1115, "53828561338706", null, "blue-slush-420g", "Blue Slush / 420g", 420, "g"],
  [842, 1189, 1303, 1117, "52577121206610", "CTH29002", "peach-30servings", "Peach / 30servings", 30, "servings"],
  [843, 1190, 1304, 1118, "52718620082514", "PFM22005", "double-chocolate-1800g", "Double Chocolate / 1800g", 1800, "g"],
  [844, 1191, 1305, 1119, "52637042049362", "PFM29002", "blueberry-muffin-16servings", "Blueberry Muffin / 16servings", 16, "servings"],
  [845, 1192, 1306, 1120, "52846399193426", "INP23001", "bahama-mama-460g", "Bahama Mama / 460g", 460, "g"],
  [846, 1193, 1307, 1121, "53897264202066", "PFGREEN004", "apple-mango-150g", "Apple Mango / 150g", 150, "g"],
  [847, 1194, 1308, 1122, "53185770324306", "PML07004", "anaconda-apple-480g", "Anaconda Apple / 480g", 480, "g"],
  [848, 1195, 1309, 1123, "53185595179346", "PGE01003", "blue-raz-380g", "Blue Raz / 380g", 380, "g"],
  [849, 1254, 1368, 1182, "51000175067474", "EFEC-0705", "black-cherry-300g", "Black Cherry / 300g", 300, "g"],
  [853, 1258, 1372, 1186, "52156907585874", "EFEC-0830", "cherry-breeze-440g", "Cherry Breeze / 440g", 440, "g"],
  [854, 1259, 1373, 1187, "52158735384914", "EFEC-0951", "peach-rings-375g", "Peach Rings / 375g", 375, "g"],
  [858, 1263, 1377, 1191, "51000857723218", "CNP60002", "biscoff-spread-2000g", "Biscoff Spread / 2000g", 2000, "g"],
  [861, 1266, 1380, 1194, "50825886171474", "TBJ02018", "apple-pie-2000g", "Apple Pie / 2000g", 2000, "g"],
];

const expectedCanary = [
  [795, 1142, 1256, 1070, "51056074981714", "CNP37001", "30-servings", "30 Servings", 30],
  [797, 1144, 1258, 1072, "53897141911890", "PFGUTH001", "30-servings", "30 Servings", 30],
  [798, 1145, 1259, 1073, "53896643969362", "PFMAGCAP00", "60-servings", "60 Servings", 60],
  [801, 1148, 1262, 1076, "53896878227794", "PFLIVERS001", "30-servings", "30 Servings", 30],
  [802, 1149, 1263, 1077, "53897083978066", "PFJOINT001", "30-servings", "30 Servings", 30],
];


test("migration is bound to the exact reviewed 17-row identity scope", () => {
  assert.match(migration, /owner-approved-chat-2026-08-10-jons-17-explicit-variants/);
  assert.match(migration, /cf2b4bf75deecedaae626a323895a3012c99140d2d939b8823915b62af9a1aa3/);
  assert.match(migration, /jsonb_array_length\(v_scope\)<>17/);
  assert.match(migration, /count\(distinct \(x->>'product_id'\)::bigint\)/);
  assert.match(migration, /count\(distinct x->>'external_variant_id'\)/);
  for (const [product, defaultVariant, mapping, offer, externalVariant, sku, key, display, size, unit] of expected) {
    assert.match(migration, new RegExp(`"product_id":${product}.*?"default_variant_id":${defaultVariant}.*?"mapping_id":${mapping}.*?"offer_id":${offer}.*?"external_variant_id":"${externalVariant}"`, "s"));
    assert.match(migration, new RegExp(`"external_sku":${sku === null ? "null" : `"${sku}"`}.*?"variant_key":"${key}".*?"display_name":"${display.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}".*?"size_value":${size},"size_unit":"${unit}"`, "s"));
  }
});

test("migration creates variants and moves identity only", () => {
  assert.match(migration, /insert into public\.product_variants/);
  assert.match(migration, /returning id into v_new_id/);
  assert.match(migration, /update public\.retailer_products set product_variant_id=v_new_id,[\s\S]*external_options=[\s\S]*updated_at=now\(\)/);
  assert.match(migration, /update public\.offers set product_variant_id=v_new_id/);
  assert.doesNotMatch(migration, /update public\.product_variants/);
  assert.doesNotMatch(migration, /insert into public\.(products|retailer_products|offers|price_history)/);
  assert.doesNotMatch(migration, /update public\.offers set[\s\S]{0,180}\b(price|shipping_cost|total_price|in_stock|url|last_checked_at)\s*=/);
  assert.match(migration, /product_variants\)<>v_variants_before\+17/);
  assert.match(migration, /price_history\)<>v_history_count_before/);
  assert.match(migration, /to_jsonb\(o\)-'product_variant_id'/);
  assert.match(migration, /v_history_before/);
  assert.match(migration, /retailer_id=10\)<>506/);
});

test("rollback restores the defaults only before any later refresh", () => {
  assert.match(rollback, /jsonb_array_length\(v_scope\)<>17/);
  assert.match(rollback, /20260810240000.*create_reviewed_jons_17_explicit_variants/s);
  assert.match(rollback, /display_name=e\.display_name[\s\S]*flavour_code=e\.flavour_code[\s\S]*nutrition_override='\{\}'::jsonb/);
  assert.match(rollback, /external_product_id=e\.external_product_id[\s\S]*external_variant_id=e\.external_variant_id[\s\S]*external_options=jsonb_build_object/);
  assert.match(rollback, /price=e\.price[\s\S]*shipping_cost=e\.shipping[\s\S]*total_price=e\.total[\s\S]*in_stock[\s\S]*url=e\.url/);
  assert.match(rollback, /updated_at=v_new_created_at/);
  assert.match(rollback, /last_checked_at=e\.last_checked_at/);
  assert.match(rollback, /update public\.retailer_products set product_variant_id=e\.default_variant_id/);
  assert.match(rollback, /external_options='\{\}'::jsonb,updated_at=e\.mapping_updated_at/);
  assert.match(rollback, /update public\.offers set product_variant_id=e\.default_variant_id/);
  assert.match(rollback, /delete from public\.product_variants where id=v_new_id/);
  assert.match(rollback, /product_variants\)<>v_variants_before-17/);
  assert.match(rollback, /price_history\)<>v_history_count_before/);
  assert.match(rollback, /v_history_before/);
  assert.match(rollback, /retailer_id=10\)<>506/);
  assert.doesNotMatch(rollback, /delete from public\.(products|retailer_products|offers|price_history)/);
  assert.doesNotMatch(rollback, /update public\.offers set[\s\S]{0,180}\b(price|shipping_cost|total_price|in_stock|url|last_checked_at)\s*=/);
});

test("exact-pack canary is bound to the five owner-reviewed retailer identities and evidence", () => {
  const evidenceHash = crypto
    .createHash("sha256")
    .update(canaryEvidenceText.replaceAll("\r\n", "\n"))
    .digest("hex");
  assert.equal(evidenceHash, "e50a96fca517b8297594799ac74bbf9fffe18a37797a60a90f560b992394dbe1");
  assert.equal(canaryEvidence.status, "OWNER_REVIEWED_NOT_AUTHORIZED_FOR_PRODUCTION_APPLY");
  assert.equal(canaryEvidence.row_count, 5);
  assert.match(canaryMigration, /owner-chat-2026-08-25-jons-exact-pack-canary-5/);
  assert.match(canaryMigration, new RegExp(evidenceHash));
  assert.match(canaryMigration, new RegExp(canaryEvidence.selected_semantic_sha256));
  assert.match(canaryMigration, /jsonb_array_length\(v_scope\) <> 5/);
  for (const [product, defaultVariant, mapping, offer, externalVariant, sku, key, display, size] of expectedCanary) {
    assert.match(canaryMigration, new RegExp(
      `"product_id":${product}.*?"default_variant_id":${defaultVariant}.*?"mapping_id":${mapping}.*?"offer_id":${offer}.*?"external_variant_id":"${externalVariant}"`,
      "s",
    ));
    assert.match(canaryMigration, new RegExp(
      `"external_sku":"${sku}".*?"variant_key":"${key}".*?"display_name":"${display}".*?"size_value":${size},"size_unit":"servings"`,
      "s",
    ));
  }
});

test("exact-pack canary creates explicit non-default variants and preserves commercial rows", () => {
  assert.match(canaryMigration, /insert into public\.product_variants/);
  assert.match(canaryMigration, /e\.size_value, e\.size_unit, 1, 'capsule'/);
  assert.match(canaryMigration, /'\{\}'::jsonb, false, true/);
  assert.match(canaryMigration, /update public\.retailer_products\s+set product_variant_id=v_new_id/);
  assert.match(canaryMigration, /update public\.offers\s+set product_variant_id=v_new_id/);
  assert.match(canaryMigration, /to_jsonb\(rp\)-'product_variant_id'/);
  assert.match(canaryMigration, /to_jsonb\(o\)-'product_variant_id'/);
  assert.match(canaryMigration, /product_variants\)<>v_variants_before\+5/);
  assert.match(canaryMigration, /price_identity_series\)<>v_series_before/);
  assert.doesNotMatch(canaryMigration, /update public\.product_variants/);
  assert.doesNotMatch(canaryMigration, /insert into public\.(products|retailer_products|offers|price_history|price_identity_series)/);
  assert.doesNotMatch(canaryMigration, /delete from public\./);
  assert.doesNotMatch(canaryMigration, /set\s+(price|shipping_cost|total_price|in_stock|url|last_checked_at|updated_at)\s*=/);
});

test("exact-pack canary rollback fails closed after producer use and restores only its bindings", () => {
  assert.match(canaryRollback, /20260825163000.*create_jons_exact_pack_canary_5/s);
  assert.match(canaryRollback, /updated_at<=v_new_created_at/);
  assert.match(canaryRollback, /last_checked_at<=v_new_created_at/);
  assert.match(canaryRollback, /price_identity_series where product_variant_id=v_new_id/);
  assert.match(canaryRollback, /update public\.retailer_products\s+set product_variant_id=e\.default_variant_id/);
  assert.match(canaryRollback, /update public\.offers\s+set product_variant_id=e\.default_variant_id/);
  assert.match(canaryRollback, /delete from public\.product_variants where id=v_new_id/);
  assert.match(canaryRollback, /product_variants\)<>v_variants_before-5/);
  assert.doesNotMatch(canaryRollback, /delete from public\.(products|retailer_products|offers|price_history|price_identity_series)/);
  assert.doesNotMatch(canaryRollback, /set\s+(price|shipping_cost|total_price|in_stock|url|last_checked_at|updated_at)\s*=/);
});
