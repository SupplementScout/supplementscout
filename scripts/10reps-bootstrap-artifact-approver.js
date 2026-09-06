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
const REVIEW_REMAINING_14_BINDINGS = Object.freeze([
  [1, "8176", 861, 1295, "57d8643a59cdaf2034772ef012e1f1f0"],
  [2, "8177", 861, 1296, "cb56582f7909360ed6a2c58cf3c54b5c"],
  [3, "8178", 861, 1297, "1b209f0f6b289cda4876f920350cf5a2"],
  [4, "8179", 861, 1298, "147805f2bdc3d3d5df35a70e7062bde5"],
  [5, "8180", 861, 1299, "23b62fe50d7ade72c6b654502d71d982"],
  [6, "8182", 861, 1380, "b5e489f148a537efb137058f4846279e"],
  [7, "3958", 861, 1381, "ad76b68f081020b33bf9d6e18c5530aa"],
  [8, "4011", 90, 24, "feed4c48d7e27a4986b0b475a231e713"],
  [9, "10421", 1147, 3200, "4cef8597f2d2a84ae4ebdd79fdd00b6b"],
  [10, "10461", 790, 1094, "c76ae079cbc0c6ebbadcfd047251b41d"],
  [11, "10462", 790, 1095, "4c9b8ca231e3157e3d57b87d0ee4e010"],
  [12, "10464", 790, 1097, "bc3de98f8077b63ca0ffa2216c29899b"],
  [13, "10465", 790, 1098, "657668c50df7f589774cc91bc608e029"],
  [14, "10717", 507, 471, "c31f48ac7d75df2277184b8fc16beb13"],
].map(([reviewRow, externalVariantId, productId, productVariantId, fingerprint]) => Object.freeze({ reviewRow, externalVariantId, productId, productVariantId, fingerprint })));
const REVIEW_REMAINING_14_PROFILE = Object.freeze({
  id: "existing-variant-remaining-14",
  manifest: path.join(ROOT, "config/retailers/10reps-reviewed-bindings-v3-existing-variant-remaining-14.json"),
  manifestSha256: "369437420e9804b96c0ed595ef68be266da843430e3b285411f001013706ea70",
  manifestKind: "10reps-reviewed-existing-bindings-v3-existing-variant-remaining-14",
  manifestRowCount: 14,
  artifact: path.join(ROOT, "tmp/retailer-feeds/10reps/10reps-reviewed-bindings-v3-existing-variant-remaining-14-dry-run.json"),
  artifactSha256: "c63df97b5dfa0f8a53976a5326f31ebd46942e1c74e091bddefab9ab6dcd9be5",
  csv: path.join(ROOT, "tmp/retailer-feeds/10reps/10reps-reviewed-bindings-v3-existing-variant-remaining-14.csv"),
  csvSha256: "20913c9f01f3e4b71edc16ff534e02fe3ca6462a87d9201b61708b60ceef2cea",
  fingerprint: REVIEW_REMAINING_14_BINDINGS[0].fingerprint,
  allowedFingerprints: Object.freeze(REVIEW_REMAINING_14_BINDINGS.map(binding => binding.fingerprint)),
  bindings: REVIEW_REMAINING_14_BINDINGS,
  reviewedStart: 0,
  rowCount: 14,
  retailerAction: "existing",
  retailerId: "14",
  expectedInStock: null,
  sourceVariantIncludesPackCount: true,
  sourceOptionFlavourAliases: Object.freeze({ "8176": "Cookies and Cream" }),
  forbiddenExternalVariantIds: Object.freeze(["8166", "8167", "8168", "8169", "8170", "8173", "8174", "8175"]),
  approvalSource: "10reps-reviewed-existing-variant-remaining-14",
  applicationName: "10reps-existing-variant-remaining-14-artifact-approver",
  role: PROFILE.role,
  login: PROFILE.login,
  project: PROFILE.project,
  strictReviewedManifest: true,
});
const OWNER_ALIAS_19_BINDINGS = Object.freeze([
  [1, "8171", 861, 1290, "ff48d99c67e843f4d093034a43609ab1"],
  [2, "8172", 861, 1293, "e691e9a0d6ae27c4f73a38d0e3ad2ba2"],
  [3, "8181", 861, 1379, "b218bb5d20910371b5b479e1975ea5da"],
  [4, "8183", 861, 1382, "233597a14f92cd94b00941e20fd730f0"],
  [5, "7719", 788, 1079, "2084defe630cf6a632434673195c2587"],
  [6, "8009", 752, 871, "f1419d29821fb68ba1647cd2af431c5a"],
  [7, "8010", 752, 872, "88710026d4165a83520336c81c4b2393"],
  [8, "8038", 745, 2253, "ae918e5537ca5e6ae544ea82746b4a57"],
  [9, "8041", 745, 1269, "3d10db9cb5c3924adc3db93bb9609694"],
  [10, "8042", 745, 2255, "42ef05278a9b750e587fb9a0bf7d9923"],
  [11, "8484", 882, 1399, "d2792b3113dd1fa478c8be92f537c088"],
  [12, "8486", 882, 1398, "4200832431e602c6fc1077d90d7111f4"],
  [13, "8487", 882, 1404, "d9ea9dd7f6929b4b85e081df8ff97bda"],
  [14, "8488", 882, 1400, "0b01bf19938e17bce51d6490d49f9243"],
  [15, "8959", 743, 803, "b56180dee7dfd6471258fd6f9d61b1b3"],
  [16, "8961", 743, 805, "612f9e52f835d3ef5662df4b32b6c580"],
  [17, "8967", 743, 812, "8b0719531187d5c9f4cafe35e1bb9704"],
  [18, "8968", 743, 813, "1044239759f6546604d582d5192db62a"],
  [19, "10463", 790, 1096, "ade7be5c3868f7aa1a92b3b389af8581"],
].map(([reviewRow, externalVariantId, productId, productVariantId, fingerprint]) => Object.freeze({ reviewRow, externalVariantId, productId, productVariantId, fingerprint })));
const OWNER_ALIAS_19_PROFILE = Object.freeze({
  id: "owner-alias-19",
  manifest: path.join(ROOT, "config/retailers/10reps-reviewed-bindings-v4-owner-alias-22.json"),
  manifestSha256: "cec3ebe3af6b7ee7c1449226e7c9448c485c0707cd71225eb41b39aac22079ea",
  manifestKind: "10reps-reviewed-existing-bindings-v4-owner-alias-22",
  manifestRowCount: 19,
  expectedHeldRowCount: 3,
  heldExternalVariantIds: Object.freeze(["2779", "8034", "10310"]),
  artifact: path.join(ROOT, "tmp/retailer-feeds/10reps/10reps-reviewed-bindings-v4-owner-alias-19-dry-run.json"),
  artifactSha256: "6732cf515fc77352019460cf35646492a78b2790b51fb5deac47ee7567da3b02",
  csv: path.join(ROOT, "tmp/retailer-feeds/10reps/10reps-reviewed-bindings-v4-owner-alias-19.csv"),
  csvSha256: "24c70a8fbe896ae79e2045a5094af2e3bd729f83c78860707ed37ea8526824eb",
  fingerprint: OWNER_ALIAS_19_BINDINGS[0].fingerprint,
  allowedFingerprints: Object.freeze(OWNER_ALIAS_19_BINDINGS.map(binding => binding.fingerprint)),
  bindings: OWNER_ALIAS_19_BINDINGS,
  reviewedStart: 0,
  rowCount: 19,
  retailerAction: "existing",
  retailerId: "14",
  expectedInStock: null,
  sourceVariantIncludesPackCount: true,
  useCanonicalMappingFlavour: true,
  forbiddenExternalVariantIds: Object.freeze([
    "10003", "2779", "8034", "10310",
    ...REMAINING_BINDINGS.map(binding => binding.externalVariantId),
    ...EXACT_OOS_BINDINGS.map(binding => binding.externalVariantId),
    ...REVIEW_22_BINDINGS.map(binding => binding.externalVariantId),
  ]),
  approvalSource: "10reps-reviewed-owner-alias-19",
  applicationName: "10reps-owner-alias-19-artifact-approver",
  role: PROFILE.role,
  login: PROFILE.login,
  project: PROFILE.project,
  strictReviewedManifest: true,
});
const SPECIFIC_SERVINGS_3_BINDINGS = Object.freeze([
  [1, "2779", 726, 3018, "63e9a64a79e2ac3503814a2c37bff3e4"],
  [2, "8034", 798, 2793, "e815b9b7c2c995ffed46dc3d66f04133"],
  [3, "10310", 796, 2882, "ca5bb49d87ef2edb3fef6a00cc69396a"],
].map(([reviewRow, externalVariantId, productId, productVariantId, fingerprint]) => Object.freeze({ reviewRow, externalVariantId, productId, productVariantId, fingerprint })));
const SPECIFIC_SERVINGS_3_PROFILE = Object.freeze({
  id: "specific-servings-3",
  manifest: path.join(ROOT, "config/retailers/10reps-reviewed-bindings-v5-specific-servings-3.json"),
  manifestSha256: "845be56e0c20c836ea801d373185dacb64dace1c929a71dd726bf2309ae4a92a",
  manifestKind: "10reps-reviewed-existing-bindings-v5-specific-servings-3",
  manifestRowCount: 3,
  artifact: path.join(ROOT, "tmp/retailer-feeds/10reps/10reps-reviewed-bindings-v5-specific-servings-3-dry-run.json"),
  artifactSha256: "c189934ef5366139bc2a11ee11ba2c9058d3165decead4875e8b93f2f1bfeadf",
  csv: path.join(ROOT, "tmp/retailer-feeds/10reps/10reps-reviewed-bindings-v5-specific-servings-3.csv"),
  csvSha256: "151014a0c84ea43770edb053c5fb4ba08c03f41366fbd552d66c194db41bf82c",
  fingerprint: SPECIFIC_SERVINGS_3_BINDINGS[0].fingerprint,
  allowedFingerprints: Object.freeze(SPECIFIC_SERVINGS_3_BINDINGS.map(binding => binding.fingerprint)),
  bindings: SPECIFIC_SERVINGS_3_BINDINGS,
  reviewedStart: 0,
  rowCount: 3,
  retailerAction: "existing",
  retailerId: "14",
  expectedInStock: null,
  sourceVariantIncludesPackCount: true,
  useReviewedMappingOptions: true,
  forbiddenExternalVariantIds: Object.freeze([
    "10003",
    ...REMAINING_BINDINGS.map(binding => binding.externalVariantId),
    ...EXACT_OOS_BINDINGS.map(binding => binding.externalVariantId),
    ...REVIEW_22_BINDINGS.map(binding => binding.externalVariantId),
    ...OWNER_ALIAS_19_BINDINGS.map(binding => binding.externalVariantId),
  ]),
  approvalSource: "10reps-reviewed-specific-servings-3",
  applicationName: "10reps-specific-servings-3-artifact-approver",
  role: PROFILE.role,
  login: PROFILE.login,
  project: PROFILE.project,
  strictReviewedManifest: true,
});
const EXISTING_PRODUCTS_14_BINDINGS = Object.freeze([
  [1, "10447", 861, null, "87186ecb98c7d750025bc019faa06421"],
  [2, "7717", 788, null, "ec894c657f2405602f0922d15764a841"],
  [3, "8039", 745, null, "245aa36e62097c86776583fc899a4345"],
  [4, "8044", 745, null, "e3acbac94cabb66743539cc514a543b7"],
  [5, "8639", 837, null, "e7e573bf175f35d8bf16c29f804b8eed"],
  [6, "8958", 743, 801, "8ac8dfe9073f7f253d849dbab72258e4"],
  [7, "8960", 743, 804, "82f32ff732895e83771d8eafcbc791ca"],
  [8, "9573", 338, null, "09b8b2166ed4e02777df980834e2ca8b"],
  [9, "10741", 1103, 2393, "790a31fc2d69bdcc2b8c89250af96857"],
  [10, "11276", 424, null, "fd6f0a4cd8e9a5fe758a56b8fccfcf90"],
  [11, "11277", 424, null, "006fd346f8e11d617b1592a1e3476304"],
  [12, "11278", 424, null, "88730c14aa4c725ee2a63fdcc7a3cc1d"],
  [13, "11279", 424, null, "6c3fcdae8934017c4aa3053de87c2a57"],
  [14, "11280", 424, null, "e001f45e7a2fc6d1f17e9246e93804b5"],
].map(([reviewRow, externalVariantId, productId, productVariantId, fingerprint]) => Object.freeze({ reviewRow, externalVariantId, productId, productVariantId, fingerprint })));
const EXISTING_PRODUCTS_14_PROFILE = Object.freeze({
  id: "existing-products-14",
  manifest: path.join(ROOT, "config/retailers/10reps-reviewed-bindings-v6-existing-products-14.json"),
  manifestSha256: "239bbfda9721af1a921aeb992f8705ae0c5aa3a3460dc206ef6ee82523ce6051",
  manifestKind: "10reps-reviewed-existing-products-new-variants-v6",
  manifestRowCount: 14,
  artifact: path.join(ROOT, "tmp/retailer-feeds/10reps/10reps-next-14-owner-review-dry-run.json"),
  artifactSha256: "ff6b4fe7606a4a6dcccd29f7ebf225fc6347a8a4047faea871e00c560f7a7cff",
  csv: path.join(ROOT, "tmp/retailer-feeds/10reps/10reps-next-14-owner-review.csv"),
  csvSha256: "191fbb11b8a4575bd1a2f3c4c7abb7ae409401266100c3ec2be555677a27d8b7",
  fingerprint: EXISTING_PRODUCTS_14_BINDINGS[0].fingerprint,
  allowedFingerprints: Object.freeze(EXISTING_PRODUCTS_14_BINDINGS.map(binding => binding.fingerprint)),
  bindings: EXISTING_PRODUCTS_14_BINDINGS,
  reviewedStart: 0,
  rowCount: 14,
  retailerAction: "existing",
  retailerId: "14",
  expectedInStock: null,
  sourceVariantIncludesPackCount: true,
  useReviewedMappingOptions: true,
  useCanonicalMappingFlavour: true,
  allowsReviewedVariantCreation: true,
  existingVariantCount: 3,
  variantCreateCount: 11,
  approvalSource: "10reps-reviewed-existing-products-14",
  applicationName: "10reps-existing-products-14-artifact-approver",
  role: PROFILE.role,
  login: PROFILE.login,
  project: PROFILE.project,
  strictReviewedManifest: true,
});
const HIGH_CONFIDENCE_25_BINDINGS = Object.freeze([
  [1, "7874", 17, 714, "cb37829eab69823bf143ccbc8e2e72a9"],
  [2, "7875", 17, 715, "cb02fb2adeab331407e23de31add5745"],
  [3, "7876", 17, 717, "8858f39e3ad989eebb018a1e7287f8f4"],
  [4, "1382", 17, 716, "c12d975f81af4524e36fcb58f5a53891"],
  [5, "1383", 17, null, "7cfc5e8783a64f7bca6bd90762a70de2"],
  [6, "10109", 506, null, "cd77877839a7ced1607fa3910ed4e62a"],
  [7, "7415", 506, 2525, "9599f966b4cf9cf83904241f470dc69d"],
  [8, "1700", 506, 2526, "042d999723c9baae8f32e8fd9c4d5581"],
  [9, "3375", 506, 1798, "29019549a89fe4ae0331133d2da39ae7"],
  [10, "8616", 749, 852, "a86cae8a4efda8b41ff34ca4b2c54856"],
  [11, "8617", 749, 847, "224e566239c75ab2122e664821c02a8c"],
  [12, "8618", 749, 848, "d1a804e7faa5c99ad6ab758c5a79f460"],
  [13, "8619", 749, 849, "ee88f4fdd17d60ba2be0f4f679000e03"],
  [14, "8620", 749, 853, "2228717e9078eb6603d6a424bf873446"],
  [15, "8621", 749, 851, "b15500b46cfbadc986f19dd0c6650a02"],
  [16, "8622", 749, 854, "302a6fa8f4fe4973588bb60117bb882f"],
  [17, "8623", 749, 855, "cce12bcf4e9f915b7eb212c8207a675d"],
  [18, "8624", 749, 856, "c3c37a1997b4684c9fb9d92189c91c97"],
  [19, "8625", 749, 857, "4e4441fcd03722f6cefd978d10ffc08e"],
  [20, "8626", 749, 858, "2ecaae1659fd8079a11b5c60ca4d12c9"],
  [21, "10315", 843, 1222, "369f2102e3cd37396b6a118f9ed687e0"],
  [22, "10316", 843, 1223, "7f7ed3febec1cdfef4ce565d3dfb3b19"],
  [23, "10317", 843, 2770, "0f900aaa96b2c3c63fbb8cc0d7c0b8a3"],
  [24, "10318", 843, null, "4938cd00fba133630dbe3d08ec0b005f"],
  [25, "10319", 843, 1224, "4f5e5a59f52f6e353f11f23876d0823e"],
].map(([reviewRow, externalVariantId, productId, productVariantId, fingerprint]) => Object.freeze({ reviewRow, externalVariantId, productId, productVariantId, fingerprint })));
const HIGH_CONFIDENCE_25_PROFILE = Object.freeze({
  id: "high-confidence-25",
  manifest: path.join(ROOT, "config/retailers/10reps-reviewed-bindings-v7-high-confidence-25.json"),
  manifestSha256: "8661c94f1f24f2246de64388ae26490cc570bcdda62826e25427eb36dca5345e",
  manifestKind: "10reps-reviewed-high-confidence-existing-products-v7",
  manifestRowCount: 25,
  artifact: path.join(ROOT, "tmp/retailer-feeds/10reps/10reps-reviewed-bindings-v7-high-confidence-25-dry-run.json"),
  artifactSha256: "7cea41c00f6878dca6fc61a15d21666e450014296341322261122a6a981b4abb",
  csv: path.join(ROOT, "tmp/retailer-feeds/10reps/10reps-reviewed-bindings-v7-high-confidence-25.csv"),
  csvSha256: "d74735a009dfb7dd1ebcf5ed7faf1db8d7788609f3ee6a44be7e91634b1394b0",
  fingerprint: HIGH_CONFIDENCE_25_BINDINGS[0].fingerprint,
  allowedFingerprints: Object.freeze(HIGH_CONFIDENCE_25_BINDINGS.map(binding => binding.fingerprint)),
  bindings: HIGH_CONFIDENCE_25_BINDINGS,
  reviewedStart: 0,
  rowCount: 25,
  retailerAction: "existing",
  retailerId: "14",
  expectedInStock: null,
  sourceVariantIncludesPackCount: true,
  useReviewedMappingOptions: true,
  useCanonicalMappingFlavour: true,
  allowsReviewedVariantCreation: true,
  existingVariantCount: 22,
  variantCreateCount: 3,
  compactDeliveredPrice: true,
  approvalSource: "10reps-reviewed-high-confidence-25",
  applicationName: "10reps-high-confidence-25-artifact-approver",
  role: PROFILE.role,
  login: PROFILE.login,
  project: PROFILE.project,
  strictReviewedManifest: true,
});
const NEW_PRODUCTS_V8_BOOTSTRAP_BINDINGS = Object.freeze([
  [1, "3840", "22e233e0a9f70c340bfdc5cd8f080f91"],
  [9, "8099", "d418b29ebd69a2c18ae95fcf683bb060"],
  [17, "559", "e7910a0681fff189c7809519d25ae673"],
  [22, "582", "960b153093ab0f9e7a5f1c87861fc604"],
].map(([reviewRow, externalVariantId, fingerprint]) => Object.freeze({ reviewRow, externalVariantId, fingerprint })));
const NEW_PRODUCTS_V8_BOOTSTRAP_PROFILE = Object.freeze({
  id: "new-products-v8-bootstrap-4",
  manifest: path.join(ROOT, "config/retailers/10reps-reviewed-new-products-v8.json"),
  manifestSha256: "1e1a1c3f5f40a2d78662bdaf8c9bf97db7dfec025926dde82b6ab6bc69993be1",
  manifestKind: "10reps-reviewed-new-products-v8",
  manifestRowCount: 22,
  artifact: path.join(ROOT, "tmp/retailer-feeds/10reps/10reps-reviewed-new-products-v8-bootstrap-4-dry-run.json"),
  artifactSha256: "a5c575586e01067e0596da71d23b75f5a50ad785e477a7aad49a0440ff840442",
  csv: path.join(ROOT, "tmp/retailer-feeds/10reps/10reps-reviewed-new-products-v8-bootstrap-4.csv"),
  csvSha256: "9b03a0bc0773b5de70857aab8035fef0ada0a70d8f46e8a8785928d0afd55284",
  fingerprint: NEW_PRODUCTS_V8_BOOTSTRAP_BINDINGS[0].fingerprint,
  allowedFingerprints: Object.freeze(NEW_PRODUCTS_V8_BOOTSTRAP_BINDINGS.map(binding => binding.fingerprint)),
  bindings: NEW_PRODUCTS_V8_BOOTSTRAP_BINDINGS,
  rowCount: 4,
  retailerAction: "existing",
  retailerId: "14",
  approvalSource: "10reps-reviewed-new-products-v8-bootstrap-4",
  applicationName: "10reps-new-products-v8-bootstrap-approver",
  role: PROFILE.role,
  login: PROFILE.login,
  project: PROFILE.project,
  allowsReviewedProductCreation: true,
  manifestProfileKey: "bootstrap_profile",
  safeDefaultVariantEvidence: false,
});
const NEW_PRODUCTS_V8_TIME4_PROFILE = Object.freeze({
  id: "new-products-v8-time4-remaining-1",
  manifest: path.join(ROOT, "config/retailers/10reps-reviewed-new-products-v8.json"),
  manifestSha256: "1e1a1c3f5f40a2d78662bdaf8c9bf97db7dfec025926dde82b6ab6bc69993be1",
  manifestKind: "10reps-reviewed-new-products-v8",
  manifestRowCount: 22,
  artifact: path.join(ROOT, "tmp/retailer-feeds/10reps/10reps-reviewed-new-products-v8-time4-remaining-1-dry-run.json"),
  artifactSha256: "bcd141d34ceece338f9e67cb11357597ee2bbf8c9418b7a1db8fe8a773fba832",
  csv: path.join(ROOT, "tmp/retailer-feeds/10reps/10reps-reviewed-new-products-v8-time4-remaining-1.csv"),
  csvSha256: "45ebeafaa283d6d14a83714c7df1af5ddb5a0a5151828239daf033a14725d73a",
  fingerprint: "7d30f3ec258c3e51034f217857d935ae",
  allowedFingerprints: Object.freeze(["7d30f3ec258c3e51034f217857d935ae"]),
  bindings: Object.freeze([Object.freeze({ reviewRow: 22, externalVariantId: "582", fingerprint: "7d30f3ec258c3e51034f217857d935ae" })]),
  rowCount: 1,
  retailerAction: "existing",
  retailerId: "14",
  approvalSource: "10reps-reviewed-new-products-v8-time4-remaining-1",
  applicationName: "10reps-new-products-v8-time4-approver",
  role: PROFILE.role,
  login: PROFILE.login,
  project: PROFILE.project,
  allowsReviewedProductCreation: true,
  manifestProfileKey: "time4_remaining_profile",
  safeDefaultVariantEvidence: true,
});
const PROFILES = Object.freeze([PROFILE, REMAINING_PROFILE, EXACT_OOS_PROFILE, REVIEW_22_PROFILE, REVIEW_REMAINING_14_PROFILE, OWNER_ALIAS_19_PROFILE, SPECIFIC_SERVINGS_3_PROFILE, EXISTING_PRODUCTS_14_PROFILE, HIGH_CONFIDENCE_25_PROFILE, NEW_PRODUCTS_V8_BOOTSTRAP_PROFILE, NEW_PRODUCTS_V8_TIME4_PROFILE]);
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
function reviewedSourceOptions(profile, reviewed) {
  if (reviewed.is_default_variant === true) return {};
  if (profile.useReviewedMappingOptions) return reviewed.mapping_options;
  const flavour = profile.useCanonicalMappingFlavour
    ? reviewed.canonical_mapping_flavour
    : profile.sourceOptionFlavourAliases?.[reviewed.external_variant_id] || reviewed.flavour;
  return { Flavour: flavour, Size: reviewed.source_size };
}
function validatePlan(entry, reviewed, source, profile = PROFILE) {
  const plan = entry.resolved_plan;
  same(plan.product, { action: "existing", id: String(reviewed.product_id) }, "existing product");
  same(plan.expected_state.product.id, String(reviewed.product_id), "product before-state");
  same(plan.expected_state.product.name, reviewed.canonical_product, "canonical name");
  same(plan.expected_state.product.is_active, true, "active product");
  same(plan.expected_state.product.merged_into_product_id, null, "unmerged product");
  if (reviewed.canonical_product_format !== undefined) same(plan.expected_state.product.product_format, reviewed.canonical_product_format, "canonical product format");
  const createsVariant = profile.allowsReviewedVariantCreation && reviewed.variant_action === "create_variant";
  if (createsVariant) {
    same(reviewed.product_variant_id, null, "new variant reviewed ID");
    same(plan.product_variant.action, "create_variant", "reviewed variant creation action");
    const expectedVariant = {
      display_name: reviewed.canonical_variant,
      flavour_code: reviewed.canonical_flavour_code,
      flavour_label: reviewed.canonical_flavour,
      pack_count: reviewed.pack_count == null ? null : String(reviewed.pack_count),
      product_format: reviewed.product_format,
      size_unit: reviewed.size_unit,
      size_value: reviewed.size == null ? null : String(reviewed.size),
      variant_key: reviewed.canonical_variant_key,
    };
    same(plan.product_variant.values, expectedVariant, "reviewed variant values");
    same(plan.product_variant.evidence, {
      approved_mapping_id: null,
      external_options: reviewed.mapping_options,
      flavour: reviewed.canonical_flavour_code,
      pack_count: reviewed.pack_count == null ? null : String(reviewed.pack_count),
      product_format: reviewed.product_format,
      size_unit: reviewed.size_unit,
      size_value: reviewed.size == null ? null : String(reviewed.size),
    }, "reviewed variant evidence");
    same(plan.expected_state.product_variant, null, "new variant absent before-state");
  } else {
    same(reviewed.variant_action === undefined ? "existing" : reviewed.variant_action, "existing", "reviewed existing variant action");
    same(plan.product_variant.action, "existing", "existing variant action");
    same(plan.product_variant.id, String(reviewed.product_variant_id), "existing variant ID");
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
  }
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
  for (const [key, value] of Object.entries({ external_product_id: reviewed.external_product_id, external_variant_id: reviewed.external_variant_id, product_variant_id: createsVariant ? null : String(reviewed.product_variant_id), external_sku: reviewed.external_sku, external_gtin: reviewed.external_gtin, external_url: reviewed.source_url, external_name: reviewed.external_name })) same(mapping[key], value, `mapping ${key}`);
  same(mapping.external_options, reviewedSourceOptions(profile, reviewed), "source options");
  if (createsVariant) {
    const identity = plan.retailer_product.identity_contract;
    same(identity.version, "1", "identity contract version");
    same(identity.approved_url_peers.length, 1, "reviewed identity peer count");
    same(identity.approved_url_peers[0], identity.incoming, "reviewed identity peer");
    same(identity.incoming, {
      canonical_variant: plan.product_variant.values,
      external_gtin: reviewed.external_gtin,
      external_options: reviewed.mapping_options,
      external_product_id: reviewed.external_product_id,
      external_sku: reviewed.external_sku,
      external_url: reviewed.source_url,
      external_variant_id: reviewed.external_variant_id,
      legacy: false,
      product_id: String(reviewed.product_id),
      product_variant_id: null,
      retailer_id: profile.retailerId,
    }, "reviewed incoming identity");
    same(identity.peer_set_fingerprint, reviewed.identity_peer_set_fingerprint, "reviewed identity peer fingerprint");
  }
  same(plan.offer.action, "create", "offer action");
  same(plan.offer.values.price, reviewed.price.toFixed(2), "effective price");
  same(plan.offer.values.shipping_cost, "3.99", "shipping");
  same(Number(plan.offer.values.total_price), (Math.round(reviewed.price * 100) + 399) / 100, "delivered price");
  same(plan.offer.values.url, reviewed.source_url, "offer URL");
  const expectedInStock = profile.expectedInStock === null ? reviewed.in_stock : profile.expectedInStock;
  same(plan.offer.values.in_stock, expectedInStock, `${profile.id} stock`);
  same(plan.price_history, { action: "create" }, "initial history");
  same(plan.approval, { approved: false, approval_type: "none" }, "unapproved plan");
  const sourceFlavour = profile.useCanonicalMappingFlavour
    ? reviewed.canonical_mapping_flavour || ""
    : reviewed.flavour || "";
  for (const [key, value] of Object.entries({ product_id: String(reviewed.product_id), product_variant_id: createsVariant ? "" : String(reviewed.product_variant_id), external_product_id: reviewed.external_product_id, external_variant_id: reviewed.external_variant_id, product_name: reviewed.external_name, brand: reviewed.brand, category: reviewed.category, flavour: sourceFlavour, size: reviewed.size == null ? "" : `${reviewed.size} ${reviewed.size_unit}`, size_unit: reviewed.size_unit || "", image: reviewed.image_url, external_url: reviewed.source_url, affiliate_url: reviewed.source_url, external_sku: reviewed.external_sku || "", external_gtin: reviewed.external_gtin || "", shipping_known: "true", shipping_cost: "3.99", price: reviewed.price.toFixed(2), in_stock: String(expectedInStock), is_for_sale: "true" })) same(source[key], value, `source ${key}`);
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
function validateNewProductsV8Plan(entry, reviewed, source, profile) {
  const plan = entry.resolved_plan;
  same(plan.expected_state, {
    offer: null,
    product: null,
    product_variant: null,
    retailer: { id: "14", name: "10 Reps", slug: "10-reps", website: "https://www.10reps.co.uk/" },
    retailer_product: null,
  }, "new-product empty before-state");
  same(plan.retailer, { action: "existing", id: "14" }, "existing retailer");
  const reviewedVariant = reviewed.action === "create_reviewed_product_variant";
  same(plan.product.action, reviewedVariant ? "create_or_reuse_reviewed" : "create", "new product action");
  for (const [key, value] of Object.entries({
    name: reviewed.product_name,
    slug: reviewed.slug,
    brand: reviewed.brand,
    category: reviewed.category,
    image: reviewed.image,
    gtin: null,
    product_format: reviewed.product_format,
    price: reviewed.price.toFixed(2),
    nutrition_verified: false,
    unit_pricing_verified: false,
  })) same(plan.product.values[key], value, `new product ${key}`);
  if (reviewedVariant) {
    same(plan.product_variant.action, "create_reviewed_variant", "reviewed bootstrap variant action");
    same(plan.product_variant.values, {
      display_name: reviewed.variant_name,
      flavour_code: reviewed.flavour.toLowerCase(),
      flavour_label: reviewed.flavour,
      pack_count: "1",
      product_format: reviewed.product_format,
      size_unit: reviewed.size_unit,
      size_value: String(reviewed.size),
      variant_key: plan.product_variant.values.variant_key,
    }, "reviewed bootstrap variant values");
    same(plan.product_variant.evidence, {
      approved_mapping_id: null,
      external_options: reviewed.external_options,
      flavour: reviewed.flavour.toLowerCase(),
      pack_count: "1",
      product_format: reviewed.product_format,
      size_unit: reviewed.size_unit,
      size_value: String(reviewed.size),
    }, "reviewed bootstrap variant evidence");
    requireCondition(/^[a-z0-9-]+$/.test(plan.product_variant.values.variant_key), "Invalid reviewed bootstrap variant key");
  } else {
    same(plan.product_variant.action, "create_default", "default bootstrap variant action");
    same(plan.product_variant.evidence, {
      approved_mapping_id: null,
      external_options: profile.safeDefaultVariantEvidence ? {} : reviewed.external_options,
      flavour: null,
      pack_count: "1",
      product_format: reviewed.product_format,
      size_unit: profile.safeDefaultVariantEvidence ? null : reviewed.size_unit,
      size_value: profile.safeDefaultVariantEvidence ? null : String(reviewed.size),
    }, "default bootstrap variant evidence");
  }
  same(plan.retailer_product.action, "create", "new-product mapping action");
  same(plan.retailer_product.values, {
    external_gtin: null,
    external_name: reviewed.product_name,
    external_options: profile.safeDefaultVariantEvidence ? {} : reviewed.external_options,
    external_product_id: reviewed.external_product_id,
    external_sku: reviewed.external_sku,
    external_slug: reviewed.slug,
    external_url: reviewed.source_url,
    external_variant_id: reviewed.external_variant_id,
    match_confidence: "90",
    match_method: "slug",
    product_variant_id: null,
  }, "new-product mapping");
  same(plan.offer.action, "create", "new-product offer action");
  same(plan.offer.values.price, reviewed.price.toFixed(2), "new-product price");
  same(plan.offer.values.shipping_cost, "3.99", "new-product shipping");
  same(Number(plan.offer.values.total_price), reviewed.delivered_price, "new-product delivered price");
  same(plan.offer.values.in_stock, true, "new-product stock");
  same(plan.offer.values.url, reviewed.source_url, "new-product offer URL");
  same(plan.price_history, { action: "create" }, "new-product initial history");
  same(plan.approval.approved, true, "internal safe-create approval");
  same(plan.approval.approval_type, reviewedVariant ? "reviewed_parent_variant_safe_create" : "safe_create", "internal approval type");
  same(plan.approval.approved_category, reviewed.category, "internal approved category");
  same(plan.approval.canonical_name, reviewed.product_name, "internal canonical name");
  same(plan.approval.has_variant_evidence, reviewedVariant, "internal variant evidence");
  same(plan.approval.source_row_fingerprint, entry.source_row_fingerprint, "internal source binding");
  for (const [key, value] of Object.entries({
    product_id: "",
    product_variant_id: "",
    external_product_id: reviewed.external_product_id,
    external_variant_id: reviewed.external_variant_id,
    external_sku: reviewed.external_sku || "",
    external_gtin: "",
    product_name: reviewed.product_name,
    variant_name: reviewed.variant_name || "",
    brand: reviewed.brand,
    category: reviewed.category,
    flavour: reviewed.flavour || "",
    size: `${reviewed.size} ${reviewed.size_unit}`,
    size_unit: reviewed.size_unit,
    image: reviewed.image,
    external_url: reviewed.source_url,
    affiliate_url: reviewed.source_url,
    price: reviewed.price.toFixed(2),
    shipping_known: "true",
    shipping_cost: "3.99",
    in_stock: "true",
    is_for_sale: "true",
  })) same(source[key], value, `new-product source ${key}`);
  same(entry.operation_type, "standard_import", "new-product operation");
  same(entry.plan_kind, "feed", "new-product plan kind");
  same(entry.retailer_id, "14", "new-product retailer ID");
  same(entry.source_row_fingerprint, sourceFingerprint(source), "new-product source fingerprint");
  same(plan.meta.source_row_fingerprint, entry.source_row_fingerprint, "new-product source metadata");
  same(entry.plan_fingerprint, planFingerprint(plan), "new-product plan integrity");
  same(plan.meta.plan_fingerprint, entry.plan_fingerprint, "new-product plan metadata");
  const binding = profile.bindings.find(candidate => candidate.reviewRow === reviewed.review_row);
  requireCondition(binding, "Missing new-product reviewed binding");
  same(binding.externalVariantId, reviewed.external_variant_id, "new-product binding source");
  same(entry.plan_fingerprint, binding.fingerprint, "new-product reviewed fingerprint");
}
function validateNewProductsV8Package(manifest, artifact, csvRows, profile, selectedFingerprint) {
  same(manifest.kind, profile.manifestKind, "new-product manifest kind");
  same(manifest.row_count, 22, "new-product manifest rows");
  same(manifest.product_count, 4, "new-product manifest products");
  same(manifest.rows.length, 22, "new-product reviewed rows");
  same(manifest.held_rows, [], "new-product held rows");
  same(manifest.retailer, { id: 14, name: "10 Reps", slug: "10-reps", website: "https://www.10reps.co.uk/", expected_action: "existing", shipping_known: true, shipping_cost: 3.99 }, "new-product retailer manifest");
  for (const [key, value] of Object.entries({
    reviewed_rows_only: true,
    existing_retailer_only: true,
    allow_product_creation: true,
    allowed_product_creations: 4,
    allow_variant_creation: true,
    allowed_variant_creations: 22,
    allow_canonical_product_updates: false,
    allow_canonical_variant_updates: false,
    allow_canonical_gtin_updates: false,
    allow_category_changes: false,
    sku_is_not_gtin: true,
    external_gtin_count: 0,
    one_plan_at_a_time: true,
    fresh_single_use_approval_per_plan: true,
    strict_production_readback_after_each_apply: true,
  })) same(manifest.policy[key], value, `new-product policy ${key}`);
  const manifestProfile = manifest[profile.manifestProfileKey];
  requireCondition(manifestProfile, "Missing new-product manifest profile");
  same(manifestProfile.path, path.relative(ROOT, profile.csv).replaceAll("\\", "/"), "new-product CSV path");
  same(manifestProfile.sha256, profile.csvSha256, "new-product CSV manifest SHA");
  same(manifestProfile.row_count, profile.rowCount, "new-product manifest profile rows");
  same(manifestProfile.external_variant_ids, profile.bindings.map(binding => binding.externalVariantId), "new-product manifest sources");
  same(manifestProfile.artifact_path, path.relative(ROOT, profile.artifact).replaceAll("\\", "/"), "new-product artifact path");
  same(manifestProfile.artifact_sha256, profile.artifactSha256, "new-product artifact manifest SHA");
  same(manifestProfile.plan_fingerprints, profile.allowedFingerprints, "new-product manifest fingerprints");
  same(manifestProfile.status, "DRY_RUN_PASS", "new-product manifest status");
  same(manifestProfile.blocked_row_count, 0, "new-product blockers");
  same(manifestProfile.conflict_count, 0, "new-product conflicts");
  same(artifact.artifact_version, "1", "artifact version");
  same(artifact.row_count, String(profile.rowCount), "new-product artifact rows");
  same(artifact.summary, { blocked_row_count: "0", plan_count: String(profile.rowCount), skipped_row_count: "0" }, "new-product artifact summary");
  same(artifact.blocked_rows, [], "new-product artifact blockers");
  same(artifact.source_file_sha256, profile.csvSha256, "new-product artifact CSV digest");
  same(artifact.plans.length, profile.rowCount, "new-product plan count");
  same(artifact.source_rows.length, profile.rowCount, "new-product source count");
  same(csvRows.length, profile.rowCount, "new-product CSV count");
  same([...new Set(artifact.plans.map(entry => entry.plan_fingerprint))], profile.allowedFingerprints, "new-product exact fingerprints");
  const reviewedRows = profile.bindings.map(binding => {
    const reviewed = manifest.rows.find(row => row.review_row === binding.reviewRow);
    requireCondition(reviewed && reviewed.external_variant_id === binding.externalVariantId, "Missing exact reviewed new-product row");
    return reviewed;
  });
  for (let index = 0; index < reviewedRows.length; index++) {
    const reviewed = reviewedRows[index];
    const entry = artifact.plans.find(candidate => candidate.row_number === String(index + 2));
    const source = artifact.source_rows.find(candidate => candidate.row_number === String(index + 2));
    requireCondition(entry && source, "Missing new-product plan/source row");
    same(source.status, "planned", "new-product source disposition");
    same(source.source_row_fingerprint, entry.source_row_fingerprint, "new-product source binding");
    same(source.plan_fingerprint, entry.plan_fingerprint, "new-product plan binding");
    const normalized = {
      ...csvRows[index],
      variant: [csvRows[index].variant_name, csvRows[index].pack_count ? `pack of ${csvRows[index].pack_count}` : ""].filter(Boolean).join(" "),
      size: [csvRows[index].size, csvRows[index].size_unit].filter(Boolean).join(" "),
    };
    const artifactCsvSource = { ...source.normalized_source_row };
    delete artifactCsvSource.__reviewed_10reps_new_product_identity;
    same(normalized, artifactCsvSource, "new-product CSV to artifact source");
    validateNewProductsV8Plan(entry, reviewed, source.normalized_source_row, profile);
  }
  requireCondition(profile.allowedFingerprints.includes(selectedFingerprint), "Invalid new-products-v8 fingerprint");
  const entry = artifact.plans.find(candidate => candidate.plan_fingerprint === selectedFingerprint);
  requireCondition(entry, "Missing exact new-products-v8 plan");
  return { entry, artifact, profile };
}
function validatePackage(manifest, artifact, csvRows, profile = PROFILE, selectedFingerprint = profile.fingerprint) {
  if (profile.allowsReviewedProductCreation) {
    return validateNewProductsV8Package(manifest, artifact, csvRows, profile, selectedFingerprint);
  }
  same(manifest.kind, profile.manifestKind, "manifest kind");
  same(manifest.row_count, profile.manifestRowCount, "manifest row count");
  same(manifest.rows.length, profile.manifestRowCount, "reviewed rows");
  same(manifest.held_rows.length, profile.expectedHeldRowCount || 0, "held row count");
  if (!profile.expectedHeldRowCount) same(manifest.held_rows, [], "held rows");
  if (profile.heldExternalVariantIds) {
    same(manifest.held_rows.map(row => row.external_variant_id).sort(), [...profile.heldExternalVariantIds].sort(), "held source variants");
    requireCondition(manifest.held_rows.every(row => row.reason === "PRODUCTION_GUARD_REJECTS_DEFAULT_WHILE_ACTIVE_SPECIFIC_VARIANTS_EXIST"), "Invalid held-row reason");
  }
  for (const flag of ["existing_products_only", "sku_is_not_gtin"]) same(manifest.policy[flag], true, flag);
  if (profile.allowsReviewedVariantCreation) {
    same(manifest.policy.existing_variants_only, false, "existing variants only");
    same(manifest.policy.allow_variant_creation, true, "reviewed variant creation");
  } else {
    same(manifest.policy.existing_variants_only, true, "existing variants only");
    same(manifest.policy.allow_variant_creation, false, "variant creation disabled");
  }
  for (const flag of ["allow_product_creation", "allow_canonical_gtin_updates", "allow_category_changes", "allow_live_import"]) same(manifest.policy[flag], false, flag);
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
  if (profile.sourceOptionFlavourAliases) {
    for (const [externalVariantId, canonical] of Object.entries(profile.sourceOptionFlavourAliases)) {
      const reviewed = manifest.rows.find(row => row.external_variant_id === externalVariantId);
      requireCondition(reviewed, `Missing reviewed flavour alias ${externalVariantId}`);
      same(manifest.owner_resolutions.flavour_aliases?.[externalVariantId], {
        source: reviewed.flavour,
        canonical,
        resolution: "OWNER_CONFIRMED_EQUIVALENT_PRODUCT_VARIANT",
      }, "reviewed flavour alias");
      same(reviewed.canonical_mapping_flavour, canonical, "canonical mapping flavour");
      same(reviewed.flavour_resolution, "OWNER_CONFIRMED_PUNCTUATION_ALIAS", "flavour alias resolution");
    }
  }
  if (profile.useCanonicalMappingFlavour) {
    for (const reviewed of manifest.rows) {
      if (reviewed.is_default_variant === true) {
        same(reviewed.canonical_mapping_flavour, null, "default mapping flavour");
        continue;
      }
      same(reviewed.canonical_mapping_flavour, reviewed.canonical_flavour, "canonical mapping flavour");
      if (reviewed.flavour === reviewed.canonical_flavour) {
        same(reviewed.flavour_resolution, "EXACT", "exact flavour resolution");
      } else {
        same(reviewed.flavour_resolution, "OWNER_CONFIRMED_EQUIVALENT_ALIAS", "owner flavour resolution");
        same(manifest.owner_resolutions.flavour_aliases?.[reviewed.external_variant_id], {
          source: reviewed.flavour,
          canonical: reviewed.canonical_flavour,
          resolution: "OWNER_CONFIRMED_EQUIVALENT_PRODUCT_VARIANT",
        }, "reviewed flavour alias");
      }
    }
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
  if (profile.allowsReviewedVariantCreation) {
    const existingRows = reviewedRows.filter(row => row.variant_action === "existing");
    const createRows = reviewedRows.filter(row => row.variant_action === "create_variant");
    same(existingRows.length, profile.existingVariantCount, "reviewed existing variant count");
    same(createRows.length, profile.variantCreateCount, "reviewed variant create count");
    requireCondition(existingRows.every(row => row.product_variant_id != null), "Existing reviewed variants require IDs");
    requireCondition(createRows.every(row => row.product_variant_id == null), "New reviewed variants cannot have IDs");
    same(new Set(existingRows.map(row => row.product_variant_id)).size, profile.existingVariantCount, "unique existing target variants");
    same(new Set(reviewedRows.map(row => `${row.product_id}:${row.canonical_variant_key}`)).size, profile.rowCount, "unique reviewed variant identities");
    same(manifest.expected_actions.product_variants_create, profile.variantCreateCount, "manifest variant create count");
  } else {
    same(new Set(reviewedRows.map(r => r.product_variant_id)).size, profile.rowCount, "unique target variants");
  }
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
    if (profile.forbiddenExternalVariantIds) {
      requireCondition(!artifact.plans.some(candidate => profile.forbiddenExternalVariantIds.includes(candidate.resolved_plan.retailer_product.values.external_variant_id)), `Already-applied source is forbidden in ${profile.id}`);
    }
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
    return { approval_id: receipt.approval_id, expires_at: receipt.expires_at, plan_fingerprint: entry.plan_fingerprint, product_id: entry.resolved_plan.product.id == null ? null : Number(entry.resolved_plan.product.id), product_variant_id: entry.resolved_plan.product_variant.id == null ? null : Number(entry.resolved_plan.product_variant.id), external_variant_id: entry.resolved_plan.retailer_product.values.external_variant_id, retailer_id: profile.retailerId === null ? null : Number(profile.retailerId), approval_only: true };
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
module.exports = { PROFILE, REMAINING_PROFILE, EXACT_OOS_PROFILE, REVIEW_22_PROFILE, REVIEW_REMAINING_14_PROFILE, OWNER_ALIAS_19_PROFILE, SPECIFIC_SERVINGS_3_PROFILE, EXISTING_PRODUCTS_14_PROFILE, HIGH_CONFIDENCE_25_PROFILE, NEW_PRODUCTS_V8_BOOTSTRAP_PROFILE, NEW_PRODUCTS_V8_TIME4_PROFILE, CREDENTIAL_PATH, parseArgs, prepareApproval, validatePackage, validatePlan, validateNewProductsV8Plan, parseCredential, planFingerprint, sourceFingerprint, checkDigest, verifyApprovalResult, approveWithClient };
