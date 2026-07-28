const crypto = require("node:crypto");
const fs = require("node:fs");
const path = require("node:path");
const { parse } = require("csv-parse/sync");
const approval = require("../config/retailers/six-pack-reviewed-family-batch-v1.json");

const ROOT = path.resolve(__dirname, "..");
const DEFAULT_CSV = path.join(
  ROOT,
  "tmp",
  "retailer-feeds",
  "six-pack-supplements",
  "six-pack-reviewed-family-21.csv"
);
const DEFAULT_REPORT = path.join(
  ROOT,
  "tmp",
  "retailer-feeds",
  "six-pack-supplements",
  "six-pack-reviewed-family-21-import-report-v5.json"
);
const DEFAULT_OUTPUT = path.join(
  ROOT,
  "tmp",
  "retailer-feeds",
  "six-pack-supplements",
  "six-pack-production-family-v3.json"
);

function fail(message) {
  throw new Error(message);
}

function sha256(value) {
  return crypto.createHash("sha256").update(value).digest("hex");
}

function parseArgs(argv) {
  const values = {};
  for (const argument of argv) {
    const match = argument.match(/^--(csv|report|output|approval|kind|csv-path)=(.*)$/);
    if (!match || values[match[1]]) fail(`Invalid argument ${argument}`);
    values[match[1]] = ["kind", "csv-path"].includes(match[1])
      ? match[2]
      : path.resolve(match[2]);
  }
  const options = {
    csv: values.csv || DEFAULT_CSV,
    report: values.report || DEFAULT_REPORT,
    output: values.output || DEFAULT_OUTPUT,
    approval: values.approval || null,
    kind: values.kind || "six-pack-production-family-v3",
    csvPath:
      values["csv-path"] ||
      "config/retailers/six-pack-production-family-v3.csv",
  };
  const relative = path.relative(path.join(ROOT, "tmp"), options.output);
  if (
    !relative ||
    relative.startsWith("..") ||
    path.isAbsolute(relative)
  ) {
    fail("Output must be inside repository tmp");
  }
  if (
    !["six-pack-production-family-v3", "six-pack-production-family-v6-bootstrap", "six-pack-production-expansion-v6", "six-pack-production-expansion-v7", "six-pack-production-expansion-v8"].includes(options.kind) ||
    !/^config\/retailers\/six-pack-production-[a-z0-9-]+\.csv$/.test(options.csvPath)
  ) {
    fail("Unsupported family rollout identity");
  }
  return options;
}

