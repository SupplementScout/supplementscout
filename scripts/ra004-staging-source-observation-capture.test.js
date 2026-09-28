const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");

const capturePath = path.join(__dirname, "ra004-staging-source-observation-capture.js");
const issuerPath = path.join(__dirname, "ra004-staging-credential-issuer.js");
const verifierPath = path.join(__dirname, "ra004-staging-revocation-verifier.js");
const launcherPath = path.join(__dirname, "ra004-run-staging-source-observation-capture.ps1");
const capture = fs.readFileSync(capturePath, "utf8");
const issuer = fs.readFileSync(issuerPath, "utf8");
const verifier = fs.readFileSync(verifierPath, "utf8");
const launcher = fs.readFileSync(launcherPath, "utf8");
const values = require(capturePath);

test("capture is exact to staging retailer 11 and five required sources", () => {
  assert.equal(values.PROJECT_REF, "hxnrsyyqffztlvcrtgbf");
  assert.equal(values.EXPECTED_HOST, "aws-0-eu-west-3.pooler.supabase.com");
  assert.equal(values.RETAILER_ID, "11");
  assert.equal(values.EXPECTED_LEDGER_COUNT, 98);
  assert.equal(values.EXPECTED_LEDGER_FINGERPRINT, "b4e72276ba2570d2da9957c53b6c209a3799087570302af92b295467a1d4e307");
  assert.deepEqual(values.SOURCES, ["sessions", "locks", "postflight_state", "watchdog_state", "global_conflicts"]);
  assert.doesNotThrow(() => values.validateRemoteTarget({
    databaseTarget: {
      target_environment: "STAGING",
      project_ref: "hxnrsyyqffztlvcrtgbf",
      database_identity: "supplementscout-staging:hxnrsyyqffztlvcrtgbf",
    },
    identity: { current_user: "postgres" },
  }));
  for (const [field, value, code] of [
    ["target_environment", "PRODUCTION", "ENVIRONMENT"],
    ["project_ref", "wrong", "PROJECT"],
    ["database_identity", "wrong", "TARGET"],
  ]) {
    assert.throws(() => values.validateRemoteTarget({
      databaseTarget: {
        target_environment: "STAGING",
        project_ref: "hxnrsyyqffztlvcrtgbf",
        database_identity: "supplementscout-staging:hxnrsyyqffztlvcrtgbf",
        [field]: value,
      },
      identity: { current_user: "postgres" },
    }), new RegExp(`RA004_SOURCE_OBSERVATION_DATABASE_${code}_MISMATCH`));
  }
  assert.throws(() => values.validateRemoteTarget({
    databaseTarget: {
      target_environment: "STAGING",
      project_ref: "hxnrsyyqffztlvcrtgbf",
      database_identity: "supplementscout-staging:hxnrsyyqffztlvcrtgbf",
    },
    identity: { current_user: "not-postgres" },
  }), /RA004_SOURCE_OBSERVATION_DATABASE_USER_MISMATCH/);
});

test("events are deterministic in scope, bounded in time and carry observed counts", () => {
  const inventory = { sessions: 0, locks: 1, postflight_state: 2, watchdog_state: 3, global_conflicts: 4 };
  const events = values.buildEvents({
    activationId: "ra004-source-observation-1",
    observedAt: "2026-09-28T20:00:00.000Z",
    expiresAt: "2026-09-28T20:20:00.000Z",
    inventory,
  });
  assert.equal(events.length, 5);
  assert.deepEqual(events.map((event) => event.source), values.SOURCES);
  assert.deepEqual(events.map((event) => event.metadata.observed_record_count), [0, 1, 2, 3, 4]);
  assert.ok(events.every((event) => /^[0-9a-f]{64}$/.test(event.scope_fingerprint)));
  assert.equal(new Set(events.map((event) => event.idempotency_key)).size, 5);
});

test("capture uses one read-only inventory transaction and one atomic five-RPC write transaction", () => {
  assert.match(capture, /begin isolation level repeatable read read only/);
  assert.match(capture, /await client\.query\("begin"\);[\s\S]+for \(const event of events\)[\s\S]+await client\.query\("commit"\)/);
  assert.match(values.WRITE_SQL, /write_retailer_control_state_evidence_v1/);
  assert.match(values.WRITE_SQL, /'SOURCE_OBSERVED'/);
  assert.match(values.WRITE_SQL, /'RCSE_SOURCE_CLEAR'/);
  assert.doesNotMatch(values.WRITE_SQL, /insert\s+into|update\s+|delete\s+from|truncate\s+/i);
});

test("bounded evidence login receives only schema usage and exact writer EXECUTE", () => {
  assert.match(issuer, /evidence:[\s\S]+ra004_ev_20260928_c[\s\S]+write_retailer_control_state_evidence_v1/);
  assert.match(issuer, /readOnly: false/);
  assert.match(issuer, /RA004_ISSUER_KIND_INVALID/);
  assert.match(issuer, /grant usage on schema public/);
  assert.match(issuer, /grant execute on function \$\{signature\}/);
  assert.doesNotMatch(issuer, /grant (?:select|insert|update|delete|truncate) on/i);
});

test("capture always revokes through the common query-aware verifier", () => {
  assert.match(capture, /finally \{[\s\S]+action: "revoke"[\s\S]+verifyRevokedCredential/);
  assert.match(verifier, /\(\?:pf\|cs\|ev\)/);
  assert.match(capture, /retry: 0/);
});

test("capture cannot run migration, preflight, canary or production paths", () => {
  assert.doesNotMatch(capture, /db push|include-all|runPreflight|exportControlState|supabase db/i);
  assert.match(capture, /migration: 0, preflight: 0, canary: 0, production: 0/);
  assert.doesNotMatch(capture, /service_role|anon key|publishable/i);
});

test("launcher masks the database URL, validates CA and requires exact START", () => {
  assert.match(launcher, /Read-Host -Prompt 'Staging database URL' -AsSecureString/);
  assert.match(launcher, /NODE_EXTRA_CA_CERTS/);
  assert.match(launcher, /validateLocalCa/);
  assert.match(launcher, /-cne 'START'/);
  assert.doesNotMatch(launcher, /Write-Host.*databaseUrl/);
});
