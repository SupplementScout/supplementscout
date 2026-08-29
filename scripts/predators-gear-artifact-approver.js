const crypto = require("node:crypto");
const fs = require("node:fs");
const path = require("node:path");
const { Client } = require("pg");
const {
  assertNoUndefined,
  canonicalJson,
  normalizeNumbersToDecimalStrings,
  omitUndefinedObjectFields,
} = require("./lib/canonical-json");

const ROOT = path.resolve(__dirname, "..");
const MANIFEST_PATH = path.join(
  ROOT,
  "config",
  "retailers",
  "predators-gear-reviewed-bindings-v1.json"
);
const EXPECTED_ARTIFACT_PATH = path.join(
  ROOT,
  "tmp",
  "retailer-feeds",
  "predators-gear",
  "predators-gear-reviewed-existing-bindings-v1-with-images-safe-create-dry-run-v2.json"
);
const EXPECTED_CSV_PATH = path.join(
  ROOT,
  "tmp",
  "retailer-feeds",
  "predators-gear",
  "predators-gear-reviewed-existing-bindings-v1-with-images.csv"
);
const REMAINING_ARTIFACT_PATH = path.join(
  ROOT,
  "tmp",
  "retailer-feeds",
  "predators-gear",
  "predators-gear-reviewed-existing-bindings-v1-remaining-6-dry-run.json"
);
const REMAINING_CSV_PATH = path.join(
  ROOT,
  "tmp",
  "retailer-feeds",
  "predators-gear",
  "predators-gear-reviewed-existing-bindings-v1-remaining-6.csv"
);
const BATCH2_MANIFEST_PATH = path.join(
  ROOT,
  "config",
  "retailers",
  "predators-gear-reviewed-bindings-v2.json"
);
const BATCH2_ARTIFACT_PATH = path.join(
  ROOT,
  "tmp",
  "retailer-feeds",
  "predators-gear",
  "predators-gear-reviewed-existing-bindings-v2-batch-2-safe-5-dry-run.json"
);
const BATCH2_CSV_PATH = path.join(
  ROOT,
  "tmp",
  "retailer-feeds",
  "predators-gear",
  "predators-gear-reviewed-existing-bindings-v2-batch-2-safe-5.csv"
);
const HELD4_MANIFEST_PATH = path.join(ROOT, "config", "retailers", "predators-gear-reviewed-bindings-v3-held-4.json");
const HELD_OLIMP_ARTIFACT_PATH = path.join(ROOT, "tmp", "retailer-feeds", "predators-gear", "predators-gear-held-olimp-exact-variants-v1-dry-run.json");
const HELD_OLIMP_CSV_PATH = path.join(ROOT, "tmp", "retailer-feeds", "predators-gear", "predators-gear-held-olimp-exact-variants-v1.csv");
const HELD_CM3_ARTIFACT_PATH = path.join(ROOT, "tmp", "retailer-feeds", "predators-gear", "predators-gear-held-cm3-cross-product-parent-v1-dry-run.json");
const HELD_CM3_CSV_PATH = path.join(ROOT, "tmp", "retailer-feeds", "predators-gear", "predators-gear-held-cm3-cross-product-parent-v1.csv");
const SHADOWHEY3_MANIFEST_PATH = path.join(ROOT, "config", "retailers", "predators-gear-reviewed-bindings-v4-shadowhey-3.json");
const SHADOWHEY3_ARTIFACT_PATH = path.join(ROOT, "tmp", "retailer-feeds", "predators-gear", "predators-gear-reviewed-existing-bindings-v4-shadowhey-3-dry-run.json");
const SHADOWHEY3_CSV_PATH = path.join(ROOT, "tmp", "retailer-feeds", "predators-gear", "predators-gear-reviewed-existing-bindings-v4-shadowhey-3.csv");
const NEW_PRODUCTS_V1_MANIFEST_PATH = path.join(ROOT, "config", "retailers", "predators-gear-reviewed-new-products-v1.json");
const NEW_PRODUCTS_V1_ARTIFACT_PATH = path.join(ROOT, "tmp", "retailer-feeds", "predators-gear", "predators-gear-reviewed-new-products-v1-dry-run-v2.json");
const NEW_PRODUCTS_V1_CSV_PATH = path.join(ROOT, "tmp", "retailer-feeds", "predators-gear", "predators-gear-reviewed-new-products-v1.csv");
const NEW_PRODUCTS_V1_SIMPLE2_ARTIFACT_PATH = path.join(ROOT, "tmp", "retailer-feeds", "predators-gear", "predators-gear-reviewed-new-products-v1-remaining-simple-2-dry-run.json");
const NEW_PRODUCTS_V1_SIMPLE2_CSV_PATH = path.join(ROOT, "tmp", "retailer-feeds", "predators-gear", "predators-gear-reviewed-new-products-v1-remaining-simple-2.csv");
const NEW_PRODUCTS_V1_SIBLING2_ARTIFACT_PATH = path.join(ROOT, "tmp", "retailer-feeds", "predators-gear", "predators-gear-reviewed-new-products-v1-remaining-sibling-2-dry-run-v2.json");
const NEW_PRODUCTS_V1_SIBLING2_CSV_PATH = path.join(ROOT, "tmp", "retailer-feeds", "predators-gear", "predators-gear-reviewed-new-products-v1-remaining-sibling-2.csv");
const NEW_PRODUCTS_V2_MANIFEST_PATH = path.join(ROOT, "config", "retailers", "predators-gear-reviewed-new-products-v2.json");
const NEW_PRODUCTS_V2_ARTIFACT_PATH = path.join(ROOT, "tmp", "retailer-feeds", "predators-gear", "predators-gear-reviewed-new-products-v2-approved-8-dry-run-v2.json");
const NEW_PRODUCTS_V2_CSV_PATH = path.join(ROOT, "tmp", "retailer-feeds", "predators-gear", "predators-gear-reviewed-new-products-v2-approved-8.csv");
const NEW_PRODUCTS_V3_MANIFEST_PATH = path.join(ROOT, "config", "retailers", "predators-gear-reviewed-new-products-v3.json");
const NEW_PRODUCTS_V3_INITIAL_ARTIFACT_PATH = path.join(ROOT, "tmp", "retailer-feeds", "predators-gear", "predators-gear-reviewed-new-products-v3-initial-7-dry-run.json");
const NEW_PRODUCTS_V3_INITIAL_CSV_PATH = path.join(ROOT, "tmp", "retailer-feeds", "predators-gear", "predators-gear-reviewed-new-products-v3-initial-7.csv");
const NEW_PRODUCTS_V3_REMAINING_ARTIFACT_PATH = path.join(ROOT, "tmp", "retailer-feeds", "predators-gear", "predators-gear-reviewed-new-products-v3-remaining-3-dry-run-v3.json");
const NEW_PRODUCTS_V3_REMAINING_CSV_PATH = path.join(ROOT, "tmp", "retailer-feeds", "predators-gear", "predators-gear-reviewed-new-products-v3-remaining-3.csv");
const CM3_MISSING_VARIANTS_MANIFEST_PATH = path.join(ROOT, "config", "retailers", "predators-gear-reviewed-cm3-missing-variants-v1.json");
const CM3_MISSING_VARIANTS_ARTIFACT_PATH = path.join(ROOT, "tmp", "retailer-feeds", "predators-gear", "predators-gear-reviewed-cm3-missing-variants-v1-dry-run-v6.json");
const CM3_MISSING_VARIANTS_CSV_PATH = path.join(ROOT, "tmp", "retailer-feeds", "predators-gear", "predators-gear-reviewed-cm3-missing-variants-v1.csv");
const APPROVER_CREDENTIAL_PATH = path.join(
  process.env.USERPROFILE || "",
  ".supplementscout",
  "credentials",
  "production-approver.env"
);
const APPROVER_ROLE = "retailer_catalogue_production_approver";
const APPROVER_LOGIN = "supplementscout_production_approver_login";
const STAGING_PROJECT_REF = "hxnrsyyqffztlvcrtgbf";
const EXPECTED_REVIEW_ROWS = [1, 2, 6, 7, 8, 9, 10];
const EXPECTED_EXCLUDED_ROWS = [3, 4, 5];
const SHA256_PATTERN = /^[0-9a-f]{64}$/;
const MD5_PATTERN = /^[0-9a-f]{32}$/;
const NEW_PRODUCTS_V1_REVIEWED_IDENTITIES = new Map([
  [1, ["8594181604892", "8594181604895", "DY Nutrition The Creatine Complex 316g", "create_reviewed_product_variant", "Cherry"]],
  [2, ["8594181604892", "8594181604896", "DY Nutrition The Creatine Complex 316g", "create_reviewed_product_variant", "Peach"]],
  [3, ["8594181604892", "8594181604897", "DY Nutrition The Creatine Complex 316g", "create_reviewed_product_variant", "Strawberry"]],
  [4, ["8594181608172", "8594181608172", "DY Nutrition Creatine Monohydrate 300g", "create_product_with_default_variant", null]],
  [5, ["8594181606995", "8594181606995", "DY Nutrition Magnesium Citrate 90 Tablets", "create_product_with_default_variant", null]],
]);
const NEW_PRODUCTS_V2_REVIEWED_IDENTITIES = new Map([
  [1, ["8594181605272", "8594181605272", "DY Nutrition The Glutamine Unflavoured 300g"]],
  [2, ["8594181606997", "8594181606997", "DY Nutrition Joint Support 90 Tablets"]],
  [3, ["8594181607301", "8594181607301", "Olimp Gold-Vit D3 + K2 Sport Edition 60 Capsules"]],
  [4, ["8594181607610", "8594181607610", "Trec Nutrition Vitamin D3 + K2 MK-7 60 Capsules"]],
  [5, ["8594181607614", "8594181607614", "Trec Nutrition Coenzyme Q10 100mg 90 Capsules"]],
  [7, ["8594181608175", "8594181608175", "Super Nutrition Turbo Daily Liposomal Multivitamins 90 Capsules"]],
  [8, ["8594181608181", "8594181608181", "Super Nutrition Vitamin D3 10000 IU + K2 MK-7 200mcg 60 Vegan Softgels"]],
  [10, ["8594181608202", "8594181608202", "DY Nutrition Magnesium Bisglycinate 125mg 90 Capsules"]],
]);
const NEW_PRODUCTS_V3_REVIEWED_IDENTITIES = new Map([
  [1, ["8594181605941", "8594181605941", "Olimp AAKG 1250 Extreme Mega Caps 120 Capsules", "create_product_with_default_variant", null, null]],
  [2, ["8594181607617", "8594181607617", "Trec Nutrition Vitamin B Complex 60 Capsules", "create_product_with_default_variant", null, null]],
  [3, ["8594181608219", "8594181608219", "Trec Nutrition AAKG Mega Hardcore 240 Capsules", "create_product_with_default_variant", null, null]],
  [4, ["8594181608222", "8594181608222", "Trec Nutrition Citrulline Synergy 240g", "create_product_with_default_variant", null, null]],
  [5, ["8594181603360", "8594181603369", "Olimp BCAA Xplode 500g", "create_reviewed_product_variant", "Fruit Punch", "500"]],
  [6, ["8594181603360", "8594181607205", "Olimp BCAA Xplode 500g", "create_reviewed_product_variant", "Orange", "500"]],
  [7, ["8594181603396", "8594181603399", "Olimp Glutamine Xplode 500g", "create_reviewed_product_variant", "Lemon", "500"]],
  [8, ["8594181603396", "8594181603400", "Olimp Glutamine Xplode 500g", "create_reviewed_product_variant", "Orange", "500"]],
  [9, ["8594181603396", "8594181607759", "Olimp Glutamine Xplode 500g", "create_reviewed_product_variant", "Pineapple", "500"]],
  [10, ["8594181603390", "8594181605030", "Olimp EAA Xplode 520g", "create_reviewed_product_variant", "Orange", "520"]],
]);
const CM3_MISSING_VARIANT_IDENTITIES = new Map([
  [1, ["361", "8594181607503", "8594181607507", "5902114018818", "05902114018818", "Orange", "250", "21.99"]],
  [2, ["361", "8594181607503", "8594181607563", "5902114018825", "05902114018825", "White Cola", "250", "21.99"]],
  [3, ["1067", "8594181607503", "8594181607506", "5902114018832", "05902114018832", "Orange", "500", "34.99"]],
  [4, ["1067", "8594181607503", "8594181607977", "5902114017750", "05902114017750", "Fresh Pineapple", "500", "34.99"]],
  [5, ["1067", "8594181607503", "8594181607978", "5902114017767", "05902114017767", "Pink Grapefruit", "500", "34.99"]],
]);
const REVIEWED_PROFILES = Object.freeze([
  Object.freeze({
    name: "original-v2",
    manifestPath: MANIFEST_PATH,
    manifestKind: "predators-gear-reviewed-existing-bindings-v1",
    approvalReason: "predators-gear-reviewed-bindings-v1",
    artifactPath: EXPECTED_ARTIFACT_PATH,
    artifactSha256: "ef843b77fbd0aa75f83908dadf33f4f92bda06b25f86115f8c5ffb3780ecc8c1",
    csvPath: EXPECTED_CSV_PATH,
    csvSha256: "841cbdb71a1de7e4216716bddd2dd582fd1f73901fe64929979e09768ecd7dd2",
    planCount: 7,
    reviewRows: Object.freeze([1, 2, 6, 7, 8, 9, 10]),
    retailerAction: "create",
    retailerId: null,
    planFingerprints: Object.freeze([
      "8d9c2ce4e4d88a8ddb5c7feec9ed825a",
      "5f5c0f82602db01fc7b5397b27bae4d1",
      "b3c0936ccd4005b81a49e0f2d6ab7bf2",
      "d428e32c5da245dabe86fa001e591ded",
      "0bd87626c252582d9c98ce449d529fd3",
      "d5f171f4b445a37bdf690441009da5e6",
      "69d107a53f318ced2d88ebdffc004fe8",
    ]),
    selectableFingerprints: Object.freeze(["8d9c2ce4e4d88a8ddb5c7feec9ed825a"]),
  }),
  Object.freeze({
    name: "remaining-6",
    manifestPath: MANIFEST_PATH,
    manifestKind: "predators-gear-reviewed-existing-bindings-v1",
    approvalReason: "predators-gear-reviewed-bindings-v1",
    artifactPath: REMAINING_ARTIFACT_PATH,
    artifactSha256: "6353e4285db10fe160d0b8f2ffbdea61489606c86528dc2fa31aa79f57b0428c",
    csvPath: REMAINING_CSV_PATH,
    csvSha256: "c09ce429f62098bc341e0027d05556005718e5813b3fee13e4e6a2e3ce31adfb",
    planCount: 6,
    reviewRows: Object.freeze([2, 6, 7, 8, 9, 10]),
    retailerAction: "existing",
    retailerId: "13",
    planFingerprints: Object.freeze([
      "d8e536e8361752e01a64672086af50dc",
      "78bd93523f61d5aef20b82cb4d74ecaa",
      "afaa55b519f266ed4eeb70a8db01a27f",
      "5c44cb1aa6dd494547a4fb28f99fc149",
      "36ad963f00982a936877dd2ffa2d67d4",
      "9885fc60773e83b34385dcd71908571b",
    ]),
    selectableFingerprints: Object.freeze([
      "d8e536e8361752e01a64672086af50dc",
      "78bd93523f61d5aef20b82cb4d74ecaa",
      "afaa55b519f266ed4eeb70a8db01a27f",
      "5c44cb1aa6dd494547a4fb28f99fc149",
      "36ad963f00982a936877dd2ffa2d67d4",
      "9885fc60773e83b34385dcd71908571b",
    ]),
  }),
  Object.freeze({
    name: "batch-2-safe-5",
    manifestPath: BATCH2_MANIFEST_PATH,
    manifestKind: "predators-gear-reviewed-existing-bindings-v2-batch-2",
    approvalReason: "predators-gear-reviewed-bindings-v2-batch-2-safe-5",
    artifactPath: BATCH2_ARTIFACT_PATH,
    artifactSha256: "0b9c9350dfc53c10d4769415c899ab88bff372cf784b273daaaa0cc92297440a",
    csvPath: BATCH2_CSV_PATH,
    csvSha256: "0ad4ccbdce0fa1cbdbebca24100e48f9c818d81e5527e438c4334c425269bf46",
    planCount: 5,
    reviewRows: Object.freeze([3, 6, 7, 8, 9]),
    retailerAction: "existing",
    retailerId: "13",
    planFingerprints: Object.freeze([
      "a1344d6236e5396fc6dc9f80ce684a90",
      "713d3e09c0e20c8a5ba8edeb807c7f7f",
      "a0e5ec0f9cd1b3b426246cfce955fb03",
      "f6bbb3ad3a982ce6c8abc4a243503be4",
      "4380e5ad881ca58639905b9817ec8c55",
    ]),
    selectableFingerprints: Object.freeze([
      "a1344d6236e5396fc6dc9f80ce684a90",
      "713d3e09c0e20c8a5ba8edeb807c7f7f",
      "a0e5ec0f9cd1b3b426246cfce955fb03",
      "f6bbb3ad3a982ce6c8abc4a243503be4",
      "4380e5ad881ca58639905b9817ec8c55",
    ]),
  }),
  Object.freeze({
    name: "held-olimp-exact-2",
    manifestPath: HELD4_MANIFEST_PATH,
    manifestKind: "predators-gear-reviewed-existing-bindings-v3-held-4",
    executionKey: "olimp_exact_variants",
    approvalReason: "predators-gear-reviewed-bindings-v3-held-olimp-exact-2",
    artifactPath: HELD_OLIMP_ARTIFACT_PATH,
    artifactSha256: "b6928e1f5eaaae38538ca9e247586acd4e7c76b5199e851d4a285b79666c657d",
    csvPath: HELD_OLIMP_CSV_PATH,
    csvSha256: "869684ebfe5c69d2877acb1f3b8f19f1a07b9686dd9b1c9a1a77fcdc03f6a232",
    planCount: 2,
    reviewRows: Object.freeze([1, 2]),
    retailerAction: "existing",
    retailerId: "13",
    planFingerprints: Object.freeze(["a341b5262bbb5f4c03a64f5635e04724", "38a11fce7e37ef6923dcca3fd2798593"]),
    selectableFingerprints: Object.freeze(["a341b5262bbb5f4c03a64f5635e04724", "38a11fce7e37ef6923dcca3fd2798593"]),
  }),
  Object.freeze({
    name: "held-cm3-exact-2",
    manifestPath: HELD4_MANIFEST_PATH,
    manifestKind: "predators-gear-reviewed-existing-bindings-v3-held-4",
    executionKey: "cm3_cross_product_parent",
    approvalReason: "predators-gear-reviewed-bindings-v3-held-cm3-exact-2",
    artifactPath: HELD_CM3_ARTIFACT_PATH,
    artifactSha256: "70885388f287729cfaaee00727ae49e88b5d171e21a3975199e840523255192d",
    csvPath: HELD_CM3_CSV_PATH,
    csvSha256: "46ac92ccd8a7374b0b745f8335f9cb23073aa2970261cdd051b84193bbe16468",
    planCount: 2,
    reviewRows: Object.freeze([4, 5]),
    retailerAction: "existing",
    retailerId: "13",
    planFingerprints: Object.freeze(["fde718160b0a4219ae02cbc6b7f6c173", "432fbd7af2b0a847484e12d8724d1e85"]),
    selectableFingerprints: Object.freeze(["fde718160b0a4219ae02cbc6b7f6c173", "432fbd7af2b0a847484e12d8724d1e85"]),
  }),
  Object.freeze({
    name: "shadowhey-3",
    manifestPath: SHADOWHEY3_MANIFEST_PATH,
    manifestKind: "predators-gear-reviewed-existing-bindings-v4-shadowhey-3",
    approvalReason: "predators-gear-reviewed-bindings-v4-shadowhey-3",
    artifactPath: SHADOWHEY3_ARTIFACT_PATH,
    artifactSha256: "751800690204a1353ea66497c1bd50dd88b697b7c03a7c6afc08c3c04f8f904a",
    csvPath: SHADOWHEY3_CSV_PATH,
    csvSha256: "79fab41b82b334e7e275a820c2d0860b11c799cf96e3e72c47362d9420fdc717",
    planCount: 3,
    reviewRows: Object.freeze([1, 2, 3]),
    retailerAction: "existing",
    retailerId: "13",
    planFingerprints: Object.freeze([
      "00ba9b685f3b81a2b8676f0ffe1a85dc",
      "db8d13fb0c59310089bff574369ec457",
      "65a26305967a0f1b8d47993a94820cb2",
    ]),
    selectableFingerprints: Object.freeze([
      "00ba9b685f3b81a2b8676f0ffe1a85dc",
      "db8d13fb0c59310089bff574369ec457",
      "65a26305967a0f1b8d47993a94820cb2",
    ]),
  }),
  Object.freeze({
    name: "reviewed-new-products-v1",
    manifestPath: NEW_PRODUCTS_V1_MANIFEST_PATH,
    manifestKind: "predators-gear-reviewed-new-products-v1",
    approvalReason: "predators-gear-reviewed-new-products-v1",
    artifactPath: NEW_PRODUCTS_V1_ARTIFACT_PATH,
    artifactSha256: "309de9d46985e85816701198b4b72301bfe9857838e57e315ef34b1c9d99de12",
    csvPath: NEW_PRODUCTS_V1_CSV_PATH,
    csvSha256: "790803511e8219737f0b4a637f9b83cd5ae7208f1ed5f33304a7f19f18e337a9",
    planCount: 5,
    reviewRows: Object.freeze([1, 2, 3, 4, 5]),
    retailerAction: "existing",
    retailerId: "13",
    allowsReviewedCreation: true,
    planFingerprints: Object.freeze([
      "ca0abf6244760b196aab29cfbda76510",
      "7c844da2320487376923ab979edddab6",
      "ca504fc16da99d401b9b820b3110a596",
      "8a085ee3c866423b0a53a8ec61d41d4c",
      "99c22d5737ab8f544000129b8055a947",
    ]),
    selectableFingerprints: Object.freeze([
      "ca0abf6244760b196aab29cfbda76510",
      "7c844da2320487376923ab979edddab6",
      "ca504fc16da99d401b9b820b3110a596",
      "8a085ee3c866423b0a53a8ec61d41d4c",
      "99c22d5737ab8f544000129b8055a947",
    ]),
  }),
  Object.freeze({
    name: "reviewed-new-products-v3-remaining-3",
    manifestPath: NEW_PRODUCTS_V3_MANIFEST_PATH,
    manifestKind: "predators-gear-reviewed-new-products-v3",
    executionKey: "remaining_sibling_profile",
    approvalReason: "predators-gear-reviewed-new-products-v3-remaining-3",
    artifactPath: NEW_PRODUCTS_V3_REMAINING_ARTIFACT_PATH,
    artifactSha256: "cbd161963251beaaa59d9fd5eda40103bd47f02bc19b277edc4ac220708a230c",
    csvPath: NEW_PRODUCTS_V3_REMAINING_CSV_PATH,
    csvSha256: "e59a78bdafcdbb2c5895c70ada2b21d01d2f553849697319079a188280b04133",
    planCount: 3,
    reviewRows: Object.freeze([6, 8, 9]),
    retailerAction: "existing",
    retailerId: "13",
    allowsReviewedSiblingVariantCreation: true,
    targetProductIds: Object.freeze({ 6: "1158", 8: "1159", 9: "1159" }),
    anchorReviewRows: Object.freeze({ 6: 5, 8: 7, 9: 7 }),
    expectedCreates: Object.freeze({ products: 0, explicitVariants: 3, implicitDefaults: 0, mappings: 3, offers: 3, history: 3 }),
    planFingerprints: Object.freeze([
      "a7399c5a511976103aff24264bccd387",
      "184c41881cce71c6df7b1a47e8b128f3",
      "638b182d7fb7e4a62915c78aa6171aab",
    ]),
    selectableFingerprints: Object.freeze([
      "a7399c5a511976103aff24264bccd387",
      "184c41881cce71c6df7b1a47e8b128f3",
      "638b182d7fb7e4a62915c78aa6171aab",
    ]),
  }),
  Object.freeze({
    name: "reviewed-new-products-v1-remaining-simple-2",
    manifestPath: NEW_PRODUCTS_V1_MANIFEST_PATH,
    manifestKind: "predators-gear-reviewed-new-products-v1",
    executionKey: "post_create_remaining_simple_profile",
    approvalReason: "predators-gear-reviewed-new-products-v1-remaining-simple-2",
    artifactPath: NEW_PRODUCTS_V1_SIMPLE2_ARTIFACT_PATH,
    artifactSha256: "1f58c031488f519ba8370ee6bdf2090b67ed724a8ff0e734ea78df837c9d4d50",
    csvPath: NEW_PRODUCTS_V1_SIMPLE2_CSV_PATH,
    csvSha256: "57f6010fe0420b71be218f76f0d57006521c4d553857a8108c62c2148833c3bd",
    planCount: 2,
    reviewRows: Object.freeze([4, 5]),
    retailerAction: "existing",
    retailerId: "13",
    allowsReviewedCreation: true,
    planFingerprints: Object.freeze([
      "f358370614b927defcd384b076d370d0",
      "60c61440407f5b244c0e3fe6bfc21064",
    ]),
    selectableFingerprints: Object.freeze([
      "f358370614b927defcd384b076d370d0",
      "60c61440407f5b244c0e3fe6bfc21064",
    ]),
  }),
  Object.freeze({
    name: "reviewed-new-products-v1-remaining-sibling-2",
    manifestPath: NEW_PRODUCTS_V1_MANIFEST_PATH,
    manifestKind: "predators-gear-reviewed-new-products-v1",
    executionKey: "post_create_remaining_sibling_profile",
    approvalReason: "predators-gear-reviewed-new-products-v1-remaining-sibling-2",
    artifactPath: NEW_PRODUCTS_V1_SIBLING2_ARTIFACT_PATH,
    artifactSha256: "5d752ca88b3509bee43ca042bea912faa26e10ece74e72dcd0fbcdc3a65aa260",
    csvPath: NEW_PRODUCTS_V1_SIBLING2_CSV_PATH,
    csvSha256: "d0bb592fa9b8a5bc5d4d670600739cbfb8529821f5f7ee637e0b83b144fdb05e",
    planCount: 2,
    reviewRows: Object.freeze([2, 3]),
    retailerAction: "existing",
    retailerId: "13",
    allowsReviewedCreation: true,
    planFingerprints: Object.freeze([
      "3cfee93984a7d8749f991de30dccfae4",
      "16f3a70ad405c500bb099742b48fac93",
    ]),
    selectableFingerprints: Object.freeze([
      "3cfee93984a7d8749f991de30dccfae4",
      "16f3a70ad405c500bb099742b48fac93",
    ]),
  }),
  Object.freeze({
    name: "reviewed-new-products-v2-approved-8",
    manifestPath: NEW_PRODUCTS_V2_MANIFEST_PATH,
    manifestKind: "predators-gear-reviewed-new-products-v2",
    approvalReason: "predators-gear-reviewed-new-products-v2-approved-8",
    artifactPath: NEW_PRODUCTS_V2_ARTIFACT_PATH,
    artifactSha256: "c8ca2fcdc04c2f6c3f1fd148e531cbaf6dc09e74fe9e2f93c83d0812b440920f",
    csvPath: NEW_PRODUCTS_V2_CSV_PATH,
    csvSha256: "0ce339b42aecfe4fd71e213d9fc84546935eb8b4dc1367b330c20741e3d23f67",
    planCount: 8,
    reviewRows: Object.freeze([1, 2, 3, 4, 5, 7, 8, 10]),
    retailerAction: "existing",
    retailerId: "13",
    allowsReviewedCreation: true,
    planFingerprints: Object.freeze([
      "0ad9094abd5198c15cca030b3e8927e1",
      "81ff81228efe105ab0b4963218d2ad1b",
      "21817f39a7ea2e265ce7f74d7f7525fc",
      "8c821db8fa0a443219fbcb20d6f2b5c4",
      "6137a92cf8db349712b9667f00f2505d",
      "d868785e77875293ff878c3950d87f8d",
      "640492ed875ded87ccf98eada63bd016",
      "9c5bbef6f5064edfab8c7f1e01fafaaa",
    ]),
    selectableFingerprints: Object.freeze([
      "0ad9094abd5198c15cca030b3e8927e1",
      "81ff81228efe105ab0b4963218d2ad1b",
      "21817f39a7ea2e265ce7f74d7f7525fc",
      "8c821db8fa0a443219fbcb20d6f2b5c4",
      "6137a92cf8db349712b9667f00f2505d",
      "d868785e77875293ff878c3950d87f8d",
      "640492ed875ded87ccf98eada63bd016",
      "9c5bbef6f5064edfab8c7f1e01fafaaa",
    ]),
  }),
  Object.freeze({
    name: "reviewed-new-products-v3-initial-7",
    manifestPath: NEW_PRODUCTS_V3_MANIFEST_PATH,
    manifestKind: "predators-gear-reviewed-new-products-v3",
    executionKey: "initial_anchor_profile",
    approvalReason: "predators-gear-reviewed-new-products-v3-initial-7",
    artifactPath: NEW_PRODUCTS_V3_INITIAL_ARTIFACT_PATH,
    artifactSha256: "08de65b758b4f243faf228b2dfaff8de7c2150e0654c59bec61f4c0605e961f4",
    csvPath: NEW_PRODUCTS_V3_INITIAL_CSV_PATH,
    csvSha256: "776ddcbfd8ba3836923d54678becbd9499cbef4148fd30df125dcdf407a76349",
    planCount: 7,
    reviewRows: Object.freeze([1, 2, 3, 4, 5, 7, 10]),
    retailerAction: "existing",
    retailerId: "13",
    allowsReviewedCreation: true,
    expectedCreates: Object.freeze({ products: 7, explicitVariants: 3, implicitDefaults: 4, mappings: 7, offers: 7, history: 7 }),
    planFingerprints: Object.freeze([
      "6604ff4af2e6f312d04aa8f0e143f6a7",
      "ab33ee6bcb143b9f1d6da93695857728",
      "f4b6afddacfca43eabc9e8bd6f085d7e",
      "91bb0ce2abf4c5b89248f4e276b1aaf8",
      "a989ce56c66942e534314d391fe285fa",
      "713f5625eb4ba1f7276912f34200507a",
      "1b41f37443e6fae2a785a9dac9811fc3",
    ]),
    selectableFingerprints: Object.freeze([
      "6604ff4af2e6f312d04aa8f0e143f6a7",
      "ab33ee6bcb143b9f1d6da93695857728",
      "f4b6afddacfca43eabc9e8bd6f085d7e",
      "91bb0ce2abf4c5b89248f4e276b1aaf8",
      "a989ce56c66942e534314d391fe285fa",
      "713f5625eb4ba1f7276912f34200507a",
      "1b41f37443e6fae2a785a9dac9811fc3",
    ]),
  }),
  Object.freeze({
    name: "cm3-missing-variants-5",
    manifestPath: CM3_MISSING_VARIANTS_MANIFEST_PATH,
    manifestKind: "predators-gear-reviewed-cm3-missing-variants-v1",
    approvalReason: "predators-gear-reviewed-cm3-missing-variants-v1",
    artifactPath: CM3_MISSING_VARIANTS_ARTIFACT_PATH,
    artifactSha256: "d9c2d98eb5b039847e9bfe0042ef43b1847c0774a480008d322f851b934be042",
    csvPath: CM3_MISSING_VARIANTS_CSV_PATH,
    csvSha256: "edfedf3d426e7b4502cc73a1c26e5a120c9c81c5f5282db3484205dffe50d7a7",
    planCount: 5,
    reviewRows: Object.freeze([1, 2, 3, 4, 5]),
    retailerAction: "existing",
    retailerId: "13",
    allowsReviewedVariantCreation: true,
    planFingerprints: Object.freeze([
      "7c79072fae1e974ceb2d830d818c9377",
      "a5c34864f761d25b6c3816fa0e4c1131",
      "6837b1331e457dac3c21f387c3748642",
      "cf7ba8cd7f9a50e2b0ca0b8373ada303",
      "fd335deebadba36164c571d4e831443d",
    ]),
    selectableFingerprints: Object.freeze([
      "7c79072fae1e974ceb2d830d818c9377",
      "a5c34864f761d25b6c3816fa0e4c1131",
      "6837b1331e457dac3c21f387c3748642",
      "cf7ba8cd7f9a50e2b0ca0b8373ada303",
      "fd335deebadba36164c571d4e831443d",
    ]),
  }),
]);

