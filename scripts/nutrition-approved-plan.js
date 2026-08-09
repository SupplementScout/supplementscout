const path = require("node:path");
const {
  buildApprovedPlan,
  createSupabase,
  loadApprovedCandidates,
  loadApprovedCandidatesForRun,
  loadProducts,
  validateRunId,
  writePlan,
} = require("./lib/nutrition-approved-updates");

function parseArgs(argv) {
  const options = {};
  for (const argument of argv) {
    if (argument.startsWith("--run-id=")) options.runId = validateRunId(argument.slice("--run-id=".length));
    else if (argument.startsWith("--candidate-ids=")) {
      const values = argument.slice("--candidate-ids=".length).split(",");
      if (!values.length || values.some((value) => !/^[1-9][0-9]*$/.test(value)) || new Set(values).size !== values.length) {
        throw new Error("--candidate-ids must be a unique comma-separated list of positive IDs");
      }
      options.candidateIds = values;
    } else if (argument === "--safe-approved-for-run=true") options.safeApprovedForRun = true;
    else throw new Error(`Unknown option: ${argument}`);
  }
  if (!options.runId) throw new Error("Required option: --run-id=<run_id>");
  if (Boolean(options.candidateIds?.length) === Boolean(options.safeApprovedForRun)) {
    throw new Error("Choose exactly one of --candidate-ids=<id,id,...> or --safe-approved-for-run=true");
  }
  return options;
}

function buildSafeApprovedPlan(candidates, products, runId, generatedAt) {
  let selected = [...candidates];
  const excluded = new Map();
  while (selected.length) {
    const plan = buildApprovedPlan(selected, products, runId, generatedAt);
    if (!plan.blockers.length) {
      return {
        plan,
        excludedCandidates: [...excluded.entries()].map(([candidate_id, reason]) => ({ candidate_id, reason })),
      };
    }
    const candidateById = new Map(selected.map((candidate) => [String(candidate.id), candidate]));
    const blockedProducts = new Set();
    const blockedCandidates = new Set();
    for (const blocker of plan.blockers) {
      if (blocker.product_id) blockedProducts.add(String(blocker.product_id));
      if (blocker.candidate_id) blockedCandidates.add(String(blocker.candidate_id));
      for (const candidateId of blocker.candidate_ids || []) {
        const candidate = candidateById.get(String(candidateId));
        if (candidate?.product_id) blockedProducts.add(String(candidate.product_id));
        else blockedCandidates.add(String(candidateId));
      }
    }
    const next = selected.filter((candidate) => {
      const blocked = blockedCandidates.has(String(candidate.id)) ||
        (candidate.product_id && blockedProducts.has(String(candidate.product_id)));
      if (blocked) excluded.set(String(candidate.id), plan.blockers
        .filter((item) => String(item.product_id || "") === String(candidate.product_id || "") ||
          String(item.candidate_id || "") === String(candidate.id) ||
          (item.candidate_ids || []).map(String).includes(String(candidate.id)))
        .map((item) => item.code).join(",") || "BLOCKED_PRODUCT");
      return !blocked;
    });
    if (next.length === selected.length) throw new Error("Safe batch planner could not isolate blocked candidates");
    selected = next;
  }
  throw new Error("No safe approved candidates remain for this run");
}

async function runCli(argv = process.argv.slice(2), dependencies = {}) {
  const { runId, candidateIds, safeApprovedForRun } = parseArgs(argv);
  const supabase = dependencies.loadCandidates && dependencies.loadProducts
    ? null
    : createSupabase(dependencies);
  const candidates = dependencies.loadCandidates
    ? await dependencies.loadCandidates(runId, candidateIds)
    : safeApprovedForRun
      ? await loadApprovedCandidatesForRun(supabase, runId)
      : await loadApprovedCandidates(supabase, runId, candidateIds);
  if (!candidates.length) throw new Error(`No approved candidates found for run ${runId}`);
  const loadedIds = candidates.map((candidate) => String(candidate.id)).sort((a, b) => Number(a) - Number(b));
  const requestedIds = candidateIds ? [...candidateIds].sort((a, b) => Number(a) - Number(b)) : loadedIds;
  if (!safeApprovedForRun && JSON.stringify(loadedIds) !== JSON.stringify(requestedIds)) {
    throw new Error("One or more requested candidates are absent, unapproved, or outside the requested run");
  }
  const productIds = [...new Set(candidates.map((candidate) => candidate.product_id).filter(Boolean).map(String))];
  const products = dependencies.loadProducts
    ? await dependencies.loadProducts(productIds)
    : await loadProducts(supabase, productIds);
  const built = safeApprovedForRun
    ? buildSafeApprovedPlan(candidates, products, runId, dependencies.generatedAt)
    : { plan: buildApprovedPlan(candidates, products, runId, dependencies.generatedAt), excludedCandidates: [] };
  const { plan } = built;
  const planPath = writePlan(plan, dependencies.cwd || process.cwd());
  return {
    mode: "DRY_RUN_NO_DATABASE_WRITE",
    status: plan.status,
    run_id: runId,
    approved_candidates: plan.source_candidate_ids.length,
    excluded_candidates: built.excludedCandidates,
    planned_products: plan.product_updates.length,
    blockers: plan.blockers,
    plan: path.relative(dependencies.cwd || process.cwd(), planPath).replaceAll("\\", "/"),
  };
}

if (require.main === module) {
  runCli().then((result) => console.log(JSON.stringify(result, null, 2))).catch((error) => {
    console.error(error.message);
    process.exitCode = 1;
  });
}

module.exports = { buildSafeApprovedPlan, parseArgs, runCli };
