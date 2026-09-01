const fs = require("node:fs");

const OPERATIONS = new Set(["dry-run", "apply", "reviewed-offer-73-dry-run", "reviewed-artifact-apply"]);
const VALIDATION_CONTEXTS = new Set(["workflow_dispatch", "schedule"]);
const SHA256 = /^[0-9a-f]{64}$/;
const MD5 = /^[0-9a-f]{32}$/;

function invariant(value, message) {
  if (!value) throw new Error(message);
}

function parseReviewedContract(value) {
  invariant(typeof value === "string" && value.trim(), "reviewed contract is required");
  let contract;
  try { contract = JSON.parse(value); } catch { throw new Error("reviewed contract must be valid JSON"); }
  const exactKeys = [
    "source_run_id", "source_artifact_id", "source_artifact_name", "source_commit",
    "zip_sha256", "artifact_sha256", "report_sha256", "plan_fingerprint",
    "approval_fingerprint", "idempotency_key",
  ];
  invariant(Object.keys(contract).sort().join(",") === [...exactKeys].sort().join(","), "reviewed contract fields mismatch");
  invariant(/^\d+$/.test(String(contract.source_run_id)) && /^\d+$/.test(String(contract.source_artifact_id)), "reviewed source IDs are invalid");
  invariant(/^whey-okay-[a-z0-9-]{1,100}-\d+-\d+$/.test(contract.source_artifact_name || ""), "reviewed artifact name is invalid");
  invariant(/^[0-9a-f]{40}$/.test(contract.source_commit || ""), "reviewed source commit is invalid");
  for (const field of ["zip_sha256", "artifact_sha256", "report_sha256", "approval_fingerprint", "idempotency_key"])
    invariant(SHA256.test(contract[field] || ""), `reviewed ${field} is invalid`);
  invariant(MD5.test(contract.plan_fingerprint || ""), "reviewed plan_fingerprint is invalid");
  return contract;
}

function routeWorkflowEvent(eventName, payload) {
  invariant(eventName === "workflow_dispatch" || eventName === "schedule", "unsupported workflow event");
  if (eventName === "schedule") {
    return {
      operation: "schedule",
      validation_context: "schedule",
      run_standard_refresh: true,
      run_reviewed_offer_73: false,
      run_reviewed_artifact_apply: false,
      run_standard_apply: true,
      reviewed_contract: "",
      owner_confirmation: "",
    };
  }

  const operation = typeof payload?.inputs?.operation === "string" ? payload.inputs.operation.trim() : "";
  const validationContext = typeof payload?.inputs?.validation_context === "string" ? payload.inputs.validation_context.trim() : "";
  invariant(OPERATIONS.has(operation), "unknown or empty operation");
  invariant(VALIDATION_CONTEXTS.has(validationContext), "invalid validation context");
  if (operation === "reviewed-offer-73-dry-run") {
    invariant(
      validationContext === "workflow_dispatch",
      "invalid validation context for reviewed offer 73",
    );
  }
  let reviewedContract = null;
  if (operation === "reviewed-artifact-apply") {
    invariant(validationContext === "workflow_dispatch", "invalid validation context for reviewed artifact apply");
    reviewedContract = parseReviewedContract(payload.inputs.reviewed_contract);
    invariant(/^OWNER_APPROVED_REVIEWED_ARTIFACT:[0-9a-f]{64}$/.test(String(payload.inputs.owner_confirmation || "")), "reviewed owner confirmation is invalid");
  }

  return {
    operation,
    validation_context: validationContext,
    run_standard_refresh: operation === "dry-run" || operation === "apply",
    run_reviewed_offer_73: operation === "reviewed-offer-73-dry-run",
    run_reviewed_artifact_apply: operation === "reviewed-artifact-apply",
    run_standard_apply: operation === "apply",
    reviewed_contract: reviewedContract ? JSON.stringify(reviewedContract) : "",
    owner_confirmation: reviewedContract ? payload.inputs.owner_confirmation : "",
  };
}

function appendOutputs(file, route) {
  invariant(file, "GITHUB_OUTPUT is required");
  fs.appendFileSync(file, [
    `operation=${route.operation}`,
    `validation_context=${route.validation_context}`,
    `run_standard_refresh=${route.run_standard_refresh}`,
    `run_reviewed_offer_73=${route.run_reviewed_offer_73}`,
    `run_reviewed_artifact_apply=${route.run_reviewed_artifact_apply}`,
    `run_standard_apply=${route.run_standard_apply}`,
    `reviewed_contract=${route.reviewed_contract || ""}`,
    `owner_confirmation=${route.owner_confirmation || ""}`,
    "",
  ].join("\n"));
}

function main(env = process.env) {
  invariant(env.GITHUB_EVENT_PATH, "GITHUB_EVENT_PATH is required");
  const payload = JSON.parse(fs.readFileSync(env.GITHUB_EVENT_PATH, "utf8"));
  const route = routeWorkflowEvent(env.GITHUB_EVENT_NAME, payload);
  console.log(`Requested operation: ${route.operation}`);
  console.log(`Validation context: ${route.validation_context}`);
  appendOutputs(env.GITHUB_OUTPUT, route);
  return route;
}

if (require.main === module) {
  try { main(); }
  catch (error) { console.error(error.message); process.exitCode = 1; }
}

module.exports = { appendOutputs, main, parseReviewedContract, routeWorkflowEvent };
