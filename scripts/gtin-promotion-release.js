const crypto = require("node:crypto");
const fs = require("node:fs");
const path = require("node:path");
const { spawnSync } = require("node:child_process");
const { Client } = require("pg");
const { canonicalJson } = require("./lib/canonical-json");
const { buildReadOnlyPreview } = require("./gtin-promotion-dry-run");
const { APPROVED_IDENTITIES, readArtifact } = require("./gtin-promotion-operation");
const { databaseState, loadEnvFile, pendingConfirmation } = require("./apply-selected-migrations");
const { CONTRACTS, ledgerIdentifier, ledgerRowsFingerprint, sha256File, validateDatabaseOwner } = require("./supabase-migration-selector");

const ROOT = path.resolve(__dirname, "..");
const CONTRACT = CONTRACTS.PRODUCTION;
const MIGRATION = "20260813170000_add_guarded_gtin_promotion.sql";
const MIGRATION_ID = MIGRATION.slice(0, -4);
const CONFIRMATION = "OWNER_APPROVED_EXACT_45";
const EXACT36_MIGRATION = "20260816173000_extend_guarded_gtin_promotion_exact_36.sql";
const EXACT36_MIGRATION_ID = EXACT36_MIGRATION.slice(0, -4);
const EXACT36_MIGRATION_CONFIRMATION = "OWNER_APPROVED_EXACT_36_MIGRATION";
const QUARANTINED_GTINS = Object.freeze([
  "6009544961161","850054547989","850054547996","850060014024",
  "810028296107","810028296084","810028296114","810028296091",
  "5033579002576","5033579002545","5033579002538","5033579002552",
  "810028290532","850001610094","810028291942","5056569900409",
]);

function fail(message) { throw new Error(message); }
function sha256(value) { return crypto.createHash("sha256").update(value).digest("hex"); }
function releaseFingerprint(label, value) { return sha256(`GTIN-PROMOTION-RELEASE:1\n${label}\n${canonicalJson(value)}`); }
function parseArgs(argv) {
  const result = {};
  for (const argument of argv) {
    const match = argument.match(/^--(mode|target|artifact|baseline|output|confirm|env-file)=(.+)$/);
    if (!match || result[match[1]] !== undefined) fail(`Unsupported argument: ${argument}`);
    result[match[1]] = match[2];
  }
  if (!["capture", "migration-preflight", "deploy", "verify", "exact36-migration-preflight", "exact36-deploy"].includes(result.mode)) fail("Unsupported GTIN promotion release mode");
  if (result.target !== "production") fail("Required --target=production");
  const requiredConfirmation = result.mode.startsWith("exact36-") ? EXACT36_MIGRATION_CONFIRMATION : CONFIRMATION;
  if (result.confirm !== requiredConfirmation) fail(`Required --confirm=${requiredConfirmation}`);
  for (const key of ["artifact", "baseline", "output", "env-file"]) if (result[key]) result[key] = path.resolve(ROOT, result[key]);
  if (["capture", "verify"].includes(result.mode) && !result.artifact) fail("Artifact is required");
  if (result.mode === "capture" && !result.output) fail("Capture output is required");
  if (result.mode === "verify" && (!result.baseline || !result.output)) fail("Verification baseline and output are required");
  if (["migration-preflight", "deploy", "capture", "verify", "exact36-migration-preflight", "exact36-deploy"].includes(result.mode) && !result["env-file"]) fail("Owner env file is required");
  return result;
}

function assertTmp(file) {
  const relative = path.relative(path.join(ROOT, "tmp"), file);
  if (!relative || relative.startsWith("..") || path.isAbsolute(relative)) fail("Release evidence must stay inside repository tmp");
}

function writeImmutable(file, value) {
  assertTmp(file);
  const bytes = Buffer.from(`${JSON.stringify(value, null, 2)}\n`);
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, bytes, { flag: "wx" });
  fs.writeFileSync(`${file}.sha256`, `${sha256(bytes)}\n`, { flag: "wx" });
}

function readImmutable(file) {
  const bytes = fs.readFileSync(file);
  const expected = fs.readFileSync(`${file}.sha256`, "utf8").trim();
  if (sha256(bytes) !== expected) fail("Release baseline SHA-256 mismatch");
  const value = JSON.parse(bytes.toString("utf8"));
  const supplied = value.baseline_fingerprint;
  if (supplied !== releaseFingerprint("BASELINE", { ...value, baseline_fingerprint: null })) fail("Release baseline fingerprint mismatch");
  return value;
}

