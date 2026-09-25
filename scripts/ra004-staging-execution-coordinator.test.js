const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");

const ROOT = path.resolve(__dirname, "..");
const coordinatorPath = path.join(__dirname, "ra004-staging-execution-coordinator.js");
const issuerPath = path.join(__dirname, "ra004-staging-credential-issuer.js");
const custodianPath = path.join(__dirname, "ra004-staging-evidence-custodian.js");
const verifierPath = path.join(__dirname, "ra004-staging-revocation-verifier.js");
const coordinator = fs.readFileSync(coordinatorPath, "utf8");
const issuer = fs.readFileSync(issuerPath, "utf8");
const custodian = fs.readFileSync(custodianPath, "utf8");
const verifier = fs.readFileSync(verifierPath, "utf8");

test("coordinator is pinned to the owner-authorized staging identity and artifacts", () => {
  const values = require("./ra004-staging-execution-coordinator");
  assert.equal(values.REF, "hxnrsyyqffztlvcrtgbf");
  assert.equal(values.API_HOST, "hxnrsyyqffztlvcrtgbf.supabase.co");
  assert.equal(values.BASELINE, "247672dcb1d1b4654cc6a091ff10d7dbad42a902");
  assert.equal(values.CONTROL_SHA, "cfd7a93cb20845832b696183f5eb8a500f0474b4173829b85f6ac6bc73d4baaa");
  assert.equal(values.PREFLIGHT_SHA, "9d6c1ea4df0bd86f84a4cb779a0824922f4e9bcc91681b734d5d18465a9e91be");
  assert.equal(values.BUCKET, "ra004-staging-preflight-evidence");
  assert.match(coordinator, /aftboxmrdgyhizicfsfu\|prod\/i/);
});

test("migration apply consumes only the materialized guarded selector workdir", () => {
  assert.match(coordinator, /selector\.validateSelection/);
  assert.match(coordinator, /selector\.materializeSelectedWorkdir/);
  assert.match(coordinator, /pending_files\.length===2/);
  assert.match(coordinator, /\["db", "push", "--linked", "--workdir", workdir, "--yes"\]/);
  assert.doesNotMatch(coordinator, /--include-all/);
  assert.doesNotMatch(coordinator, /insert into supabase_migrations/i);
  assert.doesNotMatch(coordinator, /await db\(sql\)/);
});

test("secrets remain process-only and are not placed in CLI arguments or output", () => {
  assert.match(coordinator, /delete childEnvironment\.RA004_OWNER_DATABASE_URL/);
  assert.match(coordinator, /delete childEnvironment\.RA004_SUPABASE_ACCESS_TOKEN/);
  assert.match(coordinator, /const linkEnvironment = \{ SUPABASE_ACCESS_TOKEN: pat \}/);
  assert.doesNotMatch(coordinator, /linkEnvironment[^;]*SUPABASE_DB_PASSWORD/s);
  assert.match(coordinator, /const pushEnvironment = \{[\s\S]*SUPABASE_DB_PASSWORD:/);
  assert.doesNotMatch(coordinator, /"--password"|"--db-url"/);
  assert.match(coordinator, /\[REDACTED\]/);
  assert.doesNotMatch(coordinator, /console\.log\(ownerUrl|console\.log\(pat/);
  assert.match(coordinator, /process\.env\.RA004_STORAGE_ANON_KEY=""/);
  assert.doesNotMatch(custodian, /console\.(?:log|error)|process\.stdout|process\.stderr/);
});

test("evidence bucket and object writes are private, bounded and non-overwriting", () => {
  assert.match(coordinator, /insert into storage\.buckets\(id,name,public,file_size_limit,allowed_mime_types\)/);
  assert.match(coordinator, /false,2097152,array\['application\/json','text\/plain'\]/);
  assert.match(coordinator, /create policy \$\{insertPolicy\}.*for insert to authenticated with check/);
  assert.match(coordinator, /create policy \$\{selectPolicy\}.*for select to authenticated using/);
  assert.match(coordinator, /drop policy if exists \$\{policies\.insertPolicy\}/);
  assert.match(custodian, /bytes\.length > 2 \* 1024 \* 1024/);
  assert.match(custodian, /RA004_EVIDENCE_READBACK_HASH_MISMATCH/);
  assert.match(custodian, /method: "POST"/);
  assert.match(custodian, /method: "GET"/);
  assert.match(custodian, /claims\.role !== "anon"/);
  assert.doesNotMatch(custodian, /x-upsert|method: "(?:PUT|PATCH|DELETE)"|\/object\/list\//i);
  assert.doesNotMatch(coordinator + custodian, /api-keys\?reveal|storage","cp|storage rm|storage ls/);
  assert.match(coordinator, /service_role:false/);
});

test("preflight gates exactly one later control-state canary and both credentials revoke in finally", () => {
  const preflight = coordinator.indexOf("await runPreflight");
  const canaryCredential = coordinator.indexOf('kind:"control"');
  const canary = coordinator.indexOf("await exportControlState");
  assert.ok(preflight > 0 && canaryCredential > preflight && canary > canaryCredential);
  assert.match(coordinator, /maximum_attempts:1/);
  assert.match(coordinator, /automatic_retry:false/);
  assert.match(coordinator, /if\(preflightCred&&issuer\).*revokeOne\(preflightCred/s);
  assert.match(coordinator, /if\(canaryCred&&issuer\).*revokeOne\(canaryCred/s);
  assert.match(coordinator, /final_assessment==="CLEAR_FOR_SEPARATE_SHADOW_AUTHORIZATION"/);
  assert.doesNotMatch(coordinator, /setInterval|setTimeout|retry\s*\(/i);
});

test("credential issuer is a separate process with exact RPC-only logins", () => {
  assert.match(coordinator, /fork\(path\.join\(__dirname,"ra004-staging-credential-issuer\.js"\)/);
  assert.match(issuer, /connection limit 1/);
  assert.match(issuer, /default_transaction_read_only=on/);
  assert.match(issuer, /statement_timeout=''15s''/);
  assert.match(issuer, /grant execute on function \$\{signature\}/);
  assert.match(issuer, /alter role \$\{id\} nologin/);
  assert.match(issuer, /drop role \$\{id\}/);
  assert.match(issuer, /RA004_ROLE_REVOKE_UNVERIFIED/);
  assert.match(coordinator, /ra004-staging-revocation-verifier\.js/);
  assert.match(verifier, /RA004_REVOKED_CREDENTIAL_RECONNECTED/);
  assert.match(verifier, /28P01/);
  assert.doesNotMatch(issuer, /grant .*service_role|grant .*validator|grant .*approver|grant .*executor/i);
});

test("coordinator contains no feed, shadow, plan, approval, import, apply, offer or production executor", () => {
  for (const forbidden of [
    "TEN_REPS_FEED_URL", "import-products", "apply_approved", "create_control_plan",
    "approve_", "shadow-run", "Model B", "price_history",
  ]) assert.doesNotMatch(coordinator, new RegExp(forbidden, "i"));
  assert.match(coordinator, /production:0,feed_capture:0,shadow_run:0,control_plan:0,approval:0,import:0,apply:0,offer_writes:0,model_b:0/);
});

test("the tracked coordinator, issuer, custodian and verifier are repository files", () => {
  assert.ok(fs.existsSync(coordinatorPath));
  assert.ok(fs.existsSync(issuerPath));
  assert.ok(fs.existsSync(custodianPath));
  assert.ok(fs.existsSync(verifierPath));
  assert.ok(fs.existsSync(path.join(ROOT, "docs", "retailer-automation", "evidence", "RA-004-staging-migration-activation.json")));
});
