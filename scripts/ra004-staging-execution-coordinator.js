const fs = require("node:fs");
const path = require("node:path");
const crypto = require("node:crypto");
const { fork, spawnSync } = require("node:child_process");
const { Client } = require("pg");
const { sha256 } = require("./lib/stable-json-hash");
const selector = require("./supabase-migration-selector");
const contract = require("./lib/retailer-offer-sync/ra004-staging-preflight-v1/contract");
const { createClosedProvider } = require("./lib/retailer-offer-sync/ra004-staging-preflight-v1/provider");
const { runPreflight } = require("./lib/retailer-offer-sync/ra004-staging-preflight-v1/runner");
const { createPreflightPostgresTransport, createControlStatePostgresTransport } = require("./lib/retailer-offer-sync/ra004-bounded-live-transport-v1");
const { createLiveReadOnlyProvider } = require("./lib/retailer-offer-sync/control-state-export-v1/providers");
const { exportControlState, writeArtifact } = require("./lib/retailer-offer-sync/control-state-export-v1/exporter");
const controlAuth = require("./lib/retailer-offer-sync/control-state-export-v1/authorization");
const { SOURCE_NAMES, PROHIBITED_OPERATIONS } = require("./lib/retailer-offer-sync/control-state-export-v1/schema");
const { validateLocalCa } = require("./ra004-acl-rls-readonly-audit");

const ROOT = path.resolve(__dirname, "..");
const REF = "hxnrsyyqffztlvcrtgbf";
const API_HOST = "hxnrsyyqffztlvcrtgbf.supabase.co";
const BASELINE = "5403c35e8a6fb777a184f8b4ad43f61788c61c4c";
const CONSOLIDATED_SHA = "a240a263d7e88084171a73317db9e19f0e2c69c9b71ca84dbe788b624a22c9c4";
const ACL_MIGRATION_SHA = "58aa82b328b9bb77c09b9975892042027a493254add99fb2e1dcf045303c0b0d";
const PLAN_FP = "bd5c259941997daad3755c1cb135f76f6eccaef1fb9e1ce0044939ce08439214";
const BUCKET = "ra004-staging-preflight-evidence";
const EVIDENCE_NAMES = Object.freeze([
  "preflight-report.json", "preflight-revoke.json", "control-state-canary.json",
  "control-state-revoke.json", "policy-attestation.json", "closeout.json",
]);
const ownerUrl = process.env.RA004_OWNER_DATABASE_URL;
const EXPECTED_PRE_LEDGER_COUNT = 98;
const EXPECTED_PRE_LEDGER_FINGERPRINT = "b4e72276ba2570d2da9957c53b6c209a3799087570302af92b295467a1d4e307";
const EXPECTED_POST_LEDGER_COUNT = 98;
const EXPECTED_POST_LEDGER_FINGERPRINT = "b4e72276ba2570d2da9957c53b6c209a3799087570302af92b295467a1d4e307";
const ACTIVATION_MANIFEST = "RA-004-post-verifier-readonly-activation.json";
const EXPECTED_MIGRATIONS = Object.freeze([]);
const DEPENDENCY_CONTRACT = Object.freeze([
  ...[
    "public.approved_import_plans", "public.retailer_catalogue_apply_runs",
    "public.retailer_catalogue_child_plans", "public.retailer_catalogue_parent_plans",
    "public.retailer_offer_sync_batch_approvals",
    "public.retailer_offer_sync_reviewed_mixed_change_bindings", "public.retailers",
    "supabase_migrations.schema_migrations",
    "public.retailer_catalogue_production_fixture_approvals",
    "public.retailer_catalogue_production_recovery_manifests",
    "public.retailer_catalogue_production_recovery_approvals",
    "public.retailer_control_state_evidence_v1",
  ].map((identity) => ({ kind: "relation", identity })),
  ...[
    "pg_catalog.gen_random_uuid()", "pg_catalog.sha256(bytea)",
    "public.write_retailer_control_state_evidence_v1(uuid,integer,text,bigint,boolean,text,text,text,text,timestamp with time zone,timestamp with time zone,timestamp with time zone,text,text,jsonb,text,text)",
    "public.read_retailer_control_state_v1(bigint,text,text,text,timestamp with time zone,text[],integer,integer)",
    "public.read_ra004_staging_preflight_v1(text,text,text,integer,text,text,integer)",
  ].map((identity) => ({ kind: "function", identity })),
  { kind: "extension", identity: "pgcrypto" },
  ...[
    "anon", "authenticated", "service_role", "retailer_catalogue_production_approver",
    "retailer_catalogue_production_executor", "retailer_catalogue_production_validator",
  ].map((identity) => ({ kind: "role", identity })),
]);
const outDir = path.join(ROOT, "tmp", "ra004-live-evidence-20260928-post-verifier");
fs.mkdirSync(outDir, { recursive: true });

