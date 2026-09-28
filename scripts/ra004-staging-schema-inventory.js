const fs = require("node:fs");
const path = require("node:path");
const { Client } = require("pg");
const { sha256 } = require("./lib/stable-json-hash");
const { ledgerRowsFingerprint } = require("./supabase-migration-selector");

const ROOT = path.resolve(__dirname, "..");
const EXPECTED_HOST = "aws-0-eu-west-3.pooler.supabase.com";
const EXPECTED_REF = "hxnrsyyqffztlvcrtgbf";
const OUTPUT = path.join(ROOT, "tmp", "ra004-staging-schema-inventory-20260927.json");

const PUBLIC_RELATIONS = Object.freeze([
  "approved_import_plans",
  "retailer_catalogue_apply_runs",
  "retailer_catalogue_child_plans",
  "retailer_catalogue_parent_plans",
  "retailer_catalogue_production_fixture_approvals",
  "retailer_catalogue_production_recovery_approvals",
  "retailer_catalogue_production_recovery_manifests",
  "retailer_control_state_evidence_v1",
  "retailer_offer_sync_batch_approvals",
  "retailer_offer_sync_reviewed_mixed_change_bindings",
  "retailers",
]);
const FUNCTION_SIGNATURES = Object.freeze([
  "public.read_ra004_staging_preflight_v1(text,text,text,integer,text,text,integer)",
  "public.read_retailer_control_state_v1(bigint,text,text,text,timestamptz,text[],integer,integer)",
  "public.write_retailer_control_state_evidence_v1(uuid,integer,text,bigint,boolean,text,text,text,text,timestamptz,timestamptz,timestamptz,text,text,jsonb,text,text)",
  "pg_catalog.gen_random_uuid()",
  "pg_catalog.sha256(bytea)",
]);
const ROLES = Object.freeze([
  "anon", "authenticated", "service_role",
  "retailer_catalogue_production_approver",
  "retailer_catalogue_production_executor",
  "retailer_catalogue_production_validator",
  "retailer_control_state_evidence_owner",
  "retailer_control_state_evidence_writer",
  "retailer_control_state_exporter",
  "retailer_control_state_read_owner",
  "ra004_staging_preflight_caller",
  "ra004_staging_preflight_owner",
]);

function assert(condition, code) {
  if (!condition) throw new Error(code);
}

function safeError(error) {
  const code = String(error?.code || "");
  return /^\w{2,10}$/.test(code) ? `RA004_INVENTORY_DATABASE_${code}` : "RA004_INVENTORY_FAILED";
}

