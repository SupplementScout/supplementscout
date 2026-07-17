const fs = require("node:fs");
const { spawnSync } = require("node:child_process");
const { validateParentPlan } = require("./lib/retailer-snapshot/validators");

const BLOCKED_REFS = Object.freeze(["aftboxmrdgyhizicfsfu", "hxnrsyyqffztlvcrtgbf"]);
const LOCAL_HOSTS = new Set(["localhost", "127.0.0.1", "[::1]", "::1"]);
const COMMANDS = new Set(["create", "approve-parent", "generate-children", "approve-child", "begin-child", "complete-child", "fail-child", "resume", "status", "request-rollback", "complete-rollback"]);

function parseArgs(argv) {
  const options = { command: argv[0] };
  for (const arg of argv.slice(1)) {
    if (arg === "--allow-local-ledger") options.allowLocalLedger = true;
    else { const match = arg.match(/^--([^=]+)=(.*)$/); if (!match) throw new Error(`Unknown argument: ${arg}`); options[match[1]] = match[2]; }
  }
  return options;
}
function required(options, name) { const value = options[name]; if (!value) throw new Error(`Required --${name}`); return value; }
function guardEnvironment(options, env = process.env) {
  if (!COMMANDS.has(options.command)) throw new Error("A supported Phase 2 command is required");
  if (!options.allowLocalLedger) throw new Error("Phase 2 requires --allow-local-ledger");
  if (String(options.target || "").toLowerCase() !== "local-postgres") throw new Error("Phase 2 target must be local-postgres");
  if (/^(1|true|yes|on)$/i.test(String(env.SAFE_UPDATE || ""))) throw new Error("SAFE_UPDATE must remain disabled");
  const raw = required(options, "database-url");
  if (BLOCKED_REFS.some((ref) => raw.includes(ref)) || /supabase\.co/i.test(raw)) throw new Error("Supabase staging/production targets are forbidden");
  let url; try { url = new URL(raw); } catch { throw new Error("A valid PostgreSQL database URL is required"); }
  if (!/^postgres(?:ql)?:$/.test(url.protocol) || !LOCAL_HOSTS.has(url.hostname)) throw new Error("Only a local PostgreSQL hostname is allowed");
  if (options["docker-container"] && !/^[A-Za-z0-9][A-Za-z0-9_.-]{0,127}$/.test(options["docker-container"])) throw new Error("Invalid disposable Docker container name");
  return { url, target: "LOCAL_POSTGRES" };
}
function sqlLiteral(value) { return `'${String(value ?? "").replaceAll("'", "''")}'`; }
function jsonLiteral(value) { return `${sqlLiteral(JSON.stringify(value))}::jsonb`; }
function readJson(file) { return JSON.parse(fs.readFileSync(file, "utf8")); }
function addMinutes(minutes) { return new Date(Date.now() + minutes * 60_000).toISOString(); }