function fail(message) {
  throw new Error(message);
}

function sha256(value) {
  return crypto.createHash("sha256").update(value).digest("hex");
}

function hashJson(value, algorithm = "md5") {
  assertNoUndefined(value);
  return crypto.createHash(algorithm).update(canonicalJson(value)).digest("hex");
}

function normalizeSourceRow(row) {
  return normalizeNumbersToDecimalStrings(omitUndefinedObjectFields(row));
}

function sourceRowFingerprint(row) {
  return hashJson(normalizeSourceRow(row), "sha256");
}

function planFingerprint(plan) {
  return hashJson(normalizeNumbersToDecimalStrings({
    ...plan,
    meta: { ...plan.meta, plan_fingerprint: null },
  }));
}

function parseArgs(argv) {
  const options = {};
  const allowed = new Set(["artifact", "plan-fingerprint", "csv"]);
  for (const argument of argv) {
    const match = argument.match(/^--([^=]+)=(.+)$/);
    if (!match || !allowed.has(match[1]) || options[match[1]] !== undefined) {
      fail(`Invalid argument ${argument}`);
    }
    options[match[1]] = match[2];
  }
  for (const name of allowed) {
    if (!options[name]) fail(`Required --${name}=<value>`);
  }
  options.artifact = path.resolve(options.artifact);
  options.csv = path.resolve(options.csv);
  options.planFingerprint = String(options["plan-fingerprint"]).trim().toLowerCase();
  delete options["plan-fingerprint"];
  if (!MD5_PATTERN.test(options.planFingerprint)) {
    fail("A valid --plan-fingerprint is required");
  }
  return options;
}

