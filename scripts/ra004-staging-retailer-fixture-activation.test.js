const assert = require("node:assert/strict");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const test = require("node:test");

const activation = require("./ra004-staging-retailer-fixture-activation");
const launcher = fs.readFileSync(
  path.join(__dirname, "ra004-run-staging-retailer-fixture-activation.ps1"),
  "utf8",
);

const STAGING_URL = `postgresql://postgres.${activation.REF}:correct-password@aws-0-eu-west-3.pooler.supabase.com:5432/postgres`;
const TOKEN = `sbp_${"a".repeat(40)}`;
const COUNTS = Object.freeze({
  retailers: "12",
  products: "1337",
  product_variants: "3632",
  retailer_products: "3758",
  offers: "3758",
  price_history: "13045",
});

async function withFakeCli(run) {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), "ra004-fixture-cli-"));
  const cli = path.join(directory, "supabase.exe");
  fs.writeFileSync(cli, "test only\n");
  try { return await run(cli); } finally { fs.rmSync(directory, { recursive: true, force: true }); }
}

function runtimeEnvironment(cli, overrides = {}) {
  return {
    RA004_FIXTURE_CONFIRM: activation.CONFIRMATION,
    RA004_FIXTURE_OWNER_DATABASE_URL: STAGING_URL,
    RA004_FIXTURE_SUPABASE_ACCESS_TOKEN: TOKEN,
    RA004_FIXTURE_SUPABASE_CLI_PATH: cli,
    ...overrides,
  };
}

function beforeSnapshot() {
  return { rows: [], counts: { ...COUNTS } };
}

function afterSnapshot(overrides = {}) {
  return {
    rows: [{
      id: "15",
      name: "10 Reps",
      slug: "10-reps",
      website: null,
      logo: null,
      affiliate_network: null,
      affiliate_id: null,
    }],
    counts: { ...COUNTS, retailers: "13" },
    ...overrides,
  };
}

test("runtime accepts only the exact staging owner target and explicit confirmation", () => withFakeCli((cli) => {
  const result = activation.validateRuntimeEnvironment(runtimeEnvironment(cli));
  assert.equal(result.databasePassword, "correct-password");
  assert.equal(result.cli, cli);

  for (const [key, value, expected] of [
    ["RA004_FIXTURE_CONFIRM", "wrong", /CONFIRMATION_MISMATCH/],
    ["RA004_FIXTURE_SUPABASE_ACCESS_TOKEN", "not-a-pat", /ACCESS_TOKEN_REJECTED/],
    ["RA004_FIXTURE_OWNER_DATABASE_URL", "postgresql://postgres:pw@db.aftboxmrdgyhizicfsfu.supabase.co/postgres", /HOST_REJECTED|PRODUCTION_TARGET_REJECTED/],
    ["RA004_FIXTURE_OWNER_DATABASE_URL", "postgresql://service_role:pw@aws-0-eu-west-3.pooler.supabase.com/postgres", /USER_REJECTED/],
    ["RA004_FIXTURE_OWNER_DATABASE_URL", `postgresql://postgres.${activation.REF}@aws-0-eu-west-3.pooler.supabase.com/postgres`, /PASSWORD_MISSING/],
  ]) assert.throws(() => activation.validateRuntimeEnvironment(runtimeEnvironment(cli, { [key]: value })), expected);
}));

test("snapshot contract permits one minimal staging row and no other business change", () => {
  const before = beforeSnapshot();
  activation.assertBeforeSnapshot(before);
  assert.equal(activation.assertAfterSnapshot(before, afterSnapshot()).id, "15");

  assert.throws(() => activation.assertBeforeSnapshot(afterSnapshot()), /ALREADY_PRESENT_OR_AMBIGUOUS/);
  assert.throws(() => activation.assertAfterSnapshot(before, afterSnapshot({ rows: [{ ...afterSnapshot().rows[0], id: "14" }] })), /POST_RETAILER_MISMATCH/);
  assert.throws(() => activation.assertAfterSnapshot(before, afterSnapshot({ rows: [{ ...afterSnapshot().rows[0], website: "https:\/\/example.test" }] })), /POST_RETAILER_MISMATCH/);
  assert.throws(() => activation.assertAfterSnapshot(before, afterSnapshot({ counts: { ...afterSnapshot().counts, offers: "3759" } })), /FORBIDDEN_DELTA_offers/);
});

test("Supabase secrets are environment-only and unrelated process secrets are not inherited", () => {
  const calls = [];
  const old = process.env.RA004_UNRELATED_SECRET;
  process.env.RA004_UNRELATED_SECRET = "must-not-cross-process-boundary";
  try {
    const stdout = activation.runCli("C:\\test\\supabase.exe", ["db", "push", "--linked"], {
      SUPABASE_ACCESS_TOKEN: TOKEN,
      SUPABASE_DB_PASSWORD: "correct-password",
    }, (command, args, options) => {
      calls.push({ command, args, options });
      return { status: 0, stdout: "ok\n" };
    });
    assert.equal(stdout, "ok");
    assert.deepEqual(calls[0].args, ["db", "push", "--linked"]);
    assert.doesNotMatch(JSON.stringify(calls[0].args), /correct-password|sbp_/);
    assert.equal(calls[0].options.env.SUPABASE_ACCESS_TOKEN, TOKEN);
    assert.equal(calls[0].options.env.SUPABASE_DB_PASSWORD, "correct-password");
    assert.equal(calls[0].options.env.RA004_UNRELATED_SECRET, undefined);
  } finally {
    if (old === undefined) delete process.env.RA004_UNRELATED_SECRET;
    else process.env.RA004_UNRELATED_SECRET = old;
  }
});

