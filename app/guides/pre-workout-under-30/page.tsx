import type { Metadata } from "next";
import Link from "next/link";
import { BuyingGuide } from "../../components/BuyingGuide";
import BudgetGuideExample from "../../components/BudgetGuideExample";
import { getBuyingGuideProducts } from "../../lib/buyingGuideData";
import { guideStructuredData, type GuideProductsResult } from "../../lib/buyingGuides";
import { PRE_WORKOUT_BUDGET_PATH, PRE_WORKOUT_BUDGET_TARGETS, preWorkoutBudgetExamples, deliveryOrderChange } from "../../lib/budgetPurchaseGuides";
import { assertLifecycleDataAvailable, getLifecycleRobots, type RouteSearchParams } from "../../lib/indexabilityLifecycle";
import { createLifecycleDataLoader } from "../../lib/lifecycleDataCache";
import { formatCurrency } from "../../lib/pricing";

const title = "Pre-Workout Under £30 UK: Compare Prices Including Delivery";
const heading = "Which pre-workouts cost £30 or less including delivery?";
const description = "Check selected UK pre-workouts against a £30 delivered budget: exact flavours, packs, stock, shipping and check dates, with serving costs only when verified.";
const getCachedExamples = createLifecycleDataLoader(PRE_WORKOUT_BUDGET_PATH, "pre-workout-budget-examples-v1",
  () => getBuyingGuideProducts(PRE_WORKOUT_BUDGET_TARGETS.map(t => t.slug)));
