const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const { spawnSync } = require("node:child_process");
const { Client } = require("pg");
const {
  normalizeConnectionString,
  withPostgresRoleSession,
} = require("./lib/retailer-offer-sync/production-role-session");

const ROOT = path.resolve(__dirname, "..");
const CONFIG_PATH = path.join(
  ROOT,
  "config/automation-reliability-watchdog.json",
);
const VALIDATOR_LOGIN = "supplementscout_production_validator_login";
const VALIDATOR_ROLE = "retailer_catalogue_production_validator";

function invariant(condition, message) {
  if (!condition) throw new Error(message);
}

function loadConfig(file = CONFIG_PATH) {
  const config = JSON.parse(fs.readFileSync(file, "utf8"));
  invariant(config.schema_version === 1, "Unsupported watchdog config");
  invariant(
    config.maximum_success_age_hours === 48,
    "Watchdog success age must remain 48 hours",
  );
  invariant(config.retailers.length === 11, "Watchdog must cover 11 retailers");
  invariant(
    new Set(config.retailers.map((row) => String(row.id))).size === 11,
    "Watchdog retailer IDs must be unique",
  );
  return config;
}

function parseArgs(argv) {
  invariant(argv.length === 1, "Watchdog requires one --output argument");
  const match = argv[0].match(/^--output=(.+)$/);
  invariant(match, "Watchdog requires --output");
  const output = path.resolve(match[1]);
  const relative = path.relative(path.join(ROOT, "tmp"), output);
  invariant(
    relative && !relative.startsWith("..") && !path.isAbsolute(relative),
    "Watchdog output must stay inside repository tmp",
  );
  return { output };
}

function hoursSince(value, now) {
  if (!value) return null;
  const milliseconds = now.getTime() - Date.parse(value);
  return Number.isFinite(milliseconds)
    ? Math.max(0, milliseconds / 3_600_000)
    : null;
}

function findContractEvidence(value) {
  if (!value || typeof value !== "object") return null;
  if (
    Number.isInteger(value.approved_mapping_count) &&
    Number.isInteger(value.executable_plan_count) &&
    Number.isInteger(value.executed_plan_count) &&
    Number.isInteger(value.review_row_count) &&
    Number.isInteger(value.blocked_row_count)
  ) {
    return {
      approved_mapping_count: value.approved_mapping_count,
      executable_plan_count: value.executable_plan_count,
      executed_plan_count: value.executed_plan_count,
      review_row_count: value.review_row_count,
      blocked_row_count: value.blocked_row_count,
      result: value.result || null,
      execution_offer_ids: Array.isArray(value.execution_offer_ids) ? value.execution_offer_ids.map(String).sort() : null,
      review_offer_ids: Array.isArray(value.review_rows) ? value.review_rows.map((row) => String(row.offer_id)).sort() : null,
      expected_deltas: value.expected_deltas || null,
      commit_sha: value.commit_sha || null,
      manifest_sha256: value.approved_manifest_sha256 || value.manifest_sha256 || null,
      plan_fingerprint: value.plan_fingerprint || null,
      postflight_hash: value.postflight_hash || null,
      source_fingerprint: value.source_fingerprint || null,
      full_capture_fingerprint: value.full_capture_fingerprint || null,
      executable_source_fingerprint: value.executable_source_fingerprint || null,
      review_scope_fingerprint: value.review_scope_fingerprint || null,
      idempotency_result: value.idempotency_result || null,
      database_writes: Number.isInteger(value.database_writes) ? value.database_writes : null,
    };
  }
  for (const child of Array.isArray(value) ? value : Object.values(value)) {
    const found = findContractEvidence(child);
    if (found) return found;
  }
  return null;
}

