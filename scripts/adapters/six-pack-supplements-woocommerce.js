const fs = require("node:fs");
const path = require("node:path");
const { parseWooCommerceCsv } = require("../lib/woocommerce-csv-reader");
const config = require("../../config/retailers/six-pack-supplements-woocommerce.json");

const ROOT = path.resolve(__dirname, "../..");
const DEFAULT_OUTPUT_DIR = path.join(ROOT, "tmp", "retailer-feeds", "six-pack-supplements");

function fail(message) {
  throw new Error(message);
}

function parseArgs(argv) {
  const result = {};
  for (const argument of argv) {
    const match = argument.match(/^--([^=]+)=(.*)$/);
    if (!match || result[match[1]] !== undefined) fail(`Invalid argument ${argument}`);
    if (!["csv", "output-dir", "captured-at"].includes(match[1])) fail(`Unknown argument ${argument}`);
    result[match[1]] = match[2];
  }
  if (!result.csv) fail("Required --csv=<WooCommerce export>");
  result.csv = path.resolve(result.csv);
  result.outputDir = result["output-dir"] ? path.resolve(result["output-dir"]) : DEFAULT_OUTPUT_DIR;
  result.capturedAt = result["captured-at"] || new Date().toISOString();
  const relative = path.relative(path.join(ROOT, "tmp"), result.outputDir);
  if (!relative || relative.startsWith("..") || path.isAbsolute(relative)) {
    fail("Output directory must be inside repository tmp");
  }
  return result;
}

function validateConfig(value) {
  if (value.schema_version !== 1) fail("Unsupported 6 Pack config schema version");
  if (
    value.retailer?.slug !== "6-pack-supplements" ||
    value.retailer?.website !== "https://6pack-supplements.co.uk"
  ) fail("Unexpected 6 Pack retailer identity");
  if (!/^[0-9A-F]{64}$/.test(value.source?.baseline_sha256 || "")) fail("Missing source baseline SHA-256");
  if (
    value.category_policy?.permanently_excluded?.includes("SARMs") !== true ||
    value.category_policy?.permanently_excluded?.includes("Peptides") !== true ||
    value.guardrails?.catalogue_creates !== false ||
    value.guardrails?.discovery_mode !== "REPORT_ONLY"
  ) fail("Unsafe 6 Pack policy config");
  return value;
}

function healthReport(snapshot, value = config) {
  const baseline = value.source;
  const rowRatio = snapshot.counts.csv_rows / baseline.baseline_csv_rows;
  const variantRatio = snapshot.counts.variation_rows / baseline.baseline_variations;
  const observedRatio = Math.min(rowRatio, variantRatio);
  let result = "PASS";
  let code = null;
  if (observedRatio < baseline.genuine_collapse_ratio) {
    result = "BLOCK";
    code = "GENUINE_SOURCE_COLLAPSE";
  } else if (observedRatio < baseline.minimum_count_ratio) {
    result = "BLOCK";
    code = "SOURCE_DEGRADED";
  }
  return {
    result,
    code,
    baseline_csv_rows: baseline.baseline_csv_rows,
    actual_csv_rows: snapshot.counts.csv_rows,
    baseline_variations: baseline.baseline_variations,
    actual_variations: snapshot.counts.variation_rows,
    row_ratio: rowRatio,
    variation_ratio: variantRatio,
    observed_ratio: observedRatio,
    minimum_count_ratio: baseline.minimum_count_ratio,
    genuine_collapse_ratio: baseline.genuine_collapse_ratio,
  };
}

function countBy(rows, field) {
  return Object.fromEntries(
    [...rows.reduce((counts, row) => counts.set(row[field], (counts.get(row[field]) || 0) + 1), new Map())]
      .sort(([left], [right]) => String(left).localeCompare(String(right)))
  );
}

function buildReport(snapshot, sourcePath, value = config) {
  const health = healthReport(snapshot, value);
  const sourceMatchesBaseline = snapshot.source_sha256.toUpperCase() === value.source.baseline_sha256;
  return {
    schema_version: 1,
    retailer: value.retailer,
    mode: "READ_ONLY",
    database_writes: 0,
    captured_at: snapshot.captured_at,
    source: {
      file_name: path.basename(sourcePath),
      sha256: snapshot.source_sha256,
      baseline_sha256: value.source.baseline_sha256.toLowerCase(),
      baseline_match: sourceMatchesBaseline,
      raw_file_copied_to_repository: false,
    },
    health,
    counts: snapshot.counts,
    policy_counts: countBy(snapshot.records, "policy_code"),
    issue_counts: countBy(snapshot.issues, "code"),
    eligible_identity_count: new Set(
      snapshot.records
        .filter((row) => row.policy_state === "ELIGIBLE")
        .map((row) => row.immutable_source_identity)
    ).size,
    unique_external_product_count: new Set(snapshot.records.map((row) => row.external_product_id)).size,
    source_snapshot_fingerprint: snapshot.snapshot_fingerprint,
    next_gate: health.result === "PASS"
      ? "READ_ONLY_CANONICAL_MATCHING"
      : "BLOCKED_SOURCE_REVIEW",
  };
}

function atomicWrite(filePath, value) {
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  const temporary = `${filePath}.${process.pid}.${Date.now()}.tmp`;
  fs.writeFileSync(temporary, value);
  fs.renameSync(temporary, filePath);
}

function run(options) {
  validateConfig(config);
  if (!fs.existsSync(options.csv)) fail(`CSV does not exist: ${options.csv}`);
  const bytes = fs.readFileSync(options.csv);
  const snapshot = parseWooCommerceCsv(bytes, {
    capturedAt: options.capturedAt,
    storeUrl: config.retailer.website,
  });
  const report = buildReport(snapshot, options.csv, config);
  if (report.health.result !== "PASS") fail(`${report.health.code}: source snapshot is unsafe`);
  const snapshotPath = path.join(options.outputDir, "six-pack-source-snapshot.json");
  const reportPath = path.join(options.outputDir, "six-pack-adapter-report.json");
  atomicWrite(snapshotPath, `${JSON.stringify(snapshot, null, 2)}\n`);
  atomicWrite(reportPath, `${JSON.stringify(report, null, 2)}\n`);
  return { snapshot, report, snapshotPath, reportPath };
}

function main(argv = process.argv.slice(2)) {
  const options = parseArgs(argv);
  const result = run(options);
  console.log(JSON.stringify({
    result: result.report.health.result,
    database_writes: 0,
    source_sha256: result.report.source.sha256,
    counts: result.report.counts,
    policy_counts: result.report.policy_counts,
    issue_counts: result.report.issue_counts,
    next_gate: result.report.next_gate,
    outputs: [result.snapshotPath, result.reportPath].map((file) => path.relative(ROOT, file)),
  }, null, 2));
}

if (require.main === module) {
  try {
    main();
  } catch (error) {
    console.error(error.message);
    process.exitCode = 1;
  }
}

module.exports = {
  DEFAULT_OUTPUT_DIR,
  atomicWrite,
  buildReport,
  healthReport,
  main,
  parseArgs,
  run,
  validateConfig,
};
