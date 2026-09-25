const fs = require("node:fs");
const path = require("node:path");
const { exportControlState, writeArtifact } = require("./lib/retailer-offer-sync/control-state-export-v1/exporter");
const { FixtureControlStateProvider, createLiveReadOnlyProvider } = require("./lib/retailer-offer-sync/control-state-export-v1/providers");
const { validateAuthorization } = require("./lib/retailer-offer-sync/control-state-export-v1/authorization");

const ROOT = path.resolve(__dirname, "..");

function fail(message) { throw new Error(message); }
function parseArgs(argv) {
  const values = {};
  const allowed = new Set(["retailer-id", "retailer-name", "authorization", "output", "baseline", "provider-mode", "fixture", "provider-config"]);
  for (const argument of argv) {
    const match = argument.match(/^--([a-z-]+)=(.+)$/);
    if (!match || !allowed.has(match[1]) || Object.hasOwn(values, match[1])) fail(`Invalid argument ${argument}`);
    values[match[1]] = match[2];
  }
  for (const key of ["retailer-id", "retailer-name", "authorization", "output", "baseline", "provider-mode"]) if (!values[key]) fail(`Missing --${key}`);
  if (!/^[0-9]+$/.test(values["retailer-id"]) || !/^[0-9a-f]{40}$/.test(values.baseline)) fail("Invalid retailer or baseline identity");
  if (!new Set(["fixture", "live-read-only"]).has(values["provider-mode"])) fail("Unsupported provider mode");
  if (values["provider-mode"] === "fixture" && !values.fixture) fail("Fixture mode requires --fixture");
  if (values["provider-mode"] === "live-read-only" && !values["provider-config"]) fail("Live mode requires --provider-config");
  const output = path.resolve(values.output);
  const outputRoot = path.join(ROOT, "tmp", "control-state-exports");
  const relative = path.relative(outputRoot, output);
  if (!relative || relative.startsWith("..") || path.isAbsolute(relative)) fail("Output must be a new file below tmp/control-state-exports");
  return { ...values, output };
}
function readJson(file) { return JSON.parse(fs.readFileSync(path.resolve(file), "utf8")); }

async function run(argv = process.argv.slice(2), now = new Date().toISOString(), dependencies = {}) {
  const options = parseArgs(argv);
  const authorization = readJson(options.authorization);
  let provider;
  if (options["provider-mode"] === "fixture") {
    provider = new FixtureControlStateProvider(readJson(options.fixture));
  } else {
    const validated = validateAuthorization(authorization, {
      retailer_id: options["retailer-id"], retailer_name: options["retailer-name"],
      baseline_sha: options.baseline, provider_mode: options["provider-mode"],
    }, now);
    provider = createLiveReadOnlyProvider({
      authorization: validated,
      providerConfiguration: readJson(options["provider-config"]),
      transport: dependencies.transport,
    });
  }
  const report = await exportControlState({
    provider,
    authorization,
    retailer_id: options["retailer-id"],
    retailer_name: options["retailer-name"],
    baseline_sha: options.baseline,
    provider_mode: options["provider-mode"],
    now,
  });
  return writeArtifact(options.output, report);
}

if (require.main === module) {
  run().then((result) => process.stdout.write(`${JSON.stringify(result)}\n`)).catch((error) => {
    process.stderr.write(`${error.message}\n`);
    process.exitCode = 1;
  });
}

module.exports = { parseArgs, run };