test("executor performs exactly one guarded staging push and no canary or production action", async () => withFakeCli(async (cli) => {
  const manifest = JSON.parse(fs.readFileSync(activation.ACTIVATION, "utf8"));
  const remoteStates = [
    { databaseTarget: "staging-target", remoteLedger: Array.from({ length: 94 }, (_, index) => ({ version: String(index) })) },
    { databaseTarget: "staging-target", remoteLedger: Array.from({ length: 95 }, (_, index) => ({ version: String(index) })) },
  ];
  let validation = 0;
  let snapshots = 0;
  const cliCalls = [];
  const selectorApi = {
    readRemoteState: async () => remoteStates.shift(),
    validateSelection: ({ activationManifest }) => {
      validation += 1;
      if (activationManifest) return {
        pending_files: [activation.MIGRATION],
        pending_file: activation.MIGRATION,
        pending_sha256: activation.MIGRATION_SHA,
      };
      return {
        ledger_count: manifest.post_activation_ledger.count,
        ledger_fingerprint: manifest.post_activation_ledger.fingerprint,
      };
    },
    materializeSelectedWorkdir: ({ selection }) => assert.deepEqual(selection.pending_files, [activation.MIGRATION]),
  };
  const receipt = await activation.executeActivation({
    environment: runtimeEnvironment(cli),
    selectorApi,
    snapshotReader: async () => snapshots++ === 0 ? beforeSnapshot() : afterSnapshot(),
    spawn: (_command, args, options) => {
      cliCalls.push({ args, env: options.env });
      return { status: 0, stdout: args[0] === "--version" ? "2.111.0\n" : "ok\n" };
    },
  });

  assert.equal(validation, 2);
  assert.equal(cliCalls.filter(({ args }) => args.join(" ").startsWith("db push ")).length, 1);
  assert.equal(cliCalls.filter(({ args }) => args[0] === "link").length, 1);
  assert.equal(receipt.status, "VERIFIED_COMPLETE");
  assert.equal(receipt.application_attempt_count, 1);
  assert.equal(receipt.row_count_deltas.retailers, "1");
  assert.equal(receipt.row_count_deltas.offers, "0");
  assert.equal(receipt.production_actions, 0);
  assert.equal(receipt.canary_actions, 0);
}));

test("executor fails before push on an existing retailer and never retries a failed push", async () => withFakeCli(async (cli) => {
  const makeSelector = () => ({
    readRemoteState: async () => ({ databaseTarget: "staging-target", remoteLedger: Array.from({ length: 94 }, (_, index) => ({ version: String(index) })) }),
    validateSelection: () => ({ pending_files: [activation.MIGRATION], pending_file: activation.MIGRATION, pending_sha256: activation.MIGRATION_SHA }),
    materializeSelectedWorkdir: () => {},
  });
  let calls = 0;
  await assert.rejects(activation.executeActivation({
    environment: runtimeEnvironment(cli),
    selectorApi: makeSelector(),
    snapshotReader: async () => afterSnapshot(),
    spawn: () => { calls += 1; return { status: 0, stdout: "2.111.0\n" }; },
  }), /ALREADY_PRESENT_OR_AMBIGUOUS/);
  assert.equal(calls, 0);

  const pushCalls = [];
  await assert.rejects(activation.executeActivation({
    environment: runtimeEnvironment(cli),
    selectorApi: makeSelector(),
    snapshotReader: async () => beforeSnapshot(),
    spawn: (_command, args) => {
      pushCalls.push(args);
      if (args[0] === "--version") return { status: 0, stdout: "2.111.0\n" };
      if (args[0] === "link") return { status: 0, stdout: "ok\n" };
      return { status: 1, stderr: "simulated failure" };
    },
  }), /SUPABASE_CLI_FAILED_1/);
  assert.equal(pushCalls.filter((args) => args[0] === "db" && args[1] === "push").length, 1);
}));

test("errors redact database URLs and Supabase access tokens", () => {
  const message = activation.redact(`failed ${STAGING_URL} ${TOKEN}`);
  assert.doesNotMatch(message, /correct-password|sbp_/);
  assert.match(message, /REDACTED_DATABASE_URL/);
  assert.match(message, /REDACTED_ACCESS_TOKEN/);
});

test("operator launcher asks only for masked staging URL and PAT and clears them", () => {
  assert.equal((launcher.match(/ConvertFrom-MaskedInput/g) || []).length, 3);
  assert.match(launcher, /Staging database URL/);
  assert.match(launcher, /personal access token/);
  assert.match(launcher, /Read-Host 'Wpisz APPLY/);
  assert.match(launcher, /RA004_FIXTURE_CONFIRM = \$confirmation/);
  assert.match(launcher, /RA004_FIXTURE_OWNER_DATABASE_URL = ''/);
  assert.match(launcher, /RA004_FIXTURE_SUPABASE_ACCESS_TOKEN = ''/);
  assert.doesNotMatch(launcher, /publishable|anon key|auth user|auth password/i);
  assert.doesNotMatch(launcher, /staging-execution-coordinator|control-state|preflight/i);
});
