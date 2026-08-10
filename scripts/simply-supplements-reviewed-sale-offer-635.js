const crypto = require("node:crypto");
const fs = require("node:fs");
const path = require("node:path");
const { fingerprint } = require("./lib/retailer-offer-sync/artifacts");
const { canonicalJson } = require("./lib/canonical-json");

process.env.RETAILER_REFRESH_PROFILE = "simply-supplements";
const engine = require("./fit-house-offer-refresh");

const ROOT = path.resolve(__dirname, "..");
const AUTHORIZATION_FILE = path.join(
  ROOT,
  "config",
  "retailers",
  "simply-supplements-reviewed-sale-offer-635-2026-08-10.json",
);
const AUTHORIZATION_FILE_SHA256 = "c1d1c794f39ea955df7c048f4856b6058efbd7df60a6c7e42ef7c057ba5fd1b9";

function invariant(value, message) {
  if (!value) throw new Error(message);
}

function money(value) {
  const result = Number(value).toFixed(2);
  invariant(/^\d+\.\d{2}$/.test(result), "invalid reviewed GBP value");
  return result;
}

function sameJson(left, right) {
  return canonicalJson(left) === canonicalJson(right);
}

function expectedDeltas(authorization) {
  return JSON.parse(JSON.stringify(authorization.expected_deltas));
}

function reviewedRows(authorization) {
  const row = authorization.row;
  return [{
    external_product_id: row.external_product_id,
    external_variant_id: row.external_variant_id,
    action: row.action,
    changed_fields: [...row.changed_fields],
    before: {
      price: row.old_price,
      shipping_cost: row.shipping_cost,
      total_price: row.old_total_price,
      in_stock: row.old_stock,
      url: row.offer_url,
    },
    after: {
      price: row.new_price,
      shipping_cost: row.shipping_cost,
      total_price: row.new_total_price,
      in_stock: row.new_stock,
      url: row.offer_url,
    },
  }];
}

function validateAuthorization(authorization) {
  invariant(authorization.schema_version === 1, "reviewed Simply sale schema mismatch");
  invariant(
    authorization.kind === "simply-supplements-reviewed-single-sale-v1"
      && authorization.authorization_id === "simply-offer635-sale-20260810-production",
    "reviewed Simply sale authority mismatch",
  );
  invariant(
    authorization.authority === "owner-approved-chat-2026-08-10-after-exact-identity-and-price-review",
    "reviewed Simply sale owner approval mismatch",
  );
  invariant(
    authorization.target_environment === "PRODUCTION"
      && authorization.target_project_ref === "aftboxmrdgyhizicfsfu"
      && authorization.retailer_id === "7"
      && authorization.retailer_slug === "simply-supplements",
    "reviewed Simply sale target mismatch",
  );
  invariant(/^[0-9a-f]{64}$/.test(authorization.source_capture_sha256), "reviewed Simply source hash mismatch");
  invariant(Number.isFinite(Date.parse(authorization.source_evidence_captured_at)), "reviewed Simply source timestamp mismatch");
  invariant(authorization.row_count === 1, "reviewed Simply sale row count mismatch");
  invariant(sameJson(authorization.expected_deltas, {
    row_count_deltas: { products: 0, product_variants: 0, retailer_products: 0, offers: 0, price_history: 1 },
    logical_field_deltas: { offer_price_updates: 1, offer_shipping_updates: 0, offer_total_updates: 1, offer_stock_updates: 0, offer_url_updates: 0, mapping_url_updates: 0, mapping_updated_at_updates: 0, last_checked_at_updates: 1 },
  }), "reviewed Simply sale deltas mismatch");
  const row = authorization.row;
  invariant(
    row.offer_id === "635" && row.mapping_id === "627"
      && row.canonical_product_id === "628" && row.canonical_variant_id === "644"
      && row.external_product_id === "15934232691037"
      && row.external_variant_id === "64643271033181"
      && row.external_sku === "C697" && row.external_gtin === "5056049518292",
    "reviewed Simply sale identity mismatch",
  );
  invariant(
    row.old_price === "6.41" && row.new_price === "2.13"
      && row.source_compare_at_price === "10.69"
      && row.shipping_cost === "1.99"
      && row.old_total_price === "8.40" && row.new_total_price === "4.12"
      && row.old_stock === true && row.new_stock === true,
    "reviewed Simply sale commercial values mismatch",
  );
  invariant(
    row.action === "UPDATE_PRICE" && sameJson(row.changed_fields, ["price"])
      && new URL(row.offer_url).hostname === "www.awin1.com"
      && new URL(row.mapping_url).hostname === "www.simplysupplements.co.uk"
      && sameJson(row.external_options, { Size: "180 tablets", Subscription: "[Multibuy 1]" }),
    "reviewed Simply sale action mismatch",
  );
}

