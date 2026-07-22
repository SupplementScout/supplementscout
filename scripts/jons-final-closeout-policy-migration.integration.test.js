const assert = require('node:assert/strict');
const path = require('node:path');
const { spawnSync } = require('node:child_process');
const test = require('node:test');

const root = path.resolve(__dirname, '..');
const image = 'postgres:17-alpine';
const password = 'final-closeout-policy-local-only';
const migration = 'supabase/migrations/20260722113000_allow_final_reviewed_jons_closeout.sql';
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
    const exact=JSON.parse(ok(exec(container,['psql','-X','--no-psqlrc','-A','-t','-U','postgres','-c',`
      select jsonb_build_object(
        'cellucor',public.atomic_import_safe_create_category_allowed('Pre Workout','Cellucor C4 Ripped 180g','powder'),
        'other_pre',public.atomic_import_safe_create_category_allowed('Pre Workout','Other Pre 180g','powder'),
        'whey',public.atomic_import_reviewed_parent_variant_allowed('Efectiv Whey Protein 2kg','Efectiv','Whey Protein','powder','2000','g'),
        'wrong_size',public.atomic_import_reviewed_parent_variant_allowed('Efectiv Whey Protein 2kg','Efectiv','Whey Protein','powder','1800','g'),
        'unreviewed',public.atomic_import_reviewed_parent_variant_allowed('Unreviewed Product 2kg','Efectiv','Whey Protein','powder','2000','g'));
    `]),'query exact policy'));
    assert.deepEqual(exact,{cellucor:true,other_pre:false,whey:true,wrong_size:false,unreviewed:false});
    ok(exec(container,['psql','-X','--no-psqlrc','-v','ON_ERROR_STOP=1','-U','postgres','-c',`insert into public.product_variants values(1,true,false); select public.validate_product_import_plan_read_only('{"product_id":1,"external_sku":null}'::jsonb);`]),'strict no-SKU without default passes');
    const sku=exec(container,['psql','-X','--no-psqlrc','-v','ON_ERROR_STOP=1','-U','postgres','-c',`select public.validate_product_import_plan_read_only('{"product_id":1,"external_sku":"SKU"}'::jsonb);`]);
    assert.notEqual(sku.status,0);assert.match(sku.stderr,/exactly one active default/);
    ok(exec(container,['psql','-X','--no-psqlrc','-v','ON_ERROR_STOP=1','-U','postgres','-c',`insert into public.product_variants values(2,true,true),(2,true,true);`]),'seed duplicate defaults');
    const duplicate=exec(container,['psql','-X','--no-psqlrc','-v','ON_ERROR_STOP=1','-U','postgres','-c',`select public.validate_product_import_plan_read_only('{"product_id":2,"external_sku":null}'::jsonb);`]);
    assert.notEqual(duplicate.status,0);assert.match(duplicate.stderr,/exactly one active default/);
  }catch(error){failure=error;}finally{run('docker',['rm','--force',container],30000);}if(failure)throw failure;
});
