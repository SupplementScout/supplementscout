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

const ROOT = path.resolve(__dirname, "..");
const REF = "hxnrsyyqffztlvcrtgbf";
const API_HOST = "hxnrsyyqffztlvcrtgbf.supabase.co";
const BASELINE = "247672dcb1d1b4654cc6a091ff10d7dbad42a902";
const CONTROL_SHA = "cfd7a93cb20845832b696183f5eb8a500f0474b4173829b85f6ac6bc73d4baaa";
const PREFLIGHT_SHA = "9d6c1ea4df0bd86f84a4cb779a0824922f4e9bcc91681b734d5d18465a9e91be";
const PLAN_FP = "bd5c259941997daad3755c1cb135f76f6eccaef1fb9e1ce0044939ce08439214";
const BUCKET = "ra004-staging-preflight-evidence";
const EVIDENCE_NAMES = Object.freeze([
  "preflight-report.json", "preflight-revoke.json", "control-state-canary.json",
  "control-state-revoke.json", "policy-attestation.json", "closeout.json",
]);
const ownerUrl = process.env.RA004_OWNER_DATABASE_URL;
const pat = process.env.RA004_SUPABASE_ACCESS_TOKEN;
const outDir = path.join(ROOT, "tmp", "ra004-live-evidence-20260925");
fs.mkdirSync(outDir, { recursive: true });

