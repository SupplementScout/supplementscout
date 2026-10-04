#!/usr/bin/env node
const crypto = require("node:crypto");
const fs = require("node:fs");
const path = require("node:path");
const { Client } = require("pg");
const { loadEnvFile } = require("./apply-selected-migrations");
const {
  CONTRACTS,
  ledgerRowsFingerprint,
  validateDatabaseOwner,
} = require("./supabase-migration-selector");
const { validateOwnerUrl } = require("./ra-stab-01-control-plan-credential-issuer");

const ROOT = path.resolve(__dirname, "..");
const PRODUCTION = CONTRACTS.PRODUCTION;
const RPC = "public.get_retailer_catalogue_plan_status(uuid)";
const OUTPUT_ROOT = path.join(ROOT, "tmp", "control-plan-readbacks");

const ACL_INVENTORY_SQL = `
with public_database_acl as (
  select d.datname object_name,a.privilege_type,a.is_grantable
  from pg_database d
  cross join lateral aclexplode(coalesce(d.datacl,acldefault('d',d.datdba))) a
  where d.datname=current_database() and a.grantee=0
), public_schema_acl as (
  select n.nspname schema_name,a.privilege_type,a.is_grantable
  from pg_namespace n
  cross join lateral aclexplode(coalesce(n.nspacl,acldefault('n',n.nspowner))) a
  where a.grantee=0 and n.nspname not like 'pg\\_%' escape '\\'
    and n.nspname<>'information_schema'
), public_relation_acl as (
  select n.nspname schema_name,c.relname object_name,c.relkind::text object_kind,
    a.privilege_type,a.is_grantable
  from pg_class c join pg_namespace n on n.oid=c.relnamespace
  cross join lateral aclexplode(coalesce(c.relacl,acldefault(
    case when c.relkind='S' then 'S'::"char" else 'r'::"char" end,c.relowner))) a
  where a.grantee=0 and c.relkind in ('r','p','v','m','f','S')
    and n.nspname not in ('pg_catalog','information_schema')
    and n.nspname not like 'pg\\_%' escape '\\'
), public_function_acl as (
  select n.nspname schema_name,p.proname object_name,
    pg_get_function_identity_arguments(p.oid) identity_arguments,
    pg_get_userbyid(p.proowner) owner,p.prosecdef security_definer,
    p.provolatile::text volatility,p.proconfig,
    a.privilege_type,a.is_grantable
  from pg_proc p join pg_namespace n on n.oid=p.pronamespace
  cross join lateral aclexplode(coalesce(p.proacl,acldefault('f',p.proowner))) a
  where a.grantee=0 and n.nspname not in ('pg_catalog','information_schema')
    and n.nspname not like 'pg\\_%' escape '\\'
), public_default_acl as (
  select coalesce(n.nspname,'*') schema_name,pg_get_userbyid(d.defaclrole) owner,
    d.defaclobjtype::text object_kind,a.privilege_type,a.is_grantable
  from pg_default_acl d left join pg_namespace n on n.oid=d.defaclnamespace
  cross join lateral aclexplode(d.defaclacl) a where a.grantee=0
)
select jsonb_build_object(
  'database_public_acl',coalesce((select jsonb_agg(to_jsonb(x) order by privilege_type) from public_database_acl x),'[]'::jsonb),
  'schema_public_acl',coalesce((select jsonb_agg(to_jsonb(x) order by schema_name,privilege_type) from public_schema_acl x),'[]'::jsonb),
  'relation_public_acl',coalesce((select jsonb_agg(to_jsonb(x) order by schema_name,object_name,privilege_type) from public_relation_acl x),'[]'::jsonb),
  'function_public_acl',coalesce((select jsonb_agg(to_jsonb(x) order by schema_name,object_name,identity_arguments,privilege_type) from public_function_acl x),'[]'::jsonb),
  'default_public_acl',coalesce((select jsonb_agg(to_jsonb(x) order by schema_name,owner,object_kind,privilege_type) from public_default_acl x),'[]'::jsonb)
) inventory`;

function invariant(value, code) { if (!value) throw new Error(code); }
function canonical(value) {
  if (Array.isArray(value)) return `[${value.map(canonical).join(",")}]`;
  if (value && typeof value === "object") return `{${Object.keys(value).sort().map(
    key => `${JSON.stringify(key)}:${canonical(value[key])}`).join(",")}}`;
  return JSON.stringify(value);
}
function sha256(value) { return crypto.createHash("sha256").update(value).digest("hex"); }

function classifyInventory(inventory) {
  const publicSchema = inventory.schema_public_acl.filter(
    row => row.schema_name === "public" && row.privilege_type === "USAGE");
  const reachableSecurityDefiners = inventory.function_public_acl.filter(row =>
    row.schema_name === "public" && row.privilege_type === "EXECUTE" && row.security_definer);
  return {
    public_schema_usage_inherited: publicSchema.length > 0,
    public_relation_privilege_count: inventory.relation_public_acl.length,
    public_sequence_privilege_count: inventory.relation_public_acl.filter(row => row.object_kind === "S").length,
    public_security_definer_execute_count: reachableSecurityDefiners.length,
    public_security_definer_signatures: reachableSecurityDefiners.map(
      row => `${row.schema_name}.${row.object_name}(${row.identity_arguments})`).sort(),
    public_function_default_execute: inventory.default_public_acl.some(
      row => row.object_kind === "f" && row.privilege_type === "EXECUTE"),
  };
}

