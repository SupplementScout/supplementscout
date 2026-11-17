import type { Metadata } from "next";
import Link from "next/link";
import { BuyingGuide, GuidePriceBreakdown } from "../../components/BuyingGuide";
import { getBuyingGuideProducts } from "../../lib/buyingGuideData";
import { guideStructuredData, type GuideProductsResult } from "../../lib/buyingGuides";
import { PROTEIN_BUDGET_PATH, PROTEIN_BUDGET_PRODUCTS, proteinBudgetExamples } from "../../lib/proteinBudgetGuide";
import { assertLifecycleDataAvailable, getLifecycleRobots, type RouteSearchParams } from "../../lib/indexabilityLifecycle";
import { createLifecycleDataLoader } from "../../lib/lifecycleDataCache";
import { formatCurrency } from "../../lib/pricing";

const title = "Protein Powder Under £30 UK: Compare Delivered Prices";
const heading = "Which protein powders cost £30 or less including delivery?";
const description = "Check selected UK protein powders against a £30 delivered budget, with exact flavours, pack sizes, shipping, check times and honest nutrition limits.";
const getCachedBudgetProducts = createLifecycleDataLoader(PROTEIN_BUDGET_PATH, "protein-budget-examples-v1",
  () => getBuyingGuideProducts(PROTEIN_BUDGET_PRODUCTS.map((target) => target.slug)));
export const dynamic = "force-dynamic";
export const revalidate = 3600;
type Props = { searchParams?: Promise<RouteSearchParams> };
export async function generateMetadata({ searchParams }: Props = {}): Promise<Metadata> {
  const params = await (searchParams || Promise.resolve({}));
  return { title, description, alternates: { canonical: PROTEIN_BUDGET_PATH }, robots: getLifecycleRobots(PROTEIN_BUDGET_PATH, params),
    openGraph: { title, description, url: PROTEIN_BUDGET_PATH, type: "website" }, twitter: { card: "summary", title, description } };
}

