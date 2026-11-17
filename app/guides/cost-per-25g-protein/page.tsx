import type { Metadata } from "next";
import Link from "next/link";
import { BuyingGuide, GuidePriceBreakdown } from "../../components/BuyingGuide";
import { getBuyingGuideProducts } from "../../lib/buyingGuideData";
import { PROTEIN_PRODUCTS, proteinExamples, guideStructuredData, type GuideProductsResult } from "../../lib/buyingGuides";
import { assertLifecycleDataAvailable, getLifecycleRobots, type RouteSearchParams } from "../../lib/indexabilityLifecycle";
import { createLifecycleDataLoader } from "../../lib/lifecycleDataCache";
import { formatCurrency } from "../../lib/pricing";

const pagePath = "/guides/cost-per-25g-protein";
const title = "Cost per 25g Protein: Compare UK Whey Prices Fairly";
const heading = "How to compare protein powders by cost per 25g of protein";
const description = "Understand delivered cost per 25 g of protein with checked whey examples, verified serving data and clear limits on missing information.";
const getCachedProteinExamples = createLifecycleDataLoader(
  pagePath, "protein-guide-examples-v1",
  () => getBuyingGuideProducts(PROTEIN_PRODUCTS.map((target) => target.slug))
);
export const dynamic = "force-dynamic";
export const revalidate = 3600;
type Props = { searchParams?: Promise<RouteSearchParams> };
export async function generateMetadata({ searchParams }: Props = {}): Promise<Metadata> {
  const params = await (searchParams || Promise.resolve({}));
  return { title, description, alternates: { canonical: pagePath }, robots: getLifecycleRobots(pagePath, params),
    openGraph: { title, description, url: pagePath, type: "website" }, twitter: { card: "summary", title, description } };
}

