const fs = require("node:fs");
const path = require("node:path");
const ts = require("typescript");
const dotenv = require("dotenv");
const { createClient } = require("@supabase/supabase-js");

const ROOT = path.resolve(__dirname, "..");

require.extensions[".ts"] = function loadTypeScriptModule(mod, filename) {
  const source = fs.readFileSync(filename, "utf8");
  const { outputText } = ts.transpileModule(source, {
    compilerOptions: {
      module: ts.ModuleKind.CommonJS,
      target: ts.ScriptTarget.ES2022,
    },
    fileName: filename,
  });
  mod._compile(outputText, filename);
};

const {
  findPossibleDuplicates,
  getDuplicatePairKey,
} = require(path.join(ROOT, "app", "lib", "duplicates.ts"));

function fail(message) {
  throw new Error(message);
}

function parseArgs(argv) {
  const result = { minimumScore: 0.6, output: null };
  for (const argument of argv) {
    const match = argument.match(/^--([^=]+)=(.*)$/);
    if (!match) fail(`Invalid argument: ${argument}`);
    if (match[1] === "minimum-score") {
      result.minimumScore = Number(match[2]);
    } else if (match[1] === "output") {
      result.output = path.resolve(match[2]);
      const relative = path.relative(path.join(ROOT, "tmp"), result.output);
      if (!relative || relative.startsWith("..") || path.isAbsolute(relative)) {
        fail("Audit output must be inside repository tmp");
      }
    } else {
      fail(`Unsupported argument: ${argument}`);
    }
  }
  if (!Number.isFinite(result.minimumScore) || result.minimumScore < 0.5 || result.minimumScore > 1) {
    fail("minimum-score must be between 0.5 and 1");
  }
  return result;
}

async function readAll(client, table, select, configure = (query) => query) {
  const rows = [];
  for (let from = 0; ; from += 1000) {
    const { data, error } = await configure(
      client.from(table).select(select).range(from, from + 999)
    );
    if (error) throw error;
    rows.push(...(data || []));
    if (!data || data.length < 1000) return rows;
  }
}

function groupBy(rows, key) {
  const groups = new Map();
  for (const row of rows) {
    const value = String(row[key]);
    const group = groups.get(value) || [];
    group.push(row);
    groups.set(value, group);
  }
  return groups;
}

function chooseCanonical(left, right, mappingsByProduct, offersByProduct) {
  const quality = (product) =>
    (product.gtin ? 20 : 0) +
    (product.description ? 4 : 0) +
    (product.image ? 3 : 0) +
    (product.nutrition_verified ? 3 : 0) +
    (product.unit_pricing_verified ? 2 : 0) +
    (mappingsByProduct.get(String(product.id)) || []).length * 2 +
    (offersByProduct.get(String(product.id)) || []).length;
  const leftQuality = quality(left);
  const rightQuality = quality(right);
  if (leftQuality !== rightQuality) return leftQuality > rightQuality ? left : right;
  return Number(left.id) < Number(right.id) ? left : right;
}

function activeVariantsAreDefaultOnly(productId, variantsByProduct) {
  const active = (variantsByProduct.get(String(productId)) || []).filter(
    (variant) => variant.is_active !== false
  );
  return active.length === 1 && active[0].is_default === true;
}

