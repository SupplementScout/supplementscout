const fs = require("node:fs");
const path = require("node:path");
const {
  STATUS,
  applyCrossSourceConflicts,
  assertRealPathInsideRoot,
  buildArtifact,
  fingerprint,
  sealCandidate,
  writeArtifactFiles,
} = require("./lib/nutrition-candidates");
const { MAX_PAGES, runCanary, validatePageList } = require("./lib/nutrition-ocr");
const { resolveInputInsideTmp } = require("./nutrition-ocr-canary");
const { storeRows, validateArtifact } = require("./store-nutrition-candidates");

function fail(message) {
  throw new Error(message);
}

function parseArgs(argv) {
  const options = {};
  for (const argument of argv) {
    if (argument.startsWith("--input=")) options.input = argument.slice("--input=".length);
    else if (argument.startsWith("--max-products=")) options.maxProducts = Number(argument.slice("--max-products=".length));
    else if (argument === "--confirm-official-pages-only=true") options.officialPagesOnly = true;
    else if (argument === "--store-candidates=true") options.storeCandidates = true;
    else fail(`Unknown option: ${argument}`);
  }
  if (!options.input) fail("Required option: --input=<tmp/.../pages.json>");
  if (!Number.isInteger(options.maxProducts) || options.maxProducts < 1 || options.maxProducts > MAX_PAGES) {
    fail(`--max-products must be an integer from 1 to ${MAX_PAGES}`);
  }
  if (!options.officialPagesOnly) fail("Batch requires --confirm-official-pages-only=true");
  if (!options.storeCandidates) fail("Batch storage requires --store-candidates=true");
  return options;
}

function relative(cwd, value) {
  return path.relative(cwd, value).replaceAll("\\", "/");
}

function buildHtmlManifest(input, report, inputPath, cwd) {
  const pageById = new Map(input.pages.map((page) => [page.source_record_id, page]));
  const records = report.pages.filter((page) => page.page_file && page.page_sha256).map((page) => {
    const source = pageById.get(page.source_record_id);
    if (!source) fail(`Missing source record ${page.source_record_id}`);
    return {
      source_record_id: source.source_record_id,
      product_id: source.product_id,
      product_variant_id: source.product_variant_id,
      retailer_id: null,
      retailer_product_id: null,
      product_name: source.product_name,
      brand: source.brand,
      manufacturer: source.manufacturer,
      source_url: page.canonical_source_page_url,
      source_type: "manufacturer_product_page",
      identity_binding: source.identity_binding,
      snapshot_file: relative(path.dirname(inputPath), path.resolve(cwd, page.page_file)),
      source_snapshot_ref: page.page_file,
      snapshot_sha256: page.page_sha256,
      content_type: "text/html",
      current_values: Object.fromEntries(Object.entries(source.current_values || {})
        .filter(([field]) => field !== "nutrition_verified")),
    };
  });
  if (!records.length) return null;
  return {
    schema_version: 2,
    kind: "nutrition-candidate-source-snapshot-v2",
    mode: "OFFLINE",
    captured_at: report.generated_at,
    records,
  };
}

function ocrCandidateToStandard(candidate, runId, currentValues = {}) {
  const locator = [
    candidate.evidence_locator,
    `image_file=${candidate.image_file}`,
    `image_sha256=${candidate.image_sha256}`,
    `ocr_text_file=${candidate.ocr_text_file}`,
  ].join(" | ").slice(0, 500);
  const core = {
    run_id: runId,
    source_record_id: `ocr:${candidate.product_id || "unmapped"}:${candidate.image_sha256.slice(0, 16)}`,
    product_name: candidate.product_name,
    brand: candidate.brand,
    manufacturer: candidate.manufacturer,
    product_id: candidate.product_id,
    product_variant_id: candidate.product_variant_id,
    retailer_id: null,
    retailer_product_id: null,
    field_name: candidate.field_name,
    value_numeric: candidate.value_numeric,
    unit: candidate.unit,
    basis: candidate.basis,
    source_url: candidate.source_page_url,
    source_file: candidate.image_file,
    source_type: "manufacturer_product_page",
    parser: "OCR_TEXT",
    evidence_text: candidate.evidence_text.slice(0, 300),
    evidence_locator: locator,
    captured_at: candidate.captured_at,
    source_sha256: candidate.image_sha256,
    identity_confidence: candidate.product_id ? "MEDIUM" : "LOW",
    extraction_confidence: "LOW",
    overall_confidence: "LOW",
    flags: [...new Set(candidate.warning_flags)].slice(0, 20),
    current_value: Object.prototype.hasOwnProperty.call(currentValues, candidate.field_name)
      ? currentValues[candidate.field_name]
      : null,
    candidate_status: STATUS,
    review_status: "PENDING",
  };
  return sealCandidate(core);
}

