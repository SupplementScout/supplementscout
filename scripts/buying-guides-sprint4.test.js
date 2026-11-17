const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const Module = require("node:module");
const test = require("node:test");
const ts = require("typescript");
const React = require("react");
const { renderToStaticMarkup } = require("react-dom/server");
const root = path.resolve(__dirname, "..");
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
const model = load("app/lib/proteinValueGuides.ts");
const now = new Date("2026-11-17T18:00:00Z");
const typeFile = "app/guides/whey-isolate-vs-concentrate/page.tsx";
const packFile = "app/guides/protein-powder-pack-size-value/page.tsx";
// TEST ONLY offers/nutrition; never used as actual-source or deployment proof.
function product(target, { nutrition = true, price = 20, shipping = 3.99 } = {}) {
  return { id:target.id,slug:target.slug,name:target.expectedName,brand:target.brand,category:"Whey Protein",image:null,
    product_format:"powder",net_weight_g:target.grams,net_volume_ml:null,unit_count:null,unit_type:null,
    serving_count_verified:target.grams/25,serving_size_g:25,protein_per_serving_g:20,
    unit_pricing_verified:true,nutrition_verified:true,is_active:true,merged_at:null,merged_into_product_id:null,
    offers:[{id:target.variantId,retailer_product_id:target.variantId,price,shipping_cost:shipping,in_stock:true,last_checked_at:"2026-11-17T17:00:00Z",url:"https://retailer.example/item",
      retailer:{id:1,name:"TEST ONLY retailer",slug:"test"},variant_resolution:"resolved",
      product_variant:{id:target.variantId,product_id:target.id,display_name:`${target.flavour} / ${target.grams}g`,flavour_label:target.flavour,
        pack_count:1,size_value:target.grams,size_unit:"g",product_format:"powder",is_active:true,
        nutrition_override:nutrition?{net_weight_g:target.grams,serving_count_verified:target.grams/25,serving_size_g:25,protein_per_serving_g:20,
          nutrition_verified:true,unit_pricing_verified:true,product_format:"powder",creatine_per_serving_g:null,source_type:"manufacturer_product_page",
          source_url:"https://manufacturer.example/label",evidence:"TEST ONLY exact-variant reviewed label fixture; not production evidence."}:{} }}] };
}
function pairRows({ smallNutrition = false, smallPrice = 30, largePrice = 85.52, shipping = 0 } = {}) {
  const large = product(model.LARGE_ISOLATE,{price:largePrice,shipping});
  large.offers.push(...product(model.SMALL_ISOLATE,{nutrition:smallNutrition,price:smallPrice,shipping}).offers);
  return [large];
}
function html(file,rows) {
  const page=load(file),Component=file===typeFile?page.WheyTypeGuideContent:page.PackValueGuideContent;
  return renderToStaticMarkup(React.createElement(Component,{result:{rows,error:false},now}));
}

