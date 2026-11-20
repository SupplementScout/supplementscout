const assert = require("node:assert/strict");
const crypto = require("node:crypto");
const { spawnSync } = require("node:child_process");
const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");
const { waitForStablePostgres } = require("./lib/docker-postgres-readiness");
const ROOT = path.resolve(__dirname, "..");
const PROPOSAL = "supabase/migrations/20261119150000_read_automation_review_queue_page.sql";
const proposal = fs.readFileSync(path.join(ROOT, PROPOSAL), "utf8").replaceAll("\r\n", "\n");
const COUNTERS = "supabase/migrations/20261120150000_add_catalog_health_review_counts.sql";
const counters = fs.readFileSync(path.join(ROOT, COUNTERS), "utf8").replaceAll("\r\n", "\n");
const run = args => spawnSync("docker", args, { encoding:"utf8",timeout:120000,windowsHide:true });

test("Catalog Health migration changes only the existing summary and keeps the real applicator wrapper", () => {
  const {unwrapTransaction}=require("./apply-selected-migrations");
  const {PENDING_MIGRATIONS,sha256File}=require("./lib/environment-migrations");
  assert.match(counters,/^BEGIN;\r?\n/);assert.match(counters,/COMMIT;\s*$/);
  assert.doesNotThrow(()=>unwrapTransaction(counters,path.basename(COUNTERS)));
  const definition=sql=>sql.slice(sql.indexOf("create or replace function"),sql.indexOf("end $$;")+7);
  const expected=definition(proposal).replace("select retailer,count(*) filter(where work_bucket=","select retailer_id,retailer,count(*) filter(where work_bucket=")
    .replace("completed,count(*) total from current_summary group by retailer", "completed,count(*) total,\n      count(*) filter(where lifecycle='PENDING') pending,\n      count(*) filter(where lifecycle='PENDING' and review_kind='SOURCE_FAILURE') source_unavailable,\n      count(*) filter(where lifecycle='FAILED') blocked\n      from current_summary group by retailer_id,retailer");
  assert.equal(definition(counters),expected);
  assert.equal((counters.match(/create or replace function/g)||[]).length,1);
  assert.doesNotMatch(counters,/\b(?:create\s+(?:table|index|view)|grant|revoke|insert\s+into|update\s+public|delete\s+from)\b/i);
  const pending=PENDING_MIGRATIONS.PRODUCTION.find(row=>row.filename===path.basename(COUNTERS));
  assert.equal(pending.sha256,sha256File(path.join(ROOT,COUNTERS)));
});

test("queue projection is SELECT-only, service-role-only, applied in production and pending in staging", () => {
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
    if(environment==="PRODUCTION"){
      assert.equal(pending,undefined);
      assert.ok(migrationBinding(environment).versions.includes(path.basename(PROPOSAL,".sql")));
      assert.equal(sha256File(path.join(ROOT,PROPOSAL)),"062865129b774e8ff79631b241ee43a44a8a5b334640a91c7e51a5953eb187aa");
    }else{
      assert.equal(pending.sha256,sha256File(path.join(ROOT,PROPOSAL)));
      assert.ok(!migrationBinding(environment).versions.includes(path.basename(PROPOSAL,".sql")));
    }
  }
});

function queueTestDatabase(t) {
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
  return {sql,exec,container};
}

