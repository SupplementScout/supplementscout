const fs = require("node:fs");
const path = require("node:path");
const dotenv = require("dotenv");
const { createClient } = require("@supabase/supabase-js");
const PRODUCTION_REF = "aftboxmrdgyhizicfsfu";
function fail(message) { throw new Error(message); }
function parseArgs(argv) { const out = {}; for (const arg of argv) { const match = arg.match(/^--(input|mode|confirm)=(.+)$/); if (!match || out[match[1]]) fail(`Invalid argument ${arg}`); out[match[1]] = match[2]; } if (!out.input || !["dry-run", "apply"].includes(out.mode)) fail("Required --input and --mode=dry-run|apply"); if (out.mode === "apply" && out.confirm !== "OWNER_APPROVED_REVIEW_QUEUE_EXACT_373") fail("Exact review-only confirmation required"); return { ...out, input: path.resolve(out.input) }; }
function client() { dotenv.config({ path: path.resolve(__dirname, "../.env.local"), quiet: true }); const url = process.env.NEXT_PUBLIC_SUPABASE_URL, key = process.env.SUPABASE_SERVICE_ROLE_KEY; if (!url || !key || new URL(url).hostname.split(".")[0] !== PRODUCTION_REF) fail("Production review queue credentials missing or mismatched"); return createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } }); }
async function publish(options, dependency = {}) { const manifest = JSON.parse(fs.readFileSync(options.input)); if (manifest.schema_version !== 1 || manifest.row_count !== 373 || manifest.rows.length !== 373) fail("Exact review seed scope mismatch"); const db = dependency.client || client(); const existingKeys = new Set(); for (let from = 0;; from += 1000) { const { data, error } = await db.from("product_match_review_queue").select("retailer_id,offer_id,source_row_fingerprint").not("review_status", "is", null).range(from, from + 999); if (error) throw error; for (const row of data || []) existingKeys.add(`${row.retailer_id}:${row.offer_id}:${row.source_row_fingerprint}`); if (!data || data.length < 1000) break; }
  const retailerBindings = new Map(manifest.rows.map((row) => [String(row.retailer_id), row.retailer]));
  const { data: retailers, error: retailerError } = await db.from("retailers").select("id,name").in("id", [...retailerBindings.keys()]);
  if (retailerError || !retailers || retailers.length !== retailerBindings.size || retailers.some((row) => retailerBindings.get(String(row.id)) !== row.name)) fail("Review seed retailer binding mismatch");
  const inserts = manifest.rows.filter((row) => !existingKeys.has(`${row.retailer_id}:${row.offer_id}:${row.source_row_fingerprint}`));
  if (options.mode === "apply") for (let from = 0; from < inserts.length; from += 100) { const { error } = await db.from("product_match_review_queue").insert(inserts.slice(from, from + 100)); if (error) throw error; }
  return { result: "PASS", mode: options.mode, rows: manifest.rows.length, already_present: manifest.rows.length - inserts.length, would_insert: inserts.length, inserted: options.mode === "apply" ? inserts.length : 0, catalogue_writes: 0 };
}
if (require.main === module) publish(parseArgs(process.argv.slice(2))).then((result) => console.log(JSON.stringify(result, null, 2))).catch((error) => { console.error(error.message); process.exitCode = 1; });
module.exports = { parseArgs, publish };
