const MAX_REVIEWED_ROWS = 200;
const { CONTRACT_KIND: REVIEWED_V3_KIND, buildV3Envelope } = require("./reviewed-catalogue-v3");
const { canonicalJson } = require("./canonical-json");

const V2_VALIDATION_SQL = "select public.validate_product_import_plan_read_only($1::jsonb) result";
const V3_VALIDATION_SQL = "select public.validate_reviewed_catalogue_v3_plan_read_only($1::jsonb,$2::jsonb) result";
const ROW_MANIFEST_OFFER_SYNC_KEYS = Object.freeze({
  retailer: Object.freeze(["id", "name", "slug", "website"]),
  products: Object.freeze(["id", "name", "is_active", "merged_into_product_id", "product_format"]),
  product_variants: Object.freeze(["id", "product_id", "variant_key", "display_name", "flavour_code", "flavour_label", "size_value", "size_unit", "pack_count", "product_format", "is_active", "is_default"]),
  retailer_products: Object.freeze(["id", "retailer_id", "product_id", "product_variant_id", "external_product_id", "external_variant_id", "external_sku", "external_options", "external_name", "external_slug", "external_gtin", "external_url", "match_method", "match_confidence", "updated_at"]),
  offers: Object.freeze(["id", "product_id", "retailer_id", "product_variant_id", "retailer_product_id", "price", "shipping_cost", "total_price", "in_stock", "url", "last_checked_at"]),
  price_history: Object.freeze(["id"]),
});

function invariant(condition, message) {
  if (!condition) throw new Error(message);
}

function nullable(value) {
  const normalized = String(value ?? "").trim();
  return normalized || null;
}

function buildStateRequest(manifest, rows, helpers) {
  invariant(
    ["reviewed-catalogue-package-v2", REVIEWED_V3_KIND].includes(manifest?.kind),
    "Reviewed V2 or V3 manifest required",
  );
  invariant(Array.isArray(rows) && rows.length > 0 && rows.length <= MAX_REVIEWED_ROWS, "Reviewed state request row count invalid");
  const requested = rows.map((row) => {
    const product = helpers.productData(row);
    return {
      external_gtin: nullable(helpers.externalGtin(row)),
      external_product_id: nullable(row.external_product_id),
      external_sku: nullable(row.external_sku),
      external_url: nullable(helpers.directUrl(row)),
      external_variant_id: nullable(row.external_variant_id),
      product_brand: nullable(product.brand),
      product_category: nullable(product.category),
      product_gtin: nullable(helpers.productGtin(row)),
      product_id: nullable(row.product_id),
      product_name_key: nullable(helpers.productNameKey(product.name)),
      product_slug: nullable(product.slug),
      product_variant_id: nullable(row.product_variant_id),
    };
  });
  invariant(new Set(requested.map(row => row.external_variant_id)).size === requested.length, "Reviewed V2 state request source identity duplicated");
  return {
    schema_version: 1,
    target_environment: manifest.target_environment,
    target_project_ref: manifest.target_project_ref,
    retailer: { id: manifest.retailer.id, slug: manifest.retailer.slug },
    rows: requested,
  };
}

function buildExecutionStateRequest(manifest, entries) {
  invariant(manifest?.target_environment && manifest?.target_project_ref, "Reviewed execution target required");
  invariant(Array.isArray(entries) && entries.length > 0 && entries.length <= MAX_REVIEWED_ROWS, "Reviewed V2 state request row count invalid");
  return {
    schema_version: 1,
    target_environment: manifest.target_environment,
    target_project_ref: manifest.target_project_ref,
    retailer: { id: manifest.retailer.id, slug: manifest.retailer.slug },
    rows: entries.map(entry => {
      const plan = entry.resolved_plan;
      const product = plan.product.values || plan.expected_state.product || {};
      const mapping = plan.retailer_product.values;
      return {
        external_gtin: nullable(mapping.external_gtin),
        external_product_id: nullable(mapping.external_product_id),
        external_sku: nullable(mapping.external_sku),
        external_url: nullable(mapping.external_url),
        external_variant_id: nullable(mapping.external_variant_id),
        product_brand: nullable(product.brand),
        product_category: nullable(product.category),
        product_gtin: nullable(product.gtin),
        product_id: nullable(plan.product.id),
        product_name_key: null,
        product_slug: nullable(product.slug),
        product_variant_id: nullable(plan.product_variant.id),
      };
    }),
  };
}

