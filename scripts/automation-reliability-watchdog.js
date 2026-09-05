const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const { spawnSync } = require("node:child_process");
const { Client } = require("pg");
const {
  normalizeConnectionString,
  withPostgresRoleSession,
} = require("./lib/retailer-offer-sync/production-role-session");
const { canonicalHash, sortedStrings } = require("./lib/ebay-artifact-bound-contract");

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
  const baseline = config.monitored_backlog;
  invariant(baseline?.schema_version === 1, "Watchdog monitored backlog baseline is missing");
  invariant(
    /^[0-9a-f]{64}$/.test(baseline.closeout_snapshot_sha256 || ""),
    "Watchdog monitored backlog snapshot hash is invalid",
  );
  invariant(
    Object.keys(baseline.retailers || {}).length === 11,
    "Watchdog monitored backlog must cover 11 retailers",
  );
  invariant(
    baseline.closeout_counts.review_queue_pending ===
      baseline.closeout_counts.out_of_stock +
        baseline.closeout_counts.commercial +
        baseline.closeout_counts.identity_or_mapping +
        baseline.closeout_counts.source_missing,
    "Watchdog closeout queue counts do not reconcile",
  );
  for (const profile of config.retailers) {
    const rule = baseline.retailers[String(profile.id)];
    invariant(
      Number.isInteger(rule?.maximum_offers_older_than_48h) &&
        rule.maximum_offers_older_than_48h >= 0,
      `Watchdog stale ceiling is invalid for retailer ${profile.id}`,
    );
    invariant(
      Number.isInteger(rule.maximum_review_row_count) &&
        rule.maximum_review_row_count >= 0,
      `Watchdog review ceiling is invalid for retailer ${profile.id}`,
    );
    invariant(
      Array.isArray(rule.allowed_failure_codes) &&
        rule.allowed_failure_codes.every(
          (code) => typeof code === "string" && /^[A-Z0-9_]+$/.test(code),
        ) &&
        new Set(rule.allowed_failure_codes).size === rule.allowed_failure_codes.length,
      `Watchdog allowed failure codes are invalid for retailer ${profile.id}`,
    );
    if (rule.allowed_review_offer_ids !== undefined) {
      invariant(
        Array.isArray(rule.allowed_review_offer_ids) &&
          rule.allowed_review_offer_ids.every((offerId) => /^\d+$/.test(String(offerId))) &&
          new Set(rule.allowed_review_offer_ids.map(String)).size === rule.allowed_review_offer_ids.length &&
          rule.allowed_review_offer_ids.length <= rule.maximum_review_row_count,
        `Watchdog allowed review offer IDs are invalid for retailer ${profile.id}`,
      );
    }
  }
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
      review_offer_ids: Array.isArray(value.review_offer_ids) ? value.review_offer_ids.map(String).sort() : Array.isArray(value.review_rows) ? value.review_rows.map((row) => String(row.offer_id)).sort() : null,
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
      apply_run_id: value.apply_run_id || null,
      apply_artifact_id: value.apply_artifact_id || null,
      apply_artifact_digest: value.apply_artifact_digest || null,
      apply_database_writes: Number.isInteger(value.apply_database_writes) ? value.apply_database_writes : null,
      apply_executed_plan_count: Number.isInteger(value.apply_executed_plan_count) ? value.apply_executed_plan_count : null,
      idempotency_run_id: value.idempotency_run_id || null,
      idempotency_artifact_id: value.idempotency_artifact_id || null,
      idempotency_artifact_digest: value.idempotency_artifact_digest || null,
      idempotency_database_writes: Number.isInteger(value.idempotency_database_writes) ? value.idempotency_database_writes : null,
      idempotency_executed_plan_count: Number.isInteger(value.idempotency_executed_plan_count) ? value.idempotency_executed_plan_count : null,
      idempotency_plan_fingerprint: value.idempotency_plan_fingerprint || null,
      postflight_file_sha256: value.postflight_file_sha256 || null,
      evidence_model: value.evidence_model || null,
      attestation_fingerprint: value.attestation_fingerprint || null,
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
    if (contract?.evidence_model === "split-run-v1") {
      if (contract.idempotency_result !== "PASS") failures.push("INDEPENDENT_IDEMPOTENCY_NOT_PASSED");
      if (contract.idempotency_database_writes !== 0) failures.push("INDEPENDENT_IDEMPOTENCY_DATABASE_WRITES_PRESENT");
      if (contract.idempotency_executed_plan_count !== 0) failures.push("INDEPENDENT_IDEMPOTENCY_EXECUTED_PLANS_PRESENT");
      if (contract.apply_run_id && contract.apply_run_id !== stages.apply.run_id) failures.push("INDEPENDENT_IDEMPOTENCY_APPLY_RUN_MISMATCH");
      if (contract.idempotency_run_id && contract.idempotency_run_id !== stages.capture.run_id) failures.push("INDEPENDENT_IDEMPOTENCY_RUN_MISMATCH");
    }
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
    if (!["PASS", "PASS_WITH_REVIEW"].includes(contract.result)) {
      failures.push("EXECUTION_CONTRACT_RESULT_INVALID");
    }
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
      if (contract.evidence_model === "split-run-v1") {
        if (contract.apply_database_writes !== contract.executed_plan_count) failures.push("EBAY_APPLY_DATABASE_WRITE_COUNT_MISMATCH");
        if (contract.apply_executed_plan_count !== contract.executed_plan_count) failures.push("EBAY_APPLY_EXECUTED_PLAN_COUNT_MISMATCH");
        if (contract.idempotency_database_writes !== 0 || contract.idempotency_executed_plan_count !== 0) failures.push("EBAY_IDEMPOTENCY_DATABASE_WRITE_COUNT_MISMATCH");
        for (const field of ["apply_run_id", "apply_artifact_id", "apply_artifact_digest", "idempotency_run_id", "idempotency_artifact_id", "idempotency_artifact_digest", "postflight_file_sha256", "attestation_fingerprint"]) if (!contract[field]) failures.push(`EBAY_${field.toUpperCase()}_MISSING`);
      } else if (contract.database_writes !== contract.executed_plan_count) failures.push("EBAY_DATABASE_WRITE_COUNT_MISMATCH");
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
    result: failures.length
      ? "FAIL"
      : contract?.review_row_count > 0
        ? "PASS_WITH_REVIEW"
        : "PASS",
    failures,
    stages,
    contract,
    database,
    evidence_correlation: correlation.result,
  };
}

