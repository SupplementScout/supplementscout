const { assertOwnerExecutionContext, loadReviewedBatch } = require("./lib/six-pack-reviewed-owner-approval");
const fs = require("node:fs");
const path = require("node:path");

async function run(env = process.env) {
  const reviewed = loadReviewedBatch(env.REVIEWED_BATCH_FINGERPRINT);
  const context = await assertOwnerExecutionContext(reviewed.batch, env);
  const report = { schema_version: 1, kind: "six-pack-reviewed-owner-context", result: "PASS", reviewed_batch_fingerprint: reviewed.batch.reviewed_batch_fingerprint, ...context };
  if (env.REVIEWED_CONTEXT_OUTPUT) {
    const output = path.resolve(env.REVIEWED_CONTEXT_OUTPUT);
    const root = path.resolve(__dirname, "..");
    const relative = path.relative(path.join(root, "tmp"), output);
    if (!relative || relative.startsWith("..") || path.isAbsolute(relative)) throw new Error("Reviewed context output must be inside repository tmp");
    fs.mkdirSync(path.dirname(output), { recursive: true }); fs.writeFileSync(output, `${JSON.stringify(report, null, 2)}\n`);
  }
  return report;
}

if (require.main === module) run().then((value) => console.log(JSON.stringify(value, null, 2))).catch((error) => { console.error(`${error.code || "BLOCK"}: ${error.message}`); process.exitCode = 1; });
module.exports = { run };
