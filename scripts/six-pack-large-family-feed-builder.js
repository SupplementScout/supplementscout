const crypto = require("node:crypto");
const fs = require("node:fs");
const path = require("node:path");
const dotenv = require("dotenv");
const { createClient } = require("@supabase/supabase-js");
const { readWooCommerceProductPage } = require("./lib/woocommerce-product-page-reader");
const {
  EXTRA_COLUMNS,
  canonicalFeedRow,
  currentOffer,
  liveIdentityDrift,
  serializeCsv,
} = require("./six-pack-canary-builder");
const {
  assertApproval,
  classifyVariants,
  intendedVariants,
} = require("./six-pack-large-family-bootstrap");
const config = require("../config/retailers/six-pack-supplements-woocommerce.json");
const approval = require("../config/retailers/six-pack-reviewed-large-family-batch-v7.json");

const ROOT = path.resolve(__dirname, "..");
const SOURCE = path.join(
  ROOT,
  "tmp",
  "retailer-feeds",
  "six-pack-supplements",
  "six-pack-source-snapshot.json"
);
const TEMPLATE = path.join(
  ROOT,
  "data",
  "templates",
  "retailer-feed-template.csv"
);
const DEFAULT_OUTPUT = path.join(
  ROOT,
  "tmp",
  "retailer-feeds",
  "six-pack-supplements",
  "six-pack-large-family-77.csv"
);
const COVERED_DUPLICATE_ALIASES = new Map([
  [
    "6315",
    {
      existing_external_product_id: "6320",
      existing_external_variant_id: "6321",
      product_variant_id: "816",
    },
  ],
  [
    "6317",
    {
      existing_external_product_id: "6320",
      existing_external_variant_id: "6322",
      product_variant_id: "815",
    },
  ],
]);

function fail(message) {
  throw new Error(message);
}

function sha256(value) {
  return crypto.createHash("sha256").update(value).digest("hex");
}

function parseArgs(argv) {
  if (
    argv.length > 1 ||
    (argv[0] && !argv[0].startsWith("--output="))
  ) {
    fail("Usage: --output=<tmp path>");
  }
  const output = path.resolve(
    argv[0]?.slice("--output=".length) || DEFAULT_OUTPUT
  );
  const relative = path.relative(path.join(ROOT, "tmp"), output);
  if (
    !relative ||
    relative.startsWith("..") ||
    path.isAbsolute(relative)
  ) {
    fail("Output must be inside repository tmp");
  }
  return { output };
}

