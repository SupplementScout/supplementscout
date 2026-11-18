import type { Metadata } from "next";
import Link from "next/link";
import { BuyingGuide } from "../../components/BuyingGuide";
import BudgetGuideExample from "../../components/BudgetGuideExample";
import { getBuyingGuideProducts } from "../../lib/buyingGuideData";
import { guideStructuredData, type GuideProductsResult } from "../../lib/buyingGuides";
import { MASS_GAINER_BUDGET_PATH, MASS_GAINER_BUDGET_TARGETS, massGainerBudgetExamples, lowestPowderUnitExample } from "../../lib/budgetPurchaseGuides";
import { assertLifecycleDataAvailable, getLifecycleRobots, type RouteSearchParams } from "../../lib/indexabilityLifecycle";
import { createLifecycleDataLoader } from "../../lib/lifecycleDataCache";
import { formatCurrency } from "../../lib/pricing";

const title = "Mass Gainer Under £40 UK: Compare Prices Including Delivery";
const heading = "Which mass gainers cost £40 or less including delivery?";
const description = "Compare selected UK mass gainer packs within a £40 delivered budget, with exact flavours, shipping, check dates and powder cost per kilogram only when verified.";
const getCachedExamples = createLifecycleDataLoader(MASS_GAINER_BUDGET_PATH, "mass-gainer-budget-examples-v1",
  () => getBuyingGuideProducts(MASS_GAINER_BUDGET_TARGETS.map(t => t.slug)));
