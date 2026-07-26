const assert = require("node:assert/strict");
const crypto = require("node:crypto");
const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");
const { fingerprint } = require("./lib/retailer-offer-sync/artifacts");
const {
  buildReviewedMixedChangeContract,
  loadReviewedMixedChangeManifest,
} = require("./lib/retailer-offer-sync/reviewed-mixed-change");

const manifestFile = path.resolve(
  "tmp/jons-15-review/jons-15-reviewed-manifest-scoped-8c08e919.json",
);
const manifestSha = "2b14b0d7b09ab70f41aacb1907bd1718d605cab9fcde0246dc7b7a7f167718c2";
const mapped16ManifestFile = path.resolve(
  "tmp/jons-15-review/jons-16-reviewed-manifest-mapped-ff23c3c2-v3.json",
);
const mapped16ManifestSha =
  "52d2f3f0bd5ec04629a43320ec0166f655d1fb0b6f7a93b9f3fcbc8ecf683723";
const migration = fs.readFileSync(
  path.resolve("supabase/migrations/20260726120000_add_scoped_reviewed_mixed_change_fingerprints.sql"),
  "utf8",
);
const rollback = fs.readFileSync(
  path.resolve("supabase/rollbacks/20260726120000_add_scoped_reviewed_mixed_change_fingerprints.sql"),
  "utf8",
);
const mappedMigration = fs.readFileSync(
  path.resolve("supabase/migrations/20260726130000_add_mapped_scope_reviewed_approval.sql"),
  "utf8",
);
const mappedRollback = fs.readFileSync(
  path.resolve("supabase/rollbacks/20260726130000_add_mapped_scope_reviewed_approval.sql"),
  "utf8",
);

function artifact(reviewed, overrides = {}) {
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
      expected_state: {
        retailer_product: { updated_at: "2026-07-26T08:00:00.000000Z" },
        offer: { ...row.before, last_checked_at: "2026-07-26T08:00:00.000000Z" },
      },
      offer: { values: { ...row.after } },
    },
  }));
  const core = {
    target_environment: "STAGING",
    retailer_id: "10",
    source_snapshot_fingerprint:
      reviewed.manifest.scoped_source_contract.observed_full_source_fingerprint,
    source_captured_at: new Date().toISOString(),
    expected_deltas: {
      row_count_deltas: {
        products: 0, product_variants: 0, retailer_products: 0, offers: 0, price_history: 1,
      },
      logical_field_deltas: {
        offer_price_updates: 1, offer_shipping_updates: 0, offer_total_updates: 1,
        offer_stock_updates: 13, offer_url_updates: 1, mapping_url_updates: 1,
        mapping_updated_at_updates: 1, last_checked_at_updates: 15,
      },
    },
    rows,
    ...overrides,
  };
  return { ...core, artifact_fingerprint: fingerprint(core) };
}

function evidence(reviewed) {
  const scoped = reviewed.manifest.scoped_source_contract;
  return {
    full_source_fingerprint: scoped.observed_full_source_fingerprint,
    reviewed_full_source_fingerprint: scoped.reviewed_full_source_fingerprint,
    mapped_scope_fingerprint: scoped.mapped_scope_fingerprint,
    mapped_scope_row_count: scoped.mapped_scope_row_count,
    unmapped_source_delta: scoped.unmapped_source_delta,
    unmapped_source_delta_hash: scoped.unmapped_source_delta_hash,
  };
}

test("scoped immutable manifest loads only at its raw-byte SHA", () => {
  const bytes = fs.readFileSync(manifestFile);
  assert.equal(crypto.createHash("sha256").update(bytes).digest("hex"), manifestSha);
  const reviewed = loadReviewedMixedChangeManifest(manifestFile, manifestSha);
  assert.equal(reviewed.scoped, true);
  assert.equal(reviewed.manifest.scoped_source_contract.mapped_scope_row_count, 506);
  assert.equal(
    fingerprint(reviewed.manifest.scoped_source_contract.unmapped_source_delta),
    reviewed.manifest.scoped_source_contract.unmapped_source_delta_hash,
  );
});

test("mapped-scope immutable 16-change manifest binds the exact approved scope", () => {
  const bytes = fs.readFileSync(mapped16ManifestFile);
  assert.equal(crypto.createHash("sha256").update(bytes).digest("hex"), mapped16ManifestSha);
  const reviewed = loadReviewedMixedChangeManifest(
    mapped16ManifestFile,
    mapped16ManifestSha,
  );
  assert.equal(reviewed.mapped, true);
  assert.equal(reviewed.manifest.row_count, 16);
  assert.equal(reviewed.manifest.expected_deltas.stock_updates, 14);
  assert.equal(reviewed.manifest.expected_deltas.freshness_updates, 16);
  assert.equal(reviewed.manifest.mapped_source_contract.mapped_scope_row_count, 506);
  assert.equal(
    fingerprint(reviewed.manifest.mapped_source_contract.allowed_unmapped_collisions),
    reviewed.manifest.mapped_source_contract.allowed_unmapped_collisions_hash,
  );
  assert.equal(
    reviewed.manifest.rows.filter((row) => row.exact_action === "UPDATE_STOCK").length,
    14,
  );
  assert.equal(
    reviewed.manifest.rows.find((row) => row.jons_variant_id === "50838709436754")
      ?.offer_id,
    "1280",
  );
});

