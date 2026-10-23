const fs = require("node:fs");
const path = require("node:path");
const { execFileSync } = require("node:child_process");
const { Client } = require("pg");
const { canonicalJson, normalizeDecimalString } = require("./lib/canonical-json");
const { loadReviewedPackageScope } = require("./lib/reviewed-catalogue-package");
const {
  CONTRACT_KIND: REVIEWED_V3_KIND,
  buildV3Envelope,
} = require("./lib/reviewed-catalogue-v3");
const { buildExecutionStateRequest, readState } = require("./lib/reviewed-catalogue-state");
const {
  DEFAULT_POSTGRES_CONNECTION_TIMEOUT_MS,
  DEFAULT_POSTGRES_QUERY_TIMEOUT_MS,
  DEFAULT_POSTGRES_STATEMENT_TIMEOUT_MS,
} = require("./lib/secure-postgres");
const {
  TARGETS,
  assertManifestTarget,
  clientConfig,
  parseCredential,
  roleTransaction,
  targetContract,
} = require("./lib/reviewed-catalogue-target");
const { verifyReceipt } = require("./reviewed-catalogue-artifact-approver");

const ROOT = path.resolve(__dirname, "..");
const APPROVAL_SQL = "select public.approve_reviewed_catalogue_import_plan($1::jsonb,$2,$3,$4,$5,now()+interval '15 minutes') result";
const APPLY_SQL = "select public.apply_approved_product_import_plan($1::uuid,$2,$3,$4,$5::bigint,$6,$7) result";
const V3_APPROVAL_SQL = "select public.approve_reviewed_catalogue_v3_plan($1::jsonb,$2::jsonb,now()+interval '15 minutes') result";
const V3_APPLY_SQL = "select public.apply_approved_reviewed_catalogue_v3_plan($1::uuid,$2::jsonb,$3::jsonb) result";
const EXECUTOR_TIMEOUT_CONFIG = Object.freeze({
  connection_timeout_ms: DEFAULT_POSTGRES_CONNECTION_TIMEOUT_MS,
  query_timeout_ms: DEFAULT_POSTGRES_QUERY_TIMEOUT_MS,
  statement_timeout_ms: DEFAULT_POSTGRES_STATEMENT_TIMEOUT_MS,
});
const EXECUTION_STAGES = Object.freeze({
  INITIAL_STATE_READ: "INITIAL_STATE_READ",
  ROLE_CONNECTION_SETUP: "ROLE_CONNECTION_SETUP",
  APPROVAL_RPC: "APPROVAL_RPC",
  APPLY_RPC: "APPLY_RPC",
  POST_APPLY_STATE_READ: "POST_APPLY_STATE_READ",
  POST_APPLY_VERIFY: "POST_APPLY_VERIFY",
  FINAL_COUNT_VERIFY: "FINAL_COUNT_VERIFY",
});
const TIMEOUT_CLASSES = Object.freeze({
  CLIENT_QUERY_TIMEOUT: "CLIENT_QUERY_TIMEOUT",
  SERVER_STATEMENT_TIMEOUT: "SERVER_STATEMENT_TIMEOUT",
  UNKNOWN: "UNKNOWN",
});

function invariant(value, message) { if (!value) throw new Error(message); }
function safeError(error) {
  return String(error?.message || error || "unknown error")
    .replace(/postgres(?:ql)?:\/\/\S+/gi, "[REDACTED_DATABASE_URL]")
    .replace(/(?:password|token|secret|key)=[^\s&]+/gi, "[REDACTED_PARAMETER]");
}
function classifyTimeout(error) {
  const message = String(error?.message || error || "").trim();
  if (message === "Query read timeout") return TIMEOUT_CLASSES.CLIENT_QUERY_TIMEOUT;
  if (String(error?.code || "") === "57014" || message === "canceling statement due to statement timeout") {
    return TIMEOUT_CLASSES.SERVER_STATEMENT_TIMEOUT;
  }
  return TIMEOUT_CLASSES.UNKNOWN;
}
function decimal(value) { return Number(value).toFixed(2); }
const MONEY_FIELDS = Object.freeze(["price", "shipping_cost", "total_price"]);
function sameMoneyFields(actual, expected, label) {
  return MONEY_FIELDS.every(field =>
    normalizeDecimalString(actual[field], `${label} ${field}`) ===
    normalizeDecimalString(expected[field], `${label} ${field}`));
}
function same(actual, expected, message) { invariant(canonicalJson(actual) === canonicalJson(expected), `${message} mismatch`); }
function exactPath(relative, prefix) {
  invariant(typeof relative === "string" && relative.replaceAll("\\", "/").startsWith(prefix), `${prefix} path required`);
  const resolved = path.resolve(ROOT, relative);
  const rel = path.relative(ROOT, resolved);
  invariant(rel && !rel.startsWith("..") && !path.isAbsolute(rel), "Path escapes repository");
  return resolved;
}

