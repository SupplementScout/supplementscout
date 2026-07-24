const { actionForChanges, deltasForChanges, sumDeltas } = require("./action-contract");
const { fingerprint, sortRows } = require("./artifacts");

const EXECUTABLE_ACTIONS = Object.freeze([
  "VERIFY_NO_CHANGE",
  "UPDATE_PRICE",
  "UPDATE_STOCK",
  "UPDATE_PRICE_AND_STOCK",
  "UPDATE_URL",
  "UPDATE_PRICE_STOCK_URL",
]);

const money = (value) => Math.round(Number(value) * 100);
const identityValue = (value) => value == null || String(value).trim() === "" ? null : String(value);
function canonicalVariantUrl(baseUrl, productHandle, variantId) { const url = new URL(`/products/${productHandle}`, baseUrl); url.searchParams.set("variant", String(variantId)); return url.href; }
function block(reason, detail = {}) { return { state: "BLOCKED", action: reason === "IDENTITY_DRIFT" ? "BLOCK_IDENTITY_DRIFT" : "BLOCK_SOURCE_ANOMALY", reason, detail }; }

function guardResult(guard, changed, total, threshold, comparison) {
  const ratio = total === 0 ? 0 : changed / total;
  const blocked = comparison === ">=" ? ratio >= threshold : ratio > threshold;
  return { guard, total, changed, ratio, threshold, comparison, result: blocked ? "BLOCK" : "PASS" };
}

function buildGuardEvidence(rows, policy, guardScope = {}) {
  const scopeName = String(guardScope.name || "RETAILER_OFFER_SYNC").trim();
  if (!scopeName) throw new Error("guard scope name is required");
  const scopeRowIds = rows.map((row) => String(row.offer_id));
  if (new Set(scopeRowIds).size !== rows.length) throw new Error("guard evidence contains duplicate row IDs");
  const actionCounts = Object.fromEntries(EXECUTABLE_ACTIONS.map((action) => [
    action,
    rows.filter((row) => row.action === action).length,
  ]));
  const reconciledTotal = Object.values(actionCounts).reduce((sum, count) => sum + count, 0);
  if (reconciledTotal !== rows.length) throw new Error("guard evidence action counts do not reconcile");
  const noChange = actionCounts.VERIFY_NO_CHANGE;
  const changed = rows.length - noChange;
  if (rows.every((row) => row.action === "VERIFY_NO_CHANGE") && changed !== 0) {
    throw new Error("all-no-change guard scope has a non-zero changed count");
  }
  const priceChanged = rows.filter((row) => row.changed_fields.price).length;
  const newOos = rows.filter((row) => row.target.in_stock && !row.source.in_stock).length;
  const totalOos = rows.filter((row) => !row.source.in_stock).length;
  const previousOos = rows.filter((row) => !row.target.in_stock).length;
  const oosIncrease = totalOos - previousOos;
  const changedGuard = guardResult(
    "MASS_CHANGE",
    changed,
    rows.length,
    policy.maximum_changed_record_ratio,
    ">",
  );
  const priceGuard = guardResult(
    "MASS_PRICE",
    priceChanged,
    rows.length,
    policy.mass_price_change_block_ratio,
    ">=",
  );
  const oosChecks = [
    {
      metric: "new_oos_count",
      total: rows.length,
      changed: newOos,
      ratio: rows.length === 0 ? 0 : newOos / rows.length,
      threshold: policy.mass_oos_block_count,
      comparison: ">=",
      result: newOos >= policy.mass_oos_block_count ? "BLOCK" : "PASS",
    },
    {
      metric: "total_oos_ratio",
      total: rows.length,
      changed: totalOos,
      ratio: rows.length === 0 ? 0 : totalOos / rows.length,
      threshold: policy.maximum_total_oos_ratio,
      comparison: ">",
      result: rows.length > 0 && totalOos / rows.length > policy.maximum_total_oos_ratio ? "BLOCK" : "PASS",
    },
    {
      metric: "oos_increase_ratio",
      total: rows.length,
      changed: oosIncrease,
      ratio: rows.length === 0 ? 0 : oosIncrease / rows.length,
      threshold: policy.maximum_oos_increase_percentage_points,
      comparison: ">",
      result: rows.length > 0 && oosIncrease / rows.length > policy.maximum_oos_increase_percentage_points ? "BLOCK" : "PASS",
    },
  ];
  const massOosBlocked = newOos > 0 && oosChecks.some((check) => check.result === "BLOCK");
  return {
    scope_name: scopeName,
    retailer: guardScope.retailer || null,
    scope_row_ids: scopeRowIds,
    total: rows.length,
    no_change: noChange,
    changed,
    changed_ratio: rows.length === 0 ? 0 : changed / rows.length,
    action_counts: actionCounts,
    blocked_rows: 0,
    reconciled_total: reconciledTotal,
    reconciled: true,
    current_oos: totalOos,
    previous_oos: previousOos,
    new_oos: newOos,
    oos_increase: oosIncrease,
    guards: [
      {
        guard: "MASS_OOS",
        total: rows.length,
        changed: newOos,
        ratio: rows.length === 0 ? 0 : newOos / rows.length,
        threshold: {
          new_oos_count: policy.mass_oos_block_count,
          total_oos_ratio: policy.maximum_total_oos_ratio,
          oos_increase_ratio: policy.maximum_oos_increase_percentage_points,
        },
        comparison: "COMPOSITE",
        result: massOosBlocked ? "BLOCK" : "PASS",
        checks: oosChecks,
      },
      changedGuard,
      priceGuard,
    ],
  };
}