async function collect(client) {
  const relations = (await client.query(`
    select n.nspname schema_name,c.relname object_name,c.relkind,
      pg_get_userbyid(c.relowner) owner,c.relrowsecurity rls_enabled,
      c.relforcerowsecurity rls_forced
    from pg_class c join pg_namespace n on n.oid=c.relnamespace
    where (n.nspname='public' and c.relname=any($1::text[]))
       or (n.nspname='supabase_migrations' and c.relname='schema_migrations')
    order by n.nspname,c.relname
  `, [PUBLIC_RELATIONS])).rows;

  const columns = (await client.query(`
    select n.nspname schema_name,c.relname object_name,a.attnum ordinal_position,
      a.attname column_name,format_type(a.atttypid,a.atttypmod) data_type,
      a.attnotnull not_null,pg_get_expr(d.adbin,d.adrelid) column_default,
      coll.collname collation
    from pg_attribute a join pg_class c on c.oid=a.attrelid
    join pg_namespace n on n.oid=c.relnamespace
    left join pg_attrdef d on d.adrelid=a.attrelid and d.adnum=a.attnum
    left join pg_collation coll on coll.oid=a.attcollation and a.attcollation<>0
    where a.attnum>0 and not a.attisdropped and (
      (n.nspname='public' and c.relname=any($1::text[]))
      or (n.nspname='supabase_migrations' and c.relname='schema_migrations'))
    order by n.nspname,c.relname,a.attnum
  `, [PUBLIC_RELATIONS])).rows;

  const constraints = (await client.query(`
    select n.nspname schema_name,c.relname object_name,con.conname constraint_name,
      con.contype constraint_type,pg_get_constraintdef(con.oid,true) definition
    from pg_constraint con join pg_class c on c.oid=con.conrelid
    join pg_namespace n on n.oid=c.relnamespace
    where n.nspname='public' and c.relname=any($1::text[])
    order by n.nspname,c.relname,con.conname
  `, [PUBLIC_RELATIONS])).rows;

  const indexes = (await client.query(`
    select n.nspname schema_name,t.relname object_name,i.relname index_name,
      ix.indisunique is_unique,ix.indisprimary is_primary,pg_get_indexdef(i.oid) definition
    from pg_index ix join pg_class t on t.oid=ix.indrelid
    join pg_namespace n on n.oid=t.relnamespace join pg_class i on i.oid=ix.indexrelid
    where n.nspname='public' and t.relname=any($1::text[])
    order by n.nspname,t.relname,i.relname
  `, [PUBLIC_RELATIONS])).rows;

  const sequences = (await client.query(`
    select ns.nspname schema_name,seq.relname sequence_name,
      tn.nspname owned_table_schema,t.relname owned_table,a.attname owned_column,
      pg_get_userbyid(seq.relowner) owner
    from pg_class seq join pg_namespace ns on ns.oid=seq.relnamespace
    left join pg_depend dep on dep.objid=seq.oid and dep.deptype in ('a','i')
    left join pg_class t on t.oid=dep.refobjid
    left join pg_namespace tn on tn.oid=t.relnamespace
    left join pg_attribute a on a.attrelid=t.oid and a.attnum=dep.refobjsubid
    where seq.relkind='S' and tn.nspname='public' and t.relname=any($1::text[])
    order by ns.nspname,seq.relname
  `, [PUBLIC_RELATIONS])).rows;

  const policies = (await client.query(`
    select n.nspname schema_name,c.relname object_name,p.polname policy_name,
      p.polpermissive permissive,p.polcmd command,
      (select jsonb_agg(pg_get_userbyid(role_oid) order by pg_get_userbyid(role_oid)) from unnest(p.polroles) role_oid) roles,
      pg_get_expr(p.polqual,p.polrelid) using_expression,
      pg_get_expr(p.polwithcheck,p.polrelid) check_expression
    from pg_policy p join pg_class c on c.oid=p.polrelid
    join pg_namespace n on n.oid=c.relnamespace
    where n.nspname='public' and c.relname=any($1::text[])
    order by n.nspname,c.relname,p.polname
  `, [PUBLIC_RELATIONS])).rows;

  const relationGrants = (await client.query(`
    select n.nspname schema_name,c.relname object_name,
      coalesce(r.rolname,'PUBLIC') grantee,acl.privilege_type,acl.is_grantable
    from pg_class c join pg_namespace n on n.oid=c.relnamespace
    cross join lateral aclexplode(coalesce(c.relacl,acldefault(case when c.relkind='S' then 's'::"char" else 'r'::"char" end,c.relowner))) acl
    left join pg_roles r on r.oid=acl.grantee
    where ((n.nspname='public' and c.relname=any($1::text[]))
      or (n.nspname='supabase_migrations' and c.relname='schema_migrations'))
    order by n.nspname,c.relname,grantee,acl.privilege_type
  `, [PUBLIC_RELATIONS])).rows;

  const functions = (await client.query(`
    with expected(signature) as (select unnest($1::text[]))
    select e.signature,p.oid is not null present,
      case when p.oid is null then null else pg_get_userbyid(p.proowner) end owner,
      case when p.oid is null then null else p.prosecdef end security_definer,
      case when p.oid is null then null else p.provolatile::text end volatility,
      case when p.oid is null then null else p.proconfig end configuration,
      case when p.oid is null then null else encode(sha256(convert_to(pg_get_functiondef(p.oid),'UTF8')),'hex') end definition_sha256
    from expected e left join pg_proc p on p.oid=to_regprocedure(e.signature)
    order by e.signature
  `, [FUNCTION_SIGNATURES])).rows;

  const functionGrants = (await client.query(`
    with expected(signature) as (select unnest($1::text[]))
    select e.signature,coalesce(r.rolname,'PUBLIC') grantee,acl.privilege_type,acl.is_grantable
    from expected e join pg_proc p on p.oid=to_regprocedure(e.signature)
    cross join lateral aclexplode(coalesce(p.proacl,acldefault('f',p.proowner))) acl
    left join pg_roles r on r.oid=acl.grantee
    order by e.signature,grantee,acl.privilege_type
  `, [FUNCTION_SIGNATURES])).rows;

  const roles = (await client.query(`
    with expected(role_name) as (select unnest($1::text[]))
    select e.role_name,r.oid is not null present,r.rolcanlogin,r.rolinherit,
      r.rolsuper,r.rolcreatedb,r.rolcreaterole,r.rolreplication,r.rolbypassrls,
      coalesce((select jsonb_agg(setting order by setting) from unnest(r.rolconfig) setting),'[]'::jsonb) configuration
    from expected e left join pg_roles r on r.rolname=e.role_name
    order by e.role_name
  `, [ROLES])).rows;

  const memberships = (await client.query(`
    select member_role.rolname member_role,granted_role.rolname granted_role,m.admin_option
    from pg_auth_members m join pg_roles member_role on member_role.oid=m.member
    join pg_roles granted_role on granted_role.oid=m.roleid
    where member_role.rolname=any($1::text[]) or granted_role.rolname=any($1::text[])
    order by member_role.rolname,granted_role.rolname
  `, [ROLES])).rows;

  const schemaGrants = (await client.query(`
    select n.nspname schema_name,coalesce(r.rolname,'PUBLIC') grantee,
      acl.privilege_type,acl.is_grantable
    from pg_namespace n
    cross join lateral aclexplode(coalesce(n.nspacl,acldefault('n',n.nspowner))) acl
    left join pg_roles r on r.oid=acl.grantee
    where n.nspname in ('public','supabase_migrations')
      and (coalesce(r.rolname,'PUBLIC')=any($1::text[]) or acl.grantee=0)
    order by n.nspname,grantee,acl.privilege_type
  `, [ROLES])).rows;

  const extensions = (await client.query(`
    select expected.extension_name,e.extname is not null present,e.extversion,
      n.nspname schema_name
    from (values ('pgcrypto')) expected(extension_name)
    left join pg_extension e on e.extname=expected.extension_name
    left join pg_namespace n on n.oid=e.extnamespace
  `)).rows;

  const ledger = (await client.query(`
    select version::text,name::text from supabase_migrations.schema_migrations
    order by version::text,name::text
  `)).rows;

  return {
    relations, columns, constraints, indexes, sequences, policies,
    relation_grants: relationGrants, functions, function_grants: functionGrants,
    roles, memberships, schema_grants: schemaGrants, extensions,
    ledger: {
      count: ledger.length,
      fingerprint: ledgerRowsFingerprint(ledger, { targetEnvironment: "STAGING" }),
      last_migration: ledger.length ? `${ledger.at(-1).version}_${ledger.at(-1).name}` : null,
    },
  };
}

