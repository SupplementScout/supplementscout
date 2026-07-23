const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");

const ROOT = path.resolve(__dirname, "..");
const FORWARD = path.join(
  ROOT,
  "supabase/migrations/20260723170000_unify_ekm_shared_parent_import_identity.sql"
);
const ROLLBACK = path.join(
  ROOT,
  "supabase/manual/20260723170000_unify_ekm_shared_parent_import_identity_rollback.sql"
);

test("shared-parent migration is one function-only fail-closed patch", () => {
  const sql = fs.readFileSync(FORWARD, "utf8");
  assert.match(sql, /^begin;/i);
  assert.match(sql, /atomic_import_validate_variant_plan_core\(jsonb\)/i);
  assert.match(sql, /955321b6f9fd577cc95b3e6c206fa7919fd8e7bf54755e9ed584c49b3d587179/i);
  assert.match(sql, /Shared-parent identity contract v1/);
  assert.match(sql, /shared parent peer set changed/);
  assert.match(sql, /approved shared parent peer disappeared/);
  assert.match(sql, /retailer external SKU collision/);
  assert.match(sql, /retailer external GTIN collision/);
  assert.match(sql, /external parent canonical product drift/);
  assert.match(sql, /exact source option tuple collision/);
  assert.match(sql, /pg_catalog\.sha256/);
  assert.match(sql, /commit;\s*$/i);
  assert.doesNotMatch(sql, /\binsert\s+into\s+public\./i);
  assert.doesNotMatch(sql, /\bupdate\s+public\./i);
  assert.doesNotMatch(sql, /\bdelete\s+from\s+public\./i);
  assert.doesNotMatch(sql, /\b(create|alter|drop)\s+table\b/i);
  assert.doesNotMatch(sql, /\b(create|drop)\s+(unique\s+)?index\b/i);
});

test("shared-parent rollback restores the exact prior function hash", () => {
  const sql = fs.readFileSync(ROLLBACK, "utf8");
  assert.match(sql, /^begin;/i);
  assert.match(sql, /Shared-parent identity contract v1/);
  assert.match(sql, /stale product import plan: retailer product identity/);
  assert.match(sql, /955321b6f9fd577cc95b3e6c206fa7919fd8e7bf54755e9ed584c49b3d587179/i);
  assert.match(sql, /commit;\s*$/i);
  assert.doesNotMatch(sql, /\binsert\s+into\s+public\./i);
  assert.doesNotMatch(sql, /\bupdate\s+public\./i);
  assert.doesNotMatch(sql, /\bdelete\s+from\s+public\./i);
});