test("only the source-reviewed exact isolate and concentrate identities receive their types",()=>{
  const rows=model.WHEY_TYPE_TARGETS.map(t=>product(t));
  assert.deepEqual(model.wheyTypeExamples(rows,now).map(e=>e.proteinType),["Whey concentrate","Whey isolate"]);
  assert.ok(model.wheyTypeExamples(rows,now).every(e=>/^https:\/\//.test(e.source)));
  rows[0].id="999"; rows[0].name="Premium whey protein concentrate";
  assert.equal(model.wheyTypeExamples(rows,now).length,1);
});
test("blend wording, another formula, brand or canonical identity cannot inherit a reviewed type",()=>{
  for(const patch of [{name:"Whey isolate and concentrate blend"},{name:"Applied Nutrition Critical Whey"},{brand:"Another brand"},{slug:"another-product"},{category:"Vegan Protein"}]){
    const p=product(model.LARGE_ISOLATE);Object.assign(p,patch);assert.deepEqual(model.wheyTypeExamples([p],now),[]);
  }
});
test("exact flavour, size, pack count, parent, variant ID and powder form are mandatory",()=>{
  for(const patch of [{flavour_label:"Chocolate"},{size_value:900},{pack_count:2},{product_id:999},{id:999},{product_format:"liquid"},{is_active:false},{size_unit:"kg"}]){
    const p=product(model.CONCENTRATE);Object.assign(p.offers[0].product_variant,patch);assert.deepEqual(model.wheyTypeExamples([p],now),[]);
  }
  const p=product(model.CONCENTRATE);p.offers[0].variant_resolution="unresolved";assert.deepEqual(model.wheyTypeExamples([p],now),[]);
});
test("OOS, stale, invalid-date, unknown shipping, inactive and merged examples are excluded",()=>{
  for(const patch of [{in_stock:false},{last_checked_at:"2026-11-15T00:00:00Z"},{last_checked_at:"invalid"},{shipping_cost:null},{price:null}]){
    const p=product(model.CONCENTRATE);Object.assign(p.offers[0],patch);assert.deepEqual(model.wheyTypeExamples([p],now),[]);
  }
  for(const patch of [{is_active:false},{merged_at:"2026-11-16T00:00:00Z"},{merged_into_product_id:77}]){
    const p=product(model.CONCENTRATE);Object.assign(p,patch);assert.deepEqual(model.wheyTypeExamples([p],now),[]);
  }
});
test("known zero delivery is allowed and delivered prices include shipping in exact pence",()=>{
  const p=product(model.CONCENTRATE,{price:19.99,shipping:4.99});
  assert.equal(model.wheyTypeExamples([p],now)[0].offer.deliveredPrice.totalPrice,24.98);
  p.offers[0].shipping_cost=0;assert.equal(model.wheyTypeExamples([p],now)[0].offer.deliveredPrice.totalPrice,19.99);
});
test("nutrition needs exact reviewed evidence; manufacturer classification never approves amounts",()=>{
  const p=product(model.CONCENTRATE,{nutrition:false});const e=model.wheyTypeExamples([p],now)[0];
  assert.equal(e.nutritionApproved,false);assert.equal(model.hasProteinValue(e),false);assert.equal(e.row.costPer25gProtein,null);
  assert.match(html(typeFile,[p]),/not yet supported by approved nutrition/);
  const good=model.wheyTypeExamples([product(model.LARGE_ISOLATE,{price:85.52,shipping:0})],now)[0];
  assert.equal(model.hasProteinValue(good),true);assert.ok(Math.abs(good.row.costPer25gProtein-1.4847222222222223)<1e-10);
});
test("pack comparison matches one formula/flavour across two exact sizes",()=>{
  const pair=model.packValueComparison(pairRows(),now);assert.ok(pair);
  assert.equal(pair.small.variant.id,model.SMALL_ISOLATE.variantId);assert.equal(pair.small.row.netWeightG,450);
  assert.equal(pair.large.row.netWeightG,1800);assert.equal(pair.unitWinner,"larger");
  assert.equal(pair.upfrontDifference,55.52);assert.ok(Math.abs(pair.unitDifference-19.155555555555565)<1e-10);
  assert.equal(pair.bothProteinVerified,false);
});
test("size comparison rejects another flavour, formula, pack count and unverified mass",()=>{
  for(const patch of [{flavour_label:"Banana"},{product_id:999},{pack_count:2},{size_value:1000},{product_format:"food"}]){
    const rows=pairRows();Object.assign(rows[0].offers[1].product_variant,patch);assert.equal(model.packValueComparison(rows,now),null);
  }
  const rows=pairRows();rows[0].unit_pricing_verified=false;rows[0].offers[0].product_variant.nutrition_override.unit_pricing_verified=false;
  assert.equal(model.packValueComparison(rows,now),null);
});
test("a missing, stale or unavailable side cannot become a complete matched pair",()=>{
  assert.equal(model.packValueComparison([],now),null);
  for(const patch of [{in_stock:false},{last_checked_at:"2026-11-15T00:00:00Z"},{shipping_cost:null}]){
    const rows=pairRows();Object.assign(rows[0].offers[1],patch);assert.equal(model.packValueComparison(rows,now),null);
  }
});
test("larger, smaller and equal unit-cost outcomes use unrounded cents and grams",()=>{
  assert.equal(model.packValueComparison(pairRows({smallPrice:10,largePrice:39}),now).unitWinner,"larger");
  assert.equal(model.packValueComparison(pairRows({smallPrice:10,largePrice:41}),now).unitWinner,"smaller");
  assert.equal(model.packValueComparison(pairRows({smallPrice:10,largePrice:40}),now).unitWinner,"tie");
  const near=model.packValueComparison(pairRows({smallPrice:44.98,largePrice:179.93}),now);
  assert.equal(near.small.row.pricePerKg.toFixed(2),near.large.row.pricePerKg.toFixed(2));assert.equal(near.unitWinner,"smaller");
});
test("protein unit costs for the size pair appear only when both exact records qualify",()=>{
  const missing=html(packFile,pairRows());assert.match(missing,/withheld for this size comparison/);assert.doesNotMatch(missing,/<dt>Protein per serving/);
  const approved=html(packFile,pairRows({smallNutrition:true}));assert.equal((approved.match(/<dt>Protein per serving/g)||[]).length,2);
  assert.equal(model.packValueComparison(pairRows({smallNutrition:true}),now).bothProteinVerified,true);
});
test("cached offers still age out at render time without changing lifecycle",()=>{
  assert.deepEqual(model.wheyTypeExamples(model.WHEY_TYPE_TARGETS.map(t=>product(t)),new Date("2026-11-19T00:00:00Z")),[]);
  assert.equal(model.packValueComparison(pairRows(),new Date("2026-11-19T00:00:00Z")),null);
});
test("server HTML includes exact links, timestamps, real calculations and useful empty states",()=>{
  const a=html(typeFile,model.WHEY_TYPE_TARGETS.map(t=>product(t))),b=html(packFile,pairRows());
  for(const body of [a,b]){assert.equal((body.match(/<h1\b/g)||[]).length,1);assert.match(body,/dateTime="2026-11-17T17:00:00Z"/);assert.match(body,/variant=735/);}
  assert.match(b,/variant=4613/);assert.match(b,/£55\.52/);assert.match(b,/£19\.16/);
  assert.match(html(typeFile,[]),/No current selected example passes/);assert.match(html(packFile,[]),/No complete current pair passes/);
});
test("planned metadata is database-free, noindex/follow with self-canonicals and factual schema",async()=>{
  for(const [file,route] of [[typeFile,model.WHEY_TYPE_GUIDE_PATH],[packFile,model.PACK_VALUE_GUIDE_PATH]]){
    const page=load(file),m=await page.generateMetadata();assert.deepEqual(m.robots,{index:false,follow:true});assert.equal(m.alternates.canonical,route);
    assert.deepEqual((await page.generateMetadata({searchParams:Promise.resolve({sort:"price"})})).robots,m.robots);
    const schema=JSON.parse(html(file,[]).match(/<script type="application\/ld\+json">(.*?)<\/script>/s)[1]);
    assert.deepEqual(schema["@graph"].map(n=>n["@type"]),["WebPage","BreadcrumbList"]);assert.equal(schema["@graph"][0].url,"https://www.supplementscout.co.uk"+route);
    assert.doesNotMatch(JSON.stringify(schema),/Article|FAQPage|ratingValue|datePublished|author/);
  }
});
test("read errors fail closed; both loaders batch through existing catalogue/resolver cache",async()=>{
  for(const [file,route,slugs] of [[typeFile,model.WHEY_TYPE_GUIDE_PATH,2],[packFile,model.PACK_VALUE_GUIDE_PATH,1]]){
    let reads=0;const keys=[];
    const page=load(file,{"../../lib/buyingGuideData":{getBuyingGuideProducts:async list=>{reads++;assert.equal(list.length,slugs);return{rows:[],error:true};}},
      "../../lib/lifecycleDataCache":{createLifecycleDataLoader:(path,key,read)=>{keys.push({path,key});return read;}}});
    await assert.rejects(page.default(),/temporarily unavailable/);assert.equal(reads,1);assert.equal(keys[0].path,route);
  }
});
test("sitemap excludes the two planned candidates and existing live routes stay verified",()=>{
  const lifecycle=load("app/lib/indexabilityLifecycle.ts"),sitemap=fs.readFileSync(path.join(root,"app/sitemap.ts"),"utf8");
  for(const route of [model.WHEY_TYPE_GUIDE_PATH,model.PACK_VALUE_GUIDE_PATH]){assert.equal(lifecycle.getLifecycleStatus(route),"planned");assert.equal(lifecycle.isLifecycleSitemapEligible(route),false);assert.equal(sitemap.split(route).length-1,1);}
  for(const route of ["/brands/per4m","/creatine","/guides/cost-per-25g-protein","/guides/supplement-prices-including-delivery","/guides/protein-powder-under-30","/guides/caffeine-free-pre-workout"])assert.equal(lifecycle.getLifecycleStatus(route),"live_verified");
});
test("required outgoing links and one contextual incoming link per guide are crawlable",()=>{
  const a=html(typeFile,[]),b=html(packFile,[]);
  for(const href of ["/whey-protein","/whey-isolate","/compare","/guides/cost-per-25g-protein","/help-me-choose"])assert.ok(a.includes('href="'+href+'"'));
  for(const href of ["/whey-protein","/guides/protein-powder-under-30","/guides/cost-per-25g-protein","/guides/supplement-prices-including-delivery"])assert.ok(b.includes('href="'+href+'"'));
  for(const [file,route] of [["app/whey-isolate/page.tsx",model.WHEY_TYPE_GUIDE_PATH],["app/whey-protein/page.tsx",model.PACK_VALUE_GUIDE_PATH]])assert.equal(fs.readFileSync(path.join(root,file),"utf8").split('href="'+route+'"').length-1,1);
});
module.exports={load,product,pairRows,model,now,typeFile,packFile};
