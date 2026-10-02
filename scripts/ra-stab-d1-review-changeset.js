const fs = require("node:fs");
const path = require("node:path");
const dotenv = require("dotenv");
const { createClient } = require("@supabase/supabase-js");
const {
  buildPublicationRpcRequest,
  canonicalJson,
  sha256,
  sqlJsonCatalogueCounts,
  validateManifest,
} = require("./lib/automation-review-publisher");

const ROOT = path.resolve(__dirname, "..");
const DEFAULT_DECISION_PACK = path.join(ROOT, "docs", "retailer-automation", "evidence", "RA-STAB-01-BACKLOG-OWNER-DECISION-PACK-2026-10-02.json");
const DEFAULT_IDENTITY_AUDIT = path.join(ROOT, "docs", "retailer-automation", "evidence", "RA-STAB-01-10REPS-IDENTITY-AUDIT-2026-10-02.json");
const DEFAULT_OUTPUT = path.join(ROOT, "tmp", "ra-stab-d1-review-changeset", "changeset.json");
const SEALED_EVIDENCE_OUTPUT = path.join(ROOT, "docs", "retailer-automation", "evidence", "RA-STAB-01-D1-REVIEW-QUEUE-CHANGESET-2026-10-02.json");
const DECISION_ID = "RA-STAB-01-D1";
const ACTIVE_STATUSES = ["PENDING", "APPROVED"];
const RETAILERS = Object.freeze([
  Object.freeze({ id: "9", name: "Fit House", slug: "fit-house", scope: "fit_house" }),
  Object.freeze({ id: "14", name: "10 Reps", slug: "10-reps", scope: "ten_reps" }),
]);

function fail(message) {
  throw new Error(message);
}

function readJson(file) {
  return JSON.parse(fs.readFileSync(file, "utf8"));
}

function parseArgs(argv) {
  const options = {
    decisionPack: DEFAULT_DECISION_PACK,
    identityAudit: DEFAULT_IDENTITY_AUDIT,
    output: DEFAULT_OUTPUT,
    envFile: path.join(ROOT, ".env.local"),
  };
  for (const arg of argv) {
    const match = arg.match(/^--([a-z0-9-]+)=(.+)$/i);
    if (!match) fail(`Invalid argument ${arg}; this command has no apply mode`);
    const key = match[1].replace(/-([a-z])/g, (_, letter) => letter.toUpperCase());
    if (!["decisionPack", "identityAudit", "output", "envFile"].includes(key)) fail(`Unknown argument ${arg}; this command has no apply mode`);
    options[key] = path.resolve(match[2]);
  }
  const relativeOutput = path.relative(path.join(ROOT, "tmp"), options.output);
  const tmpOutput = relativeOutput && !relativeOutput.startsWith("..") && !path.isAbsolute(relativeOutput);
  if (!tmpOutput && options.output !== SEALED_EVIDENCE_OUTPUT) fail("Output must stay inside repository tmp or use the exact sealed D1 evidence path");
  return options;
}

function flattenTenRepsRows(decisionPack) {
  return decisionPack.ten_reps_decision.groups.flatMap((group) => group.rows.map((row) => ({
    ...row,
    owner_choice: group.owner_choice,
  })));
}

function exactIds(rows) {
  return rows.map((row) => String(row.offer_id)).sort((a, b) => Number(a) - Number(b));
}

function mapById(rows, label) {
  const map = new Map();
  for (const row of rows || []) {
    const id = String(row.id);
    if (map.has(id)) fail(`Duplicate ${label} ${id}`);
    map.set(id, row);
  }
  return map;
}

function value(value) {
  return value == null ? null : String(value);
}

function assertEqual(actual, expected, message) {
  if (actual !== expected) fail(`${message}: expected ${JSON.stringify(expected)}, received ${JSON.stringify(actual)}`);
}

