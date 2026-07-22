"use client";

import { useState } from "react";
import {
  getGroupOfferDisplayLabels,
  getOfferDeliveredTotal,
  getOfferVariantLabel,
  productOfferHref,
  selectGroupOffer,
  type ProductOffer,
  type ProductOfferGroup,
} from "../lib/productOfferGroups";
import { formatCurrency, getKnownProductPrice } from "../lib/pricing";
import { sendAnalyticsEvent } from "../lib/analytics";
import type { ProductAnalyticsContext } from "./ProductAnalytics";

function formatShipping(value: number | string | null) {
  if (value === null || value === "") return "Delivery unknown";

  const shipping = Number(value);

  return Number.isFinite(shipping) && shipping >= 0
    ? `Delivery: ${formatCurrency(shipping)}`
    : "Delivery unknown";
}

function formatProductPrice(value: number | string | null) {
  const price = getKnownProductPrice(value);

  return price === null ? "Price unavailable" : formatCurrency(price);
}

function VariantPrice({ offer }: { offer: ProductOffer }) {
  const deliveredTotal = getOfferDeliveredTotal(offer);

  return (
    <span className="mt-1 block text-xs font-medium opacity-75">
      {formatProductPrice(offer.price)}
      {deliveredTotal !== null ? ` · ${formatCurrency(deliveredTotal)} delivered` : ""}
    </span>
  );
}

export default function RetailerOfferCard({
  group,
  product,
  position,
}: {
  group: ProductOfferGroup;
  product: ProductAnalyticsContext;
  position: number;
}) {
  const [selectedOfferId, setSelectedOfferId] = useState(
    String(group.offers[0]?.id || "")
  );
  const selectedOffer = selectGroupOffer(group, selectedOfferId);

  if (!selectedOffer) return null;

  const hasMultipleVariants = group.offers.length > 1;
  const displayLabels = getGroupOfferDisplayLabels(group.offers);
  const selectedVariantLabel = hasMultipleVariants
    ? displayLabels.get(String(selectedOffer.id)) || null
    : getOfferVariantLabel(selectedOffer);
  const selectedDeliveredTotal = getOfferDeliveredTotal(selectedOffer);

  return (
    <article className="w-full min-w-0 max-w-full rounded-2xl border border-zinc-200 p-4 sm:p-5">
      <div className="flex min-w-0 flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div className="flex min-w-0 items-center gap-3">
          {group.retailer?.logo && (
            // Retailer logos are remote, data-driven URLs and keep their natural aspect ratio.
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={group.retailer.logo}
              alt=""
              className="h-10 w-10 shrink-0 rounded-lg object-contain"
            />
          )}
          <div className="min-w-0">
            <h3 className="break-words font-semibold text-gray-900 [overflow-wrap:anywhere]">
              {group.retailer?.name || "Unknown retailer"}
            </h3>
            {hasMultipleVariants && (
              <p className="mt-1 text-sm font-medium text-gray-700">
                {group.offers.length} available variants
              </p>
            )}
            {!hasMultipleVariants && selectedVariantLabel && (
              <p className="mt-1 text-sm font-medium text-gray-700">
                {selectedVariantLabel}
              </p>
            )}
          </div>
        </div>

        <div className="min-w-0 text-left sm:text-right">
          <p className="text-sm font-medium text-gray-700">
            Product: {formatProductPrice(selectedOffer.price)}
          </p>
          <p className="text-sm font-medium text-gray-700">
            {formatShipping(selectedOffer.shipping_cost)}
          </p>
          <p className="mt-1 break-words text-2xl font-bold text-gray-900 [overflow-wrap:anywhere]">
            {selectedDeliveredTotal !== null
              ? formatCurrency(selectedDeliveredTotal)
              : "Total unknown"}
          </p>
        </div>
      </div>

      {hasMultipleVariants && (
        <div className="mt-4 border-t border-zinc-200 pt-4">
          <p className="text-sm font-semibold text-gray-900">Available flavours</p>
          <div className="mt-2 flex flex-wrap items-stretch gap-2" role="group" aria-label="Available flavours">
            {group.offers.map((offer) => {
              const label = displayLabels.get(String(offer.id)) || "Option";
              const isSelected = String(offer.id) === String(selectedOffer.id);

              return (
                <button
                  key={offer.id}
                  type="button"
                  aria-pressed={isSelected}
                  onClick={() => setSelectedOfferId(String(offer.id))}
                  className={`w-full min-w-0 max-w-full whitespace-normal rounded-xl border px-3 py-2 text-left text-sm font-semibold transition focus:outline-none focus:ring-2 focus:ring-black focus:ring-offset-2 sm:w-auto sm:max-w-xs ${
                    isSelected
                      ? "border-black bg-black text-white"
                      : "border-zinc-300 bg-white text-gray-800 hover:border-zinc-500"
                  }`}
                >
                  <span className="block break-words [overflow-wrap:anywhere]">{label}</span>
                  {!group.hasSharedPricing && <VariantPrice offer={offer} />}
                </button>
              );
            })}
          </div>
        </div>
      )}

      <div className="mt-4 flex min-w-0 flex-col gap-3 border-t border-zinc-200 pt-4 sm:flex-row sm:items-end sm:justify-between">
        <div className="min-w-0 text-xs text-gray-600">
          {selectedVariantLabel && hasMultipleVariants && (
            <p className="break-words font-semibold text-gray-800 [overflow-wrap:anywhere]">
              Selected: {selectedVariantLabel}
            </p>
          )}
          {group.lowestProductPrice !== null && (
            <p>Lowest product price: {formatCurrency(group.lowestProductPrice)}</p>
          )}
          {group.lowestDeliveredTotal !== null && (
            <p>Lowest delivered price: {formatCurrency(group.lowestDeliveredTotal)}</p>
          )}
          {selectedOffer.last_checked_at && (
            <p>
              Price checked: {new Date(selectedOffer.last_checked_at).toLocaleDateString("en-GB", {
                day: "numeric",
                month: "long",
                year: "numeric",
              })}
            </p>
          )}
        </div>

        <a
          href={productOfferHref(selectedOffer.id, "product_offer_list")}
          target="_blank"
          rel="sponsored nofollow noopener noreferrer"
          onClick={() => {
            const offerPrice = Number(selectedOffer.price);
            sendAnalyticsEvent("retailer_offer_click", {
              ...product,
              variant_id: String(selectedOffer.product_variant_id),
              retailer_id: selectedOffer.retailer?.id ? String(selectedOffer.retailer.id) : undefined,
              retailer_name: selectedOffer.retailer?.name || undefined,
              offer_price: Number.isFinite(offerPrice) ? offerPrice : undefined,
              position,
              source_page: "product_offer_list",
              is_affiliate: false,
            });
          }}
          className="flex min-h-12 w-full min-w-0 max-w-full shrink-0 items-center justify-center rounded-xl bg-black px-5 py-3 text-center text-sm font-semibold text-white focus:outline-none focus:ring-2 focus:ring-black focus:ring-offset-2 sm:w-auto"
        >
          View deal{selectedVariantLabel ? ` · ${selectedVariantLabel}` : ""}
        </a>
      </div>
    </article>
  );
}
