const assert = require("node:assert/strict");
const crypto = require("node:crypto");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const test = require("node:test");
const {
  isExactOwnerBoundAuditedMissingReview,
  loadAuditedMissingVariantManifest,
  parseArgs,
  requireAuditedMissingOwnerApproval,
} = require("./fit-house-offer-refresh");
const { loadReviewedFitHouse47, MANIFEST, MANIFEST_SHA256 } = require("./fit-house-reviewed-47-apply");
const { loadReviewedMixedChangeManifest } = require("./lib/retailer-offer-sync/reviewed-mixed-change");

const migration = fs.readFileSync(path.resolve("supabase/migrations/20260811000000_authorize_reviewed_fit_house_47_changes.sql"), "utf8");
const rollback = fs.readFileSync(path.resolve("supabase/rollbacks/20260811000000_authorize_reviewed_fit_house_47_changes.sql"), "utf8");
const rehearsal = fs.readFileSync(path.resolve("scripts/fit-house-reviewed-47-rehearsal.js"), "utf8");

test("immutable Fit House reviewed manifest pins exact 47 directions, actions and deltas", () => {
  assert.equal(crypto.createHash("sha256").update(fs.readFileSync(MANIFEST)).digest("hex"), MANIFEST_SHA256);
  const reviewed = loadReviewedFitHouse47(), rows = reviewed.manifest.rows;
  assert.equal(rows.length, 47);
  assert.equal(rows.filter((row) => row.old_stock && !row.new_stock).length, 36);
  assert.equal(rows.filter((row) => !row.old_stock && row.new_stock).length, 9);
  assert.deepEqual(rows.filter((row) => row.old_price !== row.new_price).map((row) => row.offer_id), ["691", "1910", "1935"]);
  assert.equal(rows.filter((row) => row.exact_action === "UPDATE_STOCK").length, 44);
  assert.equal(rows.filter((row) => row.exact_action === "UPDATE_PRICE").length, 2);
  assert.deepEqual(rows.filter((row) => row.exact_action === "UPDATE_PRICE_AND_STOCK").map((row) => row.offer_id), ["1910"]);
  assert.equal(reviewed.reviewed_rows.find((row) => row.external_variant_id === "46442757226736").before.price, "24");
  assert.equal(rows.filter((row) => row.evidence.audited_source_absent).length, 29);
  assert.deepEqual(reviewed.manifest.expected_deltas, {
    products: 0, product_variants: 0, retailer_mappings_row_count: 0, offers_row_count: 0,
    stock_updates: 45, item_price_updates: 3, shipping_updates: 0, delivered_total_updates: 3,
    offer_url_updates: 0, mapping_url_updates: 0, mapping_updated_at_updates: 0,
    freshness_updates: 47, price_history_rows: 3, retailers: 0,
  });
});

test("the exact 29 synthetic OOS rows are members of audited 78 tuples; seven live OOS remain distinct", () => {
  const reviewed = loadReviewedFitHouse47(), audited = loadAuditedMissingVariantManifest();
  assert.equal(reviewed.manifest.audited_missing_manifest_sha256, audited.sha256);
  const auditedTuples = new Set(audited.manifest.rows.map((row) => [row.offer_id, row.mapping_id,
    row.canonical_product_id, row.canonical_variant_id, row.external_product_id, row.external_variant_id].join(":")));
  const oos = reviewed.manifest.rows.filter((row) => row.old_stock && !row.new_stock);
  const synthetic = oos.filter((row) => row.evidence.audited_source_absent);
  assert.equal(synthetic.length, 29);
  assert.ok(synthetic.every((row) => auditedTuples.has([row.offer_id, row.mapping_id,
    row.canonical_product_id, row.canonical_variant_id, row.external_product_id, row.external_variant_id].join(":"))));
  assert.deepEqual(oos.filter((row) => !row.evidence.audited_source_absent).map((row) => row.offer_id),
    ["735", "928", "939", "1953", "1954", "1955", "1973"]);
});

