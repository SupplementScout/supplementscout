const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");

const sql = fs.readFileSync(path.resolve(__dirname, "../supabase/migrations/20260804020000_correct_dolphin_scope_fingerprint.sql"), "utf8");

test("correction changes only the exact Dolphin manifest-array fingerprint", () => {
  assert.match(sql, /register_dolphin_vegan_protein_offer_sync_control_plan/);
  assert.match(sql, /494ce31407d2e564c93c2d9ad3ee7cb049d49b05b0806bd6c8d1f5a09421f8c1/);
  assert.match(sql, /fe0d6d278328d82f23c39711d91e262cdea8d8fa8f870f345d1260c6b6d234b7/);
  assert.doesNotMatch(sql, /\b(update|insert into|delete from)\s+public\.(products|product_variants|retailer_products|offers|price_history)\b/i);
});
