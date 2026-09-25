const fs = require("node:fs");
const path = require("node:path");
const {
  CONTROL_MIGRATION, PREFLIGHT_MIGRATION, ROOT,
  fail, validateAuthorization,
} = require("./lib/retailer-offer-sync/ra004-staging-preflight-v1/contract");
const { LocalFixtureTransport } = require("./lib/retailer-offer-sync/ra004-staging-preflight-v1/fixture-transport");
const { createClosedProvider } = require("./lib/retailer-offer-sync/ra004-staging-preflight-v1/provider");
const { runPreflight } = require("./lib/retailer-offer-sync/ra004-staging-preflight-v1/runner");

const REQUIRED = Object.freeze([
  "authorization", "output", "baseline", "decision-fingerprint", "plan-fingerprint",
  "control-migration-sha", "preflight-migration-sha", "project-reference", "canonical-host",
  "host-allowlist", "retailer-name", "retailer-slug", "provider-mode",
]);

function parseArgs(argv) {
  const values = {};
  const allowed = new Set([...REQUIRED, "fixture"]);
  for (const argument of argv) {
    const match = argument.match(/^--([a-z-]+)=(.+)$/);
    if (!match || !allowed.has(match[1]) || Object.hasOwn(values, match[1])) fail("RA004_PREFLIGHT_CLI_INVALID", `invalid argument ${argument}`);
    values[match[1]] = match[2];
  }
  for (const key of REQUIRED) if (!values[key]) fail("RA004_PREFLIGHT_CLI_INVALID", `missing --${key}`);
  if (values["retailer-name"] !== "10 Reps" || values["retailer-slug"] !== "10-reps") fail("RA004_PREFLIGHT_CLI_INVALID", "exactly one 10 Reps retailer is required");
  if (!/^[0-9a-f]{40}$/.test(values.baseline) || ![values["decision-fingerprint"], values["plan-fingerprint"], values["control-migration-sha"], values["preflight-migration-sha"]].every((value) => /^[0-9a-f]{64}$/.test(value))) fail("RA004_PREFLIGHT_CLI_INVALID", "baseline and fingerprints are required");
  if (values["provider-mode"] !== "fixture" && values["provider-mode"] !== "live-read-only") fail("RA004_PREFLIGHT_CLI_INVALID", "provider mode must be explicit");
  if (values["provider-mode"] === "fixture" && !values.fixture) fail("RA004_PREFLIGHT_CLI_INVALID", "fixture mode requires a local fixture");
  if (values["provider-mode"] === "live-read-only" && values.fixture) fail("RA004_PREFLIGHT_CLI_INVALID", "live mode cannot consume a fixture");
  const hosts = values["host-allowlist"].split(",");
  if (!hosts.includes(values["canonical-host"])) fail("RA004_PREFLIGHT_CLI_INVALID", "canonical host is outside the allowlist");
  if (/(?:prod|production|aftboxmrdgyhizicfsfu)/i.test(`${values["project-reference"]} ${hosts.join(" ")}`)) fail("RA004_PREFLIGHT_CLI_TARGET_BLOCKED", "production target rejected");
  const output = path.resolve(values.output);
  const relative = path.relative(path.join(ROOT, "tmp"), output);
  if (!relative || relative.startsWith("..") || path.isAbsolute(relative)) fail("RA004_PREFLIGHT_CLI_INVALID", "output must be a new file below tmp");
  return Object.freeze({ ...values, output, hosts: Object.freeze(hosts) });
}

function readJson(filename) { return JSON.parse(fs.readFileSync(path.resolve(filename), "utf8")); }

async function run(argv = process.argv.slice(2), dependencies = {}) {
  const options = parseArgs(argv);
  const authorization = readJson(options.authorization);
  const expected = {
    provider_mode: options["provider-mode"], baseline_sha: options.baseline,
    decision_fingerprint: options["decision-fingerprint"], plan_fingerprint: options["plan-fingerprint"],
    control_migration: { path: CONTROL_MIGRATION, sha256: options["control-migration-sha"] },
    preflight_migration: { path: PREFLIGHT_MIGRATION, sha256: options["preflight-migration-sha"] },
    project_reference: options["project-reference"], canonical_host: options["canonical-host"],
    host_allowlist: options.hosts,
  };
  const now = dependencies.now || new Date().toISOString();
  // This explicit precheck guarantees the current NOT_AUTHORIZED pack stops before provider construction.
  const approved = validateAuthorization(authorization, expected, now);
  let transport = dependencies.transport;
  if (!transport && options["provider-mode"] === "fixture") transport = new LocalFixtureTransport(options.fixture);
  if (!transport) fail("BLOCKED_TARGET_CONFIGURATION", "no approved Q1/Q8 live transport is configured");
  const providerBundle = createClosedProvider({
    configuration: {
      environment: "STAGING", project_reference: approved.target.project_reference,
      canonical_host: approved.target.canonical_host, host_allowlist: approved.target.host_allowlist,
      expected_session_user: approved.credential_design.role_name,
    }, transport,
  });
  return runPreflight({ authorization, expected, providerBundle, outputPath: options.output, now, evidenceOptions: dependencies.evidenceOptions });
}

if (require.main === module) {
  run().then((result) => process.stdout.write(`${JSON.stringify({ status: result.report.status, report: result.reportArtifact, revoke_receipt: result.receiptArtifact })}\n`))
    .catch((error) => { process.stderr.write(`${error.code || "RA004_PREFLIGHT_FAILED"}: ${String(error.message).replace(/(?:postgres(?:ql)?:\/\/|bearer\s+)[^\s]+/gi, "[REDACTED]")}\n`); process.exitCode = 1; });
}

module.exports = { parseArgs, run };