test("PostgreSQL paginates large queues, counts current work, joins latest execution and detects concurrent changes", {timeout:180000}, t=>{
  const database=queueTestDatabase(t);if(!database)return;
  const {sql,exec,container}=database;
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

test("Catalog Health migration rehearses and applies without data or ACL changes, preserves old clients and scales current counters", {timeout:180000}, async t=>{
  const database=queueTestDatabase(t);if(!database)return;
  const {sql,exec}=database;
  // Use the same psql connection helper for the actual transaction-wrapped files.
  exec(proposal);
  const ids=[1,3,4,5,7,8,9,10,11,12,13,14,15,16];
  const capabilities=Object.fromEntries(ids.map(id=>[id,{UPDATE_STOCK:"REVIEW_EXECUTABLE",SOURCE_MISSING:"REVIEW_ONLY",IDENTITY_PROMOTION:"REVIEW_ONLY",VERIFY_NO_CHANGE:"AUTONOMOUS"}]));
  const request={schema_version:1,page:1,page_size:10,filters:{scope:"DECISIONS",bucket:"ALL",status:"ALL",history:false},capabilities};
  const read=changes=>JSON.parse(exec(`set role service_role;select public.read_automation_review_queue_page_v1('${JSON.stringify({...request,...changes}).replaceAll("'","''")}');`).split("\n").at(-1));
  const metadata=()=>exec(`select json_build_object('oid',oid,'owner',proowner,'language',prolang,'volatility',provolatile,'definer',prosecdef,
    'return_type',prorettype,'arguments',proargtypes::text,'config',proconfig,'acl',proacl) from pg_proc where oid='public.read_automation_review_queue_page_v1(jsonb)'::regprocedure`);
  const bodyHash=()=>exec("select md5(prosrc) from pg_proc where oid='public.read_automation_review_queue_page_v1(jsonb)'::regprocedure");
  const dataHash=()=>exec("select md5(coalesce(string_agg(to_jsonb(q)::text,',' order by id),'')) from public.product_match_review_queue q");
  exec(`insert into public.product_match_review_queue(id,retailer,retailer_id,offer_id,product_title,review_status,review_kind,operation_type,reason_codes,source_row_fingerprint,plan_fingerprint,expires_at,updated_at,superseded_by_review_id)
    select id,'TEST ONLY 9',9,case when id=12 then 1 when id=7 then 6 else id end,'TEST ONLY Product '||id,
      case when id=3 then 'FAILED' when id=5 then 'APPROVED' when id=8 then 'EXPIRED' else 'PENDING' end,
      case when id=2 then 'SOURCE_FAILURE' when id=13 then 'IDENTITY_CONFLICT' else 'COMMERCIAL_CHANGE' end,
      case when id=2 then 'MANUAL_REVIEW' when id=13 then 'MANUAL_REVIEW_IDENTITY' when id=11 then 'VERIFY_NO_CHANGE' else 'UPDATE_STOCK' end,
      case when id in(2,13) then 'SOURCE_MISSING' else 'STOCK_CHANGE' end,'source-'||id,'plan-'||id,
      case when id in(4,5) then now()-interval '1 day' else now()+interval '1 day' end,
      case when id=12 then now()-interval '2 days' else now() end,case when id=6 then 7 else null end from generate_series(1,13) id;
    insert into public.automation_review_execution_requests(id,review_id,review_fingerprint,plan_fingerprint,status,requested_at) values
      ('00000000-0000-4000-8000-000000000001',9,'source-9','plan-9','QUEUED',now()),
      ('00000000-0000-4000-8000-000000000002',10,'old-source','plan-10','FAILED',now());`);
  const oldPage=read({}),beforeMetadata=metadata(),beforeBody=bodyHash(),beforeData=dataHash();
  const {unwrapTransaction}=require("./apply-selected-migrations");
  exec(`begin;${unwrapTransaction(counters,path.basename(COUNTERS))}rollback;`);
  assert.equal(bodyHash(),beforeBody);assert.equal(metadata(),beforeMetadata);assert.equal(dataHash(),beforeData);
  exec(counters);
  assert.equal(metadata(),beforeMetadata);assert.equal(dataHash(),beforeData);assert.notEqual(bodyHash(),beforeBody);
  const page=read({});
  assert.deepEqual(page.rows,oldPage.rows);assert.equal(page.schema_version,oldPage.schema_version);assert.equal(page.revision,oldPage.revision);
  assert.deepEqual(page.summary.retailers.map(({retailer_id,pending,source_unavailable,blocked,...existing})=>existing),oldPage.summary.retailers);
  for(const key of Object.keys(oldPage.summary).filter(key=>key!=="retailers"))assert.deepEqual(page.summary[key],oldPage.summary[key]);
  const row=page.summary.retailers[0];assert.equal(row.pending,4);assert.equal(row.source_unavailable,1);assert.equal(row.blocked,1);
  for(const [status,expected] of [["PENDING",4],["FAILED",1]])assert.equal(read({filters:{...request.filters,status}}).total,expected);
  assert.equal(read({filters:{...request.filters,status:"PENDING",kind:"SOURCE_FAILURE"}}).total,1);
  const history=read({filters:{...request.filters,history:true}});assert.equal(history.total,12);
  assert.equal(history.summary.retailers[0].pending,4);assert.equal(history.summary.retailers[0].blocked,1);

  // Exercise the unchanged application page reader and the repaired health loader
  // with real old/new PostgreSQL responses, without any production credentials.
  const vm=require("node:vm"),ts=require("typescript"),cache=new Map();let response;
  const load=file=>{
    if(cache.has(file))return cache.get(file);
    const mod={exports:{}};cache.set(file,mod.exports);
    vm.runInNewContext(ts.transpileModule(fs.readFileSync(path.join(ROOT,file),"utf8"),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText,{
      module:mod,exports:mod.exports,require:name=>{
        if(name==="server-only")return{};
        if(name==="../../lib/supabaseAdmin")return{supabaseAdmin:{rpc:async()=>({data:response,error:null})}};
        if(name==="./automationReviewQueueData")return load("app/admin/lib/automationReviewQueueData.ts");
        if(name==="./automationReviewQueue")return{REVIEW_QUEUE_PAGE_SIZE:50,REVIEW_QUEUE_WORK_PAGE_SIZE:10};
        if(name==="../../lib/automationReviewCapabilityMatrix")return{AUTOMATION_REVIEW_CAPABILITY_MATRIX:[]};
        throw Error(`Unexpected import ${name}`);
      },Date,Number,Set,Object,Error});
    return mod.exports;
  };
  const health=load("app/admin/lib/automationReviewHealth.ts"),client=load("app/admin/lib/automationReviewQueueData.ts");
  response=oldPage;assert.equal(await health.loadAutomationReviewCounts(),null);
  response=page;assert.equal((await client.loadReviewQueuePage({display:"WORK"},1)).error,null);
  assert.deepEqual(JSON.parse(JSON.stringify(await health.loadAutomationReviewCounts())),{"9":{pending:4,sourceUnavailable:1,blocked:1}});
  for(const role of ["anon","authenticated"]){assert.notEqual(sql(`set role ${role};select public.read_automation_review_queue_page_v1('{}');`).status,0);}
  exec("truncate public.product_match_review_queue,public.automation_review_execution_requests");
  response=read({});assert.equal(response.total,0);assert.deepEqual(response.summary.retailers,[]);
  assert.equal(JSON.stringify(await health.loadAutomationReviewCounts()),"{}");

  const definition=body=>body.slice(body.indexOf("create or replace function"),body.indexOf("end $$;")+7);
  const explain=()=>JSON.parse(exec(`set role service_role;explain(analyze,buffers,format json) select public.read_automation_review_queue_page_v1('${JSON.stringify(request)}');`).split("\n").slice(1).join("\n"))[0]["Execution Time"];
  const median=times=>[...times].sort((a,b)=>a-b)[Math.floor(times.length/2)];
  const measurements=[];
  for(const count of [1000,5000,10000,20000]){
    exec(`truncate public.product_match_review_queue;
      insert into public.product_match_review_queue(id,retailer,retailer_id,offer_id,product_title,review_status,review_kind,operation_type,reason_codes,source_row_fingerprint,plan_fingerprint,expires_at,updated_at)
      select i,'TEST ONLY '||retailer_id,retailer_id,i,'TEST ONLY Product '||i,'PENDING',case when i%10=0 then 'SOURCE_FAILURE' else 'COMMERCIAL_CHANGE' end,
        case when i%10=0 then 'MANUAL_REVIEW' else 'UPDATE_STOCK' end,'STOCK_CHANGE','source-'||i,'plan-'||i,now()+interval '1 day',now()-i*interval '1 second'
        from generate_series(1,${count}) i cross join lateral(select (array[${ids.join(",")}])[1+(i-1)%${ids.length}] retailer_id) r;
      analyze public.product_match_review_queue;`);
    exec(definition(proposal));const baseline=read({});explain();const oldTimes=Array.from({length:3},explain);
    exec(definition(counters));const changed=read({});explain();const newTimes=Array.from({length:3},explain);
    assert.equal(changed.total,count);assert.equal(changed.rows.length,10);assert.equal(changed.summary.retailers.length,ids.length);
    const expected=new Map(ids.map(id=>[id,{pending:0,source_unavailable:0,blocked:0}]));
    for(let i=1;i<=count;i++){const group=expected.get(ids[(i-1)%ids.length]);group.pending++;if(i%10===0)group.source_unavailable++;}
    for(const group of changed.summary.retailers){const next=expected.get(group.retailer_id);assert.equal(group.pending,next.pending);assert.equal(group.source_unavailable,next.source_unavailable);assert.equal(group.blocked,0);}
    assert.deepEqual(changed.rows,baseline.rows);
    response=changed;const actual=await health.loadAutomationReviewCounts();assert.notEqual(actual,null);
    for(const [id,next] of expected){assert.equal(actual[id].pending,next.pending);assert.equal(actual[id].sourceUnavailable,next.source_unavailable);assert.equal(actual[id].blocked,0);}
    const measurement={rows:count,old_ms:oldTimes,new_ms:newTimes,old_median_ms:median(oldTimes),new_median_ms:median(newTimes),page_rows:changed.rows.length,summary_rows:changed.summary.retailers.length};
    measurements.push(measurement);t.diagnostic(JSON.stringify(measurement));
    assert.ok(measurement.new_median_ms<=measurement.old_median_ms*1.25+5,"unexplained function execution regression above 25% plus 5ms");
  }
  const output=path.join(ROOT,"tmp/catalog-health-counts/actual-function-benchmark.json");fs.mkdirSync(path.dirname(output),{recursive:true});
  fs.writeFileSync(output,JSON.stringify({database:"TEST ONLY disposable PostgreSQL17",migration:path.basename(COUNTERS),rehearsal:"PASS_ROLLBACK",apply:"PASS",acl_and_data_unchanged:true,old_client_new_sql:"PASS",new_client_old_sql:"FAIL_CLOSED",status_parity:"PASS",measurements},null,2)+"\n");
});