function buildAudit(data, minimumScore) {
  const mappingsByProduct = groupBy(data.mappings, "product_id");
  const offersByProduct = groupBy(data.offers, "product_id");
  const variantsByProduct = groupBy(data.variants, "product_id");
  const decidedPairs = new Set(
    data.decisions.map((decision) =>
      getDuplicatePairKey(decision.product_a_id, decision.product_b_id)
    )
  );
  const matches = findPossibleDuplicates(
    data.products,
    minimumScore,
    data.mappings
  );

  const candidates = matches.map((match) => {
    const canonical = chooseCanonical(
      match.productA,
      match.productB,
      mappingsByProduct,
      offersByProduct
    );
    const candidate = String(canonical.id) === String(match.productA.id)
      ? match.productB
      : match.productA;
    const canonicalRetailers = new Set(
      (mappingsByProduct.get(String(canonical.id)) || []).map((row) => String(row.retailer_id))
    );
    const candidateRetailers = new Set(
      (mappingsByProduct.get(String(candidate.id)) || []).map((row) => String(row.retailer_id))
    );
    const overlappingRetailers = [...candidateRetailers].filter((id) => canonicalRetailers.has(id));
    const exactGtin = match.kind === "exact-product";
    const defaultOnly =
      activeVariantsAreDefaultOnly(canonical.id, variantsByProduct) &&
      activeVariantsAreDefaultOnly(candidate.id, variantsByProduct);
    const alreadyDecided = decidedPairs.has(
      getDuplicatePairKey(canonical.id, candidate.id)
    );
    const classification = alreadyDecided
      ? "reviewed-separate"
      : exactGtin && defaultOnly && overlappingRetailers.length === 0
        ? "identifier-safe"
        : match.kind === "product-family"
          ? "family-review"
        : match.score >= 0.85 && defaultOnly && overlappingRetailers.length === 0
          ? "high-confidence-review"
          : "manual-review";

    return {
      pair_key: getDuplicatePairKey(canonical.id, candidate.id),
      classification,
      score: Number(match.score.toFixed(4)),
      match_kind: match.kind,
      exact_gtin: exactGtin,
      default_variants_only: defaultOnly,
      overlapping_retailer_ids: overlappingRetailers,
      canonical: {
        id: canonical.id,
        name: canonical.name,
        gtin: canonical.gtin,
        retailer_count: canonicalRetailers.size,
      },
      candidate: {
        id: candidate.id,
        name: candidate.name,
        gtin: candidate.gtin,
        retailer_count: candidateRetailers.size,
      },
    };
  });

  const summary = candidates.reduce(
    (counts, candidate) => {
      counts[candidate.classification] += 1;
      return counts;
    },
    {
      "identifier-safe": 0,
      "high-confidence-review": 0,
      "family-review": 0,
      "manual-review": 0,
      "reviewed-separate": 0,
    }
  );

  return {
    schema_version: 1,
    generated_at: new Date().toISOString(),
    minimum_score: minimumScore,
    catalogue_counts: {
      active_products: data.products.length,
      retailer_mappings: data.mappings.length,
      active_variants: data.variants.filter((variant) => variant.is_active !== false).length,
      open_or_reviewed_pairs: candidates.length,
    },
    summary,
    candidates,
  };
}

async function loadCatalogue(client) {
  const [products, mappings, variants, offers, decisions] = await Promise.all([
    readAll(
      client,
      "products",
      "id,name,slug,gtin,brand,category,product_format,net_weight_g,net_volume_ml,unit_count,unit_type,servings,description,image,nutrition_verified,unit_pricing_verified,is_active,merged_into_product_id",
      (query) => query.eq("is_active", true).is("merged_into_product_id", null)
    ),
    readAll(
      client,
      "retailer_products",
      "id,product_id,retailer_id,external_name,external_gtin,external_url,product_variant_id"
    ),
    readAll(
      client,
      "product_variants",
      "id,product_id,is_active,is_default,variant_key,display_name"
    ),
    readAll(client, "offers", "id,product_id,retailer_id,retailer_product_id,product_variant_id"),
    readAll(client, "ignored_duplicate_product_pairs", "product_a_id,product_b_id,decision"),
  ]);
  return { products, mappings, variants, offers, decisions };
}

async function main(argv = process.argv.slice(2)) {
  const options = parseArgs(argv);
  dotenv.config({ path: path.join(ROOT, ".env.local"), quiet: true });
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) fail("Missing Supabase credentials");
  const client = createClient(url, key, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const audit = buildAudit(await loadCatalogue(client), options.minimumScore);
  if (options.output) {
    fs.mkdirSync(path.dirname(options.output), { recursive: true });
    fs.writeFileSync(options.output, `${JSON.stringify(audit, null, 2)}\n`);
  }
  console.log(JSON.stringify({
    result: "PASS",
    output: options.output,
    catalogue_counts: audit.catalogue_counts,
    summary: audit.summary,
  }, null, 2));
}

if (require.main === module) {
  main().catch((error) => {
    console.error(error.message);
    process.exitCode = 1;
  });
}

module.exports = { buildAudit, parseArgs };
