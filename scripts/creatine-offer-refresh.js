const fs = require("node:fs");
const path = require("node:path");
const { createClient } = require("@supabase/supabase-js");
const { classifyExistingOffers, canonicalVariantUrl } = require("./lib/retailer-offer-sync/classifier");
const { projectShopifyVariants, readShopifySnapshot } = require("./lib/shopify-snapshot-reader");

const ROOT = path.resolve(__dirname, "..");
const OUT_DIR = path.join(ROOT, "tmp", "creatine-offer-refresh");
const EXPECTED_PRODUCTION_REF = "aftboxmrdgyhizicfsfu";
const STAGING_REF = "hxnrsyyqffztlvcrtgbf";
const ACTIONS_ALLOWED_TO_APPLY = new Set([
  "VERIFY_NO_CHANGE",
  "UPDATE_PRICE",
  "UPDATE_STOCK",
  "UPDATE_PRICE_AND_STOCK",
  "UPDATE_URL",
  "UPDATE_PRICE_STOCK_URL",
]);

const RETAILER_SCOPE = Object.freeze({
  "Fit House": Object.freeze({
    expectedCount: 18,
    storeUrl: "https://fithouse.uk",
    shippingCost: "3.99",
    previousSourceProductCount: 85,
    offerIds: Object.freeze([952, 984, 954, 958, 981, 709, 697, 708, 955, 966, 941, 942, 696, 962, 968, 970, 698, 728]),
  }),
  "Discount Supplements": Object.freeze({
    expectedCount: 12,
    storeUrl: "https://www.discount-supplements.co.uk",
    shippingCost: "4.99",
    previousSourceProductCount: 3,
    offerIds: Object.freeze([763, 861, 862, 863, 864, 762, 894, 895, 896, 834, 897, 898]),
  }),
  "Jon's Supplements": Object.freeze({
    expectedCount: 5,
    storeUrl: "https://jonssupplements.co.uk",
    marketCountry: "GB",
    shippingCost: "3.99",
    previousSourceProductCount: 224,
    previousSourceVariantCount: 844,
    sourceAvailabilityGuard: Object.freeze({
      minimumVariantCount: 100,
      maximumAvailableVariantCount: 10,
      maximumAvailableVariantRatio: 0.02,
    }),
    retryOnSourceDegraded: true,
    offerIds: Object.freeze([1013, 1014, 1015, 1016, 1017]),
  }),
});

function parseArgs(args) {
  const options = { mode: "dry-run", writeArtifacts: true };
  for (const arg of args) {
    if (arg === "--dry-run") options.mode = "dry-run";
    else if (arg === "--apply") options.mode = "apply";
    else if (arg === "--summary") options.mode = "summary";
    else if (arg === "--no-artifacts") options.writeArtifacts = false;
    else throw new Error(`Unknown argument: ${arg}`);
  }
  return options;
}

