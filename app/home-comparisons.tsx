import { ComparisonProductHeroImage, ComparisonProductThumbnail } from "./components/ComparisonProductVisuals";
import SupplementScoutIcon from "./components/SupplementScoutIcon";
import PriceHistoryChart from "./components/PriceHistoryChart";
import type { DealsRow } from "./lib/dealsPriceIntelligence";
import type { HomepageComparisons } from "./lib/homepageData";
import { formatCurrency } from "./lib/pricing";
import { calculateDeliveredSavings, formatOfferCheckedDate } from "./lib/productOfferPresentation";

function productHref(row: DealsRow) {
  return `${row.productUrl}?variant=${encodeURIComponent(row.variantId)}`;
}

export function HomeFeaturedComparison({ comparisons }: { comparisons: HomepageComparisons }) {
  const row = comparisons.rows[0];
  if (!row) {
    return (
      <aside className="home-comparison home-comparison-empty" aria-labelledby="comparison-heading">
        <span className="home-kicker">A clearer way to compare</span>
        <span className="home-empty-icon"><SupplementScoutIcon name="receipt" size={24} /></span>
        <h2 id="comparison-heading">Small details.<br />A better buying decision.</h2>
        <p>Compare the same supplement and pack across UK stores. See the product price, known delivery and total together.</p>
        <ul className="home-empty-checks">
          <li><SupplementScoutIcon name="package" />Match the exact variant and size</li>
          <li><SupplementScoutIcon name="truck" />Check delivery before you buy</li>
          <li><SupplementScoutIcon name="calculator" />Compare verified unit costs where available</li>
        </ul>
        <p className="home-data-note">
          {comparisons.state === "unavailable"
            ? "Featured prices are temporarily unavailable. You can still search the catalogue."
            : "No multi-store comparison currently meets our freshness and delivery checks. Explore the catalogue to see available offers."}
        </p>
        <a href="/how-we-compare" className="home-text-link">How we compare prices <span aria-hidden="true">↗</span></a>
      </aside>
    );
  }

  const best = row.bestOffer;
  const savings = calculateDeliveredSavings(best.deliveredPrice.totalPrice, row.offers[1]?.deliveredPrice.totalPrice ?? null);
  const checkedAt = formatOfferCheckedDate(best.lastCheckedAt);
  const details = comparisons.details?.[row.variantId];
  const history = details?.history || [];
  const metrics = details?.metrics.length ? details.metrics : [
    { value: formatCurrency(best.deliveredPrice.totalPrice), label: "lowest listed total" },
    { value: String(row.retailerCount), label: "stores compared" },
    { value: row.packLabel, label: "same exact pack" },
  ];
  const savingPercent = savings === null ? null : (savings / row.offers[1].deliveredPrice.totalPrice * 100).toLocaleString("en-GB", { maximumFractionDigits: 1 });
  return (
    <aside className="home-comparison" aria-labelledby="comparison-heading" data-home-comparison>
      <div className="home-comparison-top">
        <h2 id="comparison-heading" className="home-featured-pill"><SupplementScoutIcon name="trophy" size={24} /> Featured comparison</h2>
        {checkedAt && <p className="home-check-time"><SupplementScoutIcon name="clock" size={16} /><span>Lowest offer checked<br /><time dateTime={best.lastCheckedAt}>{checkedAt}</time></span></p>}
      </div>
      {savings !== null && <div className="home-saving-seal" aria-label={`Save ${formatCurrency(savings)} (${savingPercent}%) versus the next listed retailer, including delivery`}>
        <span>Save</span><strong>{formatCurrency(savings)}</strong><span>({savingPercent}%)</span>
      </div>}
      <div className="home-comparison-product">
        <div className="home-product-image">
          <ComparisonProductHeroImage image={row.image} name={row.name} productUrl={productHref(row)} nativeNavigation eager optimize />
          {row.image && details?.flavour && <p className="home-image-note">Product image. Flavour packaging may vary.</p>}
        </div>
        <div className="min-w-0">
          {row.brand && <p className="home-product-brand">{row.brand}</p>}
          <h3><a href={productHref(row)}>{row.name}</a></h3>
          <p className="home-product-pack">{row.packLabel}{details?.flavour && <> · {details.flavour}</>}</p>
          <dl className="home-metrics" aria-label="Product comparison metrics">
            {metrics.map((metric) => <div key={metric.label}><dd>{metric.value}</dd><dt>{metric.label}</dt></div>)}
          </dl>
          <p className="home-metric-note">{details?.metrics.length ? "Unit costs include known delivery." : "Verified serving details unavailable for this variant."}</p>
          <span className="home-live-label"><SupplementScoutIcon name="check" size={16} /> In stock · same exact variant</span>
        </div>
      </div>
      <p className="sr-only">
          Lowest listed delivered price: <strong>{formatCurrency(best.deliveredPrice.totalPrice)}</strong> at {best.retailer.name}.{' '}
          {formatCurrency(best.productPrice)} product + {best.shippingCost === 0 ? "free delivery" : `${formatCurrency(best.shippingCost)} delivery`}
      </p>
      <div className="home-offers-heading"><span>Compare the same variant</span><span>Total incl. delivery</span></div>
      <ul className="home-offer-list" aria-label="Retailer delivered prices">
        {row.offers.slice(0, 3).map((offer, index) => (
          <li key={offer.id}>
            <a href={`/go/${offer.id}?source=product_best_offer`} rel="sponsored nofollow noopener noreferrer" className="home-offer-row">
              <span className="home-offer-name">{offer.retailer.name}</span>
              <span className="home-offer-delivery"><SupplementScoutIcon name="truck" size={16} />{offer.shippingCost === 0 ? "Free delivery" : `${formatCurrency(offer.shippingCost)} delivery`}</span>
              <span className="home-offer-total"><strong>{formatCurrency(offer.deliveredPrice.totalPrice)}</strong></span>
              {index === 0 ? <span className="home-best-badge">Best price</span> : <span className="home-offer-difference">+{formatCurrency(offer.deliveredPrice.totalPrice - best.deliveredPrice.totalPrice)}</span>}
              <SupplementScoutIcon name="external-link" size={16} />
            </a>
          </li>
        ))}
      </ul>
      {history.length >= 2 && <a href={productHref(row)} className="home-text-link">Compare {row.retailerCount} stores <span aria-hidden="true">→</span></a>}
      {history.length >= 2 ? <PriceHistoryChart data={history} currentPrice={best.deliveredPrice.totalPrice} compact /> :
        <div className="home-history home-history-empty"><SupplementScoutIcon name="chart" size={24} /><div><strong>Price history</strong><p>Comparable history unavailable for this offer.</p></div><a href={productHref(row)}>Compare {row.retailerCount} stores &amp; history <span aria-hidden="true">→</span></a></div>}
      <p className="home-data-note">{savings !== null && <>Save {formatCurrency(savings)} vs the next listed retailer, including delivery. </>}Prices can change at the retailer.</p>
    </aside>
  );
}

