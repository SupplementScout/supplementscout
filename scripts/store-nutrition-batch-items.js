const fs = require("node:fs");
const { buildBatchItemRows, storeBatchItemRows } = require("./lib/nutrition-batch-items");
const { resolveInputInsideTmp } = require("./nutrition-ocr-canary");
const { createCandidateSupabase } = require("./store-nutrition-candidates");

function fail(message) {
  throw new Error(message);
}

function parseArgs(argv) {
  const options = {};
  for (const argument of argv) {
    if (argument.startsWith("--input=")) options.input = argument.slice(8);
    else if (argument.startsWith("--report=")) options.report = argument.slice(9);
    else if (argument.startsWith("--source-manifest=")) options.sourceManifest = argument.slice(18);
    else if (argument.startsWith("--run-id=")) options.runId = argument.slice(9);
    else if (argument === "--confirm-work-items-only=true") options.confirm = true;
    else fail(`Unknown option: ${argument}`);
  }
  if (!options.input || !options.report || !options.sourceManifest ||
      !/^[A-Za-z0-9._:-]{1,200}$/.test(options.runId || "") || !options.confirm) {
    fail("Required --input, --report, --source-manifest, --run-id and --confirm-work-items-only=true");
  }
  return options;
}

function readJsonInsideTmp(file, cwd) {
  const resolved = resolveInputInsideTmp(file, cwd);
  return JSON.parse(fs.readFileSync(resolved, "utf8"));
}

async function runCli(argv = process.argv.slice(2), dependencies = {}) {
  const options = parseArgs(argv);
  const cwd = dependencies.cwd || process.cwd();
  const input = readJsonInsideTmp(options.input, cwd);
  const report = readJsonInsideTmp(options.report, cwd);
  const sourceManifest = readJsonInsideTmp(options.sourceManifest, cwd);
  const rows = buildBatchItemRows(input, report, sourceManifest, options.runId);
  const supabase = dependencies.supabase || createCandidateSupabase();
  await storeBatchItemRows(rows, { supabase });
  return {
    mode: "BATCH_WORK_ITEMS_TABLE_WRITE_ONLY",
    destination: "nutrition_candidate_batch_items",
    run_id: options.runId,
    work_items: rows.length,
    candidate_rows: 0,
    product_updates: 0,
    verified_csv_files: 0,
  };
}

if (require.main === module) {
  runCli().then((result) => console.log(JSON.stringify(result, null, 2))).catch((error) => {
    console.error(error.message);
    process.exitCode = 1;
  });
}

module.exports = { parseArgs, readJsonInsideTmp, runCli };
