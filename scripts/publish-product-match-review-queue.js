const fs = require("node:fs");
const path = require("node:path");
const dotenv = require("dotenv");
const { createClient } = require("@supabase/supabase-js");
const {
  exportReviewQueueJson,
  normalizeRow,
} = require("./lib/retailer-snapshot/review-queue");
const { hash } = require("./lib/retailer-snapshot/fingerprints");

const ROOT = path.resolve(__dirname, "..");
const TMP_ROOT = path.join(ROOT, "tmp");
const MAX_ROWS = 1000;
const PRODUCTION_REF = "aftboxmrdgyhizicfsfu";

function fail(message) {
  throw new Error(message);
}

function parseArgs(argv) {
  const result = {};
  for (const argument of argv) {
    const match = argument.match(/^--([^=]+)=(.*)$/);
    if (
      !match ||
      result[match[1]] !== undefined ||
      !["input", "target", "confirm-review-only"].includes(match[1])
    ) {
      fail(`Invalid argument ${argument}`);
    }
    result[match[1]] = match[2];
  }
  if (!result.input) fail("Required --input=<review-queue.json>");
  if (result.target !== "production") {
    fail("Required --target=production");
  }
  if (result["confirm-review-only"] !== "true") {
    fail("Required --confirm-review-only=true");
  }
  result.input = path.resolve(result.input);
  const relative = path.relative(TMP_ROOT, result.input);
  if (!relative || relative.startsWith("..") || path.isAbsolute(relative)) {
    fail("Input review queue must be inside repository tmp");
  }
  return {
    input: result.input,
    target: result.target,
    confirmReviewOnly: true,
  };
}

function loadClient(target) {
  dotenv.config({ path: path.join(ROOT, ".env.local"), quiet: true });
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) fail(`Missing ${target} Supabase credentials`);
  const actualRef = new URL(url).hostname.split(".")[0];
  if (actualRef !== PRODUCTION_REF) {
    fail(`Production target mismatch: received ${actualRef}`);
  }
  return createClient(url, key, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

function parseCandidates(value) {
  if (!value) return [];
  const parsed = typeof value === "string" ? JSON.parse(value) : value;
  if (!Array.isArray(parsed) || parsed.length > 10) {
    fail("canonical_candidates must be an array with at most 10 entries");
  }
  return parsed;
}

function moneyOrNull(value) {
  if (value === "") return null;
  const parsed = Number(value);
  if (!Number.isFinite(parsed) || parsed < 0) fail(`Invalid source price ${value}`);
  return parsed.toFixed(2);
}

function databaseRow(row, artifactFingerprint) {
  const normalized = normalizeRow(row);
  const candidates = parseCandidates(normalized.canonical_candidates);
  const sourceRow = {
    review_item_id: normalized.review_item_id,
    snapshot_id: normalized.snapshot_id,
    source_record_id: normalized.source_record_id,
    retailer: normalized.retailer,
    product_title: normalized.product_title,
    variant_title: normalized.variant_title,
    primary_status: normalized.primary_status,
    reason_codes: normalized.reason_codes,
    confidence: normalized.confidence,
    canonical_candidates: candidates,
    source_sku: normalized.source_sku,
    source_gtin: normalized.source_gtin,
    source_weight: normalized.source_weight,
    source_price: moneyOrNull(normalized.source_price),
    source_url: normalized.source_url,
    suggested_action: normalized.suggested_action,
  };
  return {
    ...sourceRow,
    decision: "PENDING",
    selected_canonical_product_id: null,
    selected_canonical_variant_id: null,
    reviewer_notes: null,
    reviewed_by: null,
    reviewed_at: null,
    source_row_fingerprint: hash("PRODUCT-MATCH-REVIEW-ROW:1", sourceRow),
    artifact_fingerprint: artifactFingerprint,
  };
}

function readArtifact(file) {
  if (!fs.existsSync(file)) fail(`Review queue missing: ${file}`);
  const artifact = JSON.parse(fs.readFileSync(file, "utf8"));
  if (
    artifact.schema_version !== 1 ||
    !artifact.snapshot_id ||
    !Array.isArray(artifact.rows) ||
    artifact.rows.length > MAX_ROWS
  ) {
    fail("Unexpected review queue schema");
  }
  const expected = exportReviewQueueJson(artifact.rows, {
    snapshot_id: artifact.snapshot_id,
  });
  if (expected.artifact_fingerprint !== artifact.artifact_fingerprint) {
    fail("Review queue fingerprint mismatch");
  }
  const rowIds = new Set();
  for (const row of artifact.rows) {
    if (
      String(row.snapshot_id) !== String(artifact.snapshot_id) ||
      rowIds.has(String(row.review_item_id))
    ) {
      fail("Review queue contains mismatched snapshot or duplicate item IDs");
    }
    rowIds.add(String(row.review_item_id));
  }
  return artifact;
}

async function publish(options, dependencies = {}) {
  const artifact = readArtifact(options.input);
  const client = dependencies.client || loadClient(options.target);
  const rows = artifact.rows.map((row) =>
    databaseRow(row, artifact.artifact_fingerprint)
  );
  const { data: existing, error: existingError } = await client
    .from("product_match_review_queue")
    .select("review_item_id, source_row_fingerprint, decision")
    .eq("snapshot_id", artifact.snapshot_id);
  if (existingError) throw existingError;

  const existingById = new Map(
    (existing || []).map((row) => [String(row.review_item_id), row])
  );
  const inserts = rows.filter((row) => {
    const current = existingById.get(row.review_item_id);
    if (!current) return true;
    if (current.source_row_fingerprint !== row.source_row_fingerprint) {
      fail(`Published review item drift: ${row.review_item_id}`);
    }
    return false;
  });

  if (inserts.length > 0) {
    const { error } = await client
      .from("product_match_review_queue")
      .insert(inserts);
    if (error) throw error;
  }

  return {
    result: "PASS",
    database_writes: inserts.length,
    catalogue_writes: 0,
    snapshot_id: artifact.snapshot_id,
    rows_in_artifact: rows.length,
    inserted: inserts.length,
    preserved_existing_decisions: rows.length - inserts.length,
  };
}

async function main(argv = process.argv.slice(2)) {
  const options = parseArgs(argv);
  const result = await publish(options);
  console.log(JSON.stringify(result, null, 2));
}

if (require.main === module) {
  main().catch((error) => {
    console.error(error.message);
    process.exitCode = 1;
  });
}

module.exports = {
  databaseRow,
  parseArgs,
  publish,
  readArtifact,
};
