const fs = require("node:fs");
const path = require("node:path");
const crypto = require("node:crypto");
const { parse } = require("csv-parse/sync");
const { assertConfig, evaluateItem, DEFAULT_POLICY, getApplicationToken } = require("./lib/ebay-browse-pilot");
const { boundedSourceFetch } = require("./lib/bounded-source-fetch");
const { loadDryRunArtifact, runImportRows, writeDryRunArtifact } = require("./import-products");
const { executePlan } = require("./ebay-offer-canary-executor");
const { buildVerifiedNoChangeDryRun } = require("./verified-no-change-offer-refresh");
const {
  approvedFromEnv,
  bindSemanticEvidence,
  buildSemanticPlanRows,
  buildSemanticSourceRows,
  loadAndVerifyContract,
  verifyFreshReport,
  writeDryRunContract,
} = require("./lib/ebay-artifact-bound-contract");

const ROOT = path.resolve(__dirname, "..");
const OUT = path.join(ROOT, "tmp", "ebay-offer-refresh");
const ROLLOUT_DIR = path.join(ROOT, "docs", "rollouts", "ebay-offer-canary");
const CONFIRMATION = "OWNER_APPROVED_EBAY_REFRESH";
const KIND = "ebay-existing-offer-refresh-exact-237-v1";
const PROJECT_REF = "aftboxmrdgyhizicfsfu";
const PENDING_BATCH = path.join(OUT, "pending-batch.json");
const EXACT_GTIN_METADATA_GAPS = new Set(["FORMAT_UNPROVEN", "SIZE_UNPROVEN", "UNIT_COUNT_UNPROVEN"]);
const REVIEWED_MISSING_GTIN_CONTINUITY = new Map([
  ["2559", { seller: "muscle-factory-co-uk", review_reasons: new Set(["FORMAT_UNPROVEN", "RETURNED_GTIN_UNPROVEN"]) }],
  ["2560", { seller: "snober_trade_ltd", review_reasons: new Set(["RETURNED_GTIN_UNPROVEN", "SIZE_UNPROVEN"]) }],
  ["2561", { seller: "icebergsupplements", review_reasons: new Set(["RETURNED_GTIN_UNPROVEN", "SIZE_UNPROVEN"]) }],
  ["2562", { seller: "icebergsupplements", review_reasons: new Set(["RETURNED_GTIN_UNPROVEN", "SIZE_UNPROVEN"]) }],
  ["2563", { seller: "muscle-factory-co-uk", review_reasons: new Set(["FORMAT_UNPROVEN", "RETURNED_GTIN_UNPROVEN", "SIZE_UNPROVEN"]) }],
  ["2564", { seller: "gorilla_muscle", review_reasons: new Set(["RETURNED_GTIN_UNPROVEN"]) }],
  ["2565", { seller: "dcelectricsltd", review_reasons: new Set(["RETURNED_GTIN_UNPROVEN"]) }],
  ["2566", { seller: "ccolta", review_reasons: new Set(["FLAVOUR_UNPROVEN", "RETURNED_GTIN_UNPROVEN", "UNIT_COUNT_UNPROVEN"]) }],
  ["2567", { seller: "ccolta", review_reasons: new Set(["FLAVOUR_UNPROVEN", "FORMAT_UNPROVEN", "RETURNED_GTIN_UNPROVEN", "UNIT_COUNT_UNPROVEN"]) }],
  ["2568", { seller: "trainingfuels", review_reasons: new Set(["FLAVOUR_UNPROVEN", "RETURNED_GTIN_UNPROVEN", "UNIT_COUNT_UNPROVEN"]) }],
  ["2569", { seller: "healthyessentialsuk", review_reasons: new Set(["FLAVOUR_UNPROVEN", "FORMAT_UNPROVEN", "RETURNED_GTIN_UNPROVEN", "UNIT_COUNT_UNPROVEN"]) }],
  ["2581", { seller: "time4nutrition", review_reasons: new Set(["RETURNED_GTIN_UNPROVEN"]) }],
  ["2610", { seller: "trainingfuels", review_reasons: new Set(["RETURNED_GTIN_UNPROVEN"]) }],
  ["2611", { seller: "mpbioscence", review_reasons: new Set(["RETURNED_GTIN_UNPROVEN"]) }],
  ["2612", { seller: "planszowki", review_reasons: new Set(["FORMAT_UNPROVEN", "RETURNED_GTIN_UNPROVEN"]) }],
  ["2613", { seller: "welzohealth", review_reasons: new Set(["FORMAT_UNPROVEN", "RETURNED_GTIN_UNPROVEN"]) }],
  ["2614", { seller: "muscle-factory-co-uk", review_reasons: new Set(["FORMAT_UNPROVEN", "RETURNED_GTIN_UNPROVEN"]) }],
  ["2615", { seller: "dcelectricsltd", review_reasons: new Set(["RETURNED_GTIN_UNPROVEN"]) }],
  ["2616", { seller: "welzohealth", review_reasons: new Set(["RETURNED_GTIN_UNPROVEN", "SIZE_UNPROVEN"]) }],
  ["2617", { seller: "the_sup_store", review_reasons: new Set(["RETURNED_GTIN_UNPROVEN", "SIZE_UNPROVEN"]) }],
  ["2618", { seller: "muscle-factory-co-uk", review_reasons: new Set(["RETURNED_GTIN_UNPROVEN"]) }],
  ["2621", { seller: "trainingfuels", review_reasons: new Set(["FLAVOUR_UNPROVEN", "RETURNED_GTIN_UNPROVEN"]) }],
  ["2634", { seller: "planszowki", review_reasons: new Set(["FORMAT_UNPROVEN", "RETURNED_GTIN_UNPROVEN"]) }],
  ["2642", { seller: "bosky1967", review_reasons: new Set(["RETURNED_GTIN_UNPROVEN"]) }],
  ["2643", { seller: "aatavi97", review_reasons: new Set(["RETURNED_GTIN_UNPROVEN"]) }],
  ["2644", { seller: "welzohealth", review_reasons: new Set(["RETURNED_GTIN_UNPROVEN"]) }],
  ["2645", { seller: "ccolta", review_reasons: new Set(["RETURNED_GTIN_UNPROVEN"]) }],
  ["2646", { seller: "ccolta", review_reasons: new Set(["RETURNED_GTIN_UNPROVEN"]) }],
  ["2647", { seller: "ccolta", review_reasons: new Set(["RETURNED_GTIN_UNPROVEN"]) }],
  ["2648", { seller: "ccolta", review_reasons: new Set(["RETURNED_GTIN_UNPROVEN"]) }],
  ["2649", { seller: "bigvits", review_reasons: new Set(["RETURNED_GTIN_UNPROVEN"]) }],
  ["2650", { seller: "ccolta", review_reasons: new Set(["RETURNED_GTIN_UNPROVEN"]) }],
  ["2651", { seller: "ivitaminsshop", review_reasons: new Set(["FORMAT_UNPROVEN", "RETURNED_GTIN_UNPROVEN"]) }],
  ["2652", { seller: "welzohealth", review_reasons: new Set(["RETURNED_GTIN_UNPROVEN"]) }],
  ["2653", { seller: "ccolta", review_reasons: new Set(["FORMAT_UNPROVEN", "RETURNED_GTIN_UNPROVEN"]) }],
  ["2654", { seller: "welzohealth", review_reasons: new Set(["FORMAT_UNPROVEN", "RETURNED_GTIN_UNPROVEN"]) }],
  ["2655", { seller: "ccolta", review_reasons: new Set(["RETURNED_GTIN_UNPROVEN"]) }],
  ["2656", { seller: "ccolta", review_reasons: new Set(["RETURNED_GTIN_UNPROVEN"]) }],
  ["2657", { seller: "aatavi97", review_reasons: new Set(["RETURNED_GTIN_UNPROVEN"]) }],
  ["2658", { seller: "anabolic_dream", review_reasons: new Set(["RETURNED_GTIN_UNPROVEN"]) }],
  ["2659", { seller: "welzohealth", review_reasons: new Set(["FLAVOUR_UNPROVEN", "RETURNED_GTIN_UNPROVEN"]) }],
  ["2661", { seller: "trainingfuels", review_reasons: new Set(["RETURNED_GTIN_UNPROVEN"]) }],
  ["2662", { seller: "trainingfuels", review_reasons: new Set(["RETURNED_GTIN_UNPROVEN"]) }],
  ["2663", { seller: "trainingfuels", review_reasons: new Set(["RETURNED_GTIN_UNPROVEN"]) }],
  ["2664", { seller: "trainingfuels", review_reasons: new Set(["RETURNED_GTIN_UNPROVEN"]) }],
  ["2665", { seller: "dcelectricsltd", review_reasons: new Set(["RETURNED_GTIN_UNPROVEN"]) }],
  ["2666", { seller: "dcelectricsltd", review_reasons: new Set(["RETURNED_GTIN_UNPROVEN"]) }],
  ["2667", { seller: "protein_ni", review_reasons: new Set(["RETURNED_GTIN_UNPROVEN", "SIZE_UNPROVEN"]) }],
  ["2668", { seller: "mpbioscence", review_reasons: new Set(["RETURNED_GTIN_UNPROVEN"]) }],
  ["2674", { seller: "ukesupps-2008", review_reasons: new Set(["RETURNED_GTIN_UNPROVEN"]) }],
  ["2691", { seller: "food-grade-hydrogen-peroxide", review_reasons: new Set(["RETURNED_GTIN_UNPROVEN"]) }],
  ["2692", { seller: "ultimate_fitness_4u", review_reasons: new Set(["RETURNED_GTIN_UNPROVEN"]) }],
  ["2693", { seller: "mpbioscence", review_reasons: new Set(["RETURNED_GTIN_UNPROVEN"]) }],
  ["2694", { seller: "soovital", review_reasons: new Set(["FLAVOUR_UNPROVEN", "FORMAT_UNPROVEN", "RETURNED_GTIN_UNPROVEN"]) }],
  ["2695", { seller: "thesupplementstoreuk", review_reasons: new Set(["FORMAT_UNPROVEN", "RETURNED_GTIN_UNPROVEN"]) }],
  ["2696", { seller: "soovital", review_reasons: new Set(["FORMAT_UNPROVEN", "RETURNED_GTIN_UNPROVEN"]) }],
  ["2697", { seller: "muscle-factory-co-uk", review_reasons: new Set(["FORMAT_UNPROVEN", "RETURNED_GTIN_UNPROVEN"]) }],
  ["2698", { seller: "muscle-factory-co-uk", review_reasons: new Set(["FORMAT_UNPROVEN", "RETURNED_GTIN_UNPROVEN"]) }],
  ["2699", { seller: "muscle-factory-co-uk", review_reasons: new Set(["FORMAT_UNPROVEN", "RETURNED_GTIN_UNPROVEN"]) }],
  ["2705", { seller: "gymstop", review_reasons: new Set(["FORMAT_UNPROVEN", "RETURNED_GTIN_UNPROVEN", "SIZE_UNPROVEN"]) }],
  ["2707", { seller: "soovital", review_reasons: new Set(["RETURNED_GTIN_UNPROVEN"]) }],
  ["2709", { seller: "muscle-factory-co-uk", review_reasons: new Set(["FORMAT_UNPROVEN", "RETURNED_GTIN_UNPROVEN", "SIZE_UNPROVEN"]) }],
  ["2716", { seller: "1thetreehouse", review_reasons: new Set(["RETURNED_GTIN_UNPROVEN"]) }],
  ["2717", { seller: "z.m.s.limited", review_reasons: new Set(["RETURNED_GTIN_UNPROVEN"]) }],
  ["2718", { seller: "ccolta", review_reasons: new Set(["RETURNED_GTIN_UNPROVEN"]) }],
  ["2719", { seller: "premium_supps", review_reasons: new Set(["RETURNED_GTIN_UNPROVEN"]) }],
  ["2720", { seller: "themadtitansupplements", blockers: new Set(["CANONICAL_GTIN_INVALID", "FLAVOUR_MISMATCH"]), review_reasons: new Set(["RETURNED_GTIN_UNPROVEN", "SIZE_UNPROVEN"]) }],
  ["2721", { seller: "protein_ni", blockers: new Set(["CANONICAL_GTIN_INVALID"]), review_reasons: new Set(["RETURNED_GTIN_UNPROVEN", "SIZE_UNPROVEN"]) }],
  ["2724", { seller: "planszowki", blockers: new Set(["CANONICAL_GTIN_INVALID"]), review_reasons: new Set(["FORMAT_UNPROVEN", "RETURNED_GTIN_UNPROVEN"]) }],
  ["2731", { seller: "fitgamerltd", returned_gtin: "5060245603423", blockers: new Set(["CANONICAL_GTIN_INVALID", "FLAVOUR_MISMATCH", "GTIN_MISMATCH"]), review_reasons: new Set() }],
  ["2732", { seller: "jersupplementsales", blockers: new Set(["CANONICAL_GTIN_INVALID", "FORMAT_MISMATCH"]), review_reasons: new Set(["RETURNED_GTIN_UNPROVEN"]) }],
  ["2733", { seller: "welzohealth", blockers: new Set(["CANONICAL_GTIN_INVALID"]), review_reasons: new Set(["FORMAT_UNPROVEN", "RETURNED_GTIN_UNPROVEN"]) }],
  ["2734", { seller: "ultimate_fitness_4u", blockers: new Set(["CANONICAL_GTIN_INVALID"]), review_reasons: new Set(["RETURNED_GTIN_UNPROVEN"]) }],
  ["2736", { seller: "protein_ni", blockers: new Set(["CANONICAL_GTIN_INVALID"]), review_reasons: new Set(["RETURNED_GTIN_UNPROVEN", "SIZE_UNPROVEN"]) }],
  ["2737", { seller: "protein_ni", blockers: new Set(["CANONICAL_GTIN_INVALID"]), review_reasons: new Set(["RETURNED_GTIN_UNPROVEN", "SIZE_UNPROVEN"]) }],
  ["2738", { seller: "occastore_limited", blockers: new Set(["CANONICAL_GTIN_INVALID", "FORMAT_MISMATCH"]), review_reasons: new Set(["RETURNED_GTIN_UNPROVEN"]) }],
  ["2739", { seller: "startfitness-outlet", blockers: new Set(["CANONICAL_GTIN_INVALID", "FORMAT_MISMATCH"]), review_reasons: new Set(["RETURNED_GTIN_UNPROVEN", "SIZE_UNPROVEN", "UNIT_COUNT_UNPROVEN"]) }],
  ["2741", { seller: "the_sup_store", blockers: new Set(["CANONICAL_GTIN_INVALID"]), review_reasons: new Set(["RETURNED_GTIN_UNPROVEN", "SIZE_UNPROVEN"]) }],
  ["2742", { seller: "beastbody", returned_gtin: "810028291942", blockers: new Set(["CANONICAL_GTIN_INVALID", "GTIN_MISMATCH", "SIZE_MISMATCH"]), review_reasons: new Set() }],
  ["2743", { seller: "zambargain.house", blockers: new Set(["CANONICAL_GTIN_INVALID", "FORMAT_MISMATCH"]), review_reasons: new Set(["RETURNED_GTIN_UNPROVEN"]) }],
  ["2747", { seller: "6packsupplementsuk", blockers: new Set(["CANONICAL_GTIN_INVALID"]), review_reasons: new Set(["RETURNED_GTIN_UNPROVEN", "SELLER_SCORE_BELOW_PROPOSED_THRESHOLD"]) }],
  ["2749", { seller: "nutrafituk", returned_gtin: "5902114010133", blockers: new Set(["CANONICAL_GTIN_INVALID", "FLAVOUR_MISMATCH", "GTIN_MISMATCH"]), review_reasons: new Set() }],
  ["2750", { seller: "muscle-factory-co-uk", blockers: new Set(["CANONICAL_GTIN_INVALID"]), review_reasons: new Set(["FORMAT_UNPROVEN", "RETURNED_GTIN_UNPROVEN"]) }],
  ["2752", { seller: "ultimate_fitness_4u", returned_gtin: "5056555205402", blockers: new Set(["CANONICAL_GTIN_INVALID", "GTIN_MISMATCH", "UNIT_COUNT_MISMATCH"]), review_reasons: new Set() }],
  ["2753", { seller: "ultimate_fitness_4u", blockers: new Set(["CANONICAL_GTIN_INVALID", "FLAVOUR_MISMATCH", "FORMAT_MISMATCH"]), review_reasons: new Set(["RETURNED_GTIN_UNPROVEN"]) }],
  ["2754", { seller: "thesupplementstoreuk", blockers: new Set(["CANONICAL_GTIN_INVALID"]), review_reasons: new Set(["FLAVOUR_UNPROVEN", "RETURNED_GTIN_UNPROVEN"]) }],
  ["2756", { seller: "fitnesshealthltd", blockers: new Set(["CANONICAL_GTIN_INVALID", "FORMAT_MISMATCH"]), review_reasons: new Set(["RETURNED_GTIN_UNPROVEN"]) }],
]);
const REVIEWED_EXACT_GTIN_CONTINUITY = new Map([
  ["2570", { seller: "appliednutritionplc", blockers: new Set(["UNIT_COUNT_MISMATCH"]), review_reasons: new Set(["SIZE_UNPROVEN"]) }],
  ["2572", { seller: "appliednutritionplc", blockers: new Set(["UNIT_COUNT_MISMATCH"]), review_reasons: new Set(["SIZE_UNPROVEN"]) }],
  ["2573", { seller: "appliednutritionplc", blockers: new Set(["UNIT_COUNT_MISMATCH"]), review_reasons: new Set(["SIZE_UNPROVEN"]) }],
  ["2574", { seller: "appliednutritionplc", blockers: new Set(["UNIT_COUNT_MISMATCH"]), review_reasons: new Set() }],
  ["2575", { seller: "appliednutritionplc", blockers: new Set(["UNIT_COUNT_MISMATCH"]), review_reasons: new Set() }],
  ["2576", { seller: "appliednutritionplc", blockers: new Set(["UNIT_COUNT_MISMATCH"]), review_reasons: new Set() }],
  ["2578", { seller: "appliednutritionplc", blockers: new Set(["FLAVOUR_MISMATCH"]), review_reasons: new Set() }],
  ["2582", { seller: "time4nutrition", blockers: new Set(["UNIT_COUNT_MISMATCH"]), review_reasons: new Set() }],
  ["2583", { seller: "time4nutrition", blockers: new Set(["UNIT_COUNT_MISMATCH"]), review_reasons: new Set() }],
  ["2585", { seller: "time4nutrition", blockers: new Set(["UNIT_COUNT_MISMATCH"]), review_reasons: new Set() }],
  ["2587", { seller: "time4nutrition", blockers: new Set(["UNIT_COUNT_MISMATCH"]), review_reasons: new Set() }],
  ["2588", { seller: "time4nutrition", blockers: new Set(["SIZE_MISMATCH"]), review_reasons: new Set() }],
  ["2631", { seller: "appliednutritionplc", blockers: new Set(["UNIT_COUNT_MISMATCH"]), review_reasons: new Set() }],
  ["2632", { seller: "appliednutritionplc", blockers: new Set(["FLAVOUR_MISMATCH", "UNIT_COUNT_MISMATCH"]), review_reasons: new Set() }],
  ["2633", { seller: "appliednutritionplc", blockers: new Set(["UNIT_COUNT_MISMATCH"]), review_reasons: new Set() }],
  ["2637", { seller: "superfoodmarket", blockers: new Set(), review_reasons: new Set(["FORMAT_UNPROVEN", "SELLER_FEEDBACK_BELOW_PROPOSED_THRESHOLD"]) }],
  ["2638", { seller: "superfoodmarket", blockers: new Set(), review_reasons: new Set(["FORMAT_UNPROVEN", "SELLER_FEEDBACK_BELOW_PROPOSED_THRESHOLD"]) }],
  ["2640", { seller: "phd_ltd", blockers: new Set(["SIZE_MISMATCH", "UNIT_COUNT_MISMATCH"]), review_reasons: new Set() }],
  ["2680", { seller: "superfoodmarket", blockers: new Set(), review_reasons: new Set(["SELLER_FEEDBACK_BELOW_PROPOSED_THRESHOLD"]) }],
  ["2681", { seller: "superfoodmarket", blockers: new Set(), review_reasons: new Set(["FORMAT_UNPROVEN", "SELLER_FEEDBACK_BELOW_PROPOSED_THRESHOLD"]) }],
  ["2682", { seller: "ihrisironworks", blockers: new Set(), review_reasons: new Set(["SELLER_SCORE_BELOW_PROPOSED_THRESHOLD"]) }],
  ["2688", { seller: "vikingshopsuple", blockers: new Set(), review_reasons: new Set(["SELLER_FEEDBACK_BELOW_PROPOSED_THRESHOLD"]) }],
  ["2708", { seller: "superfoodmarket", blockers: new Set(), review_reasons: new Set(["FORMAT_UNPROVEN", "SELLER_FEEDBACK_BELOW_PROPOSED_THRESHOLD"]) }],
  ["2722", { seller: "powerbodyltd", blockers: new Set(["BRAND_MISMATCH"]), review_reasons: new Set() }],
  ["2723", { seller: "trainingfuels", blockers: new Set(["BRAND_MISMATCH"]), review_reasons: new Set() }],
  ["2725", { seller: "ultimate_fitness_4u", blockers: new Set(["SIZE_MISMATCH"]), review_reasons: new Set() }],
  ["2726", { seller: "powerbodyltd", blockers: new Set(["SIZE_MISMATCH"]), review_reasons: new Set() }],
  ["2730", { seller: "powerbodyltd", blockers: new Set(["BRAND_MISMATCH"]), review_reasons: new Set() }],
  ["2735", { seller: "myfit24ecom", blockers: new Set(["FORMAT_MISMATCH"]), review_reasons: new Set() }],
  ["2744", { seller: "powerbodyltd", blockers: new Set(["BRAND_MISMATCH"]), review_reasons: new Set() }],
  ["2745", { seller: "powerbodyltd", blockers: new Set(["BRAND_MISMATCH"]), review_reasons: new Set() }],
  ["2748", { seller: "ukesupps-2008", blockers: new Set(["BRAND_MISMATCH", "UNIT_COUNT_MISMATCH"]), review_reasons: new Set() }],
  ["2755", { seller: "icebergsupplements", blockers: new Set(["BRAND_MISMATCH", "FORMAT_MISMATCH"]), review_reasons: new Set(["FLAVOUR_UNPROVEN"]) }],
  ["2757", { seller: "powerbodyltd", blockers: new Set(["SIZE_MISMATCH"]), review_reasons: new Set() }],
]);
const ROLLOUTS = Object.freeze([
  { csv: "bootstrap.csv", approval: "rollout.json", count: 1 },
  { csv: "remaining-4.csv", approval: "remaining-4-rollout.json", count: 4 },
  { csv: "batch-b.csv", approval: "batch-b-rollout.json", count: 5 },
  { csv: "batch-c.csv", approval: "batch-c-rollout.json", count: 7 },
  { csv: "batch-d.csv", approval: "batch-d-rollout.json", count: 2 },
  { csv: "batch-e.csv", approval: "batch-e-rollout.json", count: 1 },
  { csv: "batch-f.csv", approval: "batch-f-rollout.json", count: 2 },
  { csv: "batch-g.csv", approval: "batch-g-rollout.json", count: 9 },
  { csv: "batch-h.csv", approval: "batch-h-rollout.json", count: 11 },
  { csv: "batch-i.csv", approval: "batch-i-rollout.json", count: 8 },
  { csv: "batch-j.csv", approval: "batch-j-rollout.json", count: 10 },
  { csv: "batch-k-recovery.csv", approval: "batch-k-recovery-rollout.json", fallbackApproval: "batch-k-rollout.json", count: 20 },
  { csv: "batch-l.csv", approval: "batch-l-rollout.json", count: 20 },
  { csv: "batch-m.csv", approval: "batch-m-rollout.json", count: 2 },
  { csv: "batch-n.csv", approval: "batch-n-rollout.json", count: 19 },
  { csv: "batch-o.csv", approval: "batch-o-rollout.json", count: 20 },
  { csv: "batch-p.csv", approval: "batch-p-rollout.json", count: 20 },
  { csv: "batch-q.csv", approval: "batch-q-rollout.json", count: 20 },
  { csv: "batch-r.csv", approval: "batch-r-rollout.json", count: 38 },
  { csv: "batch-s.csv", approval: "batch-s-rollout.json", count: 18 },
]);
const LIVE_IDENTITY_OVERRIDES = new Map([
  ["v1|256978504893|557601584732", ["2948", "2762"]], ["v1|198346682799|0", ["2949", "2763"]],
  ["v1|257053651805|557696446300", ["2950", "2764"]], ["v1|286049984782|588148986109", ["2951", "2765"]],
  ["v1|353439521141|0", ["2952", "2766"]], ["v1|178052718291|0", ["2953", "2767"]],
  ["v1|318546057510|0", ["2954", "2768"]], ["v1|146086688061|445043246478", ["2955", "2769"]],
  ["v1|187837047801|0", ["2956", "2770"]], ["v1|166550190737|466197712102", ["2957", "2771"]],
  ["v1|286709971349|0", ["2958", "2772"]], ["v1|377141158759|0", ["2959", "2773"]],
  ["v1|354869780698|0", ["2960", "2774"]], ["v1|373243202481|642139796536", ["2961", "2775"]],
  ["v1|287487748050|0", ["2944", "2758"]], ["v1|147450939094|0", ["2945", "2759"]],
  ["v1|227315409315|0", ["2946", "2760"]], ["v1|147458020827|0", ["2947", "2761"]],
  ["v1|394018039646|662564730389", ["2784", "2599"]], ["v1|256978504929|557601659147", ["2785", "2600"]],
  ["v1|145921318153|444963406170", ["2786", "2601"]], ["v1|143513790155|445757979940", ["2787", "2602"]],
  ["v1|177952936229|477482944161", ["2788", "2603"]], ["v1|404774853352|674791941889", ["2789", "2604"]],
  ["v1|326796105372|516023060149", ["2790", "2605"]], ["v1|267459060041|567236756567", ["2791", "2606"]],
  ["v1|227482554146|526660766785", ["2792", "2607"]], ["v1|227482554146|526660766784", ["2793", "2608"]],
  ["v1|267460401796|567238268029", ["2794", "2609"]], ["v1|323304007010|512368831135", ["2796", "2610"]],
  ["v1|354815561341|624134728917", ["2797", "2611"]], ["v1|167879148689|467421651918", ["2798", "2612"]],
  ["v1|227339481694|526541817001", ["2799", "2613"]], ["v1|407021140091|677211935189", ["2800", "2614"]],
  ["v1|236709473396|537300103237", ["2801", "2615"]], ["v1|227187131642|0", ["2802", "2616"]],
  ["v1|315768710740|614309055150", ["2803", "2617"]], ["v1|406431647826|676750282316", ["2804", "2618"]],
  ["v1|373707858011|642746534509", ["2805", "2619"]], ["v1|326796105372|515780120440", ["2806", "2620"]],
  ["v1|325388861371|0", ["2807", "2621"]], ["v1|325909654165|514958463842", ["2808", "2622"]],
  ["v1|325526875626|514560046967", ["2809", "2623"]], ["v1|327069519328|0", ["2810", "2624"]],
  ["v1|327060659620|0", ["2811", "2625"]], ["v1|327060632207|0", ["2812", "2626"]],
  ["v1|327062344315|0", ["2813", "2627"]], ["v1|326584491660|515650737150", ["2814", "2628"]],
  ["v1|326061693301|515517512434", ["2815", "2629"]], ["v1|326818790418|0", ["2816", "2630"]],
  ["v1|134686134724|434197535546", ["2817", "2631"]], ["v1|135911568600|435099858561", ["2818", "2632"]],
  ["v1|135911646988|0", ["2819", "2633"]], ["v1|167879148689|467421651923", ["2820", "2634"]],
  ["v1|406077315499|0", ["2821", "2635"]], ["v1|191651754387|0", ["2822", "2636"]],
  ["v1|317649341455|0", ["2823", "2637"]], ["v1|358007221826|0", ["2824", "2638"]],
  ["v1|403884115915|673770851190", ["2825", "2639"]], ["v1|386193771567|653735928444", ["2826", "2640"]],
  ["v1|373707858011|642746534514", ["2827", "2641"]], ["v1|298602193517|0", ["2828", "2642"]],
  ["v1|178337400684|477710042215", ["2829", "2643"]], ["v1|227339481459|0", ["2830", "2644"]],
  ["v1|388831629571|0", ["2831", "2645"]], ["v1|387049058279|0", ["2832", "2646"]],
  ["v1|386965889328|0", ["2833", "2647"]], ["v1|385435605679|0", ["2834", "2648"]],
  ["v1|355703763092|0", ["2835", "2649"]], ["v1|388955605779|0", ["2836", "2650"]],
  ["v1|134979307941|0", ["2837", "2651"]], ["v1|227221196528|0", ["2838", "2652"]],
  ["v1|389455624589|0", ["2839", "2653"]], ["v1|227315398173|0", ["2840", "2654"]],
  ["v1|389883997981|0", ["2841", "2655"]], ["v1|387996845027|0", ["2842", "2656"]],
  ["v1|178337337530|477710015241", ["2843", "2657"]], ["v1|286736755888|588764980609", ["2844", "2658"]],
  ["v1|227339481966|526541813994", ["2845", "2659"]],
  ["v1|323304007010|515705810399", ["2846", "2660"]], ["v1|323304007010|515706626595", ["2847", "2661"]],
  ["v1|323304007010|512439794894", ["2848", "2662"]], ["v1|323304007010|512439794895", ["2849", "2663"]],
  ["v1|323304007010|512439794893", ["2850", "2664"]], ["v1|237003103152|537411952150", ["2851", "2665"]],
  ["v1|237003103152|537411952155", ["2852", "2666"]], ["v1|198228877102|497356872935", ["2853", "2667"]],
  ["v1|354815561341|624134728913", ["2854", "2668"]], ["v1|165609827880|0", ["2855", "2669"]],
  ["v1|373707858011|642746534510", ["2856", "2670"]], ["v1|373707858011|642746534516", ["2857", "2671"]],
  ["v1|373707858011|642746534513", ["2858", "2672"]], ["v1|142287167642|444141486013", ["2859", "2673"]],
  ["v1|353106005670|626781129585", ["2860", "2674"]], ["v1|176694625249|0", ["2861", "2675"]],
  ["v1|133790164936|433235981819", ["2862", "2676"]], ["v1|133790164936|433235981820", ["2863", "2677"]],
  ["v1|326796105372|515787262466", ["2864", "2678"]], ["v1|326796105372|515787262467", ["2865", "2679"]],
  ["v1|188822153425|0", ["2866", "2680"]], ["v1|317649344086|0", ["2867", "2681"]],
  ["v1|406895062062|677104093499", ["2868", "2682"]], ["v1|137252056707|435559918149", ["2869", "2683"]],
  ["v1|137252056707|435559918150", ["2870", "2684"]], ["v1|137252056707|435559918154", ["2871", "2685"]],
  ["v1|406431647826|676750282319", ["2872", "2686"]], ["v1|267461430373|567539198324", ["2873", "2687"]],
  ["v1|355909580184|0", ["2874", "2688"]], ["v1|233673267094|533567926335", ["2875", "2689"]],
  ["v1|257109707764|0", ["2876", "2690"]], ["v1|284943753378|0", ["2877", "2691"]],
  ["v1|143963592379|445427699751", ["2878", "2692"]], ["v1|354815726458|624134926919", ["2879", "2693"]],
  ["v1|185926599465|694997267454", ["2880", "2694"]], ["v1|256983420098|557970957862", ["2881", "2695"]],
  ["v1|185926599465|694997267455", ["2882", "2696"]], ["v1|407021140091|677211935190", ["2883", "2697"]],
  ["v1|407021140091|677211935191", ["2884", "2698"]], ["v1|407021140091|677211935192", ["2885", "2699"]],
  ["v1|398263424505|666530542921", ["2886", "2700"]], ["v1|327261939687|516049468284", ["2887", "2701"]],
  ["v1|204492290001|505081430817", ["2888", "2702"]], ["v1|176656268247|0", ["2889", "2703"]],
  ["v1|388240705551|0", ["2890", "2704"]], ["v1|278003127980|2560859598066", ["2891", "2705"]],
  ["v1|177555839706|0", ["2892", "2706"]], ["v1|187768437029|0", ["2893", "2707"]],
  ["v1|187833104047|0", ["2894", "2708"]], ["v1|406431648421|677122188671", ["2895", "2709"]],
  ["v1|114229917998|414483567665", ["2896", "2710"]], ["v1|114025559750|414309386736", ["2897", "2711"]],
  ["v1|318096238181|0", ["2898", "2712"]], ["v1|377244586186|0", ["2899", "2713"]],
  ["v1|276358420222|0", ["2900", "2714"]], ["v1|398059958397|0", ["2901", "2715"]],
  ["v1|397974125581|0", ["2902", "2716"]], ["v1|297974730806|0", ["2903", "2717"]],
  ["v1|387640181610|0", ["2904", "2718"]], ["v1|155926124418|0", ["2905", "2719"]],
  ["v1|406396487824|676718471799", ["2906", "2720"]], ["v1|198228877102|497356872937", ["2907", "2721"]],
  ["v1|147306765663|445732030633", ["2908", "2722"]], ["v1|325991814548|515421410637", ["2909", "2723"]],
  ["v1|167879148689|467421651920", ["2910", "2724"]], ["v1|134591032739|434103081092", ["2911", "2725"]],
  ["v1|135253043475|434696910530", ["2912", "2726"]], ["v1|327060618170|0", ["2913", "2727"]],
  ["v1|227132642275|0", ["2914", "2728"]], ["v1|176728986438|0", ["2915", "2729"]],
  ["v1|145912801501|444959160336", ["2916", "2730"]], ["v1|800319414198|657404220498", ["2917", "2731"]],
  ["v1|336035176429|545582222745", ["2918", "2732"]], ["v1|227482522680|526660650424", ["2919", "2733"]],
  ["v1|132815030478|432119091530", ["2920", "2734"]], ["v1|297783388039|595073149727", ["2921", "2735"]],
  ["v1|198315032211|497400846557", ["2922", "2736"]], ["v1|198315034246|497400845270", ["2923", "2737"]],
  ["v1|157949041527|459285588036", ["2924", "2738"]], ["v1|376399851938|645034081397", ["2925", "2739"]],
  ["v1|394019431788|662565823099", ["2926", "2740"]], ["v1|316166161203|614844035757", ["2927", "2741"]],
  ["v1|234899416364|534748630032", ["2928", "2742"]], ["v1|286812035548|589268195266", ["2929", "2743"]],
  ["v1|135164731160|434814771499", ["2930", "2744"]], ["v1|145913175539|444959128709", ["2931", "2745"]],
  ["v1|163375678688|462680657033", ["2932", "2746"]], ["v1|404858427882|0", ["2933", "2747"]],
  ["v1|354343324643|623744168324", ["2934", "2748"]], ["v1|137239727747|435555053157", ["2935", "2749"]],
  ["v1|406431647826|676750282318", ["2936", "2750"]], ["v1|326796105372|515780120438", ["2937", "2751"]],
  ["v1|146722603644|0", ["2938", "2752"]], ["v1|133391840181|0", ["2939", "2753"]],
  ["v1|256904088070|557459693860", ["2940", "2754"]], ["v1|235526727416|0", ["2941", "2755"]],
  ["v1|267647291151|0", ["2942", "2756"]], ["v1|147032518200|445550089805", ["2943", "2757"]],
]);
const OWNER_REVIEWED_CANONICAL_VARIANT_OVERRIDES = new Map([
  ["2581", Object.freeze({ product_variant_id: "2920", variant_name: "405g", size_value: "405", size_unit: "g", pack_count: "1" })],
]);