async function main() {
  const databaseUrl = process.env.RA004_INVENTORY_DATABASE_URL;
  assert(databaseUrl, "RA004_INVENTORY_DATABASE_URL_MISSING");
  const parsed = new URL(databaseUrl);
  assert(parsed.protocol === "postgresql:" || parsed.protocol === "postgres:", "RA004_INVENTORY_PROTOCOL_REJECTED");
  assert(parsed.hostname === EXPECTED_HOST, "RA004_INVENTORY_HOST_REJECTED");
  assert(parsed.username.includes(EXPECTED_REF), "RA004_INVENTORY_PROJECT_REJECTED");

  const client = new Client({
    connectionString: databaseUrl,
    ssl: { rejectUnauthorized: false },
    application_name: "ra004-schema-inventory-read-only-v1",
  });
  let committed = false;
  try {
    await client.connect();
    await client.query("begin transaction read only isolation level repeatable read");
    await client.query("set local statement_timeout = '30s'");
    const inventory = await collect(client);
    await client.query("commit");
    committed = true;
    const report = {
      schema_version: "ra004-staging-schema-inventory-v1",
      target: { environment: "STAGING", project_ref: EXPECTED_REF, host: EXPECTED_HOST },
      transaction: { read_only: true, isolation: "REPEATABLE READ", committed: true },
      collected_at: new Date().toISOString(),
      ...inventory,
    };
    report.inventory_fingerprint = sha256(report);
    fs.mkdirSync(path.dirname(OUTPUT), { recursive: true });
    fs.writeFileSync(OUTPUT, `${JSON.stringify(report, null, 2)}\n`, { flag: "wx" });
    process.stdout.write(`${JSON.stringify({status:"RA004_STAGING_SCHEMA_INVENTORY_COMPLETE",output:OUTPUT,ledger:report.ledger,inventory_fingerprint:report.inventory_fingerprint})}\n`);
  } catch (error) {
    if (!committed) {
      try { await client.query("rollback"); } catch {}
    }
    throw new Error(safeError(error));
  } finally {
    process.env.RA004_INVENTORY_DATABASE_URL = "";
    await client.end().catch(() => {});
  }
}

if (require.main === module) {
  main().catch((error) => {
    process.stderr.write(`${error.message}\n`);
    process.exitCode = 1;
  });
}

module.exports = { EXPECTED_HOST, EXPECTED_REF, FUNCTION_SIGNATURES, PUBLIC_RELATIONS, ROLES, collect };
