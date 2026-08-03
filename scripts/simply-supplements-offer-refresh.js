process.env.RETAILER_REFRESH_PROFILE = "simply-supplements";

const engine = require("./fit-house-offer-refresh");

async function main(argv = process.argv.slice(2)) {
  const completed = await engine.runWithDiagnostic(argv);
  console.log(JSON.stringify(completed.result));
  return completed.result;
}

if (require.main === module) main().catch((error) => {
  console.error(error.stack || error);
  process.exitCode = 1;
});

module.exports = { ...engine, main };