function fail(message) { throw new Error(message); }
function sha256(value) { return crypto.createHash("sha256").update(value).digest("hex"); }
function reviewedCsvHashMatches(bytes, expected) {
  if (sha256(bytes) === expected) return true;
  const text = bytes.toString("utf8");
  return text.includes("\r\n") && sha256(Buffer.from(text.replace(/\r\n/g, "\n"), "utf8")) === expected;
}

function loadScopes() {
  const rows = [];
  for (const source of ROLLOUTS) {
    const csvPath = path.join(ROLLOUT_DIR, source.csv);
    const approval = JSON.parse(fs.readFileSync(path.join(ROLLOUT_DIR, source.approval), "utf8"));
    const fallbackApproval = source.fallbackApproval ? JSON.parse(fs.readFileSync(path.join(ROLLOUT_DIR, source.fallbackApproval), "utf8")) : null;
    const bytes = fs.readFileSync(csvPath);
    if (approval.approved !== true || approval.target_project_ref !== PROJECT_REF || !reviewedCsvHashMatches(bytes, approval.csv_sha256)) fail(`Reviewed rollout integrity mismatch: ${source.approval}`);
    const parsed = parse(bytes, { columns: true, skip_empty_lines: true, bom: true });
    if (parsed.length !== source.count) fail(`Reviewed rollout count mismatch: ${source.csv}`);
    if (fallbackApproval && (fallbackApproval.approved !== true || fallbackApproval.target_project_ref !== PROJECT_REF)) fail(`Reviewed fallback rollout integrity mismatch: ${source.fallbackApproval}`);
    const approvedEntries = approval.entries || [approval.scope];
    const fallbackEntries = fallbackApproval?.entries || [];
    for (let index = 0; index < parsed.length; index += 1) {
      const row = parsed[index], approved = approvedEntries.find((entry) => entry.external_variant_id === row.external_variant_id) || fallbackEntries.find((entry) => entry.external_variant_id === row.external_variant_id);
      if (!approved) fail(`Reviewed rollout entry missing: ${source.csv} row ${index + 2}`);
      const rowGtin = String(row.external_gtin || "").trim() || null;
      const approvedGtinValue = Object.prototype.hasOwnProperty.call(approved, "gtin") ? approved.gtin : approved.expected_returned_gtin;
      const approvedGtin = approvedGtinValue == null ? null : String(approvedGtinValue);
      const options = row.external_options ? JSON.parse(row.external_options) : {};
      const unitMatch = String(options["Unit count"] || "").match(/(\d+)\s*(capsules?|caps?|tablets?|softgels?|servings?)/i);
      const approvedExternalProductId = Object.prototype.hasOwnProperty.call(approved, "external_product_id") ? approved.external_product_id : approved.legacy_item_id;
      if (String(row.product_id) !== String(approved.product_id) || String(row.product_variant_id) !== String(approved.product_variant_id) || rowGtin !== approvedGtin || row.external_product_id !== approvedExternalProductId || row.external_variant_id !== approved.external_variant_id) fail(`Reviewed rollout row identity mismatch: ${source.csv} row ${index + 2}`);
      rows.push({
        ...row,
        flavour_label: row.flavour || null,
        size_value: approved.size_value ?? String(row.size || "").match(/\d+(?:\.\d+)?/)?.[0] ?? null,
        size_unit: approved.size_unit ?? row.size_unit ?? null,
        pack_count: approved.pack_count ?? row.pack_count ?? "1",
        unit_count: approved.unit_count ?? unitMatch?.[1] ?? null,
        unit_type: approved.unit_type ?? (unitMatch ? "capsule" : null),
        product_format: approved.product_format ?? row.product_format ?? null,
        rollout: source.approval,
      });
    }
  }
  if (rows.length !== 237) fail("Exact eBay refresh manifest must contain 237 rows");
  const unique = (key) => new Set(rows.map((row) => row[key])).size === rows.length;
  if (!["product_variant_id", "external_variant_id"].every(unique)) fail("Exact eBay refresh manifest contains duplicate identities");
  return Object.freeze(rows.map((row, index) => {
    const live = LIVE_IDENTITY_OVERRIDES.get(row.external_variant_id) || [String(2724 + index), String(2539 + index)];
    const offerId = live[1];
    const reviewedVariant = OWNER_REVIEWED_CANONICAL_VARIANT_OVERRIDES.get(offerId) || {};
    return Object.freeze({ ...row, ...reviewedVariant, gtin: row.external_gtin, retailer_id: "12", retailer_product_id: live[0], offer_id: offerId });
  }));
}

