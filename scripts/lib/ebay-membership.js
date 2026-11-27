const fs = require("node:fs");
const path = require("node:path");
const crypto = require("node:crypto");
const { parse } = require("csv-parse/sync");
const { canonicalJson } = require("./canonical-json");
const ROOT = path.resolve(__dirname, "../..");
const ROLLOUT_DIR = path.join(ROOT, "docs/rollouts/ebay-offer-canary");
const PROJECT_REF = "aftboxmrdgyhizicfsfu";
function fail(message) { throw new Error(message); }
function sha256(value) { return crypto.createHash("sha256").update(value).digest("hex"); }
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
  ["2582", Object.freeze({ product_variant_id: "2910" })],
  ["2583", Object.freeze({ product_variant_id: "2911" })],
  ["2584", Object.freeze({ product_variant_id: "2912" })],
  ["2585", Object.freeze({ product_variant_id: "2946" })],
  ["2586", Object.freeze({ product_variant_id: "2929" })],
  ["2587", Object.freeze({ product_variant_id: "2913" })],
  ["2624", Object.freeze({ product_variant_id: "2881" })],
  ["2625", Object.freeze({ product_variant_id: "2882" })],
  ["2626", Object.freeze({ product_variant_id: "2883" })],
  ["2627", Object.freeze({ product_variant_id: "2893" })],
  ["2630", Object.freeze({ product_variant_id: "2927" })],
  ["2636", Object.freeze({ product_variant_id: "2943" })],
  ["2646", Object.freeze({ product_variant_id: "3014" })],
  ["2647", Object.freeze({ product_variant_id: "3052" })],
  ["2648", Object.freeze({ product_variant_id: "3063" })],
  ["2649", Object.freeze({ product_variant_id: "3064" })],
  ["2650", Object.freeze({ product_variant_id: "2995" })],
  ["2651", Object.freeze({ product_variant_id: "3165" })],
  ["2653", Object.freeze({ product_variant_id: "2894" })],
  ["2654", Object.freeze({ product_variant_id: "2895" })],
  ["2655", Object.freeze({ product_variant_id: "2900" })],
  ["2656", Object.freeze({ product_variant_id: "2901" })],
  ["2727", Object.freeze({ product_variant_id: "2880" })],
]);

function reviewedCsvHashMatches(bytes, expected) {
  if (sha256(bytes) === expected) return true;
  const text = bytes.toString("utf8");
  return text.includes("\r\n") && sha256(Buffer.from(text.replace(/\r\n/g, "\n"), "utf8")) === expected;
}

function loadLegacyScopes() {
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
  const scopes = rows.map((row, index) => {
    const live = LIVE_IDENTITY_OVERRIDES.get(row.external_variant_id) || [String(2724 + index), String(2539 + index)];
    const offerId = live[1];
    const reviewedVariant = OWNER_REVIEWED_CANONICAL_VARIANT_OVERRIDES.get(offerId) || {};
    return Object.freeze({ ...row, ...reviewedVariant, gtin: row.external_gtin, retailer_id: "12", retailer_product_id: live[0], offer_id: offerId });
  });
  if (new Set(scopes.map((row) => row.product_variant_id)).size !== scopes.length) fail("Applied eBay canonical variant overrides contain duplicate identities");
  return Object.freeze(scopes);
}


