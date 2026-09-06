begin;

set local lock_timeout = '5s';
set local statement_timeout = '120s';

-- Policy only: allow exactly the 94 owner-reviewed 10 Reps v9 sibling plans.
create or replace function public.atomic_import_10reps_v9_sibling_variant_allowed(p_plan jsonb)
returns boolean
language sql
immutable
set search_path = pg_catalog, public, pg_temp
as $function$
  with allowed(fingerprint,product_id,external_product_id,external_variant_id,external_sku,price,total_price,in_stock) as (
    values
      ('607ff7e0f9482dc307836e33cb9f25fe','1167','2673','2679','NXT115','20.49','24.48',false),
      ('dd6edc3027517bd7cf362e885440d3c9','1167','2673','2680','NXT113','20.49','24.48',false),
      ('fba9275baa0f0106272d01352256b793','1167','2673','2681','NXT123','20.49','24.48',true),
      ('5d5b36a9a010f1a02270c9a79503db6a','1167','2673','2682','NXT118','20.49','24.48',true),
      ('881273550c1ca1f9e03b535cb88ddfd3','1167','2673','10131','NXT116','20.49','24.48',true),
      ('556ba3d273662417eab2174f58d87638','1167','2673','10132','NXT117','20.49','24.48',true),
      ('c25d0eec32594957e890ae895c22cac1','1167','2673','10133','NXT119','20.49','24.48',false),
      ('02f5fb746ffc127088a0e6cadad0adce','1167','2673','10134','NXT120','20.49','24.48',true),
      ('3917f0f4d302cafc58aa778837776ef7','1167','2673','10135','NXT121','20.49','24.48',true),
      ('c95673623574f85351920e5b4e99ddd0','1167','2673','10136','NXT122','20.49','24.48',true),
      ('4bc7e1c7b3689f67b4c594ed4f11f699','1167','2673','10137','NXT124','20.49','24.48',true),
      ('c144cffde1bb4fea9d3929a21a1263b2','1167','2673','10138','NXT125','20.49','24.48',true),
      ('4befc920a2edf3030786fe024e49dd20','1167','2673','10139','NXT126','20.49','24.48',true),
      ('b7b92eeb32a00faa9ac202c2c197f8e0','1167','2673','10140','NXT127','20.49','24.48',true),
      ('cd1d1a343e914f01fdab880974ae2c18','1167','2673','10141','NXT128','20.49','24.48',true),
      ('23e5b96b26da52d21860bcef62197374','1167','2673','10142','NXT129','20.49','24.48',false),
      ('7fe34a419b77def6d090a0789e31614e','1167','2673','10143','NXT130','20.49','24.48',true),
      ('8710a52f264ec0958131dd4b21bd4d29','1168','1370','1375',null,'46.99','50.98',true),
      ('24d00082a6f9016df3b5e36f471b0078','1168','1370','1376','NXT095','52.99','56.98',false),
      ('cc358c6a2e21e04343336787e7913098','1168','1370','1377','44081','46.95','50.94',true),
      ('8867e85a49774f4e75613650a5c9a646','1168','1370','7680','NXT096','52.99','56.98',false),
      ('adb7c85dd1594e7771a112cda7d7898b','1168','1370','7681','NXT097','52.99','56.98',false),
      ('3a1ac12a1d64997378538ea95414debf','1168','1370','7683','NXT100','52.99','56.98',true),
      ('90d9ca6e528b1f538a7d3044d1d883b5','1168','1370','7684','NXT101','52.99','56.98',false),
      ('7d0fb14bf1f5fdaf700ab470ce7ea28d','1168','1370','7685','NXT102','52.99','56.98',true),
      ('3d33db624254ba6b86ebb55b42ed82c2','1168','1370','7686','NXT103','52.99','56.98',false),
      ('bb1e53e72469c9cedcabc47043b077c7','1168','1370','7687','NXT104','52.99','56.98',true),
      ('133773ba1760d54f0148fe0d6d668ed3','1168','1370','7688','NXT105','52.99','56.98',false),
      ('8a3934aa8abca459ea7a116895f9c010','1168','1370','7689','NXT106','52.99','56.98',false),
      ('22ded82de93dcdabc80e44a1d2425719','1168','1370','7690','NXT107','52.99','56.98',true),
      ('80811012b7c3efc35a6a09b9fc66ebd3','1168','1370','7691','NXT108','52.99','56.98',true),
      ('3c6c252d6246858ce0a93e6a102f3d86','1168','1370','7692','NXT109','52.99','56.98',true),
      ('2e098e69d67ebee3ef87a36850b2d47c','1168','1370','7693','NXT110','52.99','56.98',false),
      ('ab8d667514cd88170e26f7959aa7e255','1168','1370','7694','NXT112','52.99','56.98',true),
      ('d9a9bdc8853f29a779e0de8d2fe5b3e4','1169','8736','8740','CEL058','20.49','24.48',true),
      ('35341d6d664a5ea22607323dd84ba443','1169','8736','8741','CEL053','20.49','24.48',true),
      ('2ffd600770d8673546b4ca5b63af5aae','1169','8736','8742','CEL006','20.49','24.48',false),
      ('e9433fe2413909e854426155e6a4abee','1169','8736','8743','CEL007','20.49','24.48',true),
      ('58be8e87931b3f0a006acab8a9626edd','1169','8736','8744','CEL008','20.49','24.48',false),
      ('e2d73fb8ecd8d8c2bd05aa00aa75443e','1169','8736','8745','CEL077','20.49','24.48',true),
      ('b7bb52ca0af4c3ece50bbc48e484529b','1169','8736','8746','CEL078','20.49','24.48',true),
      ('db334e5e86dd1908b0ff5d799abdc817','1169','8736','8747','CEL009','20.49','24.48',true),
      ('d0a49ac2bdd96255763606bc5d03192e','1169','8736','8748',null,'20.49','24.48',true),
      ('38ee05d20169720a356ab8ea9955d413','1169','8736','8749','CEL010','20.49','24.48',true),
      ('b9c8dc508aa898aff5d00541f88f1531','1169','8736','8750','CEL011','20.49','24.48',true),
      ('f884c918a38e2ada888f71de1cb69af9','1169','8736','8751','CEL012','20.49','24.48',false),
      ('e71fcdaa13ea733dcd05bc45a5007d51','1170','8983','8986','PER356','75.49','79.48',true),
      ('7f7b4a9f64e10a495c993e98e296fa1b','1170','8983','8987','PER128','75.49','79.48',false),
      ('a7588fe7cfdaad5013317c1f8a7291ec','1170','8983','8988','PER129','75.49','79.48',false),
      ('5002e67563d5abc162442e528436fbeb','1170','8983','8989','PER116','75.49','79.48',false),
      ('b90a1fcdc446b1431920c94f68aded87','1170','8983','8990','PER085','75.49','79.48',false),
      ('0f7e14ad7c7bbb3ad5ea263530e2b68c','1170','8983','8991','PER081','75.49','79.48',false),
      ('a3b7b34b3d132b699358bde6e1680f9e','1170','8983','8993','PER236','75.49','79.48',false),
      ('d43f340c247edee5cc5ba9a7ace023d3','1170','8983','8994','PER237','75.49','79.48',true),
      ('e47e1590a0445411cd241cca65a87872','1170','8983','8995','PER355','75.49','79.48',false),
      ('2cd8efeec9df1a6f3b1fc11928c0ea24','1170','8983','8996','PER277','75.49','79.48',true),
      ('7ef407c1b331794282c3649af5e56ae0','1170','8983','8997','PER122','75.49','79.48',true),
      ('bee5c33a2afcc1d57343092c38b23930','1170','8983','8998','PER082','75.49','79.48',true),
      ('33431d33f2984ab0aaab0ace46e399b1','1170','8983','8999','PER347','75.49','79.48',false),
      ('66a789283966066d8a21df23c522fee4','1170','8983','9000','PER113','75.49','79.48',true),
      ('1fcbbef838268aed3c6b9c26383f9cdc','1170','8983','9001','PER235','75.49','79.48',true),
      ('d2a2aafca577dad62a5066912ae09cee','1170','8983','9002','PER083','75.49','79.48',false),
      ('c178fc5c2b7b778b8e2b2ade11b7c2cb','1170','8983','9003','PER084','75.49','79.48',true),
      ('3c05846d244574b5600357322a5734e2','1170','8983','9004','PER123','75.49','79.48',false),
      ('81093e1693361cefc56eb4f39d83323b','1171','8752','8757','CEL056','31.49','35.48',true),
      ('f7b7144a84b638a57bd5edaf5a17b40a','1171','8752','8758','CEL014','31.49','35.48',true),
      ('302d8938d9e7ef74a672e72c0f31e848','1171','8752','8759','CEL015','31.49','35.48',true),
      ('cbf76d5ef746ae2f048f0f2855f49fda','1171','8752','8760','CEL016','31.49','35.48',false),
      ('34e9ec3a8a7e78149c1f095bbddb586e','1171','8752','8761','CEL079','31.49','35.48',true),
      ('a65619b8d3d3c1da336c4838cd954048','1171','8752','8762','CEL080','31.49','35.48',true),
      ('9948614d5f6f4ab8179bb6570a6d1c70','1171','8752','8763','CEL017','31.49','35.48',true),
      ('6be36565e166a928c6b8c57a580bc6e9','1171','8752','8764','CEL072','31.49','35.48',true),
      ('8bae8f3faf0eff14d2cbcef10133fc53','1171','8752','8765','CEL018','31.49','35.48',false),
      ('122dd1dc6d0759bc221d147ea190c2c2','1171','8752','8766','CEL019','31.49','35.48',true),
      ('27c9b43670a6ec272e70c65f1c3a0611','1171','8752','8767','CEL020','31.49','35.48',false),
      ('8187469fb273df6890363eb53f28504b','1172','11169','11172','PER450','28.99','32.98',true),
      ('ac1a14aed4ab10ee8ce76a5e51c38ced','1172','11169','11173','PER456','28.99','32.98',false),
      ('797fbd58da13d925814f32d9aec97c9f','1172','11169','11174','PER447','28.99','32.98',true),
      ('b2ab1c97da2a6cfcd41040395c9163d1','1172','11169','11175','PER451','28.99','32.98',true),
      ('6d880e52362d8f6836ed3ac8ea0f2af0','1172','11169','11176','PER448','28.99','32.98',true),
      ('fe4b01c19147eb24ce96b746b4c5db0e','1172','11169','11177','PER454','28.99','32.98',false),
      ('3649316b45e7e8afb4958857d9480e19','1172','11169','11178','PER453','28.99','32.98',true),
      ('247b58cbf4ba1bb8540bf3a0c3ca6680','1172','11169','11179','PER452','28.99','32.98',true),
      ('41cf816251c2b595d4a5bf4d141c936a','1172','11169','11180','PER457','28.99','32.98',false),
      ('f5397b10ee97fe16ae2750afbfabca2e','1172','11169','11181','PER446','28.99','32.98',true),
      ('7619e65e3c2ddcbc8bb18c59378e3417','1172','11169','11182','PER455','28.99','32.98',true),
      ('f7df34d4f6a91c177dfa7dff5dd24c5e','1173','11100','11103','DRK004','15.49','19.48',true),
      ('81663597b83ef9853c5332054289f797','1173','11100','11104','DRK005','15.49','19.48',true),
      ('50e64195bd27aa6dc7f092a6a1b626dd','1173','11100','11105','DRK006','15.49','19.48',true),
      ('1380ad46404d867c6242feffc578e01f','1173','11100','11106','DRK007','15.49','19.48',true),
      ('e74037c10fc39e175df53d7148162f70','1173','11100','11107','DRK008','15.49','19.48',true),
      ('6fdf2e161532a662f596a5924e4a1838','1173','11100','11108','DRK009','15.49','19.48',true),
      ('07b677bde185d1d436906f9e4a367fd0','1173','11100','11109','DRK010','15.49','19.48',true),
      ('b414d6efe5fd9fb50cf4a7a4bd1049ca','1173','11100','11110','DRK011','15.49','19.48',true)
  )
  select exists (
    select 1 from allowed a
    where p_plan#>>'{meta,plan_fingerprint}' = a.fingerprint
      and p_plan#>>'{product,action}' = 'existing'
      and p_plan#>>'{product,id}' = a.product_id
      and p_plan#>>'{product_variant,action}' = 'create_variant'
      and p_plan#>>'{retailer,action}' = 'existing'
      and p_plan#>>'{retailer,id}' = '14'
      and p_plan#>>'{retailer_product,action}' = 'create'
      and p_plan#>>'{retailer_product,values,external_product_id}' = a.external_product_id
      and p_plan#>>'{retailer_product,values,external_variant_id}' = a.external_variant_id
      and case when a.external_sku is null then p_plan#>'{retailer_product,values,external_sku}' = 'null'::jsonb else p_plan#>>'{retailer_product,values,external_sku}' = a.external_sku end
      and p_plan#>'{retailer_product,values,external_gtin}' = 'null'::jsonb
      and p_plan#>'{retailer_product,values,product_variant_id}' = 'null'::jsonb
      and p_plan#>>'{retailer_product,values,external_url}' ~ '^https://www\.10reps\.co\.uk/product/'
      and p_plan#>>'{offer,action}' = 'create'
      and p_plan#>>'{offer,values,url}' = p_plan#>>'{retailer_product,values,external_url}'
      and p_plan#>>'{offer,values,price}' = a.price
      and p_plan#>>'{offer,values,shipping_cost}' = '3.99'
      and p_plan#>>'{offer,values,total_price}' = a.total_price
      and (p_plan#>>'{offer,values,in_stock}')::boolean = a.in_stock
      and p_plan#>>'{price_history,action}' = 'create'
      and p_plan#>'{approval,approved}' = 'false'::jsonb
      and p_plan#>>'{approval,approval_type}' = 'none'
      and p_plan#>'{expected_state,product_variant}' = 'null'::jsonb
      and p_plan#>'{expected_state,retailer_product}' = 'null'::jsonb
      and p_plan#>'{expected_state,offer}' = 'null'::jsonb
  )
$function$;

do $patch_validator$
declare
  v_definition text := pg_get_functiondef('public.atomic_import_validate_variant_plan_core(jsonb)'::regprocedure);
  v_hash text := encode(sha256(convert_to(v_definition, 'UTF8')), 'hex');
  v_old text := 'and not public.atomic_import_10reps_v8_sibling_variant_allowed(p_plan)';
  v_new text := v_old || E'\n     and not public.atomic_import_10reps_v9_sibling_variant_allowed(p_plan)';
begin
  if v_hash <> '81dccdea6055bd710f7697b8a5bbc81111212059d0f77ee46d6461e53b0da1fb' then
    raise exception '10 Reps v9 sibling validator drifted (%)', v_hash;
  end if;
  if (length(v_definition)-length(replace(v_definition,v_old,'')))/length(v_old) <> 2
     or position('atomic_import_10reps_v9_sibling_variant_allowed' in v_definition) > 0 then
    raise exception '10 Reps v9 sibling validator anchor/state mismatch';
  end if;
  execute replace(v_definition,v_old,v_new);
end
$patch_validator$;

alter function public.atomic_import_10reps_v9_sibling_variant_allowed(jsonb) owner to postgres;
alter function public.atomic_import_validate_variant_plan_core(jsonb) owner to postgres;
revoke all on function public.atomic_import_10reps_v9_sibling_variant_allowed(jsonb) from public, anon, authenticated, service_role;

do $postflight$
declare v_definition text := pg_get_functiondef('public.atomic_import_validate_variant_plan_core(jsonb)'::regprocedure);
begin
  if (length(v_definition)-length(replace(v_definition,'atomic_import_10reps_v9_sibling_variant_allowed(p_plan)','')))/length('atomic_import_10reps_v9_sibling_variant_allowed(p_plan)') <> 2
     or has_function_privilege('service_role','public.atomic_import_10reps_v9_sibling_variant_allowed(jsonb)','EXECUTE') then
    raise exception '10 Reps v9 sibling policy verification failed';
  end if;
end
$postflight$;

commit;