const SCOPES = loadScopes();
const SCOPE = SCOPES.find((scope) => scope.offer_id === "2558");
function pendingArtifact(scope) { return path.join(OUT, `pending-${scope.offer_id}.json`); }

function partitionSourceFailures(unsafeRows) {
  const sourceFailures = unsafeRows.filter((row) => row.source_error === "SOURCE_READ_FAILED");
  const explicitlyIsolated = sourceFailures.filter((row) => row.source_failure_scope === "ROW");
  const unclassified = sourceFailures.filter((row) => !row.source_failure_scope);
  const globalBlocked = sourceFailures.filter((row) => row.source_failure_scope === "GLOBAL");
  if (unclassified.length > 1) globalBlocked.push(...unclassified);
  else explicitlyIsolated.push(...unclassified);
  return {
    globalBlocked,
    sourceFailureReview: explicitlyIsolated.map((row) => ({ ...row, review_type: "SOURCE_FAILURE" })),
  };
}

function writePendingBatch(report, now) {
  if (report.blocked_row_count !== 0) fail("Global eBay refresh blockers prevent apply preparation");
  const manifest = {
    schema_version: 2,
    kind: KIND,
    created_at: now.toISOString(),
    offer_ids: SCOPES.map((scope) => scope.offer_id),
    executable_offer_ids: report.execution_offer_ids,
    review_rows: report.review_rows,
    blocked_rows: report.blocked_rows,
    commit_sha: report.commit_sha,
    source_fingerprint: report.source_fingerprint,
    full_capture_fingerprint: report.full_capture_fingerprint,
    executable_source_fingerprint: report.executable_source_fingerprint,
    review_scope_fingerprint: report.review_scope_fingerprint,
    approved_full_capture_fingerprint: report.approved_full_capture_fingerprint || report.full_capture_fingerprint,
    approved_review_scope_fingerprint: report.approved_review_scope_fingerprint || report.review_scope_fingerprint,
    fresh_full_capture_fingerprint: report.fresh_full_capture_fingerprint || report.full_capture_fingerprint,
    fresh_review_scope_fingerprint: report.fresh_review_scope_fingerprint || report.review_scope_fingerprint,
    source_row_fingerprints: report.source_row_fingerprints,
    plan_row_fingerprints: report.plan_row_fingerprints,
    plan_fingerprint: report.plan_fingerprint,
  };
  const bytes = Buffer.from(`${JSON.stringify(manifest, null, 2)}\n`);
  const manifestSha256 = sha256(bytes);
  fs.writeFileSync(PENDING_BATCH, bytes, { flag: "wx" });
  fs.writeFileSync(`${PENDING_BATCH}.sha256`, `${manifestSha256}\n`, { flag: "wx" });
  return { manifest, manifestSha256 };
}

