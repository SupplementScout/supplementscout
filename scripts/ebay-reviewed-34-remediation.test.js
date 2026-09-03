const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");

const migration = fs.readFileSync(path.join(__dirname, "../supabase/migrations/20260903140000_apply_reviewed_ebay_34_remediation.sql"), "utf8");
const rollback = fs.readFileSync(path.join(__dirname, "../supabase/rollbacks/20260903140000_apply_reviewed_ebay_34_remediation.sql"), "utf8");

test("reviewed eBay remediation is exact, production-bound and artifact-expiring", () => {
  assert.match(migration, /current_user <> 'postgres'/);
  assert.match(migration, /supplementscout-production:aftboxmrdgyhizicfsfu/);
  assert.match(migration, /artifact 9900823759 has expired/);
  assert.match(migration, /eBay exact 237-row scope precondition mismatch/);
  assert.match(migration, /v_rows<>23/g);
  assert.match(migration, /v_rows<>11/g);
  assert.doesNotMatch(migration, /insert into public\.(?:products|product_variants|retailer_products|offers)/i);
  assert.doesNotMatch(migration, /delete from public\.(?:products|product_variants|retailer_products|offers)/i);
});

test("reviewed eBay remediation binds all 23 rebinds and 11 commercial rows", () => {
  const rebinds = [[2582,2767,1179,2910],[2583,2768,1180,2911],[2584,2769,1181,2912],[2585,2770,1267,2946],[2586,2771,1541,2929],[2587,2772,1543,2913],[2624,2810,1138,2881],[2625,2811,1143,2882],[2626,2812,1146,2883],[2627,2813,1147,2893],[2630,2816,1535,2927],[2636,2822,1141,2943],[2646,2832,544,3014],[2647,2833,545,3052],[2648,2834,579,3063],[2649,2835,583,3064],[2650,2836,599,2995],[2651,2837,615,3165],[2653,2839,1154,2894],[2654,2840,1155,2895],[2655,2841,1157,2900],[2656,2842,1158,2901],[2727,2913,1070,2880]];
  for (const [offer, mapping, before, after] of rebinds) {
    assert.match(migration, new RegExp(`\\(${offer},${mapping},(?:\\d+,)?${before},${after}`));
    assert.match(rollback, new RegExp(`\\(${offer},${mapping},${before},${after}\\)`));
  }
  for (const offer of [2554,2617,2642,2643,2689,2704,2715,2728,2731,2735,2742]) {
    assert.match(migration, new RegExp(`\\(${offer},`));
    assert.match(rollback, new RegExp(`\\(${offer},`));
  }
  assert.match(migration, /\(2554,29\.23,12\.15,41\.38/);
});

test("reviewed eBay remediation has a bounded rollback", () => {
  assert.match(rollback, /delete from public\.price_history/);
  assert.match(rollback, /set product_variant_id=x\.old_variant_id/);
  assert.match(rollback, /set price=x\.old_price,shipping_cost=x\.old_shipping,total_price=x\.old_total,last_checked_at=x\.old_checked_at/);
  assert.doesNotMatch(rollback, /drop|truncate/i);
});
