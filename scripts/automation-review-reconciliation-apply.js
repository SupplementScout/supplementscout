const fs = require("node:fs");
const path = require("node:path");
const dotenv = require("dotenv");
const { createClient } = require("@supabase/supabase-js");
const { validateRpcResult } = require("./lib/automation-review-publisher");

const ROOT = path.resolve(__dirname, "..");
const DEFAULT_INPUT = path.join(ROOT, "tmp", "automation-review-reconciliation", "reconciliation-dry-run.json");
const DEFAULT_OUTPUT = path.join(ROOT, "tmp", "automation-review-reconciliation", "reconciliation-apply.json");

function fail(message) { throw new Error(message); }
function parseArgs(argv) {
  const options = { input: DEFAULT_INPUT, output: DEFAULT_OUTPUT };
  for (const arg of argv) {
    const match = arg.match(/^--(input|output)=(.+)$/);
    if (!match) fail(`Invalid argument ${arg}`);
    options[match[1]] = path.resolve(match[2]);
  }
  for (const file of [options.input, options.output]) {
    const relative = path.relative(path.join(ROOT, "tmp"), file);
    if (!relative || relative.startsWith("..") || path.isAbsolute(relative)) fail("Reconciliation files must stay inside tmp");
  }
  return options;
}
function assertContext(report, env = process.env) {
  if (env.GITHUB_ACTIONS !== "true" || !["schedule", "workflow_dispatch"].includes(env.GITHUB_EVENT_NAME) || env.GITHUB_REF !== "refs/heads/main" || env.GITHUB_REPOSITORY !== "SupplementScout/supplementscout") fail("RECONCILIATION_APPLY_CONTEXT_INVALID");
  if (report?.schema_version !== 1 || report.kind !== "automation-review-queue-reconciliation-dry-run" || report.result !== "PASS" || report.mode !== "dry-run" || report.production_writes !== 0 || report.expected?.catalogue_writes !== 0) fail("RECONCILIATION_DRY_RUN_INVALID");
  if (String(report.source?.run_id) !== String(env.GITHUB_RUN_ID) || report.source?.commit_sha !== env.GITHUB_SHA || report.github_context?.run_id !== String(env.GITHUB_RUN_ID)) fail("RECONCILIATION_SOURCE_CONTEXT_DRIFT");
  if (!report.request || report.request.operations?.length !== report.request_summary?.operation_count || report.request.operations.length > 1000) fail("RECONCILIATION_REQUEST_SCOPE_INVALID");
}
function db(env = process.env) {
  dotenv.config({ path: path.join(ROOT, ".env.local"), quiet: true });
  const url = env.NEXT_PUBLIC_SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) fail("RECONCILIATION_CONTROL_CREDENTIAL_MISSING");
  return createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } });
}
async function run(options, dependencies = {}) {
  const parsed = Array.isArray(options) ? parseArgs(options) : options;
  const report = JSON.parse(fs.readFileSync(parsed.input, "utf8"));
  const env = dependencies.env || process.env;
  assertContext(report, env);
  const client = dependencies.client || db(env);
  const { data, error } = await client.rpc("publish_automation_review_queue_changes", { p_request: report.request });
  if (error) throw error;
  validateRpcResult(report.request, data);
  if (Number(data.catalogue_writes || 0) !== 0) fail("RECONCILIATION_CATALOGUE_WRITE_DETECTED");
  const output = { schema_version: 1, kind: "automation-review-queue-reconciliation-apply", result: "PASS", source_run_id: report.source.run_id, operation_count: report.request.operations.length, created_count: Number(data.created_count || 0), refreshed_count: Number(data.refreshed_count || 0), superseded_count: Number(data.superseded_count || 0), resolved_by_source_count: Number(data.resolved_by_source_count || 0), expired_count: Number(data.expired_count || 0), catalogue_writes: 0, database_writes: Number(data.database_writes || 0), already_applied: data.already_applied === true };
  fs.mkdirSync(path.dirname(parsed.output), { recursive: true });
  fs.writeFileSync(parsed.output, `${JSON.stringify(output, null, 2)}\n`);
  return output;
}

if (require.main === module) run(parseArgs(process.argv.slice(2))).then((result) => console.log(JSON.stringify(result))).catch((error) => { console.error(error.stack || error.message); process.exitCode = 1; });

module.exports = { assertContext, parseArgs, run };