function loadPendingBatch(now = new Date()) {
  const bytes = fs.readFileSync(PENDING_BATCH);
  const expectedHash = fs.readFileSync(`${PENDING_BATCH}.sha256`, "utf8").trim();
  if (sha256(bytes) !== expectedHash) fail("Pending eBay refresh batch SHA-256 mismatch");
  const manifest = JSON.parse(bytes.toString("utf8"));
  const ageMs = now.getTime() - new Date(manifest.created_at).getTime();
  const executable = new Set(manifest.executable_offer_ids || []);
  const review = new Set((manifest.review_rows || []).map((row) => String(row.offer_id)));
  const blocked = new Set((manifest.blocked_rows || []).map((row) => String(row.offer_id)));
  const sourceFingerprintIds = new Set((manifest.source_row_fingerprints || []).map((row) => String(row.offer_id)));
  const planFingerprintIds = new Set((manifest.plan_row_fingerprints || []).map((row) => String(row.offer_id)));
  const fingerprintFields = ["source_fingerprint", "full_capture_fingerprint", "executable_source_fingerprint", "review_scope_fingerprint", "approved_full_capture_fingerprint", "approved_review_scope_fingerprint", "fresh_full_capture_fingerprint", "fresh_review_scope_fingerprint", "plan_fingerprint"];
  if (manifest.schema_version !== 2 || manifest.kind !== KIND || !Number.isFinite(ageMs) || ageMs < -120000 || ageMs > 15 * 60 * 1000 || JSON.stringify(manifest.offer_ids) !== JSON.stringify(SCOPES.map((scope) => scope.offer_id)) || executable.size !== (manifest.executable_offer_ids || []).length || review.size !== (manifest.review_rows || []).length || blocked.size !== (manifest.blocked_rows || []).length || blocked.size !== 0 || [...executable].some((id) => review.has(id) || blocked.has(id)) || [...review].some((id) => blocked.has(id)) || executable.size + review.size !== SCOPES.length || SCOPES.some((scope) => !executable.has(scope.offer_id) && !review.has(scope.offer_id)) || sourceFingerprintIds.size !== SCOPES.length || SCOPES.some((scope) => !sourceFingerprintIds.has(scope.offer_id)) || planFingerprintIds.size !== executable.size || [...executable].some((id) => !planFingerprintIds.has(id)) || (manifest.source_row_fingerprints || []).some((row) => !/^[0-9a-f]{64}$/.test(row.semantic_fingerprint || "")) || (manifest.plan_row_fingerprints || []).some((row) => row.scope !== "EXECUTABLE" || !/^[0-9a-f]{64}$/.test(row.semantic_fingerprint || "")) || fingerprintFields.some((field) => !/^[0-9a-f]{64}$/.test(manifest[field] || ""))) fail("Pending eBay refresh batch scope, partition or freshness mismatch");
  return { manifest, executable, manifestSha256: expectedHash };
}

