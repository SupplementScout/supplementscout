const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");
const { APPROVED_IDENTITIES, SCOPE_CONFIGS } = require("./gtin-promotion-operation");
const { EXACT36_CONFIRMATION, MIGRATION, QUARANTINED_GTINS, RELEASE_CONFIGS, exactRowDiff, parseArgs, snapshotSummary } = require("./gtin-promotion-release");
const { CONTRACTS } = require("./supabase-migration-selector");

test("release accepts only production and exact owner confirmation", () => {
  const parsed = parseArgs(["--mode=deploy", "--target=production", "--env-file=tmp/owner.env", "--confirm=OWNER_APPROVED_EXACT_45"]);
  assert.equal(parsed.mode, "deploy");
  assert.throws(() => parseArgs(["--mode=deploy", "--target=production", "--env-file=tmp/owner.env", "--confirm=WRONG"]), /OWNER_APPROVED_EXACT_45/);
  assert.throws(() => parseArgs(["--mode=deploy", "--target=staging", "--env-file=tmp/owner.env", "--confirm=OWNER_APPROVED_EXACT_45"]), /target=production/);
});

test("owner-reviewed exact 36 release has a separate fixed write confirmation and cannot deploy schema", () => {
  const parsed = parseArgs(["--mode=capture", "--target=production", "--scope=owner-reviewed-36", "--artifact=tmp/artifact.json", "--output=tmp/baseline.json", "--env-file=tmp/owner.env", `--confirm=${EXACT36_CONFIRMATION}`]);
  assert.equal(parsed.scope, "owner-reviewed-36");
  assert.equal(RELEASE_CONFIGS["owner-reviewed-36"].identities.length, 36);
  assert.deepEqual(RELEASE_CONFIGS["owner-reviewed-36"].identities, SCOPE_CONFIGS["owner-reviewed-36"].identities);
  assert.throws(() => parseArgs(["--mode=capture", "--target=production", "--scope=owner-reviewed-36", "--artifact=tmp/artifact.json", "--output=tmp/baseline.json", "--env-file=tmp/owner.env", "--confirm=OWNER_APPROVED_EXACT_36"]), /OWNER_APPROVED_EXACT_36_APPLY/);
  assert.throws(() => parseArgs(["--mode=deploy", "--target=production", "--scope=owner-reviewed-36", "--env-file=tmp/owner.env", `--confirm=${EXACT36_CONFIRMATION}`]), /limited to the frozen exact-45/);
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

test("deployed GTIN, Whey Okay rebind and traffic classification migrations remain frozen", () => {
  const pending = new Set(CONTRACTS.PRODUCTION.pending.map(({ filename }) => filename));
  for (const filename of [
    MIGRATION,
    "20260816173000_extend_guarded_gtin_promotion_exact_36.sql",
    "20260817114500_add_outbound_click_traffic_classification.sql",
  ]) assert.equal(pending.has(filename), false);
  assert.equal(CONTRACTS.PRODUCTION.ledgerCount, 162);
  assert.equal(CONTRACTS.PRODUCTION.ledgerFingerprint, "1054c31ccb272b801c968afdcac03a8242ad7748dbe245440502ef326fcc7707");
  assert.equal(fs.existsSync(path.join(process.cwd(), "supabase/migrations", MIGRATION)), true);
  assert.equal(fs.existsSync(path.join(process.cwd(), "supabase/migrations", "20260816173000_extend_guarded_gtin_promotion_exact_36.sql")), true);
  assert.equal(fs.existsSync(path.join(process.cwd(), "supabase/migrations", "20260817114500_add_outbound_click_traffic_classification.sql")), true);
});

test("failed verification reports exact changed rows", () => {
  assert.deepEqual(exactRowDiff([{ id: "1", gtin: null }, { id: "2", gtin: "x" }], [{ id: "1", gtin: "y" }, { id: "3", gtin: "z" }]), [
    { id: "1", expected: { id: "1", gtin: null }, actual: { id: "1", gtin: "y" } },
    { id: "2", expected: { id: "2", gtin: "x" }, actual: null },
    { id: "3", expected: null, actual: { id: "3", gtin: "z" } },
  ]);
});

test("verification source checks dynamic exact scope, audit, no-ops and protected tables", () => {
  const source = fs.readFileSync(path.join(__dirname, "gtin-promotion-release.js"), "utf8");
  for (const contract of ["products.gtin unchanged", "exact variant GTIN postcondition", "offers unchanged", "retailer_products unchanged", "16 quarantined unchanged", "audit write count", "approved now already present", "identity dry-run is no-op", "duplicate GTIN conflicts"]) assert.match(source, new RegExp(contract.replace(/[.]/g, "\\.")));
  assert.match(source, /FAILED_VERIFICATION/);
  assert.doesNotMatch(source, /gtin-promotion[^\n]*rollback\.sql|--mode=rollback/i);
  assert.match(source, /expectedState: config\.scope === "owner-reviewed-36" \? "post-apply"/);
});
