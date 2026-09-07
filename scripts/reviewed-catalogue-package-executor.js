const fs = require("node:fs");
const path = require("node:path");
const { execFileSync } = require("node:child_process");
const { Client } = require("pg");
const { canonicalJson } = require("./lib/canonical-json");
const { loadReviewedPackageScope } = require("./lib/reviewed-catalogue-package");
const { verifyReceipt } = require("./reviewed-catalogue-artifact-approver");

const ROOT = path.resolve(__dirname, "..");
const PROJECT_REF = "aftboxmrdgyhizicfsfu";
const ROLE = Object.freeze({
  approver: "retailer_catalogue_production_approver",
  executor: "retailer_catalogue_production_executor",
  validator: "retailer_catalogue_production_validator",
});
const LOGIN = Object.freeze({
  approver: "supplementscout_production_approver_login",
  executor: "supplementscout_production_executor_login",
  validator: "supplementscout_production_validator_login",
});
const CREDENTIAL = Object.freeze(Object.fromEntries(Object.keys(ROLE).map(kind => [kind,
  path.join(process.env.USERPROFILE || "", `.supplementscout/credentials/production-${kind}.env`),
])));
const APPROVAL_SQL = "select public.approve_reviewed_catalogue_import_plan($1::jsonb,$2,$3,$4,$5,now()+interval '15 minutes') result";
const APPLY_SQL = "select public.apply_approved_product_import_plan($1::uuid,$2,$3,$4,$5::bigint,$6,$7) result";

function invariant(value, message) { if (!value) throw new Error(message); }
function safeError(error) {
  return String(error?.message || error || "unknown error")
    .replace(/postgres(?:ql)?:\/\/\S+/gi, "[REDACTED_DATABASE_URL]")
    .replace(/(?:password|token|secret|key)=[^\s&]+/gi, "[REDACTED_PARAMETER]");
}
function decimal(value) { return Number(value).toFixed(2); }
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
    const match = arg.match(/^--(mode|manifest|manifest-sha256|profile|output)=(.+)$/);
    invariant(match, "Unknown or incomplete reviewed package argument");
    invariant(values[match[1]] === undefined, "Duplicate reviewed package argument");
    values[match[1]] = match[2];
  }
  invariant(Object.keys(values).length === 5, "Mode, manifest, manifest SHA-256, profile and output are required");
  invariant(["preflight", "apply"].includes(values.mode), "Mode must be preflight or apply");
  invariant(/^[0-9a-f]{64}$/i.test(values["manifest-sha256"]), "Exact manifest SHA-256 required");
  return {
    mode: values.mode,
    manifestPath: values.manifest.replaceAll("\\", "/"),
    manifestSha256: values["manifest-sha256"].toLowerCase(),
    profileId: values.profile,
    outputPath: values.output.replaceAll("\\", "/"),
  };
}

