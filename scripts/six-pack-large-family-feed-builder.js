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
const DEFAULT_APPROVAL = path.join(
  ROOT,
  "config",
  "retailers",
  "six-pack-reviewed-large-family-batch-v7.json"
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
  const values = {};
  for (const argument of argv) {
    const match = argument.match(/^--(output|approval)=(.*)$/);
    if (!match || values[match[1]]) {
      fail(`Invalid argument ${argument}`);
    }
    values[match[1]] = match[2];
  }
  const output = path.resolve(
    values.output || DEFAULT_OUTPUT
  );
  const relative = path.relative(path.join(ROOT, "tmp"), output);
  const reviewedV15Output = path.join(
    ROOT,
    "config",
    "retailers",
    "six-pack-production-expansion-v15.csv"
  );
  if (
    output !== reviewedV15Output &&
    (!relative ||
      relative.startsWith("..") ||
      path.isAbsolute(relative))
  ) {
    fail("Output must be inside repository tmp or the reviewed V15 config");
  }
  const approval = path.resolve(values.approval || DEFAULT_APPROVAL);
  const approvalRelative = path
    .relative(path.join(ROOT, "config", "retailers"), approval)
    .replaceAll("\\", "/");
  if (
    approvalRelative.startsWith("..") ||
    path.isAbsolute(approvalRelative) ||
    !/^six-pack-reviewed-large-family-batch-v\d+\.json$/.test(
      approvalRelative
    )
  ) {
    fail("Approval must be a reviewed large family config");
  }
  return { output, approval };
}

function loadClient(targetProjectRef) {
  dotenv.config({ path: path.join(ROOT, ".env.local"), quiet: true });
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (
    !url ||
    !key ||
    new URL(url).hostname.split(".")[0] !== targetProjectRef
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
    (family.kind === "EXISTING_CANONICAL_PRODUCT" &&
    !family.existing_match_evidence
      ? true
      : product.name === family.name &&
        product.slug === family.slug &&
        product.brand === family.brand &&
        product.category === family.category &&
        (family.kind === "EXISTING_CANONICAL_PRODUCT" ||
          product.product_format === family.product_format))
  );
}

function approvedSourcePolicyState(approval, source) {
  if (source?.policy_state === "ELIGIBLE") return true;
  return (
    approval.kind === "six-pack-reviewed-large-family-batch-v13" &&
    approval.policy?.accessories === "ALLOW" &&
    source?.policy_state === "DEFERRED" &&
    source?.policy_code === "DEFER_ACCESSORY" &&
    source.categories?.includes("Accessories")
  );
}

function reviewedSourceProductId(family, reviewed) {
  return String(
    reviewed.external_product_id || family.external_product_id
  );
}

function sourceOptionName(family) {
  if (
    family.product_format === "accessory" &&
    family.option_name === "Size"
  ) {
    return "Fit";
  }
  return family.option_name;
}

async function run(options, dependencies = {}) {
  const approval =
    dependencies.approval ||
    JSON.parse(fs.readFileSync(options.approval, "utf8"));
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
  const db =
    dependencies.client || loadClient(approval.target_project_ref);
  const existingIds = approval.families
    .filter((family) => family.product_id)
    .map((family) => Number(family.product_id));
  const newSlugs = approval.families
    .filter(
      (family) =>
        family.kind === "NEW_CANONICAL_PRODUCT" && family.slug
    )
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
  const mappedByExternalId = new Map(
    mappings.data.map((row) => [
      String(row.external_variant_id),
      row,
    ])
  );
  const mappedByVariantId = new Map(
    mappings.data
      .filter((row) => row.product_variant_id != null)
      .map((row) => [String(row.product_variant_id), row])
  );
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
  const configuredDuplicateAliases = new Map(
    (approval.covered_duplicate_aliases || []).map((row) => [
      String(row.approved_external_variant_id),
      {
        existing_external_product_id: String(
          row.existing_external_product_id
        ),
        existing_external_variant_id: String(
          row.existing_external_variant_id
        ),
        product_variant_id: String(row.product_variant_id),
      },
    ])
  );
  const expectedDuplicateAliases =
    approval.kind === "six-pack-reviewed-large-family-batch-v7"
      ? COVERED_DUPLICATE_ALIASES
      : configuredDuplicateAliases;
  let resumedMappingCount = 0;
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
    for (let index = 0; index < family.variants.length; index += 1) {
      const reviewed = family.variants[index];
      const source = sourceById.get(
        String(reviewed.external_variant_id)
      );
      const sourceProductId = reviewedSourceProductId(family, reviewed);
      let live = liveByProduct.get(sourceProductId);
      if (!live) {
        live = await readLive(sourceProductId);
        liveByProduct.set(sourceProductId, live);
      }
      const variant = classification.matches[index + offset];
      if (
        !source ||
        !approvedSourcePolicyState(approval, source) ||
        String(source.external_product_id) !==
          sourceProductId ||
        !variant ||
        variant.is_active !== true ||
        String(variant.product_id) !== String(product.id)
      ) {
        fail(
          `Large family identity mismatch for ${reviewed.external_variant_id}`
        );
      }
      const mappedPeer = mappedByVariantId.get(String(variant.id));
      const existingMapping = mappedByExternalId.get(
        String(reviewed.external_variant_id)
      );
      if (existingMapping) {
        if (
          String(existingMapping.external_product_id) !==
            sourceProductId ||
          String(existingMapping.product_id) !== String(product.id) ||
          String(existingMapping.product_variant_id) !==
            String(variant.id)
        ) {
          fail(
            `Existing retailer identity drift for ${reviewed.external_variant_id}`
          );
        }
        resumedMappingCount += 1;
      } else if (mappedPeer) {
        const expectedAlias = expectedDuplicateAliases.get(
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
      const row = canonicalFeedRow(
        source,
        product,
        variant,
        live,
        new Date().toISOString()
      );
      row.product_format = family.product_format || row.product_format;
      const optionName = sourceOptionName(family);
      const externalOptions = optionName
        ? { [optionName]: reviewed.flavour }
        : {};
      if (Number(reviewed.pack_count || 1) > 1) {
        externalOptions.Pack = String(reviewed.pack_count);
      }
      if (reviewed.size && reviewed.size_unit) {
        externalOptions.Size = `${reviewed.size}${reviewed.size_unit}`;
      }
      if (
        reviewed.source_flavour &&
        reviewed.source_flavour !== reviewed.flavour
      ) {
        externalOptions["Retailer Flavour"] =
          reviewed.source_flavour;
      }
      row.external_options = JSON.stringify(externalOptions);
      outputRows.push(row);
    }
  }
  if (
    outputRows.length !==
      approval.row_count - expectedDuplicateAliases.size ||
    new Set(outputRows.map((row) => String(row.external_variant_id)))
      .size !== outputRows.length ||
    coveredDuplicateAliases.length !==
      expectedDuplicateAliases.size
  ) {
    fail("Large family feed is not the exact approved unique scope");
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
    kind: "six-pack-large-family-feed",
    result: "PASS",
    database_writes: 0,
    row_count: outputRows.length,
    approved_scope_row_count: approval.row_count,
    existing_product_count: products.length,
    existing_variant_binding_count: outputRows.length,
    expected_variant_create_count: 0,
    resumed_mapping_count: resumedMappingCount,
    covered_duplicate_alias_count: coveredDuplicateAliases.length,
    covered_duplicate_aliases: coveredDuplicateAliases,
    reviewed_source_alias_count: (approval.source_aliases || []).length,
    reviewed_source_aliases: approval.source_aliases || [],
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
  reviewedSourceProductId,
  sourceOptionName,
};