function validateDecision(decisionPack, identityAudit) {
  if (decisionPack.schema_version !== "ra-stab-01-backlog-owner-decision-pack-v1" || decisionPack.task_id !== "RA-STAB-01") fail("Unexpected D1 decision pack");
  if (decisionPack.owner_decision?.decision_id !== DECISION_ID || decisionPack.owner_decision?.status !== "APPROVED_READ_ONLY_CHANGESET_PREPARATION") fail("RA-STAB-01-D1 is not recorded as approved");
  if (decisionPack.authority.catalogue_writes_authorized !== 0 || decisionPack.authority.control_writes_authorized !== 0 || decisionPack.authority.identity_rebinds_authorized !== 0 || decisionPack.authority.ra_004_actions_authorized !== 0) fail("D1 contains forbidden write authority");
  if (decisionPack.authority.review_queue_changeset_preparation_authorized !== true || decisionPack.authority.review_queue_publication_authorized !== false) fail("D1 read-only authority boundary is invalid");
  const fitRows = decisionPack.fit_house_decision.rows;
  const tenRows = flattenTenRepsRows(decisionPack);
  if (fitRows.length !== 14 || tenRows.length !== 16 || new Set([...exactIds(fitRows), ...exactIds(tenRows)]).size !== 30) fail("D1 must bind exactly 14 Fit House and 16 10 Reps offers");
  if (fitRows.some((row) => row.owner_choice !== "ACCEPT_OBSERVED_STOCK_AS_BUSINESS_DISPOSITION")) fail("Every Fit House row must carry the approved business disposition");
  if (tenRows.some((row) => row.owner_choice !== "KEEP_UNCHANGED_READ_ONLY_IDENTITY_REVIEW")) fail("Every 10 Reps row must remain unchanged for read-only identity review");
  if (identityAudit.task_id !== "RA-STAB-01" || identityAudit.result !== "READ_ONLY_CLASSIFIED_NO_AUTOMATIC_ACTION" || identityAudit.classification_summary?.recommended_current_catalogue_action !== "KEEP_ALL_16_UNCHANGED") fail("Unexpected 10 Reps identity audit");
  const auditIds = exactIds(identityAudit.classes.flatMap((group) => group.offer_ids.map((offerId) => ({ offer_id: offerId }))));
  if (canonicalJson(auditIds) !== canonicalJson(exactIds(tenRows))) fail("10 Reps identity audit scope does not match D1");
  return { fitRows, tenRows };
}

function classByOffer(identityAudit) {
  const out = new Map();
  for (const group of identityAudit.classes) for (const offerId of group.offer_ids) out.set(String(offerId), group);
  return out;
}

function validateProductionState(decisionPack, state, fitRows, tenRows) {
  if (!state?.captured_at || Number.isNaN(Date.parse(state.captured_at))) fail("Production state capture timestamp is required");
  const retailers = mapById(state.retailers, "retailer");
  for (const retailer of RETAILERS) assertEqual(retailers.get(retailer.id)?.name, retailer.name, `Retailer ${retailer.id} binding drift`);
  const offers = mapById(state.offers, "offer");
  const mappings = mapById(state.mappings, "mapping");
  const allRows = [...fitRows.map((row) => ({ ...row, retailer_id: "9" })), ...tenRows.map((row) => ({ ...row, retailer_id: "14" }))];
  if (offers.size !== 30 || mappings.size !== 30) fail("Production state must contain exactly 30 offers and 30 mappings");
  for (const expected of allRows) {
    const offer = offers.get(String(expected.offer_id));
    const mapping = mappings.get(String(expected.mapping_id));
    if (!offer || !mapping) fail(`Missing production state for offer ${expected.offer_id}`);
    assertEqual(value(offer.retailer_id), expected.retailer_id, `Offer ${expected.offer_id} retailer drift`);
    assertEqual(value(mapping.retailer_id), expected.retailer_id, `Mapping ${expected.mapping_id} retailer drift`);
    assertEqual(value(offer.retailer_product_id), String(expected.mapping_id), `Offer ${expected.offer_id} mapping drift`);
    assertEqual(value(offer.product_id), String(expected.canonical_product_id), `Offer ${expected.offer_id} product drift`);
    assertEqual(value(offer.product_variant_id), String(expected.canonical_variant_id), `Offer ${expected.offer_id} variant drift`);
    assertEqual(value(mapping.product_id), String(expected.canonical_product_id), `Mapping ${expected.mapping_id} product drift`);
    assertEqual(value(mapping.product_variant_id), String(expected.canonical_variant_id), `Mapping ${expected.mapping_id} variant drift`);
    assertEqual(value(mapping.external_product_id), String(expected.external_product_id), `Mapping ${expected.mapping_id} external product drift`);
    assertEqual(value(mapping.external_variant_id), String(expected.external_variant_id), `Mapping ${expected.mapping_id} external variant drift`);
    assertEqual(value(offer.price), String(expected.price_gbp), `Offer ${expected.offer_id} price drift`);
    assertEqual(Boolean(offer.in_stock), expected.database_in_stock, `Offer ${expected.offer_id} stock drift`);
    assertEqual(value(offer.url), expected.url, `Offer ${expected.offer_id} URL drift`);
  }
  const activeRows = state.active_rows || [];
  if (activeRows.some((row) => !RETAILERS.some((retailer) => retailer.id === String(row.retailer_id)))) fail("Production active-row baseline contains another retailer");
  const catalogueCounts = sqlJsonCatalogueCounts(state.catalogue_counts);
  return { offers, mappings, catalogueCounts, activeRows };
}

