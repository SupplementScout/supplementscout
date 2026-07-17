const fs = require("node:fs");
const { spawnSync } = require("node:child_process");
const { sqlLiteral } = require("./retailer-snapshot-phase2-ledger");
const { validateFrozenFixture, validateRequest } = require("./lib/retailer-snapshot/staging-execution-contract");

const MODES = new Set(["fixture-validate", "dry-run-local", "execute-local-simulation", "recovery-local-simulation", "guard-test"]);
const LOCAL_HOSTS = new Set(["localhost", "127.0.0.1", "::1", "host.docker.internal"]);
const PROTECTED_TARGETS = ["aftboxmrdgyhizicfsfu", "hxnrsyyqffztlvcrtgbf.supabase", "supabase.co", "pooler.supabase.com"];
function parseArgs(argv) { const out = { mode: argv[0] }; for (const arg of argv.slice(1)) { if (["--allow-staging-simulation", "--disposable-database"].includes(arg)) out[arg.slice(2)] = true; else { const match = arg.match(/^--([^=]+)=(.*)$/); if (!match) throw new Error(`Unknown argument: ${arg}`); out[match[1]] = match[2]; } } return out; }
function guard(options, env = process.env) {
  if (!MODES.has(options.mode)) throw new Error("unsupported staging simulation mode");
  if (options.mode === "fixture-validate") return { fixtureOnly: true };
  if (!options["allow-staging-simulation"] || !options["disposable-database"]) throw new Error("explicit disposable staging simulation flags required");
  if (/^(1|true|yes|on)$/i.test(String(env.SAFE_UPDATE || ""))) throw new Error("SAFE_UPDATE must remain false or unset");
  for (const [key, value] of Object.entries(env)) if (value && /SUPABASE_(?:URL|ANON_KEY|SERVICE_ROLE_KEY)|DATABASE_URL/i.test(key)) throw new Error(`credential-bearing environment variable rejected: ${key}`);
  if (!options["database-url"] && !options["docker-container"]) throw new Error("local disposable PostgreSQL target required");
  const raw = options["database-url"] || `postgresql://postgres@localhost/${options["database-name"] || ""}`;
  if (PROTECTED_TARGETS.some((token) => raw.toLowerCase().includes(token))) throw new Error("remote/protected target rejected");
  const url = new URL(raw); if (!LOCAL_HOSTS.has(url.hostname)) throw new Error("only loopback/Docker PostgreSQL is permitted");
  const database = url.pathname.slice(1) || options["database-name"];
  if (!/^supplementscout_(?:stage3_test_staging_executor|stage2_test_atomic_import_staging_executor)_[a-z0-9_]+$/.test(database || "")) throw new Error("disposable staging executor database name rejected");
  return { database, url: raw };
}
function query(options, sql) {
  const target = guard(options);
  const args = options["docker-container"] ? ["exec", "-i", options["docker-container"], "psql", "-X", "--no-psqlrc", "-v", "ON_ERROR_STOP=1", "-U", "postgres", "-d", target.database, "-tA", "-f", "-"] : null;
  const result = args ? spawnSync("docker", args, { encoding: "utf8", input: `${sql}\n` }) : spawnSync("psql", [target.url, "-X", "--no-psqlrc", "-v", "ON_ERROR_STOP=1", "-tA", "-f", "-"], { encoding: "utf8", input: `${sql}\n` });
  if (result.error || result.status !== 0) throw new Error(result.error?.message || result.stderr || result.stdout);
  return JSON.parse(result.stdout.trim().split(/\r?\n/).at(-1));
}
function main(argv = process.argv.slice(2), env = process.env) {
  const options = parseArgs(argv); const target = guard(options, env);
  if (options.mode === "fixture-validate") return { valid: true, fixture_id: validateFrozenFixture(options.fixture).fixture_id, remote_connections: 0 };
  if (options.mode === "guard-test") return { guarded: true, database: target.database, remote_connections: 0 };
  const request = JSON.parse(fs.readFileSync(options.request, "utf8")); validateRequest(request);
  const settings = `set local app.retailer_catalogue_staging_marker='1'; set local app.retailer_catalogue_allow='1'; set local app.safe_update='false'; set local app.retailer_catalogue_project_ref='hxnrsyyqffztlvcrtgbf'; set local app.retailer_catalogue_database_identity='supplementscout-staging:hxnrsyyqffztlvcrtgbf'; set local app.retailer_catalogue_migration_fingerprint=${sqlLiteral(request.migration_ledger_fingerprint)}; set local app.retailer_catalogue_invocation_role='retailer_catalogue_staging_executor';`;
  const rpc = options.mode === "recovery-local-simulation" ? "recover_staging_retailer_catalogue_child" : "execute_staging_retailer_catalogue_child";
  return query(options, `begin; ${settings} select public.${rpc}(${sqlLiteral(JSON.stringify(request))}::jsonb)::text; commit;`);
}
if (require.main === module) { try { console.log(JSON.stringify(main(), null, 2)); } catch (error) { console.error(error.message); process.exitCode = 1; } }
module.exports = { LOCAL_HOSTS, MODES, PROTECTED_TARGETS, guard, main, parseArgs, query };