function loadDryRunArtifactEquivalent(artifactPath) {
  if (!fs.existsSync(artifactPath)) fail("Dry-run artifact not found");
  const sidecarPath = `${artifactPath}.sha256`;
  if (!fs.existsSync(sidecarPath)) fail("Dry-run artifact SHA-256 sidecar not found");
  const bytes = fs.readFileSync(artifactPath);
  const expectedSha = fs.readFileSync(sidecarPath, "utf8").trim().toLowerCase();
  const rawSha = sha256(bytes);
  const text = bytes.toString("utf8");
  const normalizedSha = text.includes("\r\n")
    ? sha256(Buffer.from(text.replace(/\r\n/g, "\n"), "utf8"))
    : rawSha;
  if (!SHA256_PATTERN.test(expectedSha) || (rawSha !== expectedSha && normalizedSha !== expectedSha)) {
    fail("Dry-run artifact SHA-256 mismatch");
  }
  const artifact = JSON.parse(text);
  assertNoUndefined(artifact);
  if (
    artifact.artifact_version !== "1" ||
    !Array.isArray(artifact.source_rows) ||
    !Array.isArray(artifact.plans) ||
    !Array.isArray(artifact.blocked_rows) ||
    artifact.row_count !== String(artifact.source_rows.length)
  ) fail("Dry-run artifact schema is invalid");
  for (const source of artifact.source_rows) {
    if (source.source_row_fingerprint !== sourceRowFingerprint(source.normalized_source_row)) {
      fail("Dry-run artifact source row fingerprint mismatch");
    }
  }
  for (const entry of artifact.plans) {
    const plan = entry.resolved_plan;
    if (
      !plan ||
      entry.plan_fingerprint !== plan.meta?.plan_fingerprint ||
      entry.source_row_fingerprint !== plan.meta?.source_row_fingerprint ||
      entry.plan_kind !== plan.meta?.plan_kind ||
      entry.operation_type !== plan.meta?.operation_type ||
      entry.operation_type !== "standard_import" ||
      entry.plan_fingerprint !== planFingerprint(plan) ||
      !MD5_PATTERN.test(entry.plan_fingerprint) ||
      !SHA256_PATTERN.test(entry.source_row_fingerprint)
    ) fail("Dry-run artifact plan metadata mismatch");
    const source = artifact.source_rows.find((row) => row.row_number === entry.row_number);
    if (!source || source.source_row_fingerprint !== entry.source_row_fingerprint) {
      fail("Dry-run artifact plan/source row mismatch");
    }
  }
  return { artifact, artifactPath, artifactSha256: expectedSha };
}

