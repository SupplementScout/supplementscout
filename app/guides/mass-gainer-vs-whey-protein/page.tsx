import type { Metadata } from "next";
import Link from "next/link";
import { BuyingGuide } from "../../components/BuyingGuide";
import PurchaseGuideExample from "../../components/PurchaseGuideExample";
import { getBuyingGuideProducts } from "../../lib/buyingGuideData";
import { guideStructuredData, type GuideProductsResult } from "../../lib/buyingGuides";
import { MASS_WHEY_GUIDE_PATH, MASS_WHEY_TARGETS, massWheyExamples } from "../../lib/purchaseDecisionGuides";
import { assertLifecycleDataAvailable, getLifecycleRobots, type RouteSearchParams } from "../../lib/indexabilityLifecycle";
import { createLifecycleDataLoader } from "../../lib/lifecycleDataCache";
import { formatCurrency } from "../../lib/pricing";

const title = "Mass Gainer vs Whey Protein: Compare UK Buying Costs";
const heading = "Should I buy mass gainer or whey protein?";
const description = "Compare a carbohydrate-and-protein blend with whey using exact UK packs, checked delivery costs and protein pricing only where verified nutrition supports it.";
const getCachedExamples = createLifecycleDataLoader(MASS_WHEY_GUIDE_PATH, "mass-whey-guide-examples-v1",
  () => getBuyingGuideProducts(MASS_WHEY_TARGETS.map(t => t.slug)));
export const dynamic = "force-dynamic";
export const revalidate = 3600;
type Props = { searchParams?: Promise<RouteSearchParams> };
export async function generateMetadata({ searchParams }: Props = {}): Promise<Metadata> {
  const params = await (searchParams || Promise.resolve({}));
  return { title, description, alternates: { canonical: MASS_WHEY_GUIDE_PATH }, robots: getLifecycleRobots(MASS_WHEY_GUIDE_PATH, params),
    openGraph: { title, description, url: MASS_WHEY_GUIDE_PATH, type: "website" }, twitter: { card: "summary", title, description } };
}
export function MassWheyGuideContent({ result, now }: { result: GuideProductsResult; now?: Date }) {
  const examples = massWheyExamples(result.rows, now);
  return <BuyingGuide title={heading} breadcrumb="Mass gainer vs whey" structuredData={guideStructuredData(MASS_WHEY_GUIDE_PATH, heading, description)}>
    <p className="text-lg leading-8 text-zinc-800"><strong>Choose the formula you want before comparing the price: a carbohydrate-and-protein blend and a whey protein powder are different purchases.</strong> A gainer&apos;s lower price per kilogram does not establish a lower cost per gram of protein or per calorie. Compare the exact ingredients, pack and delivered total, then use nutrient costs only when the exact variant has verified data.</p>
    <section aria-labelledby="formula-choice">
      <h2 id="formula-choice" className="text-2xl font-bold text-zinc-950">What is different in these formulas?</h2>
      <p className="mt-4">The checked Hyper Mass Strawberry ingredient list includes maltodextrin alongside milk proteins and other ingredients. Efectiv&apos;s Strawberry Milkshake example is a whey isolate powder. These are two different products, not interchangeable bags of the same ingredient.</p>
      <p className="mt-4">If you are shopping mainly for a protein powder, compare its verified protein content and total cost. If you want a carbohydrate-and-protein blend, check the gainer&apos;s full label rather than assuming that a larger bag contains more protein for your money. Neither product name establishes a suitable calorie intake or a better training result.</p>
    </section>
    <section aria-labelledby="checked-packs">
      <h2 id="checked-packs" className="text-2xl font-bold text-zinc-950">Checked gainer and whey buying examples</h2>
      <p className="mt-4">Each card is one exact flavour and pack with a current in-stock offer and known delivery. Different pack sizes are shown explicitly. Powder cost per kilogram measures the weight bought, not the protein or energy in it.</p>
      {result.rows.length === 0 || examples.length === 0 ? <p className="mt-5 rounded-2xl border border-[var(--ss-border)] bg-white p-5">No current selected example passes the exact-variant, stock, freshness and known-delivery checks. Use the decision steps below, or browse <Link href="/mass-gainer" className="underline">Mass Gainer</Link> and <Link href="/whey-protein" className="underline">Whey Protein</Link> offers. We do not fill the gap with expired prices.</p> :
        <ul className="mt-5 grid gap-5 md:grid-cols-2">{examples.map(e => <PurchaseGuideExample key={String(e.variant.id)} example={e}>
          {e.nutritionApproved && e.totalProteinG !== null && e.row.costPer25gProtein !== null ?
            <dl className="mt-4 grid grid-cols-2 gap-x-4 gap-y-2 text-sm"><dt>Protein per serving</dt><dd>{e.row.proteinPerServingG} g</dd><dt>Verified servings</dt><dd>{e.row.verifiedServingCount}</dd><dt>Cost per 25 g protein</dt><dd className="font-bold">{formatCurrency(e.row.costPer25gProtein)}</dd></dl> :
            <p className="mt-4 text-sm">Approved nutrition for this exact variant is not sufficient to show cost per 25 g of protein. We do not copy another flavour&apos;s figures or estimate a calorie cost.</p>}
          <p className="mt-4 text-sm"><Link href={e.source} className="underline">Manufacturer ingredient and pack source</Link>. Ingredient-source review is separate from the approved nutrition record used for calculations.</p>
        </PurchaseGuideExample>)}</ul>}
      <p className="mt-4">A standalone protein-cost figure is not a two-product value ranking. Until both exact records support the same metric, we do not name a cheaper protein or calorie winner.</p>
      {examples.length === 1 && <p className="mt-4">Only one of the selected examples currently qualifies. We do not replace the missing product with another flavour, formula or an old offer.</p>}
    </section>
    <section aria-labelledby="purchase-checks">
      <h2 id="purchase-checks" className="text-2xl font-bold text-zinc-950">A practical way to choose</h2>
      <ol className="mt-4 list-decimal space-y-3 pl-6"><li>Decide whether you want a protein-focused powder or a carbohydrate-and-protein blend.</li><li>Check the exact flavour&apos;s ingredients, nutrition and allergens; do not transfer information from a different formula.</li><li>Compare the cash paid for one pack, including delivery. A larger bag may need more money upfront.</li><li>Use cost per 25 g of protein only when both records support it. Cost per kilogram of powder answers a different question.</li><li>Confirm the retailer&apos;s final checkout total and label before buying.</li></ol>
      <p className="mt-4">Explore the full <Link href="/mass-gainer" className="font-semibold underline">Mass Gainer comparison</Link> or <Link href="/whey-protein" className="font-semibold underline">Whey Protein comparison</Link>. For two exact choices, use <Link href="/compare" className="underline">the comparison tool</Link>; unsupported nutrient fields remain blank.</p>
      <p className="mt-4">Read <Link href="/guides/cost-per-25g-protein" className="underline">the verified protein-cost method</Link>, <Link href="/guides/supplement-prices-including-delivery" className="underline">why delivery changes the purchase price</Link>, or <Link href="/guides/whey-isolate-vs-concentrate" className="underline">how isolate and concentrate differ</Link> if you have already chosen whey.</p>
      <p className="mt-4">Only current selected offers appear. Missing nutrition is not zero, unknown delivery is not free, and this selection is not a complete market ranking.</p>
    </section>
  </BuyingGuide>;
}
export default async function Page() {
  const result = await getCachedExamples(); assertLifecycleDataAvailable(result, MASS_WHEY_GUIDE_PATH);
  return <MassWheyGuideContent result={result} />;
}