function parseArgs(argv) {
  const values = {};
  for (const arg of argv) {
    const match = arg.match(/^--(target|mode|manifest|manifest-sha256|profile|output)=(.+)$/);
    invariant(match, "Unknown or incomplete reviewed package argument");
    invariant(values[match[1]] === undefined, "Duplicate reviewed package argument");
    values[match[1]] = match[2];
  }
  invariant(Object.keys(values).length === 6, "Target, mode, manifest, manifest SHA-256, profile and output are required");
  invariant(TARGETS[values.target], "Target must be staging or production");
  invariant(["preflight", "apply"].includes(values.mode), "Mode must be preflight or apply");
  invariant(/^[0-9a-f]{64}$/i.test(values["manifest-sha256"]), "Exact manifest SHA-256 required");
  return {
    target: values.target,
    mode: values.mode,
    manifestPath: values.manifest.replaceAll("\\", "/"),
    manifestSha256: values["manifest-sha256"].toLowerCase(),
    profileId: values.profile,
    outputPath: values.output.replaceAll("\\", "/"),
  };
}

function comparable(row) {
  if (!row) return null;
  const copy = { ...row };
  delete copy.created_at;
  delete copy.updated_at;
  return copy;
}

const EXPECTED_STATE_ID_FIELDS = new Set([
  "id",
  "merged_into_product_id",
  "offer_id",
  "product_id",
  "product_variant_id",
  "retailer_id",
  "retailer_product_id",
]);

function opaqueDecimalId(value) {
  if (value == null) return value;
  if (typeof value === "number" && Number.isSafeInteger(value) && value >= 0) return String(value);
  if (typeof value === "string" && /^(?:0|[1-9][0-9]*)$/.test(value)) return value;
  return value;
}

function sameExpectedState(actual, expected, label) {
  const expectedComparable = comparable(expected);
  const actualComparable = Object.fromEntries(
    Object.keys(expectedComparable).map(field => [field, comparable(actual)?.[field]])
  );
  for (const field of EXPECTED_STATE_ID_FIELDS) {
    if (Object.hasOwn(expectedComparable, field)) {
      expectedComparable[field] = opaqueDecimalId(expectedComparable[field]);
      actualComparable[field] = opaqueDecimalId(actualComparable[field]);
    }
  }
  for (const field of ["size_value", "pack_count"]) {
    if (expectedComparable[field] != null && actualComparable[field] != null) {
      const expectedNumber = Number(expectedComparable[field]);
      const actualNumber = Number(actualComparable[field]);
      if (Number.isFinite(expectedNumber) && Number.isFinite(actualNumber)) {
        expectedComparable[field] = expectedNumber;
        actualComparable[field] = actualNumber;
      }
    }
  }
  same(actualComparable, expectedComparable, label);
}

function expectedDelta(plan) {
  return {
    products: ["create", "create_or_reuse_reviewed"].includes(plan.product.action) ? 1 : 0,
    product_variants: ["create_default", "create_variant", "create_reviewed_variant"].includes(plan.product_variant.action) ? 1 : 0,
    retailer_products: plan.retailer_product.action === "create" ? 1 : 0,
    offers: plan.offer.action === "create" ? 1 : 0,
    price_history: plan.price_history.action === "create" ? 1 : 0,
  };
}

