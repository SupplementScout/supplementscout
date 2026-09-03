export const MAXIMUM_CURRENT_OFFER_AGE_HOURS = 24;
export const MAXIMUM_CURRENT_OFFER_AGE_DAYS =
  MAXIMUM_CURRENT_OFFER_AGE_HOURS / 24;
export const MAXIMUM_RECENT_OFFER_AGE_HOURS = 72;

export type OfferPresentationState =
  | "LIVE"
  | "RECENT"
  | "OUT_OF_STOCK"
  | "UNVERIFIED"
  | "REVIEW";

export type OfferPresentationInput = {
  last_checked_at?: string | null;
  in_stock?: boolean | null;
  requires_review?: boolean;
};

export type OfferPresentation = {
  state: OfferPresentationState;
  checkedAt: string | null;
  ageHours: number | null;
};

export const OFFER_PRESENTATION_LABELS: Record<
  OfferPresentationState,
  string
> = {
  LIVE: "Current price",
  RECENT: "Last seen",
  OUT_OF_STOCK: "Out of stock",
  UNVERIFIED: "Availability being rechecked",
  REVIEW: "Availability under review",
};

function checkedAtEvidence(
  checkedAt: string | null | undefined,
  now: Date
) {
  const checkedAtTime = checkedAt ? Date.parse(checkedAt) : Number.NaN;
  const ageHours = (now.getTime() - checkedAtTime) / 3_600_000;

  if (!Number.isFinite(checkedAtTime) || !Number.isFinite(ageHours) || ageHours < 0) {
    return { checkedAt: null, ageHours: null };
  }

  return { checkedAt: checkedAt as string, ageHours };
}

export function isOfferFresh(
  checkedAt: string | null | undefined,
  now = new Date()
) {
  const { ageHours } = checkedAtEvidence(checkedAt, now);

  return (
    ageHours !== null &&
    ageHours <= MAXIMUM_CURRENT_OFFER_AGE_HOURS
  );
}

export function classifyOfferPresentation(
  offer: OfferPresentationInput,
  now = new Date()
): OfferPresentation {
  const evidence = checkedAtEvidence(offer.last_checked_at, now);

  if (offer.requires_review === true) {
    return { state: "REVIEW", ...evidence };
  }

  if (evidence.ageHours === null) {
    return { state: "UNVERIFIED", ...evidence };
  }

  if (evidence.ageHours <= MAXIMUM_CURRENT_OFFER_AGE_HOURS) {
    if (offer.in_stock === true) return { state: "LIVE", ...evidence };
    if (offer.in_stock === false) return { state: "OUT_OF_STOCK", ...evidence };
    return { state: "UNVERIFIED", ...evidence };
  }

  if (
    offer.in_stock === true &&
    evidence.ageHours <= MAXIMUM_RECENT_OFFER_AGE_HOURS
  ) {
    return { state: "RECENT", ...evidence };
  }

  return { state: "UNVERIFIED", ...evidence };
}

export function classifyOfferCollection(
  offers: OfferPresentationInput[],
  now = new Date()
): OfferPresentation {
  const classified = offers.map((offer) => classifyOfferPresentation(offer, now));
  const priority: OfferPresentationState[] = [
    "LIVE",
    "OUT_OF_STOCK",
    "RECENT",
    "REVIEW",
    "UNVERIFIED",
  ];

  for (const state of priority) {
    const matches = classified
      .filter((item) => item.state === state)
      .sort((left, right) => {
        const leftTime = left.checkedAt ? Date.parse(left.checkedAt) : -Infinity;
        const rightTime = right.checkedAt ? Date.parse(right.checkedAt) : -Infinity;
        return rightTime - leftTime;
      });
    if (matches.length > 0) return matches[0];
  }

  return { state: "UNVERIFIED", checkedAt: null, ageHours: null };
}