class LocalLedgerClient {
  constructor(options, env = process.env) { this.options = options; this.environment = guardEnvironment(options, env); }
  query(sql) {
    const url = this.environment.url; const common = ["psql", "-X", "--no-psqlrc", "-v", "ON_ERROR_STOP=1", "-U", decodeURIComponent(url.username || "postgres"), "-d", url.pathname.slice(1), "-tA", "-f", "-"];
    let command; let args;
    if (this.options["docker-container"]) { command = "docker"; args = ["exec", "-i", this.options["docker-container"], ...common]; }
    else { command = common.shift(); args = ["-h", url.hostname, "-p", url.port || "5432", ...common.slice(1)]; }
    const result = spawnSync(command, args, { encoding: "utf8", input: `${sql}\n`, env: { ...process.env, PGPASSWORD: process.env.PGPASSWORD || decodeURIComponent(url.password || "") }, timeout: 120_000 });
    if (result.error || result.status !== 0) { const message = `${result.stderr || result.stdout || result.error?.message || "psql failed"}`.trim(); const match = message.match(/\{"code"[^\r\n]+\}/); const error = new Error(match ? match[0] : message); error.code = match ? JSON.parse(match[0]).code : "RSBI_LOCAL_LEDGER_ERROR"; throw error; }
    const output = result.stdout.trim(); return output ? JSON.parse(output.split(/\r?\n/).at(-1)) : null;
  }
  create(parent, children, actor, retailerId = "0") {
    validateParentPlan(parent, children);
    const envelope = { parent_plan: parent, child_plans: children, control: { target_environment: "LOCAL_POSTGRES", retailer_id: String(retailerId), source_captured_at: new Date().toISOString(), canonical_snapshot_at: new Date().toISOString(), expected_state_fingerprint: parent.canonical_snapshot_fingerprint } };
    return this.query(`select public.create_retailer_catalogue_parent_plan(${jsonLiteral(envelope)},${sqlLiteral(parent.parent_plan_fingerprint)},${sqlLiteral(parent.source_sha256)},${sqlLiteral(actor)})::text;`);
  }
  approveParent(parentId, fingerprint, actor, expiresAt = addMinutes(119)) { return this.query(`select public.approve_retailer_catalogue_parent_plan(${sqlLiteral(parentId)}::uuid,${sqlLiteral(fingerprint)},${sqlLiteral(actor)},${sqlLiteral(expiresAt)}::timestamptz)::text;`); }
  generateChildren(parentId, fingerprint) { return this.query(`select public.generate_retailer_catalogue_child_plans(${sqlLiteral(parentId)}::uuid,${sqlLiteral(fingerprint)})::text;`); }
  approveChild(childId, parentApprovalId, parentFingerprint, childFingerprint, expiresAt = addMinutes(29)) { return this.query(`select public.approve_retailer_catalogue_child_plan(${sqlLiteral(childId)}::uuid,${sqlLiteral(parentApprovalId)}::uuid,${sqlLiteral(parentFingerprint)},${sqlLiteral(childFingerprint)},${sqlLiteral(expiresAt)}::timestamptz)::text;`); }
  beginChild(child, parentFingerprint, actor) { return this.query(`select public.begin_retailer_catalogue_child_apply(${sqlLiteral(child.child_plan_id)}::uuid,${sqlLiteral(parentFingerprint)},${sqlLiteral(child.child_plan_fingerprint)},${sqlLiteral(child.source_snapshot_fingerprint)},${sqlLiteral(child.canonical_snapshot_fingerprint)},${sqlLiteral(child.adapter_fingerprint)},${sqlLiteral(child.policy_fingerprint)},${sqlLiteral(child.code_commit)},${sqlLiteral(child.expected_state_fingerprint)},${sqlLiteral(actor)})::text;`); }
  completeChild(runId, parentFingerprint, childFingerprint, actor) { return this.query(`select public.complete_retailer_catalogue_child_apply(${sqlLiteral(runId)}::uuid,${sqlLiteral(parentFingerprint)},${sqlLiteral(childFingerprint)},'{}'::jsonb,'{"business_writes":0}'::jsonb,${sqlLiteral(actor)})::text;`); }
  failChild(runId, parentFingerprint, childFingerprint, errorCode, actor) { return this.query(`select public.fail_retailer_catalogue_child_apply(${sqlLiteral(runId)}::uuid,${sqlLiteral(parentFingerprint)},${sqlLiteral(childFingerprint)},${sqlLiteral(errorCode)},'{"business_writes":0}'::jsonb,${sqlLiteral(actor)})::text;`); }
  resume(parentId, fingerprint, decision, actor) { return this.query(`select public.resume_retailer_catalogue_parent_plan(${sqlLiteral(parentId)}::uuid,${sqlLiteral(fingerprint)},${sqlLiteral(decision)},${sqlLiteral(actor)})::text;`); }
  status(parentId) { return this.query(`select public.get_retailer_catalogue_plan_status(${sqlLiteral(parentId)}::uuid)::text;`); }
  requestRollback(childId, parentFingerprint, childFingerprint, rollbackFingerprint, actor) { return this.query(`select public.request_retailer_catalogue_child_rollback(${sqlLiteral(childId)}::uuid,${sqlLiteral(parentFingerprint)},${sqlLiteral(childFingerprint)},${sqlLiteral(rollbackFingerprint)},${sqlLiteral(actor)})::text;`); }
  completeRollback(runId, parentFingerprint, childFingerprint, actor) { return this.query(`select public.complete_retailer_catalogue_child_rollback(${sqlLiteral(runId)}::uuid,${sqlLiteral(parentFingerprint)},${sqlLiteral(childFingerprint)},'{"business_writes":0}'::jsonb,${sqlLiteral(actor)})::text;`); }
}

function main(argv = process.argv.slice(2), env = process.env) {
  const options = parseArgs(argv); const client = new LocalLedgerClient(options, env); const actor = options.actor || "phase2-local-ledger"; let result;
  if (options.command === "create") result = client.create(readJson(required(options, "parent-plan")), readJson(required(options, "child-plans")), actor, options["retailer-id"] || "0");
  else if (options.command === "approve-parent") result = client.approveParent(required(options,"parent-id"),required(options,"parent-fingerprint"),actor,options["expires-at"]);
  else if (options.command === "generate-children") result = client.generateChildren(required(options,"parent-id"),required(options,"parent-fingerprint"));
  else if (options.command === "approve-child") result = client.approveChild(required(options,"child-id"),required(options,"parent-approval-id"),required(options,"parent-fingerprint"),required(options,"child-fingerprint"),options["expires-at"]);
  else if (options.command === "begin-child") result = client.beginChild(readJson(required(options,"child-control")),required(options,"parent-fingerprint"),actor);
  else if (options.command === "complete-child") result = client.completeChild(required(options,"run-id"),required(options,"parent-fingerprint"),required(options,"child-fingerprint"),actor);
  else if (options.command === "fail-child") result = client.failChild(required(options,"run-id"),required(options,"parent-fingerprint"),required(options,"child-fingerprint"),required(options,"error-code"),actor);
  else if (options.command === "resume") result = client.resume(required(options,"parent-id"),required(options,"parent-fingerprint"),options.decision||"PREVIEW",actor);
  else if (options.command === "status") result = client.status(required(options,"parent-id"));
  else if (options.command === "request-rollback") result = client.requestRollback(required(options,"child-id"),required(options,"parent-fingerprint"),required(options,"child-fingerprint"),required(options,"rollback-fingerprint"),actor);
  else if (options.command === "complete-rollback") result = client.completeRollback(required(options,"run-id"),required(options,"parent-fingerprint"),required(options,"child-fingerprint"),actor);
  console.log(JSON.stringify(result, null, 2)); return result;
}
if (require.main === module) { try { main(); } catch (error) { console.error(error.message); process.exitCode = 1; } }
module.exports = { BLOCKED_REFS, COMMANDS, LOCAL_HOSTS, LocalLedgerClient, guardEnvironment, main, parseArgs, sqlLiteral };
