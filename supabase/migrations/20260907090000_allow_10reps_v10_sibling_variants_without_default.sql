begin;

set local lock_timeout = '5s';
set local statement_timeout = '120s';

-- Policy only: allow exactly the 71 owner-reviewed 10 Reps v10 sibling plans.
create or replace function public.atomic_import_10reps_v10_sibling_variant_allowed(p_plan jsonb)
returns boolean
language sql
immutable
set search_path = pg_catalog, public, pg_temp
as $function$
  with allowed(fingerprint,product_id,external_product_id,external_variant_id,external_sku,price,total_price,in_stock) as (
    values
      ('f2cc0fba1fb112e0a701c18ecfdae331','1174','3815','3819',null,'16.99','20.98','true'),
      ('8a9ecd256868ad3359ac0435e7afe7aa','1174','3815','8051',null,'16.99','20.98','true'),
      ('37c59ca84f27e2230584f97014978207','1174','3815','8052',null,'16.99','20.98','true'),
      ('dee201679b7386904a83dfb908611d98','1174','3815','8053',null,'16.99','20.98','true'),
      ('d46555722ea8ba8778202f7374c4ce0c','1175','6092','6096','NXT076','21.49','25.48','true'),
      ('8e68340151b4e9cee328eecdbd9e6c97','1175','6092','6097','NXT094','21.49','25.48','true'),
      ('575d8930ce9dc5f190f59b7e9f4f7135','1175','6092','7654','NXT067','21.49','25.48','true'),
      ('68c9909db45fb172043a34aefe06d578','1175','6092','7655','NXT068','21.49','25.48','false'),
      ('7abd7894fa7cf41e4a2af29399beecbd','1175','6092','7656','NXT069','21.49','25.48','true'),
      ('80f21662178cabe5d351690b99b4075f','1175','6092','7657','NXT070','21.49','25.48','true'),
      ('c22223cba23ce4054f36f24afce63d20','1175','6092','7658','NXT071','21.49','25.48','true'),
      ('194d7fdb133686439dba8b48f80a5ae2','1175','6092','7659','NXT072','21.49','25.48','true'),
      ('b45dc803ce694e9416c3ad3277ef6028','1175','6092','7660','NXT073','21.49','25.48','true'),
      ('235fd0de801e44e3ac4e8cd06ccbf121','1175','6092','7661','NXT074','21.49','25.48','true'),
      ('5ba062d9f171963f327fe04aec580ac6','1175','6092','7662','NXT075','21.49','25.48','true'),
      ('97025594122e65a1574b685c591ee9f2','1175','6092','7663','NXT077','21.49','25.48','true'),
      ('bcc6924be3f999e4efefb35f1ab45211','1175','6092','7664','NXT078','21.49','25.48','true'),
      ('b6538c1df28d5142f5a1b60715b8d3e0','1175','6092','7665','NXT079','21.49','25.48','true'),
      ('e1f394432dde85bb040c60d0ebbde52d','1175','6092','7666','NXT080','21.49','25.48','true'),
      ('8c109340dcc051325c92e818aa02857e','1175','6092','7667','NXT081','21.49','25.48','true'),
      ('190b4b1f3069ff7c6f067096b567f7b2','1175','6092','7668','NXT082','21.49','25.48','true'),
      ('31e58bd47649ca5545dbb519cdd4ecfb','1175','6092','7669','NXT083','21.49','25.48','true'),
      ('831f9a310c01d746d254c1ee276f8dac','1175','6092','7670','NXT084','21.49','25.48','true'),
      ('05d39acfbfc0fb7114f77c1993a442d7','1175','6092','7671','NXT085','21.49','25.48','true'),
      ('ab4c510090d98b596e504c399d3c3755','1175','6092','7672','NXT086','21.49','25.48','true'),
      ('006bff3047f624d5ef36c5c66a41362f','1175','6092','7673','NXT087','21.49','25.48','true'),
      ('1d3fb0e61a798720ce2b1de4d8d4ac11','1175','6092','7674','NXT088','21.49','25.48','true'),
      ('40bcf77b6b7d4bc8324a4b948fb9c374','1175','6092','7675','NXT089','21.49','25.48','true'),
      ('f87fe991ed5b593ce15a512680a47476','1175','6092','7676','NXT090','21.49','25.48','true'),
      ('4ef74fd7987e90328a409c7ad479f52e','1175','6092','7677','NXT091','21.49','25.48','true'),
      ('736d383275383ede1ee4297ef88aee72','1175','6092','7678','NXT092','21.49','25.48','true'),
      ('9a803bc8f2caab2b9cc8fdff3745b18c','1175','6092','7679','NXT093','21.49','25.48','true'),
      ('7c077af6575b123059f0a34387b345cd','1175','6092','9669','NXT214','21.49','25.48','true'),
      ('5fdfbd241f7c615a08e343a6e4811480','1176','6100','6105','NXT131','35.99','39.98','true'),
      ('3617a0eb37813cbc33e01927ad841a98','1176','6100','6106',null,'35.99','39.98','true'),
      ('48be951422f1be2f93376e709d644696','1176','6100','7696','NXT133','35.99','39.98','true'),
      ('0a20180155a58c30a664d5eecc380154','1176','6100','7697','NXT134','35.99','39.98','true'),
      ('a9cb924c07c7936429b6a32b48dd8316','1176','6100','7698','NXT136','35.99','39.98','true'),
      ('8fb1a5ee2c4bb81bbfb4cd3243b9c442','1177','9486','9489','APP659','17.99','21.98','true'),
      ('2bc673a4c0374959e7ed9fbd452f297f','1177','9486','9490','APP660','17.99','21.98','true'),
      ('6d0219470b1907d5dbc4534eab578394','1177','9486','9491','APP320','17.99','21.98','true'),
      ('d2ca9b4cbcbec1fed1b48b5ca802b3f7','1177','9486','9492','APP319','17.99','21.98','true'),
      ('d7bfcf75c51ba628d7cd82ea18c5cb35','1177','9486','9493','APP321','17.99','21.98','true'),
      ('a26e1c157f0a6469d43b23191d99edfb','1178','9670','9672','NXT207','21.49','25.48','true'),
      ('d067b9553269fdab4c9f02e41c1b70a7','1178','9670','9673','NXT208','21.49','25.48','true'),
      ('587241bd179c4ffb9002f6e5bc866d1f','1178','9670','9674','NXT209','21.49','25.48','true'),
      ('dd6494d7c149fd3332c10b9957e3d28c','1178','9670','9675','NXT210','21.49','25.48','true'),
      ('2798d2aad775eca5e377b63c543a9b16','1178','9670','9676','NXT211','21.49','25.48','true'),
      ('084cedb2f87aef866b8ddcc46ab0fcb9','1178','9670','9677','NXT212','21.49','25.48','true'),
      ('2ef5008d34ba0ae6b6ff4582cc86f4bc','1179','10115','10118','GRA010','15.99','19.98','true'),
      ('87352f87563818f087dacfcc15c7f36c','1179','10115','10119','GRA014','15.99','19.98','false'),
      ('b2d005ef844b7defaef76ae421c2a520','1179','10115','10120','GRA011','15.99','19.98','true'),
      ('d93835c723ff114199dd3fb9b8680f2b','1179','10115','10121','GRA015','15.99','19.98','true'),
      ('1728c2a99c2239563bf547b195fe6389','1179','10115','10122','GRA012','15.99','19.98','false'),
      ('6f7d7a8b3976c76785872c4a0b82ac96','1179','10115','10123','GRA013','15.99','19.98','true'),
      ('16dea9f0d6cae21af0d371bb9b136b2c','1179','10115','10124','GRA016','15.99','19.98','true'),
      ('d8c7904ca280cecaf95dfd841fb909ea','1180','10392','10395','RNU152','15.99','19.98','true'),
      ('74d7d4c442a33914833a75433895b605','1180','10392','10396','RNU155','15.99','19.98','true'),
      ('121e8ab93c7a5e3e4badf500cfff04c6','1180','10392','10397','RNU156','15.99','19.98','true'),
      ('36669037bf5cbbe3d26b3c246de2d5ec','1180','10392','10398','RNU150','15.99','19.98','true'),
      ('5589afbb5f276a0e03abea7beb6471a1','1180','10392','10399','RNU151','15.99','19.98','true'),
      ('4ac97d58de1f7d75c2e657803a345760','1180','10392','10400','RNU157','15.99','19.98','true'),
      ('048aee98ba66d1a1690192d4011c13c8','1180','10392','10401','RNU153','15.99','19.98','true'),
      ('874ab37331bfe88d150ff4e9816fc43f','1181','11134','11137','DRK017','27.49','31.48','false'),
      ('e435ac919d3ef054d9651d48b2472186','1181','11134','11138','DRK018','27.49','31.48','true'),
      ('a9446ff4177172992e7701f93f759463','1181','11134','11139','DRK019','27.49','31.48','true'),
      ('343a37298fa2175b4915de3e01b79d63','1181','11134','11140','DRK020','27.49','31.48','true'),
      ('45dd1b6fd5322c3075682fb33ff6ca0e','1181','11134','11141','DRK021','27.49','31.48','true'),
      ('7da92d29855a48c8c8283f9284c64181','1181','11134','11142','DRK022','27.49','31.48','true'),
      ('a20196e911811697b52b7770bab1a9fc','1181','11134','11143','DRK023','27.49','31.48','true'),
      ('9e00dd32404ffdae6629c6b0c5790f7b','1181','11134','11144','DRK024','27.49','31.48','true')
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
  v_old text := 'and not public.atomic_import_10reps_v9_sibling_variant_allowed(p_plan)';
  v_new text := v_old || E'\n     and not public.atomic_import_10reps_v10_sibling_variant_allowed(p_plan)';
begin
  if v_hash <> '2b79e280113dc1561da535f940718171ff695b11c8d6eb4364385411b8903571' then
    raise exception '10 Reps v10 sibling validator drifted (%)', v_hash;
  end if;
  if (length(v_definition)-length(replace(v_definition,v_old,'')))/length(v_old) <> 2
     or position('atomic_import_10reps_v10_sibling_variant_allowed' in v_definition) > 0 then
    raise exception '10 Reps v10 sibling validator anchor/state mismatch';
  end if;
  execute replace(v_definition,v_old,v_new);
end
$patch_validator$;

alter function public.atomic_import_10reps_v10_sibling_variant_allowed(jsonb) owner to postgres;
alter function public.atomic_import_validate_variant_plan_core(jsonb) owner to postgres;
revoke all on function public.atomic_import_10reps_v10_sibling_variant_allowed(jsonb) from public, anon, authenticated, service_role;

do $postflight$
declare v_definition text := pg_get_functiondef('public.atomic_import_validate_variant_plan_core(jsonb)'::regprocedure);
begin
  if (length(v_definition)-length(replace(v_definition,'atomic_import_10reps_v10_sibling_variant_allowed(p_plan)','')))/length('atomic_import_10reps_v10_sibling_variant_allowed(p_plan)') <> 2
     or has_function_privilege('service_role','public.atomic_import_10reps_v10_sibling_variant_allowed(jsonb)','EXECUTE') then
    raise exception '10 Reps v10 sibling policy verification failed';
  end if;
end
$postflight$;

commit;