function applyMonitoredBacklog(evaluation, baseline) {
  invariant(baseline && typeof baseline === "object", "Retailer monitored backlog baseline is missing");
  const allowed = new Set(baseline.allowed_failure_codes || []);
  const unexpected = evaluation.failures.filter((code) => !allowed.has(code));
  const growth = [];
  const older = Number(evaluation.database?.offers_older_than_48h || 0);
  const review = Number(evaluation.contract?.review_row_count || 0);
  if (older > baseline.maximum_offers_older_than_48h) {
    growth.push("OFFERS_OLDER_THAN_48H_GROWTH");
  }
  if (review > baseline.maximum_review_row_count) {
    growth.push("REVIEW_ROW_COUNT_GROWTH");
  }
  if (review > 0 && baseline.allowed_review_offer_ids !== undefined) {
    const allowedReviewIds = new Set(baseline.allowed_review_offer_ids.map(String));
    const observedReviewIds = evaluation.contract?.review_offer_ids;
    if (!Array.isArray(observedReviewIds) || observedReviewIds.length !== review) {
      growth.push("REVIEW_SCOPE_EVIDENCE_MISSING");
    } else if (observedReviewIds.some((offerId) => !allowedReviewIds.has(String(offerId)))) {
      growth.push("REVIEW_SCOPE_DRIFT");
    }
  }
  if (unexpected.length || growth.length) {
    return {
      ...evaluation,
      result: "FAIL",
      failures: [
        ...evaluation.failures,
        ...(growth.length ? ["MONITORED_BACKLOG_GROWTH"] : []),
      ],
      monitored_backlog: {
        result: "OUTSIDE_BASELINE",
        unexpected_failure_codes: unexpected,
        growth,
      },
    };
  }
  if (evaluation.failures.length) {
    return {
      ...evaluation,
      result: "PASS_WITH_MONITORED_BACKLOG",
      failures: [],
      warnings: evaluation.failures,
      monitored_backlog: {
        result: "WITHIN_BASELINE",
        maximum_offers_older_than_48h: baseline.maximum_offers_older_than_48h,
        current_offers_older_than_48h: older,
        maximum_review_row_count: baseline.maximum_review_row_count,
        current_review_row_count: review,
      },
    };
  }
  return {
    ...evaluation,
    warnings: [],
    monitored_backlog: {
      result: "WITHIN_BASELINE",
      maximum_offers_older_than_48h: baseline.maximum_offers_older_than_48h,
      current_offers_older_than_48h: older,
      maximum_review_row_count: baseline.maximum_review_row_count,
      current_review_row_count: review,
    },
  };
}

