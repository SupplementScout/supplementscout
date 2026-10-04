const assert = require("node:assert/strict");
const path = require("node:path");
const { spawnSync } = require("node:child_process");
const test = require("node:test");
const { Client } = require("pg");
const { ROLE, RPC, revokeCredential, scram } = require("./ra-stab-01-control-plan-credential-issuer");

const ROOT = path.resolve(__dirname, "..");
const IMAGE = "postgres:17-alpine";
const PASSWORD = "ra-stab-local-lifecycle-only";

function run(command, args, timeout = 120_000) {
  return spawnSync(command, args, { cwd: ROOT, encoding: "utf8", timeout, windowsHide: true });
}
function ok(result, label) {
  assert.equal(result.status, 0, `${label}\n${result.stdout}\n${result.stderr}`);
  return result.stdout.trim();
}
function docker(container, args) { return run("docker", ["exec", container, ...args]); }

class LocalClient extends Client {
  constructor(config) { super({ ...config, ssl: false }); }
}

test("ephemeral credential lifecycle commits revoke before a forced DROP ROLE failure", { timeout: 120_000 }, async () => {
  const container = `supplementscout-ra-stab-credential-${process.pid}-${Date.now()}`;
  ok(run("docker", ["run", "--detach", "--rm", "--name", container,
    "-e", `POSTGRES_PASSWORD=${PASSWORD}`, "-p", "127.0.0.1::5432", IMAGE]), "start PostgreSQL");
  let owner;
  let ephemeral;
  let failure;
  try {
    for (let attempt = 0; attempt < 40; attempt += 1) {
      if (docker(container, ["pg_isready", "-U", "postgres"]).status === 0) break;
      Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, 250);
    }
    const mapping = ok(run("docker", ["port", container, "5432/tcp"]), "read mapped PostgreSQL port");
    const port = Number(mapping.match(/:(\d+)$/)?.[1]);
    assert.ok(Number.isSafeInteger(port) && port > 0, mapping);
    const ownerUrl = `postgresql://postgres:${PASSWORD}@127.0.0.1:${port}/postgres`;
    owner = new LocalClient({ connectionString: ownerUrl });
    await owner.connect();
    const loginPassword = "local-ephemeral-password";
    const verifier = scram(loginPassword, Buffer.alloc(18, 7));
    await owner.query(`
      create function public.get_retailer_catalogue_plan_status(uuid) returns jsonb
        language sql stable security definer set search_path=pg_catalog,public,pg_temp
        as $$ select '{"ok":true}'::jsonb $$;
      revoke all on function ${RPC} from public;
      create role ${ROLE} login noinherit nosuperuser nocreatedb nocreaterole noreplication nobypassrls
        connection limit 1 password '${verifier}' valid until '2099-01-01 00:00:00+00';
      alter role ${ROLE} set default_transaction_read_only=on;
      alter role ${ROLE} set statement_timeout='15s';
      alter role ${ROLE} set lock_timeout='5s';
      alter role ${ROLE} set idle_in_transaction_session_timeout='15s';
      alter role ${ROLE} set idle_session_timeout='1min';
      grant usage on schema public to ${ROLE};
      grant execute on function ${RPC} to ${ROLE};
      create table public.ra_stab_owned_dependency(id integer);
      alter table public.ra_stab_owned_dependency owner to ${ROLE};
    `);
    ephemeral = new LocalClient({
      connectionString: `postgresql://${ROLE}:${loginPassword}@127.0.0.1:${port}/postgres`,
    });
    ephemeral.on("error", () => {});
    await ephemeral.connect();
    const session = (await ephemeral.query(`select current_setting('transaction_read_only') read_only,
      public.get_retailer_catalogue_plan_status('00000000-0000-0000-0000-000000000000') data`)).rows[0];
    assert.equal(session.read_only, "on");
    assert.deepEqual(session.data, { ok: true });

    const residual = await revokeCredential({ role: ROLE, runner_process_id: process.pid }, {
      ownerUrl, ClientClass: LocalClient, delay: milliseconds => new Promise(resolve => setTimeout(resolve, milliseconds)),
    });
    assert.equal(residual.access_revoked, true);
    assert.equal(residual.role_absent, false);
    assert.equal(residual.login_disabled, true);
    assert.equal(residual.backend_absent, true);
    assert.equal(residual.target_execute_absent, true);
    assert.equal(residual.schema_usage_direct_absent, true);
    assert.equal(residual.cleanup_status, "ACCESS_REVOKED_RESIDUAL_ROLE");

    const role = (await owner.query("select rolcanlogin,rolvaliduntil<=now() expired from pg_roles where rolname=$1", [ROLE])).rows[0];
    assert.deepEqual(role, { rolcanlogin: false, expired: true });
    await owner.query("drop table public.ra_stab_owned_dependency");
    const dropped = await revokeCredential({ role: ROLE, runner_process_id: process.pid }, {
      ownerUrl, ClientClass: LocalClient, delay: () => Promise.resolve(),
    });
    assert.equal(dropped.cleanup_status, "ROLE_DROPPED");
    assert.equal(dropped.role_absent, true);
  } catch (error) { failure = error; }
  finally {
    await ephemeral?.end().catch(() => {});
    await owner?.end().catch(() => {});
    run("docker", ["rm", "--force", container], 30_000);
  }
  if (failure) throw failure;
});
