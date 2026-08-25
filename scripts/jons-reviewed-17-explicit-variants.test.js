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
const readyServingsMigration = fs.readFileSync(
  path.join(ROOT, "supabase/migrations/20260825170000_create_jons_exact_pack_ready_servings_10.sql"),
  "utf8",
);
const readyServingsRollback = fs.readFileSync(
  path.join(ROOT, "supabase/rollbacks/20260825170000_create_jons_exact_pack_ready_servings_10.sql"),
  "utf8",
);
const readyServings2Migration = fs.readFileSync(
  path.join(ROOT, "supabase/migrations/20260825200000_create_jons_exact_pack_ready_servings_2.sql"),
  "utf8",
);
const readyServings2Rollback = fs.readFileSync(
  path.join(ROOT, "supabase/rollbacks/20260825200000_create_jons_exact_pack_ready_servings_2.sql"),
  "utf8",
);
const readyGrams4Migration = fs.readFileSync(
  path.join(ROOT, "supabase/migrations/20260825201000_create_jons_exact_pack_ready_grams_4.sql"),
  "utf8",
);
const readyGrams4Rollback = fs.readFileSync(
  path.join(ROOT, "supabase/rollbacks/20260825201000_create_jons_exact_pack_ready_grams_4.sql"),
  "utf8",
);
const canaryEvidencePath = path.join(
  ROOT,
  "docs/rollouts/jons-exact-pack-review/canary-5-evidence.json",
);
const canaryEvidenceText = fs.readFileSync(canaryEvidencePath, "utf8");
const canaryEvidence = JSON.parse(canaryEvidenceText);
const ordinaryManifestText = fs.readFileSync(
  path.join(ROOT, "docs/rollouts/jons-exact-pack-review/approved-ordinary-51-manifest.json"),
  "utf8",
);
const ordinaryManifest = JSON.parse(ordinaryManifestText);
const all88Decisions = JSON.parse(fs.readFileSync(
  path.join(ROOT, "docs/rollouts/jons-exact-pack-review/all-88-decisions.json"),
  "utf8",
));
const ordinaryMigrationSpecs = [
  ["20260825210000_create_jons_exact_pack_ordinary_servings_a_10", 10, 439],
  ["20260825211000_create_jons_exact_pack_ordinary_servings_b_10", 10, 449],
  ["20260825212000_create_jons_exact_pack_ordinary_servings_c_10", 10, 459],
  ["20260825213000_create_jons_exact_pack_ordinary_servings_d_9", 9, 469],
  ["20260825214000_create_jons_exact_pack_ordinary_grams_a_10", 10, 478],
  ["20260825215000_create_jons_exact_pack_ordinary_grams_b_1", 1, 488],
].map(([identifier, count, baseline]) => ({
  identifier,
  count,
  baseline,
  migration: fs.readFileSync(path.join(ROOT, `supabase/migrations/${identifier}.sql`), "utf8"),
  rollback: fs.readFileSync(path.join(ROOT, `supabase/rollbacks/${identifier}.sql`), "utf8"),
}));
const ordinaryRebindIdentifier = "20260825220000_rebind_jons_existing_exact_pack_1";
const ordinaryRebindMigration = fs.readFileSync(
  path.join(ROOT, `supabase/migrations/${ordinaryRebindIdentifier}.sql`),
  "utf8",
);
const ordinaryRebindRollback = fs.readFileSync(
  path.join(ROOT, `supabase/rollbacks/${ordinaryRebindIdentifier}.sql`),
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

const expectedCanary = [
  [795, 1142, 1256, 1070, "51056074981714", "CNP37001", "30-servings", "30 Servings", 30],
  [797, 1144, 1258, 1072, "53897141911890", "PFGUTH001", "30-servings", "30 Servings", 30],
  [798, 1145, 1259, 1073, "53896643969362", "PFMAGCAP00", "60-servings", "60 Servings", 60],
  [801, 1148, 1262, 1076, "53896878227794", "PFLIVERS001", "30-servings", "30 Servings", 30],
  [802, 1149, 1263, 1077, "53897083978066", "PFJOINT001", "30-servings", "30 Servings", 30],
];

const expectedReadyServings = [
  [792, 1139, 1253, 1067, "51000436326738", "STM45001", 80],
  [803, 1150, 1264, 1078, "53092453548370", "PFM49001", 60],
  [804, 1151, 1265, 1079, "53896125317458", "PFNNMN001", 30],
  [805, 1152, 1266, 1080, "53896547369298", "PFVITC002", 60],
  [806, 1153, 1267, 1081, "53896170176850", "PFNZMA001", 60],
  [814, 1161, 1275, 1089, "50926983577938", "TBJ23001", 60],
  [830, 1177, 1291, 1105, "50944967508306", "STM18001", 30],
  [891, 1469, 1583, 1397, "53185879605586", "CTH05001", 30],
  [906, 1507, 1621, 1435, "52669571334482", "STM53001", 90],
  [923, 1527, 1641, 1455, "52718578401618", null, 60],
];

const expectedReadyServings2 = [
  [933, 1542, 1656, 1470, "51038128111954", "T4JP", 30],
  [941, 1556, 1670, 1484, "50844992602450", "TBJ20001", 30],
];

const expectedReadyGrams4 = [
  [852, 1257, 1371, 1185, "53633148485970", null, 500],
  [909, 1511, 1625, 1439, "50844919955794", "STM41001", 500],
  [918, 1522, 1636, 1450, "50579649921362", "CNP31001", 250],
  [940, 1555, 1669, 1483, "52458456252754", "TBJ62001", 500],
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

test("ready servings batch is bound to ten reviewed identities and the post-canary gate", () => {
  assert.match(readyServingsMigration, /55db2b2cd77e919821cb1f224f5d793035385b2db7e1c9f98727e9f65e4b53e3/);
  assert.match(readyServingsMigration, /631febae59f3d2516066d3be627ddc176c6de62d5e9245c05904e80f5819fab6/);
  assert.match(readyServingsMigration, /jsonb_array_length\(v_scope\) <> 10/);
  assert.match(readyServingsMigration, /offer_id in \(1070,1072,1073,1076,1077\)/);
  assert.match(readyServingsMigration, /exact-pack baseline is %, expected 423/);
  for (const [product, defaultVariant, mapping, offer, externalVariant, sku, size] of expectedReadyServings) {
    assert.match(readyServingsMigration, new RegExp(
      `"product_id":${product}.*?"default_variant_id":${defaultVariant}.*?"mapping_id":${mapping}.*?"offer_id":${offer}.*?"external_variant_id":"${externalVariant}"`,
      "s",
    ));
    assert.match(readyServingsMigration, new RegExp(
      `"external_sku":${sku === null ? "null" : `"${sku}"`}.*?"size_value":${size},"size_unit":"servings"`,
      "s",
    ));
  }
});

test("ready servings batch creates variants only and preserves commercial state", () => {
  assert.match(readyServingsMigration, /insert into public\.product_variants/);
  assert.match(readyServingsMigration, /product_variants\)<>v_variants_before\+10/);
  assert.match(readyServingsMigration, /price_history\)<>v_history_before/);
  assert.match(readyServingsMigration, /price_identity_series\)<>v_series_before/);
  assert.doesNotMatch(readyServingsMigration, /insert into public\.(products|retailer_products|offers|price_history|price_identity_series)/);
  assert.doesNotMatch(readyServingsMigration, /update public\.product_variants/);
});

