const assert = require("node:assert/strict");
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
