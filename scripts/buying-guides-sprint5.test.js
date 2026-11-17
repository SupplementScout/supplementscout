const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const Module = require("node:module");
const test = require("node:test");
const ts = require("typescript");
const React = require("react");
const { renderToStaticMarkup } = require("react-dom/server");
const root = path.resolve(__dirname, "..");
// Reuse the existing guide tests' database-free TypeScript module harness.
function load(file, overrides = {}) {
  const modules = new Map();
  function compile(filename) {
    filename = path.resolve(filename); if (modules.has(filename)) return modules.get(filename).exports;
    const mod = new Module(filename, module); modules.set(filename, mod);
    mod.filename = filename; mod.paths = Module._nodeModulePaths(path.dirname(filename));
    mod.require = name => {
      if (Object.hasOwn(overrides, name)) return overrides[name];
      if (name === "server-only") return {};
      if (name === "next/link") return { __esModule:true, default:({children,href,...props})=>React.createElement("a",{href,...props},children) };
      if (name === "next/cache") return { unstable_cache: read => read };
      if (name.endsWith("/supabase")) return { supabase:{from:()=>{throw new Error("Unexpected live read in test");}} };
      if (name.endsWith("/supabaseAdmin")) return { supabaseAdmin:{from:()=>{throw new Error("Unexpected privileged read in test");}} };
      if (name.startsWith(".")) for (const ext of [".ts",".tsx"]) { const target=path.resolve(path.dirname(filename),name)+ext; if(fs.existsSync(target))return compile(target); }
      return Module.prototype.require.call(mod,name);
    };
    mod._compile(ts.transpileModule(fs.readFileSync(filename,"utf8"), {fileName:filename,compilerOptions:{esModuleInterop:true,jsx:ts.JsxEmit.ReactJSX,module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText,filename);
    return mod.exports;
  }
  return compile(path.join(root,file));
}
const model=load("app/lib/purchaseDecisionGuides.ts"),now=new Date("2026-11-17T20:30:00Z");
const massFile="app/guides/mass-gainer-vs-whey-protein/page.tsx",creatineFile="app/guides/creatine-pack-size-value/page.tsx";
// TEST ONLY offers/nutrition: these fixtures are never actual-data or production evidence.
function product(target,{price=20,shipping=0,nutrition=target.id===model.EFECTIV_WHEY.id}={}){
  return {id:target.id,slug:target.slug,name:target.expectedName,brand:target.brand,
    category:target.id===model.HYPER_MASS.id?"Mass Gainer":target.id===model.EFECTIV_WHEY.id?"Whey Protein":"Creatine",
    image:null,product_format:"powder",net_weight_g:target.grams,net_volume_ml:null,unit_count:null,unit_type:null,
    serving_count_verified:target.grams/25,serving_size_g:25,protein_per_serving_g:20,creatine_per_serving_g:null,
    unit_pricing_verified:true,nutrition_verified:true,is_active:true,merged_at:null,merged_into_product_id:null,
    offers:[{id:target.variantId,retailer_product_id:target.variantId,price,shipping_cost:shipping,in_stock:true,last_checked_at:"2026-11-17T20:00:00Z",url:"https://retailer.example/item",
      retailer:{id:1,name:"TEST ONLY retailer",slug:"test"},variant_resolution:"resolved",
      product_variant:{id:target.variantId,product_id:target.id,display_name:`${target.flavour} / ${target.grams}g`,flavour_label:target.flavour,
        pack_count:1,size_value:target.grams,size_unit:"g",product_format:"powder",is_active:true,
        nutrition_override:nutrition?{net_weight_g:target.grams,serving_count_verified:target.grams/25,serving_size_g:25,protein_per_serving_g:20,
          nutrition_verified:true,unit_pricing_verified:true,product_format:"powder",creatine_per_serving_g:null,source_type:"manufacturer_product_page",
          source_url:"https://manufacturer.example/label",evidence:"TEST ONLY reviewed exact-variant fixture; never production evidence."}:{} }}]};
}
function pairRows({appliedSmall=17.89,appliedLarge=30,optimumSmall=19.99,optimumLarge=40}={}){
  return [[model.APPLIED_SMALL,model.APPLIED_LARGE,appliedSmall,appliedLarge],[model.OPTIMUM_SMALL,model.OPTIMUM_LARGE,optimumSmall,optimumLarge]].map(([small,large,a,b])=>{
    const row=product(small,{price:a});row.offers.push(...product(large,{price:b}).offers);return row;
  });
}
const html=(file,rows)=>renderToStaticMarkup(React.createElement(load(file)[file===massFile?"MassWheyGuideContent":"CreatinePackGuideContent"],{result:{rows,error:false},now}));
test("mass/whey examples retain exact distinct products, known delivered prices and approved own protein only",()=>{
  const rows=model.MASS_WHEY_TARGETS.map(t=>product(t,{price:20,shipping:4.99})),examples=model.massWheyExamples(rows,now);
  assert.equal(examples.length,2);assert.equal(new Set(examples.map(e=>e.row.id)).size,2);assert.equal(new Set(examples.map(e=>e.row.brand)).size,2);
  assert.equal(examples[0].offer.deliveredPrice.totalPrice,24.99);assert.equal(examples[0].row.pricePerKg,6.2475);
  assert.equal(examples[0].nutritionApproved,false);assert.equal(examples[0].row.costPer25gProtein,null);
  assert.equal(examples[1].nutritionApproved,true);assert.equal(examples[1].totalProteinG,1600);assert.equal(examples[1].row.costPer25gProtein,24.99/1600*25);
});
test("changed product, name, brand, category or active identity fails closed",()=>{
  for(const mutate of [p=>p.id="wrong",p=>p.slug="another",p=>p.name="Another gainer formula",p=>p.brand="Another brand",p=>p.category="Whey Protein",p=>p.is_active=false,p=>p.merged_into_product_id=1,p=>p.merged_at="2026-01-01"]){
    const p=product(model.HYPER_MASS);mutate(p);assert.deepEqual(model.massWheyExamples([p],now),[]);
  }
});
test("another variant, flavour, weight, format or multipack never substitutes the reviewed pin",()=>{
  for(const mutate of [v=>v.id="another",v=>v.product_id="another",v=>v.flavour_label="Chocolate",v=>v.size_value=2000,v=>v.size_unit="kg",v=>v.pack_count=2,v=>v.product_format="capsule",v=>v.is_active=false]){
    const p=product(model.HYPER_MASS);mutate(p.offers[0].product_variant);assert.deepEqual(model.massWheyExamples([p],now),[]);
  }
  const unresolved=product(model.EFECTIV_WHEY);unresolved.offers[0].variant_resolution="unresolved";assert.deepEqual(model.massWheyExamples([unresolved],now),[]);
});
test("stale, OOS, invalid timestamps, unknown delivery and unusable prices never become guide offers",()=>{
  for(const mutate of [o=>o.in_stock=false,o=>o.last_checked_at="2026-11-15T00:00:00Z",o=>o.last_checked_at="bad",o=>o.last_checked_at=null,o=>o.shipping_cost=null,o=>o.price=0,o=>o.price=null]){
    const p=product(model.EFECTIV_WHEY);mutate(p.offers[0]);assert.deepEqual(model.massWheyExamples([p],now),[]);
  }
});
test("the chosen offer uses the lowest known delivered total for the exact variant",()=>{
  const p=product(model.HYPER_MASS,{price:15,shipping:9}),second=structuredClone(p.offers[0]);
  second.id="second";second.retailer.id=2;second.price=20;second.shipping_cost=1;p.offers.push(second);
  const unknown=structuredClone(second);unknown.id="unknown";unknown.price=1;unknown.shipping_cost=null;p.offers.push(unknown);
  const e=model.massWheyExamples([p],now)[0];assert.equal(e.offer.id,"second");assert.equal(e.offer.deliveredPrice.totalPrice,21);
});
test("parent, missing, unapproved and pack-misaligned nutrition never fills the exact-variant gap",()=>{
  for(const mutate of [v=>v.nutrition_override={},v=>v.nutrition_override.nutrition_verified=false,v=>v.nutrition_override.serving_count_verified=1,v=>delete v.nutrition_override.source_url]){
    const p=product(model.EFECTIV_WHEY);mutate(p.offers[0].product_variant);const e=model.massWheyExamples([p],now)[0];
    assert.ok(e);assert.equal(e.nutritionApproved,false);assert.equal(e.totalProteinG,null);assert.equal(e.row.costPer25gProtein,null);
  }
});
test("unverified weight hides the mass unit metric without inventing a kilogram price",()=>{
  const p=product(model.HYPER_MASS);p.unit_pricing_verified=false;const e=model.massWheyExamples([p],now)[0];
  assert.equal(e.row.pricePerKg,null);assert.match(html(massFile,[p]),/verified powder-weight unit price is not available/);
});
test("two creatine families bind each pair to its own same-parent same-flavour verified sizes",()=>{
  const pairs=model.creatinePackComparisons(pairRows(),now);assert.equal(pairs.length,2);
  for(const p of pairs){assert.equal(p.small.row.id,p.large.row.id);assert.equal(p.small.variant.flavour_label,p.large.variant.flavour_label);assert.equal(p.small.variant.pack_count,1);assert.equal(p.large.variant.pack_count,1);assert.equal(p.small.nutritionApproved,false);assert.equal(p.large.nutritionApproved,false);}
  assert.equal(pairs[0].small.row.netWeightG,250);assert.equal(pairs[0].large.row.netWeightG,500);
  assert.equal(pairs[1].small.row.netWeightG,317);assert.equal(pairs[1].large.row.netWeightG,634);
});
test("bigger is not automatically cheaper: exact cash and unrounded unit costs cover both winners and ties",()=>{
  const [a,b]=model.creatinePackComparisons(pairRows(),now);
  assert.equal(a.unitWinner,"larger");assert.equal(a.upfrontDifference,12.11);assert.ok(Math.abs(a.unitDifference-11.56)<1e-9);
  assert.equal(b.unitWinner,"smaller");assert.equal(b.upfrontDifference,20.01);assert.ok(Math.abs(b.unitDifference-(40/.634-19.99/.317))<1e-9);
  const tie=model.creatinePackComparisons(pairRows({appliedSmall:20,appliedLarge:40}),now)[0];assert.equal(tie.unitWinner,"tie");assert.equal(tie.unitDifference,0);
});
test("a missing, wrong, stale or unverified side removes only its incomplete family",()=>{
  for(const mutate of [p=>p.offers.pop(),p=>p.offers[1].in_stock=false,p=>p.offers[1].last_checked_at="2026-01-01",p=>p.offers[1].shipping_cost=null,p=>p.offers[1].product_variant.flavour_label="Cherry & Apple",p=>p.offers[1].product_variant.size_value=1000,p=>p.offers[1].product_variant.pack_count=2,p=>p.unit_pricing_verified=false]){
    const rows=pairRows();mutate(rows[0]);const pairs=model.creatinePackComparisons(rows,now);assert.deepEqual(pairs.map(p=>p.key),["optimum"]);
  }
});
test("a valid cached response ages out at rendering without fabricated or stale prices",()=>{
  const later=new Date("2026-11-19T00:00:00Z");assert.deepEqual(model.creatinePackComparisons(pairRows(),later),[]);
  assert.deepEqual(model.massWheyExamples(model.MASS_WHEY_TARGETS.map(t=>product(t)),later),[]);
});
test("initial server HTML has real calculation structure, exact links, timestamps and no unsupported dose figures",()=>{
  const a=html(massFile,model.MASS_WHEY_TARGETS.map(t=>product(t))),b=html(creatineFile,pairRows());
  for(const body of [a,b]){assert.equal((body.match(/<h1\b/g)||[]).length,1);assert.match(body,/dateTime="2026-11-17T20:00:00Z"/);}
  assert.match(a,/variant=1196/);assert.match(a,/variant=2223/);assert.equal((a.match(/<dt>Cost per 25 g protein<\/dt>/g)||[]).length,1);
  for(const id of ["799","4559","783","4614"])assert.match(b,new RegExp("variant="+id));
  assert.match(b,/£12\.11/);assert.match(b,/£20\.01/);assert.match(b,/£11\.56/);assert.match(b,/£0\.03/);assert.doesNotMatch(b,/<dt>Cost per 5 g/);
});
test("empty and partial selections retain useful decisions and honest limitations",()=>{
  assert.match(html(massFile,[]),/No current selected example passes/);assert.match(html(massFile,[product(model.HYPER_MASS)]),/Only one of the selected examples currently qualifies/);
  assert.match(html(creatineFile,[]),/No complete current pair passes/);
  for(const file of [massFile,creatineFile])assert.match(html(file,[]),/<ol class="mt-4 list-decimal/);
});
test("approved metadata is database-free, index/follow with self-canonical and factual schema; parameters remain noindex",async()=>{
  for(const [file,route] of [[massFile,model.MASS_WHEY_GUIDE_PATH],[creatineFile,model.CREATINE_PACK_GUIDE_PATH]]){
    const p=load(file),m=await p.generateMetadata();assert.deepEqual(m.robots,{index:true,follow:true});assert.equal(m.alternates.canonical,route);
    const parameter=await p.generateMetadata({searchParams:Promise.resolve({sort:"price"})});assert.deepEqual(parameter.robots,{index:false,follow:true});assert.equal(parameter.alternates.canonical,route);
    const schema=JSON.parse(html(file,[]).match(/<script type="application\/ld\+json">(.*?)<\/script>/s)[1]);
    assert.deepEqual(schema["@graph"].map(n=>n["@type"]),["WebPage","BreadcrumbList"]);assert.equal(schema["@graph"][0].url,"https://www.supplementscout.co.uk"+route);
    assert.doesNotMatch(JSON.stringify(schema),/ratingValue|Article|FAQPage|datePublished|author/);
  }
});
test("both pages deduplicate bounded reads through existing distinct lifecycle cache keys and fail read errors closed",async()=>{
  const keys=[];
  for(const [file,route] of [[massFile,model.MASS_WHEY_GUIDE_PATH],[creatineFile,model.CREATINE_PACK_GUIDE_PATH]]){
    let reads=0;const page=load(file,{"../../lib/buyingGuideData":{getBuyingGuideProducts:async slugs=>{reads++;assert.equal(slugs.length,2);assert.equal(new Set(slugs).size,2);return{rows:[],error:true};}},
      "../../lib/lifecycleDataCache":{createLifecycleDataLoader:(path,key,read)=>{keys.push({path,key});return read;}}});
    await assert.rejects(page.default(),/temporarily unavailable/);assert.equal(reads,1);assert.equal(keys.at(-1).path,route);
  }
  assert.equal(new Set(keys.map(k=>k.key)).size,2);
});
test("sitemap includes each approved route once and all previous guide/SEO lifecycles remain live",()=>{
  const lifecycle=load("app/lib/indexabilityLifecycle.ts"),sitemap=fs.readFileSync(path.join(root,"app/sitemap.ts"),"utf8");
  for(const route of [model.MASS_WHEY_GUIDE_PATH,model.CREATINE_PACK_GUIDE_PATH]){assert.equal(lifecycle.getLifecycleStatus(route),"launch_approved");assert.equal(lifecycle.isLifecycleSitemapEligible(route),true);assert.equal(sitemap.split(route).length-1,1);}
  for(const route of ["/brands/per4m","/creatine","/guides/supplement-prices-including-delivery","/guides/cost-per-25g-protein","/guides/protein-powder-under-30","/guides/caffeine-free-pre-workout","/guides/whey-isolate-vs-concentrate","/guides/protein-powder-pack-size-value"])assert.equal(lifecycle.getLifecycleStatus(route),"live_verified");
});
test("natural incoming and conversion links are crawlable and keep existing product-page retailer tracking",()=>{
  for(const [file,route] of [["app/mass-gainer/page.tsx",model.MASS_WHEY_GUIDE_PATH],["app/creatine/page.tsx",model.CREATINE_PACK_GUIDE_PATH]])assert.equal(fs.readFileSync(path.join(root,file),"utf8").split('href="'+route+'"').length-1,1);
  const a=html(massFile,[]),b=html(creatineFile,[]);
  for(const href of ["/mass-gainer","/whey-protein","/compare","/guides/cost-per-25g-protein","/guides/supplement-prices-including-delivery"])assert.ok(a.includes('href="'+href+'"'));
  for(const href of ["/creatine","/creatine#under-20","/compare","/guides/supplement-prices-including-delivery"])assert.ok(b.includes('href="'+href+'"'));
  const card=fs.readFileSync(path.join(root,"app/components/PurchaseGuideExample.tsx"),"utf8");assert.match(card,/href=\{example.productUrl\}/);assert.doesNotMatch(card,/"use client"|offer\.url|window\.|useEffect/);
});
module.exports={load,product,pairRows,model,now,massFile,creatineFile};
