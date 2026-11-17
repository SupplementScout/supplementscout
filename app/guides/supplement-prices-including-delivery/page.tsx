import type { Metadata } from "next";
import Link from "next/link";
import { BuyingGuide, GuidePriceBreakdown } from "../../components/BuyingGuide";
import { getBuyingGuideProducts } from "../../lib/buyingGuideData";
import { DELIVERY_PRODUCT, deliveryExample, guideStructuredData, type GuideProductsResult } from "../../lib/buyingGuides";
import { assertLifecycleDataAvailable, getLifecycleRobots, type RouteSearchParams } from "../../lib/indexabilityLifecycle";
import { createLifecycleDataLoader } from "../../lib/lifecycleDataCache";

const pagePath = "/guides/supplement-prices-including-delivery";
const title = "Supplement Prices Including Delivery: A UK Comparison";
const heading = "Can a higher product price be cheaper after delivery?";
const description = "Compare checked UK supplement offers for the same variant and pack, with product price, delivery and the final delivered total shown apart.";
const getCachedDeliveryExample = createLifecycleDataLoader(
  pagePath, "delivery-guide-example-v1",
  () => getBuyingGuideProducts([DELIVERY_PRODUCT.slug])
);
export const dynamic = "force-dynamic";
export const revalidate = 3600;
type Props = { searchParams?: Promise<RouteSearchParams> };
export async function generateMetadata({ searchParams }: Props = {}): Promise<Metadata> {
  const params = await (searchParams || Promise.resolve({}));
  return { title, description, alternates: { canonical: pagePath }, robots: getLifecycleRobots(pagePath, params),
    openGraph: { title, description, url: pagePath, type: "website" }, twitter: { card: "summary", title, description } };
}

export function DeliveryGuideContent({ result, now }: { result: GuideProductsResult; now?: Date }) {
  const example = deliveryExample(result.rows, now);
  return (
    <BuyingGuide title={heading} breadcrumb="Supplement prices including delivery" structuredData={guideStructuredData(pagePath, heading, description)}>
      <p className="text-lg leading-8 text-zinc-800"><strong>A higher product price can be cheaper after delivery.</strong> Compare the final total for the same variant and pack, rather than the headline item price alone. If delivery is unknown, you do not yet have a reliable delivered-price comparison.</p>
      <section aria-labelledby="checked-example">
        <h2 id="checked-example" className="text-2xl font-bold text-zinc-950">A checked example for the same pack</h2>
        <p className="mt-4">Our worked example follows Time 4 Creatine Powder 600g at covered UK retailers. A comparison is shown only when at least two retailers have fresh, in-stock offers for that exact variant with known delivery.</p>
        {result.rows.length === 0 || !example || example.offers.length < 2 ? (
          <div className="mt-5 rounded-2xl border border-[var(--ss-border)] bg-white p-5 sm:p-6">
            <h3 className="font-bold text-zinc-950">No current matched example is available</h3>
            <p className="mt-2">We cannot currently show two qualifying retailer offers for this exact pack. Older or incomplete prices are not reused to suggest that delivery still reverses the choice.</p>
            <Link href={example?.productUrl || "/creatine"} className="mt-4 inline-flex min-h-11 items-center font-semibold underline">{example ? "Check the Time 4 Creatine 600g variant" : "Browse current creatine products"}</Link>
          </div>
        ) : (
          <div className="mt-5 rounded-2xl border border-[var(--ss-border)] bg-white p-5 sm:p-6">
            <h3 className="text-lg font-bold text-zinc-950"><Link href={example.productUrl} className="underline">{example.row.name}</Link></h3>
            <p className="mt-2 text-sm">Variant: {example.variantLabel}. Pack: {example.packLabel}.</p>
            <ul className="mt-5 grid gap-4 sm:grid-cols-2">{example.offers.map((offer) => (
              <li key={offer.id} className="min-w-0 rounded-xl bg-[var(--ss-surface-muted)] p-4">
                <h4 className="font-bold text-zinc-950">{offer.retailer.name}</h4>
                <GuidePriceBreakdown offer={offer} />
              </li>
            ))}</ul>
            <p className="mt-4 text-sm">{example.reversed ? "Here, the offer with a higher item price has the lower delivered total." : "These current offers do not reverse the item-price order. The breakdown still shows what delivery adds."} This covers one matched pack, not the cheapest retailer for every product or address.</p>
          </div>
        )}
      </section>
      <section aria-labelledby="match-before-comparing">
        <h2 id="match-before-comparing" className="text-2xl font-bold text-zinc-950">What to match before comparing</h2>
        <p className="mt-4">Start with the product variant, including its recorded flavour or formulation, exact pack size and pack count. A small tub and a larger tub are different purchases even if the product names look similar. Then compare in-stock offers on the same delivery basis.</p>
        <p className="mt-4">The lower item price is useful only if the delivered total is right for your order. A delivery charge can reverse the apparent advantage. This is a current offer comparison, not a historical price drop or a claim about product effectiveness.</p>
      </section>
      <section aria-labelledby="delivery-thresholds">
        <h2 id="delivery-thresholds" className="text-2xl font-bold text-zinc-950">Free-delivery thresholds and your basket</h2>
        <p className="mt-4">Free delivery appears only when the recorded shipping cost is zero. Unknown delivery is not free delivery. A retailer may offer free shipping above a basket threshold, but a single pack below that threshold can still carry a charge. Adding another item changes the order you are comparing.</p>
        <p className="mt-4">Location, membership benefits and checkout terms may also change what you pay. Do not assume a voucher, threshold or member price applies to every shopper. Confirm the final total for your address and basket with the retailer.</p>
      </section>
      <section aria-labelledby="checkout-checklist">
        <h2 id="checkout-checklist" className="text-2xl font-bold text-zinc-950">A quick checkout checklist</h2>
        <ol className="mt-4 list-decimal space-y-2 pl-6">
          <li>Open the exact product variant and check its pack.</li><li>Compare product price, delivery and delivered total.</li>
          <li>Read each offer&apos;s check time and confirm stock.</li><li>Confirm the final checkout total for your address and basket.</li>
        </ol>
      </section>
      <section aria-labelledby="comparison-limits">
        <h2 id="comparison-limits" className="text-2xl font-bold text-zinc-950">What SupplementScout can show</h2>
        <p className="mt-4">Our comparisons use tracked retailer offers, not every UK store, delivery destination or possible discount. Older offers are excluded from current-price examples until checked again. If a price, delivery charge or exact match is missing, we show the limitation rather than estimate it.</p>
        <p className="mt-4">Read <Link href="/how-we-compare" className="font-semibold underline">how we compare prices</Link> and <Link href="/data-freshness" className="font-semibold underline">our freshness rules</Link>. Use <Link href="/deals" className="font-semibold underline">current supplement deals</Link> for tracked offer discovery, or <Link href="/creatine#under-20" className="font-semibold underline">creatine under £20</Link> for a delivered budget question.</p>
        <p className="mt-4">For protein packs, <Link href="/guides/cost-per-25g-protein" className="font-semibold underline">cost per 25 g of protein</Link> answers a separate value question. <Link href="/help-me-choose" className="font-semibold underline">Help Me Choose</Link> can narrow your purchase.</p>
      </section>
    </BuyingGuide>
  );
}

export default async function DeliveryGuide() {
  const result = await getCachedDeliveryExample();
  assertLifecycleDataAvailable(result, pagePath);
  return <DeliveryGuideContent result={result} />;
}
