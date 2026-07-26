const crypto = require("node:crypto");
const fs = require("node:fs");
const path = require("node:path");
const { fingerprint } = require("./lib/retailer-offer-sync/artifacts");
const {
  validateReviewedManifest,
} = require("./lib/reviewed-variant-nutrition");

const ROOT = path.resolve(__dirname, "..");
const INPUT = path.join(
  ROOT,
  "tmp",
  "nutrition-data",
  "priority-batch-1-candidates.json",
);
const OUTPUT = path.join(
  ROOT,
  "data",
  "verified",
  "variant-nutrition-reviewed-batch-1.json",
);
const INPUT_SHA256 =
  "ad7b58ed937ad77074046fec42b16fa85728b89d78d38cc6a227062449495448";

function invariant(value, message) {
  if (!value) throw new Error(message);
}

function sha256(value) {
  return crypto.createHash("sha256").update(value).digest("hex");
}

function build(inputBytes) {
  invariant(sha256(inputBytes) === INPUT_SHA256, "candidate manifest SHA-256 mismatch");
  const candidate = JSON.parse(inputBytes.toString("utf8"));
  invariant(
    candidate.schema_version === 1 &&
      candidate.status === "CANDIDATE_REQUIRES_REVIEW" &&
      candidate.mode === "READ_ONLY" &&
      candidate.summary?.products === 3 &&
      candidate.summary?.variant_changes === 16 &&
      candidate.summary?.business_writes === 0 &&
      candidate.summary?.control_plane_writes === 0,
    "candidate manifest identity mismatch",
  );
  invariant(
    Array.isArray(candidate.scope?.changes) &&
      candidate.scope.changes.length === 16,
    "candidate scope mismatch",
  );
  const changes = candidate.scope.changes
    .map((row) => {
      const after = {
        ...row.proposed_nutrition_override,
        creatine_per_serving_g:
          row.proposed_nutrition_override.creatine_per_serving_g ?? null,
      };
      return {
        product_id: row.product_id,
        expected_product_name: row.expected_product_name,
        variant_id: row.variant_id,
        expected_variant_key: row.expected_variant_key,
        expected_display_name: row.expected_display_name,
        before_nutrition_override: row.current_nutrition_override,
        after_nutrition_override: after,
        source_url: row.source_url,
        evidence: row.evidence,
      };
    })
    .sort((left, right) =>
      BigInt(left.variant_id) < BigInt(right.variant_id) ? -1 : 1,
    );
  const manifest = {
    schema_version: 1,
    kind: "reviewed-product-variant-nutrition-manifest-v1",
    status: "REVIEWED",
    authorized_by: "user-approved-nutrition-enrichment",
    authorized_at: "2026-07-26T18:00:00.000Z",
    source_policy:
      "Manufacturer product pages are authoritative. WheyWise was used only for discovery and second-source comparison.",
    reviewed_scope_hash: fingerprint(changes),
    changes,
  };
  validateReviewedManifest(manifest);
  return `${JSON.stringify(manifest, null, 2)}\n`;
}

function main() {
  const output = build(fs.readFileSync(INPUT));
  if (fs.existsSync(OUTPUT)) {
    invariant(fs.readFileSync(OUTPUT, "utf8") === output, "immutable reviewed manifest differs");
  } else {
    fs.writeFileSync(OUTPUT, output, { flag: "wx" });
  }
  console.log(JSON.stringify({
    status: "PASS",
    candidate_manifest_sha256: INPUT_SHA256,
    reviewed_manifest: path.relative(ROOT, OUTPUT).replaceAll("\\", "/"),
    reviewed_manifest_sha256: sha256(Buffer.from(output)),
    reviewed_scope_hash: JSON.parse(output).reviewed_scope_hash,
    products: 3,
    variant_changes: 16,
    database_writes: 0,
  }, null, 2));
}

if (require.main === module) main();

module.exports = { build };