test("v2 contract binds full, mapped, reviewed, delta and updated_at precondition hashes", () => {
  const reviewed = loadReviewedMixedChangeManifest(manifestFile, manifestSha);
  const sealed = artifact(reviewed);
  const contract = buildReviewedMixedChangeContract({
    reviewed,
    artifact: sealed,
    targetEnvironment: "STAGING",
    expiresAt: new Date(Date.now() + 10 * 60 * 1000).toISOString(),
    scopedSourceEvidence: evidence(reviewed),
  });
  assert.equal(contract.kind, "retailer-reviewed-mixed-change-v2");
  assert.equal(contract.authorization_id, "jons-15-2b14b0d7b09ab70f-staging");
  assert.equal(contract.mapped_scope_row_count, 506);
  assert.equal(contract.execution_preconditions.length, 15);
  assert.equal(contract.execution_preconditions[0].mapping_updated_at, "2026-07-26T08:00:00.000000Z");
  assert.equal(
    contract.reviewed_change_scope_hash,
    fingerprint({
      reviewed_rows: contract.reviewed_rows,
      execution_preconditions: contract.execution_preconditions,
      expected_deltas: contract.expected_deltas,
    }),
  );
});

test("v2 contract rejects changed reviewed row, action, deltas and environment", () => {
  const reviewed = loadReviewedMixedChangeManifest(manifestFile, manifestSha);
  const expiresAt = new Date(Date.now() + 10 * 60 * 1000).toISOString();
  const build = (sealed, targetEnvironment = "STAGING") => buildReviewedMixedChangeContract({
    reviewed,
    artifact: sealed,
    targetEnvironment,
    expiresAt,
    scopedSourceEvidence: evidence(reviewed),
  });
  const value = artifact(reviewed);
  value.rows[0].atomic_plan.offer.values.in_stock =
    !value.rows[0].atomic_plan.offer.values.in_stock;
  assert.throws(() => build(value), /differs/);
  const action = artifact(reviewed);
  action.rows[0].action = "UPDATE_PRICE";
  assert.throws(() => build(action), /differs/);
  const deltas = artifact(reviewed);
  deltas.expected_deltas.logical_field_deltas.offer_stock_updates = 12;
  assert.throws(() => build(deltas), /differs/);
  assert.throws(() => build(artifact(reviewed), "PRODUCTION"), /differs/);
});

test("new migration is additive, v1-compatible and has no business writes or guard changes", () => {
  assert.match(migration, /retailer-reviewed-mixed-change-v1/);
  assert.match(migration, /retailer-reviewed-mixed-change-v2/);
  assert.match(migration, /mapped_scope_fingerprint/);
  assert.match(migration, /reviewed_change_scope_hash/);
  assert.match(migration, /execution_preconditions/);
  assert.match(migration, /unmapped_source_delta_hash/);
  assert.match(migration, /Unmapped source delta collides with mapped identity/);
  assert.match(migration, /already installed; rerun rejected/);
  assert.doesNotMatch(
    migration,
    /(?:insert into|update|delete from) public\.(?:products|product_variants|retailer_products|offers|price_history)/i,
  );
  assert.doesNotMatch(migration, /mass_oos_block_count|maximum_new_oos_count|shipping policy/i);
  assert.match(rollback, /rollback is forbidden after any scoped reviewed approval binding/);
});

test("mapped-scope v3 migration preserves v1/v2 and changes no business policy or rows", () => {
  assert.match(mappedMigration, /retailer-reviewed-mapped-scope-v3/);
  assert.match(
    mappedMigration,
    /retailer_offer_sync_validate_reviewed_mixed_change_contract_v2/,
  );
  assert.match(
    mappedMigration,
    /return public\.retailer_offer_sync_validate_reviewed_mixed_change_contract_v2/,
  );
  assert.match(mappedMigration, /unmapped_identity_rows_hash/);
  assert.match(mappedMigration, /allowed_unmapped_collisions_hash/);
  assert.match(
    mappedMigration,
    /ALLOW_UNMAPPED_ADD_REMOVE_WITHOUT_NEW_MAPPED_IDENTITY_COLLISIONS/,
  );
  assert.match(mappedMigration, /New unmapped identity collision is not authorized/);
  assert.doesNotMatch(
    mappedMigration,
    /mapping\.external_product_id=unmapped\.value->>'external_product_id'/,
  );
  assert.match(mappedMigration, /already installed; rerun rejected/);
  assert.doesNotMatch(
    mappedMigration,
    /(?:insert into|update|delete from) public\.(?:products|product_variants|retailers|retailer_products|offers|price_history)/i,
  );
  assert.doesNotMatch(
    mappedMigration,
    /mass_oos_block_count|maximum_new_oos_count|shipping policy/i,
  );
  assert.match(
    mappedRollback,
    /rollback is forbidden after any v3 reviewed definition/,
  );
  assert.doesNotMatch(
    mappedRollback,
    /(?:insert into|update|delete from) public\.(?:products|product_variants|retailers|retailer_products|offers|price_history)/i,
  );
});
