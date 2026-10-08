function invariant(value, message) {
  if (!value) throw new Error(message);
}

function childIdentity(child, index) {
  const rows = child?.artifact?.rows;
  invariant(child && typeof child.child_plan_id === "string", "sequential child identity is missing");
  invariant(
    typeof child?.artifact?.artifact_fingerprint === "string",
    "sequential child fingerprint is missing",
  );
  invariant(Array.isArray(rows) && rows.length > 0, "sequential child rows are missing");
  return {
    batch_index: index,
    child_plan_id: child.child_plan_id,
    child_plan_fingerprint: child.artifact.artifact_fingerprint,
    row_count: rows.length,
  };
}

function createSequentialExecutionProgress(diagnostic, children) {
  invariant(diagnostic && typeof diagnostic === "object", "sequential diagnostic is required");
  invariant(Array.isArray(children) && children.length > 0, "sequential children are required");
  const identities = children.map(childIdentity);
  const state = {
    status: "READY",
    total_child_count: identities.length,
    total_row_count: identities.reduce((sum, child) => sum + child.row_count, 0),
    approved_child_count: 0,
    completed_child_count: 0,
    completed_row_count: 0,
    current_child: null,
    completed_child_ids: [],
  };
  diagnostic.sequential_execution = state;

  function start(index) {
    invariant(Number.isInteger(index) && index === state.completed_child_count, "sequential child order drift");
    state.status = "APPROVING";
    state.current_child = { ...identities[index], stage: "APPROVER" };
  }

  function approved(approval) {
    invariant(state.current_child?.stage === "APPROVER", "sequential approval state drift");
    invariant(approval?.status === "APPROVED", "sequential approval did not pass");
    state.approved_child_count += 1;
    state.current_child = {
      ...state.current_child,
      stage: "EXECUTOR",
      approval_id: approval.approval_id || null,
    };
    state.status = "EXECUTING";
    diagnostic.approver_result = "PARTIAL";
    diagnostic.approvals_created = state.approved_child_count;
  }

  function applied(result) {
    invariant(state.current_child?.stage === "EXECUTOR", "sequential execution state drift");
    invariant(result?.status === "APPLIED", "sequential execution did not apply");
    state.completed_child_count += 1;
    state.completed_row_count += state.current_child.row_count;
    state.completed_child_ids.push(state.current_child.child_plan_id);
    state.current_child = null;
    state.status = state.completed_child_count === state.total_child_count ? "PASS" : "READY";
    diagnostic.executor_result = state.status === "PASS" ? "PASS" : "PARTIAL";
    diagnostic.approvals_consumed = state.completed_child_count;
    diagnostic.database_writes_completed = state.completed_child_count;
    diagnostic.business_writes_completed = state.completed_row_count;
  }

  function failed(error) {
    const stage = state.current_child?.stage || "SEQUENTIAL_EXECUTION";
    state.status = "FAIL";
    if (stage === "APPROVER") diagnostic.approver_result = "FAIL";
    if (stage === "EXECUTOR") diagnostic.executor_result = "FAIL";
    if (!error.stage) error.stage = stage;
    error.detail = {
      ...(error.detail || {}),
      sequential_execution: JSON.parse(JSON.stringify(state)),
    };
    return error;
  }

  return { start, approved, applied, failed, state };
}

module.exports = { createSequentialExecutionProgress };
