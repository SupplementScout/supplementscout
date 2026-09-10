const crypto = require("node:crypto");
const fs = require("node:fs");
const path = require("node:path");

const directory = path.resolve(__dirname, "..", "tmp", "ebay-offer-refresh");
const contractPath = path.join(directory, "production-dry-run-contract.json");
const reportPath = path.join(directory, "production-dry-run.json");
function sha256(file) { return crypto.createHash("sha256").update(fs.readFileSync(file)).digest("hex"); }
function run(env = process.env) {
  if (!env.GITHUB_OUTPUT) throw new Error("GITHUB_OUTPUT_MISSING");
  const contract = JSON.parse(fs.readFileSync(contractPath, "utf8"));
  const reportSha256 = sha256(reportPath);
  if (contract.report_sha256 !== reportSha256 || !/^[0-9a-f]{64}$/.test(contract.artifact_content_sha256 || "") || !/^[0-9a-f]{64}$/.test(contract.review_scope_fingerprint || "")) throw new Error("EBAY_REVIEW_SOURCE_BINDING_INVALID");
  const values = { contract_sha256: sha256(contractPath), report_sha256: reportSha256, content_sha256: contract.artifact_content_sha256, review_scope_fingerprint: contract.review_scope_fingerprint };
  fs.appendFileSync(env.GITHUB_OUTPUT, Object.entries(values).map(([key, value]) => `${key}=${value}`).join("\n") + "\n");
  return values;
}
if (require.main === module) { try { console.log(JSON.stringify(run())); } catch (error) { console.error(error.message); process.exitCode = 1; } }
module.exports = { run };