function beforeState(offer, mapping) {
  return {
    offer_id: String(offer.id),
    retailer_product_id: String(mapping.id),
    product_id: String(offer.product_id),
    product_variant_id: String(offer.product_variant_id),
    price: value(offer.price),
    shipping_cost: value(offer.shipping_cost),
    total_price: value(offer.total_price),
    in_stock: offer.in_stock === true,
    url: value(offer.url),
    external_url: value(mapping.external_url),
    external_product_id: value(mapping.external_product_id),
    external_variant_id: value(mapping.external_variant_id),
  };
}

function productLabels(state) {
  return {
    products: mapById(state.products, "product"),
    variants: mapById(state.variants, "variant"),
  };
}

function productTitle(labels, row) {
  return labels.products.get(String(row.canonical_product_id))?.name || `Product ${row.canonical_product_id}`;
}

function variantTitle(labels, row) {
  const variant = labels.variants.get(String(row.canonical_variant_id));
  return variant?.display_name || variant?.name || variant?.flavour || `Variant ${row.canonical_variant_id}`;
}

function commonRow({ retailer, row, offer, mapping, labels, source, generatedAt, expiresAt }) {
  return {
    snapshot_id: `ra-stab-01-d1-${retailer.slug}-${source.workflow_run_id}`,
    review_item_id: `${retailer.id}:${row.offer_id}:${DECISION_ID}`,
    source_record_id: `${retailer.id}:${row.offer_id}`,
    retailer: retailer.name,
    product_title: productTitle(labels, row),
    variant_title: variantTitle(labels, row),
    primary_status: "PENDING",
    canonical_candidates: [],
    source_sku: value(mapping.external_sku),
    source_gtin: value(mapping.external_gtin),
    source_weight: null,
    source_price: String(row.price_gbp),
    source_url: row.url,
    retailer_id: retailer.id,
    retailer_product_id: String(row.mapping_id),
    offer_id: String(row.offer_id),
    current_product_id: String(row.canonical_product_id),
    current_variant_id: String(row.canonical_variant_id),
    proposed_product_id: null,
    proposed_variant_id: null,
    review_status: "PENDING",
    before_state: beforeState(offer, mapping),
    source_captured_at: source.db_baseline_captured_at,
    expires_at: expiresAt,
    workflow_run_url: `https://github.com/SupplementScout/supplementscout/actions/runs/${source.workflow_run_id}`,
    artifact_url: `https://github.com/SupplementScout/supplementscout/actions/runs/${source.workflow_run_id}/artifacts/${source.artifact_id}`,
    artifact_fingerprint: source.source_fingerprint,
    plan_fingerprint: null,
    plan_artifact_sha256: source.dry_run_file_sha256,
    generated_at: generatedAt,
  };
}