function aggregateBlock(reason, detail, rows, guardEvidence) {
  const expectedDeltas = sumDeltas(rows);
  return {
    ...block(reason, detail),
    rows,
    expected_deltas: expectedDeltas,
    guard_evidence: guardEvidence,
  };
}

function classifyExistingOffers({ targets, sourceVariants, policy, sourceCapturedAt, now = new Date(), sourceProductCount, previousSourceProductCount, guardScope }) {
  const captured = new Date(sourceCapturedAt);
  const age = now.getTime() - captured.getTime();
  if (!Number.isFinite(captured.getTime()) || age > policy.source_freshness_hours * 3600000 || age < -policy.future_clock_skew_minutes * 60000) return block("SOURCE_FRESHNESS");
  if (previousSourceProductCount && sourceProductCount / previousSourceProductCount < policy.full_snapshot_minimum_source_count_ratio) return block("SOURCE_COLLAPSE");
  const byVariant = new Map();
  for (const row of sourceVariants) { const key = String(row.external_variant_id); if (!byVariant.has(key)) byVariant.set(key, []); byVariant.get(key).push(row); }
  if (targets.length !== policy.required_matched_offers) return block("TARGET_MANIFEST_COVERAGE", { expected: policy.required_matched_offers, actual: targets.length });
  const rows = [];
  for (const target of sortRows(targets)) {
    const candidates = byVariant.get(String(target.external_variant_id)) || [];
    if (candidates.length !== 1) return block("IDENTITY_DRIFT", { offer_id: target.offer_id, matches: candidates.length });
    const source = candidates[0];
    if (String(source.external_product_id) !== String(target.external_product_id)) return block("IDENTITY_DRIFT", { offer_id: target.offer_id });
    if (!policy.ignore_source_sku && identityValue(source.external_sku) !== identityValue(target.external_sku)) return block("IDENTITY_DRIFT", { offer_id: target.offer_id, field: "external_sku" });
    let sourceUrl;
    try { sourceUrl = policy.source_url_mode === "provided" ? new URL(source.url).href : canonicalVariantUrl(policy.store_url, source.product_handle, source.external_variant_id); } catch { return block("INVALID_URL"); }
    const allowedHosts = new Set((policy.allowed_url_hosts || [new URL(policy.store_url).hostname]).map((value) => String(value).toLowerCase().replace(/^www\./, "")));
    if (!allowedHosts.has(new URL(sourceUrl).hostname.toLowerCase().replace(/^www\./, ""))) return block("INVALID_URL_DOMAIN");
    const price = money(source.price) !== money(target.price);
    const stock = Boolean(source.in_stock) !== Boolean(target.in_stock);
    const url = sourceUrl !== target.url || sourceUrl !== target.external_url;
    const shipping = source.shipping_cost !== target.shipping_cost;
    const totalChanged = source.total_price === undefined
      ? price
      : identityValue(source.total_price) !== identityValue(target.total_price);
    if (shipping && !price) return block("SHIPPING_POLICY_DRIFT", { offer_id: target.offer_id });
    const absolute = Math.abs(money(source.price) - money(target.price)) / 100;
    const ratio = Math.abs(money(source.price) - money(target.price)) / Math.max(1, money(target.price));
    if (price && (ratio >= policy.per_row_price_hard_block_ratio || absolute >= Number(policy.per_row_price_hard_block_absolute_gbp))) return block("HARD_PRICE_ANOMALY", { offer_id: target.offer_id });
    const changed_fields = { price, stock, url, blocked: false };
    const semanticSource = {
      external_product_id: String(source.external_product_id), external_variant_id: String(source.external_variant_id), external_sku: identityValue(source.external_sku),
      product_handle: source.product_handle, price: String(source.price), shipping_cost: source.shipping_cost, in_stock: Boolean(source.in_stock),
    };
    rows.push({ offer_id: String(target.offer_id), retailer_product_id: String(target.retailer_product_id), external_product_id: String(target.external_product_id), external_variant_id: String(target.external_variant_id), action: actionForChanges(changed_fields), changed_fields, source_captured_at: sourceCapturedAt, source: semanticSource, target, expected_deltas: deltasForChanges(changed_fields, { shippingChanged: source.shipping_cost !== target.shipping_cost, totalChanged }) });
  }
  const guardEvidence = buildGuardEvidence(rows, policy, guardScope);
  const massOos = guardEvidence.guards.find((guard) => guard.guard === "MASS_OOS");
  const massChange = guardEvidence.guards.find((guard) => guard.guard === "MASS_CHANGE");
  const massPrice = guardEvidence.guards.find((guard) => guard.guard === "MASS_PRICE");
  if (massOos.result === "BLOCK") return aggregateBlock("MASS_OOS", { new_oos: guardEvidence.new_oos, total_oos: guardEvidence.current_oos, previous_oos: guardEvidence.previous_oos, oos_increase: guardEvidence.oos_increase }, rows, guardEvidence);
  if (massChange.result === "BLOCK") return aggregateBlock("MASS_CHANGE", { changed: guardEvidence.changed }, rows, guardEvidence);
  if (massPrice.result === "BLOCK") return aggregateBlock("MASS_PRICE", { price_changed: massPrice.changed }, rows, guardEvidence);
  const result = { state: "DRY_RUN_READY", rows, expected_deltas: sumDeltas(rows), guard_evidence: guardEvidence };
  return {
    ...result,
    action_manifest_fingerprint: fingerprint({
      state: result.state,
      rows: result.rows,
      expected_deltas: result.expected_deltas,
    }),
  };
}
module.exports = { buildGuardEvidence, canonicalVariantUrl, classifyExistingOffers };