function parseArgs(argv) {
  const options = {};
  for (const argument of argv) {
    const match = argument.match(/^--(mode|target|approved-contract|emit-approval-contract)=(.*)$/);
    if (!match || options[match[1]] !== undefined) fail(`Invalid argument ${argument}`);
    options[match[1]] = match[2];
  }
  if (options.target !== "production") fail("Required --target=production");
  if (!new Set(["dry-run", "prepare-apply", "execute-apply"]).has(options.mode)) fail("Required --mode=dry-run|prepare-apply|execute-apply");
  if (options["approved-contract"] !== undefined) options.approvedContract = options["approved-contract"];
  if (options["emit-approval-contract"] !== undefined && !["true", "false"].includes(options["emit-approval-contract"])) fail("emit-approval-contract must be true or false");
  if (options["emit-approval-contract"] !== undefined) options.emitApprovalContract = options["emit-approval-contract"] === "true";
  delete options["approved-contract"];
  delete options["emit-approval-contract"];
  if (options.mode === "prepare-apply" && process.env.GITHUB_EVENT_NAME === "workflow_dispatch" && !options.approvedContract) fail("Artifact-bound manual apply requires --approved-contract");
  if (options.mode !== "dry-run" && options.emitApprovalContract) fail("Only dry-run may emit an approval contract");
  return options;
}