function captureTarget(state, entry) {
  const plan = entry.resolved_plan;
  const externalVariantId = plan.retailer_product.values.external_variant_id;
  const mappings = state.retailer_products.filter(mapping =>
    String(mapping.retailer_id) === String(entry.retailer_id) &&
    String(mapping.external_variant_id) === String(externalVariantId));
  if (!mappings.length) return { mapping: null };
  invariant(mappings.length === 1, "Retailer mapping identity is duplicated");
  const mapping = mappings[0];
  const products = state.products.filter(product => String(product.id) === String(mapping.product_id));
  const variants = state.product_variants.filter(variant => String(variant.id) === String(mapping.product_variant_id));
  const offers = state.offers.filter(offer => String(offer.retailer_product_id) === String(mapping.id));
  invariant(products.length === 1 && variants.length === 1 && offers.length === 1, "Applied target identity is missing or ambiguous");
  const history = state.price_history
    .filter(row => String(row.offer_id) === String(offers[0].id))
    .sort((left, right) => Number(left.id) - Number(right.id));
  return { mapping, product: products[0], variant: variants[0], offer: offers[0], history };
}

function stateRequest(loaded, target) {
  return buildExecutionStateRequest({
    ...loaded.manifest,
    target_environment: TARGETS[target].environment,
    target_project_ref: TARGETS[target].projectRef,
  }, loaded.entries);
}

function compareFields(actual, expected, fields, label) {
  for (const field of fields) {
    const matches = field === "match_confidence"
      ? Number(actual[field]) === Number(expected[field])
      : actual[field] == null && expected[field] == null || String(actual[field]) === String(expected[field]);
    invariant(matches, `${label} ${field} mismatch`);
  }
}

function verifyTarget(entry, state, { requireSingleHistory = true } = {}) {
  const plan = entry.resolved_plan;
  const mappingExpected = plan.retailer_product.values;
  invariant(state.mapping && state.product && state.variant && state.offer, "Applied target is incomplete");
  compareFields(state.mapping, mappingExpected, Object.keys(mappingExpected).filter(field => !["retailer_id", "product_id", "product_variant_id", "external_options"].includes(field)), "mapping");
  same(state.mapping.external_options || {}, mappingExpected.external_options || {}, "mapping external options");
  invariant(String(state.variant.product_id) === String(state.product.id) && state.product.is_active === true && state.product.merged_into_product_id == null && state.variant.is_active === true, "Canonical target is inactive or invalid");
  if (["create", "create_or_reuse_reviewed"].includes(plan.product.action)) compareFields(state.product, plan.product.values, Object.keys(plan.product.values), "created product");
  else sameExpectedState(state.product, plan.expected_state.product, "existing product");
  if (plan.product_variant.action === "existing") sameExpectedState(state.variant, plan.expected_state.product_variant, "existing variant");
  else if (plan.product_variant.action === "create_default") invariant(state.variant.is_default === true && state.variant.variant_key === "default" && state.variant.display_name === "Default" && state.variant.gtin == null, "Default variant mismatch");
  else {
    invariant(state.variant.is_default === false && state.variant.gtin == null, "Reviewed variant state mismatch");
    compareFields(state.variant, plan.product_variant.values, Object.keys(plan.product_variant.values), "created variant");
  }
  invariant(String(state.mapping.product_id) === String(state.product.id) && String(state.mapping.product_variant_id) === String(state.variant.id), "Mapping target mismatch");
  invariant(String(state.offer.retailer_product_id) === String(state.mapping.id) && String(state.offer.product_id) === String(state.product.id) && String(state.offer.product_variant_id) === String(state.variant.id), "Offer target mismatch");
  invariant(sameMoneyFields(state.offer, plan.offer.values, "offer"), "Offer price mismatch");
  invariant(state.offer.in_stock === Boolean(plan.offer.values.in_stock) && state.offer.url === plan.offer.values.url, "Offer stock or URL mismatch");
  invariant(new Date(state.offer.last_checked_at).toISOString() === new Date(plan.offer.values.last_checked_at).toISOString(), "Offer timestamp mismatch");
  if (requireSingleHistory) invariant(state.history.length === 1, "Initial price history count mismatch");
  const history = state.history.at(-1);
  invariant(history && sameMoneyFields(history, plan.offer.values, "price history"), "Price history mismatch");
  invariant(new Date(history.checked_at).toISOString() === new Date(plan.offer.values.last_checked_at).toISOString(), "Price history timestamp mismatch");
  return {
    plan_fingerprint: entry.plan_fingerprint,
    product_id: String(state.product.id), product_variant_id: String(state.variant.id),
    retailer_product_id: String(state.mapping.id), offer_id: String(state.offer.id), price_history_id: String(history.id),
    external_variant_id: mappingExpected.external_variant_id, product_name: state.product.name,
    variant_name: state.variant.display_name, price: decimal(state.offer.price), shipping_cost: decimal(state.offer.shipping_cost),
    total_price: decimal(state.offer.total_price), in_stock: state.offer.in_stock, source_url: state.offer.url,
  };
}

