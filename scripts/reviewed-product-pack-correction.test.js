const assert = require("node:assert/strict");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const test = require("node:test");
const {
  CONTRACT_KIND,
  buildPreparedPackage,
  loadPackage,
  packageFingerprint,
  preparationFingerprint,
  sha256,
  validatePackage,
} = require("./lib/reviewed-product-pack-correction");
const {
  APPLY_SQL,
  APPROVE_SQL,
  READBACK_SQL,
  VALIDATE_SQL,
  assertState,
  parseArgs,
  run,
} = require("./reviewed-product-pack-correction");

const PACKAGE_SHA = "a".repeat(64);

function reseal(value) {
  value.package_fingerprint = packageFingerprint(value);
  return value;
}

function packageFixture(overrides = {}) {
  return reseal({
    schema_version: 1,
    kind: CONTRACT_KIND,
    status: "OWNER_APPROVED",
    authorized_by: "catalogue-owner",
    authorized_at: "2026-10-28T20:00:00.000Z",
    target_environment: "PRODUCTION",
    target_project_ref: "aftboxmrdgyhizicfsfu",
    operation: {
      table: "products",
      product_id: "991",
      field: "net_weight_g",
      expected_before: "1820",
      reviewed_after: "1870",
    },
    evidence: {
      preparation_artifact: {
        relative_path: "tmp/review/prepared.json",
        sha256: "1".repeat(64),
        artifact_fingerprint: "2".repeat(64),
      },
      source_evidence: {
        relative_path: "tmp/review/source.html",
        sha256: "3".repeat(64),
      },
    },
    policy: {
      single_product_row: true,
      single_field_only: true,
      exact_before_required: true,
      strict_post_write_readback: true,
      row_count_delta_must_be_zero: true,
    },
    package_fingerprint: null,
    ...overrides,
  });
}

function preparedFixture() {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "product-pack-correction-"));
  fs.mkdirSync(path.join(root, "tmp/review"), { recursive: true });
  const evidencePath = "tmp/review/source.html";
  const evidenceBytes = Buffer.from("generic exact pack evidence", "utf8");
  fs.writeFileSync(path.join(root, evidencePath), evidenceBytes);
  const artifact = {
    schema_version: 1,
    target: { product_id: 991, variant_id: 1234 },
    production_readback: { product: { id: 991, net_weight_g: 1820 } },
    authoritative_evidence: {
      sources: [{ local_raw_path: evidencePath, sha256: sha256(evidenceBytes) }],
    },
    required_actions: {
      pack_correction_required: true,
      exact_product_pack_correction: {
        field: "products.net_weight_g",
        before: 1820,
        after: 1870,
      },
    },
  };
  artifact.artifact_fingerprint = preparationFingerprint(artifact);
  const artifactPath = "tmp/review/prepared.json";
  const artifactBytes = Buffer.from(`${JSON.stringify(artifact, null, 2)}\n`, "utf8");
  fs.writeFileSync(path.join(root, artifactPath), artifactBytes);
  return {
    root,
    artifactPath,
    artifact,
    artifactSha256: sha256(artifactBytes),
    evidenceSha256: sha256(evidenceBytes),
  };
}

test("generic product pack correction accepts one reviewed products.net_weight_g transition", () => {
  const value = packageFixture();
  assert.equal(validatePackage(value, { target: "production" }), value);
  assert.equal(value.operation.product_id, "991");
  assert.equal(value.operation.expected_before, "1820");
  assert.equal(value.operation.reviewed_after, "1870");
});

