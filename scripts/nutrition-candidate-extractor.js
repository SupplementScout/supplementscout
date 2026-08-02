const fs = require("node:fs");
const path = require("node:path");
const {
  buildArtifact,
  writeArtifactFiles,
} = require("./lib/nutrition-candidates");

function fail(message) {
  throw new Error(message);
}

function positiveIds(values, label) {
  const ids = values.flatMap((value) => value.split(","))
    .map((value) => value.trim())
    .filter(Boolean);
  if (ids.some((value) => !/^[1-9][0-9]*$/.test(value))) {
    fail(`${label} values must be positive integer strings`);
  }
  return [...new Set(ids)];
}

function parseArgs(argv) {
  const values = { productIds: [], retailerIds: [] };
  for (const argument of argv) {
    if (argument === "--offline") values.offline = true;
    else if (argument === "--help") values.help = true;
    else if (argument.startsWith("--input=")) values.input = argument.slice("--input=".length);
    else if (argument.startsWith("--output-dir=")) values.outputDirectory = argument.slice("--output-dir=".length);
    else if (argument.startsWith("--product-id=")) values.productIds.push(argument.slice("--product-id=".length));
    else if (argument.startsWith("--retailer-id=")) values.retailerIds.push(argument.slice("--retailer-id=".length));
    else if (argument === "--confirm-candidates-only=true") values.confirmCandidatesOnly = true;
    else fail(`Unknown option: ${argument}`);
  }
  if (values.help) return values;
  if (!values.offline) fail("Required safety flag: --offline");
  if (!values.confirmCandidatesOnly) fail("Required safety flag: --confirm-candidates-only=true");
  if (!values.input) fail("Required option: --input=<offline-manifest.json>");
  values.productIds = positiveIds(values.productIds, "--product-id");
  values.retailerIds = positiveIds(values.retailerIds, "--retailer-id");
  values.outputDirectory = values.outputDirectory || path.join("tmp", "nutrition-candidates");
  return values;
}

function assertOutputInsideTmp(outputDirectory, cwd = process.cwd()) {
  const tmpRoot = path.resolve(cwd, "tmp");
  const output = path.resolve(cwd, outputDirectory);
  const relative = path.relative(tmpRoot, output);
  if (relative.startsWith("..") || path.isAbsolute(relative)) {
    fail("Candidate output must remain inside the repository tmp directory");
  }
  return output;
}

function usage() {
  return [
    "Offline Nutrition Candidate Extractor",
    "",
    "Usage:",
    "  node scripts/nutrition-candidate-extractor.js --offline --confirm-candidates-only=true --input=<manifest.json> [--product-id=<id>] [--retailer-id=<id>] [--output-dir=tmp/nutrition-candidates]",
    "",
    "Safety boundary:",
    "  Reads local snapshots only. Performs no network requests and no database writes.",
    "  Output is review-only CSV/JSON and never sets verification flags.",
  ].join("\n");
}

function loadManifest(file) {
  const resolved = path.resolve(file);
  const bytes = fs.readFileSync(resolved);
  let manifest;
  try {
    manifest = JSON.parse(bytes.toString("utf8"));
  } catch {
    fail("Input manifest is not valid JSON");
  }
  return { resolved, bytes, manifest };
}

function runCli(argv = process.argv.slice(2), dependencies = {}) {
  const options = parseArgs(argv);
  if (options.help) return { help: true, output: usage() };
  const loaded = loadManifest(options.input);
  const artifact = buildArtifact({
    manifest: loaded.manifest,
    manifestBytes: loaded.bytes,
    manifestPath: loaded.resolved,
    filters: {
      product_ids: options.productIds,
      retailer_ids: options.retailerIds,
    },
  });
  const cwd = dependencies.cwd || process.cwd();
  const outputDirectory = assertOutputInsideTmp(options.outputDirectory, cwd);
  const files = writeArtifactFiles(artifact, outputDirectory, path.resolve(cwd, "tmp"));
  return { artifact, files };
}

if (require.main === module) {
  try {
    const result = runCli();
    if (result.help) {
      console.log(result.output);
    } else {
      console.log(JSON.stringify({
        status: result.artifact.status,
        mode: result.artifact.mode,
        run_id: result.artifact.run_id,
        summary: result.artifact.summary,
        json: path.relative(process.cwd(), result.files.jsonPath).replaceAll("\\", "/"),
        csv: path.relative(process.cwd(), result.files.csvPath).replaceAll("\\", "/"),
        artifact_fingerprint: result.artifact.artifact_fingerprint,
      }, null, 2));
    }
  } catch (error) {
    console.error(`${error.code ? `${error.code}: ` : ""}${error.message}`);
    process.exit(1);
  }
}

module.exports = {
  assertOutputInsideTmp,
  loadManifest,
  parseArgs,
  positiveIds,
  runCli,
  usage,
};