test("ready servings rollback is ledger-bound and fails closed after producer use", () => {
  assert.match(readyServingsRollback, /20260825170000.*create_jons_exact_pack_ready_servings_10/s);
  assert.match(readyServingsRollback, /price_identity_series where product_variant_id=v_new_id/);
  assert.match(readyServingsRollback, /product_variants\)<>v_variants_before-10/);
  assert.doesNotMatch(readyServingsRollback, /delete from public\.(products|retailer_products|offers|price_history|price_identity_series)/);
});

test("remaining evidence-ready batches bind all six owner-approved identities", () => {
  assert.match(readyServings2Migration, /jsonb_array_length\(v_scope\) <> 2/);
  assert.match(readyServings2Migration, /exact-pack baseline is %, expected 433/);
  assert.match(readyGrams4Migration, /jsonb_array_length\(v_scope\) <> 4/);
  assert.match(readyGrams4Migration, /exact-pack baseline is %, expected 435/);
  for (const [product, defaultVariant, mapping, offer, externalVariant, sku, size] of expectedReadyServings2) {
    assert.match(readyServings2Migration, new RegExp(
      `"product_id":${product}.*?"default_variant_id":${defaultVariant}.*?"mapping_id":${mapping}.*?"offer_id":${offer}.*?"external_variant_id":"${externalVariant}"`,
      "s",
    ));
    assert.match(readyServings2Migration, new RegExp(
      `"external_sku":"${sku}".*?"size_value":${size},"size_unit":"servings"`,
      "s",
    ));
  }
  for (const [product, defaultVariant, mapping, offer, externalVariant, sku, size] of expectedReadyGrams4) {
    assert.match(readyGrams4Migration, new RegExp(
      `"product_id":${product}.*?"default_variant_id":${defaultVariant}.*?"mapping_id":${mapping}.*?"offer_id":${offer}.*?"external_variant_id":"${externalVariant}"`,
      "s",
    ));
    assert.match(readyGrams4Migration, new RegExp(
      `"external_sku":${sku === null ? "null" : `"${sku}"`}.*?"size_value":${size},"size_unit":"g"`,
      "s",
    ));
  }
});

