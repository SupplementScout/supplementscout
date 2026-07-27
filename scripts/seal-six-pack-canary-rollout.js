const crypto = require("node:crypto");
const fs = require("node:fs");
const path = require("node:path");

const ROOT = path.resolve(__dirname, "..");
const SOURCE_DIR = path.join(ROOT, "tmp", "retailer-feeds", "six-pack-supplements");
const SOURCE_CSV = path.join(SOURCE_DIR, "six-pack-canary-approved-6.csv");
const SOURCE_MANIFEST = path.join(SOURCE_DIR, "six-pack-canary-approved-6-manifest.json");
const OUTPUT_CSV = path.join(ROOT, "config", "retailers", "six-pack-production-canary-v1.csv");
const OUTPUT_MANIFEST = path.join(ROOT, "config", "retailers", "six-pack-production-canary-v1.json");
const EXPECTED_CSV_SHA256 = "28bd98642e0c6dd04e98622e9a10245e898a7d41226a2ba45401e85118dc8281";

function sha256(value) {
  return crypto.createHash("sha256").update(value).digest("hex");
}

function seal() {
  const csv = fs.readFileSync(SOURCE_CSV);
  const sourceManifest = JSON.parse(fs.readFileSync(SOURCE_MANIFEST, "utf8"));
  if (
    sha256(csv) !== EXPECTED_CSV_SHA256 ||
    sourceManifest.csv_sha256 !== EXPECTED_CSV_SHA256 ||
    sourceManifest.row_count !== 6 ||
    sourceManifest.approved !== false ||
    sourceManifest.database_writes !== 0 ||
    sourceManifest.target_environment !== "PRODUCTION" ||
    sourceManifest.target_project_ref !== "aftboxmrdgyhizicfsfu"
  ) {
    throw new Error("Local canary does not match the explicitly approved six-row artifact");
  }
  const rollout = {
    schema_version: 1,
    kind: "six-pack-production-canary-v1",
    approved: true,
    approval_source: "USER_EXPLICIT_CHAT_CONFIRMATION",
    approved_at: "2026-07-27",
    target_environment: "PRODUCTION",
    target_project_ref: "aftboxmrdgyhizicfsfu",
    retailer_slug: "6-pack-supplements",
    row_count: 6,
    csv_path: "config/retailers/six-pack-production-canary-v1.csv",
    csv_sha256: EXPECTED_CSV_SHA256,
    source_snapshot_fingerprint: sourceManifest.source_snapshot_fingerprint,
    source_manifest_fingerprint: sourceManifest.manifest_fingerprint,
    expected_external_variant_ids: sourceManifest.rows.map((row) => String(row.external_variant_id)).sort(),
    expected_bindings: sourceManifest.rows.map((row) => ({
      external_product_id: String(row.external_product_id),
      external_variant_id: String(row.external_variant_id),
      product_id: String(row.product_id),
      product_variant_id: String(row.product_variant_id),
      price: String(row.price),
      in_stock: String(row.in_stock) === "true",
      external_url: row.external_url,
    })).sort((left, right) => left.external_variant_id.localeCompare(right.external_variant_id)),
    database_writes_before_execution: 0,
    execution: {
      mode: "PROTECTED_GITHUB_ACTIONS_ONLY",
      approval_role: "retailer_catalogue_production_approver",
      executor_role: "retailer_catalogue_production_executor",
      direct_csv_writes: false,
      post_apply_idempotency_required: true,
    },
    rollout_fingerprint: null,
  };
  rollout.rollout_fingerprint = sha256(JSON.stringify(rollout));
  fs.writeFileSync(OUTPUT_CSV, csv, { flag: "wx" });
  fs.writeFileSync(OUTPUT_MANIFEST, `${JSON.stringify(rollout, null, 2)}\n`, { flag: "wx" });
  return rollout;
}

if (require.main === module) {
  try {
    const rollout = seal();
    console.log(JSON.stringify({
      result: "SEALED",
      approved: rollout.approved,
      row_count: rollout.row_count,
      csv_sha256: rollout.csv_sha256,
      rollout_fingerprint: rollout.rollout_fingerprint,
    }, null, 2));
  } catch (error) {
    console.error(error.message);
    process.exitCode = 1;
  }
}

module.exports = { EXPECTED_CSV_SHA256, seal, sha256 };
