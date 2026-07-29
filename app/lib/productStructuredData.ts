const SITE_URL = "https://www.supplementscout.co.uk";

type StructuredProductInput = {
  id: string | number;
  brand: string | null;
  image: string | null;
  name: string;
  slug: string | null;
};

type StructuredOfferInput = {
  id: string | number;
  in_stock: boolean | null;
  price: string | number | null;
  product_variant_id: string | number | null;
};

type BuildProductStructuredDataInput = {
  description: string;
  offers: StructuredOfferInput[];
  product: StructuredProductInput;
};

function trimmed(value: unknown) {
  return typeof value === "string" ? value.trim() : "";
}

function positivePrice(value: string | number | null) {
  if (value === null || value === "") return null;

  const price = Number(value);
  return Number.isFinite(price) && price > 0
    ? Number(price.toFixed(2))
    : null;
}

function safeAbsoluteHttpUrl(value: string | null) {
  const normalized = trimmed(value);
  if (!normalized) return null;

  try {
    const url = new URL(normalized);
    return url.protocol === "https:" || url.protocol === "http:"
      ? url.toString()
      : null;
  } catch {
    return null;
  }
}

export function productCanonicalUrl(product: StructuredProductInput) {
  const routeValue = trimmed(product.slug) || String(product.id);
  return `${SITE_URL}/product/${encodeURIComponent(routeValue)}`;
}

function buildAggregateOffer(
  offers: StructuredOfferInput[],
  canonicalUrl: string
) {
  const seenOfferIds = new Set<string>();
  const validOffers = offers.flatMap((offer) => {
    const price = positivePrice(offer.price);
    const variantId =
      offer.product_variant_id === null
        ? ""
        : String(offer.product_variant_id).trim();
    const offerId = String(offer.id).trim();

    if (
      offer.in_stock !== true ||
      price === null ||
      !variantId ||
      !offerId ||
      seenOfferIds.has(offerId)
    ) {
      return [];
    }

    seenOfferIds.add(offerId);
    return [{ price, variantId }];
  });
  const variantIds = new Set(validOffers.map((offer) => offer.variantId));

  if (validOffers.length === 0 || variantIds.size !== 1) {
    return null;
  }

  const prices = validOffers.map((offer) => offer.price);

  return {
    "@type": "AggregateOffer",
    availability: "https://schema.org/InStock",
    highPrice: Math.max(...prices),
    lowPrice: Math.min(...prices),
    offerCount: validOffers.length,
    priceCurrency: "GBP",
    url: canonicalUrl,
  };
}

export function buildProductStructuredData({
  description,
  offers,
  product,
}: BuildProductStructuredDataInput) {
  const canonicalUrl = productCanonicalUrl(product);
  const aggregateOffer = buildAggregateOffer(offers, canonicalUrl);
  const brand = trimmed(product.brand);
  const image = safeAbsoluteHttpUrl(product.image);

  const breadcrumbEntity = {
    "@type": "BreadcrumbList",
    "@id": `${canonicalUrl}#breadcrumb`,
    itemListElement: [
      {
        "@type": "ListItem",
        position: 1,
        name: "SupplementScout",
        item: SITE_URL,
      },
      {
        "@type": "ListItem",
        position: 2,
        name: product.name,
        item: canonicalUrl,
      },
    ],
  };

  return {
    "@context": "https://schema.org",
    "@graph": [
      ...(aggregateOffer
        ? [
            {
              "@type": "Product",
              "@id": `${canonicalUrl}#product`,
              description: trimmed(description),
              name: product.name,
              url: canonicalUrl,
              ...(brand && !/^unknown(?:\s+brand)?$/i.test(brand)
                ? { brand: { "@type": "Brand", name: brand } }
                : {}),
              ...(image ? { image: [image] } : {}),
              offers: aggregateOffer,
            },
          ]
        : []),
      breadcrumbEntity,
    ],
  };
}

export function serializeJsonLd(value: unknown) {
  return JSON.stringify(value).replace(/</g, "\\u003c");
}