function buildRowManifestStateRequests({ targetEnvironment, targetProjectRef, retailer, rows }) {
  invariant(targetEnvironment && targetProjectRef, "Row-manifest state target required");
  invariant(retailer?.id && retailer?.slug, "Row-manifest state retailer required");
  invariant(Array.isArray(rows) && rows.length > 0, "Row-manifest state rows required");
  const normalized = rows.map(row => {
    for (const field of ["mapping_id", "offer_id", "external_product_id", "external_variant_id", "canonical_product_id", "canonical_variant_id"])
      invariant(nullable(row[field]), `Row-manifest state ${field} required`);
    return {
      mapping_id: String(row.mapping_id),
      offer_id: String(row.offer_id),
      external_product_id: String(row.external_product_id),
      external_variant_id: String(row.external_variant_id),
      canonical_product_id: String(row.canonical_product_id),
      canonical_variant_id: String(row.canonical_variant_id),
    };
  }).sort((left, right) => left.external_variant_id.localeCompare(right.external_variant_id));
  for (const field of ["mapping_id", "offer_id", "external_variant_id"])
    invariant(new Set(normalized.map(row => row[field])).size === normalized.length, `Row-manifest state duplicate ${field}`);
  const requests = [];
  for (let index = 0; index < normalized.length; index += MAX_REVIEWED_ROWS) {
    requests.push({
      schema_version: 1,
      target_environment: targetEnvironment,
      target_project_ref: targetProjectRef,
      retailer: { id: retailer.id, slug: retailer.slug },
      rows: normalized.slice(index, index + MAX_REVIEWED_ROWS).map(row => ({
        external_gtin: null,
        external_product_id: row.external_product_id,
        external_sku: null,
        external_url: null,
        external_variant_id: row.external_variant_id,
        product_brand: null,
        product_category: null,
        product_gtin: null,
        product_id: row.canonical_product_id,
        product_name_key: null,
        product_slug: null,
        product_variant_id: row.canonical_variant_id,
      })),
    });
  }
  return { requests, rows: normalized };
}

function mergeBoundedStates(states, requests) {
  invariant(states.length > 0 && states.length === requests.length, "Bounded state response count mismatch");
  const first = validateState(states[0], requests[0]);
  const merged = {
    schema_version: 1,
    target_environment: first.target_environment,
    target_project_ref: first.target_project_ref,
    retailer: first.retailer,
    products: [],
    product_variants: [],
    retailer_products: [],
    offers: [],
    price_history: [],
    counts: first.counts,
  };
  for (let index = 0; index < states.length; index += 1) {
    const state = validateState(states[index], requests[index]);
    invariant(canonicalJson(state.counts) === canonicalJson(first.counts), "Bounded state authoritative counts disagree");
    for (const key of ["products", "product_variants", "retailer_products", "offers", "price_history"]) {
      const byId = new Map(merged[key].map(row => [String(row.id), row]));
      for (const row of state[key]) {
        invariant(row.id != null, `Bounded state ${key} identity missing`);
        const existing = byId.get(String(row.id));
        invariant(!existing || canonicalJson(existing) === canonicalJson(row), `Bounded state ${key} identity conflict`);
        if (!existing) {
          merged[key].push(row);
          byId.set(String(row.id), row);
        }
      }
    }
  }
  for (const key of ["products", "product_variants", "retailer_products", "offers", "price_history"])
    merged[key].sort((left, right) => String(left.id).localeCompare(String(right.id), undefined, { numeric: true }));
  return merged;
}

