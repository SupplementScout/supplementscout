const { Client } = require("pg");

async function main() {
  const databaseUrl = process.env.RA004_REVOKED_DATABASE_URL;
  if (!databaseUrl) throw new Error("RA004_REVOKE_TARGET_MISSING");
  const client = new Client({
    connectionString: databaseUrl,
    ssl: { rejectUnauthorized: false },
    application_name: "ra004-revocation-verifier-v1",
    connectionTimeoutMillis: 8_000,
  });
  let rejected = false;
  try {
    await client.connect();
  } catch (error) {
    rejected = error?.code === "28P01" || error?.code === "28000";
  } finally {
    try { await client.end(); } catch {}
    process.env.RA004_REVOKED_DATABASE_URL = "";
  }
  if (!rejected) throw new Error("RA004_REVOKED_CREDENTIAL_RECONNECTED");
  process.send({ ok: true, result: { reconnect_rejected: true, attempts: 1 } });
}

main().catch((error) => {
  process.send({ ok: false, error: String(error.message).slice(0, 120) });
});
