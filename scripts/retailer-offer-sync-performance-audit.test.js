const assert = require("node:assert/strict");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const test = require("node:test");
const {
  SIGNATURES,
  buildFindings,
  parseArgs,
  runAudit,
  summarizeFunction,
} = require("./retailer-offer-sync-performance-audit");

const EXECUTOR = `create function public.retailer_offer_sync_execute_batch_internal(p_request jsonb)
returns jsonb language plpgsql as $$
begin
  for v_row in select value from jsonb_array_elements('{}'::jsonb) loop
    perform public.validate_product_import_plan_read_only('{}'::jsonb);
  end loop;
  perform public.retailer_catalogue_business_counts();
  perform public.retailer_catalogue_other_retailer_fingerprint(3);
  perform public.retailer_catalogue_protected_shared_fingerprint();
  for v_row in select value from jsonb_array_elements('{}'::jsonb) loop
    perform public.approve_product_import_plan('{}'::jsonb,'a','b','c',now());
    perform public.apply_approved_product_import_plan(null,'a','b','c',3,'d','e');
  end loop;
  perform public.retailer_offer_sync_row_state(1);
  perform public.retailer_offer_sync_row_state(1);
  perform public.retailer_offer_sync_row_state(1);
  perform public.retailer_catalogue_business_counts();
  perform public.retailer_catalogue_other_retailer_fingerprint(3);
  perform public.retailer_catalogue_protected_shared_fingerprint();
end $$`;

test("shared audit identifies repeated work without claiming unavailable timing", () => {
  const executorChain = [
    summarizeFunction({ signature: SIGNATURES[1], found: true, language: "plpgsql", volatility: "VOLATILE", definition: "create function wrapper() returns jsonb language sql as $$ select '{}'::jsonb $$" }),
    summarizeFunction({ signature: SIGNATURES[2], found: true, language: "plpgsql", volatility: "VOLATILE", definition: "create function compatibility() returns jsonb language sql as $$ select '{}'::jsonb $$" }),
    summarizeFunction({ signature: SIGNATURES[3], found: true, language: "plpgsql", volatility: "VOLATILE", definition: EXECUTOR }),
  ];
  const findings = buildFindings(
    executorChain,
    { track_functions: "none" },
    ["offers", "retailer_products", "approved_import_plans"].map((table_name) => ({ table_name, is_primary: true })),
  );
  assert.deepEqual(findings.map((finding) => [finding.code, finding.proven]), [
    ["PER_ROW_APPROVE_APPLY", true],
    ["REPEATED_ROW_STATE_READS", true],
    ["REPEATED_GLOBAL_SNAPSHOT_CHECKS", true],
    ["FUNCTION_TIMING_VISIBILITY", false],
    ["PRIMARY_LOOKUP_INDEX_COVERAGE", true],
  ]);
  assert.equal(executorChain[2].definition_sha256.length, 64);
});

test("audit uses the shared protected read-only role session and emits zero-write evidence", async () => {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), "retailer-performance-audit-"));
  const output = path.join(directory, "report.json");
  let options;
  const functions = SIGNATURES.map((signature) => ({
    signature,
    found: true,
    language: "plpgsql",
    volatility: "VOLATILE",
    definition: signature === SIGNATURES[1] ? EXECUTOR : `create function ${signature} returns jsonb language sql as $$ select '{}'::jsonb $$`,
  }));
  const fakeClient = {
    calls: 0,
    async query(...args) {
      const parameters = args[1] || [];
      this.calls += 1;
      if (this.calls === 1) return { rows: [{ database_name: "postgres", transaction_read_only: "on", track_functions: "none", server_version: "17" }] };
      assert.equal(parameters.length, 1);
      assert.ok(Array.isArray(parameters[0]));
      if (this.calls === 2) return { rows: functions };
      if (this.calls === 3) return { rows: [] };
      if (this.calls === 4) return { rows: [
        { table_name: "offers", index_name: "offers_pkey", index_definition: "CREATE UNIQUE INDEX offers_pkey ON offers(id)", is_primary: true },
        { table_name: "retailer_products", index_name: "retailer_products_pkey", index_definition: "CREATE UNIQUE INDEX retailer_products_pkey ON retailer_products(id)", is_primary: true },
        { table_name: "approved_import_plans", index_name: "approved_import_plans_pkey", index_definition: "CREATE UNIQUE INDEX approved_import_plans_pkey ON approved_import_plans(id)", is_primary: true },
      ] };
      return { rows: [] };
    },
  };
  const report = await runAudit(
    {
      env: { RETAILER_SYNC_PERFORMANCE_AUDIT_DATABASE_URL: "postgresql://audit@db.example.test/postgres" },
      output,
    },
    {
      withPostgresRoleSession: async (received, callback) => {
        options = received;
        return {
          identity: { session_user: "supplementscout_production_validator_login", current_user: "retailer_catalogue_production_validator", transaction_read_only: "on" },
          result: await callback(fakeClient),
        };
      },
    },
  );
  assert.equal(options.defaultReadOnly, true);
  assert.equal(options.readOnly, true);
  assert.equal(options.role, "retailer_catalogue_production_validator");
  assert.equal(options.expectedSessionUser, "supplementscout_production_validator_login");
  assert.equal(options.localSettings, undefined);
  assert.equal(report.database_writes, 0);
  assert.equal(report.retry_calls, 0);
  assert.equal(report.replay_calls, 0);
  assert.equal(report.observed_run.apply_duration_seconds, 766);
  assert.deepEqual(JSON.parse(fs.readFileSync(output, "utf8")), report);
});

test("audit CLI remains bounded", () => {
  assert.deepEqual(parseArgs([]), { output: path.resolve(__dirname, "../tmp/retailer-offer-sync-performance-audit/report.json") });
  assert.equal(parseArgs(["--output=tmp/a.json"]).output, "tmp/a.json");
  assert.throws(() => parseArgs(["--output=a", "extra"]), /Only --output/);
});

test("manual workflow is shared, read-only and cannot receive writer credentials", () => {
  const workflow = fs.readFileSync(path.resolve(__dirname, "../.github/workflows/retailer-offer-sync-performance-audit.yml"), "utf8");
  assert.match(workflow, /workflow_dispatch:/);
  assert.match(workflow, /environment: production-readonly/);
  assert.match(workflow, /RETAILER_SYNC_PERFORMANCE_AUDIT_DATABASE_URL: \$\{\{ secrets\.JONS_SYNC_VALIDATOR_DATABASE_URL \}\}/);
  assert.doesNotMatch(workflow, /APPROVER_DATABASE_URL|EXECUTOR_DATABASE_URL|SUPABASE_SERVICE_ROLE_KEY/);
  assert.doesNotMatch(workflow, /schedule:/);
});
