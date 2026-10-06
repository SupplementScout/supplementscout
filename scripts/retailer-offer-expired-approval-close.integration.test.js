const assert = require("node:assert/strict");
const crypto = require("node:crypto");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const test = require("node:test");
const { canonicalJson } = require("./lib/canonical-json");
const recovery = require("./ra-stab-01-production-recovery");
const { CONTRACTS } = require("./supabase-migration-selector");

const migration = fs.readFileSync(path.resolve(__dirname, "../supabase/migrations/20260719090000_add_expired_retailer_offer_sync_approval_close.sql"), "utf8");
const sequentialMigration = fs.readFileSync(path.resolve(__dirname, "../supabase/migrations/20260929133000_extend_expired_sequential_plan_close.sql"), "utf8");
const partialSequentialMigration = fs.readFileSync(path.resolve(__dirname, "../supabase/migrations/20261006120000_extend_partial_sequential_plan_close.sql"), "utf8");
const scenario = fs.readFileSync(path.resolve(__dirname, "../supabase/test/retailer_offer_expired_approval_close_integration_test.sql"), "utf8");
const partialScenario = fs.readFileSync(path.resolve(__dirname, "../supabase/test/retailer_offer_partial_plan_close_integration_test.sql"), "utf8");
const productionPreparation = JSON.parse(fs.readFileSync(path.resolve(
  __dirname,
  "../docs/retailer-automation/evidence/RA-STAB-01-PRODUCTION-RECOVERY-PREPARATION.json",
), "utf8"));
const recoveryCoordinatorSource = fs.readFileSync(path.resolve(
  __dirname,
  "ra-stab-01-production-recovery.js",
), "utf8");