function assertExecutionContext(mode, env = process.env) {
  if (mode === "dry-run") return;
  if (env.GITHUB_ACTIONS !== "true" || env.GITHUB_REF !== "refs/heads/main" || !["schedule", "workflow_dispatch"].includes(env.GITHUB_EVENT_NAME)) fail("eBay refresh apply requires GitHub Actions schedule or manual dispatch on main");
  if (env.GITHUB_EVENT_NAME === "workflow_dispatch") approvedFromEnv(env);
}

function classifyContinuity(scope, evaluation) {
  const exactIdentity = evaluation.item_id === scope.external_variant_id && evaluation.legacy_item_id === scope.external_product_id;
  if (!exactIdentity || !evaluation.affiliate_ready || !evaluation.affiliate_url) return { eligible: false, tier: "blocked" };
  const blockers = new Set(evaluation.blockers);
  const reasons = new Set(evaluation.review_reasons);
  const reviewed = REVIEWED_MISSING_GTIN_CONTINUITY.get(scope.offer_id);
  const reviewedExactGtin = REVIEWED_EXACT_GTIN_CONTINUITY.get(scope.offer_id);
  const expectedBlockers = reviewed?.blockers || (scope.gtin ? new Set() : new Set(["CANONICAL_GTIN_INVALID"]));
  const expectedReturnedGtin = reviewed && Object.hasOwn(reviewed, "returned_gtin") ? reviewed.returned_gtin : null;
  if (
    evaluation.returned_gtin === expectedReturnedGtin && reviewed && evaluation.seller?.username === reviewed.seller && evaluation.seller?.account_type === "BUSINESS" &&
    blockers.size === expectedBlockers.size && [...blockers].every((blocker) => expectedBlockers.has(blocker)) &&
    reasons.size === reviewed.review_reasons.size && [...reasons].every((reason) => reviewed.review_reasons.has(reason))
  ) return { eligible: true, tier: "sealed_owner_reviewed_missing_gtin_continuity" };
  if (
    scope.gtin && evaluation.returned_gtin === scope.gtin && reviewedExactGtin &&
    evaluation.seller?.username === reviewedExactGtin.seller && evaluation.seller?.account_type === "BUSINESS" &&
    blockers.size === reviewedExactGtin.blockers.size && [...blockers].every((blocker) => reviewedExactGtin.blockers.has(blocker)) &&
    reasons.size === reviewedExactGtin.review_reasons.size && [...reasons].every((reason) => reviewedExactGtin.review_reasons.has(reason))
  ) return { eligible: true, tier: "sealed_owner_reviewed_exact_gtin_metadata_continuity" };
  if (blockers.size) return { eligible: false, tier: "blocked" };
  if (evaluation.decision === "AUTO_ELIGIBLE" && evaluation.returned_gtin === scope.gtin) return { eligible: true, tier: "live_exact_gtin" };
  if (evaluation.returned_gtin === scope.gtin && reasons.size > 0 && [...reasons].every((reason) => EXACT_GTIN_METADATA_GAPS.has(reason))) return { eligible: true, tier: "live_exact_gtin_with_metadata_gap" };
  if (scope.gtin && evaluation.returned_gtin === null && reasons.size === 1 && reasons.has("RETURNED_GTIN_UNPROVEN")) return { eligible: true, tier: "sealed_existing_identity_continuity" };
  return { eligible: false, tier: "blocked" };
}

function rowFromEvaluation(scope, evaluation) {
  if (!(evaluation.continuity || classifyContinuity(scope, evaluation)).eligible) fail(`Exact eBay listing identity is no longer eligible for offer ${scope.offer_id}`);
  if (!evaluation.item_price || !evaluation.uk_shipping || !evaluation.delivered_price || evaluation.item_price.currency !== "GBP" || evaluation.uk_shipping.currency !== "GBP" || evaluation.delivered_price.currency !== "GBP" || !evaluation.affiliate_ready || !evaluation.affiliate_url) fail(`Complete affiliate-ready GBP delivered price is required for offer ${scope.offer_id}`);
  return {
    ...Object.fromEntries(Object.entries(scope).filter(([key]) => !["gtin", "flavour_label", "size_value", "unit_count", "unit_type", "retailer_id", "retailer_product_id", "offer_id", "rollout"].includes(key))),
    external_url: scope.external_url,
    affiliate_url: scope.affiliate_url,
    price: evaluation.item_price.value.toFixed(2), shipping_known: "true",
    shipping_cost: evaluation.uk_shipping.value.toFixed(2), in_stock: "true", is_for_sale: "true",
  };
}

function validatePlan(scope, loaded) {
  if (loaded.artifact.blocked_rows.length || loaded.artifact.plans.length !== 1) fail(`Refresh importer must return exactly one unblocked plan for offer ${scope.offer_id}`);
  const entry = loaded.artifact.plans[0], plan = entry.resolved_plan;
  const before = plan.expected_state?.offer, after = plan.offer?.values;
  if (!["manual", "feed"].includes(entry.plan_kind) || String(entry.retailer_id) !== scope.retailer_id || plan.product?.action !== "existing" || String(plan.product.id) !== scope.product_id || plan.product_variant?.action !== "existing" || String(plan.product_variant.id) !== scope.product_variant_id || plan.retailer?.action !== "existing" || String(plan.retailer.id) !== scope.retailer_id || plan.retailer_product?.action !== "noop" || String(plan.retailer_product.id) !== scope.retailer_product_id || !["update", "verify_no_change"].includes(plan.offer?.action) || String(plan.offer.id) !== scope.offer_id || !["noop", "create"].includes(plan.price_history?.action)) fail(`Refresh plan escaped exact scope for offer ${scope.offer_id}`);
  if (!before || !after || String(before.retailer_product_id) !== scope.retailer_product_id || after.url !== scope.affiliate_url || after.in_stock !== true) fail(`Refresh plan changed identity, URL or guarded stock policy for offer ${scope.offer_id}`);
  const oldPrice = Number(before.price), newPrice = Number(after.price), absolute = Math.abs(newPrice - oldPrice), ratio = absolute / Math.max(0.01, oldPrice);
  if (!(newPrice > 0) || ratio >= 0.6 || absolute >= 20) fail(`Refresh price change exceeds the approved hard limit for offer ${scope.offer_id}`);
  return { loaded, entry };
}