function ownerUrl(envFile) {
  const values = loadEnvFile(envFile);
  if (values.SUPPLEMENTSCOUT_PRODUCTION_PROJECT_REF !== CONTRACT.projectRef) fail("Production owner environment project ref mismatch");
  const value = values.SUPPLEMENTSCOUT_PRODUCTION_OWNER_DATABASE_URL;
  if (!value) fail("Production owner database URL missing");
  return value;
}

async function ownerRead(envFile, callback) {
  const client = new Client({ connectionString: ownerUrl(envFile), ssl: { rejectUnauthorized: false }, application_name: "gtin-promotion-release-read", options: "-c default_transaction_read_only=on -c statement_timeout=120000" });
  await client.connect();
  try {
    await client.query("begin read only");
    const state = await databaseState(client);
    validateDatabaseOwner(CONTRACT, state.identity);
    if (state.identity.read_only !== "on" || state.databaseTarget.target_environment !== "PRODUCTION" || state.databaseTarget.project_ref !== CONTRACT.projectRef) fail("Production read-only identity mismatch");
    const result = await callback(client, state);
    await client.query("rollback");
    return result;
  } finally { await client.end(); }
}

async function snapshot(client) {
  const query = async (sql) => (await client.query(sql)).rows.map((row) => row.data ?? row);
  const [products, variants, offers, mappings] = await Promise.all([
    query("select jsonb_build_object('id',id::text,'gtin',gtin) data from public.products order by id"),
    query("select jsonb_build_object('id',id::text,'product_id',product_id::text,'gtin',gtin) data from public.product_variants order by id"),
    query("select to_jsonb(o) data from public.offers o order by id"),
    query("select to_jsonb(rp) data from public.retailer_products rp order by id"),
  ]);
  return { products, variants, offers, mappings };
}

function snapshotSummary(data, approvedRows = []) {
  const replacements = new Map(approvedRows.map((row) => [row.variant_id, row.gtin]));
  const expectedVariants = data.variants.map((row) => replacements.has(row.id) ? { ...row, gtin: replacements.get(row.id) } : row);
  return {
    products_count: data.products.length,
    products_gtin_fingerprint: releaseFingerprint("PRODUCTS-GTIN", data.products),
    variants_count: data.variants.length,
    variants_gtin_before_fingerprint: releaseFingerprint("VARIANTS-GTIN", data.variants),
    variants_gtin_expected_fingerprint: releaseFingerprint("VARIANTS-GTIN", expectedVariants),
    offers_count: data.offers.length,
    offers_fingerprint: releaseFingerprint("OFFERS", data.offers),
    retailer_products_count: data.mappings.length,
    retailer_products_fingerprint: releaseFingerprint("RETAILER-PRODUCTS", data.mappings),
  };
}

async function capture(options) {
  const loaded = readArtifact(options.artifact);
  const preview = await buildReadOnlyPreview({ target: "production", output: null });
  if (preview.preview.summary.READY_TO_PROMOTE !== 45 || preview.preview.summary.ALREADY_PRESENT !== 9 || preview.preview.summary.BLOCKED !== 0 || preview.preview.summary.MANUAL_REVIEW !== 0) fail("Production preflight is not exact 45 writes / 9 no-ops / 0 conflicts");
  const noOps = preview.preview.rows.filter((row) => row.decision === "ALREADY_PRESENT").map(({ product_id, variant_id, gtin, destination_field, current_value }) => ({ product_id, variant_id, gtin, destination_field, current_value }));
  const baseline = await ownerRead(options["env-file"], async (client) => {
    const data = await snapshot(client);
    return {
      schema_version: 1,
      operation_type: "GTIN_PROMOTION_RELEASE_EXACT_45",
      artifact_sha256: loaded.artifactSha256,
      artifact_fingerprint: loaded.artifact.artifact_fingerprint,
      plan_fingerprint: loaded.artifact.plan.meta.plan_fingerprint,
      source_row_fingerprint: loaded.artifact.plan.meta.source_row_fingerprint,
      run_id: loaded.artifact.run_id,
      captured_at: new Date().toISOString(),
      approved_writes: APPROVED_IDENTITIES,
      already_present: noOps,
      quarantined_gtins: QUARANTINED_GTINS,
      snapshots: data,
      ...snapshotSummary(data, loaded.artifact.plan.rows),
      baseline_fingerprint: null,
    };
  });
  baseline.baseline_fingerprint = releaseFingerprint("BASELINE", baseline);
  writeImmutable(options.output, baseline);
  return { result: "PASS", mode: "production-preflight", expected_writes: 45, already_present: 9, conflicts: 0, database_writes: 0, baseline_fingerprint: baseline.baseline_fingerprint };
}

