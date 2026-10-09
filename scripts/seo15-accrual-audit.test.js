const assert = require("node:assert/strict");
const test = require("node:test");
const { AUDIT_SQL, collectAudit, parseArgs } = require("./seo15-accrual-audit");

test("SEO-15 audit output is restricted to tmp", () => {
  assert.match(parseArgs(["--output=tmp/seo15/report.json"]).output, /tmp[\\/]seo15[\\/]report\.json$/);
  assert.throws(() => parseArgs(["--output=docs/report.json"]), /inside repository tmp/);
});

test("SEO-15 audit SQL is read-only and covers maturity, continuity and drops", () => {
  assert.doesNotMatch(AUDIT_SQL, /\b(?:insert|update|delete|truncate|alter|create|drop|grant|revoke)\b/i);
  for (const token of ["price_identity_series", "price_observation_producers", "missing_whole_dates", "at_least_30_days", "continuous_7d_threshold_decreases", "qualifying_drops", "current_state_eligible", "identity_drift"]) assert.match(AUDIT_SQL, new RegExp(token));
});

test("SEO-15 database session is repeatable-read, read-only and rolled back", async () => {
  const calls = [];
  class FakeClient {
    async connect() { calls.push("connect"); }
    async query(sql) {
      calls.push(sql);
      if (sql.startsWith("select current_user")) return { rows: [{ current_user: "postgres", session_user: "postgres", read_only: "on", safe_update: "off", target_environment: "PRODUCTION" }] };
      if (sql === AUDIT_SQL) return { rows: [{ report: { captured_at: "2026-10-09T00:00:00Z", database_writes: 0 } }] };
      return { rows: [] };
    }
    async end() { calls.push("end"); }
  }
  const report = await collectAudit({ connectionString: "postgres://example", ClientImpl: FakeClient });
  assert.equal(report.database_writes, 0);
  assert.deepEqual(calls.slice(0, 2), ["connect", "begin isolation level repeatable read read only"]);
  assert.ok(calls.includes("rollback"));
  assert.equal(calls.at(-1), "end");
});