function validatePreparedArtifact(scope, loaded, now = new Date()) {
  if (loaded.artifact.environment_marker !== "production") fail("Prepared refresh artifact target mismatch");
  const createdAt = new Date(loaded.artifact.created_at), ageMs = now.getTime() - createdAt.getTime();
  if (!Number.isFinite(createdAt.getTime()) || ageMs < -120000 || ageMs > 15 * 60 * 1000) fail("Prepared refresh artifact is not fresh");
  const approved = validatePlan(scope, loaded);
  const plan = approved.entry.resolved_plan;
  if (plan.offer.action !== "verify_no_change" || plan.price_history.action !== "noop") fail(`Only VERIFY_NO_CHANGE may execute automatically for offer ${scope.offer_id}`);
  return approved;
}

function actionForPlan(plan) {
  if (plan.offer.action === "verify_no_change") return "VERIFY_NO_CHANGE";
  const before = plan.expected_state.offer;
  const after = plan.offer.values;
  const price = Number(before.price) !== Number(after.price);
  const stock = before.in_stock !== after.in_stock;
  if (price && stock) return "UPDATE_PRICE_AND_STOCK";
  if (price) return "UPDATE_PRICE";
  if (stock) return "UPDATE_STOCK";
  return "MANUAL_REVIEW";
}

async function buildSource(scope, config, fetchImpl = fetch, tokenOverride = null, sourceFetchOptions = {}) {
  const token = tokenOverride || await getApplicationToken(config, fetchImpl);
  const context = [`contextualLocation=country%3DGB%2Czip%3D${encodeURIComponent(config.postcode)}`];
  if (config.campaign_id) context.push(`affiliateCampaignId=${encodeURIComponent(config.campaign_id)}`);
  const fetched = await boundedSourceFetch(`https://api.ebay.com/buy/browse/v1/item/${encodeURIComponent(scope.external_variant_id)}`, { headers: { Authorization: `Bearer ${token}`, "X-EBAY-C-MARKETPLACE-ID": config.marketplace_id, "X-EBAY-C-ENDUSERCTX": context.join(",") } }, { fetchImpl, ...sourceFetchOptions });
  const response = fetched.response;
  const status = Number(response.status || (response.ok ? 200 : 0));
  if (!response.ok) {
    const error = new Error(`Approved eBay listing ${scope.external_variant_id} direct read failed with HTTP ${status}; automatic OOS is intentionally blocked`);
    error.source_failure_scope = status === 404 ? "ROW" : "GLOBAL";
    error.source_retry = { attempts: fetched.attempts, retry_count: fetched.retry_count };
    error.http_metadata = { status };
    throw error;
  }
  const exact = await response.json();
  if (String(exact.itemId) !== scope.external_variant_id || String(exact.legacyItemId) !== scope.external_product_id) fail(`Direct eBay item identity drift for offer ${scope.offer_id}`);
  return {
    ...evaluateItem(scope, exact, { ...DEFAULT_POLICY, affiliate_campaign_configured: true }),
    source_retry: { attempts: fetched.attempts, retry_count: fetched.retry_count },
    http_metadata: { status },
  };
}

async function prepareScope(scope, evaluation, mode, dependencies, stamp, approvedSourceCapturedAt = null) {
  const row = rowFromEvaluation(scope, evaluation);
  let artifactRows = [row];
  let result = await (dependencies.runImportRows || runImportRows)([row], { mode: "manual", dryRun: true });
  const initialPlan = result.report?.approvedRows?.[0]?.importPlan;
  if (!initialPlan) {
    const blockedRows = result.blockedRows || result.report?.blockedRows || [];
    const reason = String(blockedRows[0]?.block_reason || blockedRows[0]?.reason || "");
    if (blockedRows.length === 1 && /conflicting variant evidence/i.test(reason)) {
      return { review: { offer_id: scope.offer_id, item_id: evaluation.item_id, action: "IDENTITY_CONFLICT", review_type: "IDENTITY_CONFLICT", reason } };
    }
    fail(`Refresh importer blocked offer ${scope.offer_id} outside the isolated identity-conflict contract`);
  }
  if (initialPlan?.offer?.action === "noop") {
    const capturedAt = approvedSourceCapturedAt || new Date().toISOString();
    if (new Date(capturedAt).toISOString() !== capturedAt || Date.parse(capturedAt) > Date.now()) fail(`Approved source capture timestamp is invalid for offer ${scope.offer_id}`);
    const snapshotHash = sha256(JSON.stringify({ item_id: evaluation.item_id, gtin: evaluation.returned_gtin, price: evaluation.item_price, shipping: evaluation.uk_shipping, delivered: evaluation.delivered_price, captured_at: capturedAt }));
    const target = JSON.parse(JSON.stringify(initialPlan.expected_state));
    delete target.retailer_product.updated_at;
    const verification = buildVerifiedNoChangeDryRun([{ source_snapshot_sha256: snapshotHash, source_captured_at: capturedAt, source: { external_product_id: scope.external_product_id, external_variant_id: scope.external_variant_id, price: row.price, in_stock: true, url: row.affiliate_url, external_url: row.external_url }, target }], { targetEnvironment: "PRODUCTION", targetProjectRef: PROJECT_REF, expectedCount: 1, sourceSnapshotSha256s: [snapshotHash], now: new Date(capturedAt) });
    artifactRows = verification.records;
    result = verification.result;
  }
  const artifactPath = mode === "prepare-apply" ? pendingArtifact(scope) : path.join(OUT, `artifact-${scope.offer_id}-${stamp}.json`);
  const written = (dependencies.writeDryRunArtifact || writeDryRunArtifact)(artifactRows, result, { artifactPath, sourceFileName: `ebay-browse-live-${scope.offer_id}.json`, environmentMarker: "production" });
  const approved = validatePlan({ ...scope, affiliate_url: row.affiliate_url }, { artifact: written.artifact, artifactSha256: written.artifactSha256 });
  return { approved, evaluation };
}

