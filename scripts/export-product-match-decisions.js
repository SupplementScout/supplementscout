const fs = require("node:fs");
const path = require("node:path");
const dotenv = require("dotenv");
const { Client } = require("pg");
const { createClient } = require("@supabase/supabase-js");
const { loadEnvFile } = require("./apply-selected-migrations");
const {
  exportReviewQueueCsv,
  exportReviewQueueJson,
  normalizeRow,
  sealDecision,
} = require("./lib/retailer-snapshot/review-queue");
const {
  databaseRow,
} = require("./publish-product-match-review-queue");

const ROOT = path.resolve(__dirname, "..");
const TMP_ROOT = path.join(ROOT, "tmp");
const PRODUCTION_REF = "aftboxmrdgyhizicfsfu";

function fail(message) {
  throw new Error(message);
}

function parseArgs(argv) {
  const result = {};
  for (const argument of argv) {
    const match = argument.match(/^--([^=]+)=(.*)$/);
    if (
      !match ||
      result[match[1]] !== undefined ||
      !["snapshot", "output-dir", "target", "transport"].includes(match[1])
    ) {
      fail(`Invalid argument ${argument}`);
    }
    result[match[1]] = match[2];
  }
  if (!result.snapshot || result.snapshot.length > 128) {
    fail("Required --snapshot=<snapshot id>");
  }
  if (result.target !== "production") fail("Required --target=production");
  if (result.transport && result.transport !== "owner-db") {
    fail("transport must be owner-db");
  }
  const outputDir = path.resolve(result["output-dir"] || path.join(TMP_ROOT, "product-match-decisions"));
  const relative = path.relative(TMP_ROOT, outputDir);
  if (!relative || relative.startsWith("..") || path.isAbsolute(relative)) {
    fail("Output directory must be inside repository tmp");
  }
  return {
    snapshot: result.snapshot,
    outputDir,
    target: result.target,
    transport: result.transport || "supabase",
  };
}

