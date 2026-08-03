const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");

const source = fs.readFileSync(path.join(__dirname, "close-simply-expired-reviewed-plan.js"), "utf8");

test("expired Simply close is exact, requires expiry, and verifies zero business change", () => {
  assert.match(source, /p\.retailer_id=7/);
  assert.match(source, /Date\.parse\(row\.expires_at\) <= Date\.now\(\)/);
  assert.match(source, /close_expired_retailer_offer_sync_approval/);
  assert.match(source, /business_writes\) === 0/);
  assert.match(source, /price_history_writes\) === 0/);
  assert.match(source, /JSON\.stringify\(after\) === JSON\.stringify\(before\)/);
});