async function migrationPreflight(options) {
  const pending = CONTRACT.pending.find((row) => row.filename === MIGRATION);
  if (!pending || sha256File(path.join(ROOT, "supabase", "migrations", MIGRATION)) !== pending.sha256) fail("Reviewed GTIN migration contract mismatch");
  return ownerRead(options["env-file"], async (client, state) => {
    const ids = state.remoteLedger.map(ledgerIdentifier);
    if (ids.length === CONTRACT.ledgerCount && ledgerRowsFingerprint(state.remoteLedger) === CONTRACT.ledgerFingerprint && !ids.includes(MIGRATION_ID)) return { result: "PASS", migration_status: "PENDING", database_writes: 0 };
    const prefix = state.remoteLedger.slice(0, CONTRACT.ledgerCount);
    if (ids.length === CONTRACT.ledgerCount + 1 && ids.at(-1) === MIGRATION_ID && ledgerRowsFingerprint(prefix) === CONTRACT.ledgerFingerprint) {
      const schema = (await client.query("select to_regprocedure('public.apply_approved_gtin_promotion_plan(uuid,text,text,text,text)') is not null apply_exists, to_regclass('public.gtin_promotion_quarantine') is not null quarantine_exists")).rows[0];
      if (!schema.apply_exists || !schema.quarantine_exists) fail("Applied GTIN migration schema is incomplete");
      return { result: "PASS", migration_status: "ALREADY_PRESENT", database_writes: 0 };
    }
    fail("Production migration ledger differs from the exact reviewed release state");
  });
}

async function deploy(options) {
  const preflight = await migrationPreflight(options);
  if (preflight.migration_status === "ALREADY_PRESENT") return { result: "PASS", migration_status: "ALREADY_PRESENT", database_writes: 0 };
  const confirmation = pendingConfirmation(CONTRACT);
  const child = spawnSync(process.execPath, [path.join(__dirname, "apply-selected-migrations.js"), "--environment=PRODUCTION", `--project-ref=${CONTRACT.projectRef}`, "--mode=apply", `--confirm=${confirmation}`, `--env-file=${options["env-file"]}`], { cwd: ROOT, encoding: "utf8", env: { ...process.env, SAFE_UPDATE: "" } });
  if (child.status !== 0) fail(`Reviewed migration deploy failed: ${child.stderr || child.stdout}`);
  const after = await migrationPreflight(options);
  if (after.migration_status !== "ALREADY_PRESENT") fail("GTIN migration was not recorded after deploy");
  return { result: "PASS", migration_status: "APPLIED", database_writes: 0, deploy_output_sha256: sha256(child.stdout || "") };
}

