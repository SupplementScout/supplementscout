const crypto = require("node:crypto");
const fs = require("node:fs");
const path = require("node:path");
const dotenv = require("dotenv");
const { createClient } = require("@supabase/supabase-js");
const approval = require("../config/retailers/six-pack-reviewed-family-batch-v1.json");
const rollout = require("../config/retailers/six-pack-production-family-v3.json");

const ROOT = path.resolve(__dirname, "..");
const PROJECT_REF = "aftboxmrdgyhizicfsfu";

function fail(message) {
  throw new Error(message);
}

function sha256(value) {
  return crypto.createHash("sha256").update(value).digest("hex");
}

function normalize(value) {
  return String(value || "")
    .toLowerCase()
    .replace(/&/g, " and ")
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

function parseArgs(argv) {
  if (
    argv.length !== 1 ||
    !argv[0].startsWith("--output=")
  ) {
    fail("Required --output=<tmp path>");
  }
  const output = path.resolve(argv[0].slice("--output=".length));
  const relative = path.relative(path.join(ROOT, "tmp"), output);
  if (
    !relative ||
    relative.startsWith("..") ||
    path.isAbsolute(relative)
  ) {
    fail("Output must be inside repository tmp");
  }
  return { output };
}

function assertSealedContract() {
  const fingerprint = sha256(
    JSON.stringify({ ...rollout, rollout_fingerprint: null })
  );
  const reviewedCreateIds = approval.rows
    .filter((row) => !row.product_variant_id)
    .map((row) => row.external_variant_id)
    .sort();
  const rolloutCreateIds = rollout.expected_bindings
    .filter((row) => row.product_variant_id === null)
    .map((row) => row.external_variant_id)
    .sort();
  if (
    approval.approved !== true ||
    approval.rows.length !== 21 ||
    reviewedCreateIds.length !== 14 ||
    rollout.approved !== true ||
    rollout.kind !== "six-pack-production-family-v3" ||
    rollout.target_project_ref !== PROJECT_REF ||
    rollout.expected_created_variant_count !== 14 ||
    rollout.rollout_fingerprint !== fingerprint ||
    JSON.stringify(reviewedCreateIds) !==
      JSON.stringify(rolloutCreateIds)
  ) {
    fail("Reviewed family variant bootstrap contract mismatch");
  }
}

function intendedVariants() {
  assertSealedContract();
  return rollout.expected_bindings
    .filter((binding) => binding.product_variant_id === null)
    .map((binding) => ({
      product_id: Number(binding.product_id),
      ...binding.created_variant_identity,
      size_value: Number(binding.created_variant_identity.size_value),
      pack_count: Number(binding.created_variant_identity.pack_count),
      gtin: null,
      image: null,
      nutrition_override: {},
      is_default: false,
      is_active: true,
    }));
}

function semanticKey(row) {
  return [
    String(row.product_id),
    normalize(row.flavour_code || row.flavour_label),
    Number(row.size_value),
    String(row.size_unit || "").toLowerCase(),
    Number(row.pack_count || 1),
  ].join(":");
}

function classifyState(existing, intended) {
  const exactBySemanticKey = new Map(
    existing
      .filter((row) => row.is_active !== false)
      .map((row) => [semanticKey(row), row])
  );
  const matches = intended.map((row) =>
    exactBySemanticKey.get(semanticKey(row))
  );
  const count = matches.filter(Boolean).length;
  if (count === 0) return { state: "EMPTY", matches: [] };
  if (count !== intended.length) {
    fail("Reviewed family variant bootstrap found a partial canonical state");
  }
  for (let index = 0; index < intended.length; index += 1) {
    const expected = intended[index];
    const actual = matches[index];
    if (
      actual.variant_key !== expected.variant_key ||
      actual.display_name !== expected.display_name ||
      normalize(actual.flavour_code) !== normalize(expected.flavour_code) ||
      normalize(actual.flavour_label) !== normalize(expected.flavour_label) ||
      String(actual.product_format || "") !==
        String(expected.product_format || "") ||
      actual.is_default !== false ||
      actual.is_active !== true
    ) {
      fail("Reviewed family variant bootstrap found canonical identity drift");
    }
  }
  return { state: "COMPLETE", matches };
}

function client() {
  dotenv.config({ path: path.join(ROOT, ".env.local"), quiet: true });
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (
    !url ||
    !key ||
    new URL(url).hostname.split(".")[0] !== PROJECT_REF
  ) {
    fail("Production service credential mismatch");
  }
  return createClient(url, key, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

async function run(options, dependencies = {}) {
  if (
    process.env.GITHUB_ACTIONS !== "true" ||
    process.env.GITHUB_REF !== "refs/heads/main"
  ) {
    fail("Variant bootstrap is restricted to GitHub Actions on main");
  }
  const intended = intendedVariants();
  const productIds = [...new Set(intended.map((row) => row.product_id))];
  const db = dependencies.client || client();
  const productResult = await db
    .from("products")
    .select("id,is_active,merged_into_product_id")
    .in("id", productIds);
  if (productResult.error) throw productResult.error;
  if (
    productResult.data.length !== productIds.length ||
    productResult.data.some(
      (row) => row.is_active !== true || row.merged_into_product_id != null
    )
  ) {
    fail("Variant bootstrap requires exact active unmerged canonical products");
  }
  const existingResult = await db
    .from("product_variants")
    .select(
      "id,product_id,variant_key,display_name,flavour_code,flavour_label,size_value,size_unit,pack_count,product_format,is_active,is_default"
    )
    .in("product_id", productIds);
  if (existingResult.error) throw existingResult.error;
  let classification = classifyState(existingResult.data, intended);
  let inserted = [];
  if (classification.state === "EMPTY") {
    const insertResult = await db
      .from("product_variants")
      .insert(intended)
      .select(
        "id,product_id,variant_key,display_name,flavour_code,flavour_label,size_value,size_unit,pack_count,product_format,is_active,is_default"
      );
    if (insertResult.error) throw insertResult.error;
    inserted = insertResult.data || [];
    classification = classifyState(inserted, intended);
    if (classification.state !== "COMPLETE") {
      fail("Atomic variant bootstrap post-insert verification failed");
    }
  }
  const report = {
    schema_version: 1,
    kind: "six-pack-family-variant-bootstrap",
    target_project_ref: PROJECT_REF,
    rollout_fingerprint: rollout.rollout_fingerprint,
    result: "PASS",
    initial_state:
      inserted.length > 0 ? "EMPTY" : classification.state,
    inserted_variant_count: inserted.length,
    verified_variant_count: classification.matches.length,
    variant_ids: classification.matches
      .map((row) => String(row.id))
      .sort((left, right) => Number(left) - Number(right)),
    completed_at: new Date().toISOString(),
  };
  fs.mkdirSync(path.dirname(options.output), { recursive: true });
  fs.writeFileSync(options.output, `${JSON.stringify(report, null, 2)}\n`);
  return report;
}

if (require.main === module) {
  run(parseArgs(process.argv.slice(2)))
    .then((report) => console.log(JSON.stringify(report, null, 2)))
    .catch((error) => {
      console.error(error.message);
      process.exitCode = 1;
    });
}

module.exports = {
  classifyState,
  intendedVariants,
  parseArgs,
  semanticKey,
};
