const crypto = require("node:crypto");
const fs = require("node:fs");
const path = require("node:path");
const dotenv = require("dotenv");
const { createClient } = require("@supabase/supabase-js");

const PRODUCTION_REF = "aftboxmrdgyhizicfsfu";
const RETAILER_ID = "4";
const EXPECTED_FRESH_REPORT_SHA256 = "636dbb85458dc79f048ccdd966c74938c93405e3fb8da88d13e3c12efd32cc4f";
const EXPECTED_OWNER_PACK_SHA256 = "419c758d55affd2e2bd2a0730a953a25a750c4f62fb53c14a6da3089ee8f1737";
const APPLY_CONFIRMATION = "EXPIRE_DISCOUNT_STALE_EVIDENCE_EXACT_47";

function fail(message) { throw new Error(message); }
function sha256(bytes) { return crypto.createHash("sha256").update(bytes).digest("hex"); }
function parseArgs(argv) {
  const values = {};
  for (const argument of argv) {
    const match = argument.match(/^--(fresh-report|owner-pack|mode|confirm)=(.+)$/);
    if (!match || values[match[1]]) fail(`Invalid argument ${argument}`);
    values[match[1]] = match[2];
  }
  if (!values["fresh-report"] || !values["owner-pack"] || !["dry-run", "apply"].includes(values.mode)) fail("Required --fresh-report, --owner-pack and --mode=dry-run|apply");
  if (values.mode === "apply" && values.confirm !== APPLY_CONFIRMATION) fail("Exact Discount reconciliation confirmation required");
  return { freshReport: path.resolve(values["fresh-report"]), ownerPack: path.resolve(values["owner-pack"]), mode: values.mode };
}

function validateEvidencePayload(fresh, owner) {
  const deltas = fresh.expected_deltas?.row_count_deltas || {};
  const commercial = fresh.expected_deltas?.logical_field_deltas || {};
  if (fresh.result !== "PASS" || fresh.target !== "production" || fresh.approved_mapping_count !== 109 || fresh.review_row_count !== 0 || fresh.blocked_row_count !== 0 || fresh.classification?.VERIFY_NO_CHANGE !== 109) fail("Fresh Discount result does not prove 109 isolated no-change rows");
  if (["products", "product_variants", "retailer_products", "offers", "price_history"].some((key) => deltas[key] !== 0)) fail("Fresh Discount report has catalogue row deltas");
  if (["offer_price_updates", "offer_shipping_updates", "offer_total_updates", "offer_stock_updates", "offer_url_updates", "mapping_url_updates", "mapping_updated_at_updates"].some((key) => commercial[key] !== 0)) fail("Fresh Discount report has commercial or mapping deltas");
  const staleOfferIds = owner.scopes?.discount_stale?.rows?.filter((row) => row.classification !== "NO_CHANGE").map((row) => String(row.offer_id)).sort((a, b) => Number(a) - Number(b));
  if (!staleOfferIds || staleOfferIds.length !== 47 || new Set(staleOfferIds).size !== 47) fail("Owner pack stale Discount scope is not exact 47");
  return { fresh, staleOfferIds };
}

function validateEvidence(freshBytes, ownerBytes) {
  if (sha256(freshBytes) !== EXPECTED_FRESH_REPORT_SHA256) fail("Fresh Discount report SHA-256 mismatch");
  if (sha256(ownerBytes) !== EXPECTED_OWNER_PACK_SHA256) fail("Owner pack SHA-256 mismatch");
  return validateEvidencePayload(JSON.parse(freshBytes), JSON.parse(ownerBytes));
}

function productionClient() {
  dotenv.config({ path: path.resolve(__dirname, "../.env.local"), quiet: true });
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL, key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key || new URL(url).hostname.split(".")[0] !== PRODUCTION_REF) fail("Production review queue credentials missing or mismatched");
  return createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } });
}

async function reconcile(options, dependencies = {}) {
  const evidence = validateEvidence(fs.readFileSync(options.freshReport), fs.readFileSync(options.ownerPack));
  const db = dependencies.client || productionClient();
  const { data: rows, error } = await db.from("product_match_review_queue").select("id,retailer_id,offer_id,review_status,source_row_fingerprint,artifact_fingerprint").eq("retailer_id", RETAILER_ID).in("offer_id", evidence.staleOfferIds).in("review_status", ["PENDING", "APPROVED", "EXPIRED"]);
  if (error) throw error;
  const active = (rows || []).filter((row) => ["PENDING", "APPROVED"].includes(row.review_status));
  const activeIds = active.map((row) => String(row.offer_id)).sort((a, b) => Number(a) - Number(b));
  const expired = (rows || []).filter((row) => row.review_status === "EXPIRED");
  const exactActive = JSON.stringify(activeIds) === JSON.stringify(evidence.staleOfferIds);
  const alreadyReconciled = active.length === 0 && expired.length === 47 && JSON.stringify(expired.map((row) => String(row.offer_id)).sort((a, b) => Number(a) - Number(b))) === JSON.stringify(evidence.staleOfferIds);
  if (!exactActive && !alreadyReconciled) fail("Active Discount review scope changed; reconciliation blocked");
  let updated = [];
  if (options.mode === "apply" && exactActive) {
    const timestamp = new Date().toISOString();
    const result = await db.from("product_match_review_queue").update({ review_status: "EXPIRED", decision_actor: "discount-evidence-reconciliation", decision_at: timestamp, execution_error_code: "EVIDENCE_SUPERSEDED", execution_error_message: "Fresh protected dry-run classified all 109 approved mappings VERIFY_NO_CHANGE; historical commercial evidence expired.", updated_at: timestamp }).eq("retailer_id", RETAILER_ID).in("id", active.map((row) => String(row.id))).in("review_status", ["PENDING", "APPROVED"]).select("id,offer_id,review_status");
    if (result.error) throw result.error;
    updated = result.data || [];
    if (updated.length !== 47 || updated.some((row) => row.review_status !== "EXPIRED")) fail("Discount reconciliation update was not exact 47");
  }
  return { result: "PASS", mode: options.mode, retailer_id: RETAILER_ID, stale_evidence_rows: 47, active_rows: active.length, already_reconciled: alreadyReconciled, would_expire: exactActive ? 47 : 0, expired: updated.length, new_review_rows: 0, catalogue_writes: 0, fresh_report_sha256: EXPECTED_FRESH_REPORT_SHA256, owner_pack_sha256: EXPECTED_OWNER_PACK_SHA256, offer_ids: evidence.staleOfferIds };
}

if (require.main === module) reconcile(parseArgs(process.argv.slice(2))).then((result) => console.log(JSON.stringify(result, null, 2))).catch((error) => { console.error(error.message); process.exitCode = 1; });
module.exports = { APPLY_CONFIRMATION, EXPECTED_FRESH_REPORT_SHA256, EXPECTED_OWNER_PACK_SHA256, parseArgs, reconcile, validateEvidence, validateEvidencePayload };
