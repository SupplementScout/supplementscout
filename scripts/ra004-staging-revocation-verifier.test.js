const assert = require("node:assert/strict");
const test = require("node:test");

const {
  REVOKE_PROBE_SQL,
  verifyRevokedCredential,
} = require("./ra004-staging-revocation-verifier");

function pgError(code, message = "authentication rejected") {
  return Object.assign(new Error(message), { code });
}

function fakeClients({ connectError, queryError, ownerConnectError, ownerRow = {} } = {}) {
  const calls = [];
  const revokedClient = {
    async connect() {
      calls.push(["revoked.connect"]);
      if (connectError) throw connectError;
    },
    async query(sql) {
      calls.push(["revoked.query", sql]);
      if (queryError) throw queryError;
      return { rows: [{ current_user: "revoked-role" }] };
    },
    async end() { calls.push(["revoked.end"]); },
  };
  const ownerClient = {
    async connect() {
      calls.push(["owner.connect"]);
      if (ownerConnectError) throw ownerConnectError;
    },
    async query(sql, params) {
      calls.push(["owner.query", sql, params]);
      return { rows: [{ role_present: false, membership_present: false, active_backend_present: false, ...ownerRow }] };
    },
    async end() { calls.push(["owner.end"]); },
  };
  return { calls, createRevokedClient: () => revokedClient, createOwnerClient: () => ownerClient };
}

const input = {
  revokedDatabaseUrl: "postgresql://revoked:secret@staging.invalid:5432/postgres",
  ownerDatabaseUrl: "postgresql://owner:secret@staging.invalid:5432/postgres",
  revokedRole: "ra004_pf_test_a",
};

test("pooler handshake accepted and first allowlisted query rejected is a safe PASS", async () => {
  const fakes = fakeClients({ queryError: pgError("28P01") });
  const result = await verifyRevokedCredential({ ...input, ...fakes });
  assert.equal(result.outcome_code, "RA004_REVOKE_POOLER_HANDSHAKE_QUERY_REJECTED");
  assert.equal(result.revoked_query_attempts, 1);
  assert.equal(fakes.calls.filter(([name]) => name === "revoked.query").length, 1);
  assert.equal(fakes.calls.find(([name]) => name === "revoked.query")[1], REVOKE_PROBE_SQL);
});

test("authentication rejection during connect is a safe PASS", async () => {
  const fakes = fakeClients({ connectError: pgError("28P01") });
  const result = await verifyRevokedCredential({ ...input, ...fakes });
  assert.equal(result.outcome_code, "RA004_REVOKE_AUTH_REJECTED");
  assert.equal(result.revoked_query_attempts, 0);
});

test("Supavisor rejection without SQLSTATE still performs catalogue readback before PASS", async () => {
  const fakes = fakeClients({ connectError: new Error("Tenant or user not found") });
  const result = await verifyRevokedCredential({ ...input, ...fakes });
  assert.equal(result.outcome_code, "RA004_REVOKE_CONNECTION_REJECTED_CATALOGUE_CONFIRMED");
  assert.equal(result.revoked_query_attempts, 0);
  assert.equal(fakes.calls.filter(([name]) => name === "owner.query").length, 1);
  assert.equal(result.role_absent, true);
  assert.equal(result.membership_absent, true);
  assert.equal(result.active_backend_absent, true);
  assert.doesNotMatch(JSON.stringify(result), /Tenant|user not found|secret/);
});

test("successful query through a revoked credential is a hard FAIL", async () => {
  const fakes = fakeClients();
  await assert.rejects(
    verifyRevokedCredential({ ...input, ...fakes }),
    /RA004_REVOKED_CREDENTIAL_QUERY_SUCCEEDED/,
  );
  assert.equal(fakes.calls.filter(([name]) => name === "owner.query").length, 1);
});

test("pooler handshake followed by a non-SQLSTATE query rejection passes only with catalogue proof", async () => {
  const fakes = fakeClients({ queryError: new Error("upstream connection terminated") });
  const result = await verifyRevokedCredential({ ...input, ...fakes });
  assert.equal(result.outcome_code, "RA004_REVOKE_POOLER_HANDSHAKE_QUERY_REJECTED_CATALOGUE_CONFIRMED");
  assert.equal(result.revoked_query_attempts, 1);
  assert.equal(fakes.calls.filter(([name]) => name === "owner.query").length, 1);
});

for (const [field, code] of [
  ["role_present", "RA004_REVOKE_ROLE_STILL_PRESENT"],
  ["membership_present", "RA004_REVOKE_MEMBERSHIP_STILL_PRESENT"],
  ["active_backend_present", "RA004_REVOKE_ACTIVE_BACKEND_PRESENT"],
]) {
  test(`${field} is a hard FAIL`, async () => {
    const fakes = fakeClients({ connectError: new Error("Tenant or user not found"), ownerRow: { [field]: true } });
    await assert.rejects(verifyRevokedCredential({ ...input, ...fakes }), new RegExp(code));
  });
}

test("unexpected connection or query failures remain fail-closed when catalogue proof is unavailable", async () => {
  await assert.rejects(
    verifyRevokedCredential({ ...input, ...fakeClients({
      connectError: pgError("08006"),
      ownerConnectError: pgError("08006"),
    }) }),
    /RA004_REVOKE_CATALOGUE_UNVERIFIED/,
  );
  await assert.rejects(
    verifyRevokedCredential({ ...input, ...fakeClients({
      queryError: pgError("08006"),
      ownerConnectError: pgError("08006"),
    }) }),
    /RA004_REVOKE_CATALOGUE_UNVERIFIED/,
  );
});

test("the common verifier accepts the bounded evidence-writer role namespace", async () => {
  const fakes = fakeClients({ connectError: pgError("28P01") });
  const result = await verifyRevokedCredential({
    ...input,
    revokedRole: "ra004_ev_test_c",
    ...fakes,
  });
  assert.equal(result.outcome_code, "RA004_REVOKE_AUTH_REJECTED");
});