function invariant(ok, message) { if (!ok) throw new Error(message); }
function utc(date = new Date()) { return date.toISOString().replace(/\.\d{3}Z$/, "Z"); }
function safeFailureCode(error) {
  const code = String(error?.message || "");
  return /^RA004_[A-Z0-9_]+$/.test(code) ? code : "RA004_UNCLASSIFIED_FAILURE";
}
function buildFailureReport({ activation, executionCommit = null, primaryError, sessionState, operationAttempts = {}, ledgerReadback = null, cleanup, startsAt, expiresAt, closedAt = utc(), revoke, uploaded }) {
  return {
    schema_version: "ra004-staging-closeout-v2",
    status: "BLOCKED",
    activation_id: activation,
    baseline_sha: BASELINE,
    execution_commit: executionCommit,
    primary_failure: { code: safeFailureCode(primaryError) },
    cli_diagnostics: primaryError?.cliDiagnostics || null,
    session_creation: { state: sessionState.session_creation_state },
    cleanup: { status: cleanup.status, failures: [...cleanup.failures] },
    attempt_counters: { ...sessionState.attempt_counters, ...operationAttempts },
    ledger_readback: ledgerReadback,
    window: { started: startsAt !== null, starts_at: startsAt, expires_at: expiresAt, closed_at: closedAt },
    revoke_receipts: revoke.map((item) => ({
      credential_id: item.credential_id,
      access_revoked: item.access_revoked,
      revocation_verification: item.revocation_verification,
    })),
    uploaded_objects: [...uploaded],
    forbidden_operations: {
      production: 0, feed_capture: 0, shadow_run: 0, control_plan: 0,
      approval: 0, import: 0, apply: 0, offer_writes: 0, model_b: 0,
    },
  };
}
function hashFile(file) { return crypto.createHash("sha256").update(fs.readFileSync(file)).digest("hex"); }
function readExecutionCommit(spawn = spawnSync) {
  const run = (...args) => spawn("git", args, { cwd: ROOT, encoding: "utf8", windowsHide: true });
  const headResult = run("rev-parse", "HEAD");
  const mainResult = run("rev-parse", "origin/main");
  const statusResult = run("status", "--porcelain", "--untracked-files=no");
  const head = String(headResult.stdout || "").trim();
  const main = String(mainResult.stdout || "").trim();
  invariant(headResult.status === 0 && mainResult.status === 0 && /^[0-9a-f]{40}$/.test(head),
    "RA004_EXECUTION_COMMIT_UNAVAILABLE");
  invariant(head === main, "RA004_EXECUTION_COMMIT_NOT_MERGED_MAIN");
  invariant(statusResult.status === 0 && String(statusResult.stdout || "").trim() === "",
    "RA004_EXECUTION_WORKTREE_NOT_CLEAN");
  return head;
}
function jsonWrite(file, value) { const target=path.join(outDir,file); fs.writeFileSync(target, `${JSON.stringify(value,null,2)}\n`, { flag:"wx" }); return target; }
function verifiedTls() { const hostname=new URL(ownerUrl).hostname; return {rejectUnauthorized:true,servername:hostname,minVersion:"TLSv1.2"}; }
async function db(text, values=[]) { const client=new Client({connectionString:ownerUrl,ssl:verifiedTls(),application_name:"ra004-guarded-owner-v1"}); try { await client.connect(); return await client.query(text,values); } finally { await client.end(); } }
async function businessCounts() {
  return (await db(`select
    (select count(*)::text from public.products) products,
    (select count(*)::text from public.product_variants) product_variants,
    (select count(*)::text from public.retailer_products) retailer_products,
    (select count(*)::text from public.offers) offers,
    (select count(*)::text from public.price_history) price_history`)).rows[0];
}
async function verifyDependencyContract() {
  invariant(DEPENDENCY_CONTRACT.length === 24, "RA004_DEPENDENCY_CONTRACT_INTERNAL_MISMATCH");
  const kinds = DEPENDENCY_CONTRACT.map(({ kind }) => kind);
  const identities = DEPENDENCY_CONTRACT.map(({ identity }) => identity);
  const rows = (await db(`with expected as (
    select kind, identity from unnest($1::text[], $2::text[]) as dependency(kind, identity)
  ) select kind, identity, case
    when kind='relation' then to_regclass(identity) is not null
    when kind='function' then to_regprocedure(identity) is not null
    when kind='extension' then exists(select 1 from pg_extension where extname=identity)
    when kind='role' then exists(select 1 from pg_roles where rolname=identity)
    else false end present
  from expected order by kind, identity`, [kinds, identities])).rows;
  invariant(rows.length === 24 && rows.every(({ present }) => present === true),
    "RA004_DEPENDENCY_CONTRACT_DRIFT");
  return { count: 24, status: "PRESENT_MATCHING", fingerprint: sha256(rows) };
}
async function ownerTransaction(statements) { const client=new Client({connectionString:ownerUrl,ssl:verifiedTls(),application_name:"ra004-evidence-policy-owner-v1"}); try { await client.connect(); await client.query("begin"); for(const statement of statements) await client.query(statement); await client.query("commit"); } catch(error) { try { await client.query("rollback"); } catch {} throw error; } finally { await client.end(); } }
function credentialReader() {
  let seq=0; const pending=new Map();
  const child=fork(path.join(__dirname,"ra004-staging-credential-issuer.js"),[],{env:{RA004_OWNER_DATABASE_URL:ownerUrl,NODE_EXTRA_CA_CERTS:process.env.NODE_EXTRA_CA_CERTS},stdio:["ignore","ignore","ignore","ipc"]});
  child.on("message",m=>{const item=pending.get(m.request_id); if(!item)return; pending.delete(m.request_id); if(m.ok)item.resolve(m.result);else item.reject(new Error(m.error));});
  return { pid:child.pid, call(message){return new Promise((resolve,reject)=>{const request_id=++seq;pending.set(request_id,{resolve,reject});child.send({...message,request_id});});}, close(){child.disconnect();} };
}
function verifyRevokedCredential(databaseUrl, role) {
  return new Promise((resolve,reject)=>{
    const child=fork(path.join(__dirname,"ra004-staging-revocation-verifier.js"),[],{env:{RA004_REVOKED_DATABASE_URL:databaseUrl,RA004_OWNER_DATABASE_URL:ownerUrl,RA004_REVOKED_ROLE:role,NODE_EXTRA_CA_CERTS:process.env.NODE_EXTRA_CA_CERTS},stdio:["ignore","ignore","ignore","ipc"]});
    child.once("message",message=>{child.disconnect();if(message.ok)resolve(message.result);else reject(new Error(message.error));});
    child.once("error",reject);
  });
}
function evidenceCustodian(activation, expiresAt) {
  let seq=0; const pending=new Map();
  const storageEnvironment={
    RA004_STORAGE_ANON_KEY:process.env.RA004_STORAGE_ANON_KEY,
    RA004_STORAGE_RUNTIME_ANON_KEY:process.env.RA004_STORAGE_ANON_KEY,
    RA004_STORAGE_EMAIL:process.env.RA004_STORAGE_EMAIL,
    RA004_STORAGE_PASSWORD:process.env.RA004_STORAGE_PASSWORD,
    RA004_STORAGE_ACTIVATION_ID:activation,
    RA004_STORAGE_WINDOW_EXPIRES_AT:expiresAt,
    NODE_EXTRA_CA_CERTS:process.env.NODE_EXTRA_CA_CERTS,
  };
  const child=fork(path.join(__dirname,"ra004-staging-evidence-custodian.js"),[],{env:storageEnvironment,stdio:["ignore","ignore","ignore","ipc"]});
  child.on("message",m=>{const item=pending.get(m.request_id);if(!item)return;pending.delete(m.request_id);if(m.ok)item.resolve(m.result);else {const error=new Error(m.error);error.details=m.details;item.reject(error);}});
  process.env.RA004_STORAGE_ANON_KEY=""; process.env.RA004_STORAGE_EMAIL=""; process.env.RA004_STORAGE_PASSWORD="";
  return {call(message){return new Promise((resolve,reject)=>{const request_id=++seq;pending.set(request_id,{resolve,reject});child.send({...message,request_id});});},close(){child.disconnect();}};
}
async function configureEvidenceStore(subject, activation) {
  invariant(/^[0-9a-f-]{36}$/i.test(subject) && /^ra004-staging-\d{13}$/.test(activation),"RA004_STORAGE_POLICY_INPUT_INVALID");
  const broad=(await db(`select polname from pg_policy where polrelid='storage.objects'::regclass and (0=any(polroles) or 'anon'::regrole::oid=any(polroles) or 'authenticated'::regrole::oid=any(polroles))`)).rows;
  invariant(broad.length===0,"RA004_STORAGE_EXISTING_BROAD_POLICY");
  const suffix=activation.slice(-13); const insertPolicy=`ra004_ev_insert_${suffix}`, selectPolicy=`ra004_ev_select_${suffix}`;
  const names=EVIDENCE_NAMES.map(name=>`'${activation}/${name}'`).join(",");
  const scope=`bucket_id='${BUCKET}' and auth.uid()='${subject}'::uuid and name=any(array[${names}]::text[])`;
  await ownerTransaction([
    `insert into storage.buckets(id,name,public,file_size_limit,allowed_mime_types) values('${BUCKET}','${BUCKET}',false,2097152,array['application/json','text/plain']) on conflict(id) do nothing`,
    `create policy ${insertPolicy} on storage.objects for insert to authenticated with check (${scope})`,
    `create policy ${selectPolicy} on storage.objects for select to authenticated using (${scope})`,
  ]);
  return {insertPolicy,selectPolicy};
}
async function attestEvidenceStore(policies) {
  const bucket=(await db("select id,name,public,file_size_limit,allowed_mime_types from storage.buckets where id=$1",[BUCKET])).rows;
  const policyRows=(await db("select polname,polcmd,pg_get_expr(polqual,polrelid) policy_using,pg_get_expr(polwithcheck,polrelid) policy_check from pg_policy where polrelid='storage.objects'::regclass and polname=any($1::text[]) order by polname",[[policies.insertPolicy,policies.selectPolicy]])).rows;
  invariant(bucket.length===1 && bucket[0].public===false && Number(bucket[0].file_size_limit)===2097152 && JSON.stringify(bucket[0].allowed_mime_types)===JSON.stringify(["application/json","text/plain"]),"RA004_BUCKET_POLICY_MISMATCH");
  invariant(policyRows.length===2 && policyRows.some(row=>row.polname===policies.insertPolicy&&row.polcmd==="a") && policyRows.some(row=>row.polname===policies.selectPolicy&&row.polcmd==="r"),"RA004_STORAGE_POLICY_MISMATCH");
  return {bucket_id:BUCKET,private:true,file_size_limit:2097152,allowed_mime_types:["application/json","text/plain"],insert_policy:policies.insertPolicy,select_policy:policies.selectPolicy,update_policy:false,delete_policy:false,whole_bucket_listing:false};
}
async function removeEvidencePolicies(policies) {
  if(!policies)return {policies_revoked:true};
  await ownerTransaction([`drop policy if exists ${policies.insertPolicy} on storage.objects`,`drop policy if exists ${policies.selectPolicy} on storage.objects`]);
  const remaining=(await db("select count(*)::integer count from pg_policy where polrelid='storage.objects'::regclass and polname=any($1::text[])",[[policies.insertPolicy,policies.selectPolicy]])).rows[0];
  invariant(remaining.count===0,"RA004_STORAGE_POLICY_REVOKE_UNVERIFIED");
  return {policies_revoked:true};
}
function validateReadOnlyActivation(value) {
  invariant(value?.schema_version === "ra-004-post-verifier-activation-v1", "RA004_ACTIVATION_SCHEMA_MISMATCH");
  invariant(value.status === "OWNER_AUTHORIZED_PREPARED_NOT_EXECUTED" && value.baseline_sha === BASELINE, "RA004_ACTIVATION_NOT_AUTHORIZED");
  invariant(value.target?.environment === "STAGING" && value.target?.project_ref === REF
    && value.target?.retailer?.id === "11" && value.target?.retailer?.slug === "10-reps", "RA004_ACTIVATION_TARGET_MISMATCH");
  invariant(value.production?.authorized === false && value.production?.selector_unchanged === true, "RA004_PRODUCTION_SELECTOR_NOT_CLOSED");
  invariant(value.pre_activation_ledger?.count === EXPECTED_PRE_LEDGER_COUNT
    && value.pre_activation_ledger?.fingerprint === EXPECTED_PRE_LEDGER_FINGERPRINT
    && value.pre_activation_ledger?.last_version === "20260928100000", "RA004_ACTIVATION_LEDGER_MISMATCH");
  invariant(Array.isArray(value.migrations) && value.migrations.length === EXPECTED_MIGRATIONS.length
    && EXPECTED_MIGRATIONS.every(([filename, sha256], index) => value.migrations[index]?.filename === filename
      && value.migrations[index]?.sha256 === sha256), "RA004_ACTIVATION_MIGRATION_MISMATCH");
  invariant(value.apply?.maximum_attempts === 0 && value.apply?.selected_pending_count === 0
    && value.apply?.automatic_retry === false
    && value.apply?.manual_retry === false && value.apply?.include_all === false
    && value.preflight?.maximum_attempts === 1 && value.canary?.maximum_attempts === 1
    && value.canary?.requires_preflight_pass === true, "RA004_ACTIVATION_ATTEMPTS_MISMATCH");
  invariant(value.evidence_store?.session_required_before_preflight === true
    && value.evidence_store?.authentication_attempts === 1, "RA004_EVIDENCE_STORE_GATE_MISMATCH");
  invariant(value.execution?.started === false && value.execution?.migration_attempt_count === 0
    && value.execution?.preflight_attempt_count === 0 && value.execution?.canary_attempt_count === 0
    && value.execution?.retry_authorized === false, "RA004_ACTIVATION_EXECUTION_STATE_MISMATCH");
  return value;
}
function ensureWindow(expires) {
  invariant(Date.now() < expires.getTime(), "RA004_WINDOW_EXPIRED");
}
async function main() {
  invariant(ownerUrl && process.env.RA004_STORAGE_ANON_KEY
    && process.env.RA004_STORAGE_EMAIL && process.env.RA004_STORAGE_PASSWORD,
  "RA004_AUTHENTICATION_MISSING");
  const parsed=new URL(ownerUrl);
  invariant(!`${parsed.hostname}|${parsed.username}`.match(/aftboxmrdgyhizicfsfu|prod/i),"RA004_PRODUCTION_TARGET_REJECTED");
  validateLocalCa(process.env.NODE_EXTRA_CA_CERTS);
  const executionCommit=readExecutionCommit();
  const remote=await selector.readRemoteState(ownerUrl);
  invariant(remote.remoteLedger.length===EXPECTED_PRE_LEDGER_COUNT
    && selector.ledgerRowsFingerprint(remote.remoteLedger, {targetEnvironment:"STAGING"})===EXPECTED_PRE_LEDGER_FINGERPRINT,
  "RA004_PRE_LEDGER_MISMATCH");
  validateReadOnlyActivation(JSON.parse(fs.readFileSync(path.join(ROOT,"docs/retailer-automation/evidence",ACTIVATION_MANIFEST),"utf8")));
  const appliedIdentifiers=new Set(remote.remoteLedger.map(row=>`${row.version}_${row.name}.sql`));
  invariant(EXPECTED_MIGRATIONS.length===0
    && appliedIdentifiers.has("20260928100000_diagnose_ra004_preflight_acl_rls.sql")
    && hashFile(path.join(ROOT,"supabase","migrations","20260928100000_diagnose_ra004_preflight_acl_rls.sql"))===ACL_MIGRATION_SHA,
  "RA004_APPLIED_MIGRATION_STATE_MISMATCH");
  const retailer=(await db("select id::text,name,slug from public.retailers where lower(name)='10 reps' or lower(slug)='10-reps'")).rows;
  invariant(retailer.length===1 && retailer[0].name==="10 Reps" && retailer[0].slug==="10-reps" && retailer[0].id==="11","RA004_RETAILER_AMBIGUOUS");
  const preObjects=(await db("select to_regprocedure('public.read_retailer_control_state_v1(bigint,text,text,text,timestamptz,text[],integer,integer)') control_rpc,to_regprocedure('public.read_ra004_staging_preflight_v1(text,text,text,integer,text,text,integer)') preflight_rpc")).rows[0];
  invariant(preObjects.control_rpc!==null && preObjects.preflight_rpc!==null,"RA004_REQUIRED_INTERFACE_MISSING");
  const preexistingStoragePolicies=(await db(`select polname from pg_policy where polrelid='storage.objects'::regclass and (0=any(polroles) or 'anon'::regrole::oid=any(polroles) or 'authenticated'::regrole::oid=any(polroles))`)).rows;
  invariant(preexistingStoragePolicies.length===0,"RA004_STORAGE_EXISTING_BROAD_POLICY");
  const businessBefore=await businessCounts();

  const activation=`ra004-staging-${Date.now()}`;
  const expires=new Date(Date.now()+30*60*1000);
  const expiresAt=utc(expires);
  let startsAt=null;
  let custody,policies,issuer,preflightCred,canaryCred;
  let primaryError=null;
  let sessionState={session_creation_state:"NOT_CREATED",cleanup_status:"NOT_REQUIRED",attempt_counters:{auth:0,upload:0,readback:0,cleanup:0}};
  const operationAttempts={migration:0,preflight:0,canary:0};
  let failureLedgerReadback=null;
  const cleanup={status:"NOT_REQUIRED",failures:[]};
  const revoke=[]; const uploaded=[];
  const revokeOne=async(credential,runnerProcessId)=>{
    const databaseUrl=credential.database_url;
    const receipt=await issuer.call({action:"revoke",role:credential.role,runner_process_id:runnerProcessId});
    const verification=await verifyRevokedCredential(databaseUrl,credential.role);
    revoke.push({...receipt,issued_at:credential.issued_at,expires_at:credential.expires_at,revoked_at:utc(),revocation_verification:verification});
    return receipt;
  };
  try {
    custody=evidenceCustodian(activation,expiresAt);
    let storageSession;
    try {
      storageSession=await custody.call({action:"init"});
      sessionState={session_creation_state:storageSession.session_creation_state,cleanup_status:storageSession.cleanup_status,attempt_counters:{...storageSession.attempt_counters}};
    } catch(error) {
      if(error.details)sessionState=error.details;
      throw error;
    }
    policies=await configureEvidenceStore(storageSession.subject,activation);
    const policyAttestation=await attestEvidenceStore(policies);
    startsAt=utc();
    ensureWindow(expires);
    const migrationReceipts=[{file:"20260928100000_diagnose_ra004_preflight_acl_rls.sql",sha256:ACL_MIGRATION_SHA,status:"ALREADY_PRESENT_VERIFIED",database_writes:0}];
    const postRemote=await selector.readRemoteState(ownerUrl);
    invariant(postRemote.remoteLedger.length===EXPECTED_POST_LEDGER_COUNT
      && postRemote.remoteLedger.slice(0,remote.remoteLedger.length).every((row,index)=>JSON.stringify(row)===JSON.stringify(remote.remoteLedger[index]))
      && postRemote.remoteLedger.at(-1)?.version==="20260928100000"
      && postRemote.remoteLedger.at(-1)?.name==="diagnose_ra004_preflight_acl_rls"
      && selector.ledgerRowsFingerprint(postRemote.remoteLedger, {targetEnvironment:"STAGING"})===EXPECTED_POST_LEDGER_FINGERPRINT,
    "RA004_LEDGER_CHANGED_BEFORE_PREFLIGHT");
    const dependencyContract=await verifyDependencyContract();
    const businessAfterMigrations=await businessCounts();
    invariant(JSON.stringify(businessAfterMigrations)===JSON.stringify(businessBefore),"RA004_BUSINESS_DATA_CHANGED_BEFORE_PREFLIGHT");
    ensureWindow(expires);
    const ledgerFp=selector.ledgerRowsFingerprint(postRemote.remoteLedger, {
      contractVersion: selector.RA004_LEDGER_FINGERPRINT_VERSION,
      targetEnvironment: "STAGING",
    });
    issuer=credentialReader();
    const store={schema_version:"ra-004-evidence-store-metadata-v1",store_identifier:BUCKET,private:true,encryption:"AT_REST_AND_IN_TRANSIT",write_once:true,access_audit:true,readback_supported:true,raw_retention_days:90,derived_retention_days:90,approved_by:"Marek-Kalinka",approved_at:startsAt,evidence_store_fingerprint:"0".repeat(64)};
    store.evidence_store_fingerprint=sha256(store);
    const identity={schema_version:"ra-004-project-identity-v1",project_reference:REF,canonical_host:API_HOST,environment_label:"STAGING",project_identity_fingerprint:"0".repeat(64),observed_at:startsAt};
    identity.project_identity_fingerprint=sha256(identity);
    uploaded.push(await custody.call({action:"put",name:"policy-attestation.json",value:{...policyAttestation,activation_id:activation,execution_commit:executionCommit,storage_subject_fingerprint:sha256(storageSession.subject),retention:{redacted_bundle_days:90,fingerprint_receipt_years:7}}}));

    preflightCred=await issuer.call({action:"create",kind:"preflight",expires_at:expiresAt});
    const auth={schema_version:"ra-004-staging-preflight-authorization-execution-v1",status:"AUTHORIZED",task_id:"RA-004",baseline_sha:BASELINE,decision_fingerprint:contract.CURRENT_DECISION_FINGERPRINT,plan_fingerprint:PLAN_FP,control_migration:{path:contract.CONTROL_MIGRATION,sha256:CONSOLIDATED_SHA},preflight_migration:{path:contract.PREFLIGHT_MIGRATION,sha256:CONSOLIDATED_SHA},target:{environment:"STAGING",project_reference:REF,canonical_host:API_HOST,host_allowlist:[API_HOST],retailer:{name:"10 Reps",slug:"10-reps"},ledger:{contract_version:selector.RA004_LEDGER_FINGERPRINT_VERSION,count:postRemote.remoteLedger.length,fingerprint:ledgerFp}},operator:"Marek-Kalinka",credential_issuer:"ra004-technical-issuer",window:{starts_at:startsAt,expires_at:expiresAt},credential_design:{role_name:preflightCred.role,environment:"STAGING_ONLY",rpc_name:contract.RPC_NAME,maximum_attempts:1,maximum_ttl_minutes:30,automatic_retry:false,service_role:false,table_privileges:false,sequence_privileges:false,dml:false,ddl:false,mutation_rpc:false},evidence_store:{store_identifier:BUCKET,required_private:true,required_encryption:true,required_write_once:true,required_access_audit:true,required_readback:true,raw_retention_days:90,derived_retention_days:90},authorization_fingerprint:"0".repeat(64)}; auth.authorization_fingerprint=contract.authorizationFingerprint(auth);
    const transport=createPreflightPostgresTransport({databaseUrl:preflightCred.database_url,projectReference:REF,canonicalHost:API_HOST,expectedSessionUser:preflightCred.role,credentialId:preflightCred.credential_id,projectIdentity:identity,evidenceStoreMetadata:store,revokeCredential:async request=>{const receipt=await revokeOne(preflightCred,request.runner_process_id);preflightCred=null;return receipt;}});
    operationAttempts.preflight+=1;
    const result=await runPreflight({authorization:auth,expected:{provider_mode:"live-read-only",baseline_sha:BASELINE,decision_fingerprint:contract.CURRENT_DECISION_FINGERPRINT,plan_fingerprint:PLAN_FP,control_migration:{path:contract.CONTROL_MIGRATION,sha256:CONSOLIDATED_SHA},preflight_migration:{path:contract.PREFLIGHT_MIGRATION,sha256:CONSOLIDATED_SHA},project_reference:REF,canonical_host:API_HOST,host_allowlist:[API_HOST]},providerBundle:createClosedProvider({configuration:{environment:"STAGING",project_reference:REF,canonical_host:API_HOST,host_allowlist:[API_HOST],expected_session_user:preflightCred.role},transport}),outputPath:path.join(outDir,"preflight-report.json"),now:utc()});
    ensureWindow(expires);
    uploaded.push(await custody.call({action:"put",name:"preflight-report.json",value:result.report}));
    uploaded.push(await custody.call({action:"put",name:"preflight-revoke.json",value:result.receipt}));
    ensureWindow(expires);
    canaryCred=await issuer.call({action:"create",kind:"control",expires_at:expiresAt});
    const cAuth={version:"control-state-export-authorization-v1",status:"AUTHORIZED",retailer_id:String(retailer[0].id),retailer_name:"10 Reps",allowed_scope:[...SOURCE_NAMES],baseline_sha:BASELINE,task_id:"RA-004",valid_from:startsAt,expires_at:expiresAt,operation:"READ_ONLY_CONTROL_STATE_EXPORT",prohibited_operations:[...PROHIBITED_OPERATIONS],owner_consent:"OWNER_APPROVED",authorization_fingerprint:"0".repeat(64)}; cAuth.authorization_fingerprint=controlAuth.authorizationFingerprint(cAuth);
    const cProvider=createLiveReadOnlyProvider({authorization:cAuth,providerConfiguration:{provider_id:"transactional-rpc-v1",credential_type:"DEDICATED_CONTROL_STATE_EXPORTER",rpc_name:"public.read_retailer_control_state_v1",expected_session_user:canaryCred.role},transport:createControlStatePostgresTransport({databaseUrl:canaryCred.database_url,projectReference:REF,expectedSessionUser:canaryCred.role})});
    operationAttempts.canary+=1;
    const cReport=await exportControlState({provider:cProvider,authorization:cAuth,retailer_id:String(retailer[0].id),retailer_name:"10 Reps",baseline_sha:BASELINE,provider_mode:"live-read-only",now:utc()});
    writeArtifact(path.join(outDir,"control-state-canary.json"),cReport);
    uploaded.push(await custody.call({action:"put",name:"control-state-canary.json",value:cReport}));
    const canaryReceipt=await revokeOne(canaryCred,process.pid); canaryCred=null;
    uploaded.push(await custody.call({action:"put",name:"control-state-revoke.json",value:{...canaryReceipt,revocation_verification:revoke.at(-1).revocation_verification}}));
    ensureWindow(expires);
    const businessAfterCanary=await businessCounts();
    invariant(JSON.stringify(businessAfterCanary)===JSON.stringify(businessBefore),"RA004_BUSINESS_DATA_CHANGED_DURING_READ_ONLY_EXECUTION");
    const canaryClear=cReport.final_assessment==="CLEAR_FOR_SEPARATE_SHADOW_AUTHORIZATION";
    const closeout={schema_version:"ra004-staging-closeout-v1",status:canaryClear?"VERIFIED_COMPLETE":"BLOCKED_CONTROL_STATE",activation_id:activation,baseline_sha:BASELINE,execution_commit:executionCommit,window:{starts_at:startsAt,expires_at:expiresAt,closed_at:utc()},project_identity:identity,retailer:{id:String(retailer[0].id),name:retailer[0].name,slug:retailer[0].slug},evidence_store:{...store,...policyAttestation},migration_receipts:migrationReceipts,ledger:{before_count:remote.remoteLedger.length,after_count:postRemote.remoteLedger.length,after_fingerprint:ledgerFp},dependency_contract:dependencyContract,attempt_counters:{...sessionState.attempt_counters,...operationAttempts},business_counts:{before:businessBefore,after_migrations:businessAfterMigrations,after_canary:businessAfterCanary,unchanged:true},preflight:{status:"VERIFIED_COMPLETE",report_fingerprint:result.report.report_fingerprint,capability_counters:result.receipt.capability_counters},canary:{status:canaryClear?"VERIFIED_COMPLETE":"BLOCKED",final_assessment:cReport.final_assessment,export_fingerprint:cReport.export_fingerprint,read_attempt_count:cReport.read_attempt_count,write_attempt_count:cReport.write_attempt_count,mutation_attempt_count:cReport.mutation_attempt_count},revoke_receipts:revoke.map(x=>({...x,issuer_process_id_present:true,runner_process_id_present:true,issuer_process_id:undefined,runner_process_id:undefined})),uploaded_objects:uploaded,forbidden_operations:{production:0,feed_capture:0,shadow_run:0,control_plan:0,approval:0,import:0,apply:0,offer_writes:0,model_b:0}};
    jsonWrite("closeout.json",closeout);
    await custody.call({action:"put",name:"closeout.json",value:closeout});
    process.stdout.write(`${JSON.stringify({status:closeout.status,activation_id:activation,window:closeout.window,retailer_id:closeout.retailer.id,final_assessment:cReport.final_assessment,closeout:path.join(outDir,"closeout.json")})}\n`);
    invariant(canaryClear,"RA004_CANARY_CONTROL_STATE_BLOCKED");
  } catch(error) {
    primaryError=error;
    if(error.details)sessionState=error.details;
    if(error.cliDiagnostics && custody && sessionState.session_creation_state!=="NOT_CREATED") {
      for (const stream of ["stdout","stderr"]) {
        const item=error.cliDiagnostics[stream];
        try {
          const content=fs.readFileSync(path.join(outDir,item.filename),"utf8");
          uploaded.push(await custody.call({action:"put",name:item.filename,value:{stream,content,sha256:item.sha256,redacted:true}}));
        } catch {
          cleanup.failures.push(`cli-${stream}-evidence`);
        }
      }
    }
  } finally {
    if(preflightCred&&issuer) { try{await revokeOne(preflightCred,process.pid);}catch{cleanup.failures.push("preflight");} }
    if(canaryCred&&issuer) { try{await revokeOne(canaryCred,process.pid);}catch{cleanup.failures.push("canary");} }
    if(issuer)issuer.close();
    try{await removeEvidencePolicies(policies);}catch{cleanup.failures.push("storage-policies");}
    if(custody) {
      if(sessionState.session_creation_state!=="NOT_CREATED") {
        try {
          const receipt=await custody.call({action:"close"});
          cleanup.status=receipt.cleanup_status;
          sessionState=await custody.call({action:"status"});
        } catch(error) {
          cleanup.status="FAILED";
          cleanup.failures.push("storage-session");
          if(error.details)sessionState=error.details;
        }
      }
      custody.close();
    }
    if(cleanup.failures.length>0 && !primaryError)primaryError=new Error("RA004_CLEANUP_UNVERIFIED");
    if(primaryError) {
      try {
        const readback=await selector.readRemoteState(ownerUrl);
        const last=readback.remoteLedger.at(-1) || null;
        failureLedgerReadback={
          count:readback.remoteLedger.length,
          fingerprint:selector.ledgerRowsFingerprint(readback.remoteLedger, {targetEnvironment:"STAGING"}),
          last_migration:last ? `${last.version}_${last.name}` : null,
        };
      } catch {
        cleanup.failures.push("failure-ledger-readback");
      }
    }
    if(primaryError) {
      const failure=buildFailureReport({activation,executionCommit,primaryError,sessionState,operationAttempts,ledgerReadback:failureLedgerReadback,cleanup,startsAt,expiresAt,revoke,uploaded});
      try{jsonWrite("failure-closeout.json",failure);}catch{}
    }
    process.env.RA004_OWNER_DATABASE_URL="";
  }
  if(primaryError)throw primaryError;
}
if (require.main === module) {
  main().catch(error=>{process.stderr.write(`${String(error.message).replace(/postgres(?:ql)?:\/\/[^\s]+/gi,"[REDACTED]").slice(0,500)}\n`);process.exitCode=1;});
}

module.exports = {
  ACL_MIGRATION_SHA, API_HOST, BASELINE, BUCKET, CONSOLIDATED_SHA, DEPENDENCY_CONTRACT,
  EXPECTED_MIGRATIONS, EXPECTED_POST_LEDGER_COUNT,
  EXPECTED_POST_LEDGER_FINGERPRINT, EXPECTED_PRE_LEDGER_COUNT, EXPECTED_PRE_LEDGER_FINGERPRINT, PLAN_FP, REF,
  buildFailureReport, readExecutionCommit, safeFailureCode, validateReadOnlyActivation,
};