test("expired approval close is one transactional control-plane-only migration", () => {
  assert.match(migration, /^begin;/i); assert.match(migration, /commit;\s*$/i);
  assert.match(migration, /alter table public\.retailer_offer_sync_batch_approvals/);
  assert.doesNotMatch(migration, /\b(?:insert\s+into|update|delete\s+from)\s+public\.(?:retailers|products|product_variants|retailer_products|offers|price_history)\b/i);
  assert.doesNotMatch(migration, /(?:apply_approved_product_import_plan|execute_retailer_offer_sync_batch|recover_retailer_offer_sync_batch)\s*\(/i);
});

test("RPC locks exact approval-child-parent state and proves zero execution before EXPIRED", () => {
  assert.match(migration, /close_expired_retailer_offer_sync_approval\(p_request jsonb\)/);
  for (const table of ["retailer_offer_sync_batch_approvals", "retailer_catalogue_child_plans", "retailer_catalogue_parent_plans"])
    assert.match(migration, new RegExp(`from public\\.${table}[\\s\\S]+for update`, "i"));
  for (const token of ["v_row_approvals<>0", "v_apply_runs<>0", "v_recovery_manifests<>0", "v_approval.result is not null", "v_after_business is distinct from v_before_business"])
    assert.ok(migration.includes(token), token);
  assert.match(migration, /set status='EXPIRED'/g); assert.match(migration, /consumed_at is null/);
});

test("security and replay model are narrow and fail closed", () => {
  assert.match(migration, /security definer[\s\S]+set search_path=pg_catalog,public,pg_temp/i);
  assert.match(migration, /security invoker[\s\S]+current_user<>'retailer_catalogue_staging_approver'/i);
  assert.match(migration, /grant execute[^;]+close_expired_retailer_offer_sync_approval\(jsonb\)[^;]+retailer_catalogue_staging_approver/is);
  assert.match(migration, /grant execute[^;]+retailer_offer_sync_close_expired_approval_internal\(jsonb\)[^;]+retailer_catalogue_staging_approver/is);
  assert.match(migration, /revoke all[^;]+close_expired_retailer_offer_sync_approval\(jsonb\)[^;]+retailer_catalogue_staging_executor[^;]+retailer_catalogue_staging_validator/is);
  assert.match(migration, /close_request_fingerprint is distinct from v_request_fingerprint/);
  assert.match(migration, /already_closed',true,'control_writes',0/);
  assert.match(migration, /retailer_catalogue_assert_migration_ledger/);
  assert.match(migration, /retailer_catalogue_staging_runtime_guard/);
});

test("disposable scenario covers success, replay, negatives, rollback and privilege matrix", () => {
  for (const token of ["unexpired", "consumed", "row-approval", "apply-run", "recovery-state", "target-mismatch", "production-target", "ledger-mismatch", "database-identity", "fingerprint-mismatch", "parent-child-mismatch", "injected-rollback"])
    assert.match(scenario, new RegExp(token));
  assert.match(scenario, /'cases',case when[\s\S]+then 24 else 20 end/);
  assert.match(scenario, /'business_writes',0,'price_history_writes',0,'replay_writes',0/);
  for (const role of ["retailer_catalogue_staging_approver", "retailer_catalogue_staging_executor", "retailer_catalogue_staging_validator", "public"])
    assert.match(scenario, new RegExp(`has_function_privilege\\('${role}'`));
});

test("shared sequential recovery extends the existing RPC and closes the whole unexecuted tree", () => {
  assert.match(sequentialMigration, /^begin;/i);
  assert.match(sequentialMigration, /commit;\s*$/i);
  assert.match(sequentialMigration, /create or replace function public\.retailer_offer_sync_close_expired_approval_internal\(p_request jsonb\)/i);
  assert.doesNotMatch(sequentialMigration, /create\s+(?:or\s+replace\s+)?function\s+public\.(?!retailer_offer_sync_close_expired_approval_internal)/i);
  assert.match(sequentialMigration, /retailer-offer-sync:global-execution/);
  assert.match(sequentialMigration, /PRODUCTION:'\|\|v_retailer_id::text/);
  assert.match(sequentialMigration, /v_approved_children<>1 or v_planned_children<>v_child_count-1/);
  assert.match(sequentialMigration, /v_parent\.child_manifest->c\.batch_index->>'child_plan_id' is distinct from c\.id::text/);
  assert.match(sequentialMigration, /v_parent\.child_manifest->c\.batch_index->'record_ids' is distinct from c\.record_ids/);
  assert.match(sequentialMigration, /v_batch_approvals<>1/);
  assert.match(sequentialMigration, /v_apply_runs<>0/);
  assert.match(sequentialMigration, /v_row_approvals<>0/);
  assert.match(sequentialMigration, /v_recovery_manifests<>0 or v_recovery_approvals<>0 or v_recovery_audit<>0/);
  assert.match(sequentialMigration, /where parent_plan_id=v_parent\.id and status in \('PLANNED','APPROVED'\)/);
  assert.match(sequentialMigration, /if v_rows<>v_child_count/);
  assert.match(sequentialMigration, /v_after_business is distinct from v_before_business/);
  assert.doesNotMatch(sequentialMigration, /\b(?:insert\s+into|update|delete\s+from)\s+public\.(?:retailers|products|product_variants|retailer_products|offers|price_history)\b/i);
  assert.match(scenario, /expired_close_test_seed\('sequential-tree-success',now\(\)-interval '1 hour',18\)/);
  assert.match(scenario, /count\(\*\)=19 and count\(\*\) filter\(where status='EXPIRED'\)=19/);
  assert.match(scenario, /unexpected approved sibling blocked/);
  assert.match(scenario, /sequential child manifest drift blocked/);
});

test("shared recovery preserves a proven applied prefix and supersedes only the expired suffix", () => {
  assert.match(partialSequentialMigration, /^begin;/i);
  assert.match(partialSequentialMigration, /commit;\s*$/i);
  assert.match(partialSequentialMigration, /create or replace function public\.retailer_offer_sync_close_expired_approval_internal\(p_request jsonb\)/i);
  assert.doesNotMatch(partialSequentialMigration, /create\s+(?:or\s+replace\s+)?function\s+public\.(?!retailer_offer_sync_close_expired_approval_internal)/i);
  assert.match(partialSequentialMigration, /v_parent\.status='PARTIALLY_APPLIED'/);
  assert.match(partialSequentialMigration, /v_child\.batch_index<>v_applied_children/);
  assert.match(partialSequentialMigration, /status='APPLIED'[\s\S]+status<>'APPLIED'/);
  assert.match(partialSequentialMigration, /v_batch_approvals<>v_applied_children\+1/);
  assert.match(partialSequentialMigration, /v_apply_runs<>v_applied_children/);
  assert.match(partialSequentialMigration, /v_recovery_manifests<>v_applied_children/);
  assert.match(partialSequentialMigration, /m\.status='READY'/);
  assert.match(partialSequentialMigration, /a\.source='retailer_offer_mixed_batch'/);
  assert.match(partialSequentialMigration, /where parent_plan_id=v_parent\.id and status in \('PLANNED','APPROVED'\)/);
  assert.match(partialSequentialMigration, /set status=case when v_partial then 'SUPERSEDED' else 'EXPIRED' end/);
  assert.match(partialSequentialMigration, /'preserved_applied_child_count',v_applied_children/);
  assert.match(partialSequentialMigration, /v_after_business is distinct from v_before_business/);
  assert.doesNotMatch(partialSequentialMigration, /10 Reps|Fit House|Simply Supplements|retailer_id\s*[=!<>]+\s*14/i);
  assert.doesNotMatch(partialSequentialMigration, /\b(?:insert\s+into|update|delete\s+from)\s+public\.(?:retailers|products|product_variants|retailer_products|offers|price_history)\b/i);
  assert.doesNotMatch(partialSequentialMigration, /(?:execute_retailer_offer_sync_batch|apply_approved_product_import_plan|recover_retailer_offer_sync_batch)\s*\(/i);
  assert.match(partialScenario, /'shape','12_APPLIED_1_APPROVED_6_PLANNED'/);
  assert.match(partialScenario, /count\(\*\)=591/);
  assert.match(partialScenario, /count\(\*\) filter\(where status='APPLIED'\)=12/);
  assert.match(partialScenario, /count\(\*\) filter\(where status='SUPERSEDED'\)=7/);
  assert.match(partialScenario, /v_after=v_before and v_history_after=v_history_before/);
});

test("production recovery preparation is exact, two-phase and not authorized", () => {
  assert.equal(productionPreparation.status, "NOT_AUTHORIZED");
  assert.deepEqual(productionPreparation.target, {
    environment: "PRODUCTION",
    project_ref: "aftboxmrdgyhizicfsfu",
    database_identity: "supplementscout-production:aftboxmrdgyhizicfsfu",
  });
  assert.equal(productionPreparation.fresh_readback.pre_migration_ledger_count, 222);
  assert.equal(productionPreparation.fresh_readback.pre_migration_ledger_fingerprint, "c08b5f2e704072a0e4b2590688998e07a781f8699546279b6e81acd9c975c0fe");
  assert.equal(productionPreparation.fresh_readback.post_migration_ledger_count, 223);
  assert.equal(productionPreparation.fresh_readback.post_migration_ledger_fingerprint, "c891240d8ed411b3bc0ad5e2abc6a8c90bfeb442c1cd0824f3c5a4577ee0c7b0");
  assert.deepEqual(productionPreparation.fresh_readback.business_counts, {
    products: "1337",
    product_variants: "3632",
    retailer_products: "3758",
    offers: "3758",
    price_history: "24583",
  });
  assert.equal(productionPreparation.migration.sha256, "b0a4cac2d9c30989f00570bf1c63036daf190fffbcc7b08b17c616761bc6a380");
  assert.equal(productionPreparation.migration.ordinary_selector_status, "EXCLUDED");
  assert.equal(productionPreparation.control_target.parent_plan_id, "a3072837-9f0b-4b0e-af15-2584a19980d7");
  assert.equal(productionPreparation.control_target.approval_id, "0a94d97d-7b0d-4f98-af57-04b029d445d6");
  assert.equal(productionPreparation.control_target.child_count, 19);
  assert.equal(productionPreparation.control_target.apply_runs, 0);
  assert.equal(productionPreparation.control_target.row_approvals, 0);
  assert.equal(productionPreparation.authorization.production_schema_write, false);
  assert.equal(productionPreparation.authorization.production_control_write, false);
  assert.equal(productionPreparation.authorization.business_write, false);
  assert.equal(productionPreparation.execution.migration_started, false);
  assert.equal(productionPreparation.execution.recovery_started, false);
  assert.equal(productionPreparation.execution.automatic_transition_between_phases, false);
  assert.deepEqual(productionPreparation.expected_result, {
    parent_status: "EXPIRED",
    expired_child_count: 19,
    approval_closed: true,
    business_writes: 0,
    price_history_writes: 0,
    control_writes: 21,
  });
});

test("RA-STAB-01 recovery coordinator is phase-separated and locally closed by default", async () => {
  const status = await recovery.run(["--phase=status"]);
  assert.equal(status.result, "PASS");
  assert.equal(status.status, "NOT_AUTHORIZED");
  assert.equal(status.writes, 0);
  assert.match(status.preparation_sha256, /^[0-9a-f]{64}$/);
  assert.match(status.confirmations.SCHEMA_DEPLOYMENT, /^[0-9a-f]{20}$/);
  assert.match(status.confirmations.CONTROL_RECOVERY, /^[0-9a-f]{20}$/);
  assert.notEqual(status.confirmations.SCHEMA_DEPLOYMENT, status.confirmations.CONTROL_RECOVERY);
  assert.throws(
    () => recovery.parseArgs(["--phase=schema-deploy"]),
    /requires authorization file and confirmation/,
  );
  assert.throws(
    () => recovery.parseArgs(["--phase=control-close", "--authorization-file=x", "--confirm=y", "--extra=z"]),
    /invalid argument/,
  );
  assert.throws(
    () => recovery.parseArgs(["--phase=schema-verify", "--confirm=x"]),
    /does not accept authorization/,
  );
});

test("RA-STAB-01 coordinator reuses existing boundaries and has no business-table writer", () => {
  assert.match(recoveryCoordinatorSource, /unwrapTransaction/);
  assert.match(recoveryCoordinatorSource, /close_expired_retailer_offer_sync_approval\(\$1::jsonb\)/);
  assert.match(recoveryCoordinatorSource, /schema-deploy/);
  assert.match(recoveryCoordinatorSource, /schema-verify/);
  assert.match(recoveryCoordinatorSource, /control-close/);
  assert.match(recoveryCoordinatorSource, /control-verify/);
  assert.doesNotMatch(recoveryCoordinatorSource, /\b(?:insert\s+into|update|delete\s+from)\s+public\.(?:retailers|products|product_variants|retailer_products|offers|price_history)\b/i);
  assert.doesNotMatch(recoveryCoordinatorSource, /(?:execute_retailer_offer_sync_batch|apply_approved_product_import_plan|recover_production_retailer_catalogue_child)\s*\(/i);
});

test("write authorization is exact, short-lived and fails before credential access", async () => {
  const status = await recovery.run(["--phase=status"]);
  const now = new Date("2026-09-29T16:00:00.000Z");
  const scope = recovery.authorizationScope(productionPreparation, "SCHEMA_DEPLOYMENT");
  const authorization = {
    schema_version: "ra-stab-01-phase-authorization-v1",
    status: "OWNER_AUTHORIZED",
    task_id: "RA-STAB-01",
    phase: "SCHEMA_DEPLOYMENT",
    preparation_sha256: status.preparation_sha256,
    target: productionPreparation.target,
    scope,
    scope_fingerprint: crypto.createHash("sha256").update(canonicalJson(scope)).digest("hex"),
    business_write: false,
    maximum_attempts: 1,
    automatic_retry: false,
    automatic_next_phase: false,
    authorized_by: "owner-test",
    authorized_at: now.toISOString(),
    expires_at: new Date(now.getTime() + 60 * 60 * 1000).toISOString(),
    confirmation: status.confirmations.SCHEMA_DEPLOYMENT,
  };
  const context = {
    phase: "schema-deploy",
    preparation: productionPreparation,
    preparationSha256: status.preparation_sha256,
  };
  assert.doesNotThrow(() => recovery.validateAuthorization(
    authorization,
    context,
    status.confirmations.SCHEMA_DEPLOYMENT,
    now,
  ));
  assert.throws(
    () => recovery.validateAuthorization({ ...authorization, business_write: true }, context, status.confirmations.SCHEMA_DEPLOYMENT, now),
    /forbid business writes/,
  );
  assert.throws(
    () => recovery.validateAuthorization({ ...authorization, automatic_next_phase: true }, context, status.confirmations.SCHEMA_DEPLOYMENT, now),
    /must not chain phases/,
  );

  const file = path.join(os.tmpdir(), `ra-stab-01-authorization-${process.pid}-${Date.now()}.json`);
  fs.writeFileSync(file, JSON.stringify(authorization));
  let credentialReads = 0;
  try {
    await assert.rejects(
      recovery.run([
        "--phase=schema-deploy",
        `--authorization-file=${file}`,
        "--confirm=wrong-confirmation",
      ], {
        credential: () => { credentialReads += 1; throw new Error("credential must not be read"); },
        now: () => now,
      }),
      /confirmation must equal/,
    );
  } finally {
    fs.unlinkSync(file);
  }
  assert.equal(credentialReads, 0);
});

test("authorized schema phase uses one transaction, one exact ledger insert and a committed postflight", async () => {
  const status = await recovery.run(["--phase=status"]);
  const now = new Date("2026-09-29T16:00:00.000Z");
  const scope = recovery.authorizationScope(productionPreparation, "SCHEMA_DEPLOYMENT");
  const authorization = {
    schema_version: "ra-stab-01-phase-authorization-v1",
    status: "OWNER_AUTHORIZED",
    task_id: "RA-STAB-01",
    phase: "SCHEMA_DEPLOYMENT",
    preparation_sha256: status.preparation_sha256,
    target: productionPreparation.target,
    scope,
    scope_fingerprint: crypto.createHash("sha256").update(canonicalJson(scope)).digest("hex"),
    business_write: false,
    maximum_attempts: 1,
    automatic_retry: false,
    automatic_next_phase: false,
    authorized_by: "owner-test",
    authorized_at: now.toISOString(),
    expires_at: new Date(now.getTime() + 60 * 60 * 1000).toISOString(),
    confirmation: status.confirmations.SCHEMA_DEPLOYMENT,
  };
  const source = path.resolve(__dirname, "../supabase/migrations");
  const excluded = new Set(Object.keys(CONTRACTS.PRODUCTION.excluded));
  for (const pending of CONTRACTS.PRODUCTION.pending) excluded.add(pending.filename);
  const ledger = fs.readdirSync(source)
    .filter(filename => /^\d{14}_[a-z0-9_]+\.sql$/.test(filename) && !excluded.has(filename))
    .sort()
    .map(filename => {
      const identifier = filename.slice(0, -4);
      const split = identifier.indexOf("_");
      return { version: identifier.slice(0, split), name: identifier.slice(split + 1) };
    });
  assert.equal(ledger.length, productionPreparation.fresh_readback.pre_migration_ledger_count);
  const queries = [];
  let inserted = false;
  const client = {
    async connect() {},
    async end() {},
    async query(sql, params) {
      queries.push({ sql, params });
      const normalized = sql.replace(/\s+/g, " ").trim().toLowerCase();
      if (normalized.startsWith("select current_user,current_database()")) {
        return { rows: [{ current_user: "postgres", current_database: "postgres", read_only: "off", safe_update: null }] };
      }
      if (normalized === "select public.retailer_catalogue_actual_database_target() target") {
        return { rows: [{ target: {
          target_environment: "PRODUCTION",
          project_ref: productionPreparation.target.project_ref,
          database_identity: productionPreparation.target.database_identity,
        } }] };
      }
      if (normalized.startsWith("select version,name from supabase_migrations.schema_migrations")) {
        return { rows: inserted ? [...ledger, { version: "20260929133000", name: "extend_expired_sequential_plan_close" }] : ledger };
      }
      if (normalized.startsWith("select (select count(*)::bigint from public.products)")) {
        return { rows: [productionPreparation.fresh_readback.business_counts] };
      }
      if (normalized.startsWith("insert into supabase_migrations.schema_migrations")) {
        assert.equal(inserted, false);
        assert.deepEqual(params.slice(0, 2), ["20260929133000", "extend_expired_sequential_plan_close"]);
        inserted = true;
        return { rows: [] };
      }
      return { rows: [] };
    },
  };
  const file = path.join(os.tmpdir(), `ra-stab-01-schema-authorization-${process.pid}-${Date.now()}.json`);
  fs.writeFileSync(file, JSON.stringify(authorization));
  try {
    const result = await recovery.run([
      "--phase=schema-deploy",
      `--authorization-file=${file}`,
      `--confirm=${status.confirmations.SCHEMA_DEPLOYMENT}`,
    ], {
      credential: kind => { assert.equal(kind, "owner"); return "mock-owner"; },
      createClient: () => client,
      now: () => now,
    });
    assert.deepEqual(result, { result: "PASS", phase: "SCHEMA_DEPLOYMENT", committed: true, ledger_count: 223 });
  } finally {
    fs.unlinkSync(file);
  }
  assert.equal(queries.filter(query => /^begin$/i.test(query.sql)).length, 1);
  assert.equal(queries.filter(query => /^commit$/i.test(query.sql)).length, 1);
  assert.equal(queries.filter(query => /^rollback$/i.test(query.sql)).length, 0);
  assert.equal(queries.filter(query => /^insert into supabase_migrations/i.test(query.sql)).length, 1);
  assert.equal(inserted, true);
});

test("authorized control phase uses only the approver RPC and proves an independent zero-business-write postflight", async () => {
  const status = await recovery.run(["--phase=status"]);
  const now = new Date("2026-09-29T16:00:00.000Z");
  const scope = recovery.authorizationScope(productionPreparation, "CONTROL_RECOVERY");
  const authorization = {
    schema_version: "ra-stab-01-phase-authorization-v1",
    status: "OWNER_AUTHORIZED",
    task_id: "RA-STAB-01",
    phase: "CONTROL_RECOVERY",
    preparation_sha256: status.preparation_sha256,
    target: productionPreparation.target,
    scope,
    scope_fingerprint: crypto.createHash("sha256").update(canonicalJson(scope)).digest("hex"),
    business_write: false,
    maximum_attempts: 1,
    automatic_retry: false,
    automatic_next_phase: false,
    authorized_by: "owner-test",
    authorized_at: now.toISOString(),
    expires_at: new Date(now.getTime() + 60 * 60 * 1000).toISOString(),
    confirmation: status.confirmations.CONTROL_RECOVERY,
  };
  const source = path.resolve(__dirname, "../supabase/migrations");
  const excluded = new Set(Object.keys(CONTRACTS.PRODUCTION.excluded));
  for (const pending of CONTRACTS.PRODUCTION.pending) excluded.add(pending.filename);
  excluded.delete(productionPreparation.migration.filename);
  const postLedger = fs.readdirSync(source)
    .filter(filename => /^\d{14}_[a-z0-9_]+\.sql$/.test(filename) && !excluded.has(filename))
    .sort()
    .map(filename => {
      const identifier = filename.slice(0, -4);
      const split = identifier.indexOf("_");
      return { version: identifier.slice(0, split), name: identifier.slice(split + 1) };
    });
  assert.equal(postLedger.length, productionPreparation.fresh_readback.post_migration_ledger_count);
  let closed = false;
  const queries = [];
  const target = productionPreparation.control_target;
  function ownerClient() {
    return {
      async connect() {},
      async end() {},
      async query(sql) {
        queries.push(sql);
        const normalized = sql.replace(/\s+/g, " ").trim().toLowerCase();
        if (normalized.startsWith("select current_user,current_database()")) {
          return { rows: [{ current_user: "postgres", current_database: "postgres", read_only: "on", safe_update: null }] };
        }
        if (normalized === "select public.retailer_catalogue_actual_database_target() target") {
          return { rows: [{ target: {
            target_environment: "PRODUCTION",
            project_ref: productionPreparation.target.project_ref,
            database_identity: productionPreparation.target.database_identity,
          } }] };
        }
        if (normalized.startsWith("select version,name from supabase_migrations.schema_migrations")) return { rows: postLedger };
        if (normalized.startsWith("select (select count(*)::bigint from public.products)")) return { rows: [productionPreparation.fresh_readback.business_counts] };
        if (normalized.startsWith("select p.id::text parent_plan_id")) {
          return { rows: [{
            parent_plan_id: target.parent_plan_id,
            parent_plan_fingerprint: target.parent_plan_fingerprint,
            retailer_id: target.retailer_id,
            parent_status: closed ? "EXPIRED" : "APPROVED",
            child_manifest_fingerprint: target.child_manifest_fingerprint,
            child_plan_id: target.approved_child_id,
            child_plan_fingerprint: target.approved_child_fingerprint,
            child_status: closed ? "EXPIRED" : "APPROVED",
            approval_id: target.approval_id,
            artifact_fingerprint: target.approved_child_fingerprint,
            execution_fingerprint: target.execution_fingerprint,
            expected_migration_fingerprint: target.approval_expected_migration_fingerprint,
            closed_at: closed ? now.toISOString() : null,
            consumed_at: null,
            child_count: target.child_count,
            approved_child_count: closed ? 0 : target.approved_child_count,
            planned_child_count: closed ? 0 : target.planned_child_count,
            expired_child_count: closed ? target.child_count : 0,
            apply_runs: 0,
            row_approvals: 0,
            batch_approvals: target.batch_approvals,
            recovery_manifests: 0,
            recovery_approvals: 0,
            recovery_audit: 0,
          }] };
        }
        return { rows: [] };
      },
    };
  }
  const approverClient = {
    async connect() {},
    async end() {},
    async query(sql, params) {
      queries.push(sql);
      if (sql === "select current_user,session_user") {
        return { rows: [{ current_user: "retailer_catalogue_production_approver", session_user: "supplementscout_production_approver_login" }] };
      }
      if (sql === "select public.close_expired_retailer_offer_sync_approval($1::jsonb) result") {
        assert.equal(params[0].parent_plan_id, target.parent_plan_id);
        assert.equal(params[0].request_fingerprint, crypto.createHash("sha256").update(canonicalJson({ ...params[0], request_fingerprint: null })).digest("hex"));
        closed = true;
        return { rows: [{ result: {
          status: "EXPIRED",
          already_closed: false,
          expired_child_count: 19,
          control_writes: 21,
          business_writes: 0,
          price_history_writes: 0,
        } }] };
      }
      return { rows: [] };
    },
  };
  const credentialKinds = [];
  const file = path.join(os.tmpdir(), `ra-stab-01-control-authorization-${process.pid}-${Date.now()}.json`);
  fs.writeFileSync(file, JSON.stringify(authorization));
  try {
    const result = await recovery.run([
      "--phase=control-close",
      `--authorization-file=${file}`,
      `--confirm=${status.confirmations.CONTROL_RECOVERY}`,
    ], {
      credential: kind => { credentialKinds.push(kind); return `mock-${kind}`; },
      createClient: (_connection, applicationName) => applicationName === "ra-stab-01-control-close" ? approverClient : ownerClient(),
      now: () => now,
    });
    assert.equal(result.result, "PASS");
    assert.equal(result.phase, "CONTROL_RECOVERY");
    assert.deepEqual(result.postflight, { writes: 0, expired_child_count: 19 });
  } finally {
    fs.unlinkSync(file);
  }
  assert.deepEqual(credentialKinds, ["owner", "approver", "owner"]);
  assert.equal(queries.filter(sql => sql === "select public.close_expired_retailer_offer_sync_approval($1::jsonb) result").length, 1);
  assert.equal(queries.some(sql => /(?:execute_retailer_offer_sync_batch|apply_approved_product_import_plan)\s*\(/i.test(sql)), false);
});

test("control close request binds the exact post-migration ledger and remains business-write-free", () => {
  const readback = {
    state: {
      remoteLedger: [
        { version: "20260719100000", name: "add_production_retailer_sync_enablement" },
        { version: "20260929133000", name: "extend_expired_sequential_plan_close" },
      ],
    },
  };
  const request = recovery.closeRequest(readback, productionPreparation, new Date("2026-09-29T16:00:00.000Z"));
  assert.equal(request.approval_id, productionPreparation.control_target.approval_id);
  assert.equal(request.parent_plan_id, productionPreparation.control_target.parent_plan_id);
  assert.equal(request.child_plan_id, productionPreparation.control_target.approved_child_id);
  assert.deepEqual(request.expected_migration_versions, [
    "20260719100000_add_production_retailer_sync_enablement",
    "20260929133000_extend_expired_sequential_plan_close",
  ]);
  assert.equal(request.expected_migration_fingerprint, productionPreparation.fresh_readback.post_migration_ledger_fingerprint);
  assert.equal(request.approval_expected_migration_fingerprint, productionPreparation.fresh_readback.pre_migration_ledger_fingerprint);
  assert.equal(request.request_fingerprint, crypto.createHash("sha256").update(canonicalJson({ ...request, request_fingerprint: null })).digest("hex"));
  assert.equal("explicit_allow" in request, false);
});
