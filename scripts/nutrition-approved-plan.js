const path = require("node:path");
const {
  buildApprovedPlan,
  createSupabase,
  loadApprovedCandidates,
  loadProducts,
  validateRunId,
  writePlan,
} = require("./lib/nutrition-approved-updates");

function parseArgs(argv) {
  if (argv.length !== 1 || !argv[0].startsWith("--run-id=")) throw new Error("Required option: --run-id=<run_id>");
  return { runId: validateRunId(argv[0].slice("--run-id=".length)) };
}

async function runCli(argv = process.argv.slice(2), dependencies = {}) {
  const { runId } = parseArgs(argv);
  const supabase = dependencies.loadCandidates && dependencies.loadProducts
    ? null
    : createSupabase(dependencies);
  const candidates = dependencies.loadCandidates
    ? await dependencies.loadCandidates(runId)
    : await loadApprovedCandidates(supabase, runId);
  const productIds = [...new Set(candidates.map((candidate) => candidate.product_id).filter(Boolean).map(String))];
  const products = dependencies.loadProducts
    ? await dependencies.loadProducts(productIds)
    : await loadProducts(supabase, productIds);
  const plan = buildApprovedPlan(candidates, products, runId, dependencies.generatedAt);
  const planPath = writePlan(plan, dependencies.cwd || process.cwd());
  return {
    mode: "DRY_RUN_NO_DATABASE_WRITE",
    status: plan.status,
    run_id: runId,
    approved_candidates: candidates.length,
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

module.exports = { parseArgs, runCli };
