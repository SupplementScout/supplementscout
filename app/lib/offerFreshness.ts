export const MAXIMUM_CURRENT_OFFER_AGE_HOURS = 24;

export function isOfferFresh(
  checkedAt: string | null | undefined,
  now = new Date()
) {
  const checkedAtTime = checkedAt ? Date.parse(checkedAt) : Number.NaN;

  if (!Number.isFinite(checkedAtTime)) {
    return false;
  }

  const ageHours = (now.getTime() - checkedAtTime) / 3_600_000;

  return (
    Number.isFinite(ageHours) &&
    ageHours >= 0 &&
    ageHours <= MAXIMUM_CURRENT_OFFER_AGE_HOURS
  );
}
