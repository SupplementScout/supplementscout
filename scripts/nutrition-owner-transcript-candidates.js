const fs = require("node:fs");
const path = require("node:path");
const {
  ARTIFACT_KIND,
  FIELDS,
  STATUS,
  fingerprint,
  sha256,
} = require("./lib/nutrition-candidates");
const { validatePageList } = require("./lib/nutrition-ocr");

const TRANSCRIPT_KIND = "nutrition-owner-transcript-v1";
const UNITS = Object.freeze({
  net_weight_g: "g",
  net_volume_ml: "ml",
  serving_count_verified: "count",
  serving_size_g: "g",
  serving_size_ml: "ml",
  protein_per_serving_g: "g",
  creatine_per_serving_g: "g",
});

function fail(message) {
  throw new Error(message);
}

function positiveNumber(value) {
  return typeof value === "number" && Number.isFinite(value) && value > 0;
}

function namedWeight(name) {
  const match = String(name).match(/(?:^|\s)(\d+(?:\.\d+)?)\s*(kg|g)(?:\s|$)/i);
  if (!match) return null;
  return Number(match[1]) * (match[2].toLowerCase() === "kg" ? 1000 : 1);
}

function candidateCore(candidate) {
  const core = { ...candidate };
  delete core.candidate_id;
  delete core.candidate_fingerprint;
  return core;
}

function buildArtifact(manifest, transcript, sourceFile, sourceBytes, generatedAt = new Date().toISOString()) {
  const pages = validatePageList(manifest).pages;
  if (!transcript || transcript.schema_version !== 1 || transcript.kind !== TRANSCRIPT_KIND ||
      !Array.isArray(transcript.products) || !transcript.products.length || transcript.products.length > 10) {
    fail("Invalid owner transcript");
  }
  const pageByProduct = new Map(pages.map((page) => [String(page.product_id), page]));
  const candidates = [];
  const seenProducts = new Set();
  for (const product of transcript.products) {
    const productId = String(product?.product_id || "");
    const page = pageByProduct.get(productId);
    if (!page || seenProducts.has(productId) || !positiveNumber(product.package_weight_g) ||
        !product.values || typeof product.values !== "object" || Array.isArray(product.values)) {
      fail(`Invalid owner transcript product ${productId || "unknown"}`);
    }
    seenProducts.add(productId);
    const values = Object.entries(product.values);
    if (!values.length || values.some(([field, value]) => !FIELDS.includes(field) || !positiveNumber(value) ||
        !page.missing_fields?.includes(field))) {
      fail(`Owner transcript contains a non-missing or invalid field for product ${productId}`);
    }
    const flags = ["OWNER_TRANSCRIBED_OFFICIAL_LABEL_REQUIRES_REVIEW"];
    const nameWeight = namedWeight(page.product_name);
    if (nameWeight && Math.abs(nameWeight - product.package_weight_g) > Math.max(1, nameWeight * 0.01)) {
      flags.push("PACK_SIZE_NAME_MISMATCH");
    }
    const count = Number(product.values.serving_count_verified);
    const size = Number(product.values.serving_size_g);
    if (positiveNumber(count) && positiveNumber(size) &&
        count * size > product.package_weight_g + Math.max(1, product.package_weight_g * 0.01)) {
      flags.push("PACKAGE_SERVING_MISMATCH");
    }
    for (const [field, value] of values) {
      const candidate = {
        candidate_id: "",
        run_id: transcript.run_id,
        source_record_id: `owner-transcript:${productId}:${field}`,
        product_name: page.product_name,
        brand: page.brand || page.manufacturer,
        manufacturer: page.manufacturer || page.brand,
        product_id: productId,
        product_variant_id: null,
        retailer_id: null,
        retailer_product_id: null,
        field_name: field,
        value_numeric: value,
        unit: UNITS[field],
        basis: ["net_weight_g", "net_volume_ml", "serving_count_verified"].includes(field) ? "PACKAGE" : "PER_SERVING",
        source_url: page.source_page_url,
        source_file: sourceFile,
        source_type: "manufacturer_product_page",
        parser: "OWNER_TRANSCRIBED_OFFICIAL_LABEL",
        evidence_text: `Owner-transcribed official label: ${field} = ${value} ${UNITS[field]}.`,
        evidence_locator: `owner-transcript:product:${productId}:field:${field}`,
        captured_at: new Date(generatedAt).toISOString(),
        source_sha256: sha256(sourceBytes),
        identity_confidence: "LOW",
        extraction_confidence: "LOW",
        overall_confidence: "LOW",
        flags,
        current_value: page.current_values?.[field] ?? null,
        candidate_status: STATUS,
        review_status: "PENDING",
        candidate_fingerprint: "",
      };
      candidate.candidate_fingerprint = fingerprint("CANDIDATE", candidateCore(candidate));
      candidate.candidate_id = `NC1-${candidate.candidate_fingerprint.slice(0, 24)}`;
      candidates.push(candidate);
    }
  }
  return {
    schema_version: 2,
    kind: ARTIFACT_KIND,
    status: STATUS,
    mode: "OFFLINE_READ_ONLY",
    run_id: transcript.run_id,
    generated_at: new Date(generatedAt).toISOString(),
    source_manifest_sha256: fingerprint("OWNER_TRANSCRIPT_MANIFEST", manifest),
    filters: { product_ids: [], retailer_ids: [] },
    summary: {
      selected_source_records: transcript.products.length,
      candidate_facts: candidates.length,
      excluded_source_records: 0,
      high_confidence_candidates: 0,
      medium_confidence_candidates: 0,
      low_confidence_candidates: candidates.length,
      database_writes: 0,
      network_requests: 0,
      owner_transcribed_candidate_facts: candidates.length,
    },
    candidates,
    exclusions: [],
  };
}

function parseArgs(argv) {
  const options = {};
  for (const argument of argv) {
    if (argument.startsWith("--manifest=")) options.manifest = argument.slice(11);
    else if (argument.startsWith("--transcript=")) options.transcript = argument.slice(13);
    else if (argument.startsWith("--output=")) options.output = argument.slice(9);
    else fail(`Unknown option: ${argument}`);
  }
  if (!options.manifest || !options.transcript || !options.output) fail("Required --manifest, --transcript and --output");
  for (const value of Object.values(options)) {
    const resolved = path.resolve(value);
    const relative = path.relative(path.resolve("tmp"), resolved);
    if (relative.startsWith("..") || path.isAbsolute(relative)) fail("Owner transcript files must stay inside tmp/");
  }
  return options;
}

function runCli(argv = process.argv.slice(2)) {
  const options = parseArgs(argv);
  const transcriptBytes = fs.readFileSync(options.transcript);
  const artifact = buildArtifact(
    JSON.parse(fs.readFileSync(options.manifest, "utf8")),
    JSON.parse(transcriptBytes.toString("utf8")),
    options.transcript.replaceAll("\\", "/"),
    transcriptBytes,
  );
  fs.mkdirSync(path.dirname(options.output), { recursive: true });
  fs.writeFileSync(options.output, `${JSON.stringify(artifact, null, 2)}\n`, { flag: "wx" });
  return { run_id: artifact.run_id, candidate_facts: artifact.candidates.length, output: options.output };
}

if (require.main === module) {
  try { console.log(JSON.stringify(runCli(), null, 2)); } catch (error) { console.error(error.message); process.exitCode = 1; }
}

module.exports = { TRANSCRIPT_KIND, buildArtifact, namedWeight, parseArgs };
