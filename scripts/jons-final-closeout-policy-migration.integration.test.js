const assert = require('node:assert/strict');
const path = require('node:path');
const { spawnSync } = require('node:child_process');
const test = require('node:test');

const root = path.resolve(__dirname, '..');
const image = 'postgres:17-alpine';
const password = 'final-closeout-policy-local-only';
const migration = 'supabase/migrations/20260722113000_allow_final_reviewed_jons_closeout.sql';
const predatorsMigration = 'supabase/migrations/20260827200000_allow_predators_gear_reviewed_creatine_316g.sql';
const predatorsV3Migration = 'supabase/migrations/20260829100000_allow_predators_gear_reviewed_new_products_v3.sql';
function run(command,args,timeout=120000){return spawnSync(command,args,{cwd:root,encoding:'utf8',timeout});}
function ok(result,label){assert.equal(result.status,0,`${label}\n${result.stdout}\n${result.stderr}`);return result.stdout.trim();}
function exec(container,args){return run('docker',['exec',container,...args]);}

test('final closeout DB policy accepts exact families and permits only strict no-SKU zero-default plans',()=>{
  const container=`supplementscout-final-closeout-${process.pid}-${Date.now()}`;
  ok(run('docker',['run','--detach','--rm','--name',container,'-e',`POSTGRES_PASSWORD=${password}`,'-v',`${root.replaceAll('\\','/')}:/workspace:ro`,image]),'start postgres');
  let failure;
  try {
    for(let i=0;i<30;i+=1){if(exec(container,['pg_isready','-U','postgres']).status===0)break;Atomics.wait(new Int32Array(new SharedArrayBuffer(4)),0,0,250);}
    ok(exec(container,['psql','-X','--no-psqlrc','-v','ON_ERROR_STOP=1','-U','postgres','-c',`
      create table public.product_variants(product_id bigint,is_active boolean,is_default boolean);
      create function public.atomic_import_safe_create_category_allowed(text,text,text) returns boolean language sql immutable as $fn$ select $1 in ('Vitamins','Health Supplements','Amino Acids','Creatine') $fn$;
      create function public.atomic_import_reviewed_parent_variant_allowed(p_name text,p_brand text,p_category text,p_format text,p_size_value text,p_size_unit text) returns boolean language sql immutable as $fn$
        select exists(select 1 from (values ('Strom MSM (Methylsulfonylmethane) 83 Servings','Strom','Health Supplements','powder','83','servings')) a(name,brand,category,format,size_value,size_unit)
          where a.name=p_name and a.brand=p_brand and a.category=p_category and a.format=p_format and a.size_value=p_size_value and a.size_unit=p_size_unit) $fn$;
      create function public.atomic_import_validate_variant_plan_core(p_plan jsonb) returns jsonb language plpgsql as $fn$
      declare v_product_id bigint := (p_plan->>'product_id')::bigint; v_external_sku text := nullif(p_plan->>'external_sku','');
      begin
        if (select count(*) from public.product_variants where product_id=v_product_id and is_active and is_default) <> 1 then
          raise exception 'create_variant requires exactly one active default product_variant';
        end if;
        return '{"valid":true}'::jsonb;
      end $fn$;
      create function public.validate_product_import_plan_read_only(p_plan jsonb) returns jsonb language sql as $fn$ select public.atomic_import_validate_variant_plan_core(p_plan) $fn$;
      create function public.apply_product_import_plan(p_plan jsonb) returns jsonb language plpgsql as $fn$ begin perform public.validate_product_import_plan_read_only(p_plan); return '{"applied":true}'::jsonb; end $fn$;
    `]),'create policy stubs');
    ok(exec(container,['psql','-X','--no-psqlrc','-v','ON_ERROR_STOP=1','-U','postgres','-f',`/workspace/${migration}`]),'apply migration');
    ok(exec(container,['psql','-X','--no-psqlrc','-v','ON_ERROR_STOP=1','-U','postgres','-f',`/workspace/${predatorsMigration}`]),'apply Predators Gear reviewed creatine migration');
    const exact=JSON.parse(ok(exec(container,['psql','-X','--no-psqlrc','-A','-t','-U','postgres','-c',`
      select jsonb_build_object(
        'cellucor',public.atomic_import_safe_create_category_allowed('Pre Workout','Cellucor C4 Ripped 180g','powder'),
        'other_pre',public.atomic_import_safe_create_category_allowed('Pre Workout','Other Pre 180g','powder'),
        'whey',public.atomic_import_reviewed_parent_variant_allowed('Efectiv Whey Protein 2kg','Efectiv','Whey Protein','powder','2000','g'),
        'wrong_size',public.atomic_import_reviewed_parent_variant_allowed('Efectiv Whey Protein 2kg','Efectiv','Whey Protein','powder','1800','g'),
        'unreviewed',public.atomic_import_reviewed_parent_variant_allowed('Unreviewed Product 2kg','Efectiv','Whey Protein','powder','2000','g'),
        'predators_316',public.atomic_import_reviewed_parent_variant_allowed('DY Nutrition The Creatine Complex 316g','DY Nutrition','Creatine','powder','316','g'),
        'predators_400',public.atomic_import_reviewed_parent_variant_allowed('DY Nutrition The Creatine Complex 400g','DY Nutrition','Creatine','powder','400','g'));
    `]),'query exact policy'));
    assert.deepEqual(exact,{cellucor:true,other_pre:false,whey:true,wrong_size:false,unreviewed:false,predators_316:true,predators_400:false});
    ok(exec(container,['psql','-X','--no-psqlrc','-v','ON_ERROR_STOP=1','-U','postgres','-c',`insert into public.product_variants values(1,true,false); select public.validate_product_import_plan_read_only('{"product_id":1,"external_sku":null}'::jsonb);`]),'strict no-SKU without default passes');
    const sku=exec(container,['psql','-X','--no-psqlrc','-v','ON_ERROR_STOP=1','-U','postgres','-c',`select public.validate_product_import_plan_read_only('{"product_id":1,"external_sku":"SKU"}'::jsonb);`]);
    assert.notEqual(sku.status,0);assert.match(sku.stderr,/exactly one active default/);
    ok(exec(container,['psql','-X','--no-psqlrc','-v','ON_ERROR_STOP=1','-U','postgres','-c',`insert into public.product_variants values(2,true,true),(2,true,true);`]),'seed duplicate defaults');
    const duplicate=exec(container,['psql','-X','--no-psqlrc','-v','ON_ERROR_STOP=1','-U','postgres','-c',`select public.validate_product_import_plan_read_only('{"product_id":2,"external_sku":null}'::jsonb);`]);
    assert.notEqual(duplicate.status,0);assert.match(duplicate.stderr,/exactly one active default/);
  }catch(error){failure=error;}finally{run('docker',['rm','--force',container],30000);}if(failure)throw failure;
});

