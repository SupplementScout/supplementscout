import { ComparisonProductHeroImage, ComparisonProductThumbnail } from "./components/ComparisonProductVisuals";
import SupplementScoutIcon from "./components/SupplementScoutIcon";
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
  return (
    <aside className="home-comparison" aria-labelledby="comparison-heading" data-home-comparison>
      <div className="home-comparison-top">
        <h2 id="comparison-heading" className="home-kicker">Featured comparison</h2>
        <span className="home-live-label"><SupplementScoutIcon name="check" size={16} /> In stock</span>
      </div>
      <div className="home-comparison-product">
        <div className="home-product-image">
          <ComparisonProductHeroImage image={row.image} name={row.name} productUrl={productHref(row)} nativeNavigation />
        </div>
        <div className="min-w-0">
          {row.brand && <p className="home-product-brand">{row.brand}</p>}
          <h3><a href={productHref(row)}>{row.name}</a></h3>
          <p className="home-product-pack">{row.packLabel} <span aria-hidden="true">·</span> Same exact variant</p>
        </div>
      </div>
      <div className="home-best-price">
        <p>Lowest listed delivered price</p>
        <div className="home-price-line">
          <strong>{formatCurrency(best.deliveredPrice.totalPrice)}</strong>
          <span>at {best.retailer.name}</span>
        </div>
        <p className="home-price-breakdown">
          {formatCurrency(best.productPrice)} product + {best.shippingCost === 0 ? "free delivery" : `${formatCurrency(best.shippingCost)} delivery`}
        </p>
        {savings !== null && <p className="home-saving">Save {formatCurrency(savings)} vs the next listed retailer</p>}
      </div>
      <div className="home-offers-heading"><span>Compare stores</span><span>Total incl. delivery</span></div>
      <ul className="home-offer-list" aria-label="Retailer delivered prices">
        {row.offers.slice(0, 3).map((offer, index) => (
          <li key={offer.id}>
            <a href={`/go/${offer.id}?source=product_best_offer`} rel="sponsored nofollow noopener noreferrer" className="home-offer-row">
              <span className="home-offer-name"><span className="home-store-icon"><SupplementScoutIcon name="store" size={18} /></span><span>{offer.retailer.name}{index === 0 && <small>Lowest listed total</small>}</span></span>
              <span className="home-offer-total"><strong>{formatCurrency(offer.deliveredPrice.totalPrice)}</strong><small>{offer.shippingCost === 0 ? "Free delivery" : `Incl. ${formatCurrency(offer.shippingCost)} delivery`}</small></span>
              <SupplementScoutIcon name="external-link" size={16} />
            </a>
          </li>
        ))}
      </ul>
      <a href={productHref(row)} className="home-compare-link">Compare {row.retailerCount} stores <span aria-hidden="true">→</span></a>
      <p className="home-data-note">{checkedAt && <><SupplementScoutIcon name="clock" size={16} /> Lowest offer checked <time dateTime={best.lastCheckedAt}>{checkedAt}</time>. </>}Prices can change at the retailer.</p>
    </aside>
  );
}

export function HomeCurrentComparisons({ rows }: { rows: DealsRow[] }) {
  if (!rows.length) return null;
  return (
    <section className="home-section home-current" aria-labelledby="current-prices-heading">
      <div className="home-section-heading">
        <div><p className="home-kicker">Let the numbers do the talking</p><h2 id="current-prices-heading">More prices worth comparing</h2></div>
        <a href="/deals" className="home-text-link">All current comparisons <span aria-hidden="true">→</span></a>
      </div>
      <p className="home-section-copy">The same variant. The same pack. See how current delivered prices compare across stores.</p>
      <div className="home-current-grid">
        {rows.map((row) => (
          <article key={row.id} className="home-current-card">
            <div className="home-current-product">
              <div className="home-product-image"><ComparisonProductThumbnail image={row.image} name={row.name} productUrl={productHref(row)} nativeNavigation /></div>
              <div className="min-w-0"><p className="home-product-brand">{row.brand}</p><h3><a href={productHref(row)}>{row.name}</a></h3><p className="home-product-pack">{row.packLabel}</p></div>
            </div>
            <p className="home-current-price">{formatCurrency(row.bestOffer.deliveredPrice.totalPrice)} <span>incl. delivery</span></p>
            <p className="home-current-retailer">Lowest listed total at {row.bestOffer.retailer.name}</p>
            <a href={productHref(row)} className="home-current-link">Compare {row.retailerCount} stores <span aria-hidden="true">→</span></a>
          </article>
        ))}
      </div>
    </section>
  );
}
