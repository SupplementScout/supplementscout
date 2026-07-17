const crypto = require("node:crypto");
const fs = require("node:fs");
const { spawnSync } = require("node:child_process");
const { canonicalize } = require("./lib/retailer-snapshot/fingerprints");
const { LocalLedgerClient, sqlLiteral } = require("./retailer-snapshot-phase2-ledger");

const MODES = new Set(["dry-run", "execute", "status", "resume-preview"]);
const LOCAL_HOSTS = new Set(["localhost", "127.0.0.1", "::1", "host.docker.internal"]);
const BLOCKED_REFS = ["aftboxmrdgyhizicfsfu", "hxnrsyyqffztlvcrtgbf", "supabase.co", "pooler.supabase.com"];

function sha256(value) { return crypto.createHash("sha256").update(value).digest("hex"); }
function parseArgs(argv) {
  const options = { command: argv[0] };
  for (const arg of argv.slice(1)) {
    if (["--allow-local-business-writes", "--disposable-database"].includes(arg)) options[arg.slice(2)] = true;
    else { const match = arg.match(/^--([^=]+)=(.*)$/); if (!match) throw new Error(`Unknown argument: ${arg}`); options[match[1]] = match[2]; }
  }
  return options;
}
function requestFingerprint(request) { return sha256(canonicalize({ ...request, request_fingerprint: null })); }
function loadRequest(file, mode) {
  if (!file) throw new Error("--request is required");
  const request = JSON.parse(fs.readFileSync(file, "utf8"));
  request.execution_mode = mode === "execute" ? "LOCAL_DISPOSABLE_EXECUTE" : "LOCAL_DISPOSABLE_DRY_RUN";
  request.request_fingerprint = requestFingerprint(request);
  return request;
}
function guard(options, env = process.env) {
  if (!options["allow-local-business-writes"] || !options["disposable-database"]) throw new Error("Phase 3 requires --allow-local-business-writes and --disposable-database");
  if ((env.SAFE_UPDATE || "false").toLowerCase() !== "false") throw new Error("SAFE_UPDATE must be false or unset");
  if (env.SUPABASE_SERVICE_ROLE_KEY) throw new Error("SUPABASE_SERVICE_ROLE_KEY must not be present");
  if (!options["database-url"] && !options["docker-container"]) throw new Error("A local --database-url or --docker-container is required");
  const raw = options["database-url"] || `postgresql://postgres@localhost/${options["database-name"] || ""}`;
  if (BLOCKED_REFS.some((token) => raw.toLowerCase().includes(token))) throw new Error("Supabase and protected database targets are forbidden");
  const url = new URL(raw);
  if (!LOCAL_HOSTS.has(url.hostname)) throw new Error(`Remote PostgreSQL host rejected: ${url.hostname}`);
  const database = (url.pathname || "").slice(1) || options["database-name"];
  if (!/^supplementscout_(phase3_test|stage2_test|retailer_ledger_test)[_a-z0-9]*$/.test(database || "")) throw new Error(`Disposable test database name rejected: ${database || "<missing>"}`);
  if (["staging", "production"].includes(String(options.target || "").toLowerCase())) throw new Error("staging and production targets are forbidden");
  return { database, url: raw };
}
function query(options, sql) {
  const target = guard(options);
  const args = options["docker-container"]
    ? ["exec", options["docker-container"], "psql", "-X", "--no-psqlrc", "-v", "ON_ERROR_STOP=1", "-U", "postgres", "-d", target.database, "-tA", "-c", sql]
    : null;
  const result = args ? spawnSync("docker", args, { encoding: "utf8" }) : spawnSync("psql", [target.url, "-X", "--no-psqlrc", "-v", "ON_ERROR_STOP=1", "-tA", "-c", sql], { encoding: "utf8" });
  if (result.error || result.status !== 0) throw new Error(result.error?.message || result.stderr || result.stdout);
  return JSON.parse(result.stdout.trim().split(/\r?\n/).at(-1));
}
function main(argv = process.argv.slice(2), env = process.env) {
  const options = parseArgs(argv);
  const mode = options.command;
  if (!MODES.has(mode)) throw new Error(`Expected mode: ${[...MODES].join(", ")}`);
  const target = guard(options, env);
  process.stderr.write(`Phase 3 target: LOCAL disposable PostgreSQL ${target.database}\n`);
  if (mode === "status" || mode === "resume-preview") {
    const client = new LocalLedgerClient({ ...options, command: mode === "status" ? "status" : "resume", "allow-local-ledger": true, target: "local-postgres" }, env);
    return mode === "status" ? client.status(options["parent-id"]) : client.resume(options["parent-id"], options["parent-fingerprint"], "PREVIEW", options.actor || "phase3-local-cli");
  }
  const request = loadRequest(options.request, mode);
  return query(options, `begin; set local app.retailer_catalogue_disposable='1'; set local app.safe_update='false'; select public.execute_local_retailer_catalogue_child(${sqlLiteral(JSON.stringify(request))}::jsonb)::text; commit;`);
}
if (require.main === module) { try { console.log(JSON.stringify(main(), null, 2)); } catch (error) { console.error(error.message); process.exitCode = 1; } }
module.exports = { BLOCKED_REFS, LOCAL_HOSTS, guard, loadRequest, main, parseArgs, query, requestFingerprint };
