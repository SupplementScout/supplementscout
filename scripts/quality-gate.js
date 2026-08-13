const crypto = require("node:crypto");
const fs = require("node:fs");
const path = require("node:path");
const { spawnSync } = require("node:child_process");

const root = path.resolve(__dirname, "..");
const manifestPath = path.join(__dirname, "quality-gate-manifest.json");
const BATCH_SIZE = 30;
const PROTECTED_ENVIRONMENT_KEYS = [
  "SUPABASE_SERVICE_ROLE_KEY",
  "SUPABASE_ACCESS_TOKEN",
  "DATABASE_URL",
  "DIRECT_URL",
  "POSTGRES_URL",
  "POSTGRES_PRISMA_URL",
  "POSTGRES_URL_NON_POOLING",
  "PGHOST",
  "PGPASSWORD",
  "PGUSER",
  "GOOGLE_APPLICATION_CREDENTIALS"
];

function walk(directory) {
  return fs.readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const absolute = path.join(directory, entry.name);
    return entry.isDirectory() ? walk(absolute) : [absolute];
  });
}

function relativeTestFiles() {
  return walk(path.join(root, "scripts"))
    .filter((file) => file.endsWith(".test.js"))
    .map((file) => path.relative(root, file).replaceAll(path.sep, "/"))
    .sort();
}

function inventorySha256(files) {
  return crypto.createHash("sha256").update(files.join("\n")).digest("hex");
}

function loadManifest() {
  return JSON.parse(fs.readFileSync(manifestPath, "utf8"));
}

function classifyInventory(manifest, files) {
  const actualHash = inventorySha256(files);
  if (files.length !== manifest.inventory.count || actualHash !== manifest.inventory.sha256) {
    throw new Error(
      `Test inventory changed: expected ${manifest.inventory.count}/${manifest.inventory.sha256}, ` +
      `received ${files.length}/${actualHash}. Review and update quality-gate-manifest.json.`
    );
  }

  const known = new Set(files);
  const integration = new Set(manifest.integration);
  const artifact = new Set(manifest.artifact.map((entry) => entry.file));
  const quick = new Set(manifest.quick);
  for (const [category, entries] of [["integration", integration], ["artifact", artifact], ["quick", quick]]) {
    for (const file of entries) {
      if (!known.has(file)) throw new Error(`${category} manifest entry does not exist: ${file}`);
    }
  }
  for (const file of quick) {
    if (integration.has(file) || artifact.has(file)) throw new Error(`Quick test cannot be isolated from CI: ${file}`);
  }
  for (const file of integration) {
    if (artifact.has(file)) throw new Error(`Test cannot be both integration and artifact-classified: ${file}`);
  }
  for (const entry of manifest.artifact) {
    if (!entry.reason || !entry.reason.trim()) throw new Error(`Artifact test requires a reason: ${entry.file}`);
  }

  return {
    all: files,
    safe: files.filter((file) => !integration.has(file) && !artifact.has(file)),
    integration: [...integration].sort(),
    artifact: [...artifact].sort(),
    quick: [...quick].sort()
  };
}

function sanitizedEnvironment(nodeEnvironment = "test", isolatedBuild = false) {
  const environment = { ...process.env, CI: "true", NODE_ENV: nodeEnvironment, QUALITY_GATE: "1" };
  for (const key of PROTECTED_ENVIRONMENT_KEYS) environment[key] = "";
  if (isolatedBuild) {
    environment.NEXT_PUBLIC_SUPABASE_URL = "http://127.0.0.1:54321";
    environment.NEXT_PUBLIC_SUPABASE_ANON_KEY = "quality-gate-anon-key";
    environment.SUPABASE_URL = "http://127.0.0.1:54321";
    environment.SUPABASE_ANON_KEY = "quality-gate-anon-key";
    environment.SUPABASE_SERVICE_ROLE_KEY = "quality-gate-local-only-key";
  }
  return environment;
}

function run(label, command, args, options = {}) {
  process.stdout.write(`\n=== ${label} ===\n`);
  const result = spawnSync(command, args, {
    cwd: root,
    env: sanitizedEnvironment(options.nodeEnvironment, options.isolatedBuild),
    stdio: "inherit",
    shell: options.shell === true
  });
  if (result.error) throw result.error;
  if (result.status !== 0) throw new Error(`${label} failed with exit code ${result.status}`);
}

function runTests(label, files) {
  for (let index = 0; index < files.length; index += BATCH_SIZE) {
    const batch = files.slice(index, index + BATCH_SIZE);
    run(`${label} (${index + 1}-${index + batch.length} of ${files.length})`, process.execPath, [
      "--test",
      "--test-concurrency=1",
      ...batch
    ]);
  }
}

function runLocalNodeTool(label, relativeTool, args, nodeEnvironment = "test", isolatedBuild = false) {
  run(label, process.execPath, [relativeTool, ...args], { nodeEnvironment, isolatedBuild });
}

function printInventory(classification) {
  console.log("QUALITY GATE INVENTORY: PASS");
  console.log(`All tests: ${classification.all.length}`);
  console.log(`Safe tests: ${classification.safe.length}`);
  console.log(`Integration tests: ${classification.integration.length}`);
  console.log(`Artifact-bound tests: ${classification.artifact.length}`);
  console.log(`Quick smoke tests: ${classification.quick.length}`);
}

function main(argv = process.argv.slice(2)) {
  const mode = argv[0] || "quick";
  const classification = classifyInventory(loadManifest(), relativeTestFiles());
  printInventory(classification);

  if (mode === "inventory") return;
  if (mode === "quick") {
    run("Project Guardian", process.execPath, ["scripts/project-guardian.js"]);
    runLocalNodeTool("TypeScript", "node_modules/typescript/bin/tsc", ["--noEmit"]);
    runLocalNodeTool("ESLint", "node_modules/eslint/bin/eslint.js", ["."]);
    runTests("Quick tests", classification.quick);
  } else if (mode === "safe") {
    runTests("Safe tests", classification.safe);
  } else if (mode === "full") {
    run("Project Guardian", process.execPath, ["scripts/project-guardian.js"]);
    runLocalNodeTool("TypeScript", "node_modules/typescript/bin/tsc", ["--noEmit"]);
    runLocalNodeTool("ESLint", "node_modules/eslint/bin/eslint.js", ["."]);
    runTests("Safe tests", classification.safe);
    run("Baseline migration validation", process.execPath, ["scripts/verify-baseline-migrations.js"]);
    runLocalNodeTool("Next.js production build", "node_modules/next/dist/bin/next", ["build"], "production", true);
  } else if (mode === "integration") {
    runTests("Integration tests", classification.integration);
  } else {
    throw new Error(`Unknown quality-gate mode: ${mode}`);
  }

  console.log(`\nQUALITY GATE ${mode.toUpperCase()}: PASS`);
}

if (require.main === module) {
  try {
    main();
  } catch (error) {
    console.error(`\nQUALITY GATE: FAIL\n${error.message}`);
    process.exitCode = 1;
  }
}

module.exports = {
  classifyInventory,
  inventorySha256,
  relativeTestFiles,
  sanitizedEnvironment
};
