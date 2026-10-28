const fs = require("node:fs");
const path = require("node:path");
const { Client } = require("pg");
const {
  buildPreparedPackage,
  loadPackage,
  sha256,
} = require("./lib/reviewed-product-pack-correction");
const {
  TARGETS,
  clientConfig,
  parseCredential,
  roleTransaction,
  targetContract,
} = require("./lib/reviewed-catalogue-target");
const { assertCleanMain, safeError } = require("./reviewed-catalogue-package-executor");

const ROOT = path.resolve(__dirname, "..");
const VALIDATE_SQL = "select public.validate_reviewed_product_pack_correction_read_only($1::jsonb) result";
const APPROVE_SQL = "select public.approve_reviewed_product_pack_correction($1::jsonb,$2,now()+interval '15 minutes') result";
const APPLY_SQL = "select public.apply_approved_reviewed_product_pack_correction($1::uuid,$2::jsonb,$3) result";
const READBACK_SQL = "select public.read_reviewed_product_pack_correction_state($1::jsonb) result";
const MODES = new Set(["prepare", "preflight", "apply"]);

function invariant(condition, message) {
  if (!condition) throw new Error(message);
}

function parseArgs(argv) {
  const values = {};
  const allowed = new Set([
    "mode", "target", "source-artifact", "source-artifact-sha256",
    "source-artifact-fingerprint", "evidence-sha256", "package",
    "package-sha256", "output", "confirm-reviewed-product-pack-correction",
  ]);
  for (const arg of argv) {
    const match = arg.match(/^--([a-z0-9-]+)=(.+)$/);
    invariant(match && allowed.has(match[1]), "Unknown or incomplete product pack correction argument");
    invariant(values[match[1]] === undefined, "Duplicate product pack correction argument");
    values[match[1]] = match[2];
  }
  invariant(MODES.has(values.mode), "Product pack correction mode must be prepare, preflight or apply");
  invariant(TARGETS[values.target], "Product pack correction target must be staging or production");
  invariant(typeof values.output === "string", "Product pack correction output is required");
  if (values.mode === "prepare") {
    const required = ["source-artifact", "source-artifact-sha256", "source-artifact-fingerprint", "evidence-sha256"];
    invariant(required.every(key => values[key]), "Prepare requires exact source artifact and evidence bindings");
    invariant(Object.keys(values).length === 7, "Unexpected prepare argument");
  } else {
    invariant(values.package && values["package-sha256"], "Preflight/apply requires exact package path and SHA-256");
    const expectedCount = values.mode === "apply" ? 6 : 5;
    invariant(Object.keys(values).length === expectedCount, `Unexpected ${values.mode} argument`);
    if (values.mode === "apply") invariant(values["confirm-reviewed-product-pack-correction"] === "true", "Apply requires explicit reviewed product pack correction confirmation");
  }
  return {
    mode: values.mode,
    target: values.target,
    outputPath: values.output.replaceAll("\\", "/"),
    sourceArtifactPath: values["source-artifact"]?.replaceAll("\\", "/"),
    sourceArtifactSha256: values["source-artifact-sha256"]?.toLowerCase(),
    sourceArtifactFingerprint: values["source-artifact-fingerprint"]?.toLowerCase(),
    evidenceSha256: values["evidence-sha256"]?.toLowerCase(),
    packagePath: values.package?.replaceAll("\\", "/"),
    packageSha256: values["package-sha256"]?.toLowerCase(),
    confirmed: values["confirm-reviewed-product-pack-correction"] === "true",
  };
}

function temporaryPath(relativePath, label) {
  invariant(typeof relativePath === "string" && relativePath.startsWith("tmp/"), `${label} must be under tmp/`);
  const absolute = path.resolve(ROOT, relativePath);
  const relative = path.relative(ROOT, absolute);
  invariant(relative && !relative.startsWith("..") && !path.isAbsolute(relative), `${label} escapes repository`);
  return absolute;
}

