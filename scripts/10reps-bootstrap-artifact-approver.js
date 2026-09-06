const fs = require("node:fs");
const path = require("node:path");
const crypto = require("node:crypto");
const { Client } = require("pg");
const { parse } = require("csv-parse/sync");
const { canonicalJson, normalizeNumbersToDecimalStrings } = require("./lib/canonical-json");

const ROOT = path.resolve(__dirname, "..");
const PROFILE = Object.freeze({
  id: "bootstrap",
  manifest: path.join(ROOT, "config/retailers/10reps-reviewed-bindings-v1.json"),
  manifestSha256: "dc0bc67840bb7f74e555ab2b60a42dc13b46fc8522ae3549a6a3888d7c5c3283",
  manifestKind: "10reps-reviewed-existing-bindings-v1",
  manifestRowCount: 20,
  artifact: path.join(ROOT, "tmp/retailer-feeds/10reps/10reps-reviewed-bindings-v1-dry-run.json"),
  artifactSha256: "68bff98ddabff332a71fcf968214a09a0fe94d473c2dae110d473a725cc33785",
  csv: path.join(ROOT, "tmp/retailer-feeds/10reps/10reps-reviewed-bindings-v1.csv"),
  csvSha256: "0ecba1a6528c4e4397ab48256355fee7d8e7a2f40d6a6ac0276df8b42762da36",
  fingerprint: "b8ee7742e878f30d4343044332471a7a",
  allowedFingerprints: Object.freeze(["b8ee7742e878f30d4343044332471a7a"]),
  reviewedStart: 0,
  rowCount: 20,
  retailerAction: "create",
  retailerId: null,
  expectedInStock: true,
  sourceVariantIncludesPackCount: false,
  approvalSource: "10reps-reviewed-bootstrap-row-1",
  applicationName: "10reps-bootstrap-artifact-approver",
  role: "retailer_catalogue_production_approver",
  login: "supplementscout_production_approver_login",
  project: "aftboxmrdgyhizicfsfu",
});
const REMAINING_BINDINGS = Object.freeze([
  [2, "8481", 882, 1406, "0146b444423932cdac03d5175a354fc8"],
  [3, "8489", 882, 1397, "20fe6c3d91a4dbe20d05503e64da3cb1"],
  [4, "8638", 837, 1237, "614b7db0399ef3067433487919940e7e"],
  [5, "8640", 837, 1238, "1d54539de90dfada5b07f4069a2a8bdf"],
  [6, "8641", 837, 2766, "ff56bab1f919e5efbe9ccc5253e0d210"],
  [7, "8642", 837, 1239, "bdb4d7765cfaa33b7ee6fe71b69250f5"],
  [8, "8643", 837, 1240, "e4986c4ea18c53819675a8373da94b20"],
  [9, "8956", 743, 1995, "3825a5a5a16592d1155b140dc92a7e17"],
  [10, "8957", 743, 802, "da442a972125575e528e722e56e71fac"],
  [11, "8962", 743, 807, "acda44bc8b89d033135559af28b87e48"],
  [12, "8963", 743, 808, "1a497a00f2a403a9172e68f8536477de"],
  [13, "8965", 743, 1993, "4c423dc00d88292e427ab82db026798d"],
  [14, "8966", 743, 811, "215fa3a6b7bd531b147259c4f7153247"],
  [15, "9571", 338, 1785, "ecb00823abe6bd34d2a2bbc059d05e81"],
  [16, "9572", 338, 1020, "74cb1a3e7b81e257337994ccb05b27e7"],
  [17, "9574", 338, 1782, "6a9ba9f5ecc9c24db1dbbc7914b71a4e"],
  [18, "9575", 338, 1783, "fcbb902723f5efc0dd3e5c720b44b2b5"],
  [19, "9576", 338, 1784, "39313813786ddafe3fb59d8355633c32"],
  [20, "9577", 338, 1786, "4279a29e399f0a1a39ae1b0c439e171e"],
].map(([reviewRow, externalVariantId, productId, productVariantId, fingerprint]) => Object.freeze({ reviewRow, externalVariantId, productId, productVariantId, fingerprint })));
const REMAINING_PROFILE = Object.freeze({
  id: "remaining-19",
  manifest: PROFILE.manifest,
  manifestSha256: PROFILE.manifestSha256,
  manifestKind: PROFILE.manifestKind,
  manifestRowCount: PROFILE.manifestRowCount,
  artifact: path.join(ROOT, "tmp/retailer-feeds/10reps/10reps-reviewed-bindings-v1-remaining-19-dry-run.json"),
  artifactSha256: "a1f5ca5aacb093d55ad909b4528e9ab0d6e88dbd5eb144c4cd2406d107abbb3e",
  csv: path.join(ROOT, "tmp/retailer-feeds/10reps/10reps-reviewed-bindings-v1-remaining-19.csv"),
  csvSha256: "7b95c17d343f086aebd5d9f9b6f9f5485386e51140be6c87dcd8bd7cca2d94db",
  fingerprint: REMAINING_BINDINGS[0].fingerprint,
  allowedFingerprints: Object.freeze(REMAINING_BINDINGS.map(binding => binding.fingerprint)),
  bindings: REMAINING_BINDINGS,
  reviewedStart: 1,
  rowCount: 19,
  retailerAction: "existing",
  retailerId: "14",
  expectedInStock: true,
  sourceVariantIncludesPackCount: false,
  approvalSource: "10reps-reviewed-remaining-19",
  applicationName: "10reps-remaining-19-artifact-approver",
  role: PROFILE.role,
  login: PROFILE.login,
  project: PROFILE.project,
});
const EXACT_OOS_BINDINGS = Object.freeze([
  [1, "7712", 788, 1073, "80844944ed999b45ce749d1f16274304"],
  [2, "7713", 788, 1074, "3eefc534e996ede22e2b830297f6d6a9"],
  [3, "7714", 788, 1075, "f541bef74fbc877f3e96786bde5aef3f"],
  [4, "7715", 788, 1076, "1906577cf68aa7fca411059a1865316b"],
  [5, "7716", 788, 1077, "fdd8edd307ce1957efb0f81abe3b15a4"],
  [6, "7718", 788, 1078, "f2b7f6c51b92264fd325925df9e3e9e1"],
  [7, "7720", 788, 1081, "cd08db137f96ece56f8145cb7e0cc7c4"],
  [8, "7721", 788, 1082, "4892cbd3b9114a46b4a4f61a5fb1cf93"],
  [9, "8007", 752, 868, "388313c77aa61f3983819920f22a00ce"],
  [10, "8008", 752, 869, "fcd9a1accbd6133b4a314e442257a221"],
  [11, "8040", 745, 817, "9b3aa18ee272da4fbfd94d0cb41b6478"],
  [12, "8043", 745, 819, "3f4f80a065340901b669eb28a062191a"],
  [13, "8045", 745, 820, "f8a3956616ffdd400d00822d543c130e"],
  [14, "8046", 745, 821, "733569284c1c47cc223fb14cd634f65e"],
  [15, "8047", 745, 2254, "3092ea0f943bf26b270e7f84c02fa76e"],
  [16, "8048", 745, 822, "eb6646e9ed1b505c0ff68d6717c763e1"],
  [17, "8049", 745, 823, "f8805e4702acee5fdf87845e3f3e6744"],
  [18, "8482", 882, 1405, "7f8b891898adf548159d4e421c335d78"],
  [19, "8483", 882, 1396, "63a086989578c560d0d784e85d1b8ffd"],
  [20, "8485", 882, 1403, "581e887f018d1e3b161e3c17a6458e59"],
  [21, "8490", 882, 1401, "fa4d1cc55ff30c86fd475bd8f7bbcb4e"],
  [22, "8491", 882, 1402, "eacfc62806bf405aa14e999c8fd54cdf"],
  [23, "8644", 837, 1241, "ae6f5c4da3205cd4907c607b6f8158dc"],
  [24, "8964", 743, 1994, "16eb5b63c63cee623dc7d493b29ce640"],
].map(([reviewRow, externalVariantId, productId, productVariantId, fingerprint]) => Object.freeze({ reviewRow, externalVariantId, productId, productVariantId, fingerprint })));
const EXACT_OOS_PROFILE = Object.freeze({
  id: "exact-oos-24",
  manifest: path.join(ROOT, "config/retailers/10reps-reviewed-bindings-v2-exact-oos-24.json"),
  manifestSha256: "9afccb03487cce2d5c38b139675001368932b5e63e25f1723a38494e8fff9f52",
  manifestKind: "10reps-reviewed-existing-bindings-v2-exact-oos-24",
  manifestRowCount: 24,
  artifact: path.join(ROOT, "tmp/retailer-feeds/10reps/10reps-reviewed-bindings-v2-exact-oos-24-dry-run.json"),
  artifactSha256: "560dd434328955f4acd12554c3096863c482d1d0d8a97ca3b148b367ae2c64cf",
  csv: path.join(ROOT, "tmp/retailer-feeds/10reps/10reps-reviewed-bindings-v2-exact-oos-24.csv"),
  csvSha256: "5e16a807360d75afd9325e527a7ee35ea71aafd5836c1d5230ade957da6ec92d",
  fingerprint: EXACT_OOS_BINDINGS[0].fingerprint,
  allowedFingerprints: Object.freeze(EXACT_OOS_BINDINGS.map(binding => binding.fingerprint)),
  bindings: EXACT_OOS_BINDINGS,
  reviewedStart: 0,
  rowCount: 24,
  retailerAction: "existing",
  retailerId: "14",
  expectedInStock: false,
  sourceVariantIncludesPackCount: true,
  approvalSource: "10reps-reviewed-exact-oos-24",
  applicationName: "10reps-exact-oos-24-artifact-approver",
  role: PROFILE.role,
  login: PROFILE.login,
  project: PROFILE.project,
  strictReviewedManifest: true,
});
const REVIEW_22_BINDINGS = Object.freeze([
  [1, "8166", 861, 2780, "e478bcf2f818d98c2ff92e2cc35dc8d2"],
  [2, "8167", 861, 1286, "9040c9ed2aa206dd6c034427ac826d39"],
  [3, "8168", 861, 1287, "816264f639ead948a7d281c15cb95485"],
  [4, "8169", 861, 1288, "8e68331d0b0f82bffc501ba4db162eb8"],
  [5, "8170", 861, 1289, "ee495c514489cb164ef42e1ab21f2c17"],
  [6, "8173", 861, 1291, "dfd9b1ec7b0a40f7aba6c3591946cfe3"],
  [7, "8174", 861, 1292, "fcffa91822bd6a37b936929932466aa1"],
  [8, "8175", 861, 1294, "f0ff0f112b2b98901efac76a4aac0a9e"],
  [9, "8176", 861, 1295, "f311138c520d9ec77c529407b8712d59"],
  [10, "8177", 861, 1296, "182ff913e1d4f266e34e812145e38705"],
  [11, "8178", 861, 1297, "a1857eae01aac98c555b47b65010b83b"],
  [12, "8179", 861, 1298, "365fe544d9436b85719c8b13dd5a32da"],
  [13, "8180", 861, 1299, "6e3dd2b268705ca0119520bfc074e0d6"],
  [14, "8182", 861, 1380, "68bd4739d7d4fbc995788c611db479ad"],
  [15, "3958", 861, 1381, "ddcb058129cbbd4a3077edbef5401291"],
  [16, "4011", 90, 24, "ab3744347558caf66f3ec97c3b894db9"],
  [17, "10421", 1147, 3200, "d008d01d0fcefd232bbe7005512208c8"],
  [18, "10461", 790, 1094, "6ab8414097b4b7b147d58a2a0202f428"],
  [19, "10462", 790, 1095, "374c56cf7c52b05e6e5d98efe568bd77"],
  [20, "10464", 790, 1097, "513f7f3b0734db605209f3a50b3198bb"],
  [21, "10465", 790, 1098, "b9abb779aa77b88fe8fb3f3f9c8b2bdb"],
  [22, "10717", 507, 471, "2321350d339a74960d419f16b6a338d4"],
].map(([reviewRow, externalVariantId, productId, productVariantId, fingerprint]) => Object.freeze({ reviewRow, externalVariantId, productId, productVariantId, fingerprint })));
const REVIEW_22_PROFILE = Object.freeze({
  id: "existing-variant-22",
  manifest: path.join(ROOT, "config/retailers/10reps-reviewed-bindings-v3-existing-variant-22.json"),
  manifestSha256: "ad802135687a67ffe81b5b4720e49cb386e137234a5c08909ed59c59b65a80c8",
  manifestKind: "10reps-reviewed-existing-bindings-v3-existing-variant-22",
  manifestRowCount: 22,
  artifact: path.join(ROOT, "tmp/retailer-feeds/10reps/10reps-reviewed-bindings-v3-existing-variant-22-dry-run.json"),
  artifactSha256: "213ebc24a96a66a4d15338e7d902b70e0a6bfec6aeaddc109f59a0f2504a5f38",
  csv: path.join(ROOT, "tmp/retailer-feeds/10reps/10reps-reviewed-bindings-v3-existing-variant-22.csv"),
  csvSha256: "a8788bea99cf5f584ced46f8c6db72a9464303deb89fe0a6162a9654022379bb",
  fingerprint: REVIEW_22_BINDINGS[0].fingerprint,
  allowedFingerprints: Object.freeze(REVIEW_22_BINDINGS.map(binding => binding.fingerprint)),
  bindings: REVIEW_22_BINDINGS,
  reviewedStart: 0,
  rowCount: 22,
  retailerAction: "existing",
  retailerId: "14",
  expectedInStock: null,
  sourceVariantIncludesPackCount: true,
  approvalSource: "10reps-reviewed-existing-variant-22",
  applicationName: "10reps-existing-variant-22-artifact-approver",
  role: PROFILE.role,
  login: PROFILE.login,
  project: PROFILE.project,
  strictReviewedManifest: true,
});
const PROFILES = Object.freeze([PROFILE, REMAINING_PROFILE, EXACT_OOS_PROFILE, REVIEW_22_PROFILE]);
const CREDENTIAL_PATH = path.join(process.env.USERPROFILE || "", ".supplementscout/credentials/production-approver.env");
const APPROVAL_SQL = "select public.approve_product_import_plan($1::jsonb,$2,$3,$4,now()+interval '15 minutes') result";
function requireCondition(value, message) { if (!value) throw new Error(message); }
function same(actual, expected, label) {
  requireCondition(canonicalJson(actual) === canonicalJson(expected), `Invalid ${label}`);
}
function sha256(bytes) { return crypto.createHash("sha256").update(bytes).digest("hex"); }
function checkDigest(bytes, expected, label) { same(sha256(bytes), expected, `${label} SHA`); }
function sourceFingerprint(row) { return sha256(canonicalJson(normalizeNumbersToDecimalStrings(row))); }
function planFingerprint(plan) {
  return crypto.createHash("md5").update(canonicalJson(normalizeNumbersToDecimalStrings({
    ...plan, meta: { ...plan.meta, plan_fingerprint: null },
  }))).digest("hex");
}
function checkOptions(options) {
  same(Object.keys(options).sort(), ["artifact", "csv", "planFingerprint"], "argument set");
  const profile = PROFILES.find(candidate => path.resolve(options.artifact) === candidate.artifact && path.resolve(options.csv) === candidate.csv);
  requireCondition(profile, "Invalid closed profile artifact/CSV paths");
  requireCondition(profile.allowedFingerprints.includes(options.planFingerprint), `Invalid ${profile.id} fingerprint`);
  return profile;
}
function parseArgs(argv) {
  const options = {};
  for (const arg of argv) {
    const match = arg.match(/^--(artifact|csv|plan-fingerprint)=(.+)$/);
    requireCondition(match, "Only artifact, csv and plan-fingerprint arguments are accepted");
    const key = match[1] === "plan-fingerprint" ? "planFingerprint" : match[1];
    requireCondition(!Object.hasOwn(options, key), "Duplicate argument");
    options[key] = match[2];
  }
  checkOptions(options);
  return options;
}
function reviewedPlanFingerprint(profile, reviewed) {
  if (profile === PROFILE) return reviewed.plan_fingerprint;
  const binding = profile.bindings.find(candidate => candidate.reviewRow === reviewed.review_row);
  requireCondition(binding, `Missing ${profile.id} reviewed binding`);
  same(binding.externalVariantId, reviewed.external_variant_id, "profile external variant");
  same(binding.productId, reviewed.product_id, "profile product");
  same(binding.productVariantId, reviewed.product_variant_id, "profile variant");
  return binding.fingerprint;
}
function validatePlan(entry, reviewed, source, profile = PROFILE) {
  const plan = entry.resolved_plan;
  same(plan.product, { action: "existing", id: String(reviewed.product_id) }, "existing product");
  same(plan.product_variant.action, "existing", "existing variant action");
  same(plan.product_variant.id, String(reviewed.product_variant_id), "existing variant ID");
  same(plan.expected_state.product.id, String(reviewed.product_id), "product before-state");
  same(plan.expected_state.product.name, reviewed.canonical_product, "canonical name");
  same(plan.expected_state.product.is_active, true, "active product");
  same(plan.expected_state.product.merged_into_product_id, null, "unmerged product");
  const variant = plan.expected_state.product_variant;
  const expectedVariant = {
    id: String(reviewed.product_variant_id),
    product_id: String(reviewed.product_id),
    size_value: reviewed.size == null ? null : String(reviewed.size),
    size_unit: reviewed.size_unit,
    flavour_label: reviewed.canonical_flavour,
    product_format: reviewed.product_format,
    pack_count: reviewed.pack_count == null ? null : String(reviewed.pack_count),
    is_active: true,
    is_default: reviewed.is_default_variant === true,
  };
  for (const [key, value] of Object.entries(expectedVariant)) same(variant[key], value, `variant ${key}`);
  if (profile.retailerAction === "create") {
    same(plan.retailer, { action: "create", values: { name: "10 Reps", slug: "10-reps", website: "https://www.10reps.co.uk/" } }, "retailer creation");
    same(plan.expected_state.retailer, null, "retailer absent before-state");
  } else {
    same(plan.retailer, { action: "existing", id: profile.retailerId }, "existing retailer");
    same(plan.expected_state.retailer, { id: profile.retailerId, name: "10 Reps", slug: "10-reps", website: "https://www.10reps.co.uk/" }, "retailer before-state");
  }
  for (const key of ["retailer_product", "offer"]) same(plan.expected_state[key], null, `${key} absent before-state`);
  same(plan.retailer_product.action, "create", "mapping action");
  const mapping = plan.retailer_product.values;
  for (const [key, value] of Object.entries({ external_product_id: reviewed.external_product_id, external_variant_id: reviewed.external_variant_id, product_variant_id: String(reviewed.product_variant_id), external_sku: reviewed.external_sku, external_gtin: reviewed.external_gtin, external_url: reviewed.source_url, external_name: reviewed.external_name })) same(mapping[key], value, `mapping ${key}`);
  same(mapping.external_options, reviewed.is_default_variant === true ? {} : { Flavour: reviewed.flavour, Size: reviewed.source_size }, "source options");
  same(plan.offer.action, "create", "offer action");
  same(plan.offer.values.price, reviewed.price.toFixed(2), "effective price");
  same(plan.offer.values.shipping_cost, "3.99", "shipping");
  same(plan.offer.values.total_price, ((Math.round(reviewed.price * 100) + 399) / 100).toFixed(2), "delivered price");
  same(plan.offer.values.url, reviewed.source_url, "offer URL");
  const expectedInStock = profile.expectedInStock === null ? reviewed.in_stock : profile.expectedInStock;
  same(plan.offer.values.in_stock, expectedInStock, `${profile.id} stock`);
  same(plan.price_history, { action: "create" }, "initial history");
  same(plan.approval, { approved: false, approval_type: "none" }, "unapproved plan");
  for (const [key, value] of Object.entries({ product_id: String(reviewed.product_id), product_variant_id: String(reviewed.product_variant_id), external_product_id: reviewed.external_product_id, external_variant_id: reviewed.external_variant_id, product_name: reviewed.external_name, brand: reviewed.brand, category: reviewed.category, flavour: reviewed.flavour || "", size: reviewed.size == null ? "" : `${reviewed.size} ${reviewed.size_unit}`, size_unit: reviewed.size_unit || "", image: reviewed.image_url, external_url: reviewed.source_url, affiliate_url: reviewed.source_url, external_sku: reviewed.external_sku || "", external_gtin: reviewed.external_gtin || "", shipping_known: "true", shipping_cost: "3.99", price: reviewed.price.toFixed(2), in_stock: String(expectedInStock), is_for_sale: "true" })) same(source[key], value, `source ${key}`);
  // The immutable package supplies the complete schema; these checks also keep
  // identity and commercial guards independently testable without private files.
  same(entry.operation_type, "standard_import", "operation");
  same(entry.plan_kind, "feed", "plan kind");
  same(entry.retailer_id, profile.retailerId, `${profile.id} retailer ID`);
  same(plan.meta.operation_type, entry.operation_type, "operation metadata");
  same(plan.meta.plan_kind, entry.plan_kind, "kind metadata");
  same(entry.source_row_fingerprint, sourceFingerprint(source), "source fingerprint");
  same(plan.meta.source_row_fingerprint, entry.source_row_fingerprint, "source metadata");
  same(entry.plan_fingerprint, planFingerprint(plan), "plan integrity");
  same(plan.meta.plan_fingerprint, entry.plan_fingerprint, "plan metadata");
  same(entry.plan_fingerprint, reviewedPlanFingerprint(profile, reviewed), "reviewed plan fingerprint");
}
function validatePackage(manifest, artifact, csvRows, profile = PROFILE, selectedFingerprint = profile.fingerprint) {
  same(manifest.kind, profile.manifestKind, "manifest kind");
  same(manifest.row_count, profile.manifestRowCount, "manifest row count");
  same(manifest.rows.length, profile.manifestRowCount, "reviewed rows");
  same(manifest.held_rows, [], "held rows");
  for (const flag of ["existing_products_only", "existing_variants_only", "sku_is_not_gtin"]) same(manifest.policy[flag], true, flag);
  for (const flag of ["allow_product_creation", "allow_variant_creation", "allow_canonical_gtin_updates", "allow_category_changes", "allow_live_import"]) same(manifest.policy[flag], false, flag);
  same(manifest.production_approval.approved, false, "production approval state");
  same(manifest.retailer.shipping_known, true, "known shipping");
  same(manifest.retailer.shipping_cost, 3.99, "manifest shipping");
  if (profile.strictReviewedManifest) {
    for (const flag of ["allow_canonical_product_updates", "allow_canonical_variant_updates", "allow_approval_submission", "allow_production_writes"]) same(manifest.policy[flag], false, flag);
    same(manifest.status, "OWNER_REVIEWED_BINDINGS_PENDING_BLOCKER_REVIEW", "reviewed status");
    same(manifest.binding_review.owner_reviewed, true, "owner-reviewed state");
    same(manifest.retailer.id, 14, "manifest retailer ID");
    same(manifest.retailer.expected_action, "existing", "manifest retailer action");
  }
  same(artifact.artifact_version, "1", "artifact version");
  same(artifact.row_count, String(profile.rowCount), "artifact row count");
  same(artifact.plans.length, profile.rowCount, "plan count");
  same(artifact.source_rows.length, profile.rowCount, "source count");
  same(csvRows.length, profile.rowCount, "CSV row count");
  same(artifact.blocked_rows, [], "blocked rows");
  same(artifact.summary, { blocked_row_count: "0", plan_count: String(profile.rowCount), skipped_row_count: "0" }, "artifact summary");
  same(artifact.source_file_sha256, profile.csvSha256, "artifact CSV digest");
  const reviewedRows = manifest.rows.slice(profile.reviewedStart, profile.reviewedStart + profile.rowCount);
  same(reviewedRows.length, profile.rowCount, "reviewed scope");
  same(new Set(reviewedRows.map(r => r.product_variant_id)).size, profile.rowCount, "unique target variants");
  same(new Set(artifact.plans.map(e => e.row_number)).size, profile.rowCount, "unique plan rows");
  same(new Set(artifact.source_rows.map(e => e.row_number)).size, profile.rowCount, "unique source rows");
  same(new Set(artifact.plans.map(e => e.plan_fingerprint)).size, profile.rowCount, "unique fingerprints");
  for (let index = 0; index < profile.rowCount; index++) {
    const reviewed = reviewedRows[index];
    same(reviewed.review_row, index + profile.reviewedStart + 1, "review order");
    const entry = artifact.plans.find(e => e.row_number === String(index + 2));
    const source = artifact.source_rows.find(e => e.row_number === String(index + 2));
    requireCondition(entry && source, "Missing reviewed plan/source row");
    same(source.status, "planned", "source disposition");
    same(source.source_row_fingerprint, entry.source_row_fingerprint, "source binding");
    same(source.plan_fingerprint, entry.plan_fingerprint, "source plan binding");
    const normalizedVariant = profile.sourceVariantIncludesPackCount
      ? [csvRows[index].variant_name, csvRows[index].pack_count ? `pack of ${csvRows[index].pack_count}` : ""].filter(Boolean).join(" ")
      : csvRows[index].variant_name;
    const normalizedSize = [csvRows[index].size, csvRows[index].size_unit].filter(Boolean).join(" ");
    const normalized = { ...csvRows[index], variant: normalizedVariant, size: normalizedSize };
    same(normalized, source.normalized_source_row, "CSV to artifact source");
    validatePlan(entry, reviewed, source.normalized_source_row, profile);
  }
  requireCondition(profile.allowedFingerprints.includes(selectedFingerprint), `Invalid ${profile.id} selected fingerprint`);
  const entry = artifact.plans.find(candidate => candidate.plan_fingerprint === selectedFingerprint);
  requireCondition(entry, `Missing closed ${profile.id} plan`);
  if (profile === PROFILE) {
    same(entry.row_number, "2", "bootstrap row");
    same(entry.resolved_plan.product.id, "788", "bootstrap product");
    same(entry.resolved_plan.product_variant.id, "1080", "bootstrap variant");
    same(entry.resolved_plan.retailer_product.values.external_variant_id, "10003", "bootstrap source");
  } else {
    same([...new Set(artifact.plans.map(candidate => candidate.plan_fingerprint))].sort(), [...profile.allowedFingerprints].sort(), `${profile.id} fingerprints`);
    requireCondition(!artifact.plans.some(candidate => candidate.plan_fingerprint === PROFILE.fingerprint || candidate.resolved_plan.retailer_product.values.external_variant_id === "10003" || candidate.resolved_plan.product.id === "788" && candidate.resolved_plan.product_variant.id === "1080"), "Bootstrap plan is forbidden in remaining profile");
  }
  return { entry, artifact, profile };
}
function prepareApproval(options, readFile = fs.readFileSync) {
  const profile = checkOptions(options);
  const manifestBytes = readFile(profile.manifest);
  // Git may check out the committed JSON with CRLF. Artifact/CSV digests are
  // byte-exact; only the reviewed repository manifest permits Git line endings.
  checkDigest(manifestBytes.toString("utf8").replace(/\r\n/g, "\n"), profile.manifestSha256, "manifest");
  const artifactBytes = readFile(profile.artifact);
  checkDigest(artifactBytes, profile.artifactSha256, "artifact");
  const csvBytes = readFile(profile.csv);
  checkDigest(csvBytes, profile.csvSha256, "CSV");
  return validatePackage(JSON.parse(manifestBytes), JSON.parse(artifactBytes), parse(csvBytes, { columns: true, skip_empty_lines: true }), profile, options.planFingerprint);
}
function parseCredential(text) {
  const entries = text.split(/\r?\n/).map(line => line.match(/^([A-Z0-9_]+_DATABASE_URL)=(.*)$/)).filter(Boolean);
  requireCondition(entries.length === 1, "Protected credential must contain exactly one database URL");
  let url;
  try { url = new URL(entries[0][2].trim().replace(/^(['"])(.*)\1$/, "$2")); } catch { throw new Error("Invalid protected credential"); }
  requireCondition(["postgres:", "postgresql:"].includes(url.protocol), "Direct PostgreSQL credential required");
  const login = decodeURIComponent(url.username);
  requireCondition((url.hostname === `db.${PROFILE.project}.supabase.co` && login === PROFILE.login) ||
    (/^aws-[a-z0-9-]+\.pooler\.supabase\.com$/.test(url.hostname) && login === `${PROFILE.login}.${PROFILE.project}` && url.port === "5432"), "Protected production approver endpoint/login required");
  requireCondition(url.pathname === "/postgres" && !!url.password, "Protected approver database/password required");
  for (const key of [...url.searchParams.keys()]) requireCondition(key === "sslmode", "Unexpected credential option");
  url.searchParams.delete("sslmode");
  return url.href;
}
function verifyApprovalResult(result, prepared, now = Date.now()) {
  requireCondition(result && /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(result.approval_id || ""), "Invalid approval receipt");
  const { entry, profile } = prepared;
  for (const [key, value] of Object.entries({ status: "approved", artifact_sha256: profile.artifactSha256, run_id: prepared.artifact.run_id, plan_fingerprint: entry.plan_fingerprint, source_row_fingerprint: entry.source_row_fingerprint, retailer_id: profile.retailerId, plan_kind: "feed" })) same(result[key], value, `approval receipt ${key}`);
  const expiry = Date.parse(result.expires_at);
  requireCondition(expiry > now && expiry <= now + 16 * 60_000, "Invalid approval expiry");
}
async function approveWithClient(prepared, client) {
  const { entry, profile } = prepared;
  requireCondition(profile.allowedFingerprints.includes(entry.plan_fingerprint), `Invalid ${profile.id} approval fingerprint`);
  same(planFingerprint(entry.resolved_plan), entry.plan_fingerprint, `selected ${profile.id} integrity`);
  let began = false;
  try {
    await client.connect();
    await client.query("begin"); began = true;
    await client.query("select set_config('app.retailer_catalogue_production_marker','1',true),set_config('app.retailer_catalogue_allow','1',true)");
    await client.query("SET LOCAL ROLE retailer_catalogue_production_approver");
    const identity = (await client.query("select current_user,session_user")).rows[0];
    same(identity.current_user, PROFILE.role, "approver role");
    same(identity.session_user, PROFILE.login, "approver login");
    const response = await client.query(APPROVAL_SQL, [entry.resolved_plan, profile.artifactSha256, prepared.artifact.run_id, profile.approvalSource]);
    const receipt = response.rows[0]?.result;
    verifyApprovalResult(receipt, prepared);
    await client.query("commit"); began = false;
    return { approval_id: receipt.approval_id, expires_at: receipt.expires_at, plan_fingerprint: entry.plan_fingerprint, product_id: Number(entry.resolved_plan.product.id), product_variant_id: Number(entry.resolved_plan.product_variant.id), external_variant_id: entry.resolved_plan.retailer_product.values.external_variant_id, retailer_id: profile.retailerId === null ? null : Number(profile.retailerId), approval_only: true };
  } catch (error) {
    if (began) await client.query("rollback").catch(() => {});
    throw error;
  } finally { await client.end().catch(() => {}); }
}
async function runApproval(options) {
  const prepared = prepareApproval(options);
  // No credential read or connection is reachable until the entire package passes.
  const connectionString = parseCredential(fs.readFileSync(CREDENTIAL_PATH, "utf8"));
  const client = new Client({ connectionString, ssl: { rejectUnauthorized: false }, application_name: prepared.profile.applicationName, options: "-c statement_timeout=120000" });
  return approveWithClient(prepared, client);
}
if (require.main === module) {
  Promise.resolve().then(() => runApproval(parseArgs(process.argv.slice(2))))
    .then(result => console.log(JSON.stringify(result, null, 2)))
    .catch(() => { console.error("10 Reps bootstrap approval failed; credentials and database diagnostics suppressed."); process.exitCode = 1; });
}
module.exports = { PROFILE, REMAINING_PROFILE, EXACT_OOS_PROFILE, REVIEW_22_PROFILE, CREDENTIAL_PATH, parseArgs, prepareApproval, validatePackage, validatePlan, parseCredential, planFingerprint, sourceFingerprint, checkDigest, verifyApprovalResult, approveWithClient };