export function ProteinBudgetGuideContent({ result, now }: { result: GuideProductsResult; now?: Date }) {
  const examples = proteinBudgetExamples(result.rows, now);
  return (
    <BuyingGuide title={heading} breadcrumb="Protein powder under £30" structuredData={guideStructuredData(PROTEIN_BUDGET_PATH, heading, description)}>
      <p className="text-lg leading-8 text-zinc-800"><strong>For a £30 budget, the product and its known delivery charge must total £30 or less.</strong> {examples.length ? <>Current qualifying examples in this checked selection are {examples.map((example, index) => <span key={example.row.id}>{index ? "; " : ""}<Link href={example.productUrl} className="font-semibold underline">{example.row.name}, {example.variantLabel}</Link></span>)}.</> : "There is currently no qualifying offer in this selected set; we do not fill the gap with old or incomplete prices."}</p>
      <p>This is a small, checked selection across different products and brands, not every UK protein offer. Each price below buys one exact pack and flavour. A cheaper tub is a lower cash purchase, not automatically the best value per gram of protein.</p>
      <section aria-labelledby="budget-options">
        <h2 id="budget-options" className="text-2xl font-bold text-zinc-950">Checked options within the delivered budget</h2>
        <p className="mt-4">The examples follow BioTech USA 100% Pure Whey 454g Hazelnut, Optimum Nutrition 100% Plant Protein 684g Vanilla and CNP Premium Whey 900g Chocolate Peanut Butter. Only current qualifying offers appear, ordered by delivered total within this selection.</p>
        {result.rows.length === 0 || examples.length === 0 ? <p className="mt-5 rounded-2xl border border-[var(--ss-border)] bg-white p-5">No current selected variant meets all checks: active exact pack, in stock, checked within 24 hours, known delivery and a total no higher than £30. <Link href="/whey-protein" className="font-semibold underline">Browse current protein offers</Link> rather than relying on an expired example.</p> : (
          <ul className="mt-5 grid gap-5 lg:grid-cols-3">{examples.map((example, index) => (
            <li key={String(example.variant.id)} className="min-w-0 rounded-2xl border border-[var(--ss-border)] bg-white p-5">
              <h3 className="text-lg font-bold leading-7 text-zinc-950"><Link href={example.productUrl} className="underline">{example.row.name}</Link></h3>
              <p className="mt-2 text-sm">Variant: {example.variantLabel}. Pack: {example.packLabel}.</p>
              <p className="mt-4 font-semibold">{example.offer.retailer.name}</p><GuidePriceBreakdown offer={example.offer} />
              <p className="mt-4 text-sm"><strong>{index === 0 ? "Lowest cash total in this selection." : "Budget fit confirmed for this pack."}</strong> This is one {example.packLabel} pack; a different size or flavour is a separate purchase.</p>
              <p className="mt-3 text-sm">Fresh tracked retailers for this exact variant: {example.row.retailerCount}. Coverage is limited to the retailers we track.</p>
              <p className="mt-3 text-sm"><strong>Cost per 25 g protein: </strong>{example.nutritionApproved && example.row.costPer25gProtein !== null ? formatCurrency(example.row.costPer25gProtein) : "not yet verified for this exact flavour. The delivered price is usable for the budget, but no protein amount is borrowed from another flavour."}</p>
            </li>
          ))}</ul>
        )}
      </section>
      <section aria-labelledby="cash-versus-value">
        <h2 id="cash-versus-value" className="text-2xl font-bold text-zinc-950">Low upfront cost and protein value answer different questions</h2>
        <p className="mt-4">A smaller pack can keep the amount due today below £30. A larger pack contains more powder by weight, but that alone does not establish a lower cost for the protein it contains. Powder weight includes ingredients other than protein, and serving sizes can differ.</p>
        <p className="mt-4">Use <Link href="/guides/cost-per-25g-protein" className="font-semibold underline">the verified cost-per-25g method</Link> when exact-flavour nutrition and pack data support it. A blank figure is a data limit, not a poor-value score. Whey and plant formulas also differ; check the product&apos;s ingredients and your requirements rather than treating this list as a quality or suitability ranking.</p>
      </section>
      <section aria-labelledby="delivery-budget">
        <h2 id="delivery-budget" className="text-2xl font-bold text-zinc-950">Keep delivery inside the £30 limit</h2>
        <p className="mt-4">Unknown delivery is not free delivery. We include a zero charge only when it is recorded as zero, and add known item and delivery prices in pence. A total of exactly £30 qualifies; a total above it does not.</p>
        <p className="mt-4">The example is for one pack on the recorded delivery basis. A free-shipping basket threshold, membership, voucher or extra item may change your order. Confirm the exact flavour, quantity, stock and final checkout total for your address. Read <Link href="/guides/supplement-prices-including-delivery" className="font-semibold underline">how delivery changes a price comparison</Link>.</p>
      </section>
      <section aria-labelledby="budget-next-step">
        <h2 id="budget-next-step" className="text-2xl font-bold text-zinc-950">Make a shortlist, then open the exact product</h2>
        <ol className="mt-4 list-decimal space-y-2 pl-6"><li>Choose a pack and flavour you actually intend to buy.</li><li>Use the delivered total to check your cash budget.</li><li>Compare verified protein unit costs where available; keep missing values blank.</li><li>Open the product and confirm the retailer&apos;s checkout terms.</li></ol>
        <p className="mt-4">Explore <Link href="/whey-protein" className="font-semibold underline">whey protein comparisons</Link>, <Link href="/vegan-protein" className="font-semibold underline">vegan protein comparisons</Link> or <Link href="/help-me-choose" className="font-semibold underline">Help Me Choose</Link> for a broader shortlist. Our <Link href="/how-we-compare" className="font-semibold underline">comparison method</Link> and <Link href="/data-freshness" className="font-semibold underline">freshness rules</Link> explain the checks. Stale, unavailable or incomplete offers are excluded until usable again.</p>
      </section>
    </BuyingGuide>
  );
}
export default async function ProteinBudgetGuide() {
  const result = await getCachedBudgetProducts(); assertLifecycleDataAvailable(result, PROTEIN_BUDGET_PATH);
  return <ProteinBudgetGuideContent result={result} />;
}