function fitManifestRows(decisionPack, rows, stateIndex, labels, generatedAt) {
  const retailer = RETAILERS[0];
  const source = { ...decisionPack.ordinary_run.fit_house, workflow_run_id: decisionPack.ordinary_run.workflow_run_id };
  const expiresAt = "2026-10-09T09:01:19.133Z";
  return rows.map((row) => {
    const semantic = {
      contract: "ra-stab-01-d1-review-row-v1",
      decision_id: DECISION_ID,
      retailer_id: retailer.id,
      offer_id: String(row.offer_id),
      mapping_id: String(row.mapping_id),
      external_product_id: String(row.external_product_id),
      external_variant_id: String(row.external_variant_id),
      price_gbp: String(row.price_gbp),
      database_in_stock: row.database_in_stock,
      observed_in_stock: row.observed_in_stock,
      source_fingerprint: source.source_fingerprint,
      owner_choice: row.owner_choice,
    };
    return {
      ...commonRow({ retailer, row, offer: stateIndex.offers.get(String(row.offer_id)), mapping: stateIndex.mappings.get(String(row.mapping_id)), labels, source, generatedAt, expiresAt }),
      reason_codes: "STOCK_CHANGE",
      confidence: "HIGH",
      suggested_action: "MANUAL_REVIEW",
      review_kind: "COMMERCIAL_CHANGE",
      operation_type: "UPDATE_STOCK",
      proposed_state: {
        price: String(row.price_gbp),
        in_stock: row.observed_in_stock,
        identity_change: false,
        owner_business_disposition: true,
      },
      impact_summary: {
        catalogue_writes: 0,
        review_queue_writes: 0,
        publication_authorized: false,
        execution_authorized: false,
      },
      source_evidence: {
        decision_id: DECISION_ID,
        workflow_run_id: source.workflow_run_id,
        artifact_id: source.artifact_id,
        artifact_digest: source.artifact_digest,
        report_sha256: source.dry_run_file_sha256,
        source_fingerprint: source.source_fingerprint,
        reason: decisionPack.fit_house_decision.reason,
        owner_choice: row.owner_choice,
      },
      source_row_fingerprint: sha256(semantic),
    };
  });
}

function tenRepsManifestRows(decisionPack, identityAudit, rows, stateIndex, labels, generatedAt) {
  const retailer = RETAILERS[1];
  const source = { ...decisionPack.ordinary_run.ten_reps, workflow_run_id: decisionPack.ordinary_run.workflow_run_id };
  const classes = classByOffer(identityAudit);
  const expiresAt = "2026-10-09T09:02:10.360Z";
  return rows.map((row) => {
    const evidenceClass = classes.get(String(row.offer_id));
    const candidate = String(row.offer_id) === "3388" ? [{ external_product_id: "9237", external_variant_id: "11696", status: "READ_ONLY_CANDIDATE_NOT_AUTHORIZED" }] : [];
    const semantic = {
      contract: "ra-stab-01-d1-review-row-v1",
      decision_id: DECISION_ID,
      retailer_id: retailer.id,
      offer_id: String(row.offer_id),
      mapping_id: String(row.mapping_id),
      external_product_id: String(row.external_product_id),
      external_variant_id: String(row.external_variant_id),
      source_fingerprint: source.source_fingerprint,
      evidence_class: evidenceClass.class,
      owner_choice: row.owner_choice,
    };
    return {
      ...commonRow({ retailer, row, offer: stateIndex.offers.get(String(row.offer_id)), mapping: stateIndex.mappings.get(String(row.mapping_id)), labels, source, generatedAt, expiresAt }),
      reason_codes: "SOURCE_MISSING",
      confidence: "LOW",
      canonical_candidates: candidate,
      suggested_action: "MANUAL_REVIEW",
      review_kind: "IDENTITY_CONFLICT",
      operation_type: "MANUAL_REVIEW_IDENTITY",
      proposed_state: {
        catalogue_action: "KEEP_UNCHANGED",
        identity_review: "READ_ONLY",
        automatic_action: false,
      },
      impact_summary: {
        catalogue_writes: 0,
        review_queue_writes: 0,
        publication_authorized: false,
        identity_rebind_authorized: false,
        stock_change_authorized: false,
      },
      source_evidence: {
        decision_id: DECISION_ID,
        workflow_run_id: source.workflow_run_id,
        artifact_id: source.artifact_id,
        artifact_digest: source.artifact_digest,
        report_sha256: source.dry_run_file_sha256,
        source_fingerprint: source.source_fingerprint,
        reason: decisionPack.ten_reps_decision.reason,
        evidence_class: evidenceClass.class,
        owner_choice: row.owner_choice,
      },
      source_row_fingerprint: sha256(semantic),
    };
  });
}