function isUsefulCandidate(candidate, currentValues = {}) {
  const current = currentValues[candidate.field_name];
  if (typeof current !== "number" || current !== candidate.value_numeric) return true;
  return ["protein_per_serving_g", "creatine_per_serving_g"].includes(candidate.field_name) &&
    currentValues.nutrition_verified !== true;
}

function mergeArtifacts(htmlArtifact, ocrArtifact, pages = []) {
  const currentByProduct = new Map(pages.map((page) => [String(page.product_id), page.current_values || {}]));
  const pageBySourceRecord = new Map(pages.map((page) => [page.source_record_id, page]));
  const pageBySourceUrl = new Map(pages.map((page) => [page.source_page_url, page]));
  const pagesByProduct = new Map();
  for (const page of pages) {
    const key = String(page.product_id);
    const productPages = pagesByProduct.get(key) || [];
    productPages.push(page);
    pagesByProduct.set(key, productPages);
  }
  const ocrCandidates = ocrArtifact.candidates.map((candidate) =>
    ocrCandidateToStandard(candidate, htmlArtifact.run_id, currentByProduct.get(String(candidate.product_id)) || {}));
  const allCandidates = [...htmlArtifact.candidates, ...ocrCandidates];
  const focusPage = (candidate) => pageBySourceRecord.get(candidate.source_record_id) ||
    pageBySourceUrl.get(candidate.source_url) ||
    (pagesByProduct.get(String(candidate.product_id))?.length === 1
      ? pagesByProduct.get(String(candidate.product_id))[0]
      : null);
  const focusedCandidates = allCandidates.filter((candidate) => {
    const page = focusPage(candidate);
    return !page?.missing_fields || page.missing_fields.includes(candidate.field_name);
  });
  const candidates = focusedCandidates.filter((candidate) =>
    isUsefulCandidate(candidate, currentByProduct.get(String(candidate.product_id)) || {}));
  applyCrossSourceConflicts(candidates);
  candidates.sort((left, right) => left.candidate_id.localeCompare(right.candidate_id));
  const summary = {
    ...htmlArtifact.summary,
    candidate_facts: candidates.length,
    html_candidate_facts: candidates.filter((row) => row.parser !== "OCR_TEXT").length,
    ocr_candidate_facts: candidates.filter((row) => row.parser === "OCR_TEXT").length,
    manifest_focus_excluded_candidate_facts: allCandidates.length - focusedCandidates.length,
    high_confidence_candidates: candidates.filter((row) => row.overall_confidence === "HIGH").length,
    medium_confidence_candidates: candidates.filter((row) => row.overall_confidence === "MEDIUM").length,
    low_confidence_candidates: candidates.filter((row) => row.overall_confidence === "LOW").length,
  };
  const core = { ...htmlArtifact, summary, candidates };
  delete core.artifact_fingerprint;
  return { ...core, artifact_fingerprint: fingerprint("ARTIFACT", { ...core, generated_at: null }) };
}

function buildBatchReport(input, ocrReport, artifact, storedCandidates) {
  const sourceById = new Map(input.pages.map((page) => [page.source_record_id, page]));
  const candidates = artifact?.candidates || [];
  return {
    schema_version: 1,
    kind: "nutrition-candidate-batch-report-v1",
    status: STATUS,
    run_id: artifact?.run_id || null,
    generated_at: artifact?.generated_at || ocrReport.generated_at,
    summary: {
      requested_products: ocrReport.summary.selected_products,
      fetched_products: ocrReport.pages.filter((page) => page.page_file).length,
      failed_products: ocrReport.pages.filter((page) => !page.page_file).length,
      html_candidates: artifact?.summary.html_candidate_facts || 0,
      ocr_candidates: artifact?.summary.ocr_candidate_facts || 0,
      stored_candidates: storedCandidates,
      destination: "nutrition_candidates",
      product_updates: 0,
      verified_csv_files: 0,
    },
    products: ocrReport.pages.map((page) => {
      const source = sourceById.get(page.source_record_id);
      const htmlCount = candidates.filter((candidate) =>
        candidate.source_record_id === page.source_record_id).length;
      const ocrCount = candidates.filter((candidate) =>
        candidate.parser === "OCR_TEXT" && candidate.product_id === page.product_id).length;
      return {
        source_record_id: page.source_record_id,
        product_id: page.product_id,
        product_name: page.product_name,
        source_url: page.canonical_source_page_url || source?.source_page_url || null,
        missing_fields: source?.missing_fields || null,
        page_status: page.page_file ? "FETCHED" : "FAILED",
        image_selection_status: page.selection_status,
        html_candidates: htmlCount,
        ocr_candidates: ocrCount,
        candidate_status: STATUS,
        skipped_reason: page.skipped_reason,
        error: page.page_error || null,
      };
    }),
  };
}

