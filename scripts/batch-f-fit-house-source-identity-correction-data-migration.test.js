const assert = require('node:assert/strict');
const crypto = require('node:crypto');
const fs = require('node:fs');
const path = require('node:path');
const { spawnSync } = require('node:child_process');
const test = require('node:test');

const root = path.resolve(__dirname, '..');
const baseline = path.join(root, 'supabase/migrations/20260712211120_baseline_current_public_schema.sql');
const migration = path.join(root, 'supabase/migrations/20260715233000_correct_fit_house_batch_f_source_variant_identity.sql');
const database = 'supplementscout_batch_f_identity_test';
const image = 'postgres:17-alpine';
const text = fs.readFileSync(migration, 'utf8');
const inventory = JSON.parse(text.match(/\$batch_f_identity_corrections\$\s*([\s\S]*?)\s*\$batch_f_identity_corrections\$::jsonb/)[1]);

function run(command,args,timeout=120000){return spawnSync(command,args,{cwd:root,encoding:'utf8',timeout,windowsHide:true});}
function ok(result,label){assert.equal(result.status,0,`${label}\n${result.stdout||''}\n${result.stderr||''}`);return result;}
function dockerAvailable(){return run('docker',['info'],20000).status===0;}
function exec(container,args,timeout=120000){return run('docker',['exec',container,...args],timeout);}
function psql(container,args){return exec(container,['psql','-v','ON_ERROR_STOP=1','-U','postgres','-d',database,...args]);}
function sql(container,statement){return ok(psql(container,['-At','-c',statement]),'SQL').stdout.trim();}
function literal(value){return `'${String(value).replaceAll("'","''")}'`;}
function apply(container){return psql(container,['-f',`/workspace/${path.relative(root,migration).replaceAll('\\','/')}`]);}
function wait(container){for(let i=0;i<80;i+=1){if(exec(container,['pg_isready','-U','postgres','-d','postgres'],5000).status===0)return;Atomics.wait(new Int32Array(new SharedArrayBuffer(4)),0,0,250);}assert.fail('PostgreSQL unavailable');}
function recreate(container){
  ok(exec(container,['dropdb','-U','postgres','--force','--if-exists',database]),'drop db');ok(exec(container,['createdb','-U','postgres',database]),'create db');
  ok(psql(container,['-c',"do $r$ begin if not exists(select 1 from pg_roles where rolname='anon')then create role anon nologin;end if;if not exists(select 1 from pg_roles where rolname='authenticated')then create role authenticated nologin;end if;if not exists(select 1 from pg_roles where rolname='service_role')then create role service_role nologin;end if;end $r$;"]),'roles');
  ok(psql(container,['-f',`/workspace/${path.relative(root,baseline).replaceAll('\\','/')}`]),'baseline');
  sql(container,`insert into products(id,name,slug,brand,category,is_active) values ${inventory.map((e,i)=>`(${760+i*7},${literal(e.product_name)},${literal(e.product_slug)},${literal(e.brand)},'Fixture',true)`).join(',')}; insert into product_variants(product_id,variant_key,display_name,flavour_code,flavour_label,size_value,size_unit,pack_count,product_format,is_default,is_active) values ${inventory.map((e,i)=>`(${760+i*7},${literal(e.old_key)},${literal(e.old_display_name)},${literal(e.old_flavour_code)},${literal(e.old_flavour_label)},${e.size_value},${literal(e.size_unit)},1,${literal(e.product_format)},false,true)`).join(',')},${inventory.map((e,i)=>`(${760+i*7},'default','Default',null,null,null,null,null,null,true,true)`).join(',')};`);
}
function state(container){return JSON.parse(sql(container,"select jsonb_build_object('products',(select count(*) from products),'variants',(select count(*) from product_variants),'rows',(select jsonb_agg(jsonb_build_object('slug',p.slug,'key',v.variant_key,'display',v.display_name,'code',v.flavour_code,'label',v.flavour_label) order by p.slug,v.variant_key) from product_variants v join products p on p.id=v.product_id))"));}
function blocked(container,label){const result=apply(container);assert.notEqual(result.status,0,`${label} unexpectedly succeeded`);}

test('Batch F correction has exactly two exact source identities and product_variants-only updates',()=>{
  assert.equal(inventory.length,2);assert.deepEqual(inventory.map((e)=>e.new_flavour_label),["S'Berry & Peaches",'Unflavored']);
  assert.match(text,/^begin;/i);assert.match(text,/commit;\s*$/i);assert.match(text,/update public\.product_variants/i);
  assert.doesNotMatch(text,/(insert into|delete from|truncate) public\.(products|product_variants|retailer_products|offers|price_history)/i);
  assert.doesNotMatch(text,/update public\.(products|retailer_products|offers|price_history)/i);assert.doesNotMatch(text,/on conflict/i);
});

test('real Batch F identity correction scenarios on disposable PostgreSQL',{skip:!dockerAvailable()&&'Docker unavailable'},()=>{
  const container=`supplementscout-batch-f-correction-${crypto.randomBytes(5).toString('hex')}`;
  try{
    ok(run('docker',['run','--detach','--rm','--name',container,'--network','none','-e','POSTGRES_PASSWORD=batch-f-local-only','-v',`${root}:/workspace:ro`,image],180000),'start container');wait(container);
    recreate(container);const before=state(container);ok(apply(container),'clean correction');const after=state(container);assert.equal(after.products,before.products);assert.equal(after.variants,before.variants);assert.ok(inventory.every((e)=>after.rows.some((r)=>r.slug===e.product_slug&&r.key===e.new_key&&r.label===e.new_flavour_label)));ok(apply(container),'identical rerun');assert.deepEqual(state(container),after);
    recreate(container);sql(container,`update product_variants set variant_key=${literal(inventory[0].new_key)},display_name=${literal(inventory[0].new_display_name)},flavour_code=${literal(inventory[0].new_flavour_code)},flavour_label=${literal(inventory[0].new_flavour_label)} where variant_key=${literal(inventory[0].old_key)}`);ok(apply(container),'partial identical');
    recreate(container);sql(container,`update products set brand='Drifted' where slug=${literal(inventory[0].product_slug)}`);const productDrift=state(container);blocked(container,'product drift');assert.deepEqual(state(container),productDrift);
    recreate(container);sql(container,`update product_variants set display_name='Drifted' where variant_key=${literal(inventory[0].old_key)}`);const variantDrift=state(container);blocked(container,'variant drift');assert.deepEqual(state(container),variantDrift);
    recreate(container);sql(container,`insert into product_variants(product_id,variant_key,display_name,is_active,is_default) select id,${literal(inventory[0].new_key)},'Collision',true,false from products where slug=${literal(inventory[0].product_slug)}`);const collision=state(container);blocked(container,'key collision');assert.deepEqual(state(container),collision);
    recreate(container);sql(container,`create function reject_second() returns trigger language plpgsql as $$begin if new.variant_key=${literal(inventory[1].new_key)} then raise exception 'controlled late failure';end if;return new;end$$;create trigger reject_second before update on product_variants for each row execute function reject_second()`);const late=state(container);blocked(container,'late rollback');assert.deepEqual(state(container),late);
  }finally{run('docker',['rm','--force',container],30000);}
});
