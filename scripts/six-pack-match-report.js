const fs = require("node:fs");
const path = require("node:path");
const dotenv = require("dotenv");
const { createClient } = require("@supabase/supabase-js");
const {
  enforceUniqueCanonicalTargets,
  matchRetailerRecords,
  sourceEvidence,
} = require("./lib/retailer-canonical-matcher");
const { exportReviewQueueCsv, exportReviewQueueJson } = require("./lib/retailer-snapshot/review-queue");
const { sha256 } = require("./lib/woocommerce-csv-reader");

const ROOT = path.resolve(__dirname, "..");
const OUTPUT_DIR = path.join(ROOT, "tmp", "retailer-feeds", "six-pack-supplements");
const DEFAULT_SOURCE = path.join(OUTPUT_DIR, "six-pack-source-snapshot.json");
const TARGETS = Object.freeze({
  production: "aftboxmrdgyhizicfsfu",
  staging: "hxnrsyyqffztlvcrtgbf",
});

function fail(message) {
  throw new Error(message);
}

function parseArgs(argv) {
  const result = {};
  for (const argument of argv) {
    const match = argument.match(/^--([^=]+)=(.*)$/);
    if (!match || result[match[1]] !== undefined || !["source", "target", "output-dir", "allow-existing-retailer"].includes(match[1])) {
      fail(`Invalid argument ${argument}`);
    }
    result[match[1]] = match[2];
  }
  if (!TARGETS[result.target]) fail("Required --target=staging|production");
  result.source = result.source ? path.resolve(result.source) : DEFAULT_SOURCE;
  result.outputDir = result["output-dir"] ? path.resolve(result["output-dir"]) : OUTPUT_DIR;
  result.allowExistingRetailer = result["allow-existing-retailer"] === "true";
  if (result["allow-existing-retailer"] !== undefined && !["true", "false"].includes(result["allow-existing-retailer"])) {
    fail("--allow-existing-retailer must be true|false");
  }
  const relative = path.relative(path.join(ROOT, "tmp"), result.outputDir);
  if (!relative || relative.startsWith("..") || path.isAbsolute(relative)) fail("Output directory must be inside repository tmp");
  return result;
}

function loadEnvironment(target) {
  const file = target === "production" ? ".env.local" : ".env.staging.audit.local";
  dotenv.config({ path: path.join(ROOT, file), quiet: true });
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) fail(`Missing ${target} read credentials`);
  const ref = new URL(url).hostname.split(".")[0];
  if (ref !== TARGETS[target]) fail(`Supabase target mismatch: expected ${TARGETS[target]}, received ${ref}`);
  return createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } });
}

async function fetchAll(client, table, columns) {
  const rows = [];
  for (let from = 0; ; from += 1000) {
    const { data, error } = await client.from(table).select(columns).range(from, from + 999);
    if (error) throw error;
    rows.push(...(data || []));
    if (!data || data.length < 1000) return rows;
  }
}

async function readCanonical(client) {
  const [products, variants, retailers] = await Promise.all([
    fetchAll(client, "products", "id,name,slug,brand,category,product_format,gtin,net_weight_g,net_volume_ml,unit_count,unit_type,is_active,merged_into_product_id"),
    fetchAll(client, "product_variants", "id,product_id,variant_key,display_name,flavour_code,flavour_label,size_value,size_unit,pack_count,product_format,is_active,is_default"),
    fetchAll(client, "retailers", "id,name,slug,website"),
  ]);
  return { products, variants, retailers };
}

function countBy(rows, field) {
  const counts = {};
  for (const row of rows) counts[row[field]] = (counts[row[field]] || 0) + 1;
  return Object.fromEntries(Object.entries(counts).sort(([left], [right]) => left.localeCompare(right)));
}

function topCandidates(match) {
  return (match.product_match?.candidates || []).slice(0, 5).map((candidate) => ({
    product_id: String(candidate.product.id),
    name: candidate.product.name,
    brand: candidate.product.brand,
    score: Number(candidate.score.toFixed(4)),
    name_similarity: Number(candidate.name_similarity.toFixed(4)),
    exact_name: candidate.exact_name,
    exact_signature: candidate.exact_signature,
    brand_match: candidate.brand_match,
    size_match: candidate.size_match,
    format_match: candidate.format_match,
  }));
}

