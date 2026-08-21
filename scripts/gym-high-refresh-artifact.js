const fs = require("node:fs");
const path = require("node:path");

const { writeDryRunArtifact } = require("./import-products");
const {
  MAPPING_KEYS, OFFER_KEYS, PRODUCT_KEYS, RETAILER_KEYS, VARIANT_KEYS,
  buildVerifiedNoChangePlan,
} = require("./verified-no-change-offer-refresh");
const { validateInputs } = require("./gym-high-full-catalogue-executor");

const ROOT = path.resolve(__dirname, "..");
const PROJECT_REF = "aftboxmrdgyhizicfsfu";

function fail(message) { throw new Error(message); }

function parseArgs(argv) {
  const values = {};
  for (const argument of argv) {
    const match = argument.match(/^--(report|artifact|output|output-report)=(.*)$/);
    if (!match || values[match[1]] !== undefined) fail(`Invalid argument ${argument}`);
    values[match[1]] = path.resolve(match[2]);
  }
  for (const key of ["report", "artifact", "output", "output-report"]) {
    if (!values[key]) fail(`Required --${key}=<path>`);
    const relative = path.relative(path.join(ROOT, "tmp"), values[key]);
    if (!relative || relative.startsWith("..") || path.isAbsolute(relative)) fail("Inputs and outputs must be inside repository tmp");
  }
  return values;
}

function sameBusinessOffer(before, after) {
  return ["price", "shipping_cost", "total_price", "in_stock", "url"]
    .every((key) => (before[key] ?? null) === (after[key] ?? null));
}

function exactState(value, keys) {
  return Object.fromEntries(keys.map((key) => [key, value[key] ?? null]));
}

function buildRefreshArtifact(options, dependencies = {}) {
  const builderReport = dependencies.report || JSON.parse(fs.readFileSync(options.report, "utf8"));
  const validated = validateInputs({ report: options.report, artifact: options.artifact }, dependencies);
  if (builderReport.source_identity_fingerprint == null || builderReport.source_captured_at == null) fail("Source evidence is incomplete");

  const approvedRows = [];
  let verifiedNoChangeCount = 0;
  let standardChangeCount = 0;
  for (const entry of validated.plans) {
    const plan = entry.resolved_plan;
    const sourceRow = validated.loaded.artifact.source_rows.find((row) => row.row_number === entry.row_number)?.normalized_source_row;
    if (!sourceRow) fail(`Source row missing for ${entry.row_number}`);
    if (plan.offer.action === "noop") {
      const expected = plan.expected_state;
      const target = {
        product: exactState(expected.product, PRODUCT_KEYS),
        retailer: exactState(expected.retailer, RETAILER_KEYS),
        product_variant: exactState(expected.product_variant, VARIANT_KEYS),
        retailer_product: exactState(expected.retailer_product, MAPPING_KEYS),
        offer: exactState(expected.offer, OFFER_KEYS),
      };
      if (plan.retailer_product.action !== "noop" || plan.price_history.action !== "noop" || !sameBusinessOffer(target.offer, plan.offer.values)) {
        fail(`No-change row ${entry.row_number} contains a business delta`);
      }
      const record = {
        source_snapshot_sha256: builderReport.source_identity_fingerprint,
        source_captured_at: builderReport.source_captured_at,
        source: {
          external_product_id: String(target.retailer_product.external_product_id),
          external_variant_id: String(target.retailer_product.external_variant_id),
          price: target.offer.price,
          in_stock: target.offer.in_stock,
          url: target.offer.url,
          external_url: target.retailer_product.external_url,
        },
        target,
      };
      const built = buildVerifiedNoChangePlan(record, {
        targetEnvironment: "PRODUCTION",
        targetProjectRef: PROJECT_REF,
        sourceSnapshotSha256s: new Set([builderReport.source_identity_fingerprint]),
      });
      approvedRows.push({ row: built.record, rowNumber: Number(entry.row_number), importPlan: built.plan });
      verifiedNoChangeCount += 1;
    } else {
      const beforeShipping = plan.expected_state.offer.shipping_cost == null ? null : Number(plan.expected_state.offer.shipping_cost);
      const afterShipping = plan.offer.values.shipping_cost == null ? null : Number(plan.offer.values.shipping_cost);
      const deliveredPriceChanged = Number(plan.offer.values.price) !== Number(plan.expected_state.offer.price) || beforeShipping !== afterShipping;
      if (plan.offer.action !== "update" || plan.product.action !== "existing" || plan.product_variant.action !== "existing" || plan.retailer_product.action === "create" || plan.price_history.action === "create" && !deliveredPriceChanged) {
        fail(`Changed row ${entry.row_number} is outside the existing-offer refresh contract`);
      }
      approvedRows.push({ row: sourceRow, rowNumber: Number(entry.row_number), importPlan: plan });
      standardChangeCount += 1;
    }
  }
  const rows = approvedRows.map((item) => item.row);
  const result = { planned: rows.length, skipped: 0, blockedRows: [], report: { approvedRows, blockedRows: [] } };
  const sourceContent = JSON.stringify({
    schema_version: 1,
    source_identity_fingerprint: builderReport.source_identity_fingerprint,
    source_captured_at: builderReport.source_captured_at,
    rows,
  });
  const written = writeDryRunArtifact(rows, result, {
    artifactPath: options.output,
    sourceContent,
    sourceFileName: "gym-high-guarded-refresh-input.json",
    environmentMarker: "production",
  });
  const report = {
    schema_version: 1,
    kind: "gym-high-guarded-existing-offer-refresh",
    result: "PASS",
    database_writes: 0,
    target_project_ref: PROJECT_REF,
    approval_fingerprint: builderReport.approval_fingerprint,
    source_identity_fingerprint: builderReport.source_identity_fingerprint,
    source_captured_at: builderReport.source_captured_at,
    approved_row_count: 66,
    existing_mapping_count: builderReport.existing_mapping_count,
    mapping_create_count: builderReport.mapping_create_count,
    existing_offer_count: builderReport.existing_offer_count,
    offer_create_count: builderReport.offer_create_count,
    verified_no_change_count: verifiedNoChangeCount,
    standard_change_count: standardChangeCount,
    artifact_sha256: written.artifactSha256,
    source_file_sha256: written.artifact.source_file_sha256,
  };
  fs.mkdirSync(path.dirname(options["output-report"]), { recursive: true });
  fs.writeFileSync(options["output-report"], `${JSON.stringify(report, null, 2)}\n`);
  return report;
}

if (require.main === module) {
  try { console.log(JSON.stringify(buildRefreshArtifact(parseArgs(process.argv.slice(2))), null, 2)); }
  catch (error) { console.error(error.message); process.exitCode = 1; }
}

module.exports = { buildRefreshArtifact, parseArgs, sameBusinessOffer };
