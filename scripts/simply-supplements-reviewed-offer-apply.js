const crypto = require("node:crypto");
const fs = require("node:fs");
const path = require("node:path");
const { fingerprint } = require("./lib/retailer-offer-sync/artifacts");

process.env.RETAILER_REFRESH_PROFILE = "simply-supplements";
const engine = require("./fit-house-offer-refresh");
const authorization = require("../config/retailers/simply-supplements-reviewed-change-authorization-2026-08-03.json");

const ROOT = path.resolve(__dirname, "..");
const MANIFEST_FILE = path.join(ROOT, "tmp", "simply-supplements", "approved-existing-offers-manifest.json");
const AUTHORIZATION_ID = "simply-49-2bc798f9fb7db4af-production";

function invariant(value, message) { if (!value) throw new Error(message); }
function money(value) { return Number(value).toFixed(2); }
function actionFor(price, stock) {
  if (price && stock) return "UPDATE_PRICE_AND_STOCK";
  if (price) return "UPDATE_PRICE";
  if (stock) return "UPDATE_STOCK";
  throw new Error("reviewed row must change price/shipping/total or stock");
}
function stableRows(rows) {
  return [...rows].sort((left, right) => {
    const product = BigInt(left.external_product_id) - BigInt(right.external_product_id);
    if (product !== 0n) return product < 0n ? -1 : 1;
    const variant = BigInt(left.external_variant_id) - BigInt(right.external_variant_id);
    return variant < 0n ? -1 : variant > 0n ? 1 : 0;
  });
}
function expectedDeltas() {
  return {
    row_count_deltas: { products: 0, product_variants: 0, retailer_products: 0, offers: 0, price_history: 43 },
    logical_field_deltas: { offer_price_updates: 43, offer_shipping_updates: 6, offer_total_updates: 43, offer_stock_updates: 6, offer_url_updates: 0, mapping_url_updates: 0, mapping_updated_at_updates: 0, last_checked_at_updates: 49 },
  };
}
function rowDeltas(approved) {
  const price = approved.changed_fields.includes("price");
  const shipping = approved.changed_fields.includes("shipping_cost");
  const total = approved.changed_fields.includes("total_price");
  const stock = approved.changed_fields.includes("in_stock");
  const moneyChanged = price || shipping || total;
  return {
    row_count_deltas: { products: 0, product_variants: 0, retailer_products: 0, offers: 0, price_history: moneyChanged ? 1 : 0 },
    logical_field_deltas: { offer_price_updates: price ? 1 : 0, offer_shipping_updates: shipping ? 1 : 0, offer_total_updates: total ? 1 : 0, offer_stock_updates: stock ? 1 : 0, offer_url_updates: 0, mapping_url_updates: 0, mapping_updated_at_updates: 0, last_checked_at_updates: 1 },
  };
}
function reviewedContractRows(manifest) {
  return stableRows(manifest.rows.filter((row) => row.action !== "VERIFY_NO_CHANGE").map((row) => ({
    external_product_id: String(row.external_product_id),
    external_variant_id: String(row.external_variant_id),
    action: actionFor(row.changed_fields.some((field) => ["price", "shipping_cost", "total_price"].includes(field)), row.changed_fields.includes("in_stock")),
    changed_fields: [
      row.changed_fields.some((field) => ["price", "shipping_cost", "total_price"].includes(field)) ? "price" : null,
      row.changed_fields.includes("in_stock") ? "stock" : null,
    ].filter(Boolean).sort(),
    before: { price: money(row.prior_offer.price), shipping_cost: money(row.prior_offer.shipping_cost), total_price: money(row.prior_offer.total_price), in_stock: Boolean(row.prior_offer.in_stock), url: String(row.prior_offer.url) },
    after: { price: money(row.expected_offer.price), shipping_cost: money(row.expected_offer.shipping_cost), total_price: money(row.expected_offer.total_price), in_stock: Boolean(row.expected_offer.in_stock), url: String(row.expected_offer.url) },
  })));
}
function loadReviewedBaseline(file = MANIFEST_FILE) {
  invariant(fs.existsSync(file), "approved Simply manifest file is missing");
  const bytes = fs.readFileSync(file);
  const sha256 = crypto.createHash("sha256").update(bytes).digest("hex");
  invariant(sha256 === authorization.manifest_file_sha256, "approved Simply manifest SHA-256 mismatch");
  const manifest = JSON.parse(bytes.toString("utf8"));
  invariant(manifest.schema_version === 1 && manifest.kind === "simply-supplements-approved-existing-offer-manifest-v1", "approved Simply manifest kind mismatch");
  invariant(manifest.target_environment === "PRODUCTION" && manifest.retailer.id === 7 && manifest.retailer.slug === "simply-supplements", "approved Simply manifest target mismatch");
  invariant(manifest.manifest_fingerprint === authorization.manifest_fingerprint && manifest.source_report_fingerprint === authorization.source_report_fingerprint, "approved Simply manifest authority mismatch");
  invariant(manifest.source.shopify.semantic_source_fingerprint === authorization.source_semantic_fingerprint, "approved Simply source fingerprint mismatch");
  invariant(manifest.rows.length === 120 && manifest.rows.filter((row) => row.action !== "VERIFY_NO_CHANGE").length === 49, "approved Simply manifest scope mismatch");
  invariant(manifest.rows.filter((row) => row.changed_fields.includes("price")).length === 43 && manifest.rows.filter((row) => row.changed_fields.includes("in_stock")).length === 6 && manifest.rows.filter((row) => row.changed_fields.includes("shipping_cost")).length === 6, "approved Simply change counts mismatch");
  const reviewedRows = reviewedContractRows(manifest);
  const reviewedScopeHash = fingerprint(reviewedRows);
  return {
    approved_baseline: true,
    sha256,
    manifest: { source_capture_sha256: authorization.source_semantic_fingerprint, row_count: 49, retailer_id: "7", source_country: "GB", expected_deltas: expectedDeltas() },
    reviewed_rows: reviewedRows,
    reviewed_scope_hash: reviewedScopeHash,
    reviewedRows,
    classify({ targets, sourceVariants, sourceCapturedAt, sourceFingerprint }) {
      invariant(sourceFingerprint === authorization.source_semantic_fingerprint, "live Simply source differs from owner-reviewed source");
      invariant(targets.length === 120 && sourceVariants.length >= 120, "live Simply coverage mismatch");
      const targetByOffer = new Map(targets.map((row) => [String(row.offer_id), row]));
      const sourceByVariant = new Map(sourceVariants.map((row) => [String(row.external_variant_id), row]));
      const classified = [];
      for (const approved of manifest.rows) {
        const target = targetByOffer.get(String(approved.offer_id));
        const source = sourceByVariant.get(String(approved.external_variant_id));
        invariant(target && source, `approved Simply identity missing for offer ${approved.offer_id}`);
        invariant(String(target.retailer_product_id) === String(approved.mapping_id) && String(target.external_product_id) === String(approved.external_product_id) && String(target.external_variant_id) === String(approved.external_variant_id), `approved Simply identity drift for offer ${approved.offer_id}`);
        invariant(money(target.price) === money(approved.prior_offer.price) && money(target.shipping_cost) === money(approved.prior_offer.shipping_cost) && money(target.total_price) === money(approved.prior_offer.total_price) && Boolean(target.in_stock) === Boolean(approved.prior_offer.in_stock), `approved Simply prior state drift for offer ${approved.offer_id}`);
        invariant(target.url === approved.prior_offer.url && target.external_url === approved.external_url, `approved Simply URL drift for offer ${approved.offer_id}`);
        invariant(String(source.external_product_id) === String(approved.external_product_id) && money(source.price) === money(approved.expected_offer.price) && money(source.shipping_cost) === money(approved.expected_offer.shipping_cost) && Boolean(source.in_stock) === Boolean(approved.expected_offer.in_stock), `approved Simply live source drift for offer ${approved.offer_id}`);
        if (approved.action === "VERIFY_NO_CHANGE") continue;
        const price = approved.changed_fields.some((field) => ["price", "shipping_cost", "total_price"].includes(field));
        const stock = approved.changed_fields.includes("in_stock");
        classified.push({ offer_id: String(target.offer_id), retailer_product_id: String(target.retailer_product_id), external_product_id: String(target.external_product_id), external_variant_id: String(target.external_variant_id), action: actionFor(price, stock), changed_fields: { price, stock, url: false, blocked: false }, source_captured_at: sourceCapturedAt, source: { ...source, url: target.url, total_price: money(approved.expected_offer.total_price) }, target, expected_deltas: rowDeltas(approved) });
      }
      return { state: "DRY_RUN_READY", reason: "OWNER_REVIEWED_SIMPLY_BASELINE", rows: classified, expected_deltas: expectedDeltas(), guard_evidence: null };
    },
    buildContract({ artifact, targetEnvironment, expiresAt }) {
      invariant(targetEnvironment === "PRODUCTION" && artifact.target_environment === "PRODUCTION" && artifact.retailer_id === "7", "reviewed Simply artifact target mismatch");
      invariant(artifact.source_snapshot_fingerprint === authorization.source_semantic_fingerprint && artifact.rows.length === 49, "reviewed Simply artifact scope mismatch");
      invariant(JSON.stringify(artifact.expected_deltas) === JSON.stringify(expectedDeltas()), "reviewed Simply artifact deltas mismatch");
      const artifactRows = stableRows(artifact.rows.map((row) => ({ external_product_id: String(row.external_product_id), external_variant_id: String(row.external_variant_id), action: row.action, changed_fields: Object.entries(row.changed_fields).filter(([key, value]) => key !== "blocked" && value).map(([key]) => key).sort(), before: { price: String(row.atomic_plan.expected_state.offer.price), shipping_cost: String(row.atomic_plan.expected_state.offer.shipping_cost), total_price: String(row.atomic_plan.expected_state.offer.total_price), in_stock: Boolean(row.atomic_plan.expected_state.offer.in_stock), url: String(row.atomic_plan.expected_state.offer.url) }, after: { price: String(row.atomic_plan.offer.values.price), shipping_cost: String(row.atomic_plan.offer.values.shipping_cost), total_price: String(row.atomic_plan.offer.values.total_price), in_stock: Boolean(row.atomic_plan.offer.values.in_stock), url: String(row.atomic_plan.offer.values.url) } })));
      invariant(JSON.stringify(artifactRows) === JSON.stringify(reviewedRows), "live Simply artifact differs from approved manifest");
      const core = { schema_version: 4, kind: "retailer-reviewed-commercial-change-v4", authorization_id: AUTHORIZATION_ID, target_environment: targetEnvironment, retailer_id: "7", source_country: "GB", reviewed_manifest_sha256: sha256, reviewed_source_fingerprint: authorization.source_semantic_fingerprint, reviewed_scope_hash: reviewedScopeHash, reviewed_rows: reviewedRows, expected_deltas: expectedDeltas(), source_captured_at: artifact.source_captured_at, expires_at: expiresAt, artifact_fingerprint: artifact.artifact_fingerprint };
      return { ...core, reviewed_contract_hash: fingerprint(core) };
    },
  };
}

async function main(argv = process.argv.slice(2)) {
  invariant(argv.includes("--target=production"), "reviewed Simply baseline is production-only");
  const reviewed = loadReviewedBaseline();
  const operation = (args, diagnostic) => engine.executeRefresh(args, diagnostic, reviewed);
  const completed = await engine.runWithDiagnostic(argv, { operation });
  console.log(JSON.stringify(completed.result));
  return completed.result;
}

if (require.main === module) main().catch((error) => { console.error(error.stack || error); process.exitCode = 1; });
module.exports = { AUTHORIZATION_ID, expectedDeltas, loadReviewedBaseline, reviewedContractRows, rowDeltas };