function projectClosedRow(row, keys, label) {
  invariant(row && typeof row === "object" && !Array.isArray(row), `Row-manifest bounded ${label} invalid`);
  for (const key of keys)
    invariant(Object.hasOwn(row, key) && row[key] !== undefined, `Row-manifest bounded ${label} ${key} missing`);
  return Object.fromEntries(keys.map(key => [key, row[key]]));
}

function projectRowManifestOfferSyncState(state) {
  return {
    ...state,
    retailer: projectClosedRow(state.retailer, ROW_MANIFEST_OFFER_SYNC_KEYS.retailer, "retailer"),
    products: state.products.map(row => projectClosedRow(row, ROW_MANIFEST_OFFER_SYNC_KEYS.products, "product")),
    product_variants: state.product_variants.map(row => projectClosedRow(row, ROW_MANIFEST_OFFER_SYNC_KEYS.product_variants, "product_variant")),
    retailer_products: state.retailer_products.map(row => projectClosedRow(row, ROW_MANIFEST_OFFER_SYNC_KEYS.retailer_products, "retailer_product")),
    offers: state.offers.map(row => projectClosedRow(row, ROW_MANIFEST_OFFER_SYNC_KEYS.offers, "offer")),
    price_history: state.price_history.map(row => projectClosedRow(row, ROW_MANIFEST_OFFER_SYNC_KEYS.price_history, "price_history")),
  };
}

async function readRowManifestState(client, options) {
  const built = buildRowManifestStateRequests(options);
  const states = [];
  for (const request of built.requests) states.push(await readState(client, request));
  const state = mergeBoundedStates(states, built.requests);
  const mappings = new Map(state.retailer_products.map(row => [String(row.id), row]));
  const offers = new Map(state.offers.map(row => [String(row.id), row]));
  const products = new Set(state.products.map(row => String(row.id)));
  const variants = new Set(state.product_variants.map(row => String(row.id)));
  for (const row of built.rows) {
    const mapping = mappings.get(row.mapping_id);
    const offer = offers.get(row.offer_id);
    invariant(mapping
      && String(mapping.retailer_id) === String(options.retailer.id)
      && String(mapping.product_id) === row.canonical_product_id
      && String(mapping.product_variant_id) === row.canonical_variant_id
      && String(mapping.external_product_id) === row.external_product_id
      && String(mapping.external_variant_id) === row.external_variant_id,
    "Row-manifest bounded mapping identity mismatch");
    invariant(offer
      && String(offer.retailer_id) === String(options.retailer.id)
      && String(offer.retailer_product_id) === row.mapping_id
      && String(offer.product_id) === row.canonical_product_id
      && String(offer.product_variant_id) === row.canonical_variant_id,
    "Row-manifest bounded offer identity mismatch");
    invariant(products.has(row.canonical_product_id), "Row-manifest bounded product missing");
    invariant(variants.has(row.canonical_variant_id), "Row-manifest bounded variant missing");
  }
  const mappingIds = new Set(built.rows.map(row => row.mapping_id));
  const offerIds = new Set(built.rows.map(row => row.offer_id));
  state.retailer_products = state.retailer_products.filter(row => mappingIds.has(String(row.id)));
  state.offers = state.offers.filter(row => offerIds.has(String(row.id)) && mappingIds.has(String(row.retailer_product_id)));
  state.price_history = state.price_history.filter(row => offerIds.has(String(row.offer_id)));
  invariant(state.retailer_products.length === built.rows.length && state.offers.length === built.rows.length,
    "Row-manifest bounded scope incomplete");
  return projectRowManifestOfferSyncState(state);
}