function serializableMatch(match) {
  const evidence = sourceEvidence(match.record);
  return {
    source_record_id: match.record.source_record_id,
    external_product_id: match.record.external_product_id,
    external_variant_id: match.record.external_variant_id,
    source_type: match.record.source_type,
    source_product_name: match.record.product_name,
    source_variant_name: match.record.variant_name,
    source_brand: match.record.brand,
    source_price: match.record.price,
    source_in_stock: match.record.in_stock,
    source_url: match.record.variant_url,
    source_gtin: match.record.external_gtin,
    source_evidence: evidence,
    status: match.status,
    reason: match.reason,
    canonical_product_id: match.product ? String(match.product.id) : null,
    canonical_product_name: match.product?.name || null,
    canonical_variant_id: match.variant ? String(match.variant.id) : null,
    canonical_variant_name: match.variant?.display_name || null,
    candidates: topCandidates(match),
  };
}

function reviewRows(rows, snapshotFingerprint) {
  return rows
    .filter((row) => row.status !== "SAFE_EXISTING_VARIANT")
    .map((row) => ({
      review_item_id: `six-pack-${row.source_record_id}`,
      snapshot_id: snapshotFingerprint,
      source_record_id: row.source_record_id,
      retailer: "6 Pack Supplements",
      product_title: row.source_product_name,
      variant_title: row.source_variant_name,
      primary_status: row.status,
      reason_codes: row.reason,
      confidence: row.status.includes("HIGH_CONFIDENCE") ? "MEDIUM" : "LOW",
      canonical_candidates: row.candidates,
      source_sku: "",
      source_gtin: row.source_gtin || "",
      source_weight: row.source_evidence.size ? `${row.source_evidence.size.value}${row.source_evidence.size.unit}` : "",
      source_price: row.source_price,
      source_url: row.source_url,
      suggested_action: row.status === "NEW_PRODUCT_REVIEW" ? "APPROVE_NEW_PRODUCT_OR_DEFER" : "REVIEW_EXISTING_IDENTITY",
      reviewer_decision: "",
      selected_canonical_product_id: row.canonical_product_id || "",
      selected_canonical_variant_id: row.canonical_variant_id || "",
      reviewer_notes: "",
      reviewed_by: "",
      reviewed_at: "",
      decision_fingerprint: "",
    }));
}

function safeManifest(rows, metadata) {
  const safe = rows
    .filter((row) => row.status === "SAFE_EXISTING_VARIANT")
    .map((row) => ({
      external_product_id: row.external_product_id,
      external_variant_id: row.external_variant_id,
      canonical_product_id: row.canonical_product_id,
      canonical_variant_id: row.canonical_variant_id,
      source_product_name: row.source_product_name,
      source_variant_name: row.source_variant_name,
      approved_price: row.source_price,
      approved_in_stock: row.source_in_stock,
    }))
    .sort((left, right) => Number(left.external_variant_id) - Number(right.external_variant_id));
  const manifest = {
    schema_version: 1,
    kind: "six-pack-match-only-draft",
    approved: false,
    target: metadata.target,
    target_project_ref: TARGETS[metadata.target],
    source_snapshot_fingerprint: metadata.source_snapshot_fingerprint,
    source_sha256: metadata.source_sha256,
    generated_at: metadata.generated_at,
    row_count: safe.length,
    rows: safe,
    manifest_fingerprint: null,
  };
  manifest.manifest_fingerprint = sha256(JSON.stringify(manifest));
  return manifest;
}

function atomicWrite(filePath, value) {
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  const temporary = `${filePath}.${process.pid}.${Date.now()}.tmp`;
  fs.writeFileSync(temporary, value);
  fs.renameSync(temporary, filePath);
}