async function exact36MigrationPreflight(options) {
  const pending = CONTRACT.pending.find((row) => row.filename === EXACT36_MIGRATION);
  if (!pending || sha256File(path.join(ROOT, "supabase", "migrations", EXACT36_MIGRATION)) !== pending.sha256) fail("Reviewed exact-36 migration contract mismatch");
  return ownerRead(options["env-file"], async (client, state) => {
    const ids = state.remoteLedger.map(ledgerIdentifier);
    if (ids.length === CONTRACT.ledgerCount && ledgerRowsFingerprint(state.remoteLedger) === CONTRACT.ledgerFingerprint && !ids.includes(EXACT36_MIGRATION_ID)) {
      const baseSchema = (await client.query("select to_regprocedure('public.apply_approved_gtin_promotion_plan(uuid,text,text,text,text)') is not null apply_exists, to_regclass('public.gtin_promotion_quarantine') is not null quarantine_exists")).rows[0];
      if (!baseSchema.apply_exists || !baseSchema.quarantine_exists) fail("Base GTIN promotion schema is incomplete");
      return { result: "PASS", migration_status: "PENDING", database_writes: 0 };
    }
    const prefix = state.remoteLedger.slice(0, CONTRACT.ledgerCount);
    if (ids.length === CONTRACT.ledgerCount + 1 && ids.at(-1) === EXACT36_MIGRATION_ID && ledgerRowsFingerprint(prefix) === CONTRACT.ledgerFingerprint) {
      const schema = (await client.query(`select
        to_regprocedure('public.validate_gtin_promotion_plan_exact_36_read_only(jsonb)') is not null exact36_validate_exists,
        to_regprocedure('public.apply_approved_gtin_promotion_plan_exact_36(uuid,text,text,text,text)') is not null exact36_apply_exists,
        to_regprocedure('public.validate_gtin_promotion_plan_read_only(jsonb)') is not null dispatcher_validate_exists,
        to_regprocedure('public.apply_approved_gtin_promotion_plan(uuid,text,text,text,text)') is not null dispatcher_apply_exists`)).rows[0];
      if (!Object.values(schema).every(Boolean)) fail("Applied exact-36 migration schema is incomplete");
      return { result: "PASS", migration_status: "ALREADY_PRESENT", database_writes: 0 };
    }
    fail("Production migration ledger differs from the exact-36 deployment state");
  });
}

async function deployExact36Migration(options) {
  const preflight = await exact36MigrationPreflight(options);
  if (preflight.migration_status === "ALREADY_PRESENT") return { result: "PASS", migration_status: "ALREADY_PRESENT", database_writes: 0 };
  const confirmation = pendingConfirmation(CONTRACT);
  const child = spawnSync(process.execPath, [path.join(__dirname, "apply-selected-migrations.js"), "--environment=PRODUCTION", `--project-ref=${CONTRACT.projectRef}`, "--mode=apply", `--confirm=${confirmation}`, `--env-file=${options["env-file"]}`], { cwd: ROOT, encoding: "utf8", env: { ...process.env, SAFE_UPDATE: "" } });
  if (child.status !== 0) fail(`Exact-36 migration deploy failed: ${child.stderr || child.stdout}`);
  const after = await exact36MigrationPreflight(options);
  if (after.migration_status !== "ALREADY_PRESENT") fail("Exact-36 migration was not recorded after deploy");
  return { result: "PASS", migration_status: "APPLIED", database_writes: 0, deploy_output_sha256: sha256(child.stdout || "") };
}

function compare(anomalies, name, expected, actual) {
  if (JSON.stringify(expected) !== JSON.stringify(actual)) anomalies.push({ check: name, expected, actual });
}

function exactRowDiff(expected, actual) {
  const before = new Map(expected.map((row) => [String(row.id), row]));
  const after = new Map(actual.map((row) => [String(row.id), row]));
  const ids = [...new Set([...before.keys(), ...after.keys()])].sort((a, b) => a.localeCompare(b, undefined, { numeric: true }));
  return ids.filter((id) => JSON.stringify(before.get(id)) !== JSON.stringify(after.get(id))).map((id) => ({ id, expected: before.get(id) ?? null, actual: after.get(id) ?? null }));
}

function compareRows(anomalies, name, expected, actual) {
  const diff = exactRowDiff(expected, actual);
  if (diff.length) anomalies.push({ check: name, changed_row_count: diff.length, rows: diff });
}

