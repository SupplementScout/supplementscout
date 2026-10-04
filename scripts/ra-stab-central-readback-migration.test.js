const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");
const runner = require("./ra-stab-central-control-plan-readback");
const { writeOnce } = require("./lib/immutable-evidence");

const ROOT = path.resolve(__dirname, "..");
const MIGRATION = path.join(ROOT, "supabase/migrations/20261004120000_add_central_control_plan_readback.sql");
const sql = fs.readFileSync(MIGRATION, "utf8");

test("central readback is production-bound and retailer-neutral", () => {
  assert.match(sql, /target_environment' <> 'PRODUCTION'/);
  assert.match(sql, /aftboxmrdgyhizicfsfu/);
  assert.match(sql, /read_control_plan_status_v1\(p_parent_plan_id uuid\)/);
  assert.doesNotMatch(sql, /10 Reps|retailer_id\s*=|06ae81b7/);
});

test("caller is durable but disabled and receives one private RPC only", () => {
  assert.match(sql, /create role retailer_control_plan_readback_caller\s+\n?\s*nologin noinherit nosuperuser nocreatedb nocreaterole noreplication nobypassrls/);
  assert.match(sql, /connection limit 1/);
  assert.match(sql, /default_transaction_read_only=on/);
  assert.match(sql, /grant usage on schema retailer_readback to retailer_control_plan_readback_caller/);
  assert.match(sql, /grant execute on function retailer_readback\.read_control_plan_status_v1\(uuid\)\s+to retailer_control_plan_readback_caller/);
  assert.doesNotMatch(sql, /grant (?:select|insert|update|delete|truncate).*retailer_control_plan_readback_caller/i);
});

test("wrapper is static, stable and closed to shared runtime roles", () => {
  assert.match(sql, /language sql\s+stable\s+security definer\s+set search_path=pg_catalog/);
  assert.match(sql, /select public\.get_retailer_catalogue_plan_status\(p_parent_plan_id\)/);
  assert.doesNotMatch(sql, /alter function[\s\S]+owner to/i);
  assert.doesNotMatch(sql, /execute format|dynamic sql/i);
  assert.match(sql, /revoke all on function retailer_readback\.read_control_plan_status_v1\(uuid\)[\s\S]+from public,anon,authenticated,service_role/);
});

test("incident regression restores the baseline helper ACL and checks reachable capabilities", () => {
  assert.match(sql, /revoke execute on function public\.rls_auto_enable\(\) from public/);
  assert.match(sql, /has_schema_privilege\('retailer_control_plan_readback_caller',n\.oid,'USAGE'\)/);
  assert.match(sql, /has_function_privilege\('public','public\.rls_auto_enable\(\)','EXECUTE'\)/);
  assert.match(sql, /RA_STAB_CENTRAL_REACHABLE_RELATION_PRIVILEGE/);
});

function preparation() {
  return runner.validatePreparation(JSON.parse(fs.readFileSync(runner.PREPARATION_PATH, "utf8")));
}

test("central V4 authorization binds one read, result-before-cleanup and no replay paths", () => {
  const value = preparation();
  assert.equal(value.scope.children.length, 19);
  assert.equal(new Set(value.scope.children.map(row => row.child_plan_id)).size, 19);
  assert.equal(value.execution.maximum_read_attempts, 1);
  assert.equal(value.execution.automatic_retry, false);
  assert.equal(value.execution.result_before_cleanup, true);
  assert.equal(value.execution.cleanup_required, true);
  assert.equal(value.execution.close_authorized, false);
  assert.equal(value.execution.ra004_replay_authorized, false);
  assert.match(runner.confirmation(value), /^[0-9a-f]{20}$/);
  assert.doesNotMatch(fs.readFileSync(path.join(__dirname, "ra-stab-central-control-plan-readback.js"), "utf8"),
    /insert into supabase_migrations|create role|create schema|RA-004 replay/i);
});

test("central V4 missing CA stops before Git, marker and database dependencies", async () => {
  let gitCalls = 0;
  await assert.rejects(() => runner.execute(preparation(), {
    tls: { env: {} },
    validateGitState() { gitCalls += 1; return "a".repeat(40); },
    ownerUrl() { throw new Error("OWNER_URL_MUST_NOT_BE_READ"); },
  }), /TLS_CA_REQUIRED/);
  assert.equal(gitCalls, 0);
});

test("central V4 persists the validated result before cleanup and only then seals a receipt", async () => {
  const events = [];
  const result = await runner.runReadbackLifecycle({
    async readOnce() { events.push("read"); return { status: "validated" }; },
    async persistValidated(value) { events.push(`persist:${value.status}`); return { sha256: "a".repeat(64) }; },
    async cleanup() { events.push("cleanup"); return { login_disabled: true, backend_count: 0 }; },
    async finalize({ provisional, cleanup }) { events.push("finalize"); return { provisional, cleanup }; },
  });
  assert.deepEqual(events, ["read", "persist:validated", "cleanup", "finalize"]);
  assert.equal(result.cleanup.backend_count, 0);
});

test("central V4 preserves a provisional result when cleanup fails and never finalizes", async () => {
  const events = [];
  const provisional = { path: "pending.json", sha256: "b".repeat(64) };
  await assert.rejects(() => runner.runReadbackLifecycle({
    async readOnce() { events.push("read"); return { status: "validated" }; },
    async persistValidated() { events.push("persist"); return provisional; },
    async cleanup() { events.push("cleanup"); throw new Error("BACKEND_REMAINS"); },
    async finalize() { events.push("finalize"); },
  }), error => {
    assert.equal(error.cleanup_required, true);
    assert.deepEqual(error.provisional, provisional);
    return /CLEANUP:BACKEND_REMAINS/.test(error.message);
  });
  assert.deepEqual(events, ["read", "persist", "cleanup"]);
});

test("central V4 still cleans up when read validation or provisional persistence fails", async () => {
  for (const phase of ["read", "persist"]) {
    const events = [];
    await assert.rejects(() => runner.runReadbackLifecycle({
      async readOnce() { events.push("read"); if (phase === "read") throw new Error("READ_FAILED"); return {}; },
      async persistValidated() { events.push("persist"); throw new Error("PERSIST_FAILED"); },
      async cleanup() { events.push("cleanup"); return { login_disabled: true }; },
      async finalize() { events.push("finalize"); },
    }), phase === "read" ? /READ_FAILED/ : /PERSIST_FAILED/);
    assert.equal(events.at(-1), "cleanup");
    assert.ok(!events.includes("finalize"));
  }
});

test("central immutable evidence is tmp-confined, durable and write-once", () => {
  const directory = fs.mkdtempSync(path.join(ROOT, "tmp", "central-evidence-test-"));
  const output = path.join(directory, "result.json");
  try {
    const artifact = writeOnce(output, { status: "VALIDATED_RESULT_PENDING_CLEANUP", count: 19 });
    assert.equal(fs.existsSync(output), true);
    assert.equal(fs.existsSync(`${output}.sha256`), true);
    assert.equal(artifact.sha256, runner.sha256(fs.readFileSync(output)));
    assert.throws(() => writeOnce(output, { status: "OVERWRITE" }), /OUTPUT_EXISTS/);
    assert.throws(() => writeOnce(path.join(ROOT, "outside.json"), {}), /OUTPUT_BLOCKED/);
  } finally { fs.rmSync(directory, { recursive: true, force: true }); }
});