export function ProteinGuideContent({ result, now }: { result: GuideProductsResult; now?: Date }) {
  const examples = proteinExamples(result.rows, now);
  return (
    <BuyingGuide title={heading} breadcrumb="Cost per 25g protein" structuredData={guideStructuredData(pagePath, heading, description)}>
      <p className="text-lg leading-8 text-zinc-800"><strong>Cost per 25 g of protein compares a pack&apos;s delivered price with the amount of verified protein it contains.</strong> A bigger tub or a cheaper scoop is not automatically better value on that basis.</p>
      <p>This is a price comparison unit, not advice about how much protein to take. Ingredients, formulation, dietary requirements and serving directions still need checking. The number does not score taste, effectiveness or product quality.</p>
      <section aria-labelledby="the-calculation">
        <h2 id="the-calculation" className="text-2xl font-bold text-zinc-950">The calculation</h2>
        <p className="mt-4">Total verified protein in a pack equals its verified serving count multiplied by the protein per serving. Divide the known delivered pack price by that total, then multiply by 25.</p>
        <p className="mt-5 rounded-2xl border border-[var(--ss-border)] bg-white p-5 font-semibold text-zinc-950">Cost per 25 g protein = delivered pack price ÷ total verified protein in the pack × 25.</p>
        <p className="mt-4">Powder weight and protein weight are different. A 30 g scoop does not mean 30 g of protein. Comparing the price of one scoop can therefore be misleading when serving sizes or protein amounts differ.</p>
      </section>
      <section aria-labelledby="checked-protein-examples">
        <h2 id="checked-protein-examples" className="text-2xl font-bold text-zinc-950">Two selected whey examples</h2>
        <p className="mt-4">These examples follow Time 4 Whey Protein Professional 1.8kg, Raspberry Smoothie, and CNP Peptide Whey Protein Blend 2.27kg, Chocolate. We keep the flavours and packs separate. A cost per 25 g appears only when nutrition is verified for the exact selected flavour and a fresh delivered price is available.</p>
        {result.rows.length === 0 || examples.length === 0 ? (
          <p className="mt-5 rounded-2xl border border-[var(--ss-border)] bg-white p-5">The selected exact variants are currently unavailable. No price or protein amount has been estimated.</p>
        ) : (
          <ul className="mt-5 grid gap-5">{examples.map((example) => {
            const offer = example.row.bestOffer;
            const ready = example.nutritionApproved && offer?.deliveredPrice && example.row.costPer25gProtein !== null && example.totalProteinG !== null;
            const nutritionSource = example.variant.nutrition_override?.source_url;
            return (
              <li key={example.row.id} className="min-w-0 rounded-2xl border border-[var(--ss-border)] bg-white p-5 sm:p-6">
                <h3 className="text-xl font-bold text-zinc-950"><Link href={example.productUrl} className="underline">{example.row.name}</Link></h3>
                <p className="mt-2 text-sm">Variant: {example.variantLabel}. Pack: {example.packLabel}.</p>
                {offer?.deliveredPrice ? <><p className="mt-4 font-semibold">{offer.retailer.name}</p><GuidePriceBreakdown offer={offer} /></> : <p className="mt-4 text-sm">No fresh in-stock offer with known delivery is available for this exact variant.</p>}
                {ready ? (
                  <div className="mt-5 border-t border-[var(--ss-border)] pt-4">
                    <dl className="grid grid-cols-2 gap-x-4 gap-y-2 text-sm">
                      <dt>Verified servings</dt><dd>{example.row.verifiedServingCount}</dd>
                      <dt>Serving size</dt><dd>{example.row.servingSizeG} g</dd>
                      <dt>Protein per serving</dt><dd>{example.row.proteinPerServingG} g</dd>
                      <dt>Total verified protein</dt><dd>{example.totalProteinG!.toLocaleString("en-GB")} g</dd>
                      <dt>Cost per 25 g protein</dt><dd className="font-bold text-[var(--ss-accent-strong)]">{formatCurrency(example.row.costPer25gProtein!)}</dd>
                    </dl>
                    {typeof nutritionSource === "string" && <a href={nutritionSource} className="mt-4 inline-flex min-h-11 items-center text-sm font-semibold underline" rel="noopener noreferrer">Nutrition source for this flavour</a>}
                  </div>
                ) : (
                  <p className="mt-4 text-sm"><strong>Cost per 25 g protein: not yet verified.</strong> {!example.nutritionApproved ? "Exact-flavour nutrition has not yet been verified for this example. A product-level figure is not assumed to apply to every flavour." : "A current delivered price is needed before the verified protein amount can be priced."}</p>
                )}
              </li>
            );
          })}</ul>
        )}
        <p className="mt-4 text-sm">These are different formulations, not a controlled isolate-versus-concentrate test or a ranking of the cheapest UK offers. Different serving sizes answer a different question from a fixed amount of protein.</p>
      </section>
      <section aria-labelledby="missing-figures">
        <h2 id="missing-figures" className="text-2xl font-bold text-zinc-950">When we leave the figure blank</h2>
        <p className="mt-4">We need a known delivered total and verified nutrition and pack data for the selected variant. If delivery, serving count, protein content or exact pack alignment is missing, a trustworthy unit cost may not be available.</p>
        <p className="mt-4">We do not fill gaps from a product name, a larger pack, another flavour or an unverified label claim. A stale offer is not a current-price example. Prices, stock and delivery terms can change after a check; confirm the exact variant and final checkout total with the retailer.</p>
      </section>
      <section aria-labelledby="rounding">
        <h2 id="rounding" className="text-2xl font-bold text-zinc-950">Money and rounding</h2>
        <p className="mt-4">Known item and delivery prices are combined in pence. The protein calculation uses the verified quantities and its unrounded result; the final money figure is rounded to the nearest penny for display. A rounded cost per 25 g should not be multiplied back to reconstruct the pack price.</p>
      </section>
      <section aria-labelledby="use-the-number">
        <h2 id="use-the-number" className="text-2xl font-bold text-zinc-950">Use the number as one part of a purchase</h2>
        <p className="mt-4">Compare <Link href="/whey-protein" className="font-semibold underline">current whey protein offers</Link> on the same verified basis, then open the product to review its pack, ingredients and retailer options. Use <Link href="/whey-isolate" className="font-semibold underline">the whey isolate comparison</Link> for that category or <Link href="/compare" className="font-semibold underline">compare two products</Link> side by side.</p>
        <p className="mt-4">Read <Link href="/how-we-compare" className="font-semibold underline">how we compare prices</Link>, <Link href="/data-freshness" className="font-semibold underline">data freshness</Link> and <Link href="/guides/supplement-prices-including-delivery" className="font-semibold underline">why delivery changes a price comparison</Link>. <Link href="/help-me-choose" className="font-semibold underline">Help Me Choose</Link> can narrow your shortlist.</p>
      </section>
    </BuyingGuide>
  );
}
export default async function ProteinGuide() {
  const result = await getCachedProteinExamples();
  assertLifecycleDataAvailable(result, pagePath);
  return <ProteinGuideContent result={result} />;
}