function assertCleanMain(exec = execFileSync) {
  invariant(exec("git", ["status", "--porcelain", "--untracked-files=no"], { cwd: ROOT, encoding: "utf8" }) === "", "Apply requires a clean tracked working tree");
  const head = exec("git", ["rev-parse", "HEAD"], { cwd: ROOT, encoding: "utf8" }).trim();
  const origin = exec("git", ["rev-parse", "origin/main"], { cwd: ROOT, encoding: "utf8" }).trim();
  invariant(head === origin, "Apply requires HEAD to equal origin/main");
  return head;
}

async function approve(client, prepared, target) {
  return roleTransaction(client, target, "approver", async connection => {
    const isV3 = prepared.manifest.kind === REVIEWED_V3_KIND;
    const envelope = isV3 ? buildV3Envelope(prepared) : null;
    const receipt = (await connection.query(
      isV3 ? V3_APPROVAL_SQL : APPROVAL_SQL,
      isV3
        ? [prepared.entry.resolved_plan, envelope]
        : [prepared.entry.resolved_plan, prepared.profile.artifact_sha256, prepared.artifact.run_id, prepared.manifestSha256, prepared.profile.id],
    )).rows[0]?.result;
    verifyReceipt(receipt, prepared);
    return receipt;
  });
}

async function apply(client, prepared, receipt, target) {
  return roleTransaction(client, target, "executor", async connection => {
    const entry = prepared.entry;
    const isV3 = prepared.manifest.kind === REVIEWED_V3_KIND;
    const envelope = isV3 ? buildV3Envelope(prepared) : null;
    const result = (await connection.query(
      isV3 ? V3_APPLY_SQL : APPLY_SQL,
      isV3
        ? [receipt.approval_id, entry.resolved_plan, envelope]
        : [receipt.approval_id, prepared.profile.artifact_sha256, entry.plan_fingerprint, entry.source_row_fingerprint, entry.retailer_id, entry.plan_kind, prepared.artifact.run_id],
    )).rows[0]?.result;
    invariant(result && result.approval_status === "consumed" && result.already_applied !== true, "Atomic apply receipt invalid");
    for (const field of ["artifact_sha256", "plan_fingerprint", "source_row_fingerprint", "retailer_id", "plan_kind", "run_id"]) invariant(String(result[field]) === String({ artifact_sha256: prepared.profile.artifact_sha256, plan_fingerprint: entry.plan_fingerprint, source_row_fingerprint: entry.source_row_fingerprint, retailer_id: entry.retailer_id, plan_kind: entry.plan_kind, run_id: prepared.artifact.run_id }[field]), `Apply receipt ${field} mismatch`);
    return result;
  });
}

function loadScope(options) {
  const loaded = loadReviewedPackageScope({ root: ROOT, ...options });
  assertManifestTarget(loaded.manifest, options.target);
  const entries = loaded.profile.rows.map(row => loaded.byFingerprint.get(row.plan_fingerprint));
  invariant(entries.every(Boolean), "Reviewed entry order is incomplete");
  const createdParents = loaded.profile.rows.filter(row => row.action.startsWith("create_product")).map(row => row.external_product_id);
  invariant(new Set(createdParents).size === createdParents.length, "One reviewed package may create only one anchor per source product family");
  return { ...loaded, entries, manifestSha256: options.manifestSha256 };
}

async function connect(target, kind, ClientClass = Client) {
  const contract = targetContract(target, kind);
  const connectionString = parseCredential(target, kind, fs.readFileSync(contract.credentialPath, "utf8"));
  const client = new ClientClass(clientConfig(target, kind, connectionString, { applicationName: `reviewed-catalogue-package-${target}-${kind}` }));
  await client.connect();
  return client;
}

