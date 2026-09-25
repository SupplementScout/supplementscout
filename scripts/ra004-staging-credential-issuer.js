const crypto = require("node:crypto");
const { Client } = require("pg");

const ownerUrl = process.env.RA004_OWNER_DATABASE_URL;
const projectRef = "hxnrsyyqffztlvcrtgbf";
const roles = new Set();

function qident(value) { return `"${value.replaceAll('"', '""')}"`; }
function loginUrl(role, password) {
  const parsed = new URL(ownerUrl);
  parsed.username = parsed.hostname.endsWith(".pooler.supabase.com") ? `${role}.${projectRef}` : role;
  parsed.password = password;
  return parsed.toString();
}
async function ownerQuery(text) {
  const client = new Client({ connectionString: ownerUrl, ssl: { rejectUnauthorized: false }, application_name: "ra004-credential-issuer-v1" });
  try { await client.connect(); return await client.query(text); } finally { await client.end(); }
}
async function create(kind, expiresAt) {
  const role = kind === "preflight" ? "ra004_pf_20260925_a" : "ra004_cs_20260925_b";
  const signature = kind === "preflight"
    ? "public.read_ra004_staging_preflight_v1(text,text,text,integer,text,text,integer)"
    : "public.read_retailer_control_state_v1(bigint,text,text,text,timestamptz,text[],integer,integer)";
  const password = crypto.randomBytes(36).toString("base64url");
  const id = qident(role);
  await ownerQuery(`do $issuer$ begin
    if exists(select 1 from pg_roles where rolname='${role}') then raise exception 'RA004_ROLE_ALREADY_EXISTS'; end if;
    execute 'create role ${id} login noinherit nosuperuser nocreatedb nocreaterole noreplication nobypassrls connection limit 1 password ' || quote_literal('${password}') || ' valid until ' || quote_literal('${expiresAt}');
    execute 'alter role ${id} set default_transaction_read_only=on';
    execute 'alter role ${id} set statement_timeout=''15s''';
    execute 'alter role ${id} set idle_in_transaction_session_timeout=''15s''';
    execute 'grant usage on schema public to ${id}';
    execute 'grant execute on function ${signature} to ${id}';
  end $issuer$;`);
  roles.add(role);
  return { role, credential_id: `${kind}-20260925-a`, database_url: loginUrl(role, password), issued_at: new Date().toISOString(), expires_at: expiresAt, issuer_process_id: process.pid };
}
async function revoke(role, runnerProcessId) {
  if (!roles.has(role)) throw new Error("RA004_ISSUER_UNKNOWN_ROLE");
  const id = qident(role);
  await ownerQuery(`do $issuer$ begin
    execute 'alter role ${id} nologin';
    perform pg_terminate_backend(pid) from pg_stat_activity where usename='${role}' and pid<>pg_backend_pid();
    execute 'revoke all privileges on all tables in schema public from ${id}';
    execute 'revoke all privileges on all sequences in schema public from ${id}';
    execute 'revoke execute on all functions in schema public from ${id}';
    execute 'revoke usage on schema public from ${id}';
    execute 'drop role ${id}';
  end $issuer$;`);
  const verification = await ownerQuery(`select not exists(select 1 from pg_roles where rolname='${role}') role_absent`);
  if (verification.rows[0]?.role_absent !== true) throw new Error("RA004_ROLE_REVOKE_UNVERIFIED");
  roles.delete(role);
  return { access_revoked: true, credential_id: role.startsWith("ra004_pf_") ? "preflight-20260925-a" : "control-20260925-a", issuer_process_id: process.pid, runner_process_id: runnerProcessId };
}
process.on("message", async (message) => {
  try {
    const result = message.action === "create" ? await create(message.kind, message.expires_at) : await revoke(message.role, message.runner_process_id);
    process.send({ request_id: message.request_id, ok: true, result });
  } catch (error) { process.send({ request_id: message.request_id, ok: false, error: String(error.message).slice(0, 200) }); }
});
