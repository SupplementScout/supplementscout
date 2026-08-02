const assert = require("node:assert/strict");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const test = require("node:test");
const {
  SOURCE_KIND,
  buildDryPlan,
  collectApproved,
  fetchOne,
  parseArgs,
  resolveInputInsideTmp,
  runCli,
  validateSourceList,
} = require("./manufacturer-source-collector");
const { validateManifest } = require("./lib/nutrition-candidates");

function source(overrides = {}) {
  return {
    product_id: "337",
    product_name: "Example Official Whey 1kg",
    brand: "Example Nutrition",
    manufacturer: "Example Nutrition",
    source_url: "https://manufacturer.example/product/official-whey/",
    expected_domain: "manufacturer.example",
    source_type: "manufacturer_product_page",
    notes: "Explicit official product URL; approval still required.",
    ...overrides,
  };
}

function sourceList(sources = [source()]) {
  return { schema_version: 1, kind: SOURCE_KIND, sources };
}

function temporaryRepo() {
  const cwd = fs.mkdtempSync(path.join(os.tmpdir(), "manufacturer-source-plan-"));
  const batch = path.join(cwd, "tmp", "manufacturer-source-batch-1");
  fs.mkdirSync(batch, { recursive: true });
  test.after(() => fs.rmSync(cwd, { recursive: true, force: true }));
  return { batch, cwd };
}

test("dry plan validates explicit URLs and performs no network or writes", async () => {
  const repo = temporaryRepo();
  const inputPath = path.join(repo.batch, "sources.json");
  fs.writeFileSync(inputPath, JSON.stringify(sourceList()));
  let calls = 0;
  const before = fs.readdirSync(repo.batch);
  const result = await runCli(["--dry-plan", `--input=${inputPath}`], {
    cwd: repo.cwd,
    fetchImpl: async () => { calls += 1; throw new Error("must not fetch"); },
  });
  assert.equal(calls, 0);
  assert.deepEqual(fs.readdirSync(repo.batch), before);
  assert.equal(result.plan.mode, "DRY_PLAN_NO_NETWORK");
  assert.equal(result.plan.sources[0].robots_url, "https://manufacturer.example/robots.txt");
  assert.equal(result.plan.sources[0].ready_to_fetch, false);
});

test("rejects domain mismatches, credentials, secret parameters and unexpected schema", () => {
  assert.throws(() => validateSourceList(sourceList([source({ source_url: "https://other.example/product/test" })])), /does not match/);
  assert.throws(() => validateSourceList(sourceList([source({ source_url: "https://user:pass@manufacturer.example/product/test" })])), /credential-free HTTPS/);
  assert.throws(() => validateSourceList(sourceList([source({ source_url: "https://manufacturer.example/product/test?token=secret" })])), /forbidden sensitive parameter token/);
  assert.throws(() => validateSourceList(sourceList([source({ extra: true })])), /invalid schema/);
});

test("collection requires both explicit approval confirmations", () => {
  assert.throws(() => parseArgs(["--input=tmp/sources.json"]), /exactly one/);
  assert.throws(() => parseArgs(["--dry-plan", "--collect-approved", "--input=tmp/sources.json"]), /exactly one/);
  assert.throws(() => parseArgs(["--collect-approved", "--input=tmp/sources.json"]), /requires/);
  assert.doesNotThrow(() => parseArgs([
    "--collect-approved", "--confirm-explicit-urls-only=true",
    "--confirm-robots-terms-reviewed=true", "--input=tmp/sources.json",
  ]));
});

test("collector fetches only listed URLs and writes exact hashed raw bytes plus a valid manifest", async () => {
  const repo = temporaryRepo();
  const inputPath = path.join(repo.batch, "sources.json");
  fs.writeFileSync(inputPath, JSON.stringify(sourceList()));
  const html = Buffer.from("<table><tr><th>Protein per serving</th><td>24 g</td></tr></table>");
  const calls = [];
  const result = await collectApproved(sourceList(), inputPath, {
    cwd: repo.cwd,
    now: "2026-08-02T12:00:00.000Z",
    delay: async () => {},
    fetchImpl: async (url, init) => {
      calls.push({ url, init });
      return new Response(html, { status: 200, headers: { "content-type": "text/html" } });
    },
  });
  assert.deepEqual(calls.map((call) => call.url), [source().source_url]);
  assert.equal(calls[0].init.redirect, "manual");
  assert.equal(result.records.length, 1);
  const rawPath = path.join(repo.cwd, result.raw_snapshots[0]);
  assert.deepEqual(fs.readFileSync(rawPath), html);
  const manifest = JSON.parse(fs.readFileSync(path.join(repo.batch, "manifest.json"), "utf8"));
  assert.doesNotThrow(() => validateManifest(manifest));
  assert.equal(manifest.records[0].retailer_id, null);
  assert.equal(manifest.records[0].source_snapshot_ref, result.raw_snapshots[0]);
  assert.match(manifest.records[0].snapshot_sha256, /^[0-9a-f]{64}$/);
});

test("redirects cannot leave the approved domain", async () => {
  await assert.rejects(
    () => fetchOne(source(), async () => new Response(null, {
      status: 302,
      headers: { location: "https://competitor.example/product/copied" },
    })),
    /Cross-domain redirect blocked/,
  );
});

test("HTML is bounded while streaming even without a content-length header", async () => {
  await assert.rejects(
    () => fetchOne(source(), async () => new Response(Buffer.alloc(2_000_001), {
      status: 200,
      headers: { "content-type": "text/html" },
    })),
    /HTML exceeds 2000000 bytes/,
  );
});

test("input remains inside tmp and cannot escape through a junction", () => {
  const repo = temporaryRepo();
  const valid = path.join(repo.batch, "sources.json");
  fs.writeFileSync(valid, JSON.stringify(sourceList()));
  assert.equal(resolveInputInsideTmp(valid, repo.cwd), fs.realpathSync.native(valid));
  const outside = path.join(repo.cwd, "outside");
  fs.mkdirSync(outside);
  fs.writeFileSync(path.join(outside, "sources.json"), JSON.stringify(sourceList()));
  const linked = path.join(repo.cwd, "tmp", "linked");
  fs.symlinkSync(outside, linked, process.platform === "win32" ? "junction" : "dir");
  assert.throws(() => resolveInputInsideTmp(path.join(linked, "sources.json"), repo.cwd), /resolves outside/);
});

test("collector has no crawling, sitemap, Supabase, database or apply path", () => {
  const runtime = fs.readFileSync(path.join(__dirname, "manufacturer-source-collector.js"), "utf8");
  assert.doesNotMatch(runtime, /sitemap|cheerio|playwright|puppeteer|createClient|@supabase|require\(["']pg["']\)|--apply/i);
  assert.doesNotMatch(runtime, /supabase\s*\.\s*from\s*\(|\.rpc\s*\(|\b(?:insert|update|delete)\s+(?:into\s+|from\s+)?public\./i);
  const plan = buildDryPlan(sourceList(), "C:\\repo\\tmp\\batch\\sources.json", "C:\\repo");
  assert.equal(plan.network_requests, 0);
});
