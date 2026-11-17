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
const model=load("app/lib/budgetPurchaseGuides.ts"),now=new Date("2026-11-17T21:50:00Z");
const preFile="app/guides/pre-workout-under-30/page.tsx",massFile="app/guides/mass-gainer-under-40/page.tsx";
const groups=[{targets:model.PRE_WORKOUT_BUDGET_TARGETS,select:model.preWorkoutBudgetExamples,file:preFile,content:"PreWorkoutBudgetGuideContent",route:model.PRE_WORKOUT_BUDGET_PATH,budget:30},
  {targets:model.MASS_GAINER_BUDGET_TARGETS,select:model.massGainerBudgetExamples,file:massFile,content:"MassGainerBudgetGuideContent",route:model.MASS_GAINER_BUDGET_PATH,budget:40}];
// TEST ONLY fixtures. These prices/nutrition are not catalogue or live evidence.
function product(target,{price=20,shipping=4.99,nutrition=false,verifiedWeight=true}={}) {
  const isPre=model.PRE_WORKOUT_BUDGET_TARGETS.some(t=>t.id===target.id),count=28,size=target.grams/count;
  return {id:target.id,slug:target.slug,name:target.expectedName,brand:target.brand,category:isPre?"Pre Workout":"Mass Gainer",image:null,
    product_format:"powder",net_weight_g:target.grams,net_volume_ml:null,unit_count:null,unit_type:null,
    serving_count_verified:99,serving_size_g:target.grams/99,protein_per_serving_g:5,creatine_per_serving_g:null,
    unit_pricing_verified:verifiedWeight,nutrition_verified:true,is_active:true,merged_at:null,merged_into_product_id:null,
    offers:[{id:target.variantId,retailer_product_id:target.variantId,price,shipping_cost:shipping,in_stock:true,last_checked_at:"2026-11-17T21:30:00Z",url:"https://retailer.example/item",
      retailer:{id:1,name:"TEST ONLY retailer",slug:"test"},variant_resolution:"resolved",
      product_variant:{id:target.variantId,product_id:target.id,display_name:`${target.flavour} / ${target.grams}g`,flavour_label:target.flavour,
        pack_count:1,size_value:target.grams,size_unit:"g",product_format:"powder",is_active:true,nutrition_override:nutrition?{
          net_weight_g:target.grams,serving_count_verified:count,serving_size_g:size,protein_per_serving_g:5,creatine_per_serving_g:null,
          unit_pricing_verified:true,nutrition_verified:true,product_format:"powder",source_type:"manufacturer_product_page",source_url:"https://manufacturer.example/label",
          evidence:"TEST ONLY exact-variant reviewed fixture; not production evidence."}:{} }}]};
}
const variant=p=>p.offers[0].product_variant;
const html=(g,rows)=>renderToStaticMarkup(React.createElement(load(g.file)[g.content],{result:{rows,error:false},now}));