function sortedNumbers(values) {
  return [...values].map(Number).sort((a, b) => a - b);
}

function sameNumbers(left, right) {
  return canonicalJson(sortedNumbers(left)) === canonicalJson(sortedNumbers(right));
}

function identityKey(row) {
  return `${String(row.external_product_id || "")}:${String(row.external_variant_id || "")}`;
}

function exactDecimal(value, expected) {
  return Number.isFinite(Number(value)) && Number(value) === Number(expected);
}

function resolveReviewedProfile(options, configuredProfile) {
  if (configuredProfile) return configuredProfile;
  const matches = REVIEWED_PROFILES.filter((profile) =>
    path.resolve(options.artifact) === path.resolve(profile.artifactPath) &&
    path.resolve(options.csv) === path.resolve(profile.csvPath)
  );
  if (matches.length !== 1) {
    fail("Artifact and CSV paths do not match exactly one reviewed Predators Gear profile");
  }
  return matches[0];
}

function validateManifest(manifest, profile) {
  const isV1 = profile.manifestKind === "predators-gear-reviewed-existing-bindings-v1";
  const isBatch2 = profile.manifestKind === "predators-gear-reviewed-existing-bindings-v2-batch-2";
  const isHeld4 = profile.manifestKind === "predators-gear-reviewed-existing-bindings-v3-held-4";
  const isShadowhey3 = profile.manifestKind === "predators-gear-reviewed-existing-bindings-v4-shadowhey-3";
  const isNewProductsV1 = profile.manifestKind === "predators-gear-reviewed-new-products-v1";
  const isNewProductsV2 = profile.manifestKind === "predators-gear-reviewed-new-products-v2";
  const isNewProductsV3 = profile.manifestKind === "predators-gear-reviewed-new-products-v3";
  const isReviewedNewProducts = isNewProductsV1 || isNewProductsV2 || isNewProductsV3;
  const isCm3MissingVariants = profile.manifestKind === "predators-gear-reviewed-cm3-missing-variants-v1";
  const commonContract =
    manifest.schema_version === 1 &&
    manifest.kind === profile.manifestKind &&
    manifest.retailer?.name === "Predators Gear" &&
    manifest.retailer?.slug === "predators-gear" &&
    manifest.retailer?.website === "https://predatorsgear.co.uk/" &&
    (isCm3MissingVariants
      ? manifest.owner_confirmation === "OWNER_APPROVED_PREDATORS_GEAR_CM3_MISSING_VARIANTS_5" &&
        manifest.retailer?.id === 13 &&
        manifest.allow_product_creation === false &&
        manifest.allow_variant_creation === true &&
        exactDecimal(manifest.shipping_cost, 0)
      : manifest.approved === true &&
        manifest.retailer?.shipping_known === true &&
        manifest.retailer?.shipping_cost === 0 &&
        manifest.policy?.allow_live_import === false &&
        manifest.policy?.sku_is_not_gtin === true &&
        (isReviewedNewProducts
          ? manifest.policy?.existing_products_only === false &&
            manifest.policy?.existing_variants_only === false &&
            manifest.policy?.allow_product_creation === true &&
            manifest.policy?.allow_variant_creation === true &&
            manifest.policy?.reviewed_rows_only === true
          : manifest.policy?.existing_products_only === true &&
            manifest.policy?.existing_variants_only === true &&
            manifest.policy?.allow_product_creation === false &&
            manifest.policy?.allow_variant_creation === false)) &&
    Array.isArray(manifest.rows);
  const v1Contract =
    isV1 &&
    manifest.canonical_csv?.row_count === 7 &&
    manifest.rows.length === 7 &&
    sameNumbers(manifest.rows.map((row) => row.review_row), EXPECTED_REVIEW_ROWS) &&
    sameNumbers(manifest.excluded_review_rows || [], EXPECTED_EXCLUDED_ROWS);
  const batch2Contract =
    isBatch2 &&
    manifest.retailer?.id === 13 &&
    manifest.canonical_csv?.row_count === 9 &&
    manifest.rows.length === 9 &&
    manifest.execution_subset?.status === "DRY_RUN_PASS" &&
    manifest.execution_subset?.csv_path === path.relative(ROOT, profile.csvPath).replaceAll("\\", "/") &&
    manifest.execution_subset?.csv_sha256 === profile.csvSha256 &&
    manifest.execution_subset?.artifact_path === path.relative(ROOT, profile.artifactPath).replaceAll("\\", "/") &&
    manifest.execution_subset?.artifact_sha256 === profile.artifactSha256 &&
    manifest.execution_subset?.plan_count === profile.planCount &&
    manifest.execution_subset?.blocked_row_count === 0 &&
    sameNumbers(manifest.execution_subset?.review_rows || [], profile.reviewRows) &&
    canonicalJson([...(manifest.execution_subset?.plan_fingerprints || [])].sort()) ===
      canonicalJson([...profile.planFingerprints].sort()) &&
    Array.isArray(manifest.held_after_dry_run) &&
    sameNumbers(manifest.held_after_dry_run.flatMap((entry) => entry.review_rows || []), [1, 2, 4, 5]);
  const heldExecution = manifest.execution_profiles?.[profile.executionKey];
  const held4Contract =
    isHeld4 &&
    manifest.retailer?.id === 13 &&
    manifest.rows.length === 4 &&
    sameNumbers(manifest.rows.map((row) => row.review_row), [1, 2, 4, 5]) &&
    canonicalJson(manifest.rows.map((row) => [row.review_row, row.product_id, row.product_variant_id])) ===
      canonicalJson([[1, 521, 3128], [2, 523, 3138], [4, 361, 1694], [5, 361, 1043]]) &&
    manifest.guard_contract?.path === "config/retailers/predators-gear-reviewed-cross-product-parent-cm3-v1.json" &&
    manifest.guard_contract?.contract === "predators-gear-reviewed-cross-product-parent-cm3-v1" &&
    heldExecution?.status === "DRY_RUN_PASS" &&
    heldExecution?.csv_path === path.relative(ROOT, profile.csvPath).replaceAll("\\", "/") &&
    heldExecution?.csv_sha256 === profile.csvSha256 &&
    heldExecution?.artifact_path === path.relative(ROOT, profile.artifactPath).replaceAll("\\", "/") &&
    heldExecution?.artifact_sha256 === profile.artifactSha256 &&
    heldExecution?.plan_count === profile.planCount &&
    heldExecution?.blocked_row_count === 0 &&
    sameNumbers(heldExecution?.review_rows || [], profile.reviewRows) &&
    canonicalJson([...(heldExecution?.plan_fingerprints || [])].sort()) === canonicalJson([...profile.planFingerprints].sort());
  const shadowhey3Contract =
    isShadowhey3 &&
    manifest.retailer?.id === 13 &&
    manifest.canonical_csv?.path === path.relative(ROOT, profile.csvPath).replaceAll("\\", "/") &&
    manifest.canonical_csv?.sha256 === profile.csvSha256 &&
    manifest.canonical_csv?.row_count === profile.planCount &&
    manifest.rows.length === 3 &&
    sameNumbers(manifest.rows.map((row) => row.review_row), profile.reviewRows) &&
    canonicalJson(manifest.rows.map((row) => [row.review_row, row.product_id, row.product_variant_id])) ===
      canonicalJson([[1, 753, 873], [2, 753, 876], [3, 753, 877]]) &&
    manifest.execution_profile?.status === "DRY_RUN_PASS" &&
    manifest.execution_profile?.artifact_path === path.relative(ROOT, profile.artifactPath).replaceAll("\\", "/") &&
    manifest.execution_profile?.artifact_sha256 === profile.artifactSha256 &&
    manifest.execution_profile?.plan_count === profile.planCount &&
    manifest.execution_profile?.blocked_row_count === 0 &&
    canonicalJson([...(manifest.execution_profile?.plan_fingerprints || [])].sort()) ===
      canonicalJson([...profile.planFingerprints].sort());
  const newProductsV1Contract =
    isNewProductsV1 &&
    manifest.retailer?.id === 13 &&
    (profile.executionKey ? manifest[profile.executionKey] : manifest.canonical_csv)?.path === path.relative(ROOT, profile.csvPath).replaceAll("\\", "/") &&
    (profile.executionKey ? manifest[profile.executionKey] : manifest.canonical_csv)?.sha256 === profile.csvSha256 &&
    (profile.executionKey ? manifest[profile.executionKey] : manifest.canonical_csv)?.row_count === profile.planCount &&
    manifest.rows.length === 5 &&
    sameNumbers(manifest.rows.map((row) => row.review_row), [1, 2, 3, 4, 5]) &&
    profile.reviewRows.every((reviewRow) => manifest.rows.some((row) => row.review_row === reviewRow)) &&
    (profile.executionKey ? manifest[profile.executionKey] : manifest.execution_profile)?.status === "DRY_RUN_PASS" &&
    (profile.executionKey ? manifest[profile.executionKey] : manifest.execution_profile)?.artifact_path === path.relative(ROOT, profile.artifactPath).replaceAll("\\", "/") &&
    (profile.executionKey ? manifest[profile.executionKey] : manifest.execution_profile)?.artifact_sha256 === profile.artifactSha256 &&
    (profile.executionKey ? manifest[profile.executionKey] : manifest.execution_profile)?.plan_count === profile.planCount &&
    (profile.executionKey ? manifest[profile.executionKey] : manifest.execution_profile)?.blocked_row_count === 0 &&
    canonicalJson([...((profile.executionKey ? manifest[profile.executionKey] : manifest.execution_profile)?.plan_fingerprints || [])].sort()) ===
      canonicalJson([...profile.planFingerprints].sort()) &&
    Array.isArray(manifest.excluded) &&
    manifest.excluded.some((value) => String(value).includes("Joint Support")) &&
    manifest.excluded.some((value) => String(value).includes("Collagen")) &&
    manifest.excluded.some((value) => String(value).includes("754"));
  const newProductsV2Contract =
    isNewProductsV2 &&
    manifest.approval_source === "OWNER_APPROVAL_2026_08_29" &&
    manifest.retailer?.id === 13 &&
    manifest.canonical_csv?.path === path.relative(ROOT, profile.csvPath).replaceAll("\\", "/") &&
    manifest.canonical_csv?.sha256 === profile.csvSha256 &&
    manifest.canonical_csv?.row_count === profile.planCount &&
    manifest.dry_run?.path === path.relative(ROOT, profile.artifactPath).replaceAll("\\", "/") &&
    manifest.dry_run?.sha256 === profile.artifactSha256 &&
    manifest.dry_run?.plan_count === profile.planCount &&
    manifest.dry_run?.blocked_row_count === 0 &&
    manifest.dry_run?.conflict_count === 0 &&
    manifest.dry_run?.would_create_products === 8 &&
    manifest.dry_run?.would_create_variants_separately === 0 &&
    manifest.dry_run?.implicit_default_variants_with_products === 8 &&
    manifest.dry_run?.would_create_retailer_products === 8 &&
    manifest.dry_run?.would_create_offers === 8 &&
    manifest.dry_run?.would_create_price_history === 8 &&
    canonicalJson([...(manifest.dry_run?.plan_fingerprints || [])].sort()) ===
      canonicalJson([...profile.planFingerprints].sort()) &&
    manifest.rows.length === profile.planCount &&
    sameNumbers(manifest.rows.map((row) => row.review_row), profile.reviewRows) &&
    Array.isArray(manifest.excluded) &&
    sameNumbers(manifest.excluded.map((row) => row.review_row), [6, 9]) &&
    manifest.policy?.owner_approved_new_products_only === true &&
    manifest.policy?.existing_retailer_only === true &&
    manifest.policy?.allow_default_variant_creation === true &&
    manifest.policy?.external_gtin_from_ean_field_only === true &&
    manifest.policy?.product_gtin_promotion === false &&
    exactDecimal(manifest.policy?.shipping_cost, 0) &&
    manifest.policy?.delivered_price_equals_price === true;
  const newProductsV3Execution = manifest[profile.executionKey];
  const newProductsV3Contract =
    isNewProductsV3 &&
    manifest.approval_source === "OWNER_APPROVAL_2026_08_29" &&
    manifest.retailer?.id === 13 &&
    manifest.canonical_csv?.row_count === 10 &&
    manifest.rows.length === 10 &&
    sameNumbers(manifest.rows.map((row) => row.review_row), [1, 2, 3, 4, 5, 6, 7, 8, 9, 10]) &&
    newProductsV3Execution?.path === path.relative(ROOT, profile.csvPath).replaceAll("\\", "/") &&
    newProductsV3Execution?.sha256 === profile.csvSha256 &&
    newProductsV3Execution?.row_count === profile.planCount &&
    sameNumbers(newProductsV3Execution?.included_review_rows || [], profile.reviewRows) &&
    newProductsV3Execution?.status === "DRY_RUN_PASS" &&
    newProductsV3Execution?.artifact_path === path.relative(ROOT, profile.artifactPath).replaceAll("\\", "/") &&
    newProductsV3Execution?.artifact_sha256 === profile.artifactSha256 &&
    newProductsV3Execution?.plan_count === profile.planCount &&
    newProductsV3Execution?.blocked_row_count === 0 &&
    newProductsV3Execution?.conflict_count === 0 &&
    newProductsV3Execution?.would_create_products === profile.expectedCreates?.products &&
    newProductsV3Execution?.would_create_explicit_variants === profile.expectedCreates?.explicitVariants &&
    newProductsV3Execution?.implicit_default_variants_with_products === profile.expectedCreates?.implicitDefaults &&
    newProductsV3Execution?.would_create_retailer_products === profile.expectedCreates?.mappings &&
    newProductsV3Execution?.would_create_offers === profile.expectedCreates?.offers &&
    newProductsV3Execution?.would_create_price_history === profile.expectedCreates?.history &&
    canonicalJson([...(newProductsV3Execution?.plan_fingerprints || [])].sort()) ===
      canonicalJson([...profile.planFingerprints].sort()) &&
    manifest.policy?.owner_approved_new_products_only === true &&
    manifest.policy?.existing_retailer_only === true &&
    manifest.policy?.allow_default_variant_creation === true &&
    manifest.policy?.external_gtin_from_ean_field_only === true &&
    manifest.policy?.product_gtin_promotion === false &&
    exactDecimal(manifest.policy?.shipping_cost, 0) &&
    manifest.policy?.delivered_price_equals_price === true;
  const cm3MissingVariantsContract =
    isCm3MissingVariants &&
    manifest.canonical_csv?.path === path.relative(ROOT, profile.csvPath).replaceAll("\\", "/") &&
    manifest.canonical_csv?.sha256 === profile.csvSha256 &&
    manifest.canonical_csv?.row_count === profile.planCount &&
    manifest.parent_external_product_id === "8594181607503" &&
    manifest.parent_url === "https://predatorsgear.co.uk/supplements-vitamins-shop/creatine-cm3/" &&
    manifest.image === "https://predatorsgear.co.uk/wp-content/uploads/2023/04/CM3-powder-Trec-Nutrition-500g.webp" &&
    manifest.rows.length === profile.planCount &&
    sameNumbers(manifest.rows.map((row) => row.review_row), profile.reviewRows) &&
    Array.isArray(manifest.existing_products) &&
    canonicalJson(manifest.existing_products.map((product) => [
      product.product_id,
      product.name,
      product.slug,
      product.size,
      product.required_anchor_variant_ids,
    ])) === canonicalJson([
      [361, "Trec CM3 Creatine Powder 250g", "trec-cm3-creatine-powder-250g", "250", [1043, 1694]],
      [1067, "Trec Nutrition CM3 Tri-Creatine Malate 500g White Cola", "trec-nutrition-cm3-tri-creatine-malate-500g-white-cola", "500", [2250]],
    ]) &&
    manifest.execution_profile?.status === "DRY_RUN_PASS" &&
    manifest.execution_profile?.artifact_path === path.relative(ROOT, profile.artifactPath).replaceAll("\\", "/") &&
    manifest.execution_profile?.artifact_sha256 === profile.artifactSha256 &&
    manifest.execution_profile?.plan_count === profile.planCount &&
    manifest.execution_profile?.blocked_row_count === 0 &&
    canonicalJson([...(manifest.execution_profile?.plan_fingerprints || [])].sort()) ===
      canonicalJson([...profile.planFingerprints].sort());
  if (
    !commonContract ||
    (!v1Contract && !batch2Contract && !held4Contract && !shadowhey3Contract && !newProductsV1Contract && !newProductsV2Contract && !newProductsV3Contract && !cm3MissingVariantsContract)
  ) {
    fail("Predators Gear reviewed manifest contract mismatch");
  }
  const identities = new Set();
  for (const row of manifest.rows) {
    const key = identityKey(row);
    if (isCm3MissingVariants) {
      const expectedIdentity = CM3_MISSING_VARIANT_IDENTITIES.get(row.review_row);
      if (
        identities.has(key) ||
        !expectedIdentity ||
        canonicalJson([
          String(row.target_product_id),
          String(row.external_product_id),
          String(row.external_variant_id),
          String(row.external_sku),
          String(row.external_gtin),
          row.flavour,
          String(row.size),
          String(row.price),
        ]) !== canonicalJson(expectedIdentity) ||
        row.action !== "create_reviewed_product_variant" ||
        ![361, 1067].includes(Number(row.target_product_id)) ||
        row.product_id != null ||
        row.product_variant_id != null ||
        row.brand !== "Trec Nutrition" ||
        row.category !== "Creatine" ||
        row.product_format !== "powder" ||
        row.size_unit !== "g" ||
        row.variant_name !== `${row.flavour} / ${row.size}g` ||
        canonicalJson(row.external_options) !== canonicalJson({ Size: `${row.size}g`, Flavour: row.flavour }) ||
        (row.review_row === 4
          ? row.source_flavour !== "Pineapple" || row.reviewed_flavour_alias !== "Pineapple -> Fresh Pineapple"
          : row.source_flavour != null || row.reviewed_flavour_alias != null)
      ) fail(`Unsafe CM3 reviewed manifest row ${row.review_row}`);
      identities.add(key);
      continue;
    }
    if (isNewProductsV3) {
      const expectedIdentity = NEW_PRODUCTS_V3_REVIEWED_IDENTITIES.get(row.review_row);
      const reviewedVariant = row.action === "create_reviewed_product_variant";
      if (
        identities.has(key) ||
        !expectedIdentity ||
        canonicalJson([
          String(row.external_product_id),
          String(row.external_variant_id),
          row.product_name,
          row.action,
          row.flavour || null,
          row.size || null,
        ]) !== canonicalJson(expectedIdentity) ||
        row.product_id != null ||
        row.product_variant_id != null ||
        row.shipping_cost !== 0 ||
        row.delivered_price !== row.price ||
        row.disposition !== "OWNER_APPROVED" ||
        row.gtin_source !== "WooCommerce CSV EAN field" ||
        !/^\d{14}$/.test(String(row.external_gtin || "")) ||
        !String(row.image || "").startsWith("https://predatorsgear.co.uk/wp-content/uploads/") ||
        !["WooCommerce CSV parent primary image", "WooCommerce CSV variation image"].includes(row.image_provenance) ||
        !String(row.source_url || "").startsWith("https://predatorsgear.co.uk/supplements-vitamins-shop/") ||
        (reviewedVariant
          ? row.variant_name !== `${row.flavour} / ${row.size}g` ||
            row.size_unit !== "g" ||
            row.product_format !== "powder" ||
            canonicalJson(row.external_options) !== canonicalJson({ Flavour: row.flavour })
          : row.external_options != null ||
            row.variant_name ||
            row.flavour ||
            row.size ||
            row.size_unit)
      ) fail(`Unsafe reviewed v3 manifest row ${row.review_row}`);
      identities.add(key);
      continue;
    }
    if (isNewProductsV2) {
      const expectedIdentity = NEW_PRODUCTS_V2_REVIEWED_IDENTITIES.get(row.review_row);
      if (
        identities.has(key) ||
        !expectedIdentity ||
        canonicalJson([
          String(row.external_product_id),
          String(row.external_variant_id),
          row.product_name,
        ]) !== canonicalJson(expectedIdentity) ||
        row.action !== "create_product_with_default_variant" ||
        row.product_id != null ||
        row.product_variant_id != null ||
        row.shipping_cost !== 0 ||
        row.delivered_price !== row.price ||
        row.disposition !== "OWNER_APPROVED" ||
        row.gtin_source !== "WooCommerce CSV EAN field" ||
        !/^\d{14}$/.test(String(row.external_gtin || "")) ||
        !String(row.image || "").startsWith("https://predatorsgear.co.uk/wp-content/uploads/") ||
        row.image_provenance !== "WooCommerce CSV parent primary image" ||
        !String(row.source_url || "").startsWith("https://predatorsgear.co.uk/supplements-vitamins-shop/") ||
        row.external_options != null ||
        row.variant_name ||
        row.flavour ||
        row.size ||
        row.size_unit
      ) fail(`Unsafe reviewed v2 manifest row ${row.review_row}`);
      identities.add(key);
      continue;
    }
    if (isNewProductsV1) {
      const reviewedVariant = row.action === "create_reviewed_product_variant";
      const simpleDefault = row.action === "create_product_with_default_variant";
      const expectedIdentity = NEW_PRODUCTS_V1_REVIEWED_IDENTITIES.get(row.review_row);
      if (
        identities.has(key) ||
        !expectedIdentity ||
        canonicalJson([
          String(row.external_product_id),
          String(row.external_variant_id),
          row.product_name,
          row.action,
          row.flavour || null,
        ]) !== canonicalJson(expectedIdentity) ||
        (!reviewedVariant && !simpleDefault) ||
        row.product_id != null ||
        row.product_variant_id != null ||
        row.shipping_cost !== 0 ||
        row.delivered_price !== row.price ||
        row.disposition !== "OWNER_APPROVED" ||
        row.gtin_source !== "WooCommerce CSV EAN field" ||
        !/^\d{14}$/.test(String(row.external_gtin || "")) ||
        !String(row.image || "").startsWith("https://predatorsgear.co.uk/wp-content/uploads/") ||
        !String(row.image_provenance || "").startsWith("WooCommerce CSV ") ||
        !String(row.source_url || "").startsWith("https://predatorsgear.co.uk/supplements-vitamins-shop/") ||
        (reviewedVariant && (row.product_name !== "DY Nutrition The Creatine Complex 316g" || row.size !== "316" || row.size_unit !== "g")) ||
        (simpleDefault && (row.variant_name || row.flavour || row.size || row.size_unit))
      ) fail(`Unsafe reviewed manifest row ${row.review_row}`);
      identities.add(key);
      continue;
    }
    if (
      identities.has(key) ||
      !row.product_id ||
      !row.product_variant_id ||
      Number(row.product_id) === 337 ||
      row.shipping_cost !== 0 ||
      row.delivered_price !== row.price ||
      row.disposition !== "OWNER_APPROVED" ||
      !String(row.image_url || "").startsWith("https://predatorsgear.co.uk/wp-content/uploads/") ||
      (!String(row.image_provenance || "").startsWith("source_") &&
        !String(row.image_provenance || "").startsWith("browser_verified_source_")) ||
      !String(row.source_url || "").startsWith("https://predatorsgear.co.uk/")
    ) fail(`Unsafe reviewed manifest row ${row.review_row}`);
    if (isV1 && [6, 7].includes(row.review_row) && Number(row.product_id) !== 510) {
      fail(`Whey review row ${row.review_row} must target product 510`);
    }
    if (
      isShadowhey3 &&
      (Number(row.product_id) !== 753 || ![873, 876, 877].includes(Number(row.product_variant_id)))
    ) fail(`Shadowhey review row ${row.review_row} has an unreviewed target`);
    identities.add(key);
  }
  return new Map(manifest.rows.map((row) => [identityKey(row), row]));
}