export function HomeCurrentComparisons({ rows }: { rows: DealsRow[] }) {
  if (!rows.length) return null;
  return (
    <section className="home-section home-current" aria-labelledby="current-prices-heading">
      <div className="home-section-heading">
        <div><p className="home-kicker">Let the numbers do the talking</p><h2 id="current-prices-heading"><span className="home-underline">Find a better deal</span></h2></div>
        <p className="home-section-copy">Fresh prices. The same variant. Delivery included.</p>
        <a href="/deals" className="home-deals-link">View all deals <span aria-hidden="true">→</span></a>
      </div>
      <div className="home-current-grid">
        {rows.map((row) => {
          const saving = calculateDeliveredSavings(row.bestOffer.deliveredPrice.totalPrice, row.offers[1]?.deliveredPrice.totalPrice ?? null);
          return (
          <article key={row.id} className="home-current-card">
            <div className="home-current-product">
              <div className="home-product-image"><ComparisonProductThumbnail image={row.image} name={row.name} productUrl={productHref(row)} nativeNavigation /></div>
              <div className="min-w-0"><h3><a href={productHref(row)}>{row.name}</a></h3><p className="home-product-pack">{row.packLabel}</p><a href={productHref(row)} className="home-current-link">Compare {row.retailerCount} stores <span aria-hidden="true">→</span></a></div>
            </div>
            <div className="home-current-value"><p className="home-current-price">{formatCurrency(row.bestOffer.deliveredPrice.totalPrice)}</p><p className="home-current-retailer">incl. delivery</p>{saving !== null && <span className="home-small-saving" title="Compared with the next listed retailer, including delivery">Save {formatCurrency(saving)}</span>}</div>
          </article>
        );})}
      </div>
    </section>
  );
}