function invariant(ok, message) { if (!ok) throw new Error(message); }
function utc(date = new Date()) { return date.toISOString().replace(/\.\d{3}Z$/, "Z"); }
function hashFile(file) { return crypto.createHash("sha256").update(fs.readFileSync(file)).digest("hex"); }
function jsonWrite(file, value) { const target=path.join(outDir,file); fs.writeFileSync(target, `${JSON.stringify(value,null,2)}\n`, { flag:"wx" }); return target; }
async function db(text, values=[]) { const client=new Client({connectionString:ownerUrl,ssl:{rejectUnauthorized:false},application_name:"ra004-guarded-owner-v1"}); try { await client.connect(); return await client.query(text,values); } finally { await client.end(); } }
async function ownerTransaction(statements) { const client=new Client({connectionString:ownerUrl,ssl:{rejectUnauthorized:false},application_name:"ra004-evidence-policy-owner-v1"}); try { await client.connect(); await client.query("begin"); for(const statement of statements) await client.query(statement); await client.query("commit"); } catch(error) { try { await client.query("rollback"); } catch {} throw error; } finally { await client.end(); } }
function credentialReader() {
  let seq=0; const pending=new Map();
  const child=fork(path.join(__dirname,"ra004-staging-credential-issuer.js"),[],{env:{RA004_OWNER_DATABASE_URL:ownerUrl},stdio:["ignore","ignore","ignore","ipc"]});
  child.on("message",m=>{const item=pending.get(m.request_id); if(!item)return; pending.delete(m.request_id); if(m.ok)item.resolve(m.result);else item.reject(new Error(m.error));});
  return { pid:child.pid, call(message){return new Promise((resolve,reject)=>{const request_id=++seq;pending.set(request_id,{resolve,reject});child.send({...message,request_id});});}, close(){child.disconnect();} };
}
function verifyRevokedCredential(databaseUrl) {
  return new Promise((resolve,reject)=>{
    const child=fork(path.join(__dirname,"ra004-staging-revocation-verifier.js"),[],{env:{RA004_REVOKED_DATABASE_URL:databaseUrl},stdio:["ignore","ignore","ignore","ipc"]});
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
  };
  const child=fork(path.join(__dirname,"ra004-staging-evidence-custodian.js"),[],{env:storageEnvironment,stdio:["ignore","ignore","ignore","ipc"]});
  child.on("message",m=>{const item=pending.get(m.request_id);if(!item)return;pending.delete(m.request_id);if(m.ok)item.resolve(m.result);else item.reject(new Error(m.error));});
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
function runCli(arguments_, extraEnvironment = {}) {
  const cli = process.env.RA004_SUPABASE_CLI_PATH;
  invariant(cli && path.isAbsolute(cli) && fs.existsSync(cli), "RA004_SUPABASE_CLI_MISSING");
  const childEnvironment = { ...process.env };
  delete childEnvironment.RA004_OWNER_DATABASE_URL;
  delete childEnvironment.RA004_SUPABASE_ACCESS_TOKEN;
  Object.assign(childEnvironment, extraEnvironment);
  const result = spawnSync(cli, arguments_, {
    cwd: ROOT,
    env: childEnvironment,
    encoding: "utf8",
    windowsHide: true,
    timeout: 180_000,
  });
  invariant(!result.error && result.status === 0, `RA004_SUPABASE_CLI_FAILED_${result.status ?? "START"}`);
  return String(result.stdout || "").slice(0, 2_000);
}
function pushSelectedMigrations(workdir) {
  const linkEnvironment = { SUPABASE_ACCESS_TOKEN: pat };
  runCli(["link", "--project-ref", REF, "--workdir", workdir, "--yes"], linkEnvironment);
  linkEnvironment.SUPABASE_ACCESS_TOKEN = "";
  const pushEnvironment = {
    SUPABASE_ACCESS_TOKEN: pat,
    SUPABASE_DB_PASSWORD: decodeURIComponent(new URL(ownerUrl).password),
  };
  runCli(["db", "push", "--linked", "--workdir", workdir, "--yes"], pushEnvironment);
  pushEnvironment.SUPABASE_ACCESS_TOKEN = "";
  pushEnvironment.SUPABASE_DB_PASSWORD = "";
}
function ensureWindow(expires) {
  invariant(Date.now() < expires.getTime(), "RA004_WINDOW_EXPIRED");
}
async function main() {
  invariant(ownerUrl && pat && process.env.RA004_STORAGE_ANON_KEY
    && process.env.RA004_STORAGE_EMAIL && process.env.RA004_STORAGE_PASSWORD,
  "RA004_AUTHENTICATION_MISSING");
  const parsed=new URL(ownerUrl);
  invariant(!`${parsed.hostname}|${parsed.username}`.match(/aftboxmrdgyhizicfsfu|prod/i),"RA004_PRODUCTION_TARGET_REJECTED");
  const remote=await selector.readRemoteState(ownerUrl);
  const selection=selector.validateSelection({
    environment:"STAGING", projectRef:REF, databaseTarget:remote.databaseTarget,
    remoteLedger:remote.remoteLedger,
    activationManifest:JSON.parse(fs.readFileSync(path.join(ROOT,"docs/retailer-automation/evidence/RA-004-staging-migration-activation.json"),"utf8")),
  });
  const selectedWorkdir=path.join(ROOT,"tmp","ra004-selected-staging-migrations");
  selector.materializeSelectedWorkdir({selection,workdir:selectedWorkdir});
  invariant(selection.pending_files.length===2
    && selection.pending_sha256s[selection.pending_files[0]]===CONTROL_SHA
    && selection.pending_sha256s[selection.pending_files[1]]===PREFLIGHT_SHA,"RA004_SELECTOR_NOT_EXACT");
  const retailer=(await db("select id::text,name,slug from public.retailers where lower(name)='10 reps' or lower(slug)='10-reps'")).rows;
  invariant(retailer.length===1 && retailer[0].name==="10 Reps" && retailer[0].slug==="10-reps" && retailer[0].id!=="14","RA004_RETAILER_AMBIGUOUS");
  const preObjects=(await db("select to_regprocedure('public.read_retailer_control_state_v1(bigint,text,text,text,timestamptz,text[],integer,integer)') control_rpc,to_regprocedure('public.read_ra004_staging_preflight_v1(text,text,text,integer,text,text,integer)') preflight_rpc")).rows[0];
  invariant(preObjects.control_rpc===null && preObjects.preflight_rpc===null,"RA004_PARTIAL_MIGRATION_STATE");
  const preexistingStoragePolicies=(await db(`select polname from pg_policy where polrelid='storage.objects'::regclass and (0=any(polroles) or 'anon'::regrole::oid=any(polroles) or 'authenticated'::regrole::oid=any(polroles))`)).rows;
  invariant(preexistingStoragePolicies.length===0,"RA004_STORAGE_EXISTING_BROAD_POLICY");
  invariant(runCli(["--version"]).trim()==="2.111.0","RA004_SUPABASE_CLI_VERSION_MISMATCH");

  const activation=`ra004-staging-${Date.now()}`;
  const starts=new Date(); const expires=new Date(starts.getTime()+30*60*1000);
  const startsAt=utc(starts), expiresAt=utc(expires);
  let custody,policies,issuer,preflightCred,canaryCred;
  let closeoutStored=false;
  const revoke=[]; const uploaded=[]; const cleanupFailures=[];
  const revokeOne=async(credential,runnerProcessId)=>{
    const databaseUrl=credential.database_url;
    const receipt=await issuer.call({action:"revoke",role:credential.role,runner_process_id:runnerProcessId});
    const verification=await verifyRevokedCredential(databaseUrl);
    revoke.push({...receipt,issued_at:credential.issued_at,expires_at:credential.expires_at,revoked_at:utc(),revocation_verification:verification});
    return receipt;
  };
  try {
    custody=evidenceCustodian(activation,expiresAt);
    const storageSession=await custody.call({action:"init"});
    policies=await configureEvidenceStore(storageSession.subject,activation);
    const policyAttestation=await attestEvidenceStore(policies);
    ensureWindow(expires);
    pushSelectedMigrations(selectedWorkdir);
    const migrationReceipts=selection.pending_files.map((file)=>({file,sha256:hashFile(path.join(selectedWorkdir,"supabase","migrations",file)),status:"APPLIED_BY_GUARDED_SELECTOR"}));
    const postRemote=await selector.readRemoteState(ownerUrl);
    const expectedTail=selection.pending_files.map(file=>file.replace(/\.sql$/,"")).map(identifier=>{const [version,...name]=identifier.split("_");return {version,name:name.join("_")};});
    invariant(postRemote.remoteLedger.length===remote.remoteLedger.length+2
      && JSON.stringify(postRemote.remoteLedger.slice(-2))===JSON.stringify(expectedTail),"RA004_POST_LEDGER_MISMATCH");
    ensureWindow(expires);
    const ledgerFp=selector.ledgerRowsFingerprint(postRemote.remoteLedger);
    issuer=credentialReader();
    const store={schema_version:"ra-004-evidence-store-metadata-v1",store_identifier:BUCKET,private:true,encryption:"AT_REST_AND_IN_TRANSIT",write_once:true,access_audit:true,readback_supported:true,raw_retention_days:90,derived_retention_days:90,approved_by:"Marek-Kalinka",approved_at:startsAt,evidence_store_fingerprint:"0".repeat(64)};
    store.evidence_store_fingerprint=sha256(store);
    const identity={schema_version:"ra-004-project-identity-v1",project_reference:REF,canonical_host:API_HOST,environment_label:"STAGING",project_identity_fingerprint:"0".repeat(64),observed_at:startsAt};
    identity.project_identity_fingerprint=sha256(identity);
    uploaded.push(await custody.call({action:"put",name:"policy-attestation.json",value:{...policyAttestation,activation_id:activation,storage_subject_fingerprint:sha256(storageSession.subject),retention:{redacted_bundle_days:90,fingerprint_receipt_years:7}}}));

    preflightCred=await issuer.call({action:"create",kind:"preflight",expires_at:expiresAt});
    const auth={schema_version:"ra-004-staging-preflight-authorization-execution-v1",status:"AUTHORIZED",task_id:"RA-004",baseline_sha:BASELINE,decision_fingerprint:contract.CURRENT_DECISION_FINGERPRINT,plan_fingerprint:PLAN_FP,control_migration:{path:contract.CONTROL_MIGRATION,sha256:CONTROL_SHA},preflight_migration:{path:contract.PREFLIGHT_MIGRATION,sha256:PREFLIGHT_SHA},target:{environment:"STAGING",project_reference:REF,canonical_host:API_HOST,host_allowlist:[API_HOST],retailer:{name:"10 Reps",slug:"10-reps"},ledger:{count:postRemote.remoteLedger.length,fingerprint:ledgerFp}},operator:"Marek-Kalinka",credential_issuer:"ra004-technical-issuer",window:{starts_at:startsAt,expires_at:expiresAt},credential_design:{role_name:preflightCred.role,environment:"STAGING_ONLY",rpc_name:contract.RPC_NAME,maximum_attempts:1,maximum_ttl_minutes:30,automatic_retry:false,service_role:false,table_privileges:false,sequence_privileges:false,dml:false,ddl:false,mutation_rpc:false},evidence_store:{store_identifier:BUCKET,required_private:true,required_encryption:true,required_write_once:true,required_access_audit:true,required_readback:true,raw_retention_days:90,derived_retention_days:90},authorization_fingerprint:"0".repeat(64)}; auth.authorization_fingerprint=contract.authorizationFingerprint(auth);
    const transport=createPreflightPostgresTransport({databaseUrl:preflightCred.database_url,projectReference:REF,canonicalHost:API_HOST,expectedSessionUser:preflightCred.role,credentialId:preflightCred.credential_id,projectIdentity:identity,evidenceStoreMetadata:store,revokeCredential:async request=>{const receipt=await revokeOne(preflightCred,request.runner_process_id);preflightCred=null;return receipt;}});
    const result=await runPreflight({authorization:auth,expected:{provider_mode:"live-read-only",baseline_sha:BASELINE,decision_fingerprint:contract.CURRENT_DECISION_FINGERPRINT,plan_fingerprint:PLAN_FP,control_migration:{path:contract.CONTROL_MIGRATION,sha256:CONTROL_SHA},preflight_migration:{path:contract.PREFLIGHT_MIGRATION,sha256:PREFLIGHT_SHA},project_reference:REF,canonical_host:API_HOST,host_allowlist:[API_HOST]},providerBundle:createClosedProvider({configuration:{environment:"STAGING",project_reference:REF,canonical_host:API_HOST,host_allowlist:[API_HOST],expected_session_user:preflightCred.role},transport}),outputPath:path.join(outDir,"preflight-report.json"),now:utc()});
    ensureWindow(expires);
    uploaded.push(await custody.call({action:"put",name:"preflight-report.json",value:result.report}));
    uploaded.push(await custody.call({action:"put",name:"preflight-revoke.json",value:result.receipt}));
    ensureWindow(expires);
    canaryCred=await issuer.call({action:"create",kind:"control",expires_at:expiresAt});
    const cAuth={version:"control-state-export-authorization-v1",status:"AUTHORIZED",retailer_id:String(retailer[0].id),retailer_name:"10 Reps",allowed_scope:[...SOURCE_NAMES],baseline_sha:BASELINE,task_id:"RA-004",valid_from:startsAt,expires_at:expiresAt,operation:"READ_ONLY_CONTROL_STATE_EXPORT",prohibited_operations:[...PROHIBITED_OPERATIONS],owner_consent:"OWNER_APPROVED",authorization_fingerprint:"0".repeat(64)}; cAuth.authorization_fingerprint=controlAuth.authorizationFingerprint(cAuth);
    const cProvider=createLiveReadOnlyProvider({authorization:cAuth,providerConfiguration:{provider_id:"ra004-staging-control-canary-v1",credential_type:"DEDICATED_CONTROL_STATE_EXPORTER",rpc_name:"public.read_retailer_control_state_v1",expected_session_user:canaryCred.role},transport:createControlStatePostgresTransport({databaseUrl:canaryCred.database_url,projectReference:REF,expectedSessionUser:canaryCred.role})});
    const cReport=await exportControlState({provider:cProvider,authorization:cAuth,retailer_id:String(retailer[0].id),retailer_name:"10 Reps",baseline_sha:BASELINE,provider_mode:"live-read-only",now:utc()});
    writeArtifact(path.join(outDir,"control-state-canary.json"),cReport);
    uploaded.push(await custody.call({action:"put",name:"control-state-canary.json",value:cReport}));
    const canaryReceipt=await revokeOne(canaryCred,process.pid); canaryCred=null;
    uploaded.push(await custody.call({action:"put",name:"control-state-revoke.json",value:{...canaryReceipt,revocation_verification:revoke.at(-1).revocation_verification}}));
    ensureWindow(expires);
    const canaryClear=cReport.final_assessment==="CLEAR_FOR_SEPARATE_SHADOW_AUTHORIZATION";
    const closeout={schema_version:"ra004-staging-closeout-v1",status:canaryClear?"VERIFIED_COMPLETE":"BLOCKED_CONTROL_STATE",activation_id:activation,baseline_sha:BASELINE,window:{starts_at:startsAt,expires_at:expiresAt,closed_at:utc()},project_identity:identity,retailer:{id:String(retailer[0].id),name:retailer[0].name,slug:retailer[0].slug},evidence_store:{...store,...policyAttestation},migration_receipts:migrationReceipts,ledger:{before_count:remote.remoteLedger.length,after_count:postRemote.remoteLedger.length,after_fingerprint:ledgerFp},preflight:{status:"VERIFIED_COMPLETE",report_fingerprint:result.report.report_fingerprint,capability_counters:result.receipt.capability_counters},canary:{status:canaryClear?"VERIFIED_COMPLETE":"BLOCKED",final_assessment:cReport.final_assessment,export_fingerprint:cReport.export_fingerprint,read_attempt_count:cReport.read_attempt_count,write_attempt_count:cReport.write_attempt_count,mutation_attempt_count:cReport.mutation_attempt_count},revoke_receipts:revoke.map(x=>({...x,issuer_process_id_present:true,runner_process_id_present:true,issuer_process_id:undefined,runner_process_id:undefined})),uploaded_objects:uploaded,forbidden_operations:{production:0,feed_capture:0,shadow_run:0,control_plan:0,approval:0,import:0,apply:0,offer_writes:0,model_b:0}};
    jsonWrite("closeout.json",closeout);
    await custody.call({action:"put",name:"closeout.json",value:closeout}); closeoutStored=true;
    process.stdout.write(`${JSON.stringify({status:closeout.status,activation_id:activation,window:closeout.window,retailer_id:closeout.retailer.id,final_assessment:cReport.final_assessment,closeout:path.join(outDir,"closeout.json")})}\n`);
    invariant(canaryClear,"RA004_CANARY_CONTROL_STATE_BLOCKED");
  } catch(error) {
    if(preflightCred&&issuer) { try{await revokeOne(preflightCred,process.pid);}catch{cleanupFailures.push("preflight");}finally{preflightCred=null;} }
    if(canaryCred&&issuer) { try{await revokeOne(canaryCred,process.pid);}catch{cleanupFailures.push("canary");}finally{canaryCred=null;} }
    if(custody&&!closeoutStored) {
      const failure={schema_version:"ra004-staging-closeout-v1",status:"BLOCKED",activation_id:activation,baseline_sha:BASELINE,window:{starts_at:startsAt,expires_at:expiresAt,closed_at:utc()},failure_code:String(error.message).replace(/postgres(?:ql)?:\/\/[^\s]+/gi,"[REDACTED]").slice(0,160),revoke_receipts:revoke.map(x=>({credential_id:x.credential_id,access_revoked:x.access_revoked,revocation_verification:x.revocation_verification})),uploaded_objects:uploaded,forbidden_operations:{production:0,feed_capture:0,shadow_run:0,control_plan:0,approval:0,import:0,apply:0,offer_writes:0,model_b:0}};
      try { jsonWrite("failure-closeout.json",failure); await custody.call({action:"put",name:"closeout.json",value:failure}); closeoutStored=true; } catch {}
    }
    throw error;
  } finally {
    if(preflightCred&&issuer) { try{await revokeOne(preflightCred,process.pid);}catch{cleanupFailures.push("preflight");} }
    if(canaryCred&&issuer) { try{await revokeOne(canaryCred,process.pid);}catch{cleanupFailures.push("canary");} }
    if(issuer)issuer.close();
    try{await removeEvidencePolicies(policies);}catch{cleanupFailures.push("storage-policies");}
    if(custody) { try{await custody.call({action:"close"});}catch{cleanupFailures.push("storage-session");} custody.close(); }
    process.env.RA004_OWNER_DATABASE_URL=""; process.env.RA004_SUPABASE_ACCESS_TOKEN="";
    invariant(cleanupFailures.length===0,`RA004_CLEANUP_UNVERIFIED_${cleanupFailures.join("_")}`);
  }
}
if (require.main === module) {
  main().catch(error=>{process.stderr.write(`${String(error.message).replace(/postgres(?:ql)?:\/\/[^\s]+/gi,"[REDACTED]").slice(0,500)}\n`);process.exitCode=1;});
}

module.exports = {
  API_HOST, BASELINE, BUCKET, CONTROL_SHA, PLAN_FP, PREFLIGHT_SHA, REF,
  pushSelectedMigrations, runCli,
};