function writeNewJson(relativePath, value, writeFile = fs.writeFileSync) {
  const absolute = temporaryPath(relativePath, "Product pack correction output");
  invariant(!fs.existsSync(absolute), "Product pack correction output already exists");
  fs.mkdirSync(path.dirname(absolute), { recursive: true });
  const bytes = Buffer.from(`${JSON.stringify(value, null, 2)}\n`, "utf8");
  writeFile(absolute, bytes, { flag: "wx" });
  return { absolute, sha256: sha256(bytes), bytes };
}

async function connect(target, kind, ClientClass = Client) {
  const contract = targetContract(target, kind);
  const credential = parseCredential(target, kind, fs.readFileSync(contract.credentialPath, "utf8"));
  const client = new ClientClass(clientConfig(target, kind, credential, {
    applicationName: `reviewed-product-pack-correction-${target}-${kind}`,
  }));
  await client.connect();
  return client;
}

function assertState(result, packageValue, expectedValue, label) {
  invariant(result?.valid === true, `${label} did not return valid state`);
  invariant(String(result.product_id) === packageValue.operation.product_id, `${label} product ID mismatch`);
  invariant(result.table === "products" && result.field === "net_weight_g", `${label} scope mismatch`);
  invariant(String(result.current_value) === expectedValue, `${label} net_weight_g mismatch`);
  invariant(Number(result.products_count) >= 1, `${label} product count invalid`);
}

function assertReceipt(receipt, loaded) {
  invariant(receipt && /^[0-9a-f-]{36}$/i.test(receipt.approval_id || ""), "Product pack correction approval receipt invalid");
  const expected = {
    status: "approved",
    artifact_sha256: loaded.packageSha256,
    package_fingerprint: loaded.value.package_fingerprint,
    product_id: loaded.value.operation.product_id,
    field: "net_weight_g",
    target_environment: loaded.value.target_environment,
    target_project_ref: loaded.value.target_project_ref,
  };
  for (const [key, value] of Object.entries(expected)) invariant(String(receipt[key]) === String(value), `Product pack correction approval ${key} mismatch`);
  const expires = Date.parse(receipt.expires_at);
  invariant(expires > Date.now() && expires <= Date.now() + 16 * 60_000, "Product pack correction approval expiry invalid");
}

