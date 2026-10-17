const MAX_REVIEWED_ROWS = 200;

function invariant(condition, message) {
  if (!condition) throw new Error(message);
}

function nullable(value) {
  const normalized = String(value ?? "").trim();
  return normalized || null;
}

function buildStateRequest(manifest, rows, helpers) {
  invariant(manifest?.kind === "reviewed-catalogue-package-v2", "Reviewed V2 manifest required");
  invariant(Array.isArray(rows) && rows.length > 0 && rows.length <= MAX_REVIEWED_ROWS, "Reviewed V2 state request row count invalid");
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

async function validatePlans(client, plans) {
  for (const entry of plans) {
    const rows = (await client.query(
      "select public.validate_product_import_plan_read_only($1::jsonb) result",
      [entry.importPlan],
    )).rows;
    invariant(rows.length === 1 && rows[0].result?.valid === true, "Reviewed V2 atomic plan validation failed");
  }
}

module.exports = {
  MAX_REVIEWED_ROWS,
  buildExecutionStateRequest,
  buildStateRequest,
  createStateClient,
  readState,
  validatePlans,
  validateState,
};