function summarizeWatchdogResult(retailers, options = {}) {
  const globalFailures = [];
  if (options.databaseError) globalFailures.push("DATABASE_EVIDENCE_ERROR");
  if (options.monitoringError) globalFailures.push("MONITORING_INFRASTRUCTURE_ERROR");
  if (Number(options.databaseWrites || 0) !== 0) {
    globalFailures.push("UNAUTHORIZED_DATABASE_WRITE");
  }
  if (globalFailures.length || retailers.some((row) => row.result === "FAIL")) {
    return { result: "FAIL", globalFailures };
  }
  if (retailers.some((row) => row.result === "PASS_WITH_MONITORED_BACKLOG")) {
    return { result: "PASS_WITH_MONITORED_BACKLOG", globalFailures };
  }
  if (retailers.some((row) => row.result === "PASS_WITH_REVIEW")) {
    return { result: "PASS_WITH_REVIEW", globalFailures };
  }
  return { result: "PASS", globalFailures };
}

function watchdogExitCode(result) {
  invariant(
    ["PASS", "PASS_WITH_REVIEW", "PASS_WITH_MONITORED_BACKLOG", "FAIL"].includes(result),
    "Unknown watchdog result",
  );
  return result === "FAIL" ? 1 : 0;
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

function sha256(value) {
  return require("node:crypto").createHash("sha256").update(value).digest("hex");
}

function parseJsonFilesFromArtifact(zipPath) {
  const names = spawnSync("unzip", ["-Z1", zipPath], { encoding: "utf8" });
  invariant(names.status === 0, "Unable to list watchdog artifact ZIP");
  const files = [];
  for (const name of names.stdout.split(/\r?\n/).filter(Boolean)) {
    if (!name.endsWith(".json")) continue;
    const extracted = spawnSync("unzip", ["-p", zipPath, name], {
      encoding: "utf8",
      maxBuffer: 30 * 1024 * 1024,
    });
    if (extracted.status !== 0) continue;
    try {
      files.push({
        name,
        sha256: sha256(extracted.stdout),
        json: JSON.parse(extracted.stdout),
      });
    } catch {}
  }
  return files;
}

async function artifactsForRun(repository, runId, token, directory) {
  const base = `https://api.github.com/repos/${repository}`;
  const listing = await githubJson(
    `${base}/actions/runs/${runId}/artifacts?per_page=100`,
    token,
  );
  const results = [];
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
    results.push({ artifact, files: parseJsonFilesFromArtifact(zipPath) });
  }
  return results;
}