async function run(options, dependencies = {}) {
  const writeNewJsonImpl = dependencies.writeNewJson || writeNewJson;
  if (options.mode === "prepare") {
    const value = buildPreparedPackage({ root: ROOT, ...options });
    const written = writeNewJsonImpl(options.outputPath, value);
    return {
      result: "PASS",
      mode: "prepare",
      output_path: options.outputPath,
      package_fingerprint: value.package_fingerprint,
      package_sha256: written.sha256,
      database_writes: 0,
    };
  }

  const loaded = (dependencies.loadPackage || loadPackage)({
    root: ROOT,
    packagePath: options.packagePath,
    packageSha256: options.packageSha256,
    target: options.target,
  });
  const connectImpl = dependencies.connect || connect;
  const transaction = dependencies.roleTransaction || roleTransaction;
  const clients = {};
  const audit = {
    schema_version: 1,
    kind: "reviewed-catalogue-product-pack-correction-audit-v1",
    mode: options.mode,
    result: "RUNNING",
    package_path: options.packagePath,
    package_sha256: loaded.packageSha256,
    package_fingerprint: loaded.value.package_fingerprint,
    target_environment: loaded.value.target_environment,
    target_project_ref: loaded.value.target_project_ref,
    operation: loaded.value.operation,
    approval_count: 0,
    apply_count: 0,
    business_row_writes: 0,
    control_row_writes: 0,
    database_write_statements: 0,
  };
  try {
    clients.validator = await connectImpl(options.target, "validator", dependencies.Client || Client);
    const before = await transaction(clients.validator, options.target, "validator", async client => {
      const rows = (await client.query(VALIDATE_SQL, [loaded.value])).rows;
      invariant(rows.length === 1, "Product pack correction validator must return exactly once");
      return rows[0].result;
    }, { readOnly: true });
    assertState(before, loaded.value, loaded.value.operation.expected_before, "Product pack correction preflight");
    audit.preflight = before;
    if (options.mode === "preflight") {
      Object.assign(audit, { result: "PASS", database_writes: 0 });
      const written = writeNewJsonImpl(options.outputPath, audit);
      return { ...audit, output_path: options.outputPath, audit_sha256: written.sha256 };
    }

    invariant(options.confirmed === true, "Product pack correction apply confirmation missing");
    invariant(loaded.value.status === "OWNER_APPROVED", "Product pack correction package is not owner approved");
    const sourceCommit = (dependencies.assertCleanMain || assertCleanMain)(dependencies.execFileSync);
    clients.approver = await connectImpl(options.target, "approver", dependencies.Client || Client);
    clients.executor = await connectImpl(options.target, "executor", dependencies.Client || Client);
    const receipt = await transaction(clients.approver, options.target, "approver", async client => {
      const rows = (await client.query(APPROVE_SQL, [loaded.value, loaded.packageSha256])).rows;
      invariant(rows.length === 1, "Product pack correction approval must return exactly once");
      return rows[0].result;
    });
    assertReceipt(receipt, loaded);
    audit.approval_count = 1;
    const applied = await transaction(clients.executor, options.target, "executor", async client => {
      const rows = (await client.query(APPLY_SQL, [receipt.approval_id, loaded.value, loaded.packageSha256])).rows;
      invariant(rows.length === 1, "Product pack correction apply must return exactly once");
      return rows[0].result;
    });
    invariant(applied?.approval_status === "consumed" && applied.updated_rows === 1, "Product pack correction apply receipt invalid");
    invariant(applied.row_count_delta === 0, "Product pack correction apply row-count delta mismatch");
    invariant(String(applied.before_value) === loaded.value.operation.expected_before && String(applied.after_value) === loaded.value.operation.reviewed_after, "Product pack correction apply value mismatch");
    audit.apply_count = 1;
    audit.business_row_writes = 1;
    audit.control_row_writes = 2;
    audit.database_write_statements = 3;
    const after = await transaction(clients.validator, options.target, "validator", async client => {
      const rows = (await client.query(READBACK_SQL, [loaded.value])).rows;
      invariant(rows.length === 1, "Product pack correction readback must return exactly once");
      return rows[0].result;
    }, { readOnly: true });
    assertState(after, loaded.value, loaded.value.operation.reviewed_after, "Product pack correction readback");
    invariant(after.products_count === before.products_count, "Product pack correction final product count changed");
    Object.assign(audit, {
      result: "PASS",
      source_commit: sourceCommit,
      approval: receipt,
      apply: applied,
      readback: after,
    });
    const written = writeNewJsonImpl(options.outputPath, audit);
    return { ...audit, output_path: options.outputPath, audit_sha256: written.sha256 };
  } catch (error) {
    audit.result = "BLOCKED";
    audit.safe_error = safeError(error);
    try { writeNewJsonImpl(options.outputPath, audit); } catch {}
    throw error;
  } finally {
    await Promise.all(Object.values(clients).map(client => client.end().catch(() => {})));
  }
}

if (require.main === module) {
  Promise.resolve().then(() => run(parseArgs(process.argv.slice(2))))
    .then(result => console.log(JSON.stringify(result, null, 2)))
    .catch(error => { console.error(`Reviewed product pack correction stopped: ${safeError(error)}`); process.exitCode = 1; });
}

module.exports = {
  APPLY_SQL,
  APPROVE_SQL,
  READBACK_SQL,
  VALIDATE_SQL,
  assertReceipt,
  assertState,
  connect,
  parseArgs,
  run,
  writeNewJson,
};