test("remaining evidence-ready batches preserve catalogue and commercial state", () => {
  for (const [forward, rollbackSql, delta, version, name] of [
    [readyServings2Migration, readyServings2Rollback, 2, "20260825200000", "create_jons_exact_pack_ready_servings_2"],
    [readyGrams4Migration, readyGrams4Rollback, 4, "20260825201000", "create_jons_exact_pack_ready_grams_4"],
  ]) {
    assert.match(forward, new RegExp(`product_variants\\)<>v_variants_before\\+${delta}`));
    assert.match(forward, /price_history\)<>v_history_before/);
    assert.match(forward, /price_identity_series\)<>v_series_before/);
    assert.doesNotMatch(forward, /insert into public\.(products|retailer_products|offers|price_history|price_identity_series)/);
    assert.doesNotMatch(forward, /update public\.product_variants/);
    assert.match(rollbackSql, new RegExp(`version='${version}'.*?name='${name}'`, "s"));
    assert.match(rollbackSql, /price_identity_series where product_variant_id=v_new_id/);
    assert.match(rollbackSql, new RegExp(`product_variants\\)<>v_variants_before-${delta}`));
    assert.doesNotMatch(rollbackSql, /delete from public\.(products|retailer_products|offers|price_history|price_identity_series)/);
  }
});

test("ordinary 51 manifest is exactly the remaining owner-approved scope without special gates", () => {
  assert.equal(
    crypto.createHash("sha256").update(ordinaryManifestText.replaceAll("\r\n", "\n")).digest("hex"),
    "1ed188258ed4face02c7f9771d05fa732ab18abe7971a161ba8778fa284861f4",
  );
  assert.equal(ordinaryManifest.status, "OWNER_AUTHORIZED_FOR_BOUNDED_REHEARSAL_AND_APPLY");
  assert.equal(ordinaryManifest.row_count, 51);
  assert.equal(ordinaryManifest.create_variant_count, 50);
  assert.equal(ordinaryManifest.rebind_existing_count, 1);
  assert.equal(ordinaryManifest.safety.special_gate_rows_excluded, 15);
  assert.equal(ordinaryManifest.safety.deferred_rows_excluded, 1);
  const decisions = new Map(all88Decisions.rows.map((row) => [row.offer_id, row]));
  for (const row of ordinaryManifest.rows) {
    const decision = decisions.get(String(row.offer_id));
    assert.equal(decision.decision, "APPROVE_CANDIDATE");
    assert.equal(decision.evidence_gate, undefined);
    assert.deepEqual(
      { pack_count: row.pack_count, size_value: row.size_value, size_unit: row.size_unit },
      decision.candidate,
    );
    assert.equal(row.source_variant_id, row.external_variant_id);
  }
  assert.equal(new Set(ordinaryManifest.rows.map(({ offer_id }) => offer_id)).size, 51);
});

test("ordinary create batches remain bounded, sequential and variant-only", () => {
  for (const { identifier, count, baseline, migration: sql, rollback: undo } of ordinaryMigrationSpecs) {
    assert.match(sql, new RegExp(`jsonb_array_length\\(v_scope\\) <> ${count}`));
    assert.match(sql, new RegExp(`exact-pack baseline is %, expected ${baseline}`));
    assert.match(sql, new RegExp(`product_variants\\)<>v_variants_before\\+${count}`));
    assert.match(sql, /price_identity_series where retailer_id=10\) <> 439/);
    assert.match(sql, /e\.pack_count,null,null,null,'\{\}'::jsonb,false,true/);
    assert.match(sql, /to_jsonb\(rp\)-'product_variant_id'/);
    assert.match(sql, /to_jsonb\(o\)-'product_variant_id'/);
    assert.doesNotMatch(sql, /update public\.product_variants/);
    assert.doesNotMatch(sql, /insert into public\.(products|retailer_products|offers|price_history|price_identity_series)/);
    assert.match(undo, new RegExp(`version='${identifier.slice(0,14)}'.*?name='${identifier.slice(15)}'`, "s"));
    assert.match(undo, /exists\(select 1 from public\.price_identity_series where offer_id=e\.offer_id\)/);
    assert.match(undo, new RegExp(`product_variants\\)<>v_variants_before-${count}`));
  }
});

test("ordinary existing exact-pack rebind changes only Jon's bindings", () => {
  assert.match(ordinaryRebindMigration, /target_variant_id bigint/);
  assert.match(ordinaryRebindMigration, /v_exact_before<>489/);
  assert.match(ordinaryRebindMigration, /product_variants\)<>v_variants_before/);
  assert.match(ordinaryRebindMigration, /set product_variant_id=e\.target_variant_id/);
  assert.doesNotMatch(ordinaryRebindMigration, /insert into public\./);
  assert.doesNotMatch(ordinaryRebindMigration, /update public\.product_variants/);
  assert.match(ordinaryRebindRollback, /exists\(select 1 from public\.price_identity_series where offer_id=e\.offer_id\)/);
  assert.match(ordinaryRebindRollback, /set product_variant_id=e\.default_variant_id/);
  assert.doesNotMatch(ordinaryRebindRollback, /delete from public\./);
});
