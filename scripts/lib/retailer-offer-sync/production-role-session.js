const { Client } = require("pg");

function invariant(condition, message) {
  if (!condition) throw new Error(message);
}

function normalizeConnectionString(value, label) {
  invariant(value, `Missing protected ${label} database credential`);
  const parsed = new URL(value);
  parsed.searchParams.delete("sslmode");
  return parsed.href;
}

function assertIdentifier(value, label) {
  invariant(/^[a-z][a-z0-9_]*$/.test(value), `Invalid ${label}`);
  return value;
}

function assertSettingName(value) {
  invariant(/^[a-z][a-z0-9_]*(?:\.[a-z][a-z0-9_]*)+$/.test(value), "Invalid local setting");
  return value;
}

async function openPostgresClient({ connectionString, applicationName, ClientClass = Client, defaultReadOnly = false }) {
  const client = new ClientClass({
    connectionString,
    ssl: { rejectUnauthorized: false },
    application_name: applicationName,
    options: `${defaultReadOnly ? "-c default_transaction_read_only=on " : ""}-c statement_timeout=120000`,
  });
  await client.connect();
  return client;
}

async function runRoleTransaction(client, options, callback) {
  const role = assertIdentifier(options.role, "database role");
  const readOnly = options.readOnly === true;
  let transactionStarted = false;
  try {
    await client.query(readOnly ? "begin read only" : "begin");
    transactionStarted = true;
    for (const [key, value] of Object.entries(options.localSettings || {})) {
      await client.query("select set_config($1,$2,true)", [assertSettingName(key), String(value)]);
    }
    await client.query(`set local role ${role}`);
    const identity = (await client.query("select session_user, current_user, current_setting('transaction_read_only') transaction_read_only")).rows[0];
    invariant(identity.current_user === role, `${options.kind || role} role mismatch`);
    if (options.expectedSessionUser) invariant(identity.session_user === options.expectedSessionUser, `${options.kind || role} login mismatch`);
    if (readOnly) invariant(identity.transaction_read_only === "on", `${options.kind || role} transaction is not read-only`);
    const result = await callback(client, identity);
    await client.query("commit");
    transactionStarted = false;
    return { result, identity };
  } catch (error) {
    if (transactionStarted) {
      try { await client.query("rollback"); } catch (rollbackError) { error.rollbackError = rollbackError; }
    }
    throw error;
  }
}

async function withPostgresRoleSession(options, callback) {
  const client = await openPostgresClient(options);
  try {
    return await runRoleTransaction(client, options, callback);
  } finally {
    await client.end();
  }
}

module.exports = {
  normalizeConnectionString,
  openPostgresClient,
  runRoleTransaction,
  withPostgresRoleSession,
};
