const assert = require("node:assert/strict");
const { execFileSync } = require("node:child_process");
const fs = require("node:fs");
const { performance } = require("node:perf_hooks");
const vm = require("node:vm");
const ts = require("typescript");

// Read-only, local microbenchmark. Extract the actual comparator and the shared
// regression fixture; do not maintain a second implementation of search ranking.
const baselineSha = process.argv[2];
assert.match(baselineSha || "", /^[a-f0-9]{40}$/, "Supply the full baseline commit SHA");
const baseline = execFileSync("git", ["show", `${baselineSha}:app/lib/products.ts`], { encoding: "utf8" });
const current = fs.readFileSync("app/lib/products.ts", "utf8");
const tests = fs.readFileSync("scripts/search.test.js", "utf8");
const sorts = ["relevance", "price_asc", "price_desc", "price_per_serving_asc", "cost_per_25g_protein_asc", "cost_per_5g_creatine_asc"];

function functions(source, names) {
  const ast = ts.createSourceFile("fixture.ts", source, ts.ScriptTarget.Latest, true);
  const declarations = ast.statements.filter((node) => ts.isFunctionDeclaration(node) && names.includes(node.name?.text));
  assert.equal(declarations.length, names.length, "Benchmark source functions must exist");
  return declarations.map((node) => node.getText(ast)).join("\n");
}

function load(source, instrument = false) {
  let code = functions(source, ["sortResults", "compareSearchResultPrices"]);
  if (instrument) {
    assert.equal(code.split("const fallback =").length, 2);
    code = code.replace("const fallback =", "globalThis.priceComparisons++;\nconst fallback =");
  }
  code += "\n" + functions(tests, ["sortCostFixture"]);
  const context = vm.createContext({ priceComparisons: 0 });
  vm.runInContext(ts.transpile(code, { target: ts.ScriptTarget.ES2022 }), context);
  vm.runInContext("var rows = sortCostFixture();", context);
  return {
    context,
    run: (sort, iterations) => vm.runInContext(`for(let i=0;i<${iterations};i++) sortResults(rows, '${sort}');`, context),
    ids: (sort) => vm.runInContext(`sortResults(rows, '${sort}').map(row => row.id)`, context),
  };
}

const code = { before: load(baseline), after: load(current) };
const instrumented = { before: load(baseline, true), after: load(current, true) };
const median = (values) => [...values].sort((a, b) => a - b)[Math.floor(values.length / 2)];
const results = [];
const iterations = 100;
const batches = 15;
for (const sort of sorts) {
  assert.equal(JSON.stringify(code.before.ids(sort)), JSON.stringify(code.after.ids(sort)), sort);
  for (const entry of Object.values(code)) entry.run(sort, 50);
  const samples = { before: { wallMs: [], cpuMs: [] }, after: { wallMs: [], cpuMs: [] } };
  for (let batch = 0; batch < batches; batch++) {
    for (const revision of batch % 2 ? ["after", "before"] : ["before", "after"]) {
      const cpuStart = process.cpuUsage();
      const start = performance.now();
      code[revision].run(sort, iterations);
      samples[revision].wallMs.push((performance.now() - start) / iterations);
      const cpu = process.cpuUsage(cpuStart);
      samples[revision].cpuMs.push((cpu.user + cpu.system) / 1000 / iterations);
    }
  }
  const priceComparisons = {};
  for (const [revision, entry] of Object.entries(instrumented)) {
    entry.context.priceComparisons = 0;
    entry.run(sort, 1);
    priceComparisons[revision] = entry.context.priceComparisons;
  }
  results.push({ sort, candidates: 1000, orderParity: "PASS", priceComparisons,
    median: Object.fromEntries(Object.entries(samples).map(([revision, values]) => [revision, {
      wallMs: median(values.wallMs), cpuMs: median(values.cpuMs),
    }])), samples,
  });
}
console.log(JSON.stringify({
  at: new Date().toISOString(), node: process.version, baselineSha,
  method: "Comparator microbenchmark, not whole search request or Vercel CPU. Actual baseline/current functions; shared 1000-candidate fixture; 50 warmups, 15 alternating batches of 100 sorts. Process CPU includes user and system time; invocation counts measured separately.",
  results,
}, null, 2));