function build(csvBytes, report, approvalValue = approval, rolloutOptions = {}) {
  const rows = parse(csvBytes, {
    columns: true,
    skip_empty_lines: true,
    trim: true,
  });
  const approvedRows =
    approvalValue.rows ||
    approvalValue.families?.flatMap((family) =>
      family.variants.map((variant) => ({
        ...variant,
        product_id: family.product_id,
      }))
    ) ||
    [];
  const isLargeFamilyBatch =
    /^six-pack-reviewed-large-family-batch-v\d+$/.test(
      approvalValue.kind || ""
    );
  const coveredDuplicateAliases =
    approvalValue.kind === "six-pack-reviewed-large-family-batch-v7"
      ? [
          {
            approved_external_variant_id: "6315",
            existing_external_product_id: "6320",
            existing_external_variant_id: "6321",
            product_variant_id: "816",
          },
          {
            approved_external_variant_id: "6317",
            existing_external_product_id: "6320",
            existing_external_variant_id: "6322",
            product_variant_id: "815",
          },
        ]
      : [];
  const coveredIds = new Set(
    coveredDuplicateAliases.map(
      (row) => row.approved_external_variant_id
    )
  );
  const approvedIds = approvedRows
    .filter(
      (row) => !coveredIds.has(String(row.external_variant_id))
    )
    .map((row) => String(row.external_variant_id))
    .sort();
  const csvIds = rows
    .map((row) => String(row.external_variant_id))
    .sort();
  const plans = report.plans || [];
  const createVariantCount = plans.filter(
    (plan) => plan.product_variant?.action === "create_variant"
  ).length;
  const expectedVariantCreateCount =
    isLargeFamilyBatch
      ? 0
      : approvedRows.filter((row) => !row.product_variant_id).length;
  const resumedIds =
    approvalValue.kind === "six-pack-reviewed-large-family-batch-v7"
      ? new Set(["28846", "28849"])
      : new Set();
  const planActionsAreApproved = (plan) => {
    const externalVariantId = String(
      plan.retailer_product?.values?.external_variant_id || ""
    );
    const resumed = resumedIds.has(externalVariantId);
    return (
      plan.product?.action === "existing" &&
      ["existing", "create_variant"].includes(
        plan.product_variant?.action
      ) &&
      plan.retailer?.action === "existing" &&
      (resumed
        ? plan.retailer_product?.action === "noop" &&
          plan.offer?.action === "noop" &&
          plan.price_history?.action === "noop"
        : plan.retailer_product?.action === "create" &&
          plan.offer?.action === "create" &&
          plan.price_history?.action === "create")
    );
  };
  if (
    approvalValue.approved !== true ||
    !["six-pack-reviewed-family-batch-v1", "six-pack-reviewed-family-map-batch-v4", "six-pack-reviewed-family-map-batch-v5", "six-pack-reviewed-large-family-batch-v7", "six-pack-reviewed-large-family-batch-v8"].includes(approvalValue.kind) ||
    approvedRows.length !== rows.length + coveredDuplicateAliases.length ||
    JSON.stringify(csvIds) !== JSON.stringify(approvedIds) ||
    report.blockedRows?.length !== 0 ||
    report.failedRows?.length !== 0 ||
    plans.length !== rows.length ||
    createVariantCount !== expectedVariantCreateCount ||
    plans.some((plan) => !planActionsAreApproved(plan))
  ) {
    fail("Importer review is not the exact approved family rollout");
  }

  const expectedBindings = plans.map((plan) => {
    const mapping = plan.retailer_product.values;
    const offer = plan.offer.values;
    const createdVariant =
      plan.product_variant.action === "create_variant"
        ? plan.product_variant.values
        : null;
    return {
      external_product_id: String(mapping.external_product_id),
      external_variant_id: String(mapping.external_variant_id),
      product_id: String(plan.product.id),
      product_variant_id: createdVariant
        ? null
        : String(plan.product_variant.id),
      created_variant_identity: createdVariant,
      price: Number(offer.price).toFixed(2),
      shipping_cost: Number(offer.shipping_cost).toFixed(2),
      total_price: Number(offer.total_price).toFixed(2),
      in_stock: Boolean(offer.in_stock),
      external_url: offer.url,
    };
  });
  const rollout = {
    schema_version: 1,
    kind: rolloutOptions.kind || "six-pack-production-family-v3",
    approved: true,
    approval_source: approvalValue.approval_source,
    approved_at: approvalValue.approved_at,
    target_environment: "PRODUCTION",
    target_project_ref: "aftboxmrdgyhizicfsfu",
    retailer_slug: "6-pack-supplements",
    row_count: rows.length,
    ...(isLargeFamilyBatch
      ? {
          approved_scope_row_count: approvedRows.length,
          covered_duplicate_aliases: coveredDuplicateAliases,
          resumed_external_variant_ids: [...resumedIds].sort(),
        }
      : {}),
    expected_created_variant_count: createVariantCount,
    csv_path:
      rolloutOptions.csvPath ||
      "config/retailers/six-pack-production-family-v3.csv",
    csv_sha256: sha256(csvBytes),
    expected_external_variant_ids: approvedIds,
    expected_bindings: expectedBindings,
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
  return rollout;
}

function run(options) {
  const csvBytes = fs.readFileSync(options.csv);
  const report = JSON.parse(fs.readFileSync(options.report, "utf8"));
  const approvalValue = options.approval
    ? JSON.parse(fs.readFileSync(options.approval, "utf8"))
    : approval;
  const rollout = build(csvBytes, report, approvalValue, options);
  fs.mkdirSync(path.dirname(options.output), { recursive: true });
  fs.writeFileSync(
    options.output,
    `${JSON.stringify(rollout, null, 2)}\n`
  );
  return {
    result: "PASS",
    database_writes: 0,
    row_count: rollout.row_count,
    expected_created_variant_count:
      rollout.expected_created_variant_count,
    csv_sha256: rollout.csv_sha256,
    rollout_fingerprint: rollout.rollout_fingerprint,
    output: path.relative(ROOT, options.output),
  };
}

if (require.main === module) {
  try {
    console.log(JSON.stringify(run(parseArgs(process.argv.slice(2))), null, 2));
  } catch (error) {
    console.error(error.message);
    process.exitCode = 1;
  }
}

module.exports = { build, parseArgs };