function validatePlan(entry, sourceRecord, reviewed, profile) {
  const source = sourceRecord?.normalized_source_row || {};
  const plan = entry.resolved_plan || {};
  const productId = String(
    profile.allowsReviewedSiblingVariantCreation
      ? profile.targetProductIds[reviewed.review_row]
      : profile.allowsReviewedVariantCreation
        ? reviewed.target_product_id
        : reviewed.product_id
  );
  const variantId = String(reviewed.product_variant_id);
  let offerUrl;
  let imageUrl;
  let sourceOptions = null;
  try {
    offerUrl = new URL(plan.offer?.values?.url);
    imageUrl = new URL(source.image);
    sourceOptions = String(source.external_options || "").trim()
      ? JSON.parse(source.external_options)
      : null;
  } catch {
    fail(`Invalid reviewed URL for row ${reviewed.review_row}`);
  }
  if (profile.allowsReviewedSiblingVariantCreation) {
    const marker = source.__reviewed_predators_new_product_identity;
    const expectedVariant = {
      display_name: reviewed.variant_name,
      flavour_code: reviewed.flavour.toLowerCase(),
      flavour_label: reviewed.flavour,
      pack_count: "1",
      product_format: "powder",
      size_unit: "g",
      size_value: String(reviewed.size),
      variant_key: `${reviewed.flavour.toLowerCase().replaceAll(" ", "-")}-${reviewed.size}g`,
    };
    const incoming = plan.retailer_product?.identity_contract?.incoming;
    const anchorReviewRow = profile.anchorReviewRows[reviewed.review_row];
    const anchorIdentity = NEW_PRODUCTS_V3_REVIEWED_IDENTITIES.get(anchorReviewRow);
    const approvedPeers = plan.retailer_product?.identity_contract?.approved_url_peers;
    if (
      entry.plan_kind !== "feed" ||
      entry.operation_type !== "standard_import" ||
      sourceRecord.status !== "planned" ||
      sourceRecord.plan_fingerprint !== entry.plan_fingerprint ||
      identityKey(source) !== identityKey(reviewed) ||
      String(source.product_id || "") !== "" ||
      String(source.product_variant_id || "") !== "" ||
      source.retailer_name !== "Predators Gear" ||
      source.retailer_website !== "https://predatorsgear.co.uk/" ||
      source.product_name !== reviewed.product_name ||
      source.slug !== reviewed.slug ||
      source.brand !== reviewed.brand ||
      source.category !== reviewed.category ||
      source.product_format !== reviewed.product_format ||
      String(source.external_sku) !== String(reviewed.external_sku) ||
      String(source.external_gtin) !== String(reviewed.external_gtin) ||
      canonicalJson(sourceOptions) !== canonicalJson(reviewed.external_options) ||
      String(source.shipping_known).toLowerCase() !== "true" ||
      !exactDecimal(source.shipping_cost, 0) ||
      !exactDecimal(source.price, reviewed.price) ||
      !exactDecimal(source.total_price, reviewed.price) ||
      source.external_url !== reviewed.source_url ||
      source.affiliate_url !== reviewed.source_url ||
      source.image !== reviewed.image ||
      canonicalJson(marker) !== canonicalJson({
        action: "create_reviewed_product_variant",
        contract: "predators-gear-reviewed-new-products-v3",
        external_product_id: String(reviewed.external_product_id),
        external_variant_id: String(reviewed.external_variant_id),
        flavour: reviewed.flavour,
        post_create_sibling: true,
        product_format: "powder",
        review_row: String(reviewed.review_row),
        safe_create_category_reviewed: false,
        size_unit: "g",
        size_value: String(reviewed.size),
        source_url: reviewed.source_url,
      }) ||
      plan.product?.action !== "existing" ||
      String(plan.product.id) !== productId ||
      String(plan.expected_state?.product?.id) !== productId ||
      plan.expected_state?.product?.is_active !== true ||
      plan.expected_state?.product?.merged_into_product_id != null ||
      plan.expected_state?.product?.name !== reviewed.product_name ||
      plan.expected_state?.product?.product_format !== "powder" ||
      plan.product_variant?.action !== "create_variant" ||
      canonicalJson(plan.product_variant?.values) !== canonicalJson(expectedVariant) ||
      canonicalJson(plan.product_variant?.evidence?.external_options) !== canonicalJson(reviewed.external_options) ||
      plan.expected_state?.product_variant != null ||
      plan.retailer?.action !== "existing" ||
      String(entry.retailer_id) !== "13" ||
      String(plan.retailer.id) !== "13" ||
      String(plan.expected_state?.retailer?.id) !== "13" ||
      plan.retailer_product?.action !== "create" ||
      plan.retailer_product?.values?.product_variant_id != null ||
      identityKey(plan.retailer_product?.values || {}) !== identityKey(reviewed) ||
      String(plan.retailer_product?.values?.external_sku) !== String(reviewed.external_sku) ||
      String(plan.retailer_product?.values?.external_gtin) !== String(reviewed.external_gtin) ||
      canonicalJson(plan.retailer_product?.values?.external_options) !== canonicalJson(reviewed.external_options) ||
      plan.retailer_product?.values?.external_url !== reviewed.source_url ||
      plan.expected_state?.retailer_product != null ||
      canonicalJson(incoming?.canonical_variant) !== canonicalJson(expectedVariant) ||
      String(incoming?.product_id) !== productId ||
      incoming?.product_variant_id != null ||
      identityKey(incoming || {}) !== identityKey(reviewed) ||
      !Array.isArray(approvedPeers) ||
      approvedPeers.length !== 2 ||
      !anchorIdentity ||
      !approvedPeers.some((peer) =>
        String(peer.external_product_id) === String(anchorIdentity[0]) &&
        String(peer.external_variant_id) === String(anchorIdentity[1]) &&
        String(peer.product_id) === productId &&
        peer.product_variant_id != null
      ) ||
      plan.offer?.action !== "create" ||
      !exactDecimal(plan.offer?.values?.price, reviewed.price) ||
      !exactDecimal(plan.offer?.values?.shipping_cost, 0) ||
      !exactDecimal(plan.offer?.values?.total_price, reviewed.price) ||
      plan.offer?.values?.url !== reviewed.source_url ||
      plan.expected_state?.offer != null ||
      plan.price_history?.action !== "create" ||
      plan.approval?.approved !== false ||
      plan.approval?.approval_type !== "none" ||
      offerUrl.protocol !== "https:" ||
      offerUrl.hostname !== "predatorsgear.co.uk" ||
      imageUrl.protocol !== "https:" ||
      imageUrl.hostname !== "predatorsgear.co.uk" ||
      Number(productId) === 337
    ) fail(`Unsafe Predators Gear v3 sibling plan for row ${reviewed.review_row}`);
    return;
  }
  if (profile.allowsReviewedVariantCreation) {
    const marker = source.__reviewed_predators_new_product_identity;
    const expectedOptions = { Size: `${reviewed.size}g`, Flavour: reviewed.flavour };
    const expectedVariant = {
      display_name: reviewed.variant_name,
      flavour_code: reviewed.flavour.toLowerCase(),
      flavour_label: reviewed.flavour,
      pack_count: "1",
      product_format: "powder",
      size_unit: "g",
      size_value: String(reviewed.size),
      variant_key: `${reviewed.flavour.toLowerCase().replaceAll(" ", "-")}-${reviewed.size}g`,
    };
    const incoming = plan.retailer_product?.identity_contract?.incoming;
    if (
      entry.plan_kind !== "feed" ||
      entry.operation_type !== "standard_import" ||
      sourceRecord.status !== "planned" ||
      sourceRecord.plan_fingerprint !== entry.plan_fingerprint ||
      identityKey(source) !== identityKey(reviewed) ||
      String(source.product_id || "") !== "" ||
      String(source.product_variant_id || "") !== "" ||
      source.retailer_name !== "Predators Gear" ||
      source.retailer_website !== "https://predatorsgear.co.uk/" ||
      source.product_name !== reviewed.product_name ||
      source.slug !== reviewed.slug ||
      source.brand !== "Trec Nutrition" ||
      source.category !== "Creatine" ||
      source.product_format !== "powder" ||
      String(source.external_sku) !== String(reviewed.external_sku) ||
      String(source.external_gtin) !== String(reviewed.external_gtin) ||
      canonicalJson(sourceOptions) !== canonicalJson(expectedOptions) ||
      String(source.shipping_known).toLowerCase() !== "true" ||
      !exactDecimal(source.shipping_cost, 0) ||
      !exactDecimal(source.price, reviewed.price) ||
      !exactDecimal(source.total_price, reviewed.price) ||
      source.external_url !== "https://predatorsgear.co.uk/supplements-vitamins-shop/creatine-cm3/" ||
      source.affiliate_url !== source.external_url ||
      source.image !== "https://predatorsgear.co.uk/wp-content/uploads/2023/04/CM3-powder-Trec-Nutrition-500g.webp" ||
      (profile.manifestKind !== "predators-gear-reviewed-new-products-v2" &&
      canonicalJson(marker) !== canonicalJson({
        action: "create_reviewed_product_variant",
        cm3_missing_variant: true,
        contract: "predators-gear-reviewed-cm3-missing-variants-v1",
        external_product_id: "8594181607503",
        external_variant_id: String(reviewed.external_variant_id),
        flavour: reviewed.flavour,
        product_format: "powder",
        review_row: String(reviewed.review_row),
        size_unit: "g",
        size_value: String(reviewed.size),
        source_url: source.external_url,
        target_product_id: productId,
      })) ||
      plan.product?.action !== "existing" ||
      String(plan.product.id) !== productId ||
      plan.expected_state?.product?.is_active !== true ||
      plan.expected_state?.product?.merged_into_product_id != null ||
      String(plan.expected_state?.product?.id) !== productId ||
      plan.expected_state?.product?.name !== reviewed.product_name ||
      plan.expected_state?.product?.product_format !== "powder" ||
      plan.product_variant?.action !== "create_variant" ||
      canonicalJson(plan.product_variant?.values) !== canonicalJson(expectedVariant) ||
      canonicalJson(plan.product_variant?.evidence?.external_options) !== canonicalJson(expectedOptions) ||
      plan.expected_state?.product_variant != null ||
      plan.retailer?.action !== "existing" ||
      String(entry.retailer_id) !== "13" ||
      String(plan.retailer.id) !== "13" ||
      String(plan.expected_state?.retailer?.id) !== "13" ||
      plan.expected_state?.retailer?.name !== "Predators Gear" ||
      plan.expected_state?.retailer?.slug !== "predators-gear" ||
      plan.expected_state?.retailer?.website !== "https://predatorsgear.co.uk/" ||
      plan.retailer_product?.action !== "create" ||
      plan.retailer_product?.values?.product_variant_id != null ||
      identityKey(plan.retailer_product?.values || {}) !== identityKey(reviewed) ||
      String(plan.retailer_product?.values?.external_sku) !== String(reviewed.external_sku) ||
      String(plan.retailer_product?.values?.external_gtin) !== String(reviewed.external_gtin) ||
      canonicalJson(plan.retailer_product?.values?.external_options) !== canonicalJson(expectedOptions) ||
      plan.retailer_product?.values?.external_url !== source.external_url ||
      plan.retailer_product?.values?.external_name !== reviewed.product_name ||
      plan.expected_state?.retailer_product != null ||
      canonicalJson(incoming?.canonical_variant) !== canonicalJson(expectedVariant) ||
      String(incoming?.product_id) !== productId ||
      incoming?.product_variant_id != null ||
      String(incoming?.retailer_id) !== "13" ||
      identityKey(incoming || {}) !== identityKey(reviewed) ||
      String(incoming?.external_sku) !== String(reviewed.external_sku) ||
      String(incoming?.external_gtin) !== String(reviewed.external_gtin) ||
      canonicalJson(incoming?.external_options) !== canonicalJson(expectedOptions) ||
      incoming?.external_url !== source.external_url ||
      !Array.isArray(plan.retailer_product?.identity_contract?.approved_url_peers) ||
      !plan.retailer_product.identity_contract.approved_url_peers.some((peer) =>
        identityKey(peer) === identityKey(reviewed) && String(peer.product_id) === productId
      ) ||
      plan.offer?.action !== "create" ||
      !exactDecimal(plan.offer?.values?.price, reviewed.price) ||
      !exactDecimal(plan.offer?.values?.shipping_cost, 0) ||
      !exactDecimal(plan.offer?.values?.total_price, reviewed.price) ||
      plan.offer?.values?.url !== source.external_url ||
      plan.expected_state?.offer != null ||
      plan.price_history?.action !== "create" ||
      plan.approval?.approved !== false ||
      plan.approval?.approval_type !== "none" ||
      offerUrl.protocol !== "https:" ||
      offerUrl.hostname !== "predatorsgear.co.uk" ||
      imageUrl.protocol !== "https:" ||
      imageUrl.hostname !== "predatorsgear.co.uk" ||
      Number(productId) === 337
    ) fail(`Unsafe Predators Gear CM3 variant plan for row ${reviewed.review_row}`);
    return;
  }
  if (profile.allowsReviewedCreation) {
    const reviewedVariant = reviewed.action === "create_reviewed_product_variant";
    const marker = source.__reviewed_predators_new_product_identity;
    const expectedProductAction = reviewedVariant
      ? "create_or_reuse_reviewed"
      : "create";
    const expectedVariantAction = reviewedVariant
      ? "create_reviewed_variant"
      : "create_default";
    if (
      entry.plan_kind !== "feed" ||
      entry.operation_type !== "standard_import" ||
      sourceRecord.status !== "planned" ||
      sourceRecord.plan_fingerprint !== entry.plan_fingerprint ||
      identityKey(source) !== identityKey(reviewed) ||
      String(source.product_id || "") !== "" ||
      String(source.product_variant_id || "") !== "" ||
      source.retailer_name !== "Predators Gear" ||
      source.retailer_website !== "https://predatorsgear.co.uk/" ||
      source.product_name !== reviewed.product_name ||
      source.slug !== reviewed.slug ||
      source.brand !== reviewed.brand ||
      source.category !== reviewed.category ||
      source.product_format !== reviewed.product_format ||
      String(source.external_sku || "") !== String(reviewed.external_sku) ||
      String(source.external_gtin || "") !== String(reviewed.external_gtin) ||
      canonicalJson(sourceOptions) !== canonicalJson(reviewed.external_options ?? null) ||
      String(source.shipping_known).toLowerCase() !== "true" ||
      !exactDecimal(source.shipping_cost, 0) ||
      !exactDecimal(source.price, reviewed.price) ||
      !exactDecimal(source.total_price, reviewed.price) ||
      source.external_url !== reviewed.source_url ||
      source.affiliate_url !== reviewed.source_url ||
      source.image !== reviewed.image ||
      (profile.manifestKind !== "predators-gear-reviewed-new-products-v2" &&
      canonicalJson(marker) !== canonicalJson({
        action: reviewed.action,
        contract: profile.manifestKind,
        external_product_id: String(reviewed.external_product_id),
        external_variant_id: String(reviewed.external_variant_id),
        flavour: reviewed.flavour || null,
        product_format: reviewed.product_format,
        review_row: String(reviewed.review_row),
        ...(profile.manifestKind === "predators-gear-reviewed-new-products-v3"
          ? { safe_create_category_reviewed: reviewed.category === "Pre Workout" }
          : {}),
        size_unit: reviewed.size_unit || null,
        size_value: reviewed.size || null,
        source_url: reviewed.source_url,
        ...(profile.name === "reviewed-new-products-v1-remaining-sibling-2"
          ? { post_create_sibling: true }
          : profile.manifestKind === "predators-gear-reviewed-new-products-v1"
            ? { post_create_sibling: false }
            : {}),
      })) ||
      plan.product?.action !== expectedProductAction ||
      plan.product?.values?.name !== reviewed.product_name ||
      plan.product?.values?.slug !== reviewed.slug ||
      plan.product?.values?.brand !== reviewed.brand ||
      plan.product?.values?.category !== reviewed.category ||
      plan.product?.values?.product_format !== reviewed.product_format ||
      plan.product?.values?.image !== reviewed.image ||
      plan.product?.values?.gtin != null ||
      plan.product_variant?.action !== expectedVariantAction ||
      plan.expected_state?.product != null ||
      plan.expected_state?.product_variant != null ||
      plan.retailer?.action !== "existing" ||
      String(entry.retailer_id) !== "13" ||
      String(plan.retailer.id) !== "13" ||
      String(plan.expected_state?.retailer?.id) !== "13" ||
      plan.expected_state?.retailer?.name !== "Predators Gear" ||
      plan.expected_state?.retailer?.slug !== "predators-gear" ||
      plan.retailer_product?.action !== "create" ||
      plan.retailer_product?.values?.product_variant_id != null ||
      identityKey(plan.retailer_product?.values || {}) !== identityKey(reviewed) ||
      String(plan.retailer_product?.values?.external_sku || "") !== String(reviewed.external_sku) ||
      String(plan.retailer_product?.values?.external_gtin || "") !== String(reviewed.external_gtin) ||
      canonicalJson(plan.retailer_product?.values?.external_options ?? null) !== canonicalJson(reviewed.external_options ?? null) ||
      plan.expected_state?.retailer_product != null ||
      plan.offer?.action !== "create" ||
      !exactDecimal(plan.offer?.values?.price, reviewed.price) ||
      !exactDecimal(plan.offer?.values?.shipping_cost, 0) ||
      !exactDecimal(plan.offer?.values?.total_price, reviewed.price) ||
      plan.offer?.values?.url !== reviewed.source_url ||
      plan.expected_state?.offer != null ||
      plan.price_history?.action !== "create" ||
      plan.approval?.approved !== true ||
      plan.approval?.approval_type !== (reviewedVariant ? "reviewed_parent_variant_safe_create" : "safe_create") ||
      plan.approval?.canonical_name !== reviewed.product_name ||
      plan.approval?.approved_category !== reviewed.category ||
      plan.approval?.has_variant_evidence !== reviewedVariant ||
      offerUrl.protocol !== "https:" ||
      offerUrl.hostname !== "predatorsgear.co.uk" ||
      imageUrl.protocol !== "https:" ||
      imageUrl.hostname !== "predatorsgear.co.uk"
    ) fail(`Unsafe Predators Gear reviewed creation plan for row ${reviewed.review_row}`);
    if (reviewedVariant) {
      if (
        plan.product_variant.values?.display_name !== reviewed.variant_name ||
        plan.product_variant.values?.flavour_label !== reviewed.flavour ||
        plan.product_variant.values?.flavour_code !== String(reviewed.flavour).toLowerCase() ||
        !exactDecimal(plan.product_variant.values?.size_value, reviewed.size) ||
        plan.product_variant.values?.size_unit !== "g" ||
        plan.product_variant.values?.product_format !== "powder" ||
        !exactDecimal(plan.product_variant.values?.pack_count, 1)
      ) fail(`Unsafe Predators Gear reviewed variant plan for row ${reviewed.review_row}`);
    } else if (plan.product_variant.values != null) {
      fail(`Unsafe Predators Gear default variant plan for row ${reviewed.review_row}`);
    }
    return;
  }
  if (
    entry.plan_kind !== "feed" ||
    entry.operation_type !== "standard_import" ||
    sourceRecord.status !== "planned" ||
    sourceRecord.plan_fingerprint !== entry.plan_fingerprint ||
    identityKey(source) !== identityKey(reviewed) ||
    String(source.product_id) !== productId ||
    String(source.product_variant_id) !== variantId ||
    source.retailer_name !== "Predators Gear" ||
    source.retailer_website !== "https://predatorsgear.co.uk/" ||
    String(source.shipping_known).toLowerCase() !== "true" ||
    !exactDecimal(source.shipping_cost, 0) ||
    !exactDecimal(source.price, reviewed.price) ||
    !exactDecimal(source.total_price, reviewed.price) ||
    source.external_url !== reviewed.source_url ||
    source.affiliate_url !== reviewed.source_url ||
    source.image !== reviewed.image_url ||
    String(source.external_gtin || "") !== String(reviewed.external_gtin14 || "") ||
    canonicalJson(sourceOptions) !== canonicalJson(reviewed.external_options ?? null) ||
    plan.product?.action !== "existing" ||
    String(plan.product.id) !== productId ||
    plan.product_variant?.action !== "existing" ||
    String(plan.product_variant.id) !== variantId ||
    plan.expected_state?.product?.is_active !== true ||
    plan.expected_state?.product?.merged_into_product_id != null ||
    String(plan.expected_state?.product?.id) !== productId ||
    plan.expected_state?.product_variant?.is_active !== true ||
    String(plan.expected_state?.product_variant?.id) !== variantId ||
    String(plan.expected_state?.product_variant?.product_id) !== productId ||
    (reviewed.canonical_variant && plan.expected_state?.product_variant?.display_name !== reviewed.canonical_variant) ||
    (reviewed.canonical_size_value != null && !exactDecimal(plan.expected_state?.product_variant?.size_value, reviewed.canonical_size_value)) ||
    (reviewed.canonical_size_unit && plan.expected_state?.product_variant?.size_unit !== reviewed.canonical_size_unit) ||
    (reviewed.canonical_pack_count != null && !exactDecimal(plan.expected_state?.product_variant?.pack_count, reviewed.canonical_pack_count)) ||
    (reviewed.canonical_product_format && plan.expected_state?.product_variant?.product_format !== reviewed.canonical_product_format) ||
    plan.retailer_product?.action !== "create" ||
    String(plan.retailer_product?.values?.product_variant_id) !== variantId ||
    String(plan.retailer_product?.values?.external_product_id) !== String(reviewed.external_product_id) ||
    String(plan.retailer_product?.values?.external_variant_id) !== String(reviewed.external_variant_id) ||
    String(plan.retailer_product?.values?.external_gtin || "") !== String(reviewed.external_gtin14 || "") ||
    canonicalJson(plan.retailer_product?.values?.external_options ?? null) !== canonicalJson(reviewed.external_options ?? null) ||
    plan.expected_state?.retailer_product != null ||
    plan.offer?.action !== "create" ||
    !exactDecimal(plan.offer?.values?.price, reviewed.price) ||
    !exactDecimal(plan.offer?.values?.shipping_cost, 0) ||
    !exactDecimal(plan.offer?.values?.total_price, reviewed.price) ||
    plan.offer?.values?.url !== reviewed.source_url ||
    plan.expected_state?.offer != null ||
    plan.price_history?.action !== "create" ||
    plan.approval?.approved !== false ||
    plan.approval?.approval_type !== "none" ||
    offerUrl.protocol !== "https:" ||
    offerUrl.hostname !== "predatorsgear.co.uk" ||
    imageUrl.protocol !== "https:" ||
    imageUrl.hostname !== "predatorsgear.co.uk" ||
    Number(productId) === 337
  ) fail(`Unsafe Predators Gear plan for review row ${reviewed.review_row}`);
  if (
    profile.manifestKind === "predators-gear-reviewed-existing-bindings-v1" &&
    [6, 7].includes(reviewed.review_row) &&
    Number(productId) !== 510
  ) {
    fail(`Whey review row ${reviewed.review_row} must target product 510`);
  }
  if (profile.retailerAction === "create") {
    if (
      entry.retailer_id != null ||
      plan.retailer?.action !== "create" ||
      plan.retailer?.values?.name !== "Predators Gear" ||
      plan.retailer?.values?.slug !== "predators-gear" ||
      plan.retailer?.values?.website !== "https://predatorsgear.co.uk/" ||
      plan.expected_state?.retailer != null
    ) fail(`Unsafe retailer create plan for review row ${reviewed.review_row}`);
  } else if (
    profile.retailerAction !== "existing" ||
    String(entry.retailer_id) !== String(profile.retailerId) ||
    plan.retailer?.action !== "existing" ||
    String(plan.retailer?.id) !== String(profile.retailerId) ||
    String(plan.expected_state?.retailer?.id) !== String(profile.retailerId) ||
    plan.expected_state?.retailer?.name !== "Predators Gear" ||
    plan.expected_state?.retailer?.slug !== "predators-gear" ||
    plan.expected_state?.retailer?.website !== "https://predatorsgear.co.uk/"
  ) fail(`Unsafe existing retailer plan for review row ${reviewed.review_row}`);
}

