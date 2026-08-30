const crypto = require("node:crypto");
const fs = require("node:fs");
const path = require("node:path");
const { SCOPES: EBAY_SCOPES } = require("./ebay-offer-refresh");

const sha256 = (value) => crypto.createHash("sha256").update(typeof value === "string" ? value : JSON.stringify(value)).digest("hex");
const isoPlusDays = (value, days) => new Date(new Date(value).getTime() + days * 86400000).toISOString();
function fail(message) { throw new Error(message); }
function kind(classification) {
  if (/SOURCE|MISSING/.test(classification)) return "SOURCE_FAILURE";
  if (/SAFE_UPDATE|OUT_OF_STOCK|PRICE|STOCK|COMMERCIAL/.test(classification)) return "COMMERCIAL_CHANGE";
  if (/MAPPING/.test(classification)) return "MAPPING_DRIFT";
  return "IDENTITY_CONFLICT";
}
function confidence(value) { const text = String(value || "LOW").toUpperCase(); return ["HIGH", "MEDIUM", "LOW"].includes(text) ? text : Number(value) >= 0.8 ? "HIGH" : Number(value) >= 0.6 ? "MEDIUM" : "LOW"; }
function baseRow({ retailer, retailerId, capture, artifactFingerprint, source, classification, operation, workflowRunUrl = null, artifactUrl = null }) {
  const offerId = String(source.offer_id), beforeState = { offer: source.offer || null, mapping: { id: source.mapping_id || source.retailer_product_id || null, external_product_id: source.external_product_id || null, external_variant_id: source.external_variant_id || null, url: source.retailer_url || source.affiliate_url || null }, product_id: source.current_product?.id || source.product_id || null, variant_id: source.current_variant?.id || source.product_variant_id || null };
  const proposedState = source.source_evidence || source.proposed_identity || { product_id: source.proposed_product?.id || null, variant_id: source.proposed_variant?.id || null, external_product_id: source.proposed_external_product_id || null, external_variant_id: source.proposed_external_variant_id || null };
  const evidence = { ...(source.source_evidence || {}), consecutive_independent_captures: source.consecutive_independent_captures || 1, first_missing_at: source.first_missing_at || null, last_attempt_at: capture, last_successful_capture_at: source.last_successful_capture_at || null, error_class: source.source_error || (/SOURCE|MISSING/.test(classification) ? classification : null), retry_count: source.retry_count || 0, remainder_of_source_healthy: source.remainder_of_source_healthy ?? true, confirmed_unavailable: false };
  const fingerprint = sha256({ retailer, offer_id: offerId, classification, operation, beforeState, proposedState, evidence });
  return { snapshot_id: `automation-review-${capture.slice(0, 10)}`, review_item_id: `${retailerId}:${offerId}:${fingerprint}`, source_record_id: String(source.external_variant_id || source.external_product_id || offerId), retailer, product_title: source.full_name || source.product_title || `Offer ${offerId}`, variant_title: source.flavour || source.current_variant?.name || null, primary_status: classification, reason_codes: source.risk_flags || source.block_reason || source.reason || classification, confidence: confidence(source.confidence), canonical_candidates: [], source_sku: source.source_sku || null, source_gtin: source.gtin || null, source_weight: source.size || null, source_price: source.offer?.price ?? source.price ?? null, source_url: source.retailer_url || source.affiliate_url || null, suggested_action: source.recommendation || operation, decision: "PENDING", source_row_fingerprint: fingerprint, artifact_fingerprint: artifactFingerprint, retailer_id: retailerId, retailer_product_id: source.mapping_id || source.retailer_product_id || null, offer_id: offerId, current_product_id: source.current_product?.id || source.product_id || null, current_variant_id: source.current_variant?.id || source.product_variant_id || null, proposed_product_id: source.proposed_product?.id || null, proposed_variant_id: source.proposed_variant?.id || null, review_status: "PENDING", review_kind: kind(classification), operation_type: operation, before_state: beforeState, proposed_state: proposedState, impact_summary: { catalogue_entity_creates: 0, direct_catalogue_writes: 0, proposed_operation: operation }, source_evidence: evidence, source_captured_at: capture, expires_at: isoPlusDays(capture, 7), workflow_run_url: workflowRunUrl, artifact_url: artifactUrl };
}