function jsonFile(files, name) {
  return files.find((file) => file.name === name || path.basename(file.name) === name) || null;
}

function validateEbayApplyArtifacts({ run, artifact, files }) {
  const applyFile = jsonFile(files, "production-apply.json");
  const postflightFile = jsonFile(files, "production-db-postflight.json");
  const verificationFile = jsonFile(files, "approved-artifact-verification.json");
  invariant(applyFile && postflightFile, "eBay apply artifact missing apply or postflight evidence");
  const apply = applyFile.json;
  const postflight = postflightFile.json;
  const verification = verificationFile?.json || null;
  invariant(run.event === "workflow_dispatch" || run.event === "schedule", "eBay apply run event invalid");
  if (run.event === "workflow_dispatch") {
    invariant(verification, "eBay manual apply artifact missing approved verification evidence");
    invariant(apply.commit_sha === verification.commit_sha, "eBay apply commit evidence mismatch");
  } else {
    invariant(!verification, "eBay scheduled apply must not contain manual approval verification evidence");
    invariant(!apply.approved_dry_run_id && !apply.approved_artifact_id && !apply.approved_commit_sha && !apply.approved_manifest_sha256 && !apply.approved_report_sha256, "eBay scheduled apply contains manual approval provenance");
  }
  invariant(run.head_sha === apply.commit_sha, "eBay apply commit evidence mismatch");
  invariant(run.conclusion === "cancelled" || run.conclusion === "success", "eBay apply run must be success or cancelled after postflight");
  invariant(["PASS", "PASS_WITH_REVIEW"].includes(apply.result) && apply.mode === "execute-apply", "eBay apply evidence did not pass");
  const executableCount = apply.executable_plan_count;
  const reviewCount = apply.review_row_count;
  invariant(apply.approved_mapping_count === 237 && Number.isInteger(executableCount) && executableCount > 0 && apply.executed_plan_count === executableCount && Number.isInteger(reviewCount) && reviewCount >= 0 && executableCount + reviewCount === 237 && apply.blocked_row_count === 0, "eBay apply scope drift");
  const executionIds = sortedStrings(apply.execution_offer_ids || []);
  const reviewIds = sortedStrings((apply.review_rows || []).map((row) => row.offer_id));
  invariant(executionIds.length === executableCount && new Set(executionIds).size === executableCount && reviewIds.length === reviewCount && new Set(reviewIds).size === reviewCount && executionIds.every((id) => !reviewIds.includes(id)), "eBay apply scope drift");
  invariant(apply.classification?.VERIFY_NO_CHANGE === executableCount && Object.keys(apply.classification || {}).length === 1, "eBay apply executed a non-freshness action");
  const logical = apply.expected_deltas?.logical_field_deltas || {};
  const rows = apply.expected_deltas?.row_count_deltas || {};
  invariant(logical.last_checked_at_updates === executableCount && ["offer_price_updates","offer_stock_updates","offer_shipping_updates","offer_total_updates","offer_url_updates","mapping_url_updates"].every((field) => logical[field] === 0), "eBay apply expected logical deltas drift");
  invariant(["products","product_variants","retailer_products","offers","price_history"].every((field) => rows[field] === 0), "eBay apply expected row-count deltas drift");
  invariant(postflight.result === "PASS" && postflight.approved_mapping_count === 237 && postflight.executable_plan_count === executableCount && postflight.freshness_change_count === executableCount && postflight.executed_plan_count === executableCount && postflight.review_row_count === reviewCount && postflight.blocked_row_count === 0, "eBay postflight scope drift");
  invariant(["price_change_count","stock_change_count","shipping_change_count","total_change_count","offer_url_change_count","mapping_url_change_count","price_history_delta"].every((field) => postflight[field] === 0), "eBay postflight delta drift");
  invariant(/^sha256:[0-9a-f]{64}$/.test(artifact.digest || ""), "eBay apply artifact digest missing");
  invariant(/^[0-9a-f]{64}$/.test(postflight.postflight_hash || ""), "eBay postflight hash missing");
  return { apply, postflight, verification, postflightFileSha256: postflightFile.sha256 };
}

