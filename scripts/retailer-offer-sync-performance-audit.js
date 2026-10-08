const crypto = require("node:crypto");
const fs = require("node:fs");
const path = require("node:path");
const { Client } = require("pg");
const {
  normalizeConnectionString,
  withPostgresRoleSession,
} = require("./lib/retailer-offer-sync/production-role-session");

const VALIDATOR_LOGIN = "supplementscout_production_validator_login";
const VALIDATOR_ROLE = "retailer_catalogue_production_validator";
const DEFAULT_OUTPUT = path.resolve(
  __dirname,
  "../tmp/retailer-offer-sync-performance-audit/report.json",
);
const SIGNATURES = Object.freeze([
  "public.execute_retailer_offer_sync_batch(jsonb)",
  "public.retailer_offer_sync_execute_batch_internal(jsonb)",
  "public.retailer_offer_sync_execute_before_reviewed_mixed(jsonb)",
  "public.retailer_offer_sync_execute_batch_unreviewed_internal(jsonb)",
  "public.retailer_offer_sync_validate_manifest(jsonb)",
  "public.validate_product_import_plan_read_only(jsonb)",
  "public.approve_product_import_plan(jsonb,text,text,text,timestamp with time zone)",
  "public.apply_approved_product_import_plan(uuid,text,text,text,bigint,text,text)",
  "public.retailer_offer_sync_row_state(bigint)",
  "public.retailer_catalogue_business_counts()",
  "public.retailer_catalogue_other_retailer_fingerprint(bigint)",
  "public.retailer_catalogue_protected_shared_fingerprint()",
]);

function invariant(condition, message) {
  if (!condition) throw new Error(message);
}

function sha256(value) {
  return crypto.createHash("sha256").update(value).digest("hex");
}

function occurrences(source, expression) {
  return [...source.matchAll(expression)].length;
}