test("generic builder binds immutable preparation and source evidence without product-specific logic", () => {
  const fixture = preparedFixture();
  const value = buildPreparedPackage({
    root: fixture.root,
    sourceArtifactPath: fixture.artifactPath,
    sourceArtifactSha256: fixture.artifactSha256,
    sourceArtifactFingerprint: fixture.artifact.artifact_fingerprint,
    evidenceSha256: fixture.evidenceSha256,
    target: "production",
  });
  assert.equal(value.status, "PREPARED");
  assert.equal(value.operation.product_id, "991");
  assert.equal(value.evidence.preparation_artifact.sha256, fixture.artifactSha256);
  const packagePath = "tmp/review/package.json";
  const bytes = Buffer.from(`${JSON.stringify(value, null, 2)}\n`, "utf8");
  fs.writeFileSync(path.join(fixture.root, packagePath), bytes);
  assert.equal(loadPackage({
    root: fixture.root,
    packagePath,
    packageSha256: sha256(bytes),
    target: "production",
  }).value.package_fingerprint, value.package_fingerprint);
});

test("closed package blocks unsupported, multiple and identity-changing fields", () => {
  const cases = [
    ["unsupported field", value => { value.operation.field = "name"; }, /field must be net_weight_g/],
    ["multiple fields", value => { value.operation.name = "changed"; }, /operation keys mismatch/],
    ["unexpected ID", value => { value.operation.replacement_product_id = "992"; }, /operation keys mismatch/],
    ["unexpected name", value => { value.operation.product_name = "changed"; }, /operation keys mismatch/],
    ["unexpected brand", value => { value.operation.brand = "changed"; }, /operation keys mismatch/],
    ["unexpected format", value => { value.operation.product_format = "powder"; }, /operation keys mismatch/],
    ["unexpected GTIN", value => { value.operation.gtin = "12345678"; }, /operation keys mismatch/],
    ["product variants", value => { value.operation.table = "product_variants"; }, /table must be products/],
    ["scope expansion", value => { value.operations = [value.operation]; }, /package keys mismatch/],
  ];
  for (const [label, mutate, expected] of cases) {
    const value = packageFixture();
    mutate(value);
    reseal(value);
    assert.throws(() => validatePackage(value), expected, label);
  }
});

test("closed package blocks zero, negative, non-numeric and unchanged values", () => {
  for (const [label, field, input, expected] of [
    ["zero", "reviewed_after", "0", /must be positive/],
    ["negative", "reviewed_after", "-1", /must be positive/],
    ["non-numeric", "reviewed_after", "large", /valid decimal/],
    ["unchanged", "reviewed_after", "1820", /must change/],
  ]) {
    const value = packageFixture();
    value.operation[field] = input;
    reseal(value);
    assert.throws(() => validatePackage(value), expected, label);
  }
});

test("fingerprint tampering and wrong target environment fail closed", () => {
  const tampered = packageFixture();
  tampered.operation.reviewed_after = "1880";
  assert.throws(() => validatePackage(tampered), /fingerprint mismatch/);
  const wrongTarget = packageFixture();
  assert.throws(() => validatePackage(wrongTarget, { target: "staging" }), /requested target mismatch/);
  const wrongProject = packageFixture({ target_project_ref: "hxnrsyyqffztlvcrtgbf" });
  assert.throws(() => validatePackage(wrongProject), /target mismatch/);
});

test("stale or missing product state blocks exact precondition and readback", () => {
  const value = packageFixture();
  assert.throws(() => assertState({ valid: true, table: "products", field: "net_weight_g", product_id: "991", current_value: "1800", products_count: 20 }, value, "1820", "preflight"), /net_weight_g mismatch/);
  assert.throws(() => assertState(null, value, "1820", "preflight"), /valid state/);
  assert.throws(() => assertState({ valid: true, table: "products", field: "net_weight_g", product_id: "992", current_value: "1820", products_count: 20 }, value, "1820", "preflight"), /product ID mismatch/);
});

test("apply requires the exact explicit confirmation", () => {
  const base = [
    "--mode=apply",
    "--target=production",
    "--package=tmp/review/package.json",
    `--package-sha256=${PACKAGE_SHA}`,
    "--output=tmp/review/audit.json",
  ];
  assert.throws(() => parseArgs(base), /Unexpected apply argument|confirmation/);
  assert.throws(() => parseArgs([...base, "--confirm-reviewed-product-pack-correction=false"]), /explicit/);
  assert.equal(parseArgs([...base, "--confirm-reviewed-product-pack-correction=true"]).confirmed, true);
});

