const assert = require("node:assert/strict");
const crypto = require("node:crypto");
const { spawnSync } = require("node:child_process");
const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");
const { waitForStablePostgres } = require("./lib/docker-postgres-readiness");
const ROOT = path.resolve(__dirname, "..");
const PROPOSAL = "supabase/migrations/20261119150000_read_automation_review_queue_page.sql";
const proposal = fs.readFileSync(path.join(ROOT, PROPOSAL), "utf8");
const run = args => spawnSync("docker", args, { encoding:"utf8",timeout:120000,windowsHide:true });

test("queue projection is SELECT-only, service-role-only and registered as pending without changing current bindings", () => {
  const body=proposal.slice(proposal.indexOf("returns jsonb"),proposal.indexOf("end $$;"));
  assert.match(body,/stable security invoker/);
  assert.match(body,/current_user <> 'service_role'/);
  assert.match(proposal,/revoke all[\s\S]+public,anon,authenticated/);
  assert.doesNotMatch(body,/^\s*(?:insert|update|delete|truncate|execute)\b/im);
  assert.match(body,/left join lateral/);
  assert.match(body,/order by r.requested_at desc,r.id desc limit 1/);
  assert.match(body,/revision_changed/);
  const {PENDING_MIGRATIONS,migrationBinding,sha256File}=require("./lib/environment-migrations");
  for(const environment of ["STAGING","PRODUCTION"]){
    const pending=PENDING_MIGRATIONS[environment].find(row=>row.filename===path.basename(PROPOSAL));
    assert.equal(pending.sha256,sha256File(path.join(ROOT,PROPOSAL)));
    assert.ok(!migrationBinding(environment).versions.includes(path.basename(PROPOSAL,".sql")));
  }
});