function parseCredential(kind, text) {
  invariant(ROLE[kind], "Unknown protected role");
  const rows = text.split(/\r?\n/).map(line => line.match(/^([A-Z0-9_]+_DATABASE_URL)=(.*)$/)).filter(Boolean);
  invariant(rows.length === 1, `Protected ${kind} credential must contain one database URL`);
  let url;
  try { url = new URL(rows[0][2].trim().replace(/^(['"])(.*)\1$/, "$2")); } catch { throw new Error(`Invalid protected ${kind} credential`); }
  const login = decodeURIComponent(url.username);
  invariant(["postgres:", "postgresql:"].includes(url.protocol), "Direct PostgreSQL credential required");
  invariant(
    (url.hostname === `db.${PROJECT_REF}.supabase.co` && login === LOGIN[kind]) ||
    (/^aws-[a-z0-9-]+\.pooler\.supabase\.com$/.test(url.hostname) && login === `${LOGIN[kind]}.${PROJECT_REF}` && url.port === "5432"),
    `Protected production ${kind} endpoint/login required`,
  );
  invariant(url.pathname === "/postgres" && Boolean(url.password), `Protected ${kind} password required`);
  for (const key of url.searchParams.keys()) invariant(key === "sslmode", "Unexpected credential option");
  url.searchParams.delete("sslmode");
  return url.href;
}

async function roleTransaction(client, kind, callback, { readOnly = false } = {}) {
  let began = false;
  try {
    await client.query("begin"); began = true;
    if (readOnly) await client.query("set transaction read only");
    else await client.query("select set_config('app.retailer_catalogue_production_marker','1',true),set_config('app.retailer_catalogue_allow','1',true)");
    await client.query(`set local role ${ROLE[kind]}`);
    const identity = (await client.query("select current_user,session_user,current_setting('transaction_read_only') transaction_read_only")).rows[0];
    invariant(identity.current_user === ROLE[kind] && identity.session_user === LOGIN[kind], `Protected ${kind} identity mismatch`);
    invariant(!readOnly || identity.transaction_read_only === "on", "Validator transaction is not read only");
    const result = await callback(client);
    await client.query(readOnly ? "rollback" : "commit"); began = false;
    return result;
  } catch (error) {
    if (began) await client.query("rollback").catch(() => {});
    throw error;
  }
}

async function one(client, sql, values, label) {
  const rows = (await client.query(sql, values)).rows;
  invariant(rows.length === 1, `${label} must resolve exactly once`);
  return rows[0];
}

async function counts(client, retailerId) {
  return one(client, `select
    (select count(*)::int from public.products) products,
    (select count(*)::int from public.product_variants) product_variants,
    (select count(*)::int from public.retailer_products where retailer_id=$1::bigint) retailer_products,
    (select count(*)::int from public.offers where retailer_id=$1::bigint) offers,
    (select count(*)::int from public.price_history ph join public.offers o on o.id=ph.offer_id where o.retailer_id=$1::bigint) price_history`, [retailerId], "catalogue counts");
}

function comparable(row) {
  if (!row) return null;
  const copy = { ...row };
  delete copy.created_at;
  delete copy.updated_at;
  return copy;
}

function sameExpectedState(actual, expected, label) {
  const expectedComparable = comparable(expected);
  const actualComparable = Object.fromEntries(
    Object.keys(expectedComparable).map(field => [field, comparable(actual)?.[field]])
  );
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

async function captureTarget(client, entry) {
  const plan = entry.resolved_plan;
  const externalVariantId = plan.retailer_product.values.external_variant_id;
  const mappings = (await client.query("select * from public.retailer_products where retailer_id=$1::bigint and external_variant_id=$2", [entry.retailer_id, externalVariantId])).rows;
  if (!mappings.length) return { mapping: null };
  invariant(mappings.length === 1, "Retailer mapping identity is duplicated");
  const mapping = mappings[0];
  const [product, variant, offer, history] = await Promise.all([
    one(client, "select * from public.products where id=$1::bigint", [mapping.product_id], "product"),
    one(client, "select * from public.product_variants where id=$1::bigint", [mapping.product_variant_id], "variant"),
    one(client, "select * from public.offers where retailer_product_id=$1::bigint", [mapping.id], "offer"),
    client.query("select * from public.price_history where offer_id=(select id from public.offers where retailer_product_id=$1::bigint) order by id", [mapping.id]),
  ]);
  return { mapping, product, variant, offer, history: history.rows };
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
  invariant(decimal(state.offer.price) === plan.offer.values.price && decimal(state.offer.shipping_cost) === plan.offer.values.shipping_cost && decimal(state.offer.total_price) === plan.offer.values.total_price, "Offer price mismatch");
  invariant(state.offer.in_stock === Boolean(plan.offer.values.in_stock) && state.offer.url === plan.offer.values.url, "Offer stock or URL mismatch");
  invariant(new Date(state.offer.last_checked_at).toISOString() === new Date(plan.offer.values.last_checked_at).toISOString(), "Offer timestamp mismatch");
  if (requireSingleHistory) invariant(state.history.length === 1, "Initial price history count mismatch");
  const history = state.history.at(-1);
  invariant(history && decimal(history.price) === plan.offer.values.price && decimal(history.shipping_cost) === plan.offer.values.shipping_cost && decimal(history.total_price) === plan.offer.values.total_price, "Price history mismatch");
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

async function approve(client, prepared) {
  return roleTransaction(client, "approver", async connection => {
    const receipt = (await connection.query(APPROVAL_SQL, [prepared.entry.resolved_plan, prepared.profile.artifact_sha256, prepared.artifact.run_id, prepared.manifestSha256, prepared.profile.id])).rows[0]?.result;
    verifyReceipt(receipt, prepared);
    return receipt;
  });
}

async function apply(client, prepared, receipt) {
  return roleTransaction(client, "executor", async connection => {
    const entry = prepared.entry;
    const result = (await connection.query(APPLY_SQL, [receipt.approval_id, prepared.profile.artifact_sha256, entry.plan_fingerprint, entry.source_row_fingerprint, entry.retailer_id, entry.plan_kind, prepared.artifact.run_id])).rows[0]?.result;
    invariant(result && result.approval_status === "consumed" && result.already_applied !== true, "Atomic apply receipt invalid");
    for (const field of ["artifact_sha256", "plan_fingerprint", "source_row_fingerprint", "retailer_id", "plan_kind", "run_id"]) invariant(String(result[field]) === String({ artifact_sha256: prepared.profile.artifact_sha256, plan_fingerprint: entry.plan_fingerprint, source_row_fingerprint: entry.source_row_fingerprint, retailer_id: entry.retailer_id, plan_kind: entry.plan_kind, run_id: prepared.artifact.run_id }[field]), `Apply receipt ${field} mismatch`);
    return result;
  });
}

function loadScope(options) {
  const loaded = loadReviewedPackageScope({ root: ROOT, ...options });
  const entries = loaded.profile.rows.map(row => loaded.byFingerprint.get(row.plan_fingerprint));
  invariant(entries.every(Boolean), "Reviewed entry order is incomplete");
  const createdParents = loaded.profile.rows.filter(row => row.action.startsWith("create_product")).map(row => row.external_product_id);
  invariant(new Set(createdParents).size === createdParents.length, "One reviewed package may create only one anchor per source product family");
  return { ...loaded, entries, manifestSha256: options.manifestSha256 };
}

async function connect(kind, ClientClass = Client) {
  const connectionString = parseCredential(kind, fs.readFileSync(CREDENTIAL[kind], "utf8"));
  const client = new ClientClass({ connectionString, ssl: { rejectUnauthorized: false }, application_name: `reviewed-catalogue-package-${kind}`, options: "-c statement_timeout=120000" });
  await client.connect();
  return client;
}

async function run(options, dependencies = {}) {
  const output = exactPath(options.outputPath, "tmp/retailer-feeds/");
  fs.mkdirSync(path.dirname(output), { recursive: true });
  const loaded = loadScope(options);
  const result = { result: "RUNNING", mode: options.mode, manifest_sha256: options.manifestSha256, profile: loaded.profile.id, requested: loaded.entries.length, completed: [], errors: [], approval_count: 0, apply_count: 0, database_writes: 0, started_at: new Date().toISOString() };
  const clients = {};
  try {
    if (options.mode === "apply") result.source_commit = assertCleanMain(dependencies.execFileSync || execFileSync);
    clients.validator = await connect("validator", dependencies.Client || Client);
    const retailer = await roleTransaction(clients.validator, "validator", client => one(client, "select id,name,slug,website from public.retailers where id=$1::bigint", [loaded.manifest.retailer.id], "retailer"), { readOnly: true });
    invariant(String(retailer.id) === String(loaded.manifest.retailer.id) && retailer.name === loaded.manifest.retailer.name && retailer.slug === loaded.manifest.retailer.slug && retailer.website === loaded.manifest.retailer.website, "Retailer identity mismatch");
    const existing = await roleTransaction(clients.validator, "validator", async client => {
      const ids = loaded.entries.map(entry => entry.resolved_plan.retailer_product.values.external_variant_id);
      return (await client.query("select external_variant_id from public.retailer_products where retailer_id=$1::bigint and external_variant_id=any($2::text[])", [loaded.manifest.retailer.id, ids])).rows.map(row => row.external_variant_id);
    }, { readOnly: true });
    invariant(existing.length === 0, "Reviewed package contains an already mapped source row; generate a fresh remaining package");
    const baseline = await roleTransaction(clients.validator, "validator", client => counts(client, loaded.manifest.retailer.id), { readOnly: true });
    result.baseline = baseline;
    if (options.mode === "preflight") {
      Object.assign(result, { result: "PASS", completed_at: new Date().toISOString(), database_writes: 0 });
      fs.writeFileSync(output, `${JSON.stringify(result, null, 2)}\n`);
      return result;
    }
    clients.approver = await connect("approver", dependencies.Client || Client);
    clients.executor = await connect("executor", dependencies.Client || Client);
    let currentCounts = baseline;
    for (let index = 0; index < loaded.entries.length; index += 1) {
      const entry = loaded.entries[index];
      const prepared = { ...loaded, entry, reviewed: loaded.profile.rows[index] };
      const receipt = await approve(clients.approver, prepared);
      result.approval_count += 1;
      const execution = await apply(clients.executor, prepared, receipt);
      result.apply_count += 1;
      const delta = expectedDelta(entry.resolved_plan);
      result.database_writes += Object.values(delta).reduce((sum, value) => sum + value, 0);
      const checked = await roleTransaction(clients.validator, "validator", async client => ({ counts: await counts(client, loaded.manifest.retailer.id), target: await captureTarget(client, entry) }), { readOnly: true });
      for (const key of Object.keys(delta)) invariant(checked.counts[key] - currentCounts[key] === delta[key], `${key} row-count delta mismatch`);
      const row = verifyTarget(entry, checked.target);
      for (const field of ["product_id", "product_variant_id", "retailer_product_id", "offer_id", "price_history_id"]) {
        if (execution[field] != null) invariant(String(execution[field]) === row[field], `Apply and readback ${field} mismatch`);
      }
      result.completed.push({ sequence: index + 1, approval_id: receipt.approval_id, approval_expires_at: receipt.expires_at, consumed_at: execution.consumed_at, ...row });
      currentCounts = checked.counts;
      fs.writeFileSync(output, `${JSON.stringify(result, null, 2)}\n`);
      console.log(`PASS ${index + 1}/${loaded.entries.length} product=${row.product_id} variant=${row.product_variant_id} offer=${row.offer_id}`);
    }
    const expectedFinal = { ...baseline };
    for (const entry of loaded.entries) for (const [key, value] of Object.entries(expectedDelta(entry.resolved_plan))) expectedFinal[key] += value;
    same(currentCounts, expectedFinal, "final counts");
    Object.assign(result, { result: "PASS", final: currentCounts, completed_at: new Date().toISOString() });
    fs.writeFileSync(output, `${JSON.stringify(result, null, 2)}\n`);
    return result;
  } catch (error) {
    result.result = "BLOCKED"; result.errors.push(safeError(error)); result.stopped_at = new Date().toISOString();
    fs.writeFileSync(output, `${JSON.stringify(result, null, 2)}\n`);
    throw error;
  } finally {
    await Promise.all(Object.values(clients).map(client => client.end().catch(() => {})));
  }
}

if (require.main === module) run(parseArgs(process.argv.slice(2)))
  .then(result => console.log(JSON.stringify({ result: result.result, completed: result.completed.length, requested: result.requested, database_writes: result.database_writes }, null, 2)))
  .catch(error => { console.error(`Reviewed package stopped: ${safeError(error)}`); process.exitCode = 1; });

module.exports = { APPLY_SQL, APPROVAL_SQL, CREDENTIAL, LOGIN, ROLE, apply, approve, assertCleanMain, expectedDelta, parseArgs, parseCredential, roleTransaction, run, safeError, verifyTarget };
