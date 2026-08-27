const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");
const reviewedManifest = require("../config/retailers/predators-gear-reviewed-bindings-v1.json");
const {
  EXPECTED_ARTIFACT_PATH,
  loadCredential,
  parseArgs,
  planFingerprint,
  runApproval,
  sha256,
  sourceRowFingerprint,
  validateApprovalScope,
} = require("./predators-gear-artifact-approver");

const ROOT = path.resolve(__dirname, "..");
const CSV_PATH = path.resolve(ROOT, reviewedManifest.canonical_csv.path);
const FIRST_FINGERPRINT = "8d9c2ce4e4d88a8ddb5c7feec9ed825a";

function clone(value) {
  return structuredClone(value);
}

function fixture() {
  const csvBytes = Buffer.from("predators-gear-reviewed-canonical-fixture\n", "utf8");
  const manifest = clone(reviewedManifest);
  manifest.canonical_csv.sha256 = sha256(csvBytes);
  const sourceRows = [];
  const plans = [];
  for (let index = 0; index < manifest.rows.length; index += 1) {
    const reviewed = manifest.rows[index];
    const rowNumber = String(index + 2);
    const source = {
      retailer_name: "Predators Gear",
      retailer_website: "https://predatorsgear.co.uk/",
      external_product_id: String(reviewed.external_product_id),
      external_variant_id: String(reviewed.external_variant_id),
      external_gtin: reviewed.external_gtin14 || "",
      product_id: String(reviewed.product_id),
      product_variant_id: String(reviewed.product_variant_id),
      shipping_known: "true",
      shipping_cost: "0",
      price: String(reviewed.price),
      total_price: String(reviewed.price),
      external_url: reviewed.source_url,
      affiliate_url: reviewed.source_url,
      image: reviewed.image_url,
    };
    const sourceFingerprint = sourceRowFingerprint(source);
    const plan = {
      approval: { approval_type: "none", approved: false },
      expected_state: {
        offer: null,
        product: {
          id: String(reviewed.product_id),
          is_active: true,
          merged_into_product_id: null,
        },
        product_variant: {
          id: String(reviewed.product_variant_id),
          product_id: String(reviewed.product_id),
          is_active: true,
        },
        retailer: null,
        retailer_product: null,
      },
      meta: {
        operation_type: "standard_import",
        plan_fingerprint: null,
        plan_kind: "feed",
        source_row_fingerprint: sourceFingerprint,
        version: "2",
      },
      offer: {
        action: "create",
        values: {
          in_stock: true,
          last_checked_at: "2026-08-26T20:33:05.744Z",
          price: String(reviewed.price),
          shipping_cost: "0",
          total_price: String(reviewed.price),
          url: reviewed.source_url,
        },
      },
      price_history: { action: "create" },
      product: { action: "existing", id: String(reviewed.product_id) },
      product_variant: {
        action: "existing",
        evidence: {},
        id: String(reviewed.product_variant_id),
      },
      retailer: {
        action: "create",
        values: {
          name: "Predators Gear",
          slug: "predators-gear",
          website: "https://predatorsgear.co.uk/",
        },
      },
      retailer_product: {
        action: "create",
        values: {
          external_gtin: reviewed.external_gtin14 || null,
          external_product_id: String(reviewed.external_product_id),
          external_variant_id: String(reviewed.external_variant_id),
          product_variant_id: String(reviewed.product_variant_id),
        },
      },
    };
    let fingerprint = planFingerprint(plan);
    if (index === 0) fingerprint = FIRST_FINGERPRINT;
    plan.meta.plan_fingerprint = fingerprint;
    sourceRows.push({
      row_number: rowNumber,
      normalized_source_row: source,
      source_row_fingerprint: sourceFingerprint,
      status: "planned",
      plan_fingerprint: fingerprint,
    });
    plans.push({
      row_number: rowNumber,
      source_row_fingerprint: sourceFingerprint,
      plan_fingerprint: fingerprint,
      retailer_id: null,
      plan_kind: "feed",
      operation_type: "standard_import",
      resolved_plan: plan,
    });
  }
  const artifact = {
    artifact_version: "1",
    run_id: "predators-gear-fixture",
    created_at: "2026-08-26T20:33:05.758Z",
    source_file_name: path.basename(CSV_PATH),
    source_file_sha256: sha256(csvBytes),
    row_count: "7",
    source_rows: sourceRows,
    plans,
    blocked_rows: [],
    summary: {
      plan_count: "7",
      blocked_row_count: "0",
      skipped_row_count: "0",
    },
    environment_marker: "local",
  };
  const loaded = {
    artifact,
    artifactPath: EXPECTED_ARTIFACT_PATH,
    artifactSha256: "a".repeat(64),
  };
  const options = {
    artifact: EXPECTED_ARTIFACT_PATH,
    csv: CSV_PATH,
    planFingerprint: FIRST_FINGERPRINT,
  };
  return { artifact, csvBytes, loaded, manifest, options };
}

function validate(value) {
  return validateApprovalScope(
    value.options,
    value.loaded,
    value.manifest,
    value.csvBytes
  );
}