test("PostgreSQL paginates large queues, counts current work, joins latest execution and detects concurrent changes", {timeout:180000}, t=>{
  if(run(["version","--format","{{.Server.Version}}"] ).status!==0)return t.skip("Docker unavailable; run existing integration CI");
  const container=`ss-queue-page-${crypto.randomBytes(5).toString("hex")}`;
  t.after(()=>run(["rm","--force",container]));
  const start=run(["run","--detach","--rm","--name",container,"-e","POSTGRES_PASSWORD=TEST_ONLY_QUEUE_PAGE",
    "-v",`${ROOT.replaceAll("\\","/")}:/workspace:ro`,"postgres:17-alpine"]);
  assert.equal(start.status,0,start.stderr);
  const sql=statement=>run(["exec",container,"psql","-X","-v","ON_ERROR_STOP=1","-U","postgres","-d","postgres","-tA","-c",statement]);
  const exec=statement=>{const r=sql(statement);assert.equal(r.status,0,r.stderr);return r.stdout.trim();};
  waitForStablePostgres(()=>sql("select 1"));
  exec(`create role service_role nologin;create role anon nologin;create role authenticated nologin;
    create table public.product_match_review_queue(id bigint primary key,retailer text,retailer_id bigint,offer_id bigint,
      product_title text,variant_title text,source_price numeric,source_url text,current_product_id bigint,current_variant_id bigint,
      review_status text,review_kind text,operation_type text,reason_codes text,before_state jsonb,proposed_state jsonb,
      impact_summary jsonb default '{}',source_evidence jsonb default '{}',source_captured_at timestamptz,expires_at timestamptz,
      source_row_fingerprint text,plan_fingerprint text,workflow_run_url text,artifact_url text,superseded_by_review_id bigint,
      execution_error_code text,execution_error_message text,updated_at timestamptz);
    create table public.automation_review_execution_requests(id uuid primary key,review_id bigint,review_fingerprint text,
      plan_fingerprint text,status text,requested_at timestamptz,run_url text,last_checkpoint text,error_code text,error_message text,
      postflight_hash text,idempotency_result text,database_writes integer);
    create index automation_review_execution_history_idx on public.automation_review_execution_requests(review_id,requested_at desc);
    grant select on public.product_match_review_queue,public.automation_review_execution_requests to service_role;`);
  const applied=run(["exec",container,"psql","-X","-v","ON_ERROR_STOP=1","-U","postgres","-d","postgres","-f",`/workspace/${PROPOSAL}`]);
  assert.equal(applied.status,0,applied.stderr);
  const request={schema_version:1,page:1,page_size:10,filters:{scope:"ALL",bucket:"ALL",status:"ALL",history:false},
    capabilities:{"9":{UPDATE_STOCK:"REVIEW_EXECUTABLE",IDENTITY_PROMOTION:"REVIEW_ONLY"}}};
  const read=changes=>JSON.parse(exec(`set role service_role;select public.read_automation_review_queue_page_v1('${JSON.stringify({...request,...changes}).replaceAll("'","''")}'::jsonb);`).split("\n").at(-1));
  for(const count of [5000,6694,10000,20000]){
    exec(`truncate public.product_match_review_queue;
      insert into public.product_match_review_queue(id,retailer,retailer_id,offer_id,product_title,review_status,review_kind,operation_type,reason_codes,
        source_row_fingerprint,plan_fingerprint,expires_at,updated_at)
      select i,'TEST ONLY Retailer',9,i,'TEST ONLY Product '||i,'PENDING','COMMERCIAL_CHANGE','UPDATE_STOCK','STOCK_CHANGE','source-'||i,'plan-'||i,
        now()+interval '1 day',now()-i*interval '1 second' from generate_series(1,${count}) i;`);
    const page=read({});assert.equal(page.total,count);assert.equal(page.rows.length,10);assert.equal(page.summary.decide,count);
    const next=read({page:2,revision:page.revision});assert.equal(next.revision_changed,false);
    assert.equal(new Set([...page.rows,...next.rows].map(row=>row.id)).size,20);
    const last=read({page:1000000});assert.equal(last.page,Math.ceil(count/10));assert.equal(last.rows.length,count%10||10);
    const filtered=read({filters:{...request.filters,query:`Product ${count}`}});assert.equal(filtered.total,1);assert.equal(filtered.rows[0].id,count);
  }
  const before=read({});
  exec(`update public.product_match_review_queue set superseded_by_review_id=20001 where id=1;
    insert into public.product_match_review_queue(id,retailer,retailer_id,offer_id,product_title,review_status,review_kind,operation_type,reason_codes,
      source_row_fingerprint,plan_fingerprint,expires_at,updated_at) values(20001,'TEST ONLY Retailer',9,1,'TEST ONLY replacement','PENDING',
      'COMMERCIAL_CHANGE','UPDATE_STOCK','STOCK_CHANGE','replacement','plan',now()+interval '1 day',now());`);
  const changed=read({page:2,revision:before.revision});assert.equal(changed.revision_changed,true);assert.deepEqual(changed.rows,[]);
  const current=read({});assert.equal(current.total,20000);assert.equal(current.rows[0].id,20001);
  const history=read({filters:{...request.filters,history:true}});assert.equal(history.total,20001);assert.equal(history.summary.total,20000);
  exec(`insert into public.automation_review_execution_requests(id,review_id,review_fingerprint,plan_fingerprint,status,requested_at)
    values('00000000-0000-4000-8000-000000000001',20001,'replacement','plan','FAILED',now()-interval '1 hour'),
    ('00000000-0000-4000-8000-000000000002',20001,'replacement','plan','QUEUED',now());`);
  const processing=read({filters:{...request.filters,bucket:"PROCESSING"}});assert.equal(processing.total,1);
  assert.equal(processing.rows[0].execution_request.status,"QUEUED");assert.equal(processing.summary.decide,19999);
  exec("update public.product_match_review_queue set source_row_fingerprint='changed-evidence' where id=20001");
  const technical=read({filters:{...request.filters,bucket:"TECHNICAL"}});assert.equal(technical.total,1);assert.equal(technical.rows[0].execution_status,"EVIDENCE_CHANGED");
  assert.notEqual(sql(`set role anon;select public.read_automation_review_queue_page_v1('{}');`).status,0);
  assert.notEqual(sql(`set role authenticated;select public.read_automation_review_queue_page_v1('{}');`).status,0);
  assert.notEqual(sql(`set role service_role;select public.read_automation_review_queue_page_v1('{}');`).status,0);
  for(const invalid of [{schema_version:1,page:1,page_size:10},{...request,revision:"invalid"},{...request,capabilities:null},{...request,filters:null}]){
    assert.notEqual(sql(`set role service_role;select public.read_automation_review_queue_page_v1('${JSON.stringify(invalid)}');`).status,0);
  }
  const capabilityDrift=read({revision:technical.revision,capabilities:{}});
  assert.equal(capabilityDrift.revision_changed,true);assert.deepEqual(capabilityDrift.rows,[]);
  // Explain the exact projection statement, not the opaque PL/pgSQL wrapper.
  const statement=proposal.slice(proposal.indexOf("  with queue"),proposal.indexOf("  if (v_result"))
    .replace("into v_result","").replaceAll("p_request",`'${JSON.stringify(request)}'::jsonb`)
    .replaceAll(/\bv_size\b/g,"10").replaceAll(/\bv_page\b/g,"1");
  const plan=JSON.parse(exec(`set role service_role;explain(analyze,buffers,format json) ${statement}`).split("\n").slice(1).join("\n"));
  assert.ok(plan[0].Plan);assert.ok(Number.isFinite(plan[0]["Execution Time"]));
  t.diagnostic(`20k exact projection EXPLAIN ANALYZE: ${plan[0]["Execution Time"]} ms`);
  const frozen=exec("select md5(string_agg(id::text||source_row_fingerprint,',' order by id)) from public.product_match_review_queue");
  exec(`begin read only;set local role service_role;select public.read_automation_review_queue_page_v1('${JSON.stringify(request)}');rollback;`);
  assert.equal(exec("select md5(string_agg(id::text||source_row_fingerprint,',' order by id)) from public.product_match_review_queue"),frozen);
});
