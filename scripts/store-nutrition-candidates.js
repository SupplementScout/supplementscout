const fs = require("node:fs");
const path = require("node:path");
const {
  ARTIFACT_KIND,
  FIELDS,
  STATUS,
  fingerprint,
  validateSourceUrl,
} = require("./lib/nutrition-candidates");

const UNITS = Object.freeze({
  net_weight_g: "g",
  net_volume_ml: "ml",
  serving_count_verified: "count",
  serving_size_g: "g",
  serving_size_ml: "ml",
  protein_per_serving_g: "g",
  creatine_per_serving_g: "g",
});
const SOURCE_TYPES = new Set([
  "manufacturer_product_page", "retailer_product_page", "retailer_feed",
]);

function optionalPositiveId(value) {
  return value === null || (typeof value === "string" && /^[1-9][0-9]*$/.test(value));
}

function fail(message) {
  throw new Error(message);
}

function resolveArtifactInsideTmp(file, cwd = process.cwd()) {
  const root = fs.realpathSync.native(path.resolve(cwd, "tmp"));
  const resolved = fs.realpathSync.native(path.resolve(cwd, file));
  const relative = path.relative(root, resolved);
  if (relative.startsWith("..") || path.isAbsolute(relative) || !fs.statSync(resolved).isFile()) {
    fail("Candidate artifact must be a file inside repository tmp/");
  }
  if (fs.statSync(resolved).size > 10_000_000) fail("Candidate artifact exceeds 10 MB");
  return resolved;
}

function candidateCore(candidate) {
  const core = { ...candidate };
  delete core.candidate_id;
  delete core.candidate_fingerprint;
  return core;
}

function candidateToRow(candidate, runId) {
  if (!candidate || candidate.candidate_status !== STATUS || candidate.review_status !== "PENDING" ||
      !FIELDS.includes(candidate.field_name) || UNITS[candidate.field_name] !== candidate.unit ||
      !SOURCE_TYPES.has(candidate.source_type) ||
      !optionalPositiveId(candidate.product_id) || !optionalPositiveId(candidate.retailer_id) ||
      typeof candidate.value_numeric !== "number" || !Number.isFinite(candidate.value_numeric) || candidate.value_numeric <= 0 ||
      !["HIGH", "MEDIUM", "LOW"].includes(candidate.overall_confidence) ||
      typeof candidate.evidence_text !== "string" || !candidate.evidence_text.trim() || candidate.evidence_text.length > 300 ||
      typeof candidate.evidence_locator !== "string" || !candidate.evidence_locator.trim() || candidate.evidence_locator.length > 500 ||
      typeof candidate.source_sha256 !== "string" || !/^[0-9a-f]{64}$/.test(candidate.source_sha256) ||
      typeof candidate.source_file !== "string" || !/^tmp\/[A-Za-z0-9._/-]+$/.test(candidate.source_file) || candidate.source_file.includes("..") ||
      typeof candidate.product_name !== "string" || !candidate.product_name.trim() || candidate.product_name.length > 300 ||
      typeof candidate.brand !== "string" || !candidate.brand.trim() || candidate.brand.length > 200 ||
      !Array.isArray(candidate.flags) || candidate.flags.length > 20 || candidate.flags.some((flag) => typeof flag !== "string" || flag.length > 100) ||
      candidate.candidate_fingerprint !== fingerprint("CANDIDATE", candidateCore(candidate))) {
    fail(`Invalid candidate row ${candidate?.candidate_id || "unknown"}`);
  }
  const sourceUrl = validateSourceUrl(candidate.source_url);
  return {
    product_id: candidate.product_id,
    retailer_id: candidate.retailer_id,
    source_type: candidate.source_type,
    source_url: sourceUrl,
    source_file_sha256: candidate.source_sha256,
    source_snapshot_ref: candidate.source_file,
    source_domain: new URL(sourceUrl).hostname.toLowerCase().replace(/^www\./, ""),
    product_name: candidate.product_name,
    brand: candidate.brand,
    proposed_field: candidate.field_name,
    proposed_value: candidate.value_numeric,
    proposed_unit: candidate.unit,
    confidence: candidate.overall_confidence,
    evidence_snippet: candidate.evidence_text,
    source_locator: candidate.evidence_locator,
    warning_flags: candidate.flags,
    status: "pending",
    reviewed_at: null,
    reviewed_by: null,
    review_note: null,
    run_id: runId,
    candidate_fingerprint: candidate.candidate_fingerprint,
  };
}

function validateArtifact(artifact) {
  if (!artifact || artifact.schema_version !== 2 || artifact.kind !== ARTIFACT_KIND ||
      artifact.status !== STATUS || artifact.mode !== "OFFLINE_READ_ONLY" ||
      typeof artifact.run_id !== "string" || !artifact.run_id || !Array.isArray(artifact.candidates) || !artifact.candidates.length) {
    fail("Invalid nutrition candidate artifact");
  }
  return artifact.candidates.map((candidate) => candidateToRow(candidate, artifact.run_id));
}

function parseArgs(argv) {
  const options = {};
  for (const argument of argv) {
    if (argument === "--dry-run") options.dryRun = true;
    else if (argument === "--store-candidates") options.store = true;
    else if (argument === "--confirm-candidate-table-only=true") options.confirm = true;
    else if (argument.startsWith("--input=")) options.input = argument.slice("--input=".length);
    else fail(`Unknown option: ${argument}`);
  }
  if (Boolean(options.dryRun) === Boolean(options.store)) fail("Choose exactly one of --dry-run or --store-candidates");
  if (options.store && !options.confirm) fail("Storage requires --confirm-candidate-table-only=true");
  if (!options.input) fail("Required option: --input=<tmp/.../nutrition-candidates-*.json>");
  return options;
}

async function storeRows(rows, dependencies = {}) {
  const supabase = dependencies.supabase || (() => {
    require("dotenv").config({ path: path.resolve(process.cwd(), ".env.local"), quiet: true });
    const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
    if (!url || !key) fail("Candidate storage requires server-side Supabase service-role credentials");
    const { createClient } = require("@supabase/supabase-js");
    return createClient(url, key, {
      auth: { persistSession: false, autoRefreshToken: false },
    });
  })();
  const { error } = await supabase
    .from("nutrition_candidates")
    .upsert(rows, { onConflict: "candidate_fingerprint", ignoreDuplicates: true });
  if (error) throw error;
}

async function runCli(argv = process.argv.slice(2), dependencies = {}) {
  const options = parseArgs(argv);
  const file = resolveArtifactInsideTmp(options.input, dependencies.cwd || process.cwd());
  let artifact;
  try {
    artifact = JSON.parse(fs.readFileSync(file, "utf8"));
  } catch {
    fail("Candidate artifact is not valid JSON");
  }
  const rows = validateArtifact(artifact);
  if (options.store) await storeRows(rows, dependencies);
  return {
    mode: options.store ? "CANDIDATE_TABLE_WRITE_ONLY" : "DRY_RUN_NO_DATABASE",
    destination: "nutrition_candidates",
    candidate_rows: rows.length,
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

module.exports = {
  candidateToRow,
  parseArgs,
  resolveArtifactInsideTmp,
  runCli,
  storeRows,
  validateArtifact,
};