function manifestFor(retailer, decisionPack, rows, generatedAt) {
  const source = decisionPack.ordinary_run[retailer.scope];
  return validateManifest({
    schema_version: 1,
    kind: "automation-review-publisher-manifest",
    generated_at: generatedAt,
    retailer_id: retailer.id,
    retailer: retailer.name,
    retailer_slug: retailer.slug,
    observed_offer_ids: exactIds(rows),
    workflow_run_id: decisionPack.ordinary_run.workflow_run_id,
    artifact_id: source.artifact_id,
    commit_sha: decisionPack.ordinary_run.head_sha,
    report_sha256: source.dry_run_file_sha256,
    artifact_sha256: source.artifact_digest.replace(/^sha256:/, ""),
    rows,
  });
}

function buildBundle(decisionPack, identityAudit, state) {
  const { fitRows, tenRows } = validateDecision(decisionPack, identityAudit);
  const stateIndex = validateProductionState(decisionPack, state, fitRows, tenRows);
  const labels = productLabels(state);
  const generatedAt = state.captured_at;
  const fitManifest = manifestFor(RETAILERS[0], decisionPack, fitManifestRows(decisionPack, fitRows, stateIndex, labels, generatedAt), generatedAt);
  const tenManifest = manifestFor(RETAILERS[1], decisionPack, tenRepsManifestRows(decisionPack, identityAudit, tenRows, stateIndex, labels, generatedAt), generatedAt);
  const manifests = [fitManifest, tenManifest];
  const retailerChangesets = manifests.map((manifest) => {
    const activeRows = stateIndex.activeRows.filter((row) => String(row.retailer_id) === manifest.retailer_id);
    const request = buildPublicationRpcRequest(manifest, activeRows, { catalogueCounts: stateIndex.catalogueCounts });
    const operationCounts = request.operations.reduce((counts, operation) => ({ ...counts, [operation.op]: (counts[operation.op] || 0) + 1 }), {});
    return {
      retailer_id: manifest.retailer_id,
      retailer: manifest.retailer,
      active_review_baseline_count: activeRows.length,
      manifest_sha256: sha256(manifest),
      manifest_summary: {
        row_count: manifest.rows.length,
        observed_offer_ids: manifest.observed_offer_ids,
        workflow_run_id: manifest.workflow_run_id,
        artifact_id: manifest.artifact_id,
        commit_sha: manifest.commit_sha,
        report_sha256: manifest.report_sha256,
        artifact_sha256: manifest.artifact_sha256,
      },
      preview_request: request,
      operation_counts: operationCounts,
      performed_database_writes: 0,
      performed_catalogue_writes: 0,
      publication_authorized: false,
    };
  });
  const core = {
    schema_version: 1,
    kind: "ra-stab-01-d1-read-only-review-queue-changeset",
    generated_at: generatedAt,
    result: "PASS_READ_ONLY_CHANGESET_PREPARED",
    decision_id: DECISION_ID,
    authority: {
      changeset_preparation_authorized: true,
      review_queue_publication_authorized: false,
      control_writes_authorized: 0,
      catalogue_writes_authorized: 0,
      identity_rebinds_authorized: 0,
      stock_writes_authorized: 0,
      manual_retries_authorized: 0,
      ra_004_actions_authorized: 0,
    },
    production_baseline: {
      captured_at: state.captured_at,
      state_sha256: sha256(state),
      catalogue_counts: stateIndex.catalogueCounts,
      catalogue_hash_without_review_queue: sha256(stateIndex.catalogueCounts),
      active_review_counts: Object.fromEntries(RETAILERS.map((retailer) => [retailer.slug, stateIndex.activeRows.filter((row) => String(row.retailer_id) === retailer.id).length])),
    },
    scope: {
      total_rows: 30,
      fit_house_rows: 14,
      ten_reps_rows: 16,
      unique_offer_ids: new Set([...fitRows, ...tenRows].map((row) => String(row.offer_id))).size,
    },
    retailer_changesets: retailerChangesets,
    totals: {
      preview_operations: retailerChangesets.reduce((sum, item) => sum + item.preview_request.operations.length, 0),
      create: retailerChangesets.reduce((sum, item) => sum + (item.operation_counts.CREATE || 0), 0),
      refresh: retailerChangesets.reduce((sum, item) => sum + (item.operation_counts.REFRESH || 0), 0),
      supersede: retailerChangesets.reduce((sum, item) => sum + (item.operation_counts.SUPERSEDE || 0), 0),
      resolve_by_source: retailerChangesets.reduce((sum, item) => sum + (item.operation_counts.RESOLVE_BY_SOURCE || 0), 0),
      performed_database_writes: 0,
      performed_catalogue_writes: 0,
    },
    next_gate: "SEPARATE_IMPLEMENTATION_REVIEW_AND_OWNER_CONTROL_WRITE_AUTHORIZATION_REQUIRED_BEFORE_ANY_PUBLICATION",
  };
  return { ...core, bundle_sha256: sha256(core) };
}

