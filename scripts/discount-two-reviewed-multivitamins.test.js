const assert = require('node:assert/strict');
const crypto = require('node:crypto');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');

const ROOT = path.resolve(__dirname, '..');
const FORWARD = path.join(ROOT, 'supabase/migrations/20260811113000_add_two_reviewed_discount_multivitamin_offers.sql');
const ROLLBACK = path.join(ROOT, 'supabase/rollbacks/20260811113000_add_two_reviewed_discount_multivitamin_offers.sql');
const FORWARD_SHA = 'dfaf949e26a37f639008dd5c8d09d28a7e63a1d4c03bf04839c57ad7ff3a9783';
const ROLLBACK_SHA = '91389f986cbe47eca3dce559b1cf8ebe3158a0ab0b725421cb8d7fadf3fc986b';

function sha(file) { return crypto.createHash('sha256').update(fs.readFileSync(file)).digest('hex'); }

test('reviewed rollout is byte-bound and production-only', () => {
  const sql = fs.readFileSync(FORWARD, 'utf8');
  assert.equal(sha(FORWARD), FORWARD_SHA);
  assert.match(sql, /current_user <> 'postgres'/);
  assert.match(sql, /target_environment' <> 'PRODUCTION'/);
  assert.match(sql, /project_ref' <> 'aftboxmrdgyhizicfsfu'/);
  assert.match(sql, /owner_reviewed_exact_identity/g);
});

test('reviewed rollout adds only two exact Discount mappings, offers and history rows', () => {
  const sql = fs.readFileSync(FORWARD, 'utf8');
  for (const value of ['55157496185210','42518690463940','TBJP-0046','STRO-0072','15002692616570','7467845877956']) assert.match(sql, new RegExp(value));
  assert.match(sql, /v_mappings_before\+2/);
  assert.match(sql, /v_offers_before\+2/);
  assert.match(sql, /v_history_before\+2/);
  assert.match(sql, /product_variants\) <> v_variants_before/);
  assert.equal((sql.match(/insert into public\.retailer_products/g) || []).length, 2);
  assert.equal((sql.match(/insert into public\.offers/g) || []).length, 2);
  assert.equal((sql.match(/insert into public\.price_history/g) || []).length, 1);
});

test('TBJP and Strom metadata corrections are exact and do not move canonical variants', () => {
  const sql = fs.readFileSync(FORWARD, 'utf8');
  assert.match(sql, /Trained By JP The One Multivitamin 60 Capsules/);
  assert.match(sql, /product_format='capsule', unit_count=60, unit_type='capsule'/);
  assert.match(sql, /id=824[\s\S]*unit_count=180, unit_type='tablet'/);
  assert.doesNotMatch(sql, /update public\.product_variants/i);
  assert.doesNotMatch(sql, /delete from public\.(products|product_variants)/i);
});

test('rollback is exact and refuses after a later refresh', () => {
  const sql = fs.readFileSync(ROLLBACK, 'utf8');
  assert.equal(sha(ROLLBACK), ROLLBACK_SHA);
  assert.match(sql, /last_checked_at=v_tbjp_created_at/);
  assert.match(sql, /last_checked_at=v_strom_created_at/);
  assert.match(sql, /use a forward correction/);
  assert.match(sql, /delete from public\.price_history/);
  assert.match(sql, /delete from public\.offers/);
  assert.match(sql, /delete from public\.retailer_products/);
  assert.doesNotMatch(sql, /delete from public\.(products|product_variants)/i);
});