function validateApprovalScope(options, loaded, manifest, csvBytes, configuration = {}) {
  const profile = resolveReviewedProfile(options, configuration.profile);
  const csvSha = sha256(csvBytes);
  const artifact = loaded.artifact;
  if (
    path.resolve(options.artifact) !== path.resolve(profile.artifactPath) ||
    path.resolve(loaded.artifactPath) !== path.resolve(profile.artifactPath) ||
    loaded.artifactSha256 !== profile.artifactSha256 ||
    path.resolve(options.csv) !== path.resolve(profile.csvPath) ||
    csvSha !== profile.csvSha256 ||
    csvSha !== artifact.source_file_sha256 ||
    artifact.source_file_name !== path.basename(profile.csvPath) ||
    artifact.environment_marker !== "local" ||
    artifact.row_count !== String(profile.planCount) ||
    artifact.source_rows?.length !== profile.planCount ||
    artifact.plans?.length !== profile.planCount ||
    artifact.blocked_rows?.length !== 0 ||
    artifact.summary?.plan_count !== String(profile.planCount) ||
    artifact.summary?.blocked_row_count !== "0" ||
    artifact.summary?.skipped_row_count !== "0"
  ) fail("Predators Gear artifact, source hash, or clean-run contract mismatch");
  const allReviewed = validateManifest(manifest, profile);
  const reviewedRows = manifest.rows.filter((row) => profile.reviewRows.includes(row.review_row));
  if (reviewedRows.length !== profile.planCount) fail("Reviewed profile row scope is invalid");
  const reviewedByIdentity = new Map(reviewedRows.map((row) => [identityKey(row), allReviewed.get(identityKey(row))]));
  const fingerprints = new Set();
  const seenIdentities = new Set();
  for (const entry of artifact.plans) {
    if (fingerprints.has(entry.plan_fingerprint)) fail("Duplicate plan fingerprint");
    fingerprints.add(entry.plan_fingerprint);
    const source = artifact.source_rows.find((row) => row.row_number === entry.row_number);
    const key = identityKey(source?.normalized_source_row || {});
    const reviewed = reviewedByIdentity.get(key);
    if (!reviewed || seenIdentities.has(key)) fail(`Unreviewed or duplicate artifact identity ${key}`);
    validatePlan(entry, source, reviewed, profile);
    seenIdentities.add(key);
  }
  if (
    seenIdentities.size !== profile.planCount ||
    !sameNumbers([...seenIdentities].map((key) => reviewedByIdentity.get(key)?.review_row), profile.reviewRows) ||
    canonicalJson([...fingerprints].sort()) !== canonicalJson([...profile.planFingerprints].sort())
  ) fail("Predators Gear artifact scope or reviewed fingerprint set is incomplete");
  if (!profile.selectableFingerprints.includes(options.planFingerprint)) {
    fail("Plan fingerprint is not selectable in this reviewed profile");
  }
  const selected = artifact.plans.filter((entry) => entry.plan_fingerprint === options.planFingerprint);
  if (selected.length !== 1) fail("Artifact must contain exactly one matching plan");
  const source = artifact.source_rows.find((row) => row.row_number === selected[0].row_number);
  const reviewed = reviewedByIdentity.get(identityKey(source.normalized_source_row));
  return { loaded, entry: selected[0], source: source.normalized_source_row, reviewed, profile };
}

