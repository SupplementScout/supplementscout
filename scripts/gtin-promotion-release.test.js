const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");
const { APPROVED_IDENTITIES } = require("./gtin-promotion-operation");
const { EXACT36_MIGRATION, EXACT36_MIGRATION_CONFIRMATION, MIGRATION, QUARANTINED_GTINS, exactRowDiff, parseArgs, snapshotSummary } = require("./gtin-promotion-release");
const { CONTRACTS } = require("./supabase-migration-selector");

test("release accepts only production and exact owner confirmation", () => {
  const parsed = parseArgs(["--mode=deploy", "--target=production", "--env-file=tmp/owner.env", "--confirm=OWNER_APPROVED_EXACT_45"]);
  assert.equal(parsed.mode, "deploy");
  assert.throws(() => parseArgs(["--mode=deploy", "--target=production", "--env-file=tmp/owner.env", "--confirm=WRONG"]), /OWNER_APPROVED_EXACT_45/);
  assert.throws(() => parseArgs(["--mode=deploy", "--target=staging", "--env-file=tmp/owner.env", "--confirm=OWNER_APPROVED_EXACT_45"]), /target=production/);
});

test("exact-36 migration deployment has a separate confirmation and no apply mode", () => {
  const parsed = parseArgs(["--mode=exact36-deploy", "--target=production", "--env-file=tmp/owner.env", `--confirm=${EXACT36_MIGRATION_CONFIRMATION}`]);
  assert.equal(parsed.mode, "exact36-deploy");
  assert.equal(EXACT36_MIGRATION, "20260816173000_extend_guarded_gtin_promotion_exact_36.sql");
  assert.throws(() => parseArgs(["--mode=exact36-deploy", "--target=production", "--env-file=tmp/owner.env", "--confirm=OWNER_APPROVED_EXACT_36"]), /OWNER_APPROVED_EXACT_36_MIGRATION/);
});

test("release contract is exactly 45 writes and 16 quarantined conflicts", () => {
  assert.equal(APPROVED_IDENTITIES.length, 45);
  assert.equal(new Set(APPROVED_IDENTITIES.map((row) => `${row.product_id}:${row.variant_id}:${row.gtin}`)).size, 45);
  assert.equal(QUARANTINED_GTINS.length, 16);
  assert.equal(new Set(QUARANTINED_GTINS).size, 16);
});

test("post-write fingerprint changes only the exact approved variant destinations", () => {
  const variants = APPROVED_IDENTITIES.map((row) => ({ id: row.variant_id, product_id: row.product_id, gtin: null }));
  const data = { products: [{ id: "1", gtin: "0742978960459" }], variants, offers: [{ id: "1", price: 1 }], mappings: [{ id: "1", external_gtin: "x" }] };
  const summary = snapshotSummary(data, APPROVED_IDENTITIES);
  assert.notEqual(summary.variants_gtin_before_fingerprint, summary.variants_gtin_expected_fingerprint);
  assert.equal(summary.products_count, 1);
  assert.equal(summary.offers_count, 1);
  assert.equal(summary.retailer_products_count, 1);
});

test("deployed exact-45 migration remains frozen while the selector advances to exact-36", () => {
  const pending = CONTRACTS.PRODUCTION.pending;
  assert.equal(pending.length, 1);
  assert.notEqual(pending[0].filename, MIGRATION);
  assert.equal(pending[0].filename, EXACT36_MIGRATION);
  assert.equal(fs.existsSync(path.join(process.cwd(), "supabase/migrations", MIGRATION)), true);
  assert.deepEqual(pending[0].expectedCatalogueDeltas, { products: 0, product_variants: 0, retailer_products: 0, offers: 0, price_history: 0 });
});

test("failed verification reports exact changed rows", () => {
  assert.deepEqual(exactRowDiff([{ id: "1", gtin: null }, { id: "2", gtin: "x" }], [{ id: "1", gtin: "y" }, { id: "3", gtin: "z" }]), [
    { id: "1", expected: { id: "1", gtin: null }, actual: { id: "1", gtin: "y" } },
    { id: "2", expected: { id: "2", gtin: "x" }, actual: null },
    { id: "3", expected: null, actual: { id: "3", gtin: "z" } },
  ]);
});

test("verification source checks audit, exact 45, 54 no-ops and protected tables", () => {
  const source = fs.readFileSync(path.join(__dirname, "gtin-promotion-release.js"), "utf8");
  for (const contract of ["products.gtin unchanged", "exact variant GTIN postcondition", "offers unchanged", "retailer_products unchanged", "16 quarantined unchanged", "audit write count", "45 approved now already present", "full 54 identity dry-run is no-op", "duplicate GTIN conflicts"]) assert.match(source, new RegExp(contract.replace(/[.]/g, "\\.")));
  assert.match(source, /FAILED_VERIFICATION/);
  assert.doesNotMatch(source, /gtin-promotion[^\n]*rollback\.sql|--mode=rollback/i);
});