async function selectAll(query, label) {
  const { data, error } = await query;
  if (error) fail(`${label}: ${error.message}`);
  return data || [];
}

async function readProductionState(env = process.env, clock = () => new Date()) {
  const url = env.NEXT_PUBLIC_SUPABASE_URL;
  const key = env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) fail("Production read-only credentials are missing");
  const db = createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } });
  const decisionPack = readJson(DEFAULT_DECISION_PACK);
  const rows = [...decisionPack.fit_house_decision.rows, ...flattenTenRepsRows(decisionPack)];
  const offerIds = rows.map((row) => String(row.offer_id));
  const mappingIds = rows.map((row) => String(row.mapping_id));
  const productIds = [...new Set(rows.map((row) => String(row.canonical_product_id)))];
  const variantIds = [...new Set(rows.map((row) => String(row.canonical_variant_id)))];
  const retailers = await selectAll(db.from("retailers").select("*").in("id", RETAILERS.map((retailer) => retailer.id)), "retailer read");
  const offers = await selectAll(db.from("offers").select("*").in("id", offerIds), "offer read");
  const mappings = await selectAll(db.from("retailer_products").select("*").in("id", mappingIds), "mapping read");
  const products = await selectAll(db.from("products").select("*").in("id", productIds), "product read");
  const variants = await selectAll(db.from("product_variants").select("*").in("id", variantIds), "variant read");
  const activeRows = await selectAll(db.from("product_match_review_queue").select("id,retailer_id,retailer,offer_id,review_status,source_row_fingerprint,superseded_by_review_id,before_state,product_title,variant_title").in("retailer_id", RETAILERS.map((retailer) => retailer.id)).in("review_status", ACTIVE_STATUSES), "active review read");
  const catalogueCounts = {};
  for (const table of ["products", "product_variants", "retailer_products", "offers", "price_history"]) {
    const { count, error } = await db.from(table).select("*", { count: "exact", head: true });
    if (error) fail(`${table} count: ${error.message}`);
    catalogueCounts[table] = count;
  }
  return {
    captured_at: clock().toISOString(),
    retailers,
    offers,
    mappings,
    products,
    variants,
    active_rows: activeRows,
    catalogue_counts: catalogueCounts,
  };
}

async function main(argv = process.argv.slice(2)) {
  const options = parseArgs(argv);
  dotenv.config({ path: options.envFile, quiet: true });
  const decisionPack = readJson(options.decisionPack);
  const identityAudit = readJson(options.identityAudit);
  const state = await readProductionState();
  const output = buildBundle(decisionPack, identityAudit, state);
  fs.mkdirSync(path.dirname(options.output), { recursive: true });
  fs.writeFileSync(options.output, `${JSON.stringify(output, null, 2)}\n`, { flag: "wx" });
  console.log(JSON.stringify({ result: output.result, output: path.relative(ROOT, options.output).replaceAll(path.sep, "/"), bundle_sha256: output.bundle_sha256, scope: output.scope, totals: output.totals }, null, 2));
}

if (require.main === module) {
  main().catch((error) => {
    console.error(error.message);
    process.exitCode = 1;
  });
}

module.exports = {
  DECISION_ID,
  RETAILERS,
  SEALED_EVIDENCE_OUTPUT,
  buildBundle,
  flattenTenRepsRows,
  parseArgs,
  readProductionState,
  validateDecision,
  validateProductionState,
};