function build(ownerPackFile, ebayReportFile, ebayArtifactDir) {
  const packBytes = fs.readFileSync(ownerPackFile), pack = JSON.parse(packBytes), reportBytes = fs.readFileSync(ebayReportFile), ebay = JSON.parse(reportBytes);
  if (pack.database_writes !== 0 || pack.scopes.whey_legacy.rows.length !== 284 || pack.scopes.dolphin_stale.rows.length !== 2) fail("Owner pack scope mismatch");
  if (ebay.result !== "PASS_WITH_REVIEW" || ebay.review_row_count !== 40 || ebay.blocked_row_count !== 0) fail("Fresh eBay review scope mismatch");
  const capture = pack.generated_at, packFingerprint = sha256(packBytes), ebayCapture = ebayReportFile.match(/dry-run-(.+)\.json$/)?.[1]?.replace(/-(\d{3})Z$/, ".$1Z").replace(/T(\d{2})-(\d{2})-(\d{2})/, "T$1:$2:$3") || new Date().toISOString();
  const rows = [];
  for (const row of pack.scopes.whey_legacy.rows) rows.push(baseRow({ retailer: "Whey Okay", retailerId: 3, capture, artifactFingerprint: packFingerprint, source: row, classification: row.classification, operation: row.operation_type || "MANUAL_REVIEW" }));
  for (const row of pack.scopes.discount_stale.rows.filter((item) => item.classification !== "NO_CHANGE")) rows.push(baseRow({ retailer: "Discount Supplements", retailerId: 4, capture, artifactFingerprint: packFingerprint, source: row, classification: row.classification, operation: row.classification }));
  for (const row of pack.scopes.dolphin_stale.rows) rows.push(baseRow({ retailer: "Dolphin Fitness", retailerId: 5, capture, artifactFingerprint: packFingerprint, source: row, classification: "IDENTITY_CONFLICT", operation: "MANUAL_REVIEW" }));
  const scopes = new Map(EBAY_SCOPES.map((scope) => [String(scope.offer_id), scope]));
  for (const review of ebay.review_rows) {
    const scope = scopes.get(String(review.offer_id)); if (!scope) fail(`Unknown eBay offer ${review.offer_id}`);
    const artifactFile = path.join(ebayArtifactDir, `artifact-${review.offer_id}-${path.basename(ebayReportFile).slice(8, -5)}.json`);
    let plan = null; if (fs.existsSync(artifactFile)) plan = JSON.parse(fs.readFileSync(artifactFile)).plans?.[0]?.resolved_plan || null;
    const source = { ...scope, full_name: `${scope.brand || "eBay"} ${scope.product_name || scope.external_variant_id}`, offer: plan?.expected_state?.offer || null, source_evidence: plan?.offer?.values || ebay.source.find((item) => String(item.offer_id) === String(review.offer_id)) || null, source_error: review.source_error, remainder_of_source_healthy: true };
    if (String(review.offer_id) === "2686") Object.assign(source, { consecutive_independent_captures: 2, first_missing_at: "2026-08-30T13:50:13.389Z", retry_count: 0 });
    rows.push(baseRow({ retailer: "eBay UK", retailerId: 12, capture: ebayCapture, artifactFingerprint: sha256(reportBytes), source, classification: review.review_type, operation: review.action || "MANUAL_REVIEW", workflowRunUrl: "https://github.com/SupplementScout/supplementscout/actions/runs/33315614452", artifactUrl: "https://github.com/SupplementScout/supplementscout/actions/runs/33315614452" }));
  }
  const keys = new Set(rows.map((row) => `${row.retailer_id}:${row.offer_id}:${row.source_row_fingerprint}`));
  if (rows.length !== 373 || keys.size !== rows.length) fail(`Expected 373 unique unresolved review rows, received ${rows.length}/${keys.size}`);
  return { schema_version: 1, generated_at: new Date().toISOString(), source_owner_pack_sha256: packFingerprint, source_ebay_report_sha256: sha256(reportBytes), row_count: rows.length, counts: rows.reduce((out, row) => { const key = `${row.retailer}:${row.review_kind}`; out[key] = (out[key] || 0) + 1; return out; }, {}), rows };
}

if (require.main === module) {
  const [owner, ebay, artifacts, output] = process.argv.slice(2);
  if (![owner, ebay, artifacts, output].every(Boolean)) fail("Usage: owner-pack ebay-report ebay-artifact-dir output");
  const result = build(path.resolve(owner), path.resolve(ebay), path.resolve(artifacts)); fs.writeFileSync(path.resolve(output), `${JSON.stringify(result, null, 2)}\n`); console.log(JSON.stringify({ result: "PASS", rows: result.row_count, counts: result.counts, output: path.resolve(output) }));
}
module.exports = { baseRow, build, kind };
