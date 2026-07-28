const crypto = require("node:crypto");
const fs = require("node:fs");
const path = require("node:path");
const dotenv = require("dotenv");
const { createClient } = require("@supabase/supabase-js");
const defaultApproval = require("../config/retailers/six-pack-reviewed-large-family-batch-v7.json");

const ROOT = path.resolve(__dirname, "..");
const PROJECT_REF = "aftboxmrdgyhizicfsfu";
const DEFAULT_APPROVAL = path.join(
  ROOT,
  "config",
  "retailers",
  "six-pack-reviewed-large-family-batch-v7.json"
);

function fail(message) {
  throw new Error(message);
}

function sha256(value) {
  return crypto.createHash("sha256").update(value).digest("hex");
}

function normalize(value) {
  return String(value || "")
    .toLowerCase()
    .replace(/&/g, " and ")
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

function variantKey(flavour, size, unit, packCount = 1) {
  const base = `${normalize(flavour).replace(/\s+/g, "-")}-${size}${unit}`;
  return Number(packCount) > 1 ? `${base}-${packCount}-pack` : base;
}

function familySizeLabel(family) {
  if (family.size != null && family.size_unit) {
    return Number(family.size) >= 1000 &&
      family.size_unit === "g"
      ? `${Number(family.size) / 1000}kg`
      : `${family.size}${family.size_unit}`;
  }
  if (family.unit_count && family.unit_type) {
    return `${family.unit_count} ${family.unit_type}${
      Number(family.unit_count) === 1 ? "" : "s"
    }`;
  }
  fail(`Family size identity missing for ${family.external_product_id}`);
}

function assertApproval(value = defaultApproval) {
  const fingerprint = sha256(
    JSON.stringify({ ...value, approval_fingerprint: null })
  );
  const variants = value.families.flatMap((family) => family.variants);
  const newFamilies = value.families.filter(
    (family) => family.kind === "NEW_CANONICAL_PRODUCT"
  );
  if (
    value.approved !== true ||
    !/^six-pack-reviewed-large-family-batch-v\d+$/.test(value.kind) ||
    value.target_project_ref !== PROJECT_REF ||
    value.family_count !== value.families.length ||
    value.new_product_count !== newFamilies.length ||
    value.row_count !== variants.length ||
    value.families.length === 0 ||
    variants.length === 0 ||
    new Set(
      variants.map((variant) => String(variant.external_variant_id))
    ).size !== variants.length ||
    value.policy.dated_products !== "EXCLUDE" ||
    value.policy.sarms !== "EXCLUDE" ||
    ![
      "EXCLUDE",
      "EXCLUDE_RESEARCH_PEPTIDES_ALLOW_COLLAGEN",
    ].includes(value.policy.peptides) ||
    value.policy.food !== "EXCLUDE" ||
    value.policy.missing_metrics !== "LEAVE_NULL_UNTIL_EXPERT_REVIEW" ||
    value.approval_fingerprint !== fingerprint
  ) {
    fail("Large family approval contract mismatch");
  }
}

function intendedVariants(family) {
  const rows = family.variants.map((variant) => {
    const size = variant.size ?? family.size ?? family.unit_count;
    const sizeUnit =
      variant.size_unit ?? family.size_unit ?? family.unit_type;
    const packCount = Number(variant.pack_count ?? 1);
    const sizeLabel =
      variant.size != null && variant.size_unit
        ? Number(variant.size) >= 1000 && variant.size_unit === "g"
          ? `${Number(variant.size) / 1000}kg`
          : `${variant.size}${variant.size_unit}`
        : familySizeLabel(family);
    const packLabel =
      packCount > 1 ? ` Box of ${packCount}` : "";
    return {
      external_variant_id: String(variant.external_variant_id),
      expected_id: variant.product_variant_id
        ? String(variant.product_variant_id)
        : null,
      variant_key: variantKey(
        variant.flavour,
        size,
        sizeUnit,
        packCount
      ),
      display_name: `${variant.flavour}${packLabel} / ${sizeLabel}`,
      flavour_code: normalize(variant.flavour),
      flavour_label: variant.flavour,
      size_value:
        variant.size == null && family.size == null ? null : Number(size),
      size_unit:
        variant.size_unit || family.size_unit || null,
      pack_count: packCount,
      product_format: family.product_format,
      is_active: true,
      is_default: false,
    };
  });
  if (family.kind === "NEW_CANONICAL_PRODUCT") {
    rows.unshift({
      external_variant_id: null,
      expected_id: null,
      variant_key: "default",
      display_name: "Default",
      flavour_code: null,
      flavour_label: null,
      size_value: null,
      size_unit: null,
      pack_count: 1,
      product_format: family.product_format,
      is_active: true,
      is_default: true,
    });
  }
  return rows;
}

function semanticKey(row) {
  return [
    normalize(row.flavour_code || row.flavour_label),
    row.size_value == null ? "" : Number(row.size_value),
    String(row.size_unit || "").toLowerCase(),
    Number(row.pack_count || 1),
    Boolean(row.is_default),
  ].join(":");
}

function classifyVariants(existing, intended) {
  if (existing.length === 0) return { state: "EMPTY", matches: [] };
  const bySemantic = new Map(
    existing
      .filter((row) => row.is_active !== false)
      .map((row) => [semanticKey(row), row])
  );
  const matches = intended.map((row) => bySemantic.get(semanticKey(row)));
  if (matches.some((row) => !row)) {
    return { state: "PARTIAL", matches: matches.filter(Boolean) };
  }
  for (let index = 0; index < intended.length; index += 1) {
    const expected = intended[index];
    const actual = matches[index];
    if (
      actual.variant_key !== expected.variant_key ||
      actual.display_name !== expected.display_name ||
      normalize(actual.flavour_code) !== normalize(expected.flavour_code) ||
      normalize(actual.flavour_label) !== normalize(expected.flavour_label) ||
      String(actual.product_format || "") !==
        String(expected.product_format || "") ||
      actual.is_default !== expected.is_default ||
      actual.is_active !== true ||
      (expected.expected_id &&
        String(actual.id) !== String(expected.expected_id))
    ) {
      fail("Large family canonical variant identity drift");
    }
  }
  return { state: "COMPLETE", matches };
}

function productPayload(family) {
  const hasMassSize =
    family.size != null && family.size_unit === "g";
  return {
    name: family.name,
    slug: family.slug,
    brand: family.brand,
    category: family.category,
    price: Number(family.price),
    image: family.image,
    description: null,
    servings: null,
    gtin: null,
    is_active: true,
    net_weight_g: hasMassSize ? Number(family.size) : null,
    net_volume_ml: null,
    serving_count_verified: null,
    serving_size_g: null,
    serving_size_ml: null,
    protein_per_serving_g: null,
    creatine_per_serving_g: null,
    unit_count: family.unit_count ?? null,
    unit_type: family.unit_type ?? null,
    product_format: family.product_format,
    unit_pricing_verified: false,
    nutrition_verified: false,
  };
}

function parseArgs(argv) {
  const values = {};
  for (const argument of argv) {
    const match = argument.match(/^--(mode|output|approval)=(.*)$/);
    if (!match || values[match[1]]) fail(`Invalid argument ${argument}`);
    values[match[1]] = match[2];
  }
  if (!["dry-run", "apply"].includes(values.mode)) {
    fail("Required --mode=dry-run|apply");
  }
  if (!values.output) {
    fail("Required --output=<tmp path>");
  }
  const output = path.resolve(values.output);
  const relative = path.relative(path.join(ROOT, "tmp"), output);
  if (!relative || relative.startsWith("..") || path.isAbsolute(relative)) {
    fail("Output must be inside repository tmp");
  }
  const approvalPath = path.resolve(
    values.approval || DEFAULT_APPROVAL
  );
  const approvalRelative = path
    .relative(path.join(ROOT, "config", "retailers"), approvalPath)
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
  return { mode: values.mode, output, approval: approvalPath };
}

function client() {
  dotenv.config({ path: path.join(ROOT, ".env.local"), quiet: true });
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (
    !url ||
    !key ||
    new URL(url).hostname.split(".")[0] !== PROJECT_REF
  ) {
    fail("Production service credential mismatch");
  }
  return createClient(url, key, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

async function readVariants(db, productId) {
  const result = await db
    .from("product_variants")
    .select(
      "id,product_id,variant_key,display_name,flavour_code,flavour_label,size_value,size_unit,pack_count,product_format,is_active,is_default"
    )
    .eq("product_id", productId);
  if (result.error) throw result.error;
  return result.data || [];
}

async function findFamilyProduct(db, family) {
  const fields =
    "id,name,slug,brand,category,product_format,is_active,merged_into_product_id";
  const bySlug = await db
    .from("products")
    .select(fields)
    .eq("slug", family.slug);
  if (bySlug.error) throw bySlug.error;
  if (bySlug.data.length > 1) {
    fail(`Duplicate canonical family slug ${family.external_product_id}`);
  }
  if (bySlug.data.length === 1) return bySlug.data[0];
  const byName = await db
    .from("products")
    .select(fields)
    .eq("name", family.name);
  if (byName.error) throw byName.error;
  if (byName.data.length > 0) {
    fail(`Canonical family name already uses another slug for ${family.external_product_id}`);
  }
  return null;
}

async function ensureNewFamily(db, family) {
  let product = await findFamilyProduct(db, family);
  let insertedProduct = false;
  if (product) {
    if (
      product.name !== family.name ||
      product.slug !== family.slug ||
      product.brand !== family.brand ||
      product.category !== family.category ||
      product.product_format !== family.product_format ||
      product.is_active !== true ||
      product.merged_into_product_id != null
    ) {
      fail(`Canonical product identity drift for ${family.external_product_id}`);
    }
  } else {
    const result = await db
      .from("products")
      .insert(productPayload(family))
      .select(
        "id,name,slug,brand,category,product_format,is_active,merged_into_product_id"
      )
      .single();
    if (result.error) throw result.error;
    product = result.data;
    insertedProduct = true;
  }
  const intended = intendedVariants(family);
  let existing = await readVariants(db, product.id);
  let classification = classifyVariants(existing, intended);
  if (classification.state === "PARTIAL") {
    fail(`Partial canonical family state for ${family.external_product_id}`);
  }
  if (classification.state === "EMPTY") {
    const payload = intended.map(
      ({ external_variant_id, expected_id, ...variant }) => ({
        ...variant,
        product_id: product.id,
        gtin: null,
        image: null,
        nutrition_override: {},
      })
    );
    const result = await db
      .from("product_variants")
      .insert(payload)
      .select(
        "id,product_id,variant_key,display_name,flavour_code,flavour_label,size_value,size_unit,pack_count,product_format,is_active,is_default"
      );
    if (result.error) {
      if (insertedProduct) {
        const cleanup = await db.from("products").delete().eq("id", product.id);
        if (cleanup.error) {
          fail(
            `Variant insert and compensating product cleanup failed for ${family.external_product_id}`
          );
        }
      }
      throw result.error;
    }
    existing = result.data || [];
    classification = classifyVariants(existing, intended);
  }
  if (classification.state !== "COMPLETE") {
    fail(`Canonical family bootstrap failed for ${family.external_product_id}`);
  }
  return {
    external_product_id: family.external_product_id,
    product_id: String(product.id),
    inserted_product: insertedProduct,
    variants: intended
      .filter((row) => row.external_variant_id)
      .map((row, index) => ({
        external_variant_id: row.external_variant_id,
        product_variant_id: String(
          classification.matches[index + 1].id
        ),
      })),
  };
}

async function ensureExistingFamily(db, family) {
  const productResult = await db
    .from("products")
    .select("id,is_active,merged_into_product_id")
    .eq("id", Number(family.product_id))
    .single();
  if (productResult.error) throw productResult.error;
  if (
    productResult.data.is_active !== true ||
    productResult.data.merged_into_product_id != null
  ) {
    fail(`Existing canonical family drift for ${family.external_product_id}`);
  }
  const intended = intendedVariants(family);
  let existing = await readVariants(db, Number(family.product_id));
  const bySemantic = new Map(
    existing
      .filter((row) => row.is_active !== false)
      .map((row) => [semanticKey(row), row])
  );
  const missing = intended.filter(
    (row) => !bySemantic.has(semanticKey(row))
  );
  if (missing.some((row) => row.expected_id)) {
    fail(`Expected variant missing for ${family.external_product_id}`);
  }
  if (missing.length > 0) {
    const result = await db.from("product_variants").insert(
      missing.map(
        ({ external_variant_id, expected_id, ...variant }) => ({
          ...variant,
          product_id: Number(family.product_id),
          gtin: null,
          image: null,
          nutrition_override: {},
        })
      )
    );
    if (result.error) throw result.error;
    existing = await readVariants(db, Number(family.product_id));
  }
  const classification = classifyVariants(existing, intended);
  if (classification.state !== "COMPLETE") {
    fail(`Existing family bootstrap failed for ${family.external_product_id}`);
  }
  return {
    external_product_id: family.external_product_id,
    product_id: String(family.product_id),
    inserted_product: false,
    variants: intended.map((row, index) => ({
      external_variant_id: row.external_variant_id,
      product_variant_id: String(classification.matches[index].id),
    })),
  };
}

async function inspectFamily(db, family) {
  if (family.kind === "NEW_CANONICAL_PRODUCT") {
    const product = await findFamilyProduct(db, family);
    if (!product) {
      return {
        external_product_id: family.external_product_id,
        action: "CREATE_PRODUCT_AND_VARIANTS",
        product_id: null,
        variant_count: family.variants.length,
      };
    }
    if (
      product.name !== family.name ||
      product.slug !== family.slug ||
      product.brand !== family.brand ||
      product.category !== family.category ||
      product.product_format !== family.product_format ||
      product.is_active !== true ||
      product.merged_into_product_id != null
    ) {
      fail(`Canonical product identity drift for ${family.external_product_id}`);
    }
    const classification = classifyVariants(
      await readVariants(db, product.id),
      intendedVariants(family)
    );
    if (classification.state === "PARTIAL") {
      fail(`Partial canonical family state for ${family.external_product_id}`);
    }
    return {
      external_product_id: family.external_product_id,
      action:
        classification.state === "EMPTY"
          ? "CREATE_VARIANTS"
          : "VERIFY_COMPLETE",
      product_id: String(product.id),
      variant_count: family.variants.length,
    };
  }
  const product = await db
    .from("products")
    .select("id,is_active,merged_into_product_id")
    .eq("id", Number(family.product_id))
    .single();
  if (product.error) throw product.error;
  if (
    product.data.is_active !== true ||
    product.data.merged_into_product_id != null
  ) {
    fail(`Existing canonical family drift for ${family.external_product_id}`);
  }
  const intended = intendedVariants(family);
  const existing = await readVariants(db, Number(family.product_id));
  const bySemantic = new Map(
    existing
      .filter((row) => row.is_active !== false)
      .map((row) => [semanticKey(row), row])
  );
  const missing = intended.filter(
    (row) => !bySemantic.has(semanticKey(row))
  );
  if (missing.some((row) => row.expected_id)) {
    fail(`Expected variant missing for ${family.external_product_id}`);
  }
  return {
    external_product_id: family.external_product_id,
    action: missing.length > 0 ? "CREATE_VARIANTS" : "VERIFY_COMPLETE",
    product_id: String(family.product_id),
    variant_count: family.variants.length,
    missing_variant_count: missing.length,
  };
}

async function run(options, dependencies = {}) {
  if (
    options.mode === "apply" &&
    (process.env.GITHUB_ACTIONS !== "true" ||
      process.env.GITHUB_REF !== "refs/heads/main" ||
      process.env.GITHUB_REPOSITORY !==
        "SupplementScout/supplementscout")
  ) {
    fail("Large family bootstrap is restricted to GitHub Actions on main");
  }
  const approval =
    dependencies.approval ||
    JSON.parse(fs.readFileSync(options.approval, "utf8"));
  assertApproval(approval);
  const db = dependencies.client || client();
  if (options.mode === "dry-run") {
    const families = [];
    for (const family of approval.families) {
      families.push(await inspectFamily(db, family));
    }
    const report = {
      schema_version: 1,
      kind: "six-pack-large-family-bootstrap-preflight",
      result: "PASS",
      database_writes: 0,
      target_project_ref: PROJECT_REF,
      approval_fingerprint: approval.approval_fingerprint,
      family_count: families.length,
      planned_product_create_count: families.filter((family) =>
        family.action.startsWith("CREATE_PRODUCT")
      ).length,
      planned_variant_create_count: families.reduce(
        (total, family) =>
          total +
          (family.action === "CREATE_PRODUCT_AND_VARIANTS"
            ? family.variant_count
            : family.missing_variant_count || 0),
        0
      ),
      families,
      completed_at: new Date().toISOString(),
    };
    fs.mkdirSync(path.dirname(options.output), { recursive: true });
    fs.writeFileSync(options.output, `${JSON.stringify(report, null, 2)}\n`);
    return report;
  }
  const families = [];
  for (const family of approval.families) {
    families.push(
      family.kind === "NEW_CANONICAL_PRODUCT"
        ? await ensureNewFamily(db, family)
        : await ensureExistingFamily(db, family)
    );
  }
  const report = {
    schema_version: 1,
    kind: "six-pack-large-family-bootstrap",
    result: "PASS",
    target_project_ref: PROJECT_REF,
    approval_fingerprint: approval.approval_fingerprint,
    family_count: families.length,
    inserted_product_count: families.filter(
      (family) => family.inserted_product
    ).length,
    verified_variant_count: families.reduce(
      (total, family) => total + family.variants.length,
      0
    ),
    families,
    completed_at: new Date().toISOString(),
  };
  fs.mkdirSync(path.dirname(options.output), { recursive: true });
  fs.writeFileSync(options.output, `${JSON.stringify(report, null, 2)}\n`);
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
  assertApproval,
  classifyVariants,
  intendedVariants,
  parseArgs,
  productPayload,
};
