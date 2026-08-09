const { fingerprint, validateSourceUrl } = require("./nutrition-candidates");

const ALLOWED_FIELDS = new Set([
  "net_weight_g",
  "net_volume_ml",
  "serving_count_verified",
  "serving_size_g",
  "serving_size_ml",
  "protein_per_serving_g",
  "creatine_per_serving_g",
]);

function fail(message) {
  throw new Error(message);
}

function normalizedDomain(value) {
  return String(value || "").trim().toLowerCase().replace(/^www\./, "");
}

function buildBatchItemRows(input, report, htmlManifest, runId) {
  if (!runId || !Array.isArray(input?.pages) || input.pages.length < 1 || input.pages.length > 50) {
    fail("Invalid nutrition candidate batch work-item input");
  }
  const reportPages = report?.pages || report?.products || [];
  const reportBySource = new Map(reportPages.map((page) => [page.source_record_id, page]));
  const snapshotBySource = new Map((htmlManifest?.records || []).map((record) => [record.source_record_id, record]));
  return input.pages.map((page) => {
    const pageReport = reportBySource.get(page.source_record_id);
    if (!pageReport) fail(`Missing batch report page ${page.source_record_id}`);
    const missingFields = [...new Set(page.missing_fields || [])];
    if (!missingFields.length || missingFields.some((field) => !ALLOWED_FIELDS.has(field))) {
      fail(`Invalid missing_fields for ${page.source_record_id}`);
    }
    const snapshot = snapshotBySource.get(page.source_record_id) || null;
    const sourceUrl = validateSourceUrl(snapshot?.source_url || page.source_page_url);
    const officialDomains = [...new Set((page.official_domains || []).map(normalizedDomain))];
    const sourceHost = normalizedDomain(new URL(sourceUrl).hostname);
    if (!officialDomains.includes(sourceHost)) {
      fail(`Batch work item source is outside official_domains for ${page.source_record_id}`);
    }
    const core = {
      run_id: runId,
      source_record_id: page.source_record_id,
      product_id: String(page.product_id),
      product_name: page.product_name,
      brand: page.brand || page.manufacturer,
      manufacturer: page.manufacturer || page.brand,
      source_url: sourceUrl,
      source_domain: sourceHost,
      official_domains: officialDomains,
      missing_fields: missingFields,
      current_values: page.current_values || {},
      manifest_note: page.notes || null,
      page_status: snapshot ? "FETCHED" : "FAILED",
      page_error: snapshot ? null : (pageReport.page_error || pageReport.error || null),
      source_file_sha256: snapshot?.snapshot_sha256 || null,
      source_snapshot_ref: snapshot?.source_snapshot_ref || null,
    };
    return { ...core, source_context_sha256: fingerprint("BATCH_ITEM", core) };
  });
}

async function storeBatchItemRows(rows, dependencies = {}) {
  const supabase = dependencies.supabase;
  if (!supabase) fail("Batch work-item storage requires Supabase");
  const { error } = await supabase
    .from("nutrition_candidate_batch_items")
    .upsert(rows, { onConflict: "run_id,product_id", ignoreDuplicates: true });
  if (error) throw error;
}

module.exports = { ALLOWED_FIELDS, buildBatchItemRows, normalizedDomain, storeBatchItemRows };