function parseArgs(argv) {
  invariant(argv.length === 1 && argv[0].startsWith("--output="), "RA_STAB_ACL_ARGUMENTS_INVALID");
  const output = path.resolve(argv[0].slice("--output=".length));
  const relative = path.relative(OUTPUT_ROOT, output);
  invariant(relative && !relative.startsWith("..") && !path.isAbsolute(relative), "RA_STAB_ACL_OUTPUT_INVALID");
  return { output };
}

function ownerUrl(env = process.env) {
  const file = path.join(env.USERPROFILE || "", ".supplementscout", "credentials", "production-owner.env");
  return validateOwnerUrl(loadEnvFile(file)[PRODUCTION.databaseUrlEnvironmentKey]);
}

function writeOnce(output, report) {
  const bytes = Buffer.from(`${JSON.stringify(report, null, 2)}\n`);
  const digest = sha256(bytes);
  const digestPath = `${output}.sha256`;
  invariant(!fs.existsSync(output) && !fs.existsSync(digestPath), "RA_STAB_ACL_OUTPUT_EXISTS");
  fs.mkdirSync(path.dirname(output), { recursive: true });
  fs.writeFileSync(output, bytes, { flag: "wx", mode: 0o600 });
  try { fs.writeFileSync(digestPath, `${digest}  ${path.basename(output)}\n`, { flag: "wx", mode: 0o600 }); }
  catch (error) { fs.unlinkSync(output); throw error; }
  return { output, sha256: digest, digest_path: digestPath };
}

async function capture({ databaseUrl, ClientClass = Client, now = () => new Date().toISOString() }) {
  const parsed = new URL(databaseUrl);
  const db = new ClientClass({ connectionString: databaseUrl,
    ssl: { rejectUnauthorized: true, servername: parsed.hostname, minVersion: "TLSv1.2" },
    application_name: "ra-stab-central-acl-inventory-v1", connectionTimeoutMillis: 10_000,
    query_timeout: 30_000, options: "-c default_transaction_read_only=on -c statement_timeout=30000" });
  let open = false;
  try {
    await db.connect();
    await db.query("begin isolation level repeatable read read only"); open = true;
    const identity = (await db.query(`select current_user,current_database(),
      current_setting('transaction_read_only') read_only,current_setting('app.safe_update',true) safe_update`)).rows[0];
    validateDatabaseOwner(PRODUCTION, identity);
    invariant(identity.current_database === "postgres" && identity.read_only === "on", "RA_STAB_ACL_IDENTITY_INVALID");
    const target = (await db.query("select public.retailer_catalogue_actual_database_target() target")).rows[0]?.target;
    invariant(target?.target_environment === "PRODUCTION" && target?.project_ref === PRODUCTION.projectRef
      && target?.database_identity === PRODUCTION.databaseIdentity, "RA_STAB_ACL_TARGET_INVALID");
    const ledger = (await db.query("select version,name from supabase_migrations.schema_migrations order by version")).rows;
    invariant(ledger.length === PRODUCTION.ledgerCount
      && ledgerRowsFingerprint(ledger, { targetEnvironment: "PRODUCTION" }) === PRODUCTION.ledgerFingerprint,
    "RA_STAB_ACL_LEDGER_DRIFT");
    const rpc = (await db.query(`select pg_get_userbyid(p.proowner) owner,p.provolatile::text volatility,
      p.prosecdef security_definer,p.proconfig,encode(digest(pg_get_functiondef(p.oid),'sha256'),'hex') definition_sha256,
      has_function_privilege('public',$1::regprocedure,'EXECUTE') public_execute
      from pg_proc p where p.oid=$1::regprocedure`, [RPC])).rows[0];
    invariant(rpc?.owner === "postgres" && rpc.volatility === "s" && rpc.security_definer === true
      && rpc.public_execute === false, "RA_STAB_ACL_RPC_DRIFT");
    const inventory = (await db.query(ACL_INVENTORY_SQL)).rows[0]?.inventory;
    invariant(inventory && Object.values(inventory).every(Array.isArray), "RA_STAB_ACL_INVENTORY_INVALID");
    await db.query("rollback"); open = false;
    const classification = classifyInventory(inventory);
    const payload = { target, rpc, inventory, classification };
    return {
      schema_version: "ra-stab-central-acl-inventory-v1",
      status: "READ_ONLY_COMPLETE",
      captured_at: now(),
      target: { environment: "PRODUCTION", project_ref: PRODUCTION.projectRef,
        database_identity: PRODUCTION.databaseIdentity },
      transaction: "REPEATABLE READ READ ONLY",
      connection_attempts: 1,
      retries: 0,
      writes: 0,
      ...payload,
      inventory_fingerprint: sha256(`RA-STAB:CENTRAL-ACL-INVENTORY:1\n${canonical(payload)}`),
    };
  } finally {
    if (open) await db.query("rollback").catch(() => {});
    await db.end().catch(() => {});
  }
}

async function main(argv = process.argv.slice(2)) {
  const { output } = parseArgs(argv);
  const report = await capture({ databaseUrl: ownerUrl() });
  process.stdout.write(`${JSON.stringify(writeOnce(output, report))}\n`);
}

if (require.main === module) main().catch(error => {
  process.stderr.write(`${String(error.message).replace(/postgres(?:ql)?:\/\/[^\s]+/gi, "[REDACTED_DATABASE_URL]")}\n`);
  process.exitCode = 1;
});

module.exports = { ACL_INVENTORY_SQL, OUTPUT_ROOT, capture, classifyInventory, parseArgs, writeOnce };
