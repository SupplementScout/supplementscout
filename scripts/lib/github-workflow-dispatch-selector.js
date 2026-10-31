"use strict";

function fail(message) {
  const error = new Error(message);
  error.code = "WORKFLOW_DISPATCH_RUN_SELECTION_FAILED";
  throw error;
}

function requiredString(value, label) {
  const normalized = String(value ?? "").trim();
  if (!normalized) fail(`${label} is required`);
  return normalized;
}

function normalizedCriteria(criteria) {
  if (!criteria || typeof criteria !== "object" || Array.isArray(criteria)) fail("selection criteria are required");
  const headSha = requiredString(criteria.headSha, "head SHA").toLowerCase();
  if (!/^[0-9a-f]{40}$/.test(headSha)) fail("head SHA must be an exact 40-character Git SHA");
  return Object.freeze({
    workflowId: requiredString(criteria.workflowId, "workflow ID"),
    branch: requiredString(criteria.branch, "branch"),
    headSha,
  });
}

function normalizedRun(run) {
  if (!run || typeof run !== "object" || Array.isArray(run)) return null;
  const id = String(run.id ?? run.databaseId ?? "").trim();
  const workflowId = String(run.workflow_id ?? run.workflowId ?? "").trim();
  const event = String(run.event ?? "").trim();
  const branch = String(run.head_branch ?? run.headBranch ?? "").trim();
  const headSha = String(run.head_sha ?? run.headSha ?? "").trim().toLowerCase();
  const createdAt = String(run.created_at ?? run.createdAt ?? "").trim();
  if (!id || !workflowId || !event || !branch || !headSha) return null;
  return Object.freeze({ id, workflowId, event, branch, headSha, createdAt, source: run });
}

function matchingWorkflowDispatchRuns(runs, criteria) {
  if (!Array.isArray(runs)) fail("workflow runs must be an array");
  const expected = normalizedCriteria(criteria);
  return runs.filter((run) => {
    const current = normalizedRun(run);
    return current
      && current.workflowId === expected.workflowId
      && current.event === "workflow_dispatch"
      && current.branch === expected.branch
      && current.headSha === expected.headSha;
  });
}

function captureMatchingWorkflowDispatchRunIds(runs, criteria) {
  return Object.freeze([...new Set(matchingWorkflowDispatchRuns(runs, criteria).map((run) => normalizedRun(run).id))].sort());
}

function normalizeDispatchStartToGitHubSecond(value) {
  const milliseconds = Date.parse(requiredString(value, "dispatch start timestamp"));
  if (!Number.isFinite(milliseconds)) fail("dispatch start timestamp is invalid");
  return new Date(Math.floor(milliseconds / 1000) * 1000).toISOString();
}

function selectSingleNewWorkflowDispatchRun(options) {
  if (!options || typeof options !== "object" || Array.isArray(options)) fail("selection options are required");
  const baseline = new Set(Array.from(options.baselineRunIds ?? [], (value) => requiredString(value, "baseline run ID")));
  const normalizedStart = options.dispatchStartedAt == null
    ? null
    : normalizeDispatchStartToGitHubSecond(options.dispatchStartedAt);
  const newRunsById = new Map();
  for (const run of matchingWorkflowDispatchRuns(options.runs, options.criteria)) {
    const current = normalizedRun(run);
    if (baseline.has(current.id)) continue;
    if (normalizedStart) {
      const createdAt = Date.parse(current.createdAt);
      if (!Number.isFinite(createdAt) || createdAt < Date.parse(normalizedStart)) continue;
    }
    newRunsById.set(current.id, run);
  }
  if (newRunsById.size !== 1) fail(`expected exactly one new matching workflow-dispatch run; found ${newRunsById.size}`);
  return newRunsById.values().next().value;
}

module.exports = {
  captureMatchingWorkflowDispatchRunIds,
  matchingWorkflowDispatchRuns,
  normalizeDispatchStartToGitHubSecond,
  selectSingleNewWorkflowDispatchRun,
};