function validateEbayIdempotencyArtifacts({ run, artifact, files, applyEvidence }) {
  const reportFile = jsonFile(files, "production-dry-run.json");
  const contractFile = jsonFile(files, "production-dry-run-contract.json");
  invariant(reportFile && contractFile, "eBay independent idempotency artifact missing dry-run report or contract");
  invariant(!jsonFile(files, "production-apply.json") && !jsonFile(files, "production-db-postflight.json"), "eBay independent idempotency artifact contains apply/postflight evidence");
  const report = reportFile.json;
  const contract = contractFile.json;
  const apply = applyEvidence.apply;
  const executableCount = apply.executable_plan_count;
  const reviewCount = apply.review_row_count;
  invariant(run.conclusion === "success" && run.head_sha === apply.commit_sha, "eBay independent idempotency run status or commit mismatch");
  invariant(["PASS", "PASS_WITH_REVIEW"].includes(report.result) && report.mode === "dry-run" && report.executed_plan_count === 0, "eBay independent idempotency run was not read-only");
  invariant(report.approved_mapping_count === 237 && report.executable_plan_count === executableCount && report.review_row_count === reviewCount && report.blocked_row_count === 0, "eBay independent idempotency scope drift");
  invariant(contract.approved_mapping_count === 237 && contract.executable_plan_count === executableCount && contract.review_row_count === reviewCount && contract.blocked_row_count === 0, "eBay independent idempotency contract scope drift");
  const applyIds = sortedStrings(apply.execution_offer_ids);
  const idempotencyIds = sortedStrings(report.execution_offer_ids);
  const applyReviews = sortedStrings(apply.review_rows.map((row) => row.offer_id));
  const idempotencyReviews = sortedStrings(report.review_rows.map((row) => row.offer_id));
  invariant(JSON.stringify(applyIds) === JSON.stringify(idempotencyIds), "eBay independent idempotency executable offer IDs drift");
  invariant(JSON.stringify(applyReviews) === JSON.stringify(idempotencyReviews), "eBay independent idempotency review offer IDs drift");
  invariant(report.executable_source_fingerprint === apply.executable_source_fingerprint, "eBay independent idempotency executable source fingerprint drift");
  invariant(report.review_scope_fingerprint === apply.approved_review_scope_fingerprint || report.review_scope_fingerprint === apply.review_scope_fingerprint, "eBay independent idempotency review scope fingerprint drift");
  invariant(JSON.stringify(report.expected_deltas) === JSON.stringify(apply.expected_deltas), "eBay independent idempotency expected deltas drift");
  invariant(report.classification?.VERIFY_NO_CHANGE === executableCount, "eBay independent idempotency executable classification drift");
  invariant(/^sha256:[0-9a-f]{64}$/.test(artifact.digest || ""), "eBay independent idempotency artifact digest missing");
  return { report, contract, reportFileSha256: reportFile.sha256, contractFileSha256: contractFile.sha256 };
}

