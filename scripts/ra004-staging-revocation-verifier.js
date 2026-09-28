const { Client } = require("pg");

const AUTH_REJECTION_CODES = new Set(["28P01", "28000", "42704"]);
const REVOKE_PROBE_SQL = "select current_user::text as current_user";
const REVOKE_CATALOGUE_SQL = `select
  exists(select 1 from pg_catalog.pg_roles where rolname=$1) as role_present,
  exists(
    select 1
    from pg_catalog.pg_auth_members membership
    join pg_catalog.pg_roles member_role on member_role.oid=membership.member
    join pg_catalog.pg_roles granted_role on granted_role.oid=membership.roleid
    where member_role.rolname=$1 or granted_role.rolname=$1
  ) as membership_present,
  exists(select 1 from pg_catalog.pg_stat_activity where usename=$1) as active_backend_present`;

function invariant(condition, code) {
  if (!condition) throw new Error(code);
}

function verifiedClient(databaseUrl, applicationName) {
  const parsed = new URL(databaseUrl);
  invariant(parsed.protocol === "postgres:" || parsed.protocol === "postgresql:", "RA004_REVOKE_TARGET_INVALID");
  return new Client({
    connectionString: databaseUrl,
    ssl: { rejectUnauthorized: true, servername: parsed.hostname, minVersion: "TLSv1.2" },
    application_name: applicationName,
    connectionTimeoutMillis: 8_000,
    query_timeout: 8_000,
  });
}

function isAuthRejection(error) {
  return AUTH_REJECTION_CODES.has(error?.code);
}

async function probeRevokedCredential(client) {
  let connected = false;
  try {
    try {
      await client.connect();
      connected = true;
    } catch (error) {
      if (isAuthRejection(error)) {
        return { probe_outcome: "AUTH_REJECTED", revoked_query_attempts: 0 };
      }
      return { probe_outcome: "CONNECTION_REJECTED", revoked_query_attempts: 0 };
    }

    try {
      await client.query(REVOKE_PROBE_SQL);
      return { probe_outcome: "QUERY_SUCCEEDED", revoked_query_attempts: 1 };
    } catch (error) {
      if (isAuthRejection(error)) {
        return { probe_outcome: "QUERY_AUTH_REJECTED", revoked_query_attempts: 1 };
      }
      return { probe_outcome: "QUERY_REJECTED", revoked_query_attempts: 1 };
    }
  } finally {
    if (connected) {
      try { await client.end(); } catch {}
    }
  }
}

async function readbackRevocation(client, revokedRole) {
  try {
    await client.connect();
    const result = await client.query(REVOKE_CATALOGUE_SQL, [revokedRole]);
    invariant(result.rows.length === 1, "RA004_REVOKE_CATALOGUE_RESPONSE_INVALID");
    const row = result.rows[0];
    invariant(row.role_present === false, "RA004_REVOKE_ROLE_STILL_PRESENT");
    invariant(row.membership_present === false, "RA004_REVOKE_MEMBERSHIP_STILL_PRESENT");
    invariant(row.active_backend_present === false, "RA004_REVOKE_ACTIVE_BACKEND_PRESENT");
    return { role_absent: true, membership_absent: true, active_backend_absent: true };
  } catch (error) {
    if (String(error?.message || "").startsWith("RA004_")) throw error;
    throw new Error("RA004_REVOKE_CATALOGUE_UNVERIFIED");
  } finally {
    try { await client.end(); } catch {}
  }
}

async function verifyRevokedCredential({
  revokedDatabaseUrl,
  ownerDatabaseUrl,
  revokedRole,
  createRevokedClient = () => verifiedClient(revokedDatabaseUrl, "ra004-revoked-query-probe-v2"),
  createOwnerClient = () => verifiedClient(ownerDatabaseUrl, "ra004-revoke-catalogue-readback-v2"),
}) {
  invariant(Boolean(revokedDatabaseUrl && ownerDatabaseUrl), "RA004_REVOKE_TARGET_MISSING");
  invariant(/^ra004_(?:pf|cs|ev)_[a-z0-9_]+$/.test(revokedRole), "RA004_REVOKE_ROLE_INVALID");

  const probe = await probeRevokedCredential(createRevokedClient());
  const catalogue = await readbackRevocation(createOwnerClient(), revokedRole);
  invariant(probe.probe_outcome !== "QUERY_SUCCEEDED", "RA004_REVOKED_CREDENTIAL_QUERY_SUCCEEDED");
  const outcomeCodes = {
    AUTH_REJECTED: "RA004_REVOKE_AUTH_REJECTED",
    CONNECTION_REJECTED: "RA004_REVOKE_CONNECTION_REJECTED_CATALOGUE_CONFIRMED",
    QUERY_AUTH_REJECTED: "RA004_REVOKE_POOLER_HANDSHAKE_QUERY_REJECTED",
    QUERY_REJECTED: "RA004_REVOKE_POOLER_HANDSHAKE_QUERY_REJECTED_CATALOGUE_CONFIRMED",
  };
  const outcomeCode = outcomeCodes[probe.probe_outcome];
  invariant(Boolean(outcomeCode), "RA004_REVOKE_PROBE_OUTCOME_INVALID");
  return {
    outcome_code: outcomeCode,
    revoked_query_attempts: probe.revoked_query_attempts,
    ...catalogue,
    revoked_connect_attempts: 1,
    catalogue_readback_attempts: 1,
  };
}

async function main() {
  const revokedDatabaseUrl = process.env.RA004_REVOKED_DATABASE_URL;
  const ownerDatabaseUrl = process.env.RA004_OWNER_DATABASE_URL;
  const revokedRole = process.env.RA004_REVOKED_ROLE;
  try {
    const result = await verifyRevokedCredential({ revokedDatabaseUrl, ownerDatabaseUrl, revokedRole });
    process.send({ ok: true, result });
  } finally {
    process.env.RA004_REVOKED_DATABASE_URL = "";
    process.env.RA004_OWNER_DATABASE_URL = "";
    process.env.RA004_REVOKED_ROLE = "";
  }
}

if (require.main === module) {
  main().catch((error) => {
    const code = String(error?.message || "RA004_REVOKE_UNEXPECTED_FAILURE");
    process.send({ ok: false, error: /^RA004_[A-Z0-9_]+$/.test(code) ? code : "RA004_REVOKE_UNEXPECTED_FAILURE" });
  });
}

module.exports = {
  AUTH_REJECTION_CODES,
  REVOKE_CATALOGUE_SQL,
  REVOKE_PROBE_SQL,
  isAuthRejection,
  verifyRevokedCredential,
};