export const dynamic = "force-dynamic";
export const revalidate = 3600;
type Props = { searchParams?: Promise<RouteSearchParams> };
export async function generateMetadata({ searchParams }: Props = {}): Promise<Metadata> {
  const params = await (searchParams || Promise.resolve({}));
  return { title, description, alternates: { canonical: MASS_GAINER_BUDGET_PATH }, robots: getLifecycleRobots(MASS_GAINER_BUDGET_PATH, params),
    openGraph: { title, description, url: MASS_GAINER_BUDGET_PATH, type: "website" }, twitter: { card: "summary", title, description } };
}
export function MassGainerBudgetGuideContent({ result, now }: { result: GuideProductsResult; now?: Date }) {
  const examples = massGainerBudgetExamples(result.rows, now), cheapest = examples[0], unitChoice = lowestPowderUnitExample(examples);
  const empty = result.rows.length === 0 || examples.length === 0;
  return <BuyingGuide title={heading} breadcrumb="Mass gainer under £40" structuredData={guideStructuredData(MASS_GAINER_BUDGET_PATH, heading, description)}>
    <p className="text-lg leading-8 text-zinc-800"><strong>Keep both the mass gainer pack and its known delivery charge inside £40.</strong> {cheapest ? <>The lowest current upfront total in this checked selection is <Link href={cheapest.productUrl} className="font-semibold underline">{cheapest.label}, {cheapest.variantLabel}</Link> at {formatCurrency(cheapest.offer.deliveredPrice!.totalPrice)} delivered.</> : "No selected exact pack currently passes that delivered budget; the buying method below remains useful without an old or estimated price."}</p>
    <section aria-labelledby="gainer-packs">
      <h2 id="gainer-packs" className="text-2xl font-bold text-zinc-950">Current checked mass gainer packs under the budget</h2>
      <p className="mt-4">The selected packs are 7Nutrition Bodybuilder Cookies &amp; Cream 1.5kg, Mutant Mass Vanilla Ice Cream 2.27kg and Applied Nutrition Critical Mass Lean Mass Gainz Chocolate 2.4kg. These are three different products from three brands, with different formulations and pack sizes. Only current qualifying offers appear, ordered by total cash cost.</p>
      {!empty ? <ul className="mt-5 grid gap-5 lg:grid-cols-3">{examples.map(e => <BudgetGuideExample key={String(e.variant.id)} example={e}>
        {e.row.unitPricingVerified && e.row.pricePerKg !== null ? <p className="mt-4 text-sm">Delivered powder cost: <strong>{formatCurrency(e.row.pricePerKg)}/kg</strong>. This measures powder bought, not protein or calories.</p> : <p className="mt-4 text-sm">A verified powder-weight unit price is not available for this exact pack. Its delivered purchase total is shown without an estimated unit cost.</p>}
      </BudgetGuideExample>)}</ul> : <p className="mt-5 rounded-2xl border border-[var(--ss-border)] bg-white p-5">No selected exact pack currently has an active matching variant, in-stock offer checked within 24 hours, known delivery and a total no higher than £40. <Link href="/mass-gainer" className="font-semibold underline">Browse current mass gainer comparisons</Link> and use the checks below. We do not fill the gap with an expired offer or another flavour.</p>}
      {examples.length > 0 && examples.length < MASS_GAINER_BUDGET_TARGETS.length && <p className="mt-4">Only {examples.length} of the three selected products currently qualifies. This is a limited selection, not a complete market ranking.</p>}
    </section>
    <section aria-labelledby="cash-and-powder">
      <h2 id="cash-and-powder" className="text-2xl font-bold text-zinc-950">Lowest upfront cost or more powder for your money?</h2>
      {cheapest && unitChoice && examples.length > 1 ? <p className="mt-4"><Link href={cheapest.productUrl} className="underline">{cheapest.label}</Link> needs the least cash upfront in this selection at {formatCurrency(cheapest.offer.deliveredPrice!.totalPrice)}. Among the shown packs with verified powder weights, <Link href={unitChoice.productUrl} className="underline">{unitChoice.label}</Link> has the lowest powder cost at {formatCurrency(unitChoice.row.pricePerKg!)}/kg, with {formatCurrency(unitChoice.offer.deliveredPrice!.totalPrice)} due for its {unitChoice.packLabel} pack. {cheapest.variant.id !== unitChoice.variant.id ? "The two price measures favour different packs." : "The same pack currently leads both price measures."}</p> : <p className="mt-4">The delivered total answers what you pay for one pack. A verified powder unit cost divides that total by the pack&apos;s verified weight in kilograms. There are not enough current selected packs with the necessary data for a useful two-option comparison.</p>}
      <p className="mt-4">Powder cost per kilogram is not cost per gram of protein, per calorie or per serving. Different gainer formulations can contain different ingredient proportions. We do not copy nutrition from another flavour, estimate calories from a product name or turn a larger pack into a nutrition-value winner.</p>
    </section>
    <section aria-labelledby="gainer-delivery">
      <h2 id="gainer-delivery" className="text-2xl font-bold text-zinc-950">What is included in the £40 limit?</h2>
      <p className="mt-4">Each card adds the recorded product price and delivery for one exact pack. Known zero delivery is shown as £0.00; unknown delivery is excluded. A £40.00 total qualifies, while £40.01 does not. The check date belongs to the offer, so a cheaper stale or out-of-stock listing cannot win the comparison.</p>
      <p className="mt-4">Your delivery address, basket, voucher or membership can change the final checkout total. A larger order is a separate purchase; multiplying a one-pack price does not establish a multi-pack deal. Read <Link href="/guides/supplement-prices-including-delivery" className="underline">the delivery-price guide</Link> before comparing a headline item price with a delivered offer.</p>
    </section>
    <section aria-labelledby="gainer-next-step">
      <h2 id="gainer-next-step" className="text-2xl font-bold text-zinc-950">Make a budget shortlist, then check the exact product</h2>
      <ol className="mt-4 list-decimal space-y-3 pl-6"><li>Choose the exact flavour and pack size you intend to buy.</li><li>Check the full delivered total against £40.</li><li>Use verified powder cost per kilogram as a weight comparison, keeping nutrition questions separate.</li><li>Check the ingredient label, allergens and declared serving for that exact flavour.</li><li>Open the matching product and retailer offer, then confirm stock and checkout terms.</li></ol>
      <p className="mt-4">This guide assumes you are already shopping for a mass gainer. If you are still choosing the type of powder, read <Link href="/guides/mass-gainer-vs-whey-protein" className="underline">mass gainer versus whey protein</Link>. For a wider selection, use <Link href="/mass-gainer" className="font-semibold underline">the mass gainer comparison</Link> or <Link href="/compare" className="underline">compare two exact products</Link>. A protein-cost figure belongs only to an exact variant with approved nutrition, as explained in <Link href="/guides/cost-per-25g-protein" className="underline">the verified protein-cost method</Link>.</p>
      <p className="mt-4">Current tracked offers can change. Missing, stale, unavailable or incomplete offers remain excluded, while these buying steps remain available.</p>
    </section>
  </BuyingGuide>;
}
export default async function Page() {
  const result = await getCachedExamples(); assertLifecycleDataAvailable(result, MASS_GAINER_BUDGET_PATH);
  return <MassGainerBudgetGuideContent result={result} />;
}