test("each budget selects three exact products and brands and orders actual delivered totals",()=>{
  for(const g of groups){const rows=g.targets.map((t,i)=>product(t,{price:20-i,shipping:i})),e=g.select(rows,now);
    assert.equal(e.length,3);assert.equal(new Set(e.map(e=>e.row.id)).size,3);assert.equal(new Set(e.map(e=>e.row.brand)).size,3);
    for(const item of e){assert.equal(item.offer.deliveredPrice.totalPrice,20);assert.ok(item.productUrl.endsWith("?variant="+item.variant.id));assert.equal(item.verifiedServings,null);assert.equal(item.costPerServing,null);}
  }
});
test("name, brand, category, ownership, flavour, gram pack and resolution changes fail closed",()=>{
  const mutations=[p=>p.id="other",p=>p.slug="other",p=>p.name+=" changed",p=>p.brand="Other",p=>p.category="Carbohydrates",p=>p.is_active=false,p=>p.merged_at="2026-11-01",p=>p.merged_into_product_id=99,
    p=>variant(p).id="other",p=>variant(p).product_id="other",p=>variant(p).flavour_label="Other",p=>variant(p).size_value+=1,p=>variant(p).size_unit="kg",p=>variant(p).pack_count=2,p=>variant(p).product_format="capsule",p=>variant(p).is_active=false,p=>p.offers[0].variant_resolution="ambiguous"];
  for(const g of groups)for(const mutate of mutations){const p=product(g.targets[0]);mutate(p);assert.equal(g.select([p],now).length,0,mutate.toString());}
});
test("budget is inclusive at the exact delivered pence boundary and rejects one penny over",()=>{
  for(const g of groups){assert.equal(g.select([product(g.targets[0],{price:g.budget-3.99,shipping:3.99})],now).length,1);
    assert.equal(g.select([product(g.targets[0],{price:g.budget-3.98,shipping:3.99})],now).length,0);}
});
test("stale, future, missing-date, unavailable, invalid-price and unknown-delivery offers cannot qualify",()=>{
  const changes=[o=>o.in_stock=false,o=>o.last_checked_at=null,o=>o.last_checked_at="2026-11-16T21:49:59Z",o=>o.last_checked_at="2026-11-17T22:00:00Z",o=>o.shipping_cost=null,o=>o.shipping_cost=-1,o=>o.shipping_cost=Infinity,o=>o.price=0,o=>o.price=-1,o=>o.price=NaN];
  for(const g of groups)for(const change of changes){const p=product(g.targets[0]);change(p.offers[0]);assert.equal(g.select([p],now).length,0,change.toString());}
});
test("known zero delivery is usable and an unknown cheaper listing cannot replace a known delivered offer",()=>{
  for(const g of groups){const p=product(g.targets[0],{price:20,shipping:0}),unknown=structuredClone(p.offers[0]);unknown.id="unknown";unknown.price=1;unknown.shipping_cost=null;p.offers.unshift(unknown);
    const e=g.select([p],now)[0];assert.equal(e.offer.productPrice,20);assert.equal(e.offer.deliveredPrice.shippingCost,0);assert.equal(e.offer.deliveredPrice.totalPrice,20);}
});
test("delivery reversals use current exact examples and disappear when prices no longer reverse",()=>{
  const [a,b,c]=model.PRE_WORKOUT_BUDGET_TARGETS,rows=[product(a,{price:20,shipping:4}),product(b,{price:21,shipping:0}),product(c,{price:25,shipping:0})];
  const e=model.preWorkoutBudgetExamples(rows,now),change=model.deliveryOrderChange(e);assert.equal(e[0].variant.id,b.variantId);assert.equal(change.lowerItem.variant.id,a.variantId);assert.equal(change.higherItem.variant.id,b.variantId);
  rows[0].offers[0].shipping_cost=0;assert.equal(model.deliveryOrderChange(model.preWorkoutBudgetExamples(rows,now)),null);assert.equal(model.deliveryOrderChange([]),null);
});
test("serving costs require existing approved own-variant nutrition rather than parent or scoop evidence",()=>{
  const target=model.PRE_WORKOUT_BUDGET_TARGETS[0];
  assert.equal(model.preWorkoutBudgetExamples([product(target)],now)[0].costPerServing,null);
  const p=product(target,{nutrition:true}),e=model.preWorkoutBudgetExamples([p],now)[0];assert.equal(e.verifiedServings,28);assert.equal(e.costPerServing,24.99/28);
  const edits=[v=>delete v.nutrition_override.source_url,v=>v.nutrition_override.source_type="retailer_title",v=>v.nutrition_override.evidence="short",v=>v.nutrition_override.nutrition_verified=false,v=>v.nutrition_override.serving_count_verified=99,v=>v.nutrition_override.protein_per_serving_g=null];
  for(const edit of edits){const row=structuredClone(p);edit(variant(row));assert.equal(model.preWorkoutBudgetExamples([row],now)[0].costPerServing,null);}
  const facts=product(target);variant(facts).nutrition_override={serving_size_g:8.7,caffeine:{information_state:"present_with_amount",amount_per_serving_mg:300,serving_basis_text:"30 servings"}};
  assert.equal(model.preWorkoutBudgetExamples([facts],now)[0].verifiedServings,null);const body=html(groups[0],[facts]);assert.doesNotMatch(body,/300 mg|<dt>Verified servings<\/dt>/);assert.match(body,/unknown amount is not confirmed absence/);
});
test("powder unit choice requires verified weights and uses unrounded pence per gram",()=>{
  const [a,b,c]=model.MASS_GAINER_BUDGET_TARGETS,rows=[product(a,{price:25,shipping:0}),product(b,{price:35,shipping:0}),product(c,{price:37,shipping:0})];
  const e=model.massGainerBudgetExamples(rows,now);assert.equal(e[1].row.pricePerKg.toFixed(2),e[2].row.pricePerKg.toFixed(2));assert.equal(model.lowestPowderUnitExample(e).variant.id,c.variantId);
  for(const item of e)item.row.unitPricingVerified=false;assert.equal(model.lowestPowderUnitExample(e),null);
  assert.equal(model.lowestPowderUnitExample([]),null);const unverified=product(a,{verifiedWeight:false});const body=html(groups[1],[unverified]);assert.match(body,/verified powder-weight unit price is not available/);assert.doesNotMatch(body,/Delivered powder cost: <strong>/);
});
test("SSR supplies real dynamic price fields, exact links, check times and separate nutrient limits",()=>{
  for(const g of groups){const body=html(g,g.targets.map(t=>product(t)));assert.equal((body.match(/<h1\b/g)||[]).length,1);assert.equal((body.match(/<h3\b/g)||[]).length,3);assert.match(body,/£24\.99/);assert.match(body,/Product price/);assert.match(body,/Delivery/);assert.match(body,/2026-11-17T21:30:00Z/);
    for(const t of g.targets)assert.ok(body.includes('/product/'+t.slug+'?variant='+t.variantId));assert.doesNotMatch(body,/ratingValue|datePublished|FAQPage|"@type":"Article"/);}
  assert.match(html(groups[1],groups[1].targets.map(t=>product(t))),/not cost per gram of protein, per calorie or per serving/);
});
test("empty, partial and aged-out selections keep useful buying steps without fictional prices",()=>{
  for(const g of groups){const empty=html(g,[]);assert.match(empty,/<ol class="mt-4 list-decimal/);assert.match(empty,/No selected exact pack currently/);assert.doesNotMatch(empty,/TEST ONLY retailer|£24\.99/);
    const partial=html(g,[product(g.targets[0])]);assert.match(partial,/Only 1 of the three selected products currently qualifies/);
    assert.equal(g.select(g.targets.map(t=>product(t)),new Date("2026-11-18T21:31:00Z")).length,0);}
});
test("metadata is database-free, planned/noindex, self-canonical and factual for base and parameters",async()=>{
  for(const g of groups){const page=load(g.file),base=await page.generateMetadata(),parameter=await page.generateMetadata({searchParams:Promise.resolve({sort:"price",utm_source:"test"})});
    assert.deepEqual(base.robots,{index:false,follow:true});assert.deepEqual(parameter.robots,base.robots);assert.equal(base.alternates.canonical,g.route);assert.equal(parameter.alternates.canonical,g.route);
    const schema=JSON.parse(html(g,[]).match(/<script type="application\/ld\+json">(.*?)<\/script>/s)[1]);assert.deepEqual(schema['@graph'].map(n=>n['@type']),['WebPage','BreadcrumbList']);assert.equal(schema['@graph'][0].url,'https://www.supplementscout.co.uk'+g.route);}
});
test("source errors abort rather than rendering or caching a successful empty guide",async()=>{
  for(const g of groups){const page=load(g.file,{'../../lib/buyingGuideData':{getBuyingGuideProducts:async()=>({rows:[],error:true})}});await assert.rejects(page.default(),/temporarily unavailable/);
    const valid=load(g.file,{'../../lib/buyingGuideData':{getBuyingGuideProducts:async()=>({rows:[],error:false})}});assert.ok(await valid.default());}
});
test("each route makes one bounded shared loader call with its own cache version",async()=>{
  const keys=[],calls=[];
  for(const g of groups){const page=load(g.file,{'../../lib/lifecycleDataCache':{createLifecycleDataLoader:(route,key,read)=>{keys.push({route,key});return read;}},'../../lib/buyingGuideData':{getBuyingGuideProducts:async slugs=>{calls.push(slugs);return{rows:[],error:false};}}});await page.default();assert.deepEqual(calls.at(-1),g.targets.map(t=>t.slug));}
  assert.equal(calls.length,2);assert.equal(new Set(keys.map(k=>k.key)).size,2);assert.deepEqual(keys.map(k=>k.route),groups.map(g=>g.route));
});
test("only the two new planned sitemap candidates are added and all eight prior guides stay live",()=>{
  const lifecycle=load('app/lib/indexabilityLifecycle.ts'),sitemap=fs.readFileSync(path.join(root,'app/sitemap.ts'),'utf8');
  for(const g of groups){assert.equal(lifecycle.getLifecycleStatus(g.route),'planned');assert.equal(lifecycle.isLifecycleSitemapEligible(g.route),false);assert.equal(sitemap.split(g.route).length-1,1);}
  for(const route of ['/guides/supplement-prices-including-delivery','/guides/cost-per-25g-protein','/guides/protein-powder-under-30','/guides/caffeine-free-pre-workout','/guides/whey-isolate-vs-concentrate','/guides/protein-powder-pack-size-value','/guides/mass-gainer-vs-whey-protein','/guides/creatine-pack-size-value','/brands/per4m','/creatine'])assert.equal(lifecycle.getLifecycleStatus(route),'live_verified');
});
test("one contextual incoming link per category preserves product offer tracking and server components",()=>{
  for(const [file,g] of [['app/pre-workout/page.tsx',groups[0]],['app/mass-gainer/page.tsx',groups[1]]]){assert.equal(fs.readFileSync(path.join(root,file),'utf8').split('href="'+g.route+'"').length-1,1);const source=fs.readFileSync(path.join(root,g.file),'utf8');assert.doesNotMatch(source,/use client|retailer_offer_click|fetch\(/);}
  const card=fs.readFileSync(path.join(root,'app/components/BudgetGuideExample.tsx'),'utf8');assert.match(card,/GuidePriceBreakdown/);assert.match(card,/href=\{example.productUrl\}/);assert.doesNotMatch(card,/use client/);
});
module.exports={load,product,model,now,groups,preFile,massFile};