function buildEbaySplitRunAttestation({ applyRun, applyArtifact, applyEvidence, idempotencyRun, idempotencyArtifact, idempotencyEvidence }) {
  const apply = applyEvidence.apply;
  const postflight = applyEvidence.postflight;
  const idempotency = idempotencyEvidence.report;
  const executionOfferIds = sortedStrings(apply.execution_offer_ids);
  const reviewOfferIds = sortedStrings(apply.review_rows.map((row) => row.offer_id));
  const attestation = {
    schema_version: 1,
    kind: "ebay-split-run-correlation-attestation",
    evidence_model: "split-run-v1",
    result: "PASS",
    retailer_id: "12",
    retailer: "eBay UK",
    apply_run_id: String(applyRun.id),
    apply_artifact_id: String(applyArtifact.id),
    apply_artifact_digest: applyArtifact.digest,
    apply_commit_sha: apply.commit_sha,
    apply_database_writes: apply.executed_plan_count,
    apply_executed_plan_count: apply.executed_plan_count,
    idempotency_run_id: String(idempotencyRun.id),
    idempotency_artifact_id: String(idempotencyArtifact.id),
    idempotency_artifact_digest: idempotencyArtifact.digest,
    idempotency_database_writes: 0,
    idempotency_executed_plan_count: idempotency.executed_plan_count,
    idempotency_result: "PASS",
    commit_sha: apply.commit_sha,
    manifest_sha256: apply.approved_manifest_sha256 || apply.manifest_sha256,
    source_fingerprint: apply.source_fingerprint,
    full_capture_fingerprint: apply.approved_full_capture_fingerprint || apply.full_capture_fingerprint,
    executable_source_fingerprint: apply.executable_source_fingerprint,
    review_scope_fingerprint: apply.approved_review_scope_fingerprint || apply.review_scope_fingerprint,
    plan_fingerprint: apply.plan_fingerprint,
    idempotency_plan_fingerprint: idempotency.plan_fingerprint,
    postflight_hash: postflight.postflight_hash,
    postflight_file_sha256: applyEvidence.postflightFileSha256,
    approved_mapping_count: apply.approved_mapping_count,
    executable_plan_count: apply.executable_plan_count,
    executed_plan_count: apply.executed_plan_count,
    review_row_count: apply.review_row_count,
    blocked_row_count: apply.blocked_row_count,
    execution_offer_ids: executionOfferIds,
    review_offer_ids: reviewOfferIds,
    expected_deltas: apply.expected_deltas,
    actual_deltas: {
      freshness: postflight.freshness_change_count,
      price: postflight.price_change_count,
      stock: postflight.stock_change_count,
      shipping: postflight.shipping_change_count,
      total: postflight.total_change_count,
      offer_url: postflight.offer_url_change_count,
      mapping_url: postflight.mapping_url_change_count,
      price_history: postflight.price_history_delta,
    },
    price_history_delta: postflight.price_history_delta,
    database_writes: apply.executed_plan_count,
    split_run_reason: "APPLY_AND_POSTFLIGHT_SUCCEEDED_ORIGINAL_JOB_CANCELLED_DURING_IDEMPOTENCY",
  };
  attestation.attestation_fingerprint = canonicalHash(attestation);
  return attestation;
}