async function run(options, dependencies = {}) {
  const output = exactPath(options.outputPath, "tmp/retailer-feeds/");
  fs.mkdirSync(path.dirname(output), { recursive: true });
  const loadScopeImpl = dependencies.loadScope || loadScope;
  const connectImpl = dependencies.connect || connect;
  const roleTransactionImpl = dependencies.roleTransaction || roleTransaction;
  const readStateImpl = dependencies.readState || readState;
  const approveImpl = dependencies.approve || approve;
  const applyImpl = dependencies.apply || apply;
  const writeFile = dependencies.writeFileSync || fs.writeFileSync;
  const now = dependencies.now || (() => new Date().toISOString());
  const timestamp = () => new Date(now()).toISOString();
  const persist = value => writeFile(output, `${JSON.stringify(value, null, 2)}\n`);
  const loaded = loadScopeImpl(options);
  const target = TARGETS[options.target];
  const result = {
    result: "RUNNING", mode: options.mode, target_environment: target.environment,
    target_project_ref: target.projectRef, manifest_sha256: options.manifestSha256,
    profile: loaded.profile.id, requested: loaded.entries.length, completed: [], errors: [],
    approval_count: 0, apply_count: 0, database_writes: 0, started_at: timestamp(),
    current_stage: EXECUTION_STAGES.ROLE_CONNECTION_SETUP, current_row: null,
    stage_timestamps: {}, row_diagnostics: [], timeout_config: { ...EXECUTOR_TIMEOUT_CONFIG }, retry_count: 0,
  };
  const clients = {};
  try {
    if (options.mode === "apply") {
      const assertCleanMainImpl = dependencies.assertCleanMain || assertCleanMain;
      result.source_commit = assertCleanMainImpl(dependencies.execFileSync || execFileSync);
    }
    clients.validator = await connectImpl(options.target, "validator", dependencies.Client || Client);
    const request = stateRequest(loaded, options.target);
    result.current_stage = EXECUTION_STAGES.INITIAL_STATE_READ;
    result.stage_timestamps.initial_state_read_started_at = timestamp();
    const initialState = await roleTransactionImpl(clients.validator, options.target, "validator", client => readStateImpl(client, request), { readOnly: true });
    result.stage_timestamps.initial_state_read_completed_at = timestamp();
    const retailer = initialState.retailer;
    invariant(String(retailer.id) === String(loaded.manifest.retailer.id) && retailer.name === loaded.manifest.retailer.name && retailer.slug === loaded.manifest.retailer.slug && retailer.website === loaded.manifest.retailer.website, "Retailer identity mismatch");
    const ids = new Set(loaded.entries.map(entry => String(entry.resolved_plan.retailer_product.values.external_variant_id)));
    const existing = initialState.retailer_products
      .filter(row => String(row.retailer_id) === String(loaded.manifest.retailer.id) && ids.has(String(row.external_variant_id)))
      .map(row => row.external_variant_id);
    invariant(existing.length === 0, "Reviewed package contains an already mapped source row; generate a fresh remaining package");
    const baseline = initialState.counts;
    result.baseline = baseline;
    if (options.mode === "preflight") {
      Object.assign(result, { result: "PASS", current_stage: null, completed_at: timestamp(), database_writes: 0 });
      persist(result);
      return result;
    }
    result.current_stage = EXECUTION_STAGES.ROLE_CONNECTION_SETUP;
    result.stage_timestamps.role_connection_setup_started_at = timestamp();
    clients.approver = await connectImpl(options.target, "approver", dependencies.Client || Client);
    clients.executor = await connectImpl(options.target, "executor", dependencies.Client || Client);
    result.stage_timestamps.role_connection_setup_completed_at = timestamp();
    let currentCounts = baseline;
    for (let index = 0; index < loaded.entries.length; index += 1) {
      const entry = loaded.entries[index];
      const prepared = { ...loaded, entry, reviewed: loaded.profile.rows[index] };
      result.current_stage = EXECUTION_STAGES.APPROVAL_RPC;
      result.current_row = {
        sequence: index + 1,
        external_variant_id: entry.resolved_plan.retailer_product.values.external_variant_id,
        plan_fingerprint: entry.plan_fingerprint,
        stage: EXECUTION_STAGES.APPROVAL_RPC,
        approval_started_at: timestamp(),
      };
      const receipt = await approveImpl(clients.approver, prepared, options.target);
      result.current_row.approval_completed_at = timestamp();
      result.approval_count += 1;
      result.current_stage = EXECUTION_STAGES.APPLY_RPC;
      result.current_row.stage = EXECUTION_STAGES.APPLY_RPC;
      result.current_row.apply_started_at = timestamp();
      const execution = await applyImpl(clients.executor, prepared, receipt, options.target);
      result.current_row.apply_completed_at = timestamp();
      result.apply_count += 1;
      const delta = expectedDelta(entry.resolved_plan);
      result.database_writes += Object.values(delta).reduce((sum, value) => sum + value, 0);
      result.current_stage = EXECUTION_STAGES.POST_APPLY_STATE_READ;
      result.current_row.stage = EXECUTION_STAGES.POST_APPLY_STATE_READ;
      result.current_row.readback_started_at = timestamp();
      const checkedState = await roleTransactionImpl(clients.validator, options.target, "validator", client => readStateImpl(client, request), { readOnly: true });
      result.current_row.readback_completed_at = timestamp();
      result.current_stage = EXECUTION_STAGES.POST_APPLY_VERIFY;
      result.current_row.stage = EXECUTION_STAGES.POST_APPLY_VERIFY;
      result.current_row.verify_started_at = timestamp();
      const checked = { counts: checkedState.counts, target: captureTarget(checkedState, entry) };
      for (const key of Object.keys(delta)) invariant(checked.counts[key] - currentCounts[key] === delta[key], `${key} row-count delta mismatch`);
      const row = verifyTarget(entry, checked.target);
      for (const field of ["product_id", "product_variant_id", "retailer_product_id", "offer_id", "price_history_id"]) {
        if (execution[field] != null) invariant(String(execution[field]) === row[field], `Apply and readback ${field} mismatch`);
      }
      result.current_row.verify_completed_at = timestamp();
      result.completed.push({ sequence: index + 1, approval_id: receipt.approval_id, approval_expires_at: receipt.expires_at, consumed_at: execution.consumed_at, ...row });
      result.row_diagnostics.push({ ...result.current_row, stage: "COMPLETED" });
      result.current_row = null;
      currentCounts = checked.counts;
      persist(result);
      console.log(`PASS ${index + 1}/${loaded.entries.length} product=${row.product_id} variant=${row.product_variant_id} offer=${row.offer_id}`);
    }
    result.current_stage = EXECUTION_STAGES.FINAL_COUNT_VERIFY;
    result.stage_timestamps.final_count_verify_started_at = timestamp();
    const expectedFinal = { ...baseline };
    for (const entry of loaded.entries) for (const [key, value] of Object.entries(expectedDelta(entry.resolved_plan))) expectedFinal[key] += value;
    same(currentCounts, expectedFinal, "final counts");
    result.stage_timestamps.final_count_verify_completed_at = timestamp();
    Object.assign(result, { result: "PASS", current_stage: null, final: currentCounts, completed_at: timestamp() });
    persist(result);
    return result;
  } catch (error) {
    const redacted = safeError(error);
    result.result = "BLOCKED";
    result.failure_stage = result.current_stage || TIMEOUT_CLASSES.UNKNOWN;
    result.error_class = classifyTimeout(error);
    result.safe_error = redacted;
    result.errors.push(redacted);
    result.stopped_at = timestamp();
    persist(result);
    throw error;
  } finally {
    await Promise.all(Object.values(clients).map(client => client.end().catch(() => {})));
  }
}

if (require.main === module) run(parseArgs(process.argv.slice(2)))
  .then(result => console.log(JSON.stringify({ result: result.result, completed: result.completed.length, requested: result.requested, database_writes: result.database_writes }, null, 2)))
  .catch(error => { console.error(`Reviewed package stopped: ${safeError(error)}`); process.exitCode = 1; });

module.exports = { APPLY_SQL, APPROVAL_SQL, EXECUTION_STAGES, EXECUTOR_TIMEOUT_CONFIG, TIMEOUT_CLASSES, V3_APPLY_SQL, V3_APPROVAL_SQL, TARGETS, apply, approve, assertCleanMain, captureTarget, classifyTimeout, connect, expectedDelta, loadScope, opaqueDecimalId, parseArgs, parseCredential, roleTransaction, run, safeError, sameExpectedState, targetContract, verifyTarget };
