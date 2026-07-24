const { planFingerprint, serializeImportPlan, sourceRowFingerprint } = require("../../import-products");
const { normalizeDecimalString, normalizeNumbersToDecimalStrings } = require("../canonical-json");

const PRODUCT_KEYS = ["id", "name", "is_active", "merged_into_product_id", "product_format"];
const RETAILER_KEYS = ["id", "name", "slug", "website"];
const VARIANT_KEYS = ["id", "product_id", "variant_key", "display_name", "flavour_code", "flavour_label", "size_value", "size_unit", "pack_count", "product_format", "is_active", "is_default"];
const MAPPING_KEYS = ["id", "retailer_id", "product_id", "product_variant_id", "external_product_id", "external_variant_id", "external_sku", "external_options", "external_name", "external_slug", "external_gtin", "external_url", "match_method", "match_confidence"];
const MAPPING_VALUE_KEYS = ["external_product_id", "external_variant_id", "external_sku", "external_options", "external_name", "external_slug", "external_gtin", "external_url", "match_method", "match_confidence", "product_variant_id"];
const OFFER_KEYS = ["id", "product_id", "retailer_id", "product_variant_id", "retailer_product_id", "price", "shipping_cost", "total_price", "in_stock", "url", "last_checked_at"];

function select(value, keys) { return Object.fromEntries(keys.map((key) => [key, value[key] ?? null])); }
function decimal(value) { return value === null || value === undefined ? null : normalizeDecimalString(value); }
function id(value, label) { const out=String(value ?? ""); if (!/^\d+$/.test(out)) throw new Error(`${label} must be an ID`); return out; }
function databaseTimestamp(value,label){const text=value instanceof Date?value.toISOString():String(value??"");if(!text||!Number.isFinite(Date.parse(text)))throw new Error(`${label} must be a timestamp`);return text}

function normalizeState(input) {
  const product=select(input.product,PRODUCT_KEYS),retailer=select(input.retailer,RETAILER_KEYS),variant=select(input.variant,VARIANT_KEYS),mapping=select(input.mapping,MAPPING_KEYS),offer=select(input.offer,OFFER_KEYS);
  for (const [name,row] of Object.entries({product,retailer,variant,mapping,offer})) row.id=id(row.id,`${name}.id`);
  product.merged_into_product_id=product.merged_into_product_id==null?null:String(product.merged_into_product_id);
  variant.product_id=id(variant.product_id,"variant.product_id");variant.size_value=decimal(variant.size_value);variant.pack_count=variant.pack_count==null?null:String(variant.pack_count);
  mapping.retailer_id=id(mapping.retailer_id,"mapping.retailer_id");mapping.product_id=id(mapping.product_id,"mapping.product_id");mapping.product_variant_id=id(mapping.product_variant_id,"mapping.product_variant_id");mapping.match_confidence=decimal(mapping.match_confidence);
  offer.product_id=id(offer.product_id,"offer.product_id");offer.retailer_id=id(offer.retailer_id,"offer.retailer_id");offer.product_variant_id=id(offer.product_variant_id,"offer.product_variant_id");offer.retailer_product_id=id(offer.retailer_product_id,"offer.retailer_product_id");offer.price=decimal(offer.price);offer.shipping_cost=decimal(offer.shipping_cost);offer.total_price=decimal(offer.total_price);
  const updatedAt=databaseTimestamp(input.mapping.updated_at,"mapping.updated_at");
  const checkedAt=databaseTimestamp(offer.last_checked_at,"offer.last_checked_at");
  if (!product.is_active||product.merged_into_product_id!==null||!variant.is_active||variant.product_id!==product.id||mapping.product_id!==product.id||offer.product_id!==product.id||mapping.product_variant_id!==variant.id||offer.product_variant_id!==variant.id||mapping.retailer_id!==retailer.id||offer.retailer_id!==retailer.id||offer.retailer_product_id!==mapping.id) throw new Error("existing offer identity mismatch");
  return {product,retailer,variant,mapping,offer:{...offer,last_checked_at:checkedAt},mapping_updated_at:updatedAt};
}

function buildExistingOfferUpdatePlan(input) {
  const state=normalizeState(input),source=input.source,capturedAt=new Date(input.sourceCapturedAt).toISOString();
  if (!/^[0-9a-f]{64}$/.test(input.sourceSnapshotFingerprint)||!/^\d+$/.test(String(source.external_product_id))||!/^\d+$/.test(String(source.external_variant_id))) throw new Error("invalid source identity");
  if (state.mapping.external_product_id!==String(source.external_product_id)||state.mapping.external_variant_id!==String(source.external_variant_id)) throw new Error("external identity drift");
  if (Date.parse(capturedAt)<=Date.parse(state.offer.last_checked_at)) throw new Error("source capture is not newer");
  const next={price:decimal(source.price),shipping_cost:decimal(source.shipping_cost),total_price:decimal(source.total_price),in_stock:Boolean(source.in_stock),url:String(source.url),last_checked_at:capturedAt};
  const priceChanged=next.price!==state.offer.price||next.shipping_cost!==state.offer.shipping_cost||next.total_price!==state.offer.total_price;
  const stockChanged=next.in_stock!==state.offer.in_stock,urlChanged=next.url!==state.offer.url;
  if (!priceChanged&&!stockChanged&&!urlChanged) throw new Error("standard update requires a changed field");
  const sourceRecord=normalizeNumbersToDecimalStrings({source_snapshot_sha256:input.sourceSnapshotFingerprint,source_captured_at:capturedAt,source:{external_product_id:String(source.external_product_id),external_variant_id:String(source.external_variant_id),price:next.price,shipping_cost:next.shipping_cost,total_price:next.total_price,in_stock:next.in_stock,url:next.url},target:{product:state.product,retailer:state.retailer,product_variant:state.variant,retailer_product:state.mapping,offer:state.offer}});
  const plan={
    meta:{version:2,plan_kind:"feed",operation_type:"standard_import",source_row_fingerprint:sourceRowFingerprint(sourceRecord),plan_fingerprint:null,source_snapshot_sha256:input.sourceSnapshotFingerprint,source_captured_at:capturedAt},
    product:{action:"existing",id:state.product.id},
    product_variant:{action:"existing",id:state.variant.id,evidence:{flavour:state.variant.flavour_code||state.variant.flavour_label||null,size_value:state.variant.size_value,size_unit:state.variant.size_unit,pack_count:state.variant.pack_count,product_format:state.variant.product_format,external_options:state.mapping.external_options,approved_mapping_id:state.mapping.id}},
    retailer:{action:"existing",id:state.retailer.id},
    retailer_product:{action:urlChanged?"update":"noop",id:state.mapping.id,values:{...select(state.mapping,MAPPING_VALUE_KEYS),external_url:urlChanged?next.url:state.mapping.external_url}},
    offer:{action:"update",id:state.offer.id,values:next},
    price_history:{action:priceChanged?"create":"noop"},approval:{approved:false,approval_type:"none"},
    expected_state:{product:state.product,retailer:state.retailer,product_variant:state.variant,retailer_product:{...state.mapping,updated_at:state.mapping_updated_at},offer:state.offer}
  };
  const serialized=serializeImportPlan(plan);serialized.meta.plan_fingerprint=planFingerprint(serialized);
  return {plan:serializeImportPlan(serialized),changed:{price:priceChanged,stock:stockChanged,url:urlChanged}};
}

module.exports={buildExistingOfferUpdatePlan,normalizeState};