function summarizeFunction(row) {
  const definition = String(row.definition || "");
  return {
    signature: row.signature,
    found: Boolean(row.found),
    language: row.language || null,
    volatility: row.volatility || null,
    definition_sha256: definition ? sha256(definition) : null,
    source_length: definition.length,
    json_row_loops: occurrences(definition, /for\s+\w+\s+in\s+select\s+value\s+from\s+jsonb_array_elements/gi),
    validate_plan_calls: occurrences(definition, /public\.validate_product_import_plan_read_only\s*\(/gi),
    approve_plan_calls: occurrences(definition, /public\.approve_product_import_plan\s*\(/gi),
    apply_plan_calls: occurrences(definition, /public\.apply_approved_product_import_plan\s*\(/gi),
    row_state_calls: occurrences(definition, /public\.retailer_offer_sync_row_state\s*\(/gi),
    business_count_calls: occurrences(definition, /public\.retailer_catalogue_business_counts\s*\(/gi),
    other_retailer_fingerprint_calls: occurrences(definition, /public\.retailer_catalogue_other_retailer_fingerprint\s*\(/gi),
    protected_fingerprint_calls: occurrences(definition, /public\.retailer_catalogue_protected_shared_fingerprint\s*\(/gi),
    global_execution_lock_calls: occurrences(definition, /retailer-offer-sync:global-execution/gi),
  };
}

function buildFindings(functions, settings, indexes) {
  const executorChain = functions.filter((row) =>
    /retailer_offer_sync_execute_(?:batch_internal|before_reviewed_mixed|batch_unreviewed_internal)/.test(row.signature),
  );
  invariant(executorChain.length === 3 && executorChain.every((row) => row.found), "Current shared executor chain is unavailable");
  const total = (field) => executorChain.reduce((sum, row) => sum + row[field], 0);
  const chainEvidence = {
    function_signatures: executorChain.map((row) => row.signature),
    json_row_loops: total("json_row_loops"),
    validate_plan_calls: total("validate_plan_calls"),
    approve_plan_calls: total("approve_plan_calls"),
    apply_plan_calls: total("apply_plan_calls"),
    row_state_calls: total("row_state_calls"),
    business_count_calls: total("business_count_calls"),
    other_retailer_fingerprint_calls: total("other_retailer_fingerprint_calls"),
    protected_fingerprint_calls: total("protected_fingerprint_calls"),
  };
  return [
    {
      code: "PER_ROW_APPROVE_APPLY",
      proven: chainEvidence.approve_plan_calls > 0 && chainEvidence.apply_plan_calls > 0 && chainEvidence.json_row_loops >= 2,
      evidence: chainEvidence,
    },
    {
      code: "REPEATED_ROW_STATE_READS",
      proven: chainEvidence.row_state_calls > 2,
      evidence: chainEvidence,
    },
    {
      code: "REPEATED_GLOBAL_SNAPSHOT_CHECKS",
      proven:
        chainEvidence.business_count_calls >= 2 ||
        chainEvidence.other_retailer_fingerprint_calls >= 2 ||
        chainEvidence.protected_fingerprint_calls >= 2,
      evidence: chainEvidence,
    },
    {
      code: "FUNCTION_TIMING_VISIBILITY",
      proven: settings.track_functions !== "none",
      evidence: { track_functions: settings.track_functions },
    },
    {
      code: "PRIMARY_LOOKUP_INDEX_COVERAGE",
      proven: ["offers", "retailer_products", "approved_import_plans"].every((table) =>
        indexes.some((index) => index.table_name === table && index.is_primary),
      ),
      evidence: {
        primary_index_tables: indexes
          .filter((index) => index.is_primary)
          .map((index) => index.table_name)
          .sort(),
      },
    },
  ];
}

async function collect(client) {
  const identity = (
    await client.query(
      `select current_database() database_name,
              current_setting('transaction_read_only') transaction_read_only,
              current_setting('track_functions') track_functions,
              current_setting('server_version') server_version`,
    )
  ).rows[0];
  invariant(identity.transaction_read_only === "on", "Performance audit transaction is writable");

  const functions = (
    await client.query(
      `select requested.signature,
              p.oid is not null found,
              l.lanname language,
              case p.provolatile when 'i' then 'IMMUTABLE' when 's' then 'STABLE' when 'v' then 'VOLATILE' end volatility,
              case when p.oid is null then null else pg_get_functiondef(p.oid) end definition
         from unnest($1::text[]) with ordinality requested(signature, ordinal)
         left join pg_proc p on p.oid = to_regprocedure(requested.signature)
         left join pg_language l on l.oid = p.prolang
        order by requested.ordinal`,
      [SIGNATURES],
    )
  ).rows.map(summarizeFunction);
  invariant(functions.every((row) => row.found), "One or more shared executor dependencies are missing");

  const functionStats = (
    await client.query(
      `select funcid::regprocedure::text signature,
              calls::bigint calls,
              round(total_time::numeric,3)::text total_time_ms,
              round(self_time::numeric,3)::text self_time_ms
         from pg_stat_user_functions
        where schemaname = 'public'
          and funcname = any($1::text[])
        order by funcname`,
      [[
        "execute_retailer_offer_sync_batch",
        "retailer_offer_sync_execute_batch_internal",
        "retailer_offer_sync_execute_before_reviewed_mixed",
        "retailer_offer_sync_execute_batch_unreviewed_internal",
        "retailer_offer_sync_validate_manifest",
        "validate_product_import_plan_read_only",
        "approve_product_import_plan",
        "apply_approved_product_import_plan",
        "retailer_offer_sync_row_state",
        "retailer_catalogue_business_counts",
        "retailer_catalogue_other_retailer_fingerprint",
        "retailer_catalogue_protected_shared_fingerprint",
      ]],
    )
  ).rows;

  const indexes = (
    await client.query(
      `select tablename table_name,
              indexname index_name,
              indexdef index_definition,
              indexname like '%_pkey' is_primary
         from pg_indexes
        where schemaname = 'public'
          and tablename = any($1::text[])
        order by tablename,indexname`,
      [[
        "offers",
        "retailer_products",
        "approved_import_plans",
        "retailer_offer_sync_batch_approvals",
        "retailer_catalogue_parent_plans",
        "retailer_catalogue_child_plans",
        "retailer_catalogue_apply_runs",
        "price_history",
      ]],
    )
  ).rows;

  const relations = (
    await client.query(
      `select relname table_name,
              n_live_tup::bigint estimated_live_rows,
              seq_scan::bigint sequential_scans,
              idx_scan::bigint index_scans
         from pg_stat_user_tables
        where schemaname = 'public'
          and relname = any($1::text[])
        order by relname`,
      [["offers", "retailer_products", "approved_import_plans", "price_history"]],
    )
  ).rows;

  const settings = {
    database_name: identity.database_name,
    server_version: identity.server_version,
    transaction_read_only: identity.transaction_read_only,
    track_functions: identity.track_functions,
  };
  return {
    settings,
    functions,
    function_stats: functionStats,
    indexes,
    relation_stats: relations,
    findings: buildFindings(functions, settings, indexes),
  };
}

async function runAudit(options = {}, dependencies = {}) {
  const env = options.env || process.env;
  const output = path.resolve(options.output || DEFAULT_OUTPUT);
  const sessionRunner = dependencies.withPostgresRoleSession || withPostgresRoleSession;
  const session = await sessionRunner(
    {
      connectionString: normalizeConnectionString(
        env.RETAILER_SYNC_PERFORMANCE_AUDIT_DATABASE_URL,
        "performance audit validator",
      ),
      applicationName: "retailer-offer-sync-performance-audit",
      ClientClass: dependencies.Client || Client,
      defaultReadOnly: true,
      readOnly: true,
      role: VALIDATOR_ROLE,
      expectedSessionUser: VALIDATOR_LOGIN,
      kind: "performance audit validator",
    },
    collect,
  );
  const report = {
    schema_version: 1,
    kind: "shared-retailer-offer-sync-performance-audit",
    captured_at: new Date().toISOString(),
    result: "PASS",
    access: {
      session_user: session.identity.session_user,
      current_user: session.identity.current_user,
      transaction_read_only: session.identity.transaction_read_only,
    },
    observed_run: {
      workflow_run_id: "37826090676",
      retailer: "Whey Okay",
      safe_rows: 579,
      child_count: 12,
      apply_duration_seconds: 766,
      retry_count: 0,
      replay_count: 0,
    },
    ...session.result,
    database_writes: 0,
    retry_calls: 0,
    replay_calls: 0,
  };
  fs.mkdirSync(path.dirname(output), { recursive: true });
  fs.writeFileSync(output, `${JSON.stringify(report, null, 2)}\n`, { flag: "wx" });
  return report;
}

function parseArgs(argv) {
  const outputArg = argv.find((value) => value.startsWith("--output="));
  invariant(argv.length === (outputArg ? 1 : 0), "Only --output is supported");
  return { output: outputArg ? outputArg.slice("--output=".length) : DEFAULT_OUTPUT };
}

if (require.main === module) {
  runAudit(parseArgs(process.argv.slice(2))).then((report) => {
    process.stdout.write(`${JSON.stringify({
      result: report.result,
      findings: report.findings,
      database_writes: report.database_writes,
    })}\n`);
  }).catch((error) => {
    console.error(`Shared retailer performance audit failed: ${error.message}`);
    process.exitCode = 1;
  });
}

module.exports = { SIGNATURES, buildFindings, collect, parseArgs, runAudit, summarizeFunction };
