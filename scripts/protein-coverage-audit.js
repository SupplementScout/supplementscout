const path = require("node:path");
const { buildProteinCoverageReport } = require("./lib/protein-coverage");

function parseArgs(argv) {
  const options = { includeProducts: false };
  for (const argument of argv) {
    if (argument === "--include-products=true") options.includeProducts = true;
    else throw new Error(`Unknown option: ${argument}`);
  }
  return options;
}

async function readAllProducts(client) {
  const rows = [];
  for (let from = 0;; from += 1000) {
    const { data, error } = await client.from("products")
      .select("id,name,slug,brand,category,product_format,net_weight_g,net_volume_ml,serving_count_verified,serving_size_g,serving_size_ml,protein_per_serving_g,nutrition_verified,unit_pricing_verified,is_active,merged_into_product_id")
      .order("id")
      .range(from, from + 999);
    if (error) throw error;
    rows.push(...(data || []));
    if ((data || []).length < 1000) break;
  }
  return rows;
}

async function runCli(argv = process.argv.slice(2), dependencies = {}) {
  const options = parseArgs(argv);
  let client = dependencies.client;
  if (!client) {
    require("dotenv").config({ path: path.resolve(process.cwd(), ".env.local"), quiet: true });
    const { createClient } = require("@supabase/supabase-js");
    client = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY, {
      auth: { persistSession: false, autoRefreshToken: false },
    });
  }
  const report = buildProteinCoverageReport(await readAllProducts(client));
  if (!options.includeProducts) delete report.products;
  return { mode: "READ_ONLY", database_writes: 0, ...report };
}

if (require.main === module) {
  runCli().then((result) => console.log(JSON.stringify(result, null, 2))).catch((error) => {
    console.error(error.message);
    process.exitCode = 1;
  });
}

module.exports = { parseArgs, readAllProducts, runCli };
