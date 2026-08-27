const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");
const reviewedManifest = require("../config/retailers/predators-gear-reviewed-bindings-v1.json");
const reviewedBatch2Manifest = require("../config/retailers/predators-gear-reviewed-bindings-v2.json");
const reviewedHeld4Manifest = require("../config/retailers/predators-gear-reviewed-bindings-v3-held-4.json");
const reviewedShadowhey3Manifest = require("../config/retailers/predators-gear-reviewed-bindings-v4-shadowhey-3.json");
const {
  BATCH2_ARTIFACT_PATH,
  BATCH2_CSV_PATH,
  EXPECTED_ARTIFACT_PATH,
  HELD_CM3_ARTIFACT_PATH,
  HELD_CM3_CSV_PATH,
  HELD_OLIMP_ARTIFACT_PATH,
  HELD_OLIMP_CSV_PATH,
  REMAINING_ARTIFACT_PATH,
  SHADOWHEY3_ARTIFACT_PATH,
  SHADOWHEY3_CSV_PATH,
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
  const productionProfile = REVIEWED_PROFILES.find((profile) => profile.name === profileName);
  const manifest = clone(
    profileName === "batch-2-safe-5"
      ? reviewedBatch2Manifest
      : profileName.startsWith("held-")
        ? reviewedHeld4Manifest
        : profileName === "shadowhey-3"
          ? reviewedShadowhey3Manifest
        : reviewedManifest
  );
  if (manifest.canonical_csv) manifest.canonical_csv.sha256 = sha256(csvBytes);
  const existingRetailer = productionProfile.retailerAction === "existing";
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
      external_options: reviewed.external_options ? JSON.stringify(reviewed.external_options) : "",
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
          ...(reviewed.canonical_variant ? { display_name: reviewed.canonical_variant } : {}),
          ...(reviewed.canonical_size_value != null ? { size_value: String(reviewed.canonical_size_value) } : {}),
          ...(reviewed.canonical_size_unit ? { size_unit: reviewed.canonical_size_unit } : {}),
          ...(reviewed.canonical_pack_count != null ? { pack_count: reviewed.canonical_pack_count } : {}),
          ...(reviewed.canonical_product_format ? { product_format: reviewed.canonical_product_format } : {}),
        },
        retailer: existingRetailer ? {
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
      retailer: existingRetailer ? {
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
          external_options: reviewed.external_options || null,
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
      retailer_id: existingRetailer ? "13" : null,
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
  if (profileName === "batch-2-safe-5") {
    manifest.execution_subset.csv_path = path.relative(ROOT, profile.csvPath).replaceAll("\\", "/");
    manifest.execution_subset.csv_sha256 = profile.csvSha256;
    manifest.execution_subset.artifact_path = path.relative(ROOT, profile.artifactPath).replaceAll("\\", "/");
    manifest.execution_subset.artifact_sha256 = profile.artifactSha256;
    manifest.execution_subset.plan_count = profile.planCount;
    manifest.execution_subset.blocked_row_count = 0;
    manifest.execution_subset.review_rows = [...profile.reviewRows];
    manifest.execution_subset.plan_fingerprints = [...profile.planFingerprints];
  } else if (profileName.startsWith("held-")) {
    const execution = manifest.execution_profiles[profile.executionKey];
    execution.csv_path = path.relative(ROOT, profile.csvPath).replaceAll("\\", "/");
    execution.csv_sha256 = profile.csvSha256;
    execution.artifact_path = path.relative(ROOT, profile.artifactPath).replaceAll("\\", "/");
    execution.artifact_sha256 = profile.artifactSha256;
    execution.plan_count = profile.planCount;
    execution.blocked_row_count = 0;
    execution.review_rows = [...profile.reviewRows];
    execution.plan_fingerprints = [...profile.planFingerprints];
  } else if (profileName === "shadowhey-3") {
    manifest.canonical_csv.path = path.relative(ROOT, profile.csvPath).replaceAll("\\", "/");
    manifest.canonical_csv.sha256 = profile.csvSha256;
    manifest.canonical_csv.row_count = profile.planCount;
    manifest.execution_profile.artifact_path = path.relative(ROOT, profile.artifactPath).replaceAll("\\", "/");
    manifest.execution_profile.artifact_sha256 = profile.artifactSha256;
    manifest.execution_profile.plan_count = profile.planCount;
    manifest.execution_profile.blocked_row_count = 0;
    manifest.execution_profile.plan_fingerprints = [...profile.planFingerprints];
  }
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

test("reviewed batch-two safe-five profile is exact and its fixture validates", () => {
  const profile = REVIEWED_PROFILES.find((candidate) => candidate.name === "batch-2-safe-5");
  assert.equal(profile.artifactPath, BATCH2_ARTIFACT_PATH);
  assert.equal(profile.artifactSha256, "0b9c9350dfc53c10d4769415c899ab88bff372cf784b273daaaa0cc92297440a");
  assert.equal(profile.csvPath, BATCH2_CSV_PATH);
  assert.equal(profile.csvSha256, "0ad4ccbdce0fa1cbdbebca24100e48f9c818d81e5527e438c4334c425269bf46");
  assert.deepEqual(profile.reviewRows, [3, 6, 7, 8, 9]);
  assert.deepEqual(profile.planFingerprints, [
    "a1344d6236e5396fc6dc9f80ce684a90",
    "713d3e09c0e20c8a5ba8edeb807c7f7f",
    "a0e5ec0f9cd1b3b426246cfce955fb03",
    "f6bbb3ad3a982ce6c8abc4a243503be4",
    "4380e5ad881ca58639905b9817ec8c55",
  ]);
  assert.deepEqual(profile.selectableFingerprints, profile.planFingerprints);
  const value = fixture("batch-2-safe-5");
  const prepared = validate(value);
  assert.equal(prepared.profile.retailerAction, "existing");
  assert.equal(prepared.profile.retailerId, "13");
  assert.equal(value.artifact.plans.length, 5);
  assert.ok(value.artifact.plans.every((entry) => entry.resolved_plan.product.action === "existing"));
  assert.ok(value.artifact.plans.every((entry) => entry.resolved_plan.product_variant.action === "existing"));
});

test("reviewed held Olimp and CM3 profiles are exact and validate independently", () => {
  const olimp = REVIEWED_PROFILES.find((profile) => profile.name === "held-olimp-exact-2");
  assert.equal(olimp.artifactPath, HELD_OLIMP_ARTIFACT_PATH);
  assert.equal(olimp.csvPath, HELD_OLIMP_CSV_PATH);
  assert.equal(olimp.artifactSha256, "b6928e1f5eaaae38538ca9e247586acd4e7c76b5199e851d4a285b79666c657d");
  assert.equal(olimp.csvSha256, "869684ebfe5c69d2877acb1f3b8f19f1a07b9686dd9b1c9a1a77fcdc03f6a232");
  assert.deepEqual(olimp.reviewRows, [1, 2]);
  assert.doesNotThrow(() => validate(fixture("held-olimp-exact-2")));

  const cm3 = REVIEWED_PROFILES.find((profile) => profile.name === "held-cm3-exact-2");
  assert.equal(cm3.artifactPath, HELD_CM3_ARTIFACT_PATH);
  assert.equal(cm3.csvPath, HELD_CM3_CSV_PATH);
  assert.equal(cm3.artifactSha256, "70885388f287729cfaaee00727ae49e88b5d171e21a3975199e840523255192d");
  assert.equal(cm3.csvSha256, "46ac92ccd8a7374b0b745f8335f9cb23073aa2970261cdd051b84193bbe16468");
  assert.deepEqual(cm3.reviewRows, [4, 5]);
  assert.doesNotThrow(() => validate(fixture("held-cm3-exact-2")));
});

test("reviewed Shadowhey three-plan profile is exact and validates", () => {
  const profile = REVIEWED_PROFILES.find((candidate) => candidate.name === "shadowhey-3");
  assert.equal(profile.artifactPath, SHADOWHEY3_ARTIFACT_PATH);
  assert.equal(profile.csvPath, SHADOWHEY3_CSV_PATH);
  assert.equal(profile.artifactSha256, "751800690204a1353ea66497c1bd50dd88b697b7c03a7c6afc08c3c04f8f904a");
  assert.equal(profile.csvSha256, "79fab41b82b334e7e275a820c2d0860b11c799cf96e3e72c47362d9420fdc717");
  assert.deepEqual(profile.reviewRows, [1, 2, 3]);
  assert.deepEqual(profile.planFingerprints, [
    "00ba9b685f3b81a2b8676f0ffe1a85dc",
    "db8d13fb0c59310089bff574369ec457",
    "65a26305967a0f1b8d47993a94820cb2",
  ]);
  const value = fixture("shadowhey-3");
  const prepared = validate(value);
  assert.equal(prepared.profile.retailerAction, "existing");
  assert.equal(prepared.profile.retailerId, "13");
  assert.equal(value.artifact.plans.length, 3);
  assert.ok(value.artifact.plans.every((entry) => entry.resolved_plan.product.id === "753"));
  assert.deepEqual(value.artifact.plans.map((entry) => entry.resolved_plan.product_variant.id), ["873", "876", "877"]);
});

test("Shadowhey profile rejects hash, retailer, target, and fingerprint drift", () => {
  const artifactSha = fixture("shadowhey-3");
  artifactSha.loaded.artifactSha256 = "b".repeat(64);
  assert.throws(() => validate(artifactSha), /clean-run contract mismatch/);

  const csvSha = fixture("shadowhey-3");
  csvSha.csvBytes = Buffer.from("different reviewed CSV\n", "utf8");
  assert.throws(() => validate(csvSha), /clean-run contract mismatch/);

  const retailer = fixture("shadowhey-3");
  retailer.artifact.plans[0].resolved_plan.retailer = { action: "create", values: {} };
  retailer.artifact.plans[0].resolved_plan.expected_state.retailer = null;
  assert.throws(() => validate(retailer), /Unsafe existing retailer plan/);

  const target = fixture("shadowhey-3");
  target.manifest.rows[0].product_variant_id = 875;
  assert.throws(() => validate(target), /manifest contract mismatch/);

  const fingerprint = fixture("shadowhey-3");
  fingerprint.manifest.execution_profile.plan_fingerprints[0] = "f".repeat(32);
  assert.throws(() => validate(fingerprint), /manifest contract mismatch/);
});

test("held profiles reject variant, exact options, profile scope and fingerprint drift", () => {
  const variant = fixture("held-olimp-exact-2");
  variant.manifest.rows.find((row) => row.review_row === 1).product_variant_id = 488;
  assert.throws(() => validate(variant), /manifest contract mismatch/);

  const options = fixture("held-cm3-exact-2");
  options.artifact.source_rows[1].normalized_source_row.external_options = JSON.stringify({ Size: "250g", Flavour: "Pineapple" });
  assert.throws(() => validate(options), /Unsafe Predators Gear plan/);

  const scope = fixture("held-cm3-exact-2");
  scope.manifest.execution_profiles.cm3_cross_product_parent.review_rows = [3, 5];
  assert.throws(() => validate(scope), /manifest contract mismatch/);

  const fingerprint = fixture("held-cm3-exact-2");
  fingerprint.manifest.execution_profiles.cm3_cross_product_parent.plan_fingerprints[0] = "f".repeat(32);
  assert.throws(() => validate(fingerprint), /manifest contract mismatch/);
});

test("batch-two profile rejects held rows and reviewed fingerprint drift", () => {
  const held = fixture("batch-2-safe-5");
  held.manifest.execution_subset.review_rows = [1, 3, 6, 7, 8];
  assert.throws(() => validate(held), /manifest contract mismatch/);

  const fingerprintDrift = fixture("batch-2-safe-5");
  fingerprintDrift.manifest.execution_subset.plan_fingerprints[0] = "f".repeat(32);
  assert.throws(() => validate(fingerprintDrift), /manifest contract mismatch/);
});

test("batch-two profile rejects wrong artifact SHA, CSV SHA, and retailer drift", () => {
  const artifactSha = fixture("batch-2-safe-5");
  artifactSha.loaded.artifactSha256 = "b".repeat(64);
  assert.throws(() => validate(artifactSha), /clean-run contract mismatch/);

  const csvSha = fixture("batch-2-safe-5");
  csvSha.csvBytes = Buffer.from("different reviewed CSV\n", "utf8");
  assert.throws(() => validate(csvSha), /clean-run contract mismatch/);

  const retailer = fixture("batch-2-safe-5");
  retailer.artifact.plans[0].retailer_id = "14";
  retailer.artifact.plans[0].resolved_plan.retailer.id = "14";
  retailer.artifact.plans[0].resolved_plan.expected_state.retailer.id = "14";
  assert.throws(() => validate(retailer), /Unsafe existing retailer plan/);
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
