const assert = require("node:assert/strict");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const test = require("node:test");
const { fingerprint } = require("./lib/retailer-offer-sync/artifacts");
const {
  artifactReviewedRows,
  bindReviewedMixedChangeContract,
  buildReviewedMixedChangeContract,
  expectedArtifactDeltas,
  loadReviewedMixedChangeManifest,
} = require("./lib/retailer-offer-sync/reviewed-mixed-change");

const manifestFile = path.resolve("tmp/jons-15-review/jons-15-reviewed-manifest-a27e9a90.json");
const manifestSha = "15a1a71238af5fa6cb08a334b859230c8cc0944cb2856c0572ef9abbd0c380a5";
const migration = fs.readFileSync(path.resolve("supabase/migrations/20260726100000_add_reviewed_mixed_change_approval.sql"), "utf8");
const rollback = fs.readFileSync(path.resolve("supabase/rollbacks/20260726100000_add_reviewed_mixed_change_approval.sql"), "utf8");

function artifact(reviewed, overrides = {}) {
  const sourceCapturedAt = new Date().toISOString();
  const rows = reviewed.reviewed_rows.map((row, index) => ({
    offer_id: String(1000 + index),
    retailer_product_id: String(2000 + index),
    external_product_id: row.external_product_id,
    external_variant_id: row.external_variant_id,
    action: row.action,
    changed_fields: {
      price: row.changed_fields.includes("price"),
      stock: row.changed_fields.includes("stock"),
      url: row.changed_fields.includes("url"),
      blocked: false,
    },
    atomic_plan: {
      expected_state: { offer: { ...row.before } },
      offer: { values: { ...row.after } },
    },
  }));
  const core = {
    target_environment: "STAGING",
    retailer_id: "10",
    source_snapshot_fingerprint: reviewed.manifest.source_capture_sha256,
    source_captured_at: sourceCapturedAt,
    expected_deltas: expectedArtifactDeltas(reviewed.manifest),
    rows,
    ...overrides,
  };
  return { ...core, artifact_fingerprint: fingerprint(core) };
}

test("immutable Jon's manifest loads only at the required raw-byte SHA", () => {
  const reviewed = loadReviewedMixedChangeManifest(manifestFile, manifestSha);
  assert.equal(reviewed.reviewed_scope_hash, "2be0472d80c495cee1b9a930bbbe8537c744d0f0d84ea110ec98ea20693e5f6b");
  assert.equal(reviewed.reviewed_rows.length, 15);
  assert.deepEqual(
    reviewed.reviewed_rows.reduce((counts, row) => ({ ...counts, [row.action]: (counts[row.action] || 0) + 1 }), {}),
    { UPDATE_STOCK: 13, UPDATE_PRICE: 1, UPDATE_URL: 1 },
  );
  assert.throws(() => loadReviewedMixedChangeManifest(manifestFile, "0".repeat(64)), /SHA-256 mismatch/);
});

test("manifest parsing is fail-closed for semantic edits even with a matching replacement byte hash", () => {
  const changed = JSON.parse(fs.readFileSync(manifestFile, "utf8"));
  changed.rows[0].new_stock = true;
  const file = path.join(fs.mkdtempSync(path.join(os.tmpdir(), "reviewed-mixed-")), "manifest.json");
  fs.writeFileSync(file, `${JSON.stringify(changed)}\n`);
  const bytes = fs.readFileSync(file);
  const hash = require("node:crypto").createHash("sha256").update(bytes).digest("hex");
  assert.throws(() => loadReviewedMixedChangeManifest(file, hash), /changed fields mismatch/);
});

test("reviewed contract binds stable Shopify identity, exact values, deltas, source and target", () => {
  const reviewed = loadReviewedMixedChangeManifest(manifestFile, manifestSha);
  const sealed = artifact(reviewed);
  assert.deepEqual(artifactReviewedRows(sealed), reviewed.reviewed_rows);
  const expiresAt = new Date(Date.now() + 10 * 60 * 1000).toISOString();
  const contract = buildReviewedMixedChangeContract({ reviewed, artifact: sealed, targetEnvironment: "STAGING", expiresAt });
  assert.equal(contract.authorization_id, "jons-15-15a1a71238af5fa6-staging");
  assert.equal(contract.reviewed_manifest_sha256, manifestSha);
  assert.equal(contract.reviewed_scope_hash, reviewed.reviewed_scope_hash);
  assert.equal(contract.reviewed_contract_hash, fingerprint(Object.fromEntries(Object.entries(contract).filter(([key]) => key !== "reviewed_contract_hash"))));
});

test("reviewed contract rejects source, identity, value, delta and environment drift", () => {
  const reviewed = loadReviewedMixedChangeManifest(manifestFile, manifestSha);
  const expiresAt = new Date(Date.now() + 10 * 60 * 1000).toISOString();
  const build = (sealed, targetEnvironment = "STAGING") => buildReviewedMixedChangeContract({ reviewed, artifact: sealed, targetEnvironment, expiresAt });
  assert.throws(() => build(artifact(reviewed, { source_snapshot_fingerprint: "a".repeat(64) })), /differs/);
  const identity = artifact(reviewed); identity.rows[0].external_variant_id = "1";
  assert.throws(() => build(identity), /differs/);
  const value = artifact(reviewed); value.rows[0].atomic_plan.offer.values.in_stock = !value.rows[0].atomic_plan.offer.values.in_stock;
  assert.throws(() => build(value), /differs/);
  const deltas = artifact(reviewed); deltas.expected_deltas.logical_field_deltas.offer_stock_updates = 12;
  assert.throws(() => build(deltas), /differs/);
  assert.throws(() => build(artifact(reviewed), "PRODUCTION"), /differs/);
});