test('Predators Gear reviewed-new-products-v3 DB policy accepts only exact reviewed identities',()=>{
  const container=`supplementscout-predators-v3-${process.pid}-${Date.now()}`;
  ok(run('docker',['run','--detach','--rm','--name',container,'-e',`POSTGRES_PASSWORD=${password}`,'-v',`${root.replaceAll('\\','/')}:/workspace:ro`,image]),'start postgres');
  let failure;
  try{
    for(let i=0;i<30;i+=1){if(exec(container,['pg_isready','-U','postgres']).status===0)break;Atomics.wait(new Int32Array(new SharedArrayBuffer(4)),0,0,250);}
    ok(exec(container,['psql','-X','--no-psqlrc','-v','ON_ERROR_STOP=1','-U','postgres','-c',`
      create role anon; create role authenticated; create role service_role;
      create function public.atomic_import_safe_create_category_allowed(p_category text,p_name text,p_product_format text) returns boolean language sql immutable as $fn$
        select coalesce(p_category,'') in ('Vitamins','Health Supplements','Amino Acids','Creatine') $fn$;
      create function public.atomic_import_reviewed_parent_variant_allowed(p_name text,p_brand text,p_category text,p_format text,p_size_value text,p_size_unit text) returns boolean language sql immutable as $fn$
        select exists(select 1 from (values ('DY Nutrition The Creatine Complex 316g','DY Nutrition','Creatine','powder','316','g')) a(name,brand,category,format,size_value,size_unit)
          where a.name=p_name and a.brand=p_brand and a.category=p_category and a.format=p_format and a.size_value=p_size_value and a.size_unit=p_size_unit) $fn$;
      create function public.atomic_import_validate_pre_source_metadata_plan_core(p_plan jsonb) returns jsonb language plpgsql as $fn$
      declare v_retailer_id bigint := nullif(p_plan#>>'{retailer,id}','')::bigint; v_retailer_actual jsonb := p_plan#>'{expected_state,retailer}';
      begin
        if v_retailer_actual->>'slug'='jon-s-supplements' then null;
        elsif v_retailer_id = 13
          and p_plan#>>'{product,values,name}'='DY Nutrition The Creatine Complex 316g' then null;
        else raise exception 'reviewed parent explicit-variant retailer and transport policy does not allow this plan';
        end if;
        return '{"valid":true}'::jsonb;
      end $fn$;
    `]),'create policy stubs');
    ok(exec(container,['psql','-X','--no-psqlrc','-v','ON_ERROR_STOP=1','-U','postgres','-f',`/workspace/${predatorsV3Migration}`]),'apply Predators Gear v3 policy migration');
    const exact=JSON.parse(ok(exec(container,['psql','-X','--no-psqlrc','-A','-t','-U','postgres','-c',`
      select jsonb_build_object(
        'aakg',public.atomic_import_safe_create_category_allowed('Pre Workout','Olimp AAKG 1250 Extreme Mega Caps 120 Capsules','capsule'),
        'wrong_aakg',public.atomic_import_safe_create_category_allowed('Pre Workout','Olimp AAKG 1250 Extreme Mega Caps 60 Capsules','capsule'),
        'bcaa',public.atomic_import_reviewed_parent_variant_allowed('Olimp BCAA Xplode 500g','Olimp','Amino Acids','powder','500','g'),
        'wrong_bcaa',public.atomic_import_reviewed_parent_variant_allowed('Olimp BCAA Xplode 1000g','Olimp','Amino Acids','powder','1000','g'),
        'patched',strpos(pg_get_functiondef('public.atomic_import_validate_pre_source_metadata_plan_core(jsonb)'::regprocedure),'atomic_import_predators_v3_parent_variant_transport_allowed')>0,
        'service_execute',has_function_privilege('service_role','public.atomic_import_predators_v3_parent_variant_transport_allowed(jsonb,jsonb)','EXECUTE'));
    `]),'query exact v3 policy'));
    assert.deepEqual(exact,{aakg:true,wrong_aakg:false,bcaa:true,wrong_bcaa:false,patched:true,service_execute:false});
  }catch(error){failure=error;}finally{run('docker',['rm','--force',container],30000);}if(failure)throw failure;
});
