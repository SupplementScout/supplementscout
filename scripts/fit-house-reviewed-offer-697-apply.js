// ONE-TIME REVIEWED OPERATION: exact owner-approved Fit House offer 697 OOS transition.
const path = require("node:path");
const engine = require("./fit-house-offer-refresh");
const { loadReviewedMixedChangeManifest } = require("./lib/retailer-offer-sync/reviewed-mixed-change");

const ROOT = path.resolve(__dirname, "..");
const MANIFEST = path.join(ROOT, "config", "retailers", "fit-house-reviewed-offer-697-oos-2026-08-18.json");
const MANIFEST_SHA256 = "f62ab94e89861f7f42c5aa76cb00cb3fa80697289171b7ba4b02074a4c86d32a";

function invariant(value, message) { if (!value) throw new Error(message); }

function loadReviewedOffer697() {
  const reviewed = loadReviewedMixedChangeManifest(MANIFEST, MANIFEST_SHA256);
  invariant(reviewed.manifest.retailer_id === "9" && reviewed.manifest.row_count === 1
    && reviewed.manifest.immutable_scope_offer_ids[0] === "697",
  "Fit House reviewed offer 697 manifest scope mismatch");
  return reviewed;
}

async function main(argv = process.argv.slice(2)) {
  invariant(argv.includes("--target=production"), "reviewed Fit House offer 697 package is production-only");
  const reviewed = loadReviewedOffer697();
  const operation = (args, diagnostic) => engine.executeRefresh(args, diagnostic, reviewed);
  const completed = await engine.runWithDiagnostic(argv, { operation });
  console.log(JSON.stringify(completed.result));
  return completed.result;
}

if (require.main === module) main().catch((error) => { console.error(error.stack || error); process.exitCode = 1; });

module.exports = { loadReviewedOffer697, main, MANIFEST, MANIFEST_SHA256 };