function loadClient() {
  dotenv.config({ path: path.join(ROOT, ".env.local"), quiet: true });
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) fail("Missing production Supabase credentials");
  const actualRef = new URL(url).hostname.split(".")[0];
  if (actualRef !== PRODUCTION_REF) {
    fail(`Production target mismatch: received ${actualRef}`);
  }
  return createClient(url, key, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

function reviewRow(row) {
  const candidates = Array.isArray(row.canonical_candidates)
    ? row.canonical_candidates
    : [];
  const structure =
    row.selected_family_seed_review_item_id ||
    row.proposed_family_name ||
    row.proposed_variant_name
      ? `PRODUCT_STRUCTURE_V1:${JSON.stringify({
          family_seed_review_item_id: row.selected_family_seed_review_item_id
            ? String(row.selected_family_seed_review_item_id)
            : null,
          family_name: row.proposed_family_name || null,
          variant_name: row.proposed_variant_name || null,
        })}`
      : "";
  const reviewerNotes = [
    structure,
    row.reviewer_notes || "",
  ].filter(Boolean).join("\n");
  const output = normalizeRow({
    review_item_id: row.review_item_id,
    snapshot_id: row.snapshot_id,
    source_record_id: row.source_record_id,
    retailer: row.retailer,
    product_title: row.product_title,
    variant_title: row.variant_title,
    primary_status: row.primary_status,
    reason_codes: row.reason_codes,
    confidence: row.confidence,
    canonical_candidates: candidates,
    source_sku: row.source_sku,
    source_gtin: row.source_gtin,
    source_weight: row.source_weight,
    source_price: row.source_price,
    source_url: row.source_url,
    suggested_action: row.suggested_action,
    reviewer_decision: row.decision === "PENDING" ? "" : row.decision,
    selected_canonical_product_id: row.selected_canonical_product_id,
    selected_canonical_variant_id: row.selected_canonical_variant_id,
    reviewer_notes: reviewerNotes,
    reviewed_by: row.reviewed_by,
    reviewed_at: row.reviewed_at,
    decision_fingerprint: "",
  });
  const expectedSourceFingerprint = databaseRow(
    output,
    row.artifact_fingerprint
  ).source_row_fingerprint;
  if (expectedSourceFingerprint !== row.source_row_fingerprint) {
    fail(`Stored review source drift: ${row.review_item_id}`);
  }
  return output.reviewer_decision ? sealDecision(output) : output;
}

function atomicWrite(file, value) {
  fs.mkdirSync(path.dirname(file), { recursive: true });
  const temporary = `${file}.${process.pid}.${Date.now()}.tmp`;
  fs.writeFileSync(temporary, value);
  fs.renameSync(temporary, file);
}

async function exportDecisions(options, dependencies = {}) {
  let data;
  if (options.transport === "owner-db") {
    const env = loadEnvFile(
      path.join(
        process.env.USERPROFILE || "",
        ".supplementscout",
        "credentials",
        "production-owner.env"
      )
    );
    const client = new Client({
      connectionString: env.SUPPLEMENTSCOUT_PRODUCTION_OWNER_DATABASE_URL,
      ssl: { rejectUnauthorized: false },
      application_name: "supplementscout-product-match-decision-export",
    });
    await client.connect();
    try {
      data = (await client.query(
        `select snapshot_id,review_item_id,source_record_id,retailer,
                product_title,variant_title,primary_status,reason_codes,
                confidence,canonical_candidates,source_sku,source_gtin,
                source_weight,source_price,source_url,suggested_action,
                decision,selected_canonical_product_id,
                selected_canonical_variant_id,
                selected_family_seed_review_item_id,proposed_family_name,
                proposed_variant_name,reviewer_notes,reviewed_by,reviewed_at,
                source_row_fingerprint,artifact_fingerprint
           from public.product_match_review_queue
          where snapshot_id=$1 order by review_item_id limit 1000`,
        [options.snapshot]
      )).rows;
    } finally {
      await client.end();
    }
  } else {
    const client = dependencies.client || loadClient();
    const response = await client
      .from("product_match_review_queue")
      .select(
        "snapshot_id, review_item_id, source_record_id, retailer, product_title, variant_title, primary_status, reason_codes, confidence, canonical_candidates, source_sku, source_gtin, source_weight, source_price, source_url, suggested_action, decision, selected_canonical_product_id, selected_canonical_variant_id, selected_family_seed_review_item_id, proposed_family_name, proposed_variant_name, reviewer_notes, reviewed_by, reviewed_at, source_row_fingerprint, artifact_fingerprint"
      )
      .eq("snapshot_id", options.snapshot)
      .order("review_item_id")
      .limit(1000);
    if (response.error) throw response.error;
    data = response.data;
  }
  if (!data || data.length === 0) fail("No review rows found for snapshot");

  const rows = data.map(reviewRow);
  const json = exportReviewQueueJson(rows, { snapshot_id: options.snapshot });
  const jsonPath = path.join(options.outputDir, `${options.snapshot}-decisions.json`);
  const csvPath = path.join(options.outputDir, `${options.snapshot}-decisions.csv`);
  atomicWrite(jsonPath, `${JSON.stringify(json, null, 2)}\n`);
  atomicWrite(csvPath, exportReviewQueueCsv(rows));
  return {
    result: "PASS",
    database_writes: 0,
    catalogue_writes: 0,
    snapshot_id: options.snapshot,
    row_count: rows.length,
    open_count: rows.filter((row) => !row.reviewer_decision).length,
    decided_count: rows.filter((row) => row.reviewer_decision).length,
    outputs: [jsonPath, csvPath],
  };
}

async function main(argv = process.argv.slice(2)) {
  const options = parseArgs(argv);
  const result = await exportDecisions(options);
  console.log(
    JSON.stringify(
      {
        ...result,
        outputs: result.outputs.map((file) => path.relative(ROOT, file)),
      },
      null,
      2
    )
  );
}

if (require.main === module) {
  main().catch((error) => {
    console.error(error.message);
    process.exitCode = 1;
  });
}

module.exports = {
  exportDecisions,
  parseArgs,
  reviewRow,
};