function loadClient() {
  dotenv.config({ path: path.join(ROOT, ".env.local"), quiet: true });
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (
    !url ||
    !key ||
    new URL(url).hostname.split(".")[0] !== approval.target_project_ref
  ) {
    fail("Production read credential mismatch");
  }
  return createClient(url, key, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

function productIdentityMatches(product, family) {
  return (
    product &&
    product.is_active === true &&
    product.merged_into_product_id == null &&
    (family.kind !== "NEW_CANONICAL_PRODUCT" ||
      (product.name === family.name &&
        product.slug === family.slug &&
        product.brand === family.brand &&
        product.category === family.category &&
        product.product_format === family.product_format))
  );
}

async function run(options, dependencies = {}) {
  assertApproval(approval);
  const sourceSnapshot = JSON.parse(fs.readFileSync(SOURCE, "utf8"));
  if (
    sourceSnapshot.snapshot_fingerprint !==
    approval.source_snapshot_fingerprint
  ) {
    fail("Large family source binding mismatch");
  }
  const sourceById = new Map(
    sourceSnapshot.records.map((row) => [
      String(row.source_record_id),
      row,
    ])
  );
  const db = dependencies.client || loadClient();
  const existingIds = approval.families
    .filter((family) => family.product_id)
    .map((family) => Number(family.product_id));
  const newSlugs = approval.families
    .filter((family) => family.slug)
    .map((family) => family.slug);
  const [existingProducts, newProducts, mappings] = await Promise.all([
    db
      .from("products")
      .select(
        "id,name,slug,brand,category,product_format,is_active,merged_into_product_id"
      )
      .in("id", existingIds),
    db
      .from("products")
      .select(
        "id,name,slug,brand,category,product_format,is_active,merged_into_product_id"
      )
      .in("slug", newSlugs),
    db
      .from("retailer_products")
      .select(
        "external_product_id,external_variant_id,product_id,product_variant_id"
      )
      .eq("retailer_id", config.automation.retailer_id),
  ]);
  for (const result of [existingProducts, newProducts, mappings]) {
    if (result.error) throw result.error;
  }
  const products = [...existingProducts.data, ...newProducts.data];
  const productById = new Map(
    products.map((product) => [String(product.id), product])
  );
  const productBySlug = new Map(
    products.map((product) => [product.slug, product])
  );
  const mappedIds = new Set(
    mappings.data.map((row) => String(row.external_variant_id))
  );
  const mappedByVariantId = new Map(
    mappings.data
      .filter((row) => row.product_variant_id != null)
      .map((row) => [String(row.product_variant_id), row])
  );
  const approvedIds = approval.families.flatMap((family) =>
    family.variants.map((variant) =>
      String(variant.external_variant_id)
    )
  );
  const overlap = approvedIds.filter((id) => mappedIds.has(id));
  if (overlap.length > 0) {
    fail(`Large family scope overlaps existing mappings: ${overlap.join(",")}`);
  }
  const variantsResult = await db
    .from("product_variants")
    .select(
      "id,product_id,variant_key,display_name,flavour_code,flavour_label,size_value,size_unit,pack_count,product_format,is_active,is_default"
    )
    .in(
      "product_id",
      products.map((product) => Number(product.id))
    );
  if (variantsResult.error) throw variantsResult.error;
  const variantsByProduct = new Map();
  for (const variant of variantsResult.data) {
    const key = String(variant.product_id);
    if (!variantsByProduct.has(key)) variantsByProduct.set(key, []);
    variantsByProduct.get(key).push(variant);
  }
  const readLive =
    dependencies.readLive ||
    ((productId) =>
      readWooCommerceProductPage({
        storeUrl: config.retailer.website,
        productId,
      }));
  const liveByProduct = new Map();
  const outputRows = [];
  const coveredDuplicateAliases = [];
  for (const family of approval.families) {
    const product = family.product_id
      ? productById.get(String(family.product_id))
      : productBySlug.get(family.slug);
    if (!productIdentityMatches(product, family)) {
      fail(`Canonical product identity mismatch for ${family.external_product_id}`);
    }
    const intended = intendedVariants(family);
    const classification = classifyVariants(
      variantsByProduct.get(String(product.id)) || [],
      intended
    );
    if (classification.state !== "COMPLETE") {
      fail(`Canonical variant family incomplete for ${family.external_product_id}`);
    }
    const offset =
      family.kind === "NEW_CANONICAL_PRODUCT" ? 1 : 0;
    let live = liveByProduct.get(String(family.external_product_id));
    if (!live) {
      live = await readLive(family.external_product_id);
      liveByProduct.set(String(family.external_product_id), live);
    }
    for (let index = 0; index < family.variants.length; index += 1) {
      const reviewed = family.variants[index];
      const source = sourceById.get(
        String(reviewed.external_variant_id)
      );
      const variant = classification.matches[index + offset];
      if (
        !source ||
        source.policy_state !== "ELIGIBLE" ||
        String(source.external_product_id) !==
          String(family.external_product_id) ||
        !variant ||
        variant.is_active !== true ||
        String(variant.product_id) !== String(product.id)
      ) {
        fail(
          `Large family identity mismatch for ${reviewed.external_variant_id}`
        );
      }
      const mappedPeer = mappedByVariantId.get(String(variant.id));
      if (mappedPeer) {
        const expectedAlias = COVERED_DUPLICATE_ALIASES.get(
          String(reviewed.external_variant_id)
        );
        if (
          !expectedAlias ||
          String(mappedPeer.external_product_id) !==
            expectedAlias.existing_external_product_id ||
          String(mappedPeer.external_variant_id) !==
            expectedAlias.existing_external_variant_id ||
          String(mappedPeer.product_variant_id) !==
            expectedAlias.product_variant_id ||
          String(mappedPeer.product_id) !== String(product.id)
        ) {
          fail(
            `Unexpected canonical retailer collision for ${reviewed.external_variant_id}`
          );
        }
        coveredDuplicateAliases.push({
          approved_external_variant_id: String(
            reviewed.external_variant_id
          ),
          ...expectedAlias,
        });
        continue;
      }
      const drift = liveIdentityDrift(source, live);
      if (drift) {
        fail(
          `Live identity drift for ${reviewed.external_variant_id}: ${drift.code}`
        );
      }
      const offer = currentOffer(source, live);
      if (!offer.active || (!offer.in_stock && source.in_stock)) {
        fail(`Unsafe commerce state for ${reviewed.external_variant_id}`);
      }
      outputRows.push(
        canonicalFeedRow(
          source,
          product,
          variant,
          live,
          new Date().toISOString()
        )
      );
    }
  }
  if (
    outputRows.length !== 75 ||
    new Set(outputRows.map((row) => String(row.external_variant_id)))
      .size !== 75 ||
    coveredDuplicateAliases.length !== 2
  ) {
    fail("Large family feed is not the exact 75-new plus 2-covered scope");
  }
  const header = [
    ...fs
      .readFileSync(TEMPLATE, "utf8")
      .split(/\r?\n/, 1)[0]
      .split(","),
    ...EXTRA_COLUMNS,
  ];
  const csv = serializeCsv(header, outputRows);
  fs.mkdirSync(path.dirname(options.output), { recursive: true });
  fs.writeFileSync(options.output, csv);
  const report = {
    schema_version: 1,
    kind: "six-pack-large-family-feed-v7",
    result: "PASS",
    database_writes: 0,
    row_count: outputRows.length,
    approved_scope_row_count: approval.row_count,
    existing_product_count: products.length,
    existing_variant_binding_count: outputRows.length,
    expected_variant_create_count: 0,
    covered_duplicate_alias_count: coveredDuplicateAliases.length,
    covered_duplicate_aliases: coveredDuplicateAliases,
    live_product_page_count: liveByProduct.size,
    csv_sha256: sha256(csv),
    approval_fingerprint: approval.approval_fingerprint,
    output: path.relative(ROOT, options.output),
  };
  fs.writeFileSync(
    options.output.replace(/\.csv$/i, "-builder-report.json"),
    `${JSON.stringify(report, null, 2)}\n`
  );
  return report;
}

if (require.main === module) {
  run(parseArgs(process.argv.slice(2)))
    .then((report) => console.log(JSON.stringify(report, null, 2)))
    .catch((error) => {
      console.error(error.message);
      process.exitCode = 1;
    });
}

module.exports = {
  COVERED_DUPLICATE_ALIASES,
  parseArgs,
  productIdentityMatches,
};