// The historical rollout approvals and readback overrides above stay frozen.
// Future members come only from a reviewed manifest after real import readback.
const LEGACY_SCOPE_SHA256 = "e974baca29062190439cd199102c6a7cb1f692f58e3375ecdf8aea689a1da25d";
// Exact after-bindings from 20260905170000_apply_reviewed_ebay_26_remediation.sql.
// These five differences can remain in review; they never authorize execution.
const LEGACY_REVIEW_NATIVE_BINDINGS = Object.freeze({
  "2637": Object.freeze(["352221379935", "v1|352221379935|0"]),
  "2638": Object.freeze(["277793153663", "v1|277793153663|0"]),
  "2681": Object.freeze(["167879148689", "v1|167879148689|467421651917"]),
  "2708": Object.freeze(["134979308772", "v1|134979308772|0"]),
  "2770": Object.freeze(["146086688061", "v1|146086688061|445043246476"]),
});
const IDENTITY_FIELDS = Object.freeze(["retailer_id", "retailer_product_id", "offer_id", "product_id", "product_variant_id", "external_product_id", "external_variant_id", "external_gtin", "external_url", "affiliate_url", "seller_username", "flavour_label", "size_value", "size_unit", "pack_count", "unit_count", "unit_type", "product_format", "owner_artifact_sha256", "import_readback_sha256", "continuity_policy"]);
function identity(scope) { return Object.fromEntries(IDENTITY_FIELDS.map(key => [key, scope[key] == null ? null : typeof scope[key] === "object" ? scope[key] : String(scope[key])])); }
function freeze(value) {
  if (value && typeof value === "object") { Object.values(value).forEach(freeze); Object.freeze(value); }
  return value;
}
function createMembership(manifest, legacyScopes = loadLegacyScopes()) {
  if (manifest.schema_version !== 1 || !Number.isSafeInteger(manifest.version) || manifest.version < 1 || !Array.isArray(manifest.additions)) fail("Invalid eBay membership manifest");
  if (manifest.legacy_scope_sha256 !== LEGACY_SCOPE_SHA256 || sha256(canonicalJson(legacyScopes)) !== LEGACY_SCOPE_SHA256) fail("Frozen Exact-237 membership changed");
  if (manifest.version === 1 && manifest.additions.length) fail("Legacy membership cannot be expanded without a new version");
  for (const scope of manifest.additions) {
    for (const key of ["retailer_product_id", "offer_id", "product_id", "product_variant_id", "external_product_id"]) {
      if (!/^[1-9][0-9]*$/.test(scope[key] || "")) fail(`Resolved eBay membership ${key} required`);
    }
    if (String(scope.retailer_id) !== "12" || !/^[A-Za-z0-9_.-]{1,64}$/.test(scope.seller_username || "")) fail("Exact eBay retailer and seller required");
    const native = String(scope.external_variant_id || "").match(/^v1\|([1-9][0-9]*)\|(0|[1-9][0-9]*)$/);
    if (!native || native[1] !== String(scope.external_product_id)) fail("Exact eBay item/variation identity required");
    let url;
    try { url = new URL(scope.external_url); } catch { fail("Exact eBay source URL required"); }
    if (url.protocol !== "https:" || !["www.ebay.co.uk", "ebay.co.uk"].includes(url.hostname) || !url.pathname.endsWith(`/itm/${native[1]}`) || (url.searchParams.get("var") || "0") !== native[2]) fail("eBay membership URL identity mismatch");
    let affiliate;
    try { affiliate = new URL(scope.affiliate_url); } catch { fail("eBay affiliate URL required"); }
    if (affiliate.protocol !== "https:" || !["www.ebay.co.uk", "ebay.co.uk"].includes(affiliate.hostname) || affiliate.pathname.match(/\/itm\/(?:[^/]+\/)?([0-9]+)\/?$/)?.[1] !== native[1] || (affiliate.searchParams.get("var") || "0") !== native[2] || !/^[0-9]{10}$/.test(affiliate.searchParams.get("campid") || "")) fail("eBay affiliate membership binding mismatch");
    const policy = scope.continuity_policy;
    if (policy && (Object.keys(policy).sort().join(",") !== "blockers,returned_gtin,review_reasons" || !Array.isArray(policy.blockers) || !Array.isArray(policy.review_reasons) || [...policy.blockers,...policy.review_reasons].some(code => !/^[A-Z][A-Z0-9_]*$/.test(code)) || (policy.returned_gtin !== null && policy.returned_gtin !== scope.gtin))) fail("Invalid reviewed eBay continuity policy");
    if (![scope.owner_artifact_sha256, scope.import_readback_sha256].every(value => /^[0-9a-f]{64}$/.test(value || ""))) fail("Existing owner artifact and real import readback binding required");
  }
  const scopes = [...legacyScopes, ...manifest.additions].map(scope => JSON.parse(JSON.stringify(scope)));
  for (const key of ["offer_id", "retailer_product_id", "product_variant_id", "external_variant_id"]) {
    if (new Set(scopes.map(scope => String(scope[key]))).size !== scopes.length) fail(`Duplicate eBay membership ${key}`);
  }
  const fingerprint = sha256(canonicalJson({ version: manifest.version, identities: scopes.map(identity).sort((a,b) => Number(a.offer_id)-Number(b.offer_id)) }));
  return freeze({ version: manifest.version, fingerprint, count: scopes.length, scopes, offerIds: scopes.map(scope => String(scope.offer_id)).sort((a,b) => Number(a)-Number(b)) });
}
const MEMBERSHIP = createMembership(require("../../config/retailers/ebay-approved-membership.json"));
const SCOPES = MEMBERSHIP.scopes;
function loadScopes() { return SCOPES; }
function bindMembership(value = {}, membership = MEMBERSHIP) {
  return { ...value, membership_version: membership.version, membership_fingerprint: membership.fingerprint };
}
function assertArtifactMembership(value, membership = MEMBERSHIP) {
  const legacy = value?.membership_version == null && value?.membership_fingerprint == null;
  if (legacy && membership.version === 1 && value?.approved_mapping_count === membership.count) return true;
  if (legacy && membership.version === 1) fail("eBay artifact membership scope drift");
  if (value?.membership_version !== membership.version || value?.membership_fingerprint !== membership.fingerprint) fail("eBay artifact membership version or fingerprint mismatch");
  return true;
}
function assertMembershipRows(rows, kind = "source", membership = MEMBERSHIP, options = {}) {
  if (!Array.isArray(rows) || rows.length !== membership.count || new Set(rows.map(row => String(row.offer_id))).size !== membership.count) fail("eBay membership row coverage mismatch");
  const expected = new Map(membership.scopes.map(scope => [String(scope.offer_id), scope]));
  for (const row of rows) {
    const scope = expected.get(String(row.offer_id));
    if (!scope) fail("Unapproved eBay membership offer");
    const fields = kind === "database"
      ? { mapping_id: "retailer_product_id", retailer_id: "retailer_id", mapping_product_id: "product_id", mapping_variant_id: "product_variant_id", offer_product_id: "product_id", offer_variant_id: "product_variant_id", external_product_id: "external_product_id", external_variant_id: "external_variant_id" }
      : { mapping_id: "retailer_product_id", retailer_id: "retailer_id", product_id: "product_id", product_variant_id: "product_variant_id", external_product_id: "external_product_id", external_variant_id: "external_variant_id" };
    for (const [field,key] of Object.entries(fields)) {
      if (String(row[field]) === String(scope[key])) continue;
      // Legacy remediation may have changed a listing while its frozen refresh
      // provenance stays in review. Never promote that drift into execution or
      // apply this compatibility rule to a newly imported member.
      const reviewedNative = LEGACY_REVIEW_NATIVE_BINDINGS[String(row.offer_id)];
      const legacyNativeReview = kind === "database" && !scope.import_readback_sha256 && reviewedNative
        && String(row.external_product_id) === reviewedNative[0] && String(row.external_variant_id) === reviewedNative[1]
        && ["external_product_id", "external_variant_id"].includes(field)
        && (options.deferLegacyNativeDrift === true || options.reviewOfferIds?.includes(String(row.offer_id)));
      if (!legacyNativeReview) fail(`eBay membership identity mismatch for offer ${row.offer_id}`);
    }
  }
  return true;
}
module.exports = { MEMBERSHIP, SCOPES, ROLLOUTS, LEGACY_SCOPE_SHA256, loadScopes, createMembership, bindMembership, assertArtifactMembership, assertMembershipRows };
