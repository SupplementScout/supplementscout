const fs = require("node:fs");
const path = require("node:path");
const { spawnSync } = require("node:child_process");
const {
  CONTRACT_FILE,
  REPOSITORY,
  WORKFLOW,
  approvedFromEnv,
  loadAndVerifyContract,
  verifyDatabaseBaseline,
} = require("./lib/ebay-artifact-bound-contract");

const ROOT = path.resolve(__dirname, "..");
const OUT = path.join(ROOT, "tmp", "ebay-offer-refresh");
const APPROVED_DIR = path.join(OUT, "approved-artifact");
function invariant(condition, message) { if (!condition) throw new Error(message); }
function read(file) { return JSON.parse(fs.readFileSync(file, "utf8")); }
function insideTmp(file) { const resolved = path.resolve(file); const relative = path.relative(path.join(ROOT, "tmp"), resolved); invariant(relative && !relative.startsWith("..") && !path.isAbsolute(relative), "Artifact-bound verifier paths must remain inside tmp"); return resolved; }

function parseArgs(argv) {
  const values = {};
  for (const argument of argv) {
    const match = argument.match(/^--(mode|baseline|contract)=(.*)$/);
    invariant(match && values[match[1]] === undefined, `Invalid argument ${argument}`);
    values[match[1]] = match[2];
  }
  invariant(["download", "baseline"].includes(values.mode), "Verifier mode must be download or baseline");
  if (values.mode === "baseline") invariant(values.baseline && values.contract, "Baseline verification requires baseline and contract paths");
  return { mode: values.mode, baseline: values.baseline ? insideTmp(values.baseline) : null, contract: values.contract ? insideTmp(values.contract) : null };
}

async function githubJson(url, token, fetchImpl = fetch) {
  const response = await fetchImpl(url, { headers: { accept: "application/vnd.github+json", authorization: `Bearer ${token}`, "x-github-api-version": "2022-11-28", "user-agent": "SupplementScout-eBay-Artifact-Verifier/1.0" } });
  invariant(response.ok, `GitHub artifact metadata request failed with HTTP ${response.status}`);
  return response.json();
}

function extractZip(zipPath, destination, spawn = spawnSync) {
  const listed = spawn("unzip", ["-Z1", zipPath], { encoding: "utf8", windowsHide: true });
  invariant(listed.status === 0, "Approved artifact ZIP could not be listed");
  const names = listed.stdout.split(/\r?\n/).filter(Boolean);
  invariant(names.length > 0 && names.every((name) => !path.isAbsolute(name) && !name.includes("\\") && name.split("/").every((part) => part && part !== "." && part !== "..")), "Approved artifact ZIP contains an unsafe path");
  fs.mkdirSync(destination, { recursive: true });
  const extracted = spawn("unzip", ["-q", zipPath, "-d", destination], { encoding: "utf8", windowsHide: true });
  invariant(extracted.status === 0, "Approved artifact ZIP could not be extracted");
}

