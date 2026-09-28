const crypto = require("node:crypto");
const { Client } = require("pg");

const ownerUrl = process.env.RA004_OWNER_DATABASE_URL;
const projectRef = "hxnrsyyqffztlvcrtgbf";
const roles = new Map();

function qident(value) { return `"${value.replaceAll('"', '""')}"`; }
function loginUrl(role, password) {
  const parsed = new URL(ownerUrl);
  parsed.username = parsed.hostname.endsWith(".pooler.supabase.com") ? `${role}.${projectRef}` : role;
  parsed.password = password;
  return parsed.toString();
}
async function ownerQuery(text) {
  const client = new Client({ connectionString: ownerUrl, ssl: { rejectUnauthorized: true, servername: new URL(ownerUrl).hostname, minVersion: "TLSv1.2" }, application_name: "ra004-credential-issuer-v1" });
  try { await client.connect(); return await client.query(text); } finally { await client.end(); }
}
async function create(kind, expiresAt) {
  const profiles = {
    preflight: {
      role: "ra004_pf_20260927_a",
      signature: "public.read_ra004_staging_preflight_v1(text,text,text,integer,text,text,integer)",
      readOnly: true,
    },
    control: {
      role: "ra004_cs_20260927_b",
      signature: "public.read_retailer_control_state_v1(bigint,text,text,text,timestamptz,text[],integer,integer)",
      readOnly: true,
    },
    evidence: {
      role: "ra004_ev_20260928_c",
      signature: "public.write_retailer_control_state_evidence_v1(uuid,integer,text,bigint,boolean,text,text,text,text,timestamptz,timestamptz,timestamptz,text,text,jsonb,text,text)",
      readOnly: false,
    },
  };
  const profile = profiles[kind];
  if (!profile) throw new Error("RA004_ISSUER_KIND_INVALID");
  const { role, signature } = profile;
  const password = crypto.randomBytes(36).toString("base64url");
  const id = qident(role);
  await ownerQuery(`do $issuer$ begin
    if exists(select 1 from pg_roles where rolname='${role}') then raise exception 'RA004_ROLE_ALREADY_EXISTS'; end if;
    execute 'create role ${id} login noinherit nosuperuser nocreatedb nocreaterole noreplication nobypassrls connection limit 1 password ' || quote_literal('${password}') || ' valid until ' || quote_literal('${expiresAt}');
    execute 'alter role ${id} set default_transaction_read_only=${profile.readOnly ? "on" : "off"}';
    execute 'alter role ${id} set statement_timeout=''15s''';
    execute 'alter role ${id} set idle_in_transaction_session_timeout=''15s''';
    execute 'grant usage on schema public to ${id}';
    execute 'grant execute on function ${signature} to ${id}';
    if 1 <> (select count(*) from pg_auth_members membership
      join pg_roles member_role on member_role.oid=membership.member
      join pg_roles granted_role on granted_role.oid=membership.roleid
      join pg_roles grantor_role on grantor_role.oid=membership.grantor
      where member_role.rolname=current_user and granted_role.rolname='${role}'
        and membership.admin_option
        and not coalesce((to_jsonb(membership)->>'set_option')::boolean,true)
        and not coalesce((to_jsonb(membership)->>'inherit_option')::boolean,true)
        and grantor_role.rolsuper)
      or exists(select 1 from pg_auth_members membership
        join pg_roles member_role on member_role.oid=membership.member
        join pg_roles granted_role on granted_role.oid=membership.roleid
        where (member_role.rolname='${role}' or granted_role.rolname='${role}')
          and not (member_role.rolname=current_user and granted_role.rolname='${role}')) then
      raise exception 'RA004_ISSUER_MEMBERSHIP_DRIFT';
    end if;
  end $issuer$;`);
  roles.set(role, signature);
  const credentialId = kind === "evidence" ? "evidence-20260928-a" : `${kind}-20260927-a`;
  return { role, credential_id: credentialId, database_url: loginUrl(role, password), issued_at: new Date().toISOString(), expires_at: expiresAt, issuer_process_id: process.pid };
}
async function revoke(role, runnerProcessId) {
  if (!roles.has(role)) throw new Error("RA004_ISSUER_UNKNOWN_ROLE");
  const id = qident(role);
  const signature = roles.get(role);
  await ownerQuery(`do $issuer$ begin
    execute 'alter role ${id} nologin';
    perform pg_terminate_backend(pid) from pg_stat_activity where usename='${role}' and pid<>pg_backend_pid();
    execute 'revoke execute on function ${signature} from ${id}';
    execute 'revoke usage on schema public from ${id}';
    execute 'drop role ${id}';
  end $issuer$;`);
  const verification = await ownerQuery(`select not exists(select 1 from pg_roles where rolname='${role}') role_absent`);
  if (verification.rows[0]?.role_absent !== true) throw new Error("RA004_ROLE_REVOKE_UNVERIFIED");
  roles.delete(role);
  const kind = role.startsWith("ra004_pf_") ? "preflight" : role.startsWith("ra004_cs_") ? "control" : "evidence";
  const credentialId = kind === "evidence" ? "evidence-20260928-a" : `${kind}-20260927-a`;
  return { access_revoked: true, credential_id: credentialId, issuer_process_id: process.pid, runner_process_id: runnerProcessId };
}
process.on("message", async (message) => {
  try {
    const result = message.action === "create" ? await create(message.kind, message.expires_at) : await revoke(message.role, message.runner_process_id);
    process.send({ request_id: message.request_id, ok: true, result });
  } catch (error) { process.send({ request_id: message.request_id, ok: false, error: String(error.message).slice(0, 200) }); }
});