function correlateEvidence(stages, contract) {
  if (!stages?.apply || !stages?.db_postflight) return { result: "INCOMPLETE_CORE", failures: [] };
  const failures = [];
  if (!stages.apply.run_id || stages.apply.run_id !== stages.db_postflight.run_id || !stages.apply.head_sha || stages.apply.head_sha !== stages.db_postflight.head_sha) failures.push("APPLY_POSTFLIGHT_CORRELATION_MISMATCH");
  if (stages.capture && stages.capture.run_id !== stages.apply.run_id) {
    if (!stages.capture.head_sha || stages.capture.head_sha !== stages.apply.head_sha) failures.push("INDEPENDENT_IDEMPOTENCY_COMMIT_MISMATCH");
    for (const field of ["execution_offer_ids", "expected_deltas", "manifest_sha256", "plan_fingerprint", "postflight_hash"]) if (!contract?.[field]) failures.push(`INDEPENDENT_IDEMPOTENCY_${field.toUpperCase()}_MISSING`);
  }
  return { result: failures.length ? "UNRELATED_EVIDENCE" : "CORRELATED", failures };
}

function evaluateRetailer({ profile, stages, contract, database }, now, maximumAge) {
  const failures = [];
  if (!profile.workflow) failures.push("AUTOMATION_WORKFLOW_MISSING");
  for (const stage of ["capture", "apply", "db_postflight"]) {
    const evidence = stages[stage];
    const age = hoursSince(evidence?.completed_at, now);
    if (!evidence) failures.push(`${stage.toUpperCase()}_SUCCESS_MISSING`);
    else if (age === null || age > maximumAge) {
      failures.push(`${stage.toUpperCase()}_SUCCESS_OLDER_THAN_48H`);
    }
  }
  if (!contract) failures.push("EXECUTION_CONTRACT_EVIDENCE_MISSING");
  else {
    if (contract.executed_plan_count !== contract.executable_plan_count) {
      failures.push("EXECUTED_PLAN_COUNT_MISMATCH");
    }
    if (
      contract.executable_plan_count + contract.review_row_count !==
      contract.approved_mapping_count
    ) {
      failures.push("APPROVED_SCOPE_PARTITION_MISMATCH");
    }
    if (contract.blocked_row_count !== 0) failures.push("BLOCKED_ROWS_PRESENT");
    if (String(profile.id) === "12") {
      for (const field of ["execution_offer_ids", "expected_deltas", "commit_sha", "manifest_sha256", "full_capture_fingerprint", "executable_source_fingerprint", "review_scope_fingerprint", "plan_fingerprint", "postflight_hash"]) if (!contract[field]) failures.push(`EBAY_${field.toUpperCase()}_MISSING`);
      if (contract.idempotency_result !== "PASS") failures.push("EBAY_IDEMPOTENCY_NOT_PASSED");
      if (contract.database_writes !== contract.executed_plan_count) failures.push("EBAY_DATABASE_WRITE_COUNT_MISMATCH");
    }
  }
  const correlation = correlateEvidence(stages, contract);
  failures.push(...correlation.failures);
  if (!database) failures.push("DATABASE_FRESHNESS_EVIDENCE_MISSING");
  else if (Number(database.offers_older_than_48h) !== 0) {
    const older = (database.older_offer_ids || []).map(String).sort();
    const review = (contract?.review_offer_ids || []).map(String).sort();
    if (!older.length || older.some((id) => !review.includes(id))) failures.push("DATABASE_OFFERS_OLDER_THAN_48H");
  }
  return {
    retailer_id: String(profile.id),
    retailer: profile.name,
    workflow: profile.workflow,
    result: failures.length ? "FAIL" : "PASS",
    failures,
    stages,
    contract,
    database,
    evidence_correlation: correlation.result,
  };
}

async function githubJson(url, token) {
  const response = await fetch(url, {
    headers: {
      accept: "application/vnd.github+json",
      authorization: `Bearer ${token}`,
      "x-github-api-version": "2022-11-28",
      "user-agent": "SupplementScout-Automation-Reliability-Watchdog/1.0",
    },
  });
  invariant(response.ok, `GitHub API ${response.status} for ${url}`);
  return response.json();
}