test("only the exact owner-bound 47 package bypasses audited OOS approval block", () => {
  const reviewed = loadReviewedFitHouse47(), audited = loadAuditedMissingVariantManifest();
  const newOos = reviewed.manifest.rows.filter((row) => row.old_stock && !row.new_stock);
  const classification = { state: "BLOCKED", reason: "MASS_OOS", rows: newOos.map((row) => ({
    offer_id: row.offer_id, retailer_product_id: row.mapping_id,
    external_product_id: row.external_product_id, external_variant_id: row.external_variant_id,
    target: { in_stock: true }, source: { in_stock: false },
  })) };
  const reconciled = { newUnavailableCount: 29,
    missingVariantIds: newOos.filter((row) => row.evidence.audited_source_absent).map((row) => row.external_variant_id),
    manifest_sha256: audited.sha256, review_status: "OWNER_OOS_APPROVAL_REQUIRED" };
  assert.equal(isExactOwnerBoundAuditedMissingReview(audited, reconciled, classification, reviewed), true);
  assert.doesNotThrow(() => requireAuditedMissingOwnerApproval(audited, reconciled, classification, reviewed));
  for (const drift of [
    { ...reviewed, manifest: { ...reviewed.manifest, authority: "arbitrary" } },
    { ...reviewed, manifest: { ...reviewed.manifest, audited_missing_manifest_sha256: "0".repeat(64) } },
  ]) assert.throws(() => requireAuditedMissingOwnerApproval(audited, reconciled, classification, drift),
    (error) => error.code === "OWNER_OOS_APPROVAL_REQUIRED");
});

test("Fit House reviewed loader rejects exact-scope semantic drift even under a replacement file hash", () => {
  const changed = JSON.parse(fs.readFileSync(MANIFEST, "utf8"));
  changed.rows[0].mapping_id = "999999";
  const file = path.join(os.tmpdir(), `fit-house-reviewed-drift-${process.pid}.json`);
  fs.writeFileSync(file, `${JSON.stringify(changed, null, 2)}\n`);
  try {
    const sha = crypto.createHash("sha256").update(fs.readFileSync(file)).digest("hex");
    assert.throws(() => loadReviewedMixedChangeManifest(file, sha), /Fit House reviewed 47-row owner scope mismatch/);
  } finally { fs.rmSync(file, { force: true }); }
});

test("routine Fit House CLI remains closed to reviewed arguments", () => {
  assert.throws(() => parseArgs(["--target=production", "--mode=dry-run", "--reviewed-manifest=x"]), /invalid argument/);
});

test("control migration is exact production-only and has no catalogue business writes", () => {
  for (const token of [MANIFEST_SHA256, "90afc8b4715d56976769ecb490fb00455a028ab2f3e09dd01d33afd7a69ec86d",
    "62149b427ff68668fd4340e4acd84cd7ee66a5aa13ec23b7473a22241b561e5a",
    "fit-house-47-168b5c604482280d-production", "fithouse.uk", "v_target='PRODUCTION'", "owner-approved-chat-2026-08-10-all-three-fit-house-points-47-current-changes"])
    assert.match(migration, new RegExp(token.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")));
  assert.doesNotMatch(migration, /(?:insert into|update|delete from) public\.(?:products|product_variants|retailer_products|offers|price_history)/i);
  assert.match(rollback, /forbidden after any control-plan registration or binding/);
  assert.doesNotMatch(rollback, /(?:insert into|update|delete from) public\.(?:products|product_variants|retailer_products|offers|price_history)/i);
});

test("rehearsal is rollback-only and proves identity, URL, 45 stock and 3 price/history deltas", () => {
  assert.match(rehearsal, /rows\.length === 47/);
  assert.match(rehearsal, /price_history - beforeCounts\.price_history === 3/);
  assert.match(rehearsal, /stock_updates: 45/);
  assert.match(rehearsal, /await client\.query\("rollback"\)/);
  assert.doesNotMatch(rehearsal, /client\.query\("commit"\)/);
  assert.match(rehearsal, /actual\.external_url === prior\.external_url/);
  assert.match(rehearsal, /actual\.product_variant_id === prior\.product_variant_id/);
});
