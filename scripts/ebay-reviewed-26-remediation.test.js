const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");

const migration = fs.readFileSync(path.join(__dirname, "../supabase/migrations/20260905170000_apply_reviewed_ebay_26_remediation.sql"), "utf8");

test("reviewed eBay 26 remediation is artifact-bound, expiring, and exact", () => {
  assert.match(migration, /run 33978002980, artifact 9972941188/);
  assert.match(migration, /59c6d03a2bbcff0b384b86065f76e6f456e3538ca538613cf83e5e017ec11a9d/);
  assert.match(migration, /2026-09-06T16:29:22\.405Z/);
  assert.match(migration, /action='REBIND'\) <> 5/);
  assert.match(migration, /action='OOS'\) <> 18/);
  assert.match(migration, /action='PRICE'\) <> 3/);
  assert.match(migration, /v_rows<>26/);
  assert.match(migration, /v_rows<>8/);
});

test("reviewed eBay 26 remediation has the five approved identities and keeps 2628 OOS", () => {
  for (const binding of [
    "2637,'352221379935','v1|352221379935|0'",
    "2638,'277793153663','v1|277793153663|0'",
    "2681,'167879148689','v1|167879148689|467421651917'",
    "2708,'134979308772','v1|134979308772|0'",
    "2770,'146086688061','v1|146086688061|445043246476'",
  ]) assert.ok(migration.includes(binding));
  assert.match(migration, /\('OOS',2628,2814,882,1396/);
});

test("reviewed eBay 26 remediation cannot create or delete catalogue entities", () => {
  assert.doesNotMatch(migration, /insert into public\.(?:products|product_variants|retailer_products|offers)/i);
  assert.doesNotMatch(migration, /delete from public\.(?:products|product_variants|retailer_products|offers)/i);
  assert.doesNotMatch(migration, /update public\.(?:products|product_variants)/i);
  assert.match(migration, /price_history\) <> 9069/);
  assert.match(migration, /price_history\)-8/);
});
