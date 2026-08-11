// HISTORICAL ONE-TIME REVIEWED OPERATION: not used by the scheduled Fit House refresh.
const path = require("node:path");
const engine = require("./fit-house-offer-refresh");
const { loadReviewedMixedChangeManifest } = require("./lib/retailer-offer-sync/reviewed-mixed-change");

const ROOT = path.resolve(__dirname, "..");
const MANIFEST = path.join(ROOT, "config", "retailers", "fit-house-reviewed-current-changes-2026-08-10.json");
const MANIFEST_SHA256 = "168b5c604482280dc17842b93b9b27c24db42952b0873b14b0b326a6c10883f1";

function invariant(value, message) {
  if (!value) throw new Error(message);
}

function loadReviewedFitHouse47() {
  const reviewed = loadReviewedMixedChangeManifest(MANIFEST, MANIFEST_SHA256);
  invariant(reviewed.manifest.retailer_id === "9" && reviewed.manifest.row_count === 47,
    "Fit House reviewed 47 manifest scope mismatch");
  return reviewed;
}

async function main(argv = process.argv.slice(2)) {
  invariant(argv.includes("--target=production"), "reviewed Fit House 47 package is production-only");
  const reviewed = loadReviewedFitHouse47();
  const operation = (args, diagnostic) => engine.executeRefresh(args, diagnostic, reviewed);
  const completed = await engine.runWithDiagnostic(argv, { operation });
  console.log(JSON.stringify(completed.result));
  return completed.result;
}

if (require.main === module) main().catch((error) => { console.error(error.stack || error); process.exitCode = 1; });

module.exports = { loadReviewedFitHouse47, main, MANIFEST, MANIFEST_SHA256 };