async function runStages(profile, repository, token) {
  const stages = { capture: null, apply: null, db_postflight: null };
  if (!profile.workflow) return { stages, applyRunId: null };
  const base = `https://api.github.com/repos/${repository}`;
  const workflow = encodeURIComponent(profile.workflow);
  const listing = await githubJson(
    `${base}/actions/workflows/${workflow}/runs?status=completed&per_page=10`,
    token,
  );
  let applyRunId = null;
  for (const run of listing.workflow_runs || []) {
    const jobs = await githubJson(
      `${base}/actions/runs/${run.id}/jobs?per_page=100`,
      token,
    );
    const steps = (jobs.jobs || []).flatMap((job) => job.steps || []);
    for (const [stage, stepName] of [
      ["capture", profile.capture_step],
      ["apply", profile.apply_step],
      ["db_postflight", profile.db_postflight_step],
    ]) {
      if (!stepName || stages[stage]) continue;
      const step = steps.find(
        (candidate) =>
          candidate.name === stepName && candidate.conclusion === "success",
      );
      if (step) {
        stages[stage] = {
          run_id: String(run.id),
          run_url: run.html_url,
          completed_at: step.completed_at || run.updated_at,
          head_sha: run.head_sha || null,
        };
        if (stage === "apply" && applyRunId === null) applyRunId = run.id;
      }
    }
    if (Object.values(stages).every(Boolean)) break;
  }
  return { stages, applyRunId };
}

async function contractFromArtifacts(repository, runId, token) {
  if (!runId) return null;
  const base = `https://api.github.com/repos/${repository}`;
  const listing = await githubJson(
    `${base}/actions/runs/${runId}/artifacts?per_page=100`,
    token,
  );
  const directory = fs.mkdtempSync(
    path.join(os.tmpdir(), "supplementscout-watchdog-"),
  );
  try {
    const candidates = [];
    for (const artifact of listing.artifacts || []) {
      if (artifact.expired) continue;
      const response = await fetch(artifact.archive_download_url, {
        headers: {
          accept: "application/vnd.github+json",
          authorization: `Bearer ${token}`,
          "x-github-api-version": "2022-11-28",
          "user-agent": "SupplementScout-Automation-Reliability-Watchdog/1.0",
        },
      });
      invariant(response.ok, `GitHub artifact download ${response.status}`);
      const zipPath = path.join(directory, `${artifact.id}.zip`);
      fs.writeFileSync(zipPath, Buffer.from(await response.arrayBuffer()));
      const names = spawnSync("unzip", ["-Z1", zipPath], {
        encoding: "utf8",
      });
      invariant(names.status === 0, "Unable to list watchdog artifact ZIP");
      for (const name of names.stdout.split(/\r?\n/).filter(Boolean)) {
        if (!name.endsWith(".json")) continue;
        const extracted = spawnSync("unzip", ["-p", zipPath, name], {
          encoding: "utf8",
          maxBuffer: 20 * 1024 * 1024,
        });
        if (extracted.status !== 0) continue;
        try {
          const found = findContractEvidence(JSON.parse(extracted.stdout));
          if (found && found.executed_plan_count > 0) candidates.push(found);
        } catch {}
      }
    }
    return candidates.sort((left, right) => {
      const score = (value) => ["execution_offer_ids","expected_deltas","commit_sha","manifest_sha256","source_fingerprint","plan_fingerprint","postflight_hash","idempotency_result","database_writes"].filter((field) => value[field] !== null && value[field] !== undefined).length;
      return score(right) - score(left);
    })[0] || null;
  } finally {
    fs.rmSync(directory, { recursive: true, force: true });
  }
}