async function downloadAndVerify({ env = process.env, fetchImpl = fetch, spawn = spawnSync, now = new Date(), outDirectory = OUT } = {}) {
  const approved = approvedFromEnv(env);
  invariant(env.GITHUB_ACTIONS === "true" && env.GITHUB_REF === "refs/heads/main" && env.GITHUB_EVENT_NAME === "workflow_dispatch", "Artifact verification requires a manual main-branch GitHub run");
  invariant(env.GITHUB_REPOSITORY === REPOSITORY && env.GITHUB_SHA === approved.commitSha, "Apply workflow repository or commit differs from approval");
  invariant(env.GITHUB_TOKEN, "GitHub artifact read token is missing");
  const api = env.GITHUB_API_URL || "https://api.github.com";
  const run = await githubJson(`${api}/repos/${REPOSITORY}/actions/runs/${approved.runId}`, env.GITHUB_TOKEN, fetchImpl);
  invariant(String(run.id) === approved.runId && run.repository?.full_name === REPOSITORY, "Approved dry-run repository or run ID mismatch");
  invariant(String(run.path || "").split("@")[0] === WORKFLOW && run.name === "eBay Offer Refresh", "Approved run belongs to another workflow");
  invariant(run.conclusion === "success" && run.status === "completed" && run.event === "workflow_dispatch" && run.head_branch === "main" && run.head_sha === approved.commitSha, "Approved dry-run status, branch, event or commit mismatch");
  invariant(Number.isFinite(Date.parse(run.created_at || "")) && Date.parse(run.created_at) <= now.getTime(), "Approved dry-run creation time is invalid");
  const artifact = await githubJson(`${api}/repos/${REPOSITORY}/actions/artifacts/${approved.artifactId}`, env.GITHUB_TOKEN, fetchImpl);
  invariant(String(artifact.id) === approved.artifactId && String(artifact.workflow_run?.id) === approved.runId, "Approved artifact does not belong to the approved dry-run");
  invariant(artifact.name === `ebay-offer-refresh-${approved.runId}-1` && artifact.expired === false, "Approved artifact name drifted or expired");
  invariant(Number.isFinite(Date.parse(artifact.created_at || "")) && Date.parse(artifact.created_at) >= Date.parse(run.created_at) && Number(artifact.size_in_bytes) > 0 && Number(artifact.size_in_bytes) <= 20 * 1024 * 1024, "Approved artifact creation time or size is invalid");
  const approvedDirectory = path.join(outDirectory, "approved-artifact");
  fs.mkdirSync(outDirectory, { recursive: true });
  invariant(!fs.existsSync(approvedDirectory), "Approved artifact directory already exists; replay is blocked");
  const response = await fetchImpl(`${api}/repos/${REPOSITORY}/actions/artifacts/${approved.artifactId}/zip`, { headers: { accept: "application/vnd.github+json", authorization: `Bearer ${env.GITHUB_TOKEN}`, "x-github-api-version": "2022-11-28", "user-agent": "SupplementScout-eBay-Artifact-Verifier/1.0" }, redirect: "follow" });
  invariant(response.ok, `Approved artifact download failed with HTTP ${response.status}`);
  const zipPath = path.join(outDirectory, "approved-artifact.zip");
  const archive = Buffer.from(await response.arrayBuffer());
  invariant(archive.length > 0 && archive.length <= 20 * 1024 * 1024, "Approved artifact archive size is invalid");
  fs.writeFileSync(zipPath, archive, { flag: "wx" });
  extractZip(zipPath, approvedDirectory, spawn);
  const verified = loadAndVerifyContract(approvedDirectory, approved, now);
  const evidence = { schema_version: 2, kind: "ebay-approved-dry-run-verification", result: "PASS", repository: REPOSITORY, workflow: WORKFLOW, run_id: approved.runId, artifact_id: approved.artifactId, commit_sha: approved.commitSha, manifest_sha256: approved.manifestSha256, report_sha256: approved.reportSha256, artifact_content_sha256: verified.manifest.artifact_content_sha256, full_capture_fingerprint: approved.fullCaptureFingerprint, executable_source_fingerprint: approved.executableSourceFingerprint, review_scope_fingerprint: approved.reviewScopeFingerprint, plan_fingerprint: approved.planFingerprint, executable_offer_ids: verified.manifest.executable_offer_ids, review_offer_ids: verified.manifest.review_offer_ids, source_row_fingerprints: verified.manifest.source_row_fingerprints, plan_row_fingerprints: verified.manifest.plan_row_fingerprints, expires_at: verified.manifest.expires_at, database_writes: 0 };
  fs.writeFileSync(path.join(outDirectory, "approved-artifact-verification.json"), `${JSON.stringify(evidence, null, 2)}\n`, { flag: "wx" });
  return evidence;
}

function verifyBaseline(options, env = process.env) {
  const approved = approvedFromEnv(env);
  const directory = path.dirname(options.contract);
  invariant(path.basename(options.contract) === CONTRACT_FILE, "Approved contract filename mismatch");
  const contract = loadAndVerifyContract(directory, approved);
  verifyDatabaseBaseline(contract, read(options.baseline));
  const evidence = { schema_version: 2, kind: "ebay-artifact-bound-db-before-state", result: "PASS", run_id: approved.runId, artifact_id: approved.artifactId, commit_sha: approved.commitSha, full_capture_fingerprint: approved.fullCaptureFingerprint, executable_source_fingerprint: approved.executableSourceFingerprint, review_scope_fingerprint: approved.reviewScopeFingerprint, plan_fingerprint: approved.planFingerprint, baseline_hash: read(options.baseline).evidence_hash, executable_plan_count: contract.report.executable_plan_count, executable_offer_ids: contract.report.execution_offer_ids, database_writes: 0 };
  fs.writeFileSync(path.join(OUT, "approved-db-before-state.json"), `${JSON.stringify(evidence, null, 2)}\n`, { flag: "wx" });
  return evidence;
}

async function run(options, dependencies = {}) { return options.mode === "download" ? downloadAndVerify(dependencies) : verifyBaseline(options, dependencies.env || process.env); }
if (require.main === module) run(parseArgs(process.argv.slice(2))).then((result) => console.log(JSON.stringify(result))).catch((error) => { console.error(error.message); process.exitCode = 1; });
module.exports = { APPROVED_DIR, downloadAndVerify, extractZip, githubJson, parseArgs, run, verifyBaseline };