function loadCredential(file = APPROVER_CREDENTIAL_PATH) {
  if (!file || !fs.existsSync(file)) fail("Protected production approver credential not found");
  const values = {};
  for (const line of fs.readFileSync(file, "utf8").split(/\r?\n/)) {
    const match = line.match(/^([A-Z0-9_]+)=(.*)$/);
    if (match) values[match[1]] = match[2].trim().replace(/^(['"])(.*)\1$/, "$2");
  }
  const candidates = Object.entries(values).filter(([key, value]) => key.endsWith("_DATABASE_URL") && value);
  if (candidates.length !== 1) fail("Protected approver credential must contain exactly one database URL");
  const url = new URL(candidates[0][1]);
  url.searchParams.delete("sslmode");
  if (url.href.includes(STAGING_PROJECT_REF)) fail("Approver credential points to staging");
  return url.href;
}

function prepareApproval(options, dependencies = {}) {
  const profile = resolveReviewedProfile(options, dependencies.configuration?.profile);
  const manifest = dependencies.manifest || JSON.parse(fs.readFileSync(profile.manifestPath, "utf8"));
  const loaded = dependencies.loaded || loadDryRunArtifactEquivalent(options.artifact);
  const csvBytes = dependencies.csvBytes || fs.readFileSync(options.csv);
  return validateApprovalScope(options, loaded, manifest, csvBytes, {
    ...dependencies.configuration,
    profile,
  });
}

function verifyApprovalResult(result, prepared) {
  const entry = prepared.entry;
  const loaded = prepared.loaded;
  if (
    result?.status !== "approved" ||
    !/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(String(result.approval_id || "")) ||
    result.artifact_sha256 !== loaded.artifactSha256 ||
    result.run_id !== loaded.artifact.run_id ||
    result.plan_fingerprint !== entry.plan_fingerprint ||
    result.source_row_fingerprint !== entry.source_row_fingerprint ||
    (result.retailer_id ?? null) !== (entry.retailer_id ?? null) ||
    result.plan_kind !== entry.plan_kind ||
    !Number.isFinite(Date.parse(result.expires_at))
  ) fail("Approval result metadata does not match the reviewed artifact");
}

async function runApproval(options, dependencies = {}) {
  const prepared = prepareApproval(options, dependencies);
  const connectionString = dependencies.connectionString || loadCredential();
  const client = dependencies.client || new Client({
    connectionString,
    ssl: { rejectUnauthorized: false },
    application_name: "predators-gear-artifact-approver",
    options: "-c statement_timeout=120000",
  });
  let began = false;
  try {
    await client.connect();
    await client.query("begin");
    began = true;
    await client.query(
      "select set_config('app.retailer_catalogue_production_marker','1',true),set_config('app.retailer_catalogue_allow','1',true)"
    );
    await client.query(`set local role ${APPROVER_ROLE}`);
    const identity = (await client.query("select current_user,session_user")).rows[0];
    if (identity.current_user !== APPROVER_ROLE || identity.session_user !== APPROVER_LOGIN) {
      fail("Production approver identity mismatch");
    }
    const response = await client.query(
      "select public.approve_product_import_plan($1::jsonb,$2,$3,$4,now()+interval '15 minutes') result",
      [
        prepared.entry.resolved_plan,
        prepared.loaded.artifactSha256,
        prepared.loaded.artifact.run_id,
        prepared.profile.approvalReason,
      ]
    );
    const approval = response.rows[0]?.result;
    verifyApprovalResult(approval, prepared);
    await client.query("commit");
    began = false;
    const plan = prepared.entry.resolved_plan;
    return {
      approval_id: approval.approval_id,
      expires_at: approval.expires_at,
      plan_fingerprint: approval.plan_fingerprint,
      retailer: prepared.source.retailer_name,
      product_id: plan.product.id || null,
      product_variant_id: plan.product_variant.id || null,
      product_name: plan.product.values?.name || null,
      variant_name: plan.product_variant.values?.display_name || "Default",
      price: plan.offer.values.price,
      shipping_cost: plan.offer.values.shipping_cost,
      source_url: plan.offer.values.url,
      product_action: plan.product.action,
      variant_action: plan.product_variant.action,
      no_apply_was_run: true,
    };
  } catch (error) {
    if (began) await client.query("rollback").catch(() => {});
    throw error;
  } finally {
    await client.end().catch(() => {});
  }
}

if (require.main === module) {
  runApproval(parseArgs(process.argv.slice(2)))
    .then((result) => console.log(JSON.stringify(result, null, 2)))
    .catch((error) => {
      console.error(error.message);
      process.exitCode = 1;
    });
}

module.exports = {
  APPROVER_CREDENTIAL_PATH,
  APPROVER_ROLE,
  BATCH2_ARTIFACT_PATH,
  BATCH2_CSV_PATH,
  BATCH2_MANIFEST_PATH,
  CM3_MISSING_VARIANTS_ARTIFACT_PATH,
  CM3_MISSING_VARIANTS_CSV_PATH,
  CM3_MISSING_VARIANTS_MANIFEST_PATH,
  HELD4_MANIFEST_PATH,
  HELD_OLIMP_ARTIFACT_PATH,
  HELD_OLIMP_CSV_PATH,
  HELD_CM3_ARTIFACT_PATH,
  HELD_CM3_CSV_PATH,
  EXPECTED_ARTIFACT_PATH,
  EXPECTED_CSV_PATH,
  MANIFEST_PATH,
  NEW_PRODUCTS_V1_ARTIFACT_PATH,
  NEW_PRODUCTS_V1_CSV_PATH,
  NEW_PRODUCTS_V1_MANIFEST_PATH,
  REMAINING_ARTIFACT_PATH,
  REMAINING_CSV_PATH,
  SHADOWHEY3_ARTIFACT_PATH,
  SHADOWHEY3_CSV_PATH,
  SHADOWHEY3_MANIFEST_PATH,
  REVIEWED_PROFILES,
  loadCredential,
  loadDryRunArtifactEquivalent,
  parseArgs,
  planFingerprint,
  prepareApproval,
  runApproval,
  sha256,
  sourceRowFingerprint,
  validateApprovalScope,
};
