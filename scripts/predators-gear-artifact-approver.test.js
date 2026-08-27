const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");
const reviewedManifest = require("../config/retailers/predators-gear-reviewed-bindings-v1.json");
const {
  EXPECTED_ARTIFACT_PATH,
  REMAINING_ARTIFACT_PATH,
  REVIEWED_PROFILES,
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

function fixture(profileName = "original-v2") {
  const csvBytes = Buffer.from("predators-gear-reviewed-canonical-fixture\n", "utf8");
  const manifest = clone(reviewedManifest);
  manifest.canonical_csv.sha256 = sha256(csvBytes);
  const productionProfile = REVIEWED_PROFILES.find((profile) => profile.name === profileName);
  const selectedRows = manifest.rows.filter((row) => productionProfile.reviewRows.includes(row.review_row));
  const sourceRows = [];
  const plans = [];
  for (let index = 0; index < selectedRows.length; index += 1) {
    const reviewed = selectedRows[index];
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
        retailer: profileName === "remaining-6" ? {
          id: "13",
          name: "Predators Gear",
          slug: "predators-gear",
          website: "https://predatorsgear.co.uk/",
        } : null,
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
      retailer: profileName === "remaining-6" ? {
        action: "existing",
        id: "13",
      } : {
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
    if (index === 0 && profileName === "original-v2") fingerprint = FIRST_FINGERPRINT;
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
      retailer_id: profileName === "remaining-6" ? "13" : null,
      plan_kind: "feed",
      operation_type: "standard_import",
      resolved_plan: plan,
    });
  }
  const artifact = {
    artifact_version: "1",
    run_id: "predators-gear-fixture",
    created_at: "2026-08-26T20:33:05.758Z",
    source_file_name: path.basename(productionProfile.csvPath),
    source_file_sha256: sha256(csvBytes),
    row_count: String(selectedRows.length),
    source_rows: sourceRows,
    plans,
    blocked_rows: [],
    summary: {
      plan_count: String(selectedRows.length),
      blocked_row_count: "0",
      skipped_row_count: "0",
    },
    environment_marker: "local",
  };
  const loaded = {
    artifact,
    artifactPath: productionProfile.artifactPath,
    artifactSha256: "a".repeat(64),
  };
  const options = {
    artifact: productionProfile.artifactPath,
    csv: productionProfile.csvPath,
    planFingerprint: plans[0].plan_fingerprint,
  };
  const profile = {
    ...productionProfile,
    artifactSha256: loaded.artifactSha256,
    csvSha256: sha256(csvBytes),
    planFingerprints: plans.map((entry) => entry.plan_fingerprint),
    selectableFingerprints: plans.map((entry) => entry.plan_fingerprint),
  };
  return { artifact, csvBytes, loaded, manifest, options, configuration: { profile } };
}

function validate(value) {
  return validateApprovalScope(
    value.options,
    value.loaded,
    value.manifest,
    value.csvBytes,
    value.configuration
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

test("reviewed remaining-six profile is exact and its fixture validates", () => {
  const profile = REVIEWED_PROFILES.find((candidate) => candidate.name === "remaining-6");
  assert.equal(profile.artifactPath, REMAINING_ARTIFACT_PATH);
  assert.equal(profile.artifactSha256, "6353e4285db10fe160d0b8f2ffbdea61489606c86528dc2fa31aa79f57b0428c");
  assert.equal(profile.csvSha256, "c09ce429f62098bc341e0027d05556005718e5813b3fee13e4e6a2e3ce31adfb");
  assert.deepEqual(profile.reviewRows, [2, 6, 7, 8, 9, 10]);
  assert.deepEqual(profile.planFingerprints, [
    "d8e536e8361752e01a64672086af50dc",
    "78bd93523f61d5aef20b82cb4d74ecaa",
    "afaa55b519f266ed4eeb70a8db01a27f",
    "5c44cb1aa6dd494547a4fb28f99fc149",
    "36ad963f00982a936877dd2ffa2d67d4",
    "9885fc60773e83b34385dcd71908571b",
  ]);
  assert.deepEqual(profile.selectableFingerprints, profile.planFingerprints);
  const value = fixture("remaining-6");
  const prepared = validate(value);
  assert.equal(prepared.profile.retailerAction, "existing");
  assert.equal(prepared.profile.retailerId, "13");
  assert.equal(value.artifact.plans.length, 6);
});

test("remaining-six profile rejects wrong artifact SHA", () => {
  const value = fixture("remaining-6");
  value.loaded.artifactSha256 = "b".repeat(64);
  assert.throws(() => validate(value), /clean-run contract mismatch/);
});

test("remaining-six profile rejects wrong CSV SHA", () => {
  const value = fixture("remaining-6");
  value.csvBytes = Buffer.from("different reviewed CSV\n", "utf8");
  assert.throws(() => validate(value), /clean-run contract mismatch/);
});

test("remaining-six profile rejects retailer creation and retailer ID drift", () => {
  const createValue = fixture("remaining-6");
  createValue.artifact.plans[0].resolved_plan.retailer = {
    action: "create",
    values: { name: "Predators Gear", slug: "predators-gear", website: "https://predatorsgear.co.uk/" },
  };
  createValue.artifact.plans[0].resolved_plan.expected_state.retailer = null;
  assert.throws(() => validate(createValue), /Unsafe existing retailer plan/);

  const wrongIdValue = fixture("remaining-6");
  wrongIdValue.artifact.plans[0].retailer_id = "14";
  wrongIdValue.artifact.plans[0].resolved_plan.retailer.id = "14";
  wrongIdValue.artifact.plans[0].resolved_plan.expected_state.retailer.id = "14";
  assert.throws(() => validate(wrongIdValue), /Unsafe existing retailer plan/);
});

test("remaining-six profile rejects plans outside its fingerprints", () => {
  const value = fixture("remaining-6");
  const unknown = "f".repeat(32);
  value.artifact.plans[0].plan_fingerprint = unknown;
  value.artifact.plans[0].resolved_plan.meta.plan_fingerprint = unknown;
  value.artifact.source_rows[0].plan_fingerprint = unknown;
  assert.throws(() => validate(value), /reviewed fingerprint set/);
});

test("remaining-six profile rejects a Mass Gainer identity", () => {
  const value = fixture("remaining-6");
  const source = value.artifact.source_rows[0].normalized_source_row;
  source.external_product_id = "8594181609003";
  source.external_variant_id = "8594181609004";
  assert.throws(() => validate(value), /Unreviewed or duplicate artifact identity/);
});

test("remaining-six profile rejects Whey rows not targeting product 510", () => {
  const value = fixture("remaining-6");
  value.manifest.rows.find((row) => row.review_row === 6).product_id = 511;
  assert.throws(() => validate(value), /Whey review row 6 must target product 510/);
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
  assert.throws(() => validate(value), /not selectable|exactly one matching plan/);
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
    configuration: value.configuration,
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