export const dynamic = "force-dynamic";
export const revalidate = 3600;
type Props = { searchParams?: Promise<RouteSearchParams> };
export async function generateMetadata({ searchParams }: Props = {}): Promise<Metadata> {
  const params = await (searchParams || Promise.resolve({}));
  return { title, description, alternates: { canonical: PRE_WORKOUT_BUDGET_PATH }, robots: getLifecycleRobots(PRE_WORKOUT_BUDGET_PATH, params),
    openGraph: { title, description, url: PRE_WORKOUT_BUDGET_PATH, type: "website" }, twitter: { card: "summary", title, description } };
}
export function PreWorkoutBudgetGuideContent({ result, now }: { result: GuideProductsResult; now?: Date }) {
  const examples = preWorkoutBudgetExamples(result.rows, now), cheapest = examples[0], reversal = deliveryOrderChange(examples);
  const empty = result.rows.length === 0 || examples.length === 0;
  return <BuyingGuide title={heading} breadcrumb="Pre-workout under £30" structuredData={guideStructuredData(PRE_WORKOUT_BUDGET_PATH, heading, description)}>
    <p className="text-lg leading-8 text-zinc-800"><strong>A pre-workout fits a £30 budget only when its product price and known delivery charge total £30 or less.</strong> {cheapest ? <>The lowest current cash total in this checked selection is <Link href={cheapest.productUrl} className="font-semibold underline">{cheapest.label}, {cheapest.variantLabel}</Link> at {formatCurrency(cheapest.offer.deliveredPrice!.totalPrice)} delivered.</> : "None of the selected exact packs currently qualifies; use the checks below without relying on an old price."}</p>
    <section aria-labelledby="budget-packs">
      <h2 id="budget-packs" className="text-2xl font-bold text-zinc-950">Current checked packs within £30</h2>
      <p className="mt-4">This small selection follows Warrior Rage Blazin Berry 392g, Applied Nutrition ABE Baddy Berry 315g and Cellucor C4 Sport Icy Blue Raspberry 270g. They are three different products from three brands, rather than several flavours presented as a wider market. Only qualifying current offers appear, ordered by delivered total.</p>
      {!empty ? <ul className="mt-5 grid gap-5 lg:grid-cols-3">{examples.map(e => <BudgetGuideExample key={String(e.variant.id)} example={e}>
        {e.verifiedServings !== null && e.costPerServing !== null ? <dl className="mt-4 grid grid-cols-2 gap-x-4 gap-y-2 text-sm"><dt>Verified servings</dt><dd>{e.verifiedServings}</dd><dt>Delivered cost per serving</dt><dd className="font-semibold">{formatCurrency(e.costPerServing)}</dd></dl> :
          <p className="mt-4 text-sm">A verified serving count and cost per serving are not available for this exact variant. We do not turn its pack weight or a serving claim in its name into a verified count.</p>}
      </BudgetGuideExample>)}</ul> : <p className="mt-5 rounded-2xl border border-[var(--ss-border)] bg-white p-5">No selected exact pack currently passes all checks: active variant, correct flavour and pack, in stock, checked within 24 hours, known delivery and total no higher than £30. <Link href="/pre-workout" className="font-semibold underline">Browse current pre-workout comparisons</Link> and use the method below. Missing offers are not replaced with invented prices.</p>}
      {examples.length > 0 && examples.length < PRE_WORKOUT_BUDGET_TARGETS.length && <p className="mt-4">Only {examples.length} of the three selected products currently qualifies. We do not substitute a different flavour or pack.</p>}
    </section>
    <section aria-labelledby="delivery-order">
      <h2 id="delivery-order" className="text-2xl font-bold text-zinc-950">Can delivery change which option costs less?</h2>
      {reversal ? <p className="mt-4">Yes, in the current selection: <Link href={reversal.lowerItem.productUrl} className="underline">{reversal.lowerItem.label}</Link> has the lower item price of {formatCurrency(reversal.lowerItem.offer.productPrice)}, but its recorded delivery brings the total to {formatCurrency(reversal.lowerItem.offer.deliveredPrice!.totalPrice)}. <Link href={reversal.higherItem.productUrl} className="underline">{reversal.higherItem.label}</Link> starts at {formatCurrency(reversal.higherItem.offer.productPrice)} and totals {formatCurrency(reversal.higherItem.offer.deliveredPrice!.totalPrice)} delivered. The lower item price is the higher purchase total for these two exact packs.</p> : <p className="mt-4">A delivery charge can outweigh a lower item price. {examples.length > 1 ? "The current checked selection has no pair showing that reversal; every displayed total still includes its recorded delivery." : "There are not two current selected offers to demonstrate a price-order comparison."}</p>}
      <p className="mt-4">The cards show one exact pack and its recorded delivery charge. Unknown shipping is excluded; a recorded zero is shown as £0.00. Free-shipping thresholds, vouchers, memberships, extra basket items or your address may change checkout. A total of exactly £30 qualifies; £30.01 does not. Read <Link href="/guides/supplement-prices-including-delivery" className="underline">how delivery changes supplement prices</Link>.</p>
    </section>
    <section aria-labelledby="serving-value">
      <h2 id="serving-value" className="text-2xl font-bold text-zinc-950">A cheaper tub and a cheaper verified serving are different choices</h2>
      <p className="mt-4">The lowest upfront total answers what you pay today. Where exact reviewed pack and nutrition data establish a serving count, delivered cost per serving is the delivered total divided by that count. A tub&apos;s weight, scoop description or another flavour&apos;s label is insufficient on its own.</p>
      <p className="mt-4">Even verified serving costs compare the declared portions, not identical ingredients or amounts. They do not establish stronger stimulation, a better pump or better results. If a serving figure is unavailable, use the exact delivered price for your budget and check the product label before deciding.</p>
    </section>
    <section aria-labelledby="label-and-next-step">
      <h2 id="label-and-next-step" className="text-2xl font-bold text-zinc-950">Check the exact label, then open the retailer offer</h2>
      <ol className="mt-4 list-decimal space-y-3 pl-6"><li>Match the flavour, size and one-pack quantity to the card.</li><li>Keep the delivery charge inside your £30 limit.</li><li>Check the exact ingredient label, allergens, serving basis and caffeine information.</li><li>Use a serving cost only when the exact variant has the required reviewed data.</li><li>Open the product, choose the matching retailer offer and confirm stock and the final checkout total.</li></ol>
      <p className="mt-4">Pre-workouts differ in caffeine status. This budget list does not establish whether a product contains caffeine; an unknown amount is not confirmed absence. Use the separate <Link href="/guides/caffeine-free-pre-workout" className="underline">verified caffeine-free pre-workout guide</Link> if that is your requirement.</p>
      <p className="mt-4">For a wider shortlist, open <Link href="/pre-workout" className="font-semibold underline">the pre-workout comparison</Link> or <Link href="/compare" className="underline">compare two products</Link>. Prices cover tracked retailers and this selected set, not the whole market. Stale, unavailable, ambiguous and incomplete offers are excluded.</p>
    </section>
  </BuyingGuide>;
}
export default async function Page() {
  const result = await getCachedExamples(); assertLifecycleDataAvailable(result, PRE_WORKOUT_BUDGET_PATH);
  return <PreWorkoutBudgetGuideContent result={result} />;
}