function loadReviewedSale(file = AUTHORIZATION_FILE) {
  const bytes = fs.readFileSync(file);
  const sha256 = crypto.createHash("sha256").update(bytes).digest("hex");
  invariant(sha256 === AUTHORIZATION_FILE_SHA256, "reviewed Simply sale file SHA-256 mismatch");
  const authorization = JSON.parse(bytes.toString("utf8"));
  validateAuthorization(authorization);
  const stableRows = reviewedRows(authorization);
  const reviewedScopeHash = fingerprint(stableRows);
  return {
    approved_baseline: true,
    sha256,
    authorization,
    manifest: {
      source_capture_sha256: authorization.source_capture_sha256,
      row_count: 1,
      retailer_id: "7",
      source_country: "GB",
      expected_deltas: expectedDeltas(authorization),
    },
    reviewed_rows: stableRows,
    reviewed_scope_hash: reviewedScopeHash,
    classify({ targets, sourceVariants, sourceCapturedAt, sourceFingerprint }) {
      const row = authorization.row;
      invariant(sourceFingerprint === authorization.source_capture_sha256, "live Simply source differs from owner-reviewed sale source");
      invariant(targets.length === 120, "live Simply approved scope mismatch");
      const target = targets.find((candidate) => String(candidate.offer_id) === row.offer_id);
      const source = sourceVariants.find((candidate) => String(candidate.external_variant_id) === row.external_variant_id);
      invariant(target && source, "reviewed Simply sale identity is missing");
      invariant(
        String(target.retailer_product_id) === row.mapping_id
          && String(target.external_product_id) === row.external_product_id
          && String(target.external_variant_id) === row.external_variant_id
          && target.external_sku === row.external_sku
          && money(target.price) === row.old_price
          && money(target.shipping_cost) === row.shipping_cost
          && money(target.total_price) === row.old_total_price
          && Boolean(target.in_stock) === row.old_stock
          && target.url === row.offer_url
          && target.external_url === row.mapping_url,
        "reviewed Simply sale prior state drift",
      );
      invariant(
        String(source.external_product_id) === row.external_product_id
          && String(source.external_variant_id) === row.external_variant_id
          && source.external_sku === row.external_sku
          && money(source.price) === row.new_price
          && money(source.shipping_cost) === row.shipping_cost
          && Boolean(source.in_stock) === row.new_stock,
        "reviewed Simply sale source drift",
      );
      return {
        state: "DRY_RUN_READY",
        reason: "OWNER_REVIEWED_SIMPLY_SINGLE_SALE",
        rows: [{
          offer_id: row.offer_id,
          retailer_product_id: row.mapping_id,
          external_product_id: row.external_product_id,
          external_variant_id: row.external_variant_id,
          action: row.action,
          changed_fields: { price: true, stock: false, url: false, blocked: false },
          source_captured_at: sourceCapturedAt,
          source: { ...source, url: row.offer_url, total_price: row.new_total_price },
          target,
          expected_deltas: expectedDeltas(authorization),
        }],
        expected_deltas: expectedDeltas(authorization),
        guard_evidence: null,
      };
    },
    buildContract({ artifact, targetEnvironment, expiresAt }) {
      invariant(
        targetEnvironment === "PRODUCTION"
          && artifact.target_environment === "PRODUCTION"
          && artifact.retailer_id === "7"
          && artifact.source_snapshot_fingerprint === authorization.source_capture_sha256
          && artifact.rows.length === 1,
        "reviewed Simply sale artifact target or source mismatch",
      );
      invariant(sameJson(artifact.expected_deltas, expectedDeltas(authorization)), "reviewed Simply sale artifact deltas mismatch");
      const artifactRow = artifact.rows[0];
      const observed = [{
        external_product_id: String(artifactRow.external_product_id),
        external_variant_id: String(artifactRow.external_variant_id),
        action: artifactRow.action,
        changed_fields: Object.entries(artifactRow.changed_fields)
          .filter(([key, value]) => key !== "blocked" && value)
          .map(([key]) => key)
          .sort(),
        before: {
          price: money(artifactRow.atomic_plan.expected_state.offer.price),
          shipping_cost: money(artifactRow.atomic_plan.expected_state.offer.shipping_cost),
          total_price: money(artifactRow.atomic_plan.expected_state.offer.total_price),
          in_stock: Boolean(artifactRow.atomic_plan.expected_state.offer.in_stock),
          url: String(artifactRow.atomic_plan.expected_state.offer.url),
        },
        after: {
          price: money(artifactRow.atomic_plan.offer.values.price),
          shipping_cost: money(artifactRow.atomic_plan.offer.values.shipping_cost),
          total_price: money(artifactRow.atomic_plan.offer.values.total_price),
          in_stock: Boolean(artifactRow.atomic_plan.offer.values.in_stock),
          url: String(artifactRow.atomic_plan.offer.values.url),
        },
      }];
      invariant(sameJson(observed, stableRows), "live Simply sale artifact differs from owner approval");
      const core = {
        schema_version: 4,
        kind: "retailer-reviewed-commercial-change-v4",
        authorization_id: authorization.authorization_id,
        target_environment: targetEnvironment,
        retailer_id: "7",
        source_country: authorization.source_country,
        reviewed_manifest_sha256: sha256,
        reviewed_source_fingerprint: authorization.source_capture_sha256,
        reviewed_scope_hash: reviewedScopeHash,
        reviewed_rows: stableRows,
        expected_deltas: expectedDeltas(authorization),
        source_captured_at: artifact.source_captured_at,
        expires_at: expiresAt,
        artifact_fingerprint: artifact.artifact_fingerprint,
      };
      return { ...core, reviewed_contract_hash: fingerprint(core) };
    },
  };
}

async function main(argv = process.argv.slice(2)) {
  invariant(argv.includes("--target=production"), "reviewed Simply sale is production-only");
  const reviewed = loadReviewedSale();
  const operation = (args, diagnostic) => engine.executeRefresh(args, diagnostic, reviewed);
  const completed = await engine.runWithDiagnostic(argv, { operation });
  console.log(JSON.stringify(completed.result));
  return completed.result;
}

if (require.main === module) main().catch((error) => {
  console.error(error.stack || error);
  process.exitCode = 1;
});

module.exports = {
  AUTHORIZATION_FILE,
  AUTHORIZATION_FILE_SHA256,
  expectedDeltas,
  loadReviewedSale,
  reviewedRows,
  validateAuthorization,
};
