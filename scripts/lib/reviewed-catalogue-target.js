const path = require("node:path");
const { normalizeVerifiedConnectionString, postgresClientConfig } = require("./secure-postgres");

const DEFAULT_CREDENTIAL_ROOT = path.join(
  process.env.USERPROFILE || process.env.HOME || "",
  ".supplementscout",
  "credentials",
);

const TARGETS = Object.freeze({
  staging: Object.freeze({
    environment: "STAGING",
    projectRef: "hxnrsyyqffztlvcrtgbf",
    marker: "app.retailer_catalogue_staging_marker",
  }),
  production: Object.freeze({
    environment: "PRODUCTION",
    projectRef: "aftboxmrdgyhizicfsfu",
    marker: "app.retailer_catalogue_production_marker",
  }),
});
const KINDS = new Set(["validator", "approver", "executor"]);

function invariant(condition, message) {
  if (!condition) throw new Error(message);
}

function credentialPath(target, kind, env = process.env) {
  const exactKey = `SUPPLEMENTSCOUT_REVIEWED_${target}_${kind}_CREDENTIAL_FILE`.toUpperCase();
  const exact = String(env[exactKey] || "").trim();
  if (exact) {
    invariant(path.isAbsolute(exact), `${exactKey} must be an absolute path`);
    return path.normalize(exact);
  }
  const configuredRoot = String(env.SUPPLEMENTSCOUT_CREDENTIAL_ROOT || "").trim();
  const root = configuredRoot || DEFAULT_CREDENTIAL_ROOT;
  invariant(path.isAbsolute(root), "Reviewed catalogue credential root must be absolute");
  return path.join(root, `${target}-${kind}.env`);
}

function targetContract(target, kind, env = process.env) {
  const base = TARGETS[target];
  invariant(base, "Reviewed catalogue target must be staging or production");
  invariant(KINDS.has(kind), "Unknown protected reviewed catalogue role");
  return {
    ...base,
    target,
    kind,
    role: `retailer_catalogue_${target}_${kind}`,
    login: `supplementscout_${target}_${kind}_login`,
    credentialPath: credentialPath(target, kind, env),
  };
}

function parseCredential(target, kind, text) {
  const contract = targetContract(target, kind);
  const rows = text.split(/\r?\n/).map(line => line.match(/^([A-Z0-9_]+_DATABASE_URL)=(.*)$/)).filter(Boolean);
  invariant(rows.length === 1, `Protected ${target} ${kind} credential must contain one database URL`);
  let url;
  try { url = new URL(rows[0][2].trim().replace(/^(['"])(.*)\1$/, "$2")); } catch { throw new Error(`Invalid protected ${target} ${kind} credential`); }
  const login = decodeURIComponent(url.username);
  invariant(["postgres:", "postgresql:"].includes(url.protocol), "Direct PostgreSQL credential required");
  invariant(
    (url.hostname === `db.${contract.projectRef}.supabase.co` && login === contract.login) ||
      (/^aws-[a-z0-9-]+\.pooler\.supabase\.com$/.test(url.hostname) && login === `${contract.login}.${contract.projectRef}` && url.port === "5432"),
    `Protected ${target} ${kind} endpoint/login required`,
  );
  invariant(url.pathname === "/postgres" && Boolean(url.password), `Protected ${target} ${kind} password required`);
  for (const key of url.searchParams.keys()) invariant(key === "sslmode", "Unexpected credential option");
  return normalizeVerifiedConnectionString(url.href, `${target} ${kind} reviewed catalogue`);
}

function assertSafeUpdateDisabled(env = process.env) {
  const value = String(env.SAFE_UPDATE || "").trim().toLowerCase();
  invariant(["", "0", "false"].includes(value), "SAFE_UPDATE must be unset or false");
}

function assertManifestTarget(manifest, target) {
  const contract = targetContract(target, "validator");
  if (manifest.kind === "reviewed-catalogue-package-v1") {
    invariant(target === "production", "Reviewed catalogue package v1 remains production-only");
    return contract;
  }
  invariant(manifest.kind === "reviewed-catalogue-package-v2", "Unsupported reviewed catalogue package kind");
  invariant(manifest.target_environment === contract.environment, "Reviewed manifest target environment mismatch");
  invariant(manifest.target_project_ref === contract.projectRef, "Reviewed manifest target project mismatch");
  return contract;
}

async function roleTransaction(client, target, kind, callback, options = {}) {
  const { readOnly = false, env = process.env } = options;
  const contract = targetContract(target, kind);
  const opposite = target === "staging" ? TARGETS.production.marker : TARGETS.staging.marker;
  assertSafeUpdateDisabled(env);
  let began = false;
  try {
    await client.query("begin");
    began = true;
    if (readOnly) await client.query("set transaction read only");
    else await client.query(
      "select set_config($1,'1',true),set_config('app.retailer_catalogue_allow','1',true)",
      [contract.marker],
    );
    await client.query(`set local role ${contract.role}`);
    const identity = (await client.query(
      "select current_user,session_user,current_database(),current_setting('transaction_read_only') transaction_read_only,current_setting($1,true) target_marker,current_setting($2,true) opposite_marker,current_setting('app.retailer_catalogue_allow',true) catalogue_allow,current_setting('app.safe_update',true) safe_update",
      [contract.marker, opposite],
    )).rows[0];
    invariant(identity.current_user === contract.role && identity.session_user === contract.login, `Protected ${target} ${kind} identity mismatch`);
    invariant(identity.current_database === "postgres", `Protected ${target} database mismatch`);
    invariant(!readOnly || identity.transaction_read_only === "on", "Validator transaction is not read only");
    if (!readOnly) {
      invariant(identity.target_marker === "1" && identity.catalogue_allow === "1", `Protected ${target} transaction marker mismatch`);
      invariant(identity.opposite_marker !== "1", "Cross-environment transaction marker detected");
    }
    invariant(!["1", "on", "true"].includes(String(identity.safe_update || "").toLowerCase()), "SAFE_UPDATE is enabled");
    const result = await callback(client);
    await client.query(readOnly ? "rollback" : "commit");
    began = false;
    return result;
  } catch (error) {
    if (began) await client.query("rollback").catch(() => {});
    throw error;
  }
}

function clientConfig(target, kind, connectionString, options = {}) {
  targetContract(target, kind);
  return postgresClientConfig({
    connectionString,
    applicationName: options.applicationName || `reviewed-catalogue-${target}-${kind}`,
    defaultReadOnly: kind === "validator",
    tlsOptions: options.tlsOptions,
  });
}

module.exports = {
  TARGETS,
  assertManifestTarget,
  assertSafeUpdateDisabled,
  clientConfig,
  credentialPath,
  parseCredential,
  roleTransaction,
  targetContract,
};