function validateState(state, request) {
  invariant(state && state.schema_version === 1, "Reviewed catalogue state response invalid");
  invariant(state.target_environment === request.target_environment, "Reviewed catalogue state environment mismatch");
  invariant(state.target_project_ref === request.target_project_ref, "Reviewed catalogue state project mismatch");
  invariant(String(state.retailer?.id) === String(request.retailer.id) && state.retailer?.slug === request.retailer.slug, "Reviewed catalogue state retailer mismatch");
  for (const key of ["products", "product_variants", "retailer_products", "offers", "price_history"]) {
    invariant(Array.isArray(state[key]), `Reviewed catalogue state ${key} invalid`);
  }
  invariant(state.counts && typeof state.counts === "object", "Reviewed catalogue state counts invalid");
  return state;
}

async function readState(client, request) {
  const rows = (await client.query(
    "select public.read_reviewed_catalogue_import_state($1::jsonb) state",
    [request],
  )).rows;
  invariant(rows.length === 1, "Reviewed catalogue state RPC must return exactly once");
  return validateState(rows[0].state, request);
}

function createStateClient(state) {
  const tables = Object.freeze({
    retailers: [state.retailer],
    products: state.products,
    product_variants: state.product_variants,
    retailer_products: state.retailer_products,
    offers: state.offers,
    price_history: state.price_history,
  });

  class ReadQuery {
    constructor(table) {
      invariant(Object.hasOwn(tables, table), `Reviewed state table ${table} is not available`);
      this.table = table;
      this.filters = [];
      this.limitCount = null;
    }

    select() { return this; }
    eq(field, value) { this.filters.push({ field, value }); return this; }
    limit(count) { this.limitCount = count; return this; }
    insert() { throw new Error("Reviewed V2 state provider is read only"); }
    update() { throw new Error("Reviewed V2 state provider is read only"); }
    upsert() { throw new Error("Reviewed V2 state provider is read only"); }

    rows() {
      const matched = tables[this.table].filter(row => this.filters.every(filter => String(row[filter.field]) === String(filter.value)));
      return this.limitCount == null ? matched : matched.slice(0, this.limitCount);
    }

    maybeSingle() {
      const rows = this.rows();
      return Promise.resolve(rows.length > 1
        ? { data: null, error: new Error("Reviewed state maybeSingle returned multiple rows") }
        : { data: rows[0] || null, error: null });
    }

    then(resolve, reject) {
      try { resolve({ data: this.rows(), error: null }); } catch (error) { reject(error); }
    }
  }

  return {
    from(table) { return new ReadQuery(table); },
    rpc() { throw new Error("Reviewed V2 state provider does not expose mutation RPCs"); },
  };
}

async function validatePlans(client, plans, context = null) {
  for (const entry of plans) {
    const plan = entry.importPlan;
    const isV3 = context?.manifest?.kind === REVIEWED_V3_KIND;
    const reviewed = isV3
      ? context.profile.rows.find(row => row.plan_fingerprint === plan.meta.plan_fingerprint)
      : null;
    const envelope = isV3
      ? buildV3Envelope({
          ...context,
          reviewed,
          entry: { importPlan: plan },
        })
      : null;
    const rows = (await client.query(
      isV3 ? V3_VALIDATION_SQL : V2_VALIDATION_SQL,
      isV3 ? [plan, envelope] : [plan],
    )).rows;
    invariant(rows.length === 1 && rows[0].result?.valid === true, "Reviewed atomic plan validation failed");
  }
}

module.exports = {
  MAX_REVIEWED_ROWS,
  buildExecutionStateRequest,
  buildRowManifestStateRequests,
  buildStateRequest,
  createStateClient,
  mergeBoundedStates,
  projectRowManifestOfferSyncState,
  readState,
  readRowManifestState,
  ROW_MANIFEST_OFFER_SYNC_KEYS,
  validatePlans,
  validateState,
  V2_VALIDATION_SQL,
  V3_VALIDATION_SQL,
};