test("executor performs validator, one approval, one apply and exact post-write readback", async () => {
  const value = packageFixture();
  const loaded = { value, packageSha256: PACKAGE_SHA };
  const queries = [];
  const client = {
    async query(sql) {
      queries.push(sql);
      if (sql === VALIDATE_SQL) return { rows: [{ result: { valid: true, table: "products", field: "net_weight_g", product_id: "991", current_value: "1820", products_count: 25 } }] };
      if (sql === APPROVE_SQL) return { rows: [{ result: { approval_id: "11111111-1111-4111-8111-111111111111", status: "approved", expires_at: new Date(Date.now() + 10 * 60_000).toISOString(), artifact_sha256: PACKAGE_SHA, package_fingerprint: value.package_fingerprint, product_id: "991", field: "net_weight_g", target_environment: "PRODUCTION", target_project_ref: "aftboxmrdgyhizicfsfu" } }] };
      if (sql === APPLY_SQL) return { rows: [{ result: { approval_status: "consumed", updated_rows: 1, row_count_delta: 0, before_value: "1820", after_value: "1870" } }] };
      if (sql === READBACK_SQL) return { rows: [{ result: { valid: true, table: "products", field: "net_weight_g", product_id: "991", current_value: "1870", products_count: 25 } }] };
      throw new Error(`unexpected SQL ${sql}`);
    },
    async end() {},
  };
  const result = await run({
    mode: "apply",
    target: "production",
    packagePath: "tmp/review/package.json",
    packageSha256: PACKAGE_SHA,
    outputPath: "tmp/review/audit.json",
    confirmed: true,
  }, {
    loadPackage: () => loaded,
    connect: async () => client,
    roleTransaction: async (connection, target, kind, callback) => callback(connection),
    assertCleanMain: () => "f".repeat(40),
    writeNewJson: () => ({ sha256: "b".repeat(64) }),
  });
  assert.equal(result.result, "PASS");
  assert.equal(result.approval_count, 1);
  assert.equal(result.apply_count, 1);
  assert.equal(result.business_row_writes, 1);
  assert.deepEqual(queries, [VALIDATE_SQL, APPROVE_SQL, APPLY_SQL, READBACK_SQL]);
});

test("SQL boundary is generic, role-separated and updates only one products.net_weight_g row", () => {
  const migration = fs.readFileSync(path.join(__dirname, "../supabase/migrations/20261028210000_add_reviewed_product_pack_correction.sql"), "utf8");
  assert.doesNotMatch(migration, /\b(?:BSN|Syntha|PER4M)\b|product_id\s*=\s*164/i);
  assert.match(migration, /update public\.products\s+set net_weight_g=v_reviewed\s+where id=v_before\.id and net_weight_g is not distinct from v_expected/i);
  assert.doesNotMatch(migration, /update public\.(?:product_variants|offers|retailer_products|price_history)/i);
  assert.match(migration, /get diagnostics v_updated=row_count/);
  assert.match(migration, /v_updated<>1/);
  assert.match(migration, /to_jsonb\(v_after\)-'net_weight_g'.+to_jsonb\(v_before\)-'net_weight_g'/s);
  assert.match(migration, /grant execute on function public\.validate_reviewed_product_pack_correction_read_only\(jsonb\).+retailer_catalogue_production_validator/s);
  assert.match(migration, /grant execute on function public\.approve_reviewed_product_pack_correction\(jsonb,text,timestamptz\).+retailer_catalogue_production_approver/s);
  assert.match(migration, /grant execute on function public\.apply_approved_reviewed_product_pack_correction\(uuid,jsonb,text\).+retailer_catalogue_production_executor/s);
});
