const fs = require("node:fs");
const path = require("node:path");
const {
  MAX_CANARY_PRODUCTS,
  buildDryPlan,
  runCanary,
} = require("./lib/nutrition-ocr");

function fail(message) {
  throw new Error(message);
}

function parseArgs(argv) {
  const options = {};
  for (const argument of argv) {
    if (argument === "--dry-plan") options.dryPlan = true;
    else if (argument === "--canary") options.canary = true;
    else if (argument === "--confirm-official-pages-only=true") options.officialPagesOnly = true;
    else if (argument === "--confirm-local-candidate-only=true") options.localCandidateOnly = true;
    else if (argument.startsWith("--input=")) options.input = argument.slice("--input=".length);
    else if (argument.startsWith("--max-products=")) options.maxProducts = Number(argument.slice("--max-products=".length));
    else if (argument === "--help") options.help = true;
    else fail(`Unknown option: ${argument}`);
  }
  if (options.help) return options;
  if (Boolean(options.dryPlan) === Boolean(options.canary)) fail("Choose exactly one of --dry-plan or --canary");
  if (!options.input) fail("Required option: --input=<tmp/.../pages.json>");
  if (options.canary && (!options.officialPagesOnly || !options.localCandidateOnly)) {
    fail("OCR canary requires --confirm-official-pages-only=true and --confirm-local-candidate-only=true");
  }
  if (options.maxProducts !== undefined && (!Number.isInteger(options.maxProducts) ||
      options.maxProducts < 1 || options.maxProducts > MAX_CANARY_PRODUCTS)) {
    fail(`--max-products must be an integer from 1 to ${MAX_CANARY_PRODUCTS}`);
  }
  return options;
}

function resolveInputInsideTmp(file, cwd = process.cwd()) {
  const tmpRoot = fs.realpathSync.native(path.resolve(cwd, "tmp"));
  const resolved = fs.realpathSync.native(path.resolve(cwd, file));
  const relative = path.relative(tmpRoot, resolved);
  if (relative.startsWith("..") || path.isAbsolute(relative) || !fs.statSync(resolved).isFile()) {
    fail("OCR page manifest must be a file inside repository tmp/");
  }
  if (fs.statSync(resolved).size > 1_000_000) fail("OCR page manifest exceeds 1 MB");
  return resolved;
}

function usage() {
  return [
    "Nutrition Candidate OCR Canary",
    "",
    "Network-free dry plan:",
    "  node scripts/nutrition-ocr-canary.js --dry-plan --input=tmp/nutrition-ocr-batch-1/pages.json",
    "",
    "Local official-page canary:",
    "  node scripts/nutrition-ocr-canary.js --canary --confirm-official-pages-only=true --confirm-local-candidate-only=true --input=tmp/nutrition-ocr-batch-1/pages.json --max-products=5",
  ].join("\n");
}

async function runCli(argv = process.argv.slice(2), dependencies = {}) {
  const options = parseArgs(argv);
  if (options.help) return { help: true, output: usage() };
  const cwd = dependencies.cwd || process.cwd();
  const inputPath = resolveInputInsideTmp(options.input, cwd);
  let input;
  try {
    input = JSON.parse(fs.readFileSync(inputPath, "utf8"));
  } catch {
    fail("OCR page manifest is not valid JSON");
  }
  if (options.dryPlan) return { help: false, plan: buildDryPlan(input, inputPath, cwd) };
  return {
    help: false,
    result: await runCanary(input, inputPath, {
      ...dependencies,
      cwd,
      maxProducts: options.maxProducts,
    }),
  };
}

if (require.main === module) {
  runCli().then((result) => {
    if (result.help) console.log(result.output);
    else if (result.plan) console.log(JSON.stringify(result.plan, null, 2));
    else console.log(JSON.stringify({
      status: result.result.candidateArtifact.status,
      mode: result.result.report.mode,
      summary: result.result.report.summary,
      report: path.relative(process.cwd(), result.result.reportPath).replaceAll("\\", "/"),
      candidates: path.relative(process.cwd(), result.result.candidatesPath).replaceAll("\\", "/"),
    }, null, 2));
  }).catch((error) => {
    console.error(error.message);
    process.exitCode = 1;
  });
}

module.exports = {
  parseArgs,
  resolveInputInsideTmp,
  runCli,
  usage,
};