async function run(options, dependencies = {}) {
  if (!fs.existsSync(options.source)) fail(`Source snapshot missing: ${options.source}`);
  const snapshot = JSON.parse(fs.readFileSync(options.source, "utf8"));
  if (snapshot.source_type !== "WOOCOMMERCE_NATIVE_CSV" || !Array.isArray(snapshot.records)) {
    fail("Unexpected 6 Pack source snapshot");
  }
  const client = dependencies.client || loadEnvironment(options.target);
  const canonical = dependencies.canonical || await readCanonical(client);
  if (!options.allowExistingRetailer && canonical.retailers.some((retailer) => retailer.slug === "6-pack-supplements")) {
    fail("6 Pack retailer already exists; new-retailer match report must not run over a live mapping scope");
  }
  const eligible = snapshot.records.filter((record) => record.policy_state === "ELIGIBLE");
  const matched = enforceUniqueCanonicalTargets(matchRetailerRecords(eligible, canonical));
  const rows = matched.map(serializableMatch);
  const generatedAt = new Date().toISOString();
  const metadata = {
    target: options.target,
    source_snapshot_fingerprint: snapshot.snapshot_fingerprint,
    source_sha256: snapshot.source_sha256,
    generated_at: generatedAt,
  };
  const draft = safeManifest(rows, metadata);
  const reviews = reviewRows(rows, snapshot.snapshot_fingerprint);
  const report = {
    schema_version: 1,
    retailer: "6 Pack Supplements",
    mode: options.allowExistingRetailer ? "READ_ONLY_EXPANSION_MATCH_ONLY" : "READ_ONLY_MATCH_ONLY",
    database_writes: 0,
    target_environment: options.target.toUpperCase(),
    target_project_ref: TARGETS[options.target],
    generated_at: generatedAt,
    source_sha256: snapshot.source_sha256,
    source_snapshot_fingerprint: snapshot.snapshot_fingerprint,
    canonical_counts: {
      products: canonical.products.length,
      variants: canonical.variants.length,
      retailers: canonical.retailers.length,
    },
    source_eligible_records: eligible.length,
    status_counts: countBy(rows, "status"),
    safe_match_count: draft.row_count,
    review_count: reviews.length,
    catalogue_creates_planned: 0,
    retailer_creates_planned: 0,
    mapping_creates_planned: 0,
    offer_creates_planned: 0,
    next_gate: draft.row_count > 0 ? "HUMAN_REVIEW_AND_CANARY_SELECTION" : "BLOCKED_NO_SAFE_MATCHES",
    rows,
  };
  const reviewJson = exportReviewQueueJson(reviews, { snapshot_id: snapshot.snapshot_fingerprint });
  const paths = {
    report: path.join(options.outputDir, "six-pack-match-report.json"),
    reviewJson: path.join(options.outputDir, "six-pack-review-queue.json"),
    reviewCsv: path.join(options.outputDir, "six-pack-review-queue.csv"),
    draftManifest: path.join(options.outputDir, "six-pack-safe-match-draft-manifest.json"),
  };
  atomicWrite(paths.report, `${JSON.stringify(report, null, 2)}\n`);
  atomicWrite(paths.reviewJson, `${JSON.stringify(reviewJson, null, 2)}\n`);
  atomicWrite(paths.reviewCsv, exportReviewQueueCsv(reviews));
  atomicWrite(paths.draftManifest, `${JSON.stringify(draft, null, 2)}\n`);
  return { report, reviewJson, draft, paths };
}

async function main(argv = process.argv.slice(2)) {
  const options = parseArgs(argv);
  const result = await run(options);
  console.log(JSON.stringify({
    result: "PASS",
    database_writes: 0,
    status_counts: result.report.status_counts,
    safe_match_count: result.report.safe_match_count,
    review_count: result.report.review_count,
    next_gate: result.report.next_gate,
    outputs: Object.values(result.paths).map((file) => path.relative(ROOT, file)),
  }, null, 2));
}

if (require.main === module) {
  main().catch((error) => {
    console.error(error.message);
    process.exitCode = 1;
  });
}

module.exports = {
  TARGETS,
  countBy,
  parseArgs,
  readCanonical,
  reviewRows,
  run,
  safeManifest,
  serializableMatch,
};
