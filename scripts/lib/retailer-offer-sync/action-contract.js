const ACTIONS = Object.freeze([
  "VERIFY_NO_CHANGE", "UPDATE_PRICE", "UPDATE_STOCK", "UPDATE_PRICE_AND_STOCK",
  "UPDATE_URL", "UPDATE_PRICE_STOCK_URL", "BLOCK_IDENTITY_DRIFT", "BLOCK_SOURCE_ANOMALY",
]);
const EXECUTABLE_ACTIONS = new Set(ACTIONS.slice(0, 6));
const BLOCKING_ACTIONS = new Set(ACTIONS.slice(6));
const ZERO_ROWS = Object.freeze({ products: 0, product_variants: 0, retailer_products: 0, offers: 0, price_history: 0 });
const ZERO_FIELDS = Object.freeze({ offer_price_updates: 0, offer_shipping_updates: 0, offer_total_updates: 0, offer_stock_updates: 0, offer_url_updates: 0, mapping_url_updates: 0, mapping_updated_at_updates: 0, last_checked_at_updates: 0 });

function actionForChanges({ price = false, stock = false, url = false }) {
  if (url && (price || stock)) return "UPDATE_PRICE_STOCK_URL";
  if (url) return "UPDATE_URL";
  if (price && stock) return "UPDATE_PRICE_AND_STOCK";
  if (price) return "UPDATE_PRICE";
  if (stock) return "UPDATE_STOCK";
  return "VERIFY_NO_CHANGE";
}

function deltasForChanges(changed, { shippingChanged = false, totalChanged = changed.price } = {}) {
  const executable = !changed.blocked;
  return {
    row_count_deltas: { ...ZERO_ROWS, price_history: executable && changed.price ? 1 : 0 },
    logical_field_deltas: {
      ...ZERO_FIELDS,
      offer_price_updates: executable && changed.price ? 1 : 0,
      offer_shipping_updates: executable && changed.price && shippingChanged ? 1 : 0,
      offer_total_updates: executable && totalChanged ? 1 : 0,
      offer_stock_updates: executable && changed.stock ? 1 : 0,
      offer_url_updates: executable && changed.url ? 1 : 0,
      mapping_url_updates: executable && changed.url ? 1 : 0,
      mapping_updated_at_updates: executable && changed.url ? 1 : 0,
      last_checked_at_updates: executable ? 1 : 0,
    },
  };
}

function sumDeltas(rows) {
  const result = { row_count_deltas: { ...ZERO_ROWS }, logical_field_deltas: { ...ZERO_FIELDS } };
  for (const row of rows) for (const group of Object.keys(result)) for (const key of Object.keys(result[group])) result[group][key] += row.expected_deltas[group][key];
  return result;
}

// Project a frozen atomic plan into the shared reporting contract. This is
// evidence about expected deltas, never classification or execution authority.
function deltasForExistingOfferPlan(plan) {
  const before=plan.expected_state?.offer, after=plan.offer?.values;
  if (!before || !after || !["update","verify_no_change","noop"].includes(plan.offer.action)) throw new Error("EXISTING_OFFER_DELTA_PLAN_INVALID");
  const moneyEqual=(a,b)=>a==null||b==null?a==null&&b==null:Number(a)===Number(b);
  return { row_count_deltas:{...ZERO_ROWS,price_history:plan.price_history.action==="create"?1:0}, logical_field_deltas:{
    ...ZERO_FIELDS,offer_price_updates:Number(!moneyEqual(before.price,after.price)),
    offer_shipping_updates:Number(!moneyEqual(before.shipping_cost,after.shipping_cost)),
    offer_total_updates:Number(!moneyEqual(before.total_price,after.total_price)),offer_stock_updates:Number(before.in_stock!==after.in_stock),
    offer_url_updates:Number(before.url!==after.url),mapping_url_updates:Number(plan.expected_state.retailer_product.external_url!==plan.retailer_product.values.external_url),
    mapping_updated_at_updates:Number(plan.retailer_product.action!=="noop"),last_checked_at_updates:Number(plan.offer.action!=="noop"),
  }};
}

module.exports = { ACTIONS, BLOCKING_ACTIONS, EXECUTABLE_ACTIONS, ZERO_FIELDS, ZERO_ROWS, actionForChanges, deltasForChanges, deltasForExistingOfferPlan, sumDeltas };