test("validation package fingerprint includes the reviewed mixed-change contract", () => {
  const reviewed = loadReviewedMixedChangeManifest(manifestFile, manifestSha);
  const sealed = artifact(reviewed);
  const contract = buildReviewedMixedChangeContract({
    reviewed,
    artifact: sealed,
    targetEnvironment: "STAGING",
    expiresAt: new Date(Date.now() + 10 * 60 * 1000).toISOString(),
  });
  const bound = bindReviewedMixedChangeContract({ schema_version: 1, package_fingerprint: null }, contract);
  assert.equal(bound.package_fingerprint, fingerprint({ ...bound, package_fingerprint: null }));
  assert.notEqual(
    bindReviewedMixedChangeContract({ schema_version: 1, package_fingerprint: null }, { ...contract, artifact_fingerprint: "0".repeat(64) }).package_fingerprint,
    bound.package_fingerprint,
  );
});

test("migration preserves ordinary and prior reviewed dispatch while adding no business-table writes", () => {
  assert.match(migration, /pg_get_functiondef\('public\.retailer_offer_sync_validate_batch_read_only_internal\(jsonb\)'::regprocedure\)/);
  assert.match(migration, /FUNCTION public\.retailer_offer_sync_validate_before_reviewed_mixed/);
  assert.match(migration, /return public\.retailer_offer_sync_validate_before_reviewed_mixed\(p_request\)/);
  assert.match(migration, /return public\.retailer_offer_sync_approve_before_reviewed_mixed\(p_request\)/);
  assert.match(migration, /return public\.retailer_offer_sync_execute_before_reviewed_mixed\(p_request\)/);
  assert.doesNotMatch(migration, /(?:insert into|update|delete from) public\.(?:products|product_variants|retailer_products|offers|price_history)/i);
  assert.doesNotMatch(migration, /\b(?:alter|create)\s+role\b/i);
  assert.match(migration, /create or replace function public\.register_reviewed_mixed_change_control_plan/);
  assert.match(migration, /REVIEWED_MIXED_CHANGE_PLAN_REGISTERED/);
  assert.match(migration, /operation_count/);
  assert.match(migration, /grant execute on function public\.register_reviewed_mixed_change_control_plan\(jsonb\)[\s\S]+retailer_catalogue_staging_validator/);
  assert.match(migration, /grant execute on function public\.register_reviewed_mixed_change_control_plan\(jsonb\)[\s\S]+retailer_catalogue_production_validator/);
});

test("SQL validator is registry, raw-manifest, stable-scope, source, before/after and delta bound", () => {
  for (const token of [
    manifestSha,
    "a27e9a90f0a2e51e4c375da84f9cfb237384ab2b29db2e2c29725f57979831e5",
    "2be0472d80c495cee1b9a930bbbe8537c744d0f0d84ea110ec98ea20693e5f6b",
    "reviewed_manifest_sha256",
    "reviewed_source_fingerprint",
    "reviewed_scope_hash",
    "external_product_id",
    "external_variant_id",
    "expected_deltas",
    "expected_state,offer,price",
    "expected_state,offer,in_stock",
    "expected_state,offer,url",
    "offer,values,total_price",
    "retailer_product,values,external_url",
    "price_history,action",
  ]) assert.match(migration, new RegExp(token));
  assert.match(migration, /source_captured_at'\)::timestamptz<now\(\)-interval '15 minutes'/);
  assert.match(migration, /reviewed mixed-change ordinary MASS_OOS proof mismatch/i);
  assert.match(migration, /maximum_new_oos_count'\)::integer not between 0 and 3/);
});

test("approval is one consumed authorization, replay blocked and consumption is after atomic execution", () => {
  assert.match(migration, /create unique index retailer_offer_sync_one_consumed_reviewed_mixed_change/);
  assert.match(migration, /where status='CONSUMED'/);
  assert.match(migration, /v_result:=public\.retailer_offer_sync_execute_before_reviewed_mixed\(p_request\);[\s\S]+set status='CONSUMED',consumed_at=now\(\)/);
  assert.match(migration, /RSBI_REPLAY_BLOCKED/);
  assert.match(migration, /force row level security/);
  assert.doesNotMatch(migration, /grant execute[^;]+(?:anon|authenticated|service_role)/i);
});

test("rollback restores exact prior dispatchers and refuses to erase approval evidence", () => {
  assert.match(rollback, /rollback is forbidden after any approval binding/);
  assert.match(rollback, /pg_get_functiondef\('public\.retailer_offer_sync_validate_before_reviewed_mixed\(jsonb\)'::regprocedure\)/);
  assert.match(rollback, /FUNCTION public\.retailer_offer_sync_validate_batch_read_only_internal/);
  assert.doesNotMatch(rollback, /(?:insert into|update|delete from) public\.(?:products|product_variants|retailer_products|offers|price_history)/i);
});