async function run(options, dependencies = {}) {
  assertExecutionContext(options.mode, dependencies.env || process.env);
  fs.mkdirSync(OUT, { recursive: true });
  const now = dependencies.now || new Date();
  if (options.mode === "execute-apply") {
    const batch = (dependencies.loadPendingBatch || loadPendingBatch)(now);
    let approvedInput = null;
    if ((dependencies.env || process.env).GITHUB_EVENT_NAME === "workflow_dispatch") {
      approvedInput = approvedFromEnv(dependencies.env || process.env);
      if (batch.manifest.commit_sha !== approvedInput.commitSha || batch.manifest.approved_full_capture_fingerprint !== approvedInput.fullCaptureFingerprint || batch.manifest.executable_source_fingerprint !== approvedInput.executableSourceFingerprint || batch.manifest.approved_review_scope_fingerprint !== approvedInput.reviewScopeFingerprint || batch.manifest.plan_fingerprint !== approvedInput.planFingerprint) fail("Pending batch escaped the approved executable-scope contract");
    }
    const approved = SCOPES.filter((scope) => batch.executable.has(scope.offer_id)).map((scope) => validatePreparedArtifact(scope, (dependencies.loadDryRunArtifact || loadDryRunArtifact)(pendingArtifact(scope)), now));
    for (const item of approved) await (dependencies.executePlan || executePlan)(item, KIND);
    const report = {
      result: batch.manifest.review_rows.length ? "PASS_WITH_REVIEW" : "PASS",
      mode: options.mode,
      approved_mapping_count: SCOPES.length,
      executable_plan_count: approved.length,
      executed_plan_count: approved.length,
      review_row_count: batch.manifest.review_rows.length,
      blocked_row_count: 0,
      execution_offer_ids: [...batch.executable],
      review_rows: batch.manifest.review_rows,
      blocked_rows: [],
      classification: { VERIFY_NO_CHANGE: approved.length },
      expected_deltas: {
        logical_field_deltas: { offer_price_updates: 0, offer_stock_updates: 0, offer_shipping_updates: 0, offer_total_updates: 0, offer_url_updates: 0, mapping_url_updates: 0, last_checked_at_updates: approved.length },
        row_count_deltas: { products: 0, product_variants: 0, retailer_products: 0, offers: 0, price_history: 0 },
      },
      scope: { offers: SCOPES.length, executable: approved.length, review: batch.manifest.review_rows.length, blocked: 0, offer_ids: SCOPES.map((scope) => scope.offer_id) },
      executed: approved.length,
      automatic_oos: "blocked",
      commit_sha: process.env.GITHUB_SHA || null,
      manifest_sha256: batch.manifestSha256,
      source_fingerprint: batch.manifest.source_fingerprint,
      full_capture_fingerprint: batch.manifest.full_capture_fingerprint,
      executable_source_fingerprint: batch.manifest.executable_source_fingerprint,
      review_scope_fingerprint: batch.manifest.review_scope_fingerprint,
      plan_row_fingerprints: batch.manifest.plan_row_fingerprints,
      approved_full_capture_fingerprint: batch.manifest.approved_full_capture_fingerprint,
      approved_review_scope_fingerprint: batch.manifest.approved_review_scope_fingerprint,
      fresh_full_capture_fingerprint: batch.manifest.fresh_full_capture_fingerprint,
      fresh_review_scope_fingerprint: batch.manifest.fresh_review_scope_fingerprint,
      plan_fingerprint: batch.manifest.plan_fingerprint,
      approved_dry_run_id: approvedInput?.runId || null,
      approved_artifact_id: approvedInput?.artifactId || null,
      approved_commit_sha: approvedInput?.commitSha || null,
      approved_manifest_sha256: approvedInput?.manifestSha256 || null,
      approved_report_sha256: approvedInput?.reportSha256 || null,
    };
    fs.writeFileSync(path.join(OUT, `execute-apply-${now.toISOString().replace(/[:.]/g, "-")}.json`), `${JSON.stringify(report, null, 2)}\n`);
    fs.writeFileSync(path.join(OUT, "production-apply.json"), `${JSON.stringify(report, null, 2)}\n`);
    return report;
  }
  const config = dependencies.config || assertConfig(dependencies.env || process.env);
  const token = dependencies.token || await getApplicationToken(config, dependencies.fetchImpl || fetch);
  const stamp = now.toISOString().replace(/[:.]/g, "-");
  const evaluations = [];
  for (const scope of SCOPES) {
    try {
      const evaluation = dependencies.evaluations?.get(scope.offer_id) || await buildSource(scope, config, dependencies.fetchImpl || fetch, token, dependencies.sourceFetchOptions);
      evaluations.push({ ...evaluation, continuity: evaluation.continuity || classifyContinuity(scope, evaluation) });
    } catch (error) {
      evaluations.push({
        item_id: scope.external_variant_id,
        decision: "NOT_FOUND",
        blockers: ["SOURCE_READ_FAILED"],
        review_reasons: [],
        returned_gtin: null,
        source_error: "SOURCE_READ_FAILED",
        source_failure_scope: error?.source_failure_scope || "GLOBAL",
        source_retry: error?.source_retry || null,
        http_metadata: error?.http_metadata || null,
        continuity: { eligible: false, tier: "blocked" },
      });
    }
  }
  const unsafeRows = evaluations.flatMap((evaluation, index) => evaluation.continuity.eligible ? [] : [{
    offer_id: SCOPES[index].offer_id,
    item_id: evaluation.item_id,
    decision: evaluation.decision,
    blockers: evaluation.blockers,
    review_reasons: evaluation.review_reasons,
    returned_gtin: evaluation.returned_gtin,
    source_error: evaluation.source_error || null,
    source_failure_scope: evaluation.source_failure_scope || null,
    source_retry: evaluation.source_retry || null,
    http_metadata: evaluation.http_metadata || null,
  }]);
  const prepared = [];
  for (let index = 0; index < SCOPES.length; index += 1) {
    if (!evaluations[index].continuity.eligible) continue;
    prepared.push(await prepareScope(SCOPES[index], evaluations[index], options.mode, dependencies, stamp));
  }
  const { globalBlocked, sourceFailureReview } = partitionSourceFailures(unsafeRows);
  const identityReview = unsafeRows.filter((row) => row.source_error !== "SOURCE_READ_FAILED").map((row) => ({ ...row, review_type: "IDENTITY_CONFLICT" }));
  const importerIdentityReview = prepared.flatMap(({ review }) => review ? [review] : []);
  const preparedRows = prepared.filter(({ approved }) => approved).map(({ approved }) => {
    const plan = approved.entry.resolved_plan;
    return { offer_id: String(plan.offer.id), action: actionForPlan(plan), approved };
  });
  const executableRows = globalBlocked.length ? [] : preparedRows.filter((row) => row.action === "VERIFY_NO_CHANGE");
  const commercialReview = preparedRows.filter((row) => row.action !== "VERIFY_NO_CHANGE").map((row) => ({ offer_id: row.offer_id, action: row.action, review_type: "COMMERCIAL_CHANGE" }));
  const reviewRows = [...sourceFailureReview, ...identityReview, ...importerIdentityReview, ...commercialReview].sort((a, b) => Number(a.offer_id) - Number(b.offer_id));
  const classification = preparedRows.reduce((counts, row) => ({ ...counts, [row.action]: (counts[row.action] || 0) + 1 }), {});
  const semanticSourceRows = buildSemanticSourceRows(SCOPES, evaluations);
  const semanticPlanRows = buildSemanticPlanRows(preparedRows, reviewRows, globalBlocked);
  let report = {
    result: globalBlocked.length ? "BLOCK" : reviewRows.length ? "PASS_WITH_REVIEW" : "PASS",
    mode: options.mode,
    approved_mapping_count: SCOPES.length,
    executable_plan_count: executableRows.length,
    executed_plan_count: 0,
    review_row_count: reviewRows.length,
    blocked_row_count: globalBlocked.length,
    execution_offer_ids: executableRows.map((row) => row.offer_id),
    scope: { offers: SCOPES.length, executable: executableRows.length, review: reviewRows.length, blocked: globalBlocked.length, offer_ids: SCOPES.map((scope) => scope.offer_id) },
    classification,
    classifications: Object.fromEntries(preparedRows.map((row) => [row.offer_id, row.action])),
    captured_at: now.toISOString(),
    source: evaluations.map((evaluation, index) => ({ offer_id: SCOPES[index].offer_id, item_id: evaluation.item_id, gtin: evaluation.returned_gtin, continuity_tier: evaluation.continuity.tier, price: evaluation.item_price?.value ?? null, shipping: evaluation.uk_shipping?.value ?? null, delivered: evaluation.delivered_price?.value ?? null, captured_at: now.toISOString(), source_retry: evaluation.source_retry || null, http_metadata: evaluation.http_metadata || null })),
    review_rows: reviewRows,
    blocked_rows: globalBlocked,
    commercial_change_count: commercialReview.length,
    identity_conflict_count: identityReview.length + importerIdentityReview.length,
    source_failure_review_count: sourceFailureReview.length,
    expected_deltas: {
      logical_field_deltas: { offer_price_updates: 0, offer_stock_updates: 0, offer_shipping_updates: 0, offer_total_updates: 0, offer_url_updates: 0, mapping_url_updates: 0, last_checked_at_updates: executableRows.length },
      row_count_deltas: { products: 0, product_variants: 0, retailer_products: 0, offers: 0, price_history: 0 },
    },
    executed: 0, automatic_oos: "blocked",
    commit_sha: process.env.GITHUB_SHA || null,
  };
  report = bindSemanticEvidence(report, semanticSourceRows, semanticPlanRows);
  if (options.mode === "prepare-apply" && !globalBlocked.length) {
    if ((dependencies.env || process.env).GITHUB_EVENT_NAME === "workflow_dispatch") {
      const approved = loadAndVerifyContract(path.dirname(path.resolve(options.approvedContract)), approvedFromEnv(dependencies.env || process.env), now);
      fs.writeFileSync(path.join(OUT, "fresh-revalidation-candidate.json"), `${JSON.stringify(report, null, 2)}\n`, { flag: "wx" });
      report = verifyFreshReport(approved, report);
      fs.writeFileSync(path.join(OUT, "fresh-revalidation-result.json"), `${JSON.stringify({ result: "PASS", drift_scope: report.drift_scope, approved_executable_offer_ids: report.execution_offer_ids, fresh_candidate_executable_offer_ids: report.fresh_candidate_executable_offer_ids, full_capture_fingerprint: report.full_capture_fingerprint, executable_source_fingerprint: report.executable_source_fingerprint, review_scope_fingerprint: report.review_scope_fingerprint, plan_fingerprint: report.plan_fingerprint, database_writes: 0 }, null, 2)}\n`, { flag: "wx" });
    }
    const binding = (dependencies.writePendingBatch || writePendingBatch)(report, now);
    report.manifest_sha256 = binding?.manifestSha256 || null;
  }
  fs.writeFileSync(path.join(OUT, `${options.mode}-${stamp}.json`), `${JSON.stringify(report, null, 2)}\n`);
  if (options.mode === "dry-run") {
    fs.writeFileSync(path.join(OUT, "production-dry-run.json"), `${JSON.stringify(report, null, 2)}\n`);
    if (options.emitApprovalContract) report.approval_contract = writeDryRunContract(OUT, report, dependencies.env || process.env, now);
  }
  return report;
}

async function main(argv = process.argv.slice(2)) { const report = await run(parseArgs(argv)); console.log(JSON.stringify(report)); if (!report.result.startsWith("PASS")) process.exitCode = 2; }
if (require.main === module) main().catch((error) => { console.error(error.message); process.exitCode = 1; });

module.exports = { CONFIRMATION, KIND, ROLLOUTS, SCOPES, SCOPE, actionForPlan, assertExecutionContext, buildSource, classifyContinuity, loadPendingBatch, loadScopes, parseArgs, partitionSourceFailures, pendingArtifact, prepareScope, rowFromEvaluation, run, validatePlan, validatePreparedArtifact, writePendingBatch };
