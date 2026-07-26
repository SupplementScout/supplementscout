const fs = require("node:fs");
const path = require("node:path");
const { Client } = require("pg");
const {
  buildReviewedContract,
  loadReviewedManifest,
} = require("./lib/reviewed-variant-nutrition");

const ROOT = path.resolve(__dirname, "..");
const TARGETS = Object.freeze({
  staging: Object.freeze({
    environment: "STAGING",
    projectRef: "hxnrsyyqffztlvcrtgbf",
    envFile: path.join(ROOT, ".env.staging.audit.local"),
    urlKey: "SUPPLEMENTSCOUT_STAGING_DATABASE_URL",
  }),
  production: Object.freeze({
    environment: "PRODUCTION",
    projectRef: "aftboxmrdgyhizicfsfu",
    envFile: path.join(
      process.env.USERPROFILE || "",
      ".supplementscout",
      "credentials",
      "production-owner.env",
    ),
    urlKey: "SUPPLEMENTSCOUT_PRODUCTION_OWNER_DATABASE_URL",
  }),
});

function invariant(value, message) {
  if (!value) throw new Error(message);
}

function loadEnvFile(file) {
  const values = {};
  for (const line of fs.readFileSync(file, "utf8").split(/\r?\n/)) {
    const match = line.match(/^([A-Z0-9_]+)=(.*)$/);
    if (match) values[match[1]] = match[2].trim().replace(/^(['"])(.*)\1$/, "$2");
  }
  return values;
}

function parseArgs(argv) {
  const values = {};
  const allowed = new Set([
    "target",
    "mode",
    "manifest",
    "manifest-sha256",
    "authorization-id",
    "env-file",
  ]);
  for (const argument of argv) {
    const match = argument.match(/^--([^=]+)=(.+)$/);
    invariant(
      match && allowed.has(match[1]) && values[match[1]] === undefined,
      `invalid argument ${argument}`,
    );
    values[match[1]] = match[2];
  }
  invariant(TARGETS[values.target], "--target=staging|production is required");
  invariant(values.mode === "dry-run" || values.mode === "apply", "--mode=dry-run|apply is required");
  for (const key of ["manifest", "manifest-sha256", "authorization-id"]) {
    invariant(values[key], `--${key} is required`);
  }
  return {
    target: values.target,
    mode: values.mode,
    manifest: path.resolve(values.manifest),
    manifestSha256: values["manifest-sha256"],
    authorizationId: values["authorization-id"],
    envFile: values["env-file"] ? path.resolve(values["env-file"]) : TARGETS[values.target].envFile,
  };
}

function ownerDatabaseUrl(options) {
  const target = TARGETS[options.target];
  const env = loadEnvFile(options.envFile);
  invariant(env[target.urlKey], `${target.environment} owner database URL is missing`);
  const parsed = new URL(env[target.urlKey]);
  parsed.searchParams.delete("sslmode");
  invariant(
    parsed.href.includes(target.projectRef),
    `${target.environment} owner database target mismatch`,
  );
  const opposite = options.target === "production" ? TARGETS.staging : TARGETS.production;
  invariant(!parsed.href.includes(opposite.projectRef), "opposite database target rejected");
  return parsed.href;
}

async function resolveTargetChanges(client, reviewedChanges) {
  const targetChanges = [];
  for (const row of reviewedChanges) {
    const result = await client.query(`
      select p.id::text product_id,v.id::text variant_id
      from public.products p
      join public.product_variants v on v.product_id=p.id
      where p.name=$1
        and v.variant_key=$2
        and v.display_name=$3
        and p.is_active
        and v.is_active
        and p.merged_into_product_id is null
        and p.merged_at is null
      order by p.id,v.id
    `, [
      row.expected_product_name,
      row.expected_variant_key,
      row.expected_display_name,
    ]);
    invariant(
      result.rows.length === 1,
      `target identity resolution failed for ${row.expected_product_name} / ${row.expected_variant_key}`,
    );
    targetChanges.push({
      ...row,
      product_id: result.rows[0].product_id,
      variant_id: result.rows[0].variant_id,
    });
  }
  return targetChanges;
}

async function execute(options, connectionString) {
  invariant(process.env.SAFE_UPDATE === undefined, "SAFE_UPDATE must be unset");
  const reviewed = loadReviewedManifest(options.manifest, options.manifestSha256);
  const target = TARGETS[options.target];
  const dryRun = options.mode === "dry-run";
  const client = new Client({
    connectionString,
    ssl: { rejectUnauthorized: false },
    application_name: "reviewed-variant-nutrition",
    options: "-c statement_timeout=120000",
  });
  await client.connect();
  try {
    await client.query(dryRun ? "begin read only" : "begin");
    const identity = (await client.query(`
      select current_user,session_user,current_setting('transaction_read_only') read_only,
             current_setting('app.safe_update',true) safe_update,
             public.retailer_catalogue_actual_database_target() database_target
    `)).rows[0];
    invariant(identity.current_user === "postgres", "database owner current_user mismatch");
    invariant(identity.session_user === "postgres", "database owner session_user mismatch");
    invariant(identity.safe_update == null, "database SAFE_UPDATE must be unset");
    invariant(
      identity.database_target?.target_environment === target.environment &&
        identity.database_target?.project_ref === target.projectRef,
      "trusted database target mismatch",
    );
    if (dryRun) invariant(identity.read_only === "on", "dry-run transaction is not read-only");
    const targetChanges = await resolveTargetChanges(
      client,
      reviewed.manifest.changes,
    );
    const contract = buildReviewedContract({
      reviewed,
      targetEnvironment: target.environment,
      authorizationId: options.authorizationId,
      targetChanges,
    });
    const result = (await client.query(
      "select public.apply_reviewed_product_variant_nutrition($1::jsonb,$2::boolean) result",
      [contract, dryRun],
    )).rows[0].result;
    if (dryRun) {
      invariant(
        result.status === "READY" || result.status === "ALREADY_APPLIED",
        "reviewed nutrition dry-run did not pass",
      );
      invariant(
        Number(result.business_writes) === 0 &&
          Number(result.control_plane_writes) === 0,
        "dry-run reported writes",
      );
      await client.query("rollback");
    } else {
      invariant(
        result.status === "APPLIED" || result.status === "ALREADY_APPLIED",
        "reviewed nutrition apply did not complete",
      );
      await client.query("commit");
    }
    return {
      result,
      reviewed_manifest_sha256: reviewed.sha256,
      reviewed_scope_hash: reviewed.manifest.reviewed_scope_hash,
      reviewed_contract_hash: contract.reviewed_contract_hash,
      database_identity: {
        current_user: identity.current_user,
        session_user: identity.session_user,
        read_only: identity.read_only,
        safe_update: identity.safe_update || "UNSET",
      },
    };
  } catch (error) {
    try {
      await client.query("rollback");
    } catch {}
    throw error;
  } finally {
    await client.end();
  }
}

async function main(argv = process.argv.slice(2)) {
  const options = parseArgs(argv);
  const result = await execute(options, ownerDatabaseUrl(options));
  console.log(JSON.stringify(result, null, 2));
}

if (require.main === module) {
  main().catch((error) => {
    console.error(error.message);
    process.exitCode = 1;
  });
}

module.exports = {
  TARGETS,
  execute,
  loadEnvFile,
  ownerDatabaseUrl,
  parseArgs,
  resolveTargetChanges,
};
