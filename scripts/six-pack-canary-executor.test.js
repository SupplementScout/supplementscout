const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");
const { parseArgs, plansForMode, validateRollout } = require("./six-pack-canary-executor");

const ROOT = path.resolve(__dirname, "..");

function artifact(action) {
  return {
    plans: Array.from({ length: 6 }, (_, index) => ({
      row_number: String(index + 2),
      resolved_plan: {
        retailer: action === "create"
          ? { action, values: { slug: "6-pack-supplements" } }
          : { action, id: "10" },
      },
    })),
  };
}

test("bootstrap executes only the first create plan and becomes a no-op after bootstrap", () => {
  assert.equal(plansForMode(artifact("create"), "bootstrap").length, 1);
  assert.equal(plansForMode(artifact("existing"), "bootstrap").length, 0);
});

test("full execution requires every plan to bind the existing retailer", () => {
  assert.equal(plansForMode(artifact("existing"), "all").length, 6);
  assert.throws(() => plansForMode(artifact("create"), "all"), /retailer already present/);
  const mixed = artifact("existing");
  mixed.plans[2].resolved_plan.retailer = { action: "create", values: { slug: "6-pack-supplements" } };
  assert.throws(() => plansForMode(mixed, "all"), /retailer already present/);
});

test("CLI confines execution evidence to tmp", () => {
  assert.throws(() => parseArgs([]), /Required --mode/);
  assert.throws(
    () => parseArgs(["--mode=all", "--artifact=a", "--csv=b", "--rollout=c", "--output=outside.json"]),
    /inside repository tmp/
  );
});

test("executor accepts the exact reviewed V11 19-offer rollout", () => {
  const csv = path.join(ROOT, "config", "retailers", "six-pack-production-expansion-v11.csv");
  const rolloutPath = path.join(ROOT, "config", "retailers", "six-pack-production-expansion-v11.json");
  const rollout = JSON.parse(fs.readFileSync(rolloutPath, "utf8"));
  const loaded = {
    artifact: {
      source_file_sha256: rollout.csv_sha256,
      plans: rollout.expected_external_variant_ids.map(() => ({})),
      source_rows: rollout.expected_external_variant_ids.map((externalVariantId) => ({
        normalized_source_row: { external_variant_id: externalVariantId },
      })),
    },
  };
  assert.equal(
    validateRollout({ csv, rollout: rolloutPath }, loaded).row_count,
    19
  );
});

test("executor accepts the exact reviewed V12 65-offer rollout", () => {
  const csv = path.join(
    ROOT,
    "config",
    "retailers",
    "six-pack-production-expansion-v12.csv"
  );
  const rolloutPath = path.join(
    ROOT,
    "config",
    "retailers",
    "six-pack-production-expansion-v12.json"
  );
  const rollout = JSON.parse(fs.readFileSync(rolloutPath, "utf8"));
  const loaded = {
    artifact: {
      source_file_sha256: rollout.csv_sha256,
      plans: rollout.expected_external_variant_ids.map(() => ({})),
      source_rows: rollout.expected_external_variant_ids.map(
        (externalVariantId) => ({
          normalized_source_row: {
            external_variant_id: externalVariantId,
          },
        })
      ),
    },
  };
  assert.equal(
    validateRollout({ csv, rollout: rolloutPath }, loaded).row_count,
    65
  );
});