async function verify(options) {
  const loaded = readArtifact(options.artifact, { allowExpired: true });
  const baseline = readImmutable(options.baseline);
  const anomalies = [];
  compare(anomalies, "artifact_sha256", baseline.artifact_sha256, loaded.artifactSha256);
  compare(anomalies, "approved_writes", APPROVED_IDENTITIES, baseline.approved_writes);
  const verification = await ownerRead(options["env-file"], async (client) => {
    const data = await snapshot(client);
    const current = snapshotSummary(data, []);
    const expectedVariants = baseline.snapshots.variants.map((row) => {
      const approved = loaded.artifact.plan.rows.find((item) => item.variant_id === row.id);
      return approved ? { ...row, gtin: approved.gtin } : row;
    });
    compare(anomalies, "products_count", baseline.products_count, current.products_count);
    compareRows(anomalies, "products.gtin unchanged", baseline.snapshots.products, data.products);
    compare(anomalies, "variants_count", baseline.variants_count, current.variants_count);
    compareRows(anomalies, "exact variant GTIN postcondition", expectedVariants, data.variants);
    compare(anomalies, "offers_count", baseline.offers_count, current.offers_count);
    compareRows(anomalies, "offers unchanged", baseline.snapshots.offers, data.offers);
    compare(anomalies, "retailer_products_count", baseline.retailer_products_count, current.retailer_products_count);
    compareRows(anomalies, "retailer_products unchanged", baseline.snapshots.mappings, data.mappings);
    const quarantine = (await client.query("select gtin from public.gtin_promotion_quarantine order by gtin")).rows.map((row) => row.gtin);
    compare(anomalies, "16 quarantined unchanged", [...QUARANTINED_GTINS].sort(), quarantine);
    const approvalRows = (await client.query("select status,consumed_at,apply_result from public.approved_import_plans where artifact_sha256=$1 and plan_fingerprint=$2 and run_id=$3", [loaded.artifactSha256, loaded.artifact.plan.meta.plan_fingerprint, loaded.artifact.run_id])).rows;
    compare(anomalies, "one audit ledger row", 1, approvalRows.length);
    if (approvalRows.length === 1) {
      compare(anomalies, "audit consumed", "consumed", approvalRows[0].status);
      compare(anomalies, "audit write count", "45", approvalRows[0].apply_result?.applied_count);
      compare(anomalies, "audit row count", 45, approvalRows[0].apply_result?.rows?.length);
    }
    const owners = new Map();
    for (const row of [...data.products.map((item) => ({ ...item, field: "products.gtin" })), ...data.variants.map((item) => ({ ...item, field: "product_variants.gtin" }))]) {
      if (!row.gtin) continue;
      if (!owners.has(row.gtin)) owners.set(row.gtin, []);
      owners.get(row.gtin).push(`${row.field}:${row.id}`);
    }
    compare(anomalies, "duplicate GTIN conflicts", [], [...owners].filter(([, targets]) => targets.length > 1));
    return current;
  });
  const preview = await buildReadOnlyPreview({ target: "production", output: null });
  const approved = new Set(APPROVED_IDENTITIES.map((row) => `${row.product_id}:${row.variant_id}:${row.gtin}`));
  const approvedNoOps = preview.preview.rows.filter((row) => approved.has(`${row.product_id}:${row.variant_id}:${row.gtin}`) && row.decision === "ALREADY_PRESENT");
  compare(anomalies, "45 approved now already present", 45, approvedNoOps.length);
  compare(anomalies, "full 54 identity dry-run is no-op", { READY_TO_PROMOTE: 0, ALREADY_PRESENT: 54, MANUAL_REVIEW: 0, BLOCKED: 0 }, preview.preview.summary);
  const report = { result: anomalies.length ? "FAILED_VERIFICATION" : "PASS", operation_type: "GTIN_PROMOTION_RELEASE_EXACT_45", verified_writes: approvedNoOps.length, full_no_ops: preview.preview.summary.ALREADY_PRESENT, anomalies, verification, database_writes: 0 };
  writeImmutable(options.output, { ...report, baseline_fingerprint: releaseFingerprint("BASELINE", { ...report, baseline_fingerprint: null }) });
  if (anomalies.length) fail(`FAILED_VERIFICATION: ${JSON.stringify(anomalies)}`);
  return report;
}

async function run(options) {
  if (options.mode === "capture") return capture(options);
  if (options.mode === "migration-preflight") return migrationPreflight(options);
  if (options.mode === "deploy") return deploy(options);
  if (options.mode === "exact36-migration-preflight") return exact36MigrationPreflight(options);
  if (options.mode === "exact36-deploy") return deployExact36Migration(options);
  return verify(options);
}

if (require.main === module) run(parseArgs(process.argv.slice(2))).then((result) => console.log(JSON.stringify(result, null, 2))).catch((error) => { console.error(error.message); process.exitCode = 1; });

module.exports = { EXACT36_MIGRATION, EXACT36_MIGRATION_CONFIRMATION, MIGRATION, QUARANTINED_GTINS, exactRowDiff, parseArgs, run, snapshotSummary };
