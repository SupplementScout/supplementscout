const fs = require("node:fs");
const { spawnSync } = require("node:child_process");
const { sqlLiteral } = require("./retailer-snapshot-phase2-ledger");
const { PRODUCTION_REF, STAGING_REF, validateFrozenFixture, validatePackage, validateRecoveryRequest, validateRequest } = require("./lib/retailer-snapshot/staging-execution-contract");

const LOCAL_MODES = new Set(["dry-run-local", "execute-local-simulation", "recovery-local-simulation", "guard-test"]);
const REMOTE_MODES = new Set(["execute-staging", "recovery-staging"]);
const MODES = new Set(["fixture-validate", "package-validate", ...LOCAL_MODES, ...REMOTE_MODES]);
const LOCAL_HOSTS = new Set(["localhost", "127.0.0.1", "::1", "host.docker.internal"]);
const PROTECTED_TARGETS = [PRODUCTION_REF, "db.aftboxmrdgyhizicfsfu.supabase.co"];

function parseArgs(argv) {
  const out = { mode: argv[0] };
  for (const arg of argv.slice(1)) {
    if (["--allow-staging-simulation", "--allow-staging-business-writes", "--disposable-database"].includes(arg)) out[arg.slice(2)] = true;
    else { const match = arg.match(/^--([^=]+)=(.*)$/); if (!match) throw new Error(`Unknown argument: ${arg}`); out[match[1]] = match[2]; }
  }
  return out;
}

function rejectCredentialEnvironment(env) {
  if (/^(1|true|yes|on)$/i.test(String(env.SAFE_UPDATE || ""))) throw new Error("SAFE_UPDATE must remain false or unset");
  for (const [key, value] of Object.entries(env)) if (value && /SUPABASE_(?:URL|ANON_KEY|SERVICE_ROLE_KEY)|DATABASE_URL|POSTGRES_URL/i.test(key)) throw new Error(`credential-bearing environment variable rejected: ${key}`);
}

function isExactStagingEndpoint(url) {
  const host = url.hostname.toLowerCase();
  if (host === `db.${STAGING_REF}.supabase.co`) return true;
  return host.endsWith(".pooler.supabase.com") && decodeURIComponent(url.username).endsWith(`.${STAGING_REF}`);
}

function guard(options, env = process.env) {
  if (!MODES.has(options.mode)) throw new Error("unsupported staging executor mode");
  if (["fixture-validate", "package-validate"].includes(options.mode)) return { artifactOnly: true, remote: false };
  rejectCredentialEnvironment(env);
  if (!options["database-url"] && !options["docker-container"]) throw new Error("an explicit PostgreSQL target is required");
  const raw = options["database-url"] || `postgresql://postgres@localhost/${options["database-name"] || ""}`;
  if (PROTECTED_TARGETS.some((token) => raw.toLowerCase().includes(token))) throw new Error("production target rejected");
  const url = new URL(raw);
  const database = url.pathname.slice(1) || options["database-name"];

  if (LOCAL_MODES.has(options.mode)) {
    if (!options["allow-staging-simulation"] || !options["disposable-database"]) throw new Error("explicit disposable staging simulation flags required");
    if (!LOCAL_HOSTS.has(url.hostname)) throw new Error("only loopback/Docker PostgreSQL is permitted for simulation");
    if (!/^supplementscout_(?:stage3_test_staging_executor|stage2_test_atomic_import_staging_executor)_[a-z0-9_]+$/.test(database || "")) throw new Error("disposable staging executor database name rejected");
    return { database, remote: false, url: raw };
  }

  if (!options["allow-staging-business-writes"] || options["target-project-ref"] !== STAGING_REF) throw new Error("explicit exact staging authorization flags required");
  if (options["docker-container"] || LOCAL_HOSTS.has(url.hostname) || !isExactStagingEndpoint(url) || database !== "postgres") throw new Error("exact Supabase staging endpoint rejected");
  return { database, remote: true, url: raw };
}

function query(options, sql) {
  const target = guard(options);
  const args = options["docker-container"] ? ["exec", "-i", options["docker-container"], "psql", "-X", "--no-psqlrc", "-v", "ON_ERROR_STOP=1", "-U", "postgres", "-d", target.database, "-tA", "-f", "-"] : null;
  const result = args ? spawnSync("docker", args, { encoding: "utf8", input: `${sql}\n` }) : spawnSync("psql", [target.url, "-X", "--no-psqlrc", "-v", "ON_ERROR_STOP=1", "-tA", "-f", "-"], { encoding: "utf8", input: `${sql}\n` });
  if (result.error || result.status !== 0) throw new Error(result.error?.message || result.stderr || result.stdout);
  return JSON.parse(result.stdout.trim().split(/\r?\n/).at(-1));
}

function main(argv = process.argv.slice(2), env = process.env) {
  const options = parseArgs(argv);
  const target = guard(options, env);
  if (options.mode === "fixture-validate") return { valid: true, fixture_id: validateFrozenFixture(options.fixture).fixture_id, remote_connections: 0 };
  if (options.mode === "guard-test") return { guarded: true, database: target.database, remote_connections: 0 };
  const packageValue = validatePackage(JSON.parse(fs.readFileSync(options.package, "utf8")));
  if (options.mode === "package-validate") return { valid: true, package_id: packageValue.package_id, package_fingerprint: packageValue.package_fingerprint, code_commit: packageValue.code_commit, remote_connections: 0 };
  const request = JSON.parse(fs.readFileSync(options.request, "utf8"));
  const recovery = options.mode.includes("recovery");
  if (recovery) validateRecoveryRequest(request, packageValue); else validateRequest(request, packageValue);
  const role = recovery || options.mode.includes("execute") || options.mode === "dry-run-local" ? "retailer_catalogue_staging_executor" : "retailer_catalogue_staging_approver";
  const settings = `set local role ${role}; set local app.retailer_catalogue_staging_marker='1'; set local app.retailer_catalogue_allow='1'; set local app.safe_update='false';`;
  const rpc = recovery ? "recover_staging_retailer_catalogue_child" : "execute_staging_retailer_catalogue_child";
  return query(options, `begin; ${settings} select public.${rpc}(${sqlLiteral(JSON.stringify(request))}::jsonb)::text; commit;`);
}

if (require.main === module) { try { console.log(JSON.stringify(main(), null, 2)); } catch (error) { console.error(error.message); process.exitCode = 1; } }
module.exports = { LOCAL_HOSTS, LOCAL_MODES, MODES, PROTECTED_TARGETS, REMOTE_MODES, guard, isExactStagingEndpoint, main, parseArgs, query };