async function runCli(argv = process.argv.slice(2), dependencies = {}) {
  const options = parseArgs(argv);
  const cwd = dependencies.cwd || process.cwd();
  const inputPath = resolveInputInsideTmp(options.input, cwd);
  const inputBytes = fs.readFileSync(inputPath);
  let input;
  try {
    input = JSON.parse(inputBytes.toString("utf8"));
  } catch {
    fail("Nutrition batch page manifest is not valid JSON");
  }
  input = validatePageList(input);
  const ocr = await runCanary(input, inputPath, {
    ...dependencies,
    cwd,
    maxProducts: options.maxProducts,
    maximumAllowedProducts: MAX_PAGES,
  });
  const htmlManifest = buildHtmlManifest(input, ocr.report, inputPath, cwd);
  if (!htmlManifest) {
    const batchReportPath = path.join(path.dirname(inputPath), "candidate-batch-report.json");
    fs.writeFileSync(batchReportPath, `${JSON.stringify(buildBatchReport(input, ocr.report, null, 0), null, 2)}\n`, { flag: "wx" });
    return {
      run_id: null,
      status: "NO_FETCHED_PRODUCT_PAGES",
      stored_candidates: 0,
      product_updates: 0,
      report: relative(cwd, batchReportPath),
      ocr_report: relative(cwd, ocr.reportPath),
    };
  }
  const batchDirectory = path.dirname(inputPath);
  const manifestPath = path.join(batchDirectory, "candidate-source-manifest.json");
  const manifestBytes = Buffer.from(`${JSON.stringify(htmlManifest, null, 2)}\n`);
  fs.writeFileSync(manifestPath, manifestBytes, { flag: "wx" });
  const htmlArtifact = buildArtifact({
    manifest: htmlManifest,
    manifestBytes,
    manifestPath,
    generatedAt: ocr.report.generated_at,
  });
  const artifact = mergeArtifacts(htmlArtifact, ocr.candidateArtifact, input.pages);
  const outputDirectory = path.join(batchDirectory, "candidates");
  assertRealPathInsideRoot(path.resolve(cwd, "tmp"), outputDirectory);
  const output = writeArtifactFiles(artifact, outputDirectory, path.resolve(cwd, "tmp"));
  const rows = artifact.candidates.length ? validateArtifact(artifact) : [];
  if (rows.length) await storeRows(rows, dependencies);
  const batchReport = buildBatchReport(input, ocr.report, artifact, rows.length);
  const batchReportPath = path.join(batchDirectory, "candidate-batch-report.json");
  fs.writeFileSync(batchReportPath, `${JSON.stringify(batchReport, null, 2)}\n`, { flag: "wx" });
  return {
    run_id: artifact.run_id,
    status: STATUS,
    fetched_products: htmlManifest.records.length,
    html_candidates: artifact.summary.html_candidate_facts,
    ocr_candidates: artifact.summary.ocr_candidate_facts,
    manifest_focus_excluded_candidates: artifact.summary.manifest_focus_excluded_candidate_facts,
    stored_candidates: rows.length,
    destination: "nutrition_candidates",
    product_updates: 0,
    verified_csv_files: 0,
    report: relative(cwd, batchReportPath),
    ocr_report: relative(cwd, ocr.reportPath),
    artifact: relative(cwd, output.jsonPath),
    candidate_csv: relative(cwd, output.csvPath),
  };
}

if (require.main === module) {
  runCli().then((result) => console.log(JSON.stringify(result, null, 2))).catch((error) => {
    console.error(error.message);
    process.exitCode = 1;
  });
}

module.exports = {
  buildBatchReport,
  buildHtmlManifest,
  isUsefulCandidate,
  mergeArtifacts,
  ocrCandidateToStandard,
  parseArgs,
  runCli,
};