async function databaseEvidence(config, env, dependencies = {}) {
  const session = await withPostgresRoleSession(
    {
      connectionString: normalizeConnectionString(
        env.AUTOMATION_WATCHDOG_VALIDATOR_DATABASE_URL,
        "validator",
      ),
      applicationName: "automation-reliability-watchdog",
      ClientClass: dependencies.Client || Client,
      defaultReadOnly: true,
      readOnly: true,
      role: VALIDATOR_ROLE,
      expectedSessionUser: VALIDATOR_LOGIN,
      kind: "validator",
    },
    async (client) => {
      const ids = config.retailers.map((row) => String(row.id));
      const result = await client.query(
        `select retailer_id::text,
                count(*)::integer offer_count,
                min(last_checked_at) oldest_check,
                max(last_checked_at) newest_check,
                count(*) filter (
                  where last_checked_at is null
                     or last_checked_at <= now() - interval '48 hours'
                )::integer offers_older_than_48h,
                coalesce(array_agg(id::text order by id) filter (
                  where last_checked_at is null
                     or last_checked_at <= now() - interval '48 hours'
                ), '{}'::text[]) older_offer_ids
           from public.offers
          where retailer_id = any($1::bigint[])
          group by retailer_id`,
        [ids],
      );
      return result.rows;
    },
  );
  return new Map(session.result.map((row) => [String(row.retailer_id), row]));
}

async function run(options, dependencies = {}) {
  const config = dependencies.config || loadConfig();
  const env = dependencies.env || process.env;
  const repository = env.GITHUB_REPOSITORY;
  const token = env.GITHUB_TOKEN;
  invariant(/^[-\w.]+\/[-\w.]+$/.test(repository || ""), "GITHUB_REPOSITORY is invalid");
  invariant(token, "GITHUB_TOKEN is required");
  const now = dependencies.now || new Date();
  let database = new Map();
  let databaseError = null;
  try {
    database = await (dependencies.databaseEvidence || databaseEvidence)(
      config,
      env,
      dependencies,
    );
  } catch (error) {
    databaseError = error.message;
  }
  const retailers = [];
  for (const profile of config.retailers) {
    let stages = { capture: null, apply: null, db_postflight: null };
    let contract = null;
    let monitoringError = null;
    try {
      const stageResult = await (dependencies.runStages || runStages)(
        profile,
        repository,
        token,
      );
      stages = stageResult.stages;
      contract = await (
        dependencies.contractFromArtifacts || contractFromArtifacts
      )(repository, stageResult.applyRunId, token);
    } catch (error) {
      monitoringError = error.message;
    }
    const evaluated = evaluateRetailer(
      {
        profile,
        stages,
        contract,
        database: database.get(String(profile.id)) || null,
      },
      now,
      config.maximum_success_age_hours,
    );
    if (monitoringError) {
      evaluated.failures.unshift("MONITORING_EVIDENCE_ERROR");
      evaluated.monitoring_error = monitoringError;
      evaluated.result = "FAIL";
    }
    retailers.push(evaluated);
  }
  const report = {
    schema_version: 1,
    kind: "automation-reliability-watchdog",
    result: retailers.every((row) => row.result === "PASS") ? "PASS" : "FAIL",
    maximum_success_age_hours: config.maximum_success_age_hours,
    generated_at: now.toISOString(),
    retailer_count: retailers.length,
    failed_retailer_count: retailers.filter((row) => row.result === "FAIL").length,
    database_error: databaseError,
    retailers,
    database_writes: 0,
  };
  fs.mkdirSync(path.dirname(options.output), { recursive: true });
  fs.writeFileSync(options.output, `${JSON.stringify(report, null, 2)}\n`);
  return report;
}

async function main(argv = process.argv.slice(2)) {
  const report = await run(parseArgs(argv));
  console.log(JSON.stringify({
    result: report.result,
    retailer_count: report.retailer_count,
    failed_retailer_count: report.failed_retailer_count,
    database_writes: report.database_writes,
  }));
  if (report.result !== "PASS") process.exitCode = 1;
  return report;
}

if (require.main === module) {
  main().catch((error) => {
    console.error(error.message);
    process.exitCode = 1;
  });
}

module.exports = {
  CONFIG_PATH,
  VALIDATOR_LOGIN,
  VALIDATOR_ROLE,
  contractFromArtifacts,
  databaseEvidence,
  evaluateRetailer,
  correlateEvidence,
  findContractEvidence,
  hoursSince,
  loadConfig,
  main,
  parseArgs,
  run,
  runStages,
};
