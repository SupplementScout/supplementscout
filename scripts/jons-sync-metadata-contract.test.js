const assert=require("node:assert/strict");
const fs=require("node:fs");
const path=require("node:path");
const test=require("node:test");

const migration=fs.readFileSync(path.join(__dirname,"../supabase/migrations/20260722133000_align_retailer_sync_plan_metadata.sql"),"utf8");

test("metadata alignment is limited to existing offer updates",()=>{
  assert.match(migration,/product,action}' = 'existing'/);
  assert.match(migration,/meta}' \? 'source_snapshot_sha256'/);
  assert.match(migration,/meta}' \? 'source_captured_at'/);
  assert.match(migration,/product_variant,action}' = 'existing'/);
  assert.match(migration,/retailer_product,action}' in \('noop','update'\)/);
  assert.match(migration,/offer,action}' = 'update'/);
  assert.match(migration,/price_history,action}' in \('noop','create'\)/);
  assert.doesNotMatch(migration,/insert\s+into\s+public\.(?:products|product_variants|retailer_products|offers|price_history)/i);
  assert.doesNotMatch(migration,/update\s+public\.(?:products|product_variants|retailer_products|offers|price_history)/i);
});

test("source-bound metadata remains a closed fresh hash-bound schema",()=>{
  assert.match(migration,/array\['version','plan_kind','operation_type','source_row_fingerprint','plan_fingerprint','source_snapshot_sha256','source_captured_at'\]/);
  assert.match(migration,/source_snapshot_sha256}' !~ '\^\[0-9a-f\]\{64\}\$'/);
  assert.match(migration,/source_captured_at}'\)::timestamptz/);
  assert.match(migration,/interval '24 hours'/);
  assert.match(migration,/interval '5 minutes'/);
  assert.match(migration,/md5\(public\.atomic_import_canonical_json/);
});

test("existing validation and apply logic is delegated without new privileges",()=>{
  assert.match(migration,/rename to atomic_import_validate_pre_source_metadata_plan_core/);
  assert.match(migration,/rename to atomic_import_apply_pre_source_metadata_plan_core/);
  assert.match(migration,/atomic_import_validate_pre_source_metadata_plan_core\(/);
  assert.match(migration,/atomic_import_apply_pre_source_metadata_plan_core\(/);
  assert.match(migration,/revoke all on function[\s\S]+from public, anon, authenticated, service_role;/);
  assert.doesNotMatch(migration,/grant\s+/i);
  assert.doesNotMatch(migration,/create\s+role|alter\s+role/i);
  assert.doesNotMatch(migration,/MASS_OOS|MASS_PRICE|MASS_CHANGE|SOURCE_DEGRADED/);
});