test("CLI accepts only the exact artifact, fingerprint and CSV arguments", () => {
  const parsed = parseArgs([
    `--artifact=${EXPECTED_ARTIFACT_PATH}`,
    `--plan-fingerprint=${FIRST_FINGERPRINT}`,
    `--csv=${CSV_PATH}`,
  ]);
  assert.equal(parsed.planFingerprint, FIRST_FINGERPRINT);
  assert.throws(() => parseArgs(["--artifact=x"]), /Required --plan-fingerprint/);
  assert.throws(
    () => parseArgs(["--artifact=x", "--plan-fingerprint=bad", "--csv=y"]),
    /valid --plan-fingerprint/
  );
  assert.throws(
    () => parseArgs(["--artifact=x", `--plan-fingerprint=${FIRST_FINGERPRINT}`, "--csv=y", "--mode=apply"]),
    /Invalid argument/
  );
  assert.throws(
    () => parseArgs(["--artifact=x", `--plan-fingerprint=${FIRST_FINGERPRINT}`, "--csv=y", "--database-url=postgresql:\/\/invalid"]),
    /Invalid argument/
  );
});

test("runner fails closed without the protected approver credential", () => {
  assert.throws(
    () => loadCredential(path.join(ROOT, "tmp", "missing-production-approver.env")),
    /Protected production approver credential not found/
  );
});

test("reviewed seven-plan fixture validates and preserves the approved Whey bindings", () => {
  const value = fixture();
  const prepared = validate(value);
  assert.equal(prepared.entry.plan_fingerprint, FIRST_FINGERPRINT);
  const whey = value.artifact.plans.filter((entry) =>
    ["1068", "1971"].includes(String(entry.resolved_plan.product_variant.id))
  );
  assert.equal(whey.length, 2);
  assert.ok(whey.every((entry) => String(entry.resolved_plan.product.id) === "510"));
});

test("runner rejects an artifact with blockers", () => {
  const value = fixture();
  value.artifact.blocked_rows.push({ row_number: "2", reason: "blocked" });
  value.artifact.summary.blocked_row_count = "1";
  assert.throws(() => validate(value), /clean-run contract mismatch/);
});

test("runner rejects an unknown plan fingerprint", () => {
  const value = fixture();
  value.options.planFingerprint = "f".repeat(32);
  assert.throws(() => validate(value), /exactly one matching plan/);
});

test("runner rejects a product creation plan", () => {
  const value = fixture();
  value.artifact.plans[0].resolved_plan.product = { action: "create", values: {} };
  assert.throws(() => validate(value), /Unsafe Predators Gear plan/);
});

test("runner rejects a variant creation plan", () => {
  const value = fixture();
  value.artifact.plans[0].resolved_plan.product_variant = { action: "create", values: {} };
  assert.throws(() => validate(value), /Unsafe Predators Gear plan/);
});

test("runner rejects non-zero Predators Gear shipping", () => {
  const value = fixture();
  value.artifact.plans[0].resolved_plan.offer.values.shipping_cost = "4.99";
  assert.throws(() => validate(value), /Unsafe Predators Gear plan/);
});

test("runner rejects any plan targeting product 337", () => {
  const value = fixture();
  value.artifact.plans[0].resolved_plan.product.id = "337";
  assert.throws(() => validate(value), /Unsafe Predators Gear plan/);
});

test("runner source is direct-PG approval-only with the dedicated local role", () => {
  const source = fs.readFileSync(
    path.join(ROOT, "scripts", "predators-gear-artifact-approver.js"),
    "utf8"
  );
  assert.match(source, /require\("pg"\)/);
  assert.match(source, /production-approver\.env/);
  assert.match(source, /set local role \$\{APPROVER_ROLE\}/);
  assert.match(source, /approve_product_import_plan/);
  assert.doesNotMatch(source, /SUPABASE_SERVICE_ROLE_KEY/);
  assert.doesNotMatch(source, /apply_approved_product_import_plan/);
  assert.doesNotMatch(source, /pilot[-_ ]apply/i);
  assert.doesNotMatch(source, /from\(["'](?:retailers|products|product_variants|retailer_products|offers)["']\)/);
});

test("successful execution calls one approval RPC and never an apply path", async () => {
  const value = fixture();
  const queries = [];
  const client = {
    async connect() { queries.push("CONNECT"); },
    async end() { queries.push("END"); },
    async query(sql) {
      queries.push(sql);
      if (sql === "select current_user,session_user") {
        return {
          rows: [{
            current_user: "retailer_catalogue_production_approver",
            session_user: "supplementscout_production_approver_login",
          }],
        };
      }
      if (/approve_product_import_plan/.test(sql)) {
        return {
          rows: [{
            result: {
              approval_id: "11111111-1111-4111-8111-111111111111",
              artifact_sha256: value.loaded.artifactSha256,
              run_id: value.artifact.run_id,
              plan_fingerprint: FIRST_FINGERPRINT,
              source_row_fingerprint: value.artifact.plans[0].source_row_fingerprint,
              retailer_id: null,
              plan_kind: "feed",
              expires_at: "2026-08-27T12:15:00.000Z",
              status: "approved",
            },
          }],
        };
      }
      return { rows: [] };
    },
  };
  const result = await runApproval(value.options, {
    client,
    connectionString: "postgresql://not-used.invalid/database",
    loaded: value.loaded,
    manifest: value.manifest,
    csvBytes: value.csvBytes,
  });
  assert.equal(result.approval_id, "11111111-1111-4111-8111-111111111111");
  assert.equal(result.product_action, "existing");
  assert.equal(result.variant_action, "existing");
  assert.equal(result.no_apply_was_run, true);
  assert.equal(queries.filter((query) => /approve_product_import_plan/.test(query)).length, 1);
  assert.equal(queries.filter((query) => /apply_/.test(query)).length, 0);
  assert.ok(queries.includes("commit"));
  assert.ok(!queries.includes("rollback"));
});