function loadDotEnvLocal(env = process.env) {
  const file = path.join(ROOT, ".env.local");
  if (!fs.existsSync(file)) return;
  for (const line of fs.readFileSync(file, "utf8").split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const index = trimmed.indexOf("=");
    if (index <= 0) continue;
    const key = trimmed.slice(0, index).trim();
    const value = trimmed.slice(index + 1).trim().replace(/^['"]|['"]$/g, "");
    if (!env[key]) env[key] = value;
  }
}

function projectRefFromUrl(supabaseUrl) {
  return new URL(supabaseUrl).hostname.split(".")[0];
}

function assertExecutionEnvironment(env = process.env) {
  if (env.SAFE_UPDATE) throw new Error("SAFE_UPDATE must be unset for the automated creatine refresh");
  if (!String(env.NEXT_PUBLIC_SUPABASE_URL || "").trim()) throw new Error("NEXT_PUBLIC_SUPABASE_URL is required");
  if (!String(env.SUPABASE_SERVICE_ROLE_KEY || "").trim()) throw new Error("SUPABASE_SERVICE_ROLE_KEY is required");
  const projectRef = projectRefFromUrl(env.NEXT_PUBLIC_SUPABASE_URL);
  if (projectRef !== EXPECTED_PRODUCTION_REF || projectRef === STAGING_REF) throw new Error(`production ref mismatch: ${projectRef}`);
  if (env.GITHUB_ACTIONS === "true") {
    if (env.GITHUB_REF !== "refs/heads/main") throw new Error("scheduled creatine refresh can run only on main");
    if (!["schedule", "workflow_dispatch"].includes(env.GITHUB_EVENT_NAME)) throw new Error("scheduled creatine refresh cannot run for this GitHub event");
    if (env.GITHUB_REPOSITORY && env.GITHUB_REPOSITORY !== "SupplementScout/supplementscout") throw new Error("unexpected GitHub repository");
  }
  return projectRef;
}

function money(value) {
  if (value === null || value === undefined || String(value).trim() === "") return null;
  const number = Number(value);
  if (!Number.isFinite(number)) return null;
  return number.toFixed(2);
}

function addMoney(a, b) {
  return ((Math.round(Number(a) * 100) + Math.round(Number(b) * 100)) / 100).toFixed(2);
}

function bool(value) {
  return value === true || value === "true";
}

function authorisedOfferIds() {
  return Object.values(RETAILER_SCOPE).flatMap((scope) => scope.offerIds.map(String));
}

function policyFor(scope) {
  return {
    source_freshness_hours: 24,
    future_clock_skew_minutes: 5,
    full_snapshot_minimum_source_count_ratio: 0.9,
    required_matched_offers: scope.expectedCount,
    maximum_total_oos_ratio: 0.35,
    maximum_oos_increase_percentage_points: 0.15,
    maximum_changed_record_ratio: 0.25,
    mass_price_change_block_ratio: 0.2,
    per_row_price_hard_block_ratio: 0.6,
    per_row_price_hard_block_absolute_gbp: "20.00",
    mass_oos_block_count: 4,
    store_url: scope.storeUrl,
  };
}

async function all(client, table, columns) {
  const rows = [];
  for (let from = 0; ; from += 1000) {
    const { data, error } = await client.from(table).select(columns).range(from, from + 999);
    if (error) throw error;
    rows.push(...(data || []));
    if (!data || data.length < 1000) return rows;
  }
}

async function countRows(client, table) {
  const { count, error } = await client.from(table).select("id", { count: "exact", head: true });
  if (error) throw error;
  return count;
}

async function readProductionState(client) {
  const [retailers, products, variants, mappings, offers, priceHistory] = await Promise.all([
    all(client, "retailers", "id,name,slug,website"),
    all(client, "products", "id,name,slug,brand,category,product_format,is_active,merged_into_product_id,merged_at"),
    all(client, "product_variants", "id,product_id,display_name,is_active"),
    all(client, "retailer_products", "id,retailer_id,product_id,product_variant_id,external_product_id,external_variant_id,external_sku,external_url"),
    all(client, "offers", "id,retailer_id,product_id,product_variant_id,retailer_product_id,price,shipping_cost,total_price,in_stock,url,last_checked_at"),
    countRows(client, "price_history"),
  ]);
  return { retailers, products, variants, mappings, offers, priceHistory };
}

function tableCounts(state) {
  return {
    products: state.products.length,
    product_variants: state.variants.length,
    retailer_products: state.mappings.length,
    offers: state.offers.length,
    price_history: state.priceHistory,
  };
}

function countDelta(before, after) {
  return Object.fromEntries(Object.entries(after).map(([key, value]) => [key, Number(value) - Number(before[key])]));
}

function indexState(state) {
  return {
    retailerById: new Map(state.retailers.map((row) => [String(row.id), row])),
    productById: new Map(state.products.map((row) => [String(row.id), row])),
    variantById: new Map(state.variants.map((row) => [String(row.id), row])),
    mappingById: new Map(state.mappings.map((row) => [String(row.id), row])),
    offerById: new Map(state.offers.map((row) => [String(row.id), row])),
  };
}

function targetFor(row) {
  return {
    offer_id: String(row.offer.id),
    retailer_product_id: String(row.mapping.id),
    external_product_id: String(row.mapping.external_product_id),
    external_variant_id: String(row.mapping.external_variant_id),
    external_sku: row.mapping.external_sku || null,
    price: money(row.offer.price),
    shipping_cost: money(row.offer.shipping_cost),
    total_price: money(row.offer.total_price),
    in_stock: bool(row.offer.in_stock),
    url: row.offer.url,
    external_url: row.mapping.external_url,
  };
}

function indexRawSource(snapshot) {
  const byVariant = new Map();
  const duplicates = [];
  for (const product of snapshot.products || []) {
    for (const variant of product.variants || []) {
      const key = String(variant.id);
      if (byVariant.has(key)) duplicates.push(key);
      byVariant.set(key, { product, variant });
    }
  }
  return { byVariant, duplicates };
}

function blockSourceAnomaly(reason, detail = {}) {
  return { state: "BLOCKED", action: "BLOCK_SOURCE_ANOMALY", reason, detail };
}

function sourceSummary({ scope, snapshot, sourceVariants, sourceCapturedAt }) {
  const rawIndex = indexRawSource(snapshot);
  return {
    store_url: scope.storeUrl,
    market_country: scope.marketCountry || snapshot.market_country || null,
    product_count: snapshot.products.length,
    variant_count: sourceVariants.length,
    in_stock_variant_count: sourceVariants.filter((row) => row.in_stock).length,
    duplicate_variant_ids: rawIndex.duplicates,
    captured_at: sourceCapturedAt,
    snapshot_sha256: snapshot.snapshot_sha256,
  };
}

function detectAvailabilityCollapse({ scope, rows, snapshot, sourceVariants }) {
  const guard = scope.sourceAvailabilityGuard;
  if (!guard) return null;
  const variantCount = sourceVariants.length;
  if (variantCount < guard.minimumVariantCount) return null;
  const productCount = snapshot.products.length;
  const productCountPlausible = !scope.previousSourceProductCount || productCount / scope.previousSourceProductCount >= policyFor(scope).full_snapshot_minimum_source_count_ratio;
  const variantCountPlausible = !scope.previousSourceVariantCount || variantCount / scope.previousSourceVariantCount >= 0.9;
  if (!productCountPlausible || !variantCountPlausible) return null;
  const availableCount = sourceVariants.filter((row) => row.in_stock).length;
  const availableRatio = availableCount / Math.max(1, variantCount);
  const byVariant = new Map(sourceVariants.map((row) => [String(row.external_variant_id), row]));
  const targetVariants = rows.map((row) => {
    const source = byVariant.get(String(row.mapping.external_variant_id));
    return {
      offer_id: String(row.offer.id),
      external_variant_id: String(row.mapping.external_variant_id),
      target_in_stock: bool(row.offer.in_stock),
      source_found: Boolean(source),
      source_in_stock: source ? bool(source.in_stock) : null,
    };
  });
  const allCurrentTargetsNewOos = targetVariants.length > 0 && targetVariants.every((row) => row.target_in_stock && row.source_found && row.source_in_stock === false);
  const availableCollapsed = availableCount <= guard.maximumAvailableVariantCount || availableRatio <= guard.maximumAvailableVariantRatio;
  if (!availableCollapsed || !allCurrentTargetsNewOos) return null;
  return blockSourceAnomaly("SOURCE_DEGRADED", {
    product_count: productCount,
    variant_count: variantCount,
    in_stock_variant_count: availableCount,
    available_variant_ratio: Number(availableRatio.toFixed(4)),
    market_country: scope.marketCountry || snapshot.market_country || null,
    target_variants: targetVariants,
  });
}

function summarizeActions(rows) {
  const counts = {};
  for (const row of rows) counts[row.action] = (counts[row.action] || 0) + 1;
  return counts;
}

function plannedValues(row) {
  const price = money(row.source_values.price);
  const shipping = money(row.source_values.shipping_cost);
  return {
    price,
    shipping_cost: shipping,
    total_price: price !== null && shipping !== null ? addMoney(price, shipping) : row.target.total_price,
    in_stock: bool(row.source_values.stock),
    url: row.source_values.url,
    last_checked_at: row.source_captured_at,
  };
}

function currentMatchesTarget(row, offer, mapping) {
  return Boolean(
    offer &&
    mapping &&
    String(offer.retailer_product_id) === String(row.retailer_product_id) &&
    String(mapping.external_product_id) === String(row.external_product_id) &&
    String(mapping.external_variant_id) === String(row.external_variant_id) &&
    (mapping.external_sku || null) === (row.source.external_sku || null) &&
    money(offer.price) === money(row.target.price) &&
    money(offer.shipping_cost) === money(row.target.shipping_cost) &&
    money(offer.total_price) === money(row.target.total_price) &&
    bool(offer.in_stock) === bool(row.target.in_stock) &&
    offer.url === row.target.url &&
    mapping.external_url === row.target.external_url
  );
}

function currentMatchesPlanned(row, offer, mapping) {
  if (!offer || !mapping) return false;
  const values = plannedValues(row);
  return (
    String(offer.retailer_product_id) === String(row.retailer_product_id) &&
    String(mapping.external_product_id) === String(row.external_product_id) &&
    String(mapping.external_variant_id) === String(row.external_variant_id) &&
    (mapping.external_sku || null) === (row.source.external_sku || null) &&
    money(offer.price) === money(values.price) &&
    money(offer.shipping_cost) === money(values.shipping_cost) &&
    money(offer.total_price) === money(values.total_price) &&
    bool(offer.in_stock) === bool(values.in_stock) &&
    offer.url === values.url &&
    mapping.external_url === values.url &&
    new Date(offer.last_checked_at).toISOString() === new Date(values.last_checked_at).toISOString()
  );
}

function assertSafePlan(plan) {
  if (plan.project_ref !== EXPECTED_PRODUCTION_REF) throw new Error("plan is not bound to production");
  if (plan.status !== "DRY_RUN_READY") throw new Error("plan is not ready");
  if (plan.safe_update !== "UNSET") throw new Error("SAFE_UPDATE must be unset in the plan");
  if (!Array.isArray(plan.classified_rows) || plan.classified_rows.length !== 35) throw new Error("plan must contain exactly 35 authorised creatine offers");
  const ids = new Set(plan.classified_rows.map((row) => String(row.offer_id)));
  if (ids.size !== 35) throw new Error("plan contains duplicate offer IDs");
  for (const row of plan.classified_rows) {
    if (!ACTIONS_ALLOWED_TO_APPLY.has(row.action)) throw new Error(`unsupported action ${row.action} for offer ${row.offer_id}`);
    if (row.changed_fields?.blocked) throw new Error(`blocked row reached apply for offer ${row.offer_id}`);
  }
}

function scopeRowsForRetailer({ retailerName, scope, state }) {
  const indexes = indexState(state);
  const offerIds = new Set(scope.offerIds.map(String));
  const targetOffers = state.offers.filter((offer) => offerIds.has(String(offer.id)));
  if (targetOffers.length !== scope.expectedCount) throw new Error(`${retailerName}: expected ${scope.expectedCount} authorised offers, found ${targetOffers.length}`);
  return targetOffers.map((offer) => {
    const retailer = indexes.retailerById.get(String(offer.retailer_id));
    const product = indexes.productById.get(String(offer.product_id));
    const variant = indexes.variantById.get(String(offer.product_variant_id));
    const mapping = indexes.mappingById.get(String(offer.retailer_product_id));
    if (!retailer || retailer.name !== retailerName) throw new Error(`${retailerName}: offer ${offer.id} retailer mismatch`);
    if (!mapping || String(mapping.retailer_id) !== String(retailer.id)) throw new Error(`${retailerName}: offer ${offer.id} mapping mismatch`);
    if (!product || String(product.category || "").toLowerCase() !== "creatine" || product.is_active !== true || product.merged_into_product_id || product.merged_at) throw new Error(`${retailerName}: offer ${offer.id} is not active creatine`);
    if (!variant || variant.is_active !== true) throw new Error(`${retailerName}: offer ${offer.id} variant missing/inactive`);
    if (!mapping.external_product_id || !mapping.external_variant_id) throw new Error(`${retailerName}: offer ${offer.id} mapping is missing Shopify identity`);
    return { offer, retailer, product, variant, mapping };
  }).sort((left, right) => Number(left.offer.id) - Number(right.offer.id));
}

function classifyRetailerScope({ retailerName, scope, state, snapshot, sourceCapturedAt, now }) {
  const rows = scopeRowsForRetailer({ retailerName, scope, state });
  const sourceVariants = projectShopifyVariants(snapshot, { shippingCost: scope.shippingCost });
  const degraded = detectAvailabilityCollapse({ scope, rows, snapshot, sourceVariants });
  const classification = degraded || classifyExistingOffers({
    targets: rows.map(targetFor),
    sourceVariants,
    policy: policyFor(scope),
    guardScope: {
      name: `CREATINE_${retailerName.toUpperCase().replace(/[^A-Z0-9]+/g, "_")}_${scope.expectedCount}`,
      retailer: retailerName,
    },
    sourceCapturedAt,
    now,
    sourceProductCount: snapshot.products.length,
    previousSourceProductCount: scope.previousSourceProductCount,
  });
  const classifiedRows = [];
  if (Array.isArray(classification.rows)) {
    const sourceByVariant = new Map(sourceVariants.map((source) => [String(source.external_variant_id), source]));
    for (const classified of classification.rows) {
      const local = rows.find((row) => String(row.offer.id) === String(classified.offer_id));
      const source = sourceByVariant.get(String(local.mapping.external_variant_id));
      classifiedRows.push({
        ...classified,
        retailer: retailerName,
        product_name: local.product.name,
        variant_name: local.variant.display_name,
        mapping_id: Number(local.mapping.id),
        source_values: {
          price: money(source.price),
          stock: bool(source.in_stock),
          shipping_cost: money(source.shipping_cost),
          url: canonicalVariantUrl(scope.storeUrl, source.product_handle, source.external_variant_id),
        },
      });
    }
  }
  const source = sourceSummary({ scope, snapshot, sourceVariants, sourceCapturedAt });
  return {
    retailer: retailerName,
    source,
    classification,
    classified_rows: classifiedRows,
  };
}

async function readRetailerSnapshot({ scope, sourceCapturedAt, fetchImpl, noCache = false }) {
  return readShopifySnapshot({
    storeUrl: scope.storeUrl,
    pageLimit: 250,
    maximumPages: 20,
    timeoutMs: 20_000,
    capturedAt: sourceCapturedAt,
    fetchImpl,
    marketCountry: scope.marketCountry || null,
    noCache,
  });
}

async function classifyRetailerScopeWithRetry({ retailerName, scope, state, sourceCapturedAt, now, fetchImpl }) {
  const snapshot = await readRetailerSnapshot({ scope, sourceCapturedAt, fetchImpl });
  const result = classifyRetailerScope({ retailerName, scope, state, snapshot, sourceCapturedAt, now });
  if (result.classification.reason !== "SOURCE_DEGRADED" || !scope.retryOnSourceDegraded) return result;
  const retrySnapshot = await readRetailerSnapshot({ scope, sourceCapturedAt, fetchImpl, noCache: true });
  const retryResult = classifyRetailerScope({ retailerName, scope, state, snapshot: retrySnapshot, sourceCapturedAt, now });
  return {
    ...result,
    source: {
      ...result.source,
      retry: {
        source: retryResult.source,
        classification: retryResult.classification.state === "DRY_RUN_READY"
          ? { state: retryResult.classification.state, counts: summarizeActions(retryResult.classification.rows) }
          : retryResult.classification,
      },
    },
    classification: blockSourceAnomaly("SOURCE_DEGRADED", {
      ...result.classification.detail,
      retry_state: retryResult.classification.state,
      retry_reason: retryResult.classification.reason || null,
      retry_in_stock_variant_count: retryResult.source.in_stock_variant_count,
      retry_snapshot_sha256: retryResult.source.snapshot_sha256,
    }),
    classified_rows: [],
  };
}

async function buildRefreshPlan({ client, fetchImpl = globalThis.fetch, now = new Date() }) {
  const state = await readProductionState(client);
  const sourceCapturedAt = now.toISOString();
  const retailerResults = [];
  const classifiedRows = [];
  for (const [retailerName, scope] of Object.entries(RETAILER_SCOPE)) {
    const result = await classifyRetailerScopeWithRetry({ retailerName, scope, state, sourceCapturedAt, now, fetchImpl });
    retailerResults.push({
      retailer: retailerName,
      expected_offers: scope.expectedCount,
      found_offers: scopeRowsForRetailer({ retailerName, scope, state }).length,
      source: result.source,
      classification: result.classification.state === "DRY_RUN_READY"
        ? {
            state: result.classification.state,
            counts: summarizeActions(result.classification.rows),
            expected_deltas: result.classification.expected_deltas,
            action_manifest_fingerprint: result.classification.action_manifest_fingerprint,
            guard_evidence: result.classification.guard_evidence,
          }
        : result.classification,
    });
    classifiedRows.push(...result.classified_rows);
  }
  const blockers = retailerResults.filter((entry) => entry.classification.state !== "DRY_RUN_READY");
  const plan = {
    generated_at: sourceCapturedAt,
    project_ref: EXPECTED_PRODUCTION_REF,
    safe_update: process.env.SAFE_UPDATE || "UNSET",
    state_origin: "FRESH_DATABASE_AND_SOURCE_READS",
    prior_artifact_input: false,
    scope: Object.fromEntries(Object.entries(RETAILER_SCOPE).map(([name, scope]) => [name, { expected_count: scope.expectedCount, offer_ids: [...scope.offerIds] }])),
    status: blockers.length === 0 && classifiedRows.length === 35 ? "DRY_RUN_READY" : "BLOCKED",
    retailer_results: retailerResults,
    classification_counts: summarizeActions(classifiedRows),
    classified_rows: classifiedRows.sort((left, right) => Number(left.offer_id) - Number(right.offer_id)),
    guard_scopes: retailerResults
      .map((entry) => entry.classification.guard_evidence)
      .filter(Boolean),
    blockers,
  };
  if (plan.status === "DRY_RUN_READY") assertSafePlan(plan);
  return plan;
}

async function priceHistoryExists(client, row, values) {
  const { data, error } = await client
    .from("price_history")
    .select("id")
    .eq("offer_id", row.offer_id)
    .eq("checked_at", values.last_checked_at)
    .limit(1);
  if (error) throw error;
  return (data || []).length > 0;
}

function assertNoDuplicateMappings(state) {
  const byRetailerVariant = new Map();
  const duplicates = [];
  for (const mapping of state.mappings) {
    if (!mapping.external_variant_id) continue;
    const key = `${mapping.retailer_id}:${mapping.external_variant_id}`;
    const ids = byRetailerVariant.get(key) || [];
    ids.push(mapping.id);
    byRetailerVariant.set(key, ids);
  }
  for (const [key, ids] of byRetailerVariant) if (ids.length > 1) duplicates.push({ key, ids });
  return duplicates;
}

async function applyRefreshPlan({ client, plan }) {
  assertSafePlan(plan);
  const before = await readProductionState(client);
  const beforeCounts = tableCounts(before);
  const indexes = indexState(before);
  const rowsAlreadyApplied = [];
  for (const row of plan.classified_rows) {
    const offer = indexes.offerById.get(String(row.offer_id));
    const mapping = indexes.mappingById.get(String(row.retailer_product_id));
    if (currentMatchesPlanned(row, offer, mapping)) {
      rowsAlreadyApplied.push(row.offer_id);
      continue;
    }
    if (!currentMatchesTarget(row, offer, mapping)) throw new Error(`offer ${row.offer_id} current state drifted after dry-run`);
  }
  const rowResults = [];
  for (const row of plan.classified_rows) {
    const offer = indexes.offerById.get(String(row.offer_id));
    const mapping = indexes.mappingById.get(String(row.retailer_product_id));
    const values = plannedValues(row);
    if (currentMatchesPlanned(row, offer, mapping)) {
      rowResults.push({ offer_id: row.offer_id, action: row.action, idempotent_replay: true, changed_fields: row.changed_fields });
      continue;
    }
    const { data: updatedOffer, error: offerError } = await client
      .from("offers")
      .update({
        price: values.price,
        shipping_cost: values.shipping_cost,
        total_price: values.total_price,
        in_stock: values.in_stock,
        url: values.url,
        last_checked_at: values.last_checked_at,
      })
      .eq("id", row.offer_id)
      .eq("retailer_product_id", row.retailer_product_id)
      .select("id,price,shipping_cost,total_price,in_stock,url,last_checked_at");
    if (offerError) throw offerError;
    if (!updatedOffer || updatedOffer.length !== 1) throw new Error(`offer ${row.offer_id} update affected ${updatedOffer?.length || 0} rows`);
    let updatedMapping = null;
    if (row.changed_fields.url) {
      const { data, error } = await client
        .from("retailer_products")
        .update({ external_url: values.url })
        .eq("id", row.retailer_product_id)
        .eq("external_product_id", row.external_product_id)
        .eq("external_variant_id", row.external_variant_id)
        .select("id,external_url");
      if (error) throw error;
      if (!data || data.length !== 1) throw new Error(`mapping ${row.retailer_product_id} URL update affected ${data?.length || 0} rows`);
      updatedMapping = data[0];
    }
    let priceHistoryInserted = false;
    if (row.changed_fields.price && !(await priceHistoryExists(client, row, values))) {
      const { error } = await client.from("price_history").insert({
        offer_id: row.offer_id,
        price: values.price,
        shipping_cost: values.shipping_cost,
        total_price: values.total_price,
        checked_at: values.last_checked_at,
      });
      if (error) throw error;
      priceHistoryInserted = true;
    }
    rowResults.push({
      offer_id: row.offer_id,
      action: row.action,
      idempotent_replay: false,
      changed_fields: row.changed_fields,
      before: {
        price: money(offer.price),
        stock: bool(offer.in_stock),
        url: offer.url,
        last_checked_at: offer.last_checked_at,
      },
      after: updatedOffer[0],
      mapping_after: updatedMapping,
      price_history_inserted: priceHistoryInserted,
    });
  }
  const after = await readProductionState(client);
  const afterCounts = tableCounts(after);
  const delta = countDelta(beforeCounts, afterCounts);
  const duplicates = assertNoDuplicateMappings(after);
  const result = {
    generated_at: new Date().toISOString(),
    project_ref: EXPECTED_PRODUCTION_REF,
    rows_checked: plan.classified_rows.length,
    rows_applied_or_verified: rowResults.length,
    rows_already_applied: rowsAlreadyApplied.length,
    before_counts: beforeCounts,
    after_counts: afterCounts,
    count_delta: delta,
    logical_deltas: {
      price_changes: rowResults.filter((row) => row.changed_fields?.price && !row.idempotent_replay).length,
      stock_changes: rowResults.filter((row) => row.changed_fields?.stock && !row.idempotent_replay).length,
      url_changes: rowResults.filter((row) => row.changed_fields?.url && !row.idempotent_replay).length,
      last_checked_at_updates: rowResults.filter((row) => !row.idempotent_replay).length,
      price_history_inserts: delta.price_history,
    },
    duplicate_external_variant_checks: duplicates,
    row_results: rowResults,
  };
  result.status =
    result.rows_checked === 35 &&
    result.rows_applied_or_verified === 35 &&
    delta.products === 0 &&
    delta.product_variants === 0 &&
    delta.retailer_products === 0 &&
    delta.offers === 0 &&
    result.logical_deltas.price_history_inserts === rowResults.filter((row) => row.price_history_inserted).length &&
    duplicates.length === 0
      ? "PASS"
      : "FAIL";
  return result;
}

function renderSummary(report) {
  const lines = [];
  lines.push("## Daily creatine offer refresh");
  lines.push("");
  lines.push(`Status: ${report.status}`);
  lines.push(`Mode: ${report.mode}`);
  lines.push(`Project ref: ${report.project_ref}`);
  if (report.plan) {
    lines.push(`Rows: ${report.plan.classified_rows.length}`);
    lines.push(`Classification counts: ${JSON.stringify(report.plan.classification_counts)}`);
  }
  if (report.apply_result) {
    lines.push(`Apply status: ${report.apply_result.status}`);
    lines.push(`Logical deltas: ${JSON.stringify(report.apply_result.logical_deltas)}`);
    lines.push(`Row-count deltas: ${JSON.stringify(report.apply_result.count_delta)}`);
  }
  if (report.blockers?.length) lines.push(`Blockers: ${JSON.stringify(report.blockers)}`);
  return `${lines.join("\n")}\n`;
}

async function run(options = {}) {
  const mode = options.mode || "dry-run";
  const env = options.env || process.env;
  loadDotEnvLocal(env);
  const projectRef = assertExecutionEnvironment(env);
  const client = options.client || createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const plan = await buildRefreshPlan({ client, fetchImpl: options.fetchImpl || globalThis.fetch, now: options.now || new Date() });
  const report = {
    generated_at: new Date().toISOString(),
    mode,
    project_ref: projectRef,
    status: plan.status,
    workflow_run_context: {
      repository: env.GITHUB_REPOSITORY || "SupplementScout/supplementscout",
      run_id: env.GITHUB_RUN_ID || null,
      run_attempt: env.GITHUB_RUN_ATTEMPT || null,
      event_name: env.GITHUB_EVENT_NAME || "local",
      ref: env.GITHUB_REF || null,
      trigger_type: env.CREATINE_REFRESH_TRIGGER_TYPE || env.GITHUB_EVENT_NAME || "local",
    },
    plan,
    blockers: plan.blockers,
  };
  if (mode === "apply") {
    if (plan.status !== "DRY_RUN_READY") {
      report.status = "BLOCKED";
    } else {
      report.apply_result = await applyRefreshPlan({ client, plan });
      report.status = report.apply_result.status === "PASS" ? "PASS" : "FAIL";
    }
  }
  if (options.writeArtifacts !== false) {
    fs.mkdirSync(OUT_DIR, { recursive: true });
    fs.writeFileSync(path.join(OUT_DIR, `creatine-offer-refresh-${mode}.json`), `${JSON.stringify(report, null, 2)}\n`);
    fs.writeFileSync(path.join(OUT_DIR, `creatine-offer-refresh-${mode}.md`), renderSummary(report));
  }
  return report;
}

if (require.main === module) {
  run(parseArgs(process.argv.slice(2))).then((report) => {
    console.log(JSON.stringify({
      status: report.status,
      mode: report.mode,
      project_ref: report.project_ref,
      rows: report.plan?.classified_rows?.length || 0,
      classification_counts: report.plan?.classification_counts || {},
      logical_deltas: report.apply_result?.logical_deltas || null,
      blockers: report.blockers?.map((entry) => ({ retailer: entry.retailer, state: entry.classification?.state, reason: entry.classification?.reason })) || [],
      artifact: path.relative(ROOT, path.join(OUT_DIR, `creatine-offer-refresh-${report.mode}.json`)).replaceAll("\\", "/"),
    }, null, 2));
    if (!["DRY_RUN_READY", "PASS"].includes(report.status)) process.exitCode = 2;
  }).catch((error) => {
    console.error(error?.message || error);
    process.exit(1);
  });
}

module.exports = {
  ACTIONS_ALLOWED_TO_APPLY,
  EXPECTED_PRODUCTION_REF,
  RETAILER_SCOPE,
  addMoney,
  applyRefreshPlan,
  assertExecutionEnvironment,
  assertSafePlan,
  authorisedOfferIds,
  buildRefreshPlan,
  classifyRetailerScope,
  currentMatchesPlanned,
  currentMatchesTarget,
  money,
  parseArgs,
  plannedValues,
  policyFor,
  renderSummary,
  run,
  scopeRowsForRetailer,
  summarizeActions,
};
