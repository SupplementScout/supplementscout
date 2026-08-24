export type IndexabilityLifecycleStatus =
  | "planned"
  | "launch_approved"
  | "live_verified"
  | "owner_deferred"
  | "manually_withdrawn";

export type RouteSearchParams = Record<
  string,
  string | string[] | undefined
>;

/**
 * Public comparison hubs which have completed owner approval and live
 * verification. Every route in this registry must have a real page, use the
 * shared robots/cache/error contracts and be emitted through the lifecycle
 * sitemap adapter.
 */
export const PUBLIC_INDEXABILITY_LIFECYCLE = Object.freeze({
  "/deals": "live_verified",
  "/whey-protein": "live_verified",
  "/vegan-protein": "live_verified",
  "/protein-bars": "live_verified",
  "/whey-isolate": "live_verified",
  "/mass-gainer": "live_verified",
  "/pre-workout": "live_verified",
  "/amino-acids": "live_verified",
  "/multivitamins": "live_verified",
  "/creatine": "live_verified",
  "/hydration": "live_verified",
  "/brands/applied-nutrition": "live_verified",
  "/brands/per4m": "live_verified",
  "/brands/biotech-usa": "live_verified",
  "/retailers/ebay-uk": "live_verified",
} satisfies Readonly<Record<string, IndexabilityLifecycleStatus>>);

/** Reserved decisions which deliberately do not create public routes. */
export const NON_PUBLIC_INDEXABILITY_DECISIONS = Object.freeze({
  "/brands/gym-high": "owner_deferred",
  "/retailers/gym-high": "owner_deferred",
} satisfies Readonly<Record<string, IndexabilityLifecycleStatus>>);

export const INDEXABILITY_LIFECYCLE = Object.freeze({
  ...PUBLIC_INDEXABILITY_LIFECYCLE,
  ...NON_PUBLIC_INDEXABILITY_DECISIONS,
});

export type LifecyclePath = keyof typeof INDEXABILITY_LIFECYCLE;

export function isLifecycleStatusIndexable(
  status: IndexabilityLifecycleStatus
) {
  return status === "launch_approved" || status === "live_verified";
}

export function getLifecycleStatus(path: string) {
  return (INDEXABILITY_LIFECYCLE as Readonly<Record<string, IndexabilityLifecycleStatus>>)[
    path
  ];
}

export function isLifecycleSitemapEligible(path: string) {
  const status = getLifecycleStatus(path);
  return status !== undefined && isLifecycleStatusIndexable(status);
}

export function hasUnapprovedSearchParams(searchParams: RouteSearchParams) {
  return Object.keys(searchParams).length > 0;
}

export function getLifecycleRobots(
  path: string,
  searchParams: RouteSearchParams = {}
) {
  const status = getLifecycleStatus(path);
  return {
    index:
      status !== undefined &&
      isLifecycleStatusIndexable(status) &&
      !hasUnapprovedSearchParams(searchParams),
    follow: true,
  };
}

export function assertLifecycleDataAvailable(
  result: { error: boolean },
  path: string
) {
  if (result.error) {
    throw new Error(`Current comparison data is temporarily unavailable for ${path}.`);
  }
}
