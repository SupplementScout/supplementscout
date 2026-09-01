const fs = require("node:fs");

const OPERATIONS = new Set(["dry-run", "apply", "reviewed-offer-73-dry-run"]);
const VALIDATION_CONTEXTS = new Set(["workflow_dispatch", "schedule"]);

function invariant(value, message) {
  if (!value) throw new Error(message);
}

function routeWorkflowEvent(eventName, payload) {
  invariant(eventName === "workflow_dispatch" || eventName === "schedule", "unsupported workflow event");
  if (eventName === "schedule") {
    return {
      operation: "schedule",
      validation_context: "schedule",
      run_standard_refresh: true,
      run_reviewed_offer_73: false,
      run_standard_apply: true,
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

  return {
    operation,
    validation_context: validationContext,
    run_standard_refresh: operation === "dry-run" || operation === "apply",
    run_reviewed_offer_73: operation === "reviewed-offer-73-dry-run",
    run_standard_apply: operation === "apply",
  };
}

function appendOutputs(file, route) {
  invariant(file, "GITHUB_OUTPUT is required");
  fs.appendFileSync(file, [
    `operation=${route.operation}`,
    `validation_context=${route.validation_context}`,
    `run_standard_refresh=${route.run_standard_refresh}`,
    `run_reviewed_offer_73=${route.run_reviewed_offer_73}`,
    `run_standard_apply=${route.run_standard_apply}`,
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

module.exports = { appendOutputs, main, routeWorkflowEvent };