async function buildEbaySplitRunEvidence(repository, stages, token, directory) {
  if (!stages?.apply?.run_id || !stages?.capture?.run_id || stages.capture.run_id === stages.apply.run_id) return null;
  const base = `https://api.github.com/repos/${repository}`;
  const [applyRun, idempotencyRun] = await Promise.all([
    githubJson(`${base}/actions/runs/${stages.apply.run_id}`, token),
    githubJson(`${base}/actions/runs/${stages.capture.run_id}`, token),
  ]);
  const [applyArtifacts, idempotencyArtifacts] = await Promise.all([
    artifactsForRun(repository, stages.apply.run_id, token, directory),
    artifactsForRun(repository, stages.capture.run_id, token, directory),
  ]);
  for (const applyArtifact of applyArtifacts) {
    let applyEvidence = null;
    try { applyEvidence = validateEbayApplyArtifacts({ run: applyRun, artifact: applyArtifact.artifact, files: applyArtifact.files }); } catch {}
    if (!applyEvidence) continue;
    for (const idempotencyArtifact of idempotencyArtifacts) {
      try {
        const idempotencyEvidence = validateEbayIdempotencyArtifacts({ run: idempotencyRun, artifact: idempotencyArtifact.artifact, files: idempotencyArtifact.files, applyEvidence });
        return buildEbaySplitRunAttestation({ applyRun, applyArtifact: applyArtifact.artifact, applyEvidence, idempotencyRun, idempotencyArtifact: idempotencyArtifact.artifact, idempotencyEvidence });
      } catch {}
    }
  }
  return null;
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

async function contractFromArtifacts(repository, runId, token, options = {}) {
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
    if (String(options.profile?.id) === "12") {
      const split = await buildEbaySplitRunEvidence(repository, options.stages, token, directory);
      if (split) return findContractEvidence(split);
    }
    const candidates = [];
    const reviewScopeCandidates = [];
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
          else if (found?.review_offer_ids) reviewScopeCandidates.push(found);
        } catch {}
      }
    }
    const selected = candidates.sort((left, right) => {
      const score = (value) => ["execution_offer_ids","expected_deltas","commit_sha","manifest_sha256","source_fingerprint","plan_fingerprint","postflight_hash","idempotency_result","database_writes"].filter((field) => value[field] !== null && value[field] !== undefined).length;
      return score(right) - score(left);
    })[0] || null;
    if (!selected || selected.review_offer_ids) return selected;
    const matchingReviewScopes = reviewScopeCandidates.filter((candidate) =>
      candidate.manifest_sha256 === selected.manifest_sha256 &&
      candidate.approved_mapping_count === selected.approved_mapping_count &&
      candidate.executable_plan_count === selected.executable_plan_count &&
      candidate.review_row_count === selected.review_row_count &&
      candidate.blocked_row_count === selected.blocked_row_count
    );
    if (!matchingReviewScopes.length) return selected;
    const serializedScopes = new Set(matchingReviewScopes.map((candidate) => JSON.stringify(sortedStrings(candidate.review_offer_ids))));
    invariant(serializedScopes.size === 1, "Artifact review offer scopes disagree");
    return { ...selected, review_offer_ids: sortedStrings(matchingReviewScopes[0].review_offer_ids) };
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
  let monitoringInfrastructureError = null;
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
      )(repository, stageResult.applyRunId, token, { profile, stages });
    } catch (error) {
      monitoringError = error.message;
      monitoringInfrastructureError ||= error.message;
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
    retailers.push(
      applyMonitoredBacklog(
        evaluated,
        config.monitored_backlog.retailers[String(profile.id)],
      ),
    );
  }
  const databaseWrites = 0;
  const summary = summarizeWatchdogResult(retailers, {
    databaseError,
    monitoringError: monitoringInfrastructureError,
    databaseWrites,
  });
  const report = {
    schema_version: 1,
    kind: "automation-reliability-watchdog",
    result: summary.result,
    closeout_snapshot_sha256:
      config.monitored_backlog.closeout_snapshot_sha256,
    maximum_success_age_hours: config.maximum_success_age_hours,
    generated_at: now.toISOString(),
    retailer_count: retailers.length,
    failed_retailer_count: retailers.filter((row) => row.result === "FAIL").length,
    monitored_retailer_count: retailers.filter(
      (row) => row.result === "PASS_WITH_MONITORED_BACKLOG",
    ).length,
    review_retailer_count: retailers.filter(
      (row) => row.result === "PASS_WITH_REVIEW",
    ).length,
    database_error: databaseError,
    global_failures: summary.globalFailures,
    retailers,
    database_writes: databaseWrites,
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
  process.exitCode = watchdogExitCode(report.result) || undefined;
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
  applyMonitoredBacklog,
  buildEbaySplitRunAttestation,
  buildEbaySplitRunEvidence,
  contractFromArtifacts,
  databaseEvidence,
  evaluateRetailer,
  correlateEvidence,
  findContractEvidence,
  validateEbayApplyArtifacts,
  validateEbayIdempotencyArtifacts,
  hoursSince,
  loadConfig,
  main,
  parseArgs,
  run,
  runStages,
  summarizeWatchdogResult,
  watchdogExitCode,
};
