export const ANALYTICS_CONSENT_STORAGE_KEY = "supplementscout_cookie_consent_v1";

export type AnalyticsConsentPreference = "accepted" | "rejected";

export type ConsentStorage = Pick<Storage, "getItem" | "setItem">;

export function parseAnalyticsConsent(value: string | null) {
  return value === "accepted" || value === "rejected" ? value : null;
}

export function readAnalyticsConsent(storage: ConsentStorage | null) {
  if (!storage) return null;

  try {
    return parseAnalyticsConsent(storage.getItem(ANALYTICS_CONSENT_STORAGE_KEY));
  } catch {
    return null;
  }
}

export function persistAnalyticsConsent(
  storage: ConsentStorage | null,
  preference: AnalyticsConsentPreference
) {
  if (!storage) return false;

  try {
    storage.setItem(ANALYTICS_CONSENT_STORAGE_KEY, preference);
    return true;
  } catch {
    return false;
  }
}

export function googleConsentUpdate(preference: AnalyticsConsentPreference) {
  return {
    analytics_storage: preference === "accepted" ? "granted" : "denied",
    ad_storage: "denied",
    ad_user_data: "denied",
    ad_personalization: "denied",
  } as const;
}

export function isAnalyticsAvailable(enabled: boolean, measurementId: string) {
  return enabled && /^G-[A-Z0-9]+$/.test(measurementId);
}

export function shouldTrackRoute(
  previousRoute: string | null,
  currentRoute: string,
  enabled: boolean
) {
  return enabled && previousRoute !== currentRoute;
}
