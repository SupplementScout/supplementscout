import {
  INDEXABILITY_LIFECYCLE,
  isLifecycleStatusIndexable,
} from "./indexabilityLifecycle";

/**
 * Compatibility adapter for sitemap callers and contract tests.
 *
 * Coverage readiness remains in each comparison module for launch evidence and
 * monitoring. Once a route is live-verified, sitemap eligibility is determined
 * only by the shared lifecycle map and never by a transient coverage query.
 */
export async function getSitemapIndexability() {
  return new Map(
    Object.entries(INDEXABILITY_LIFECYCLE).map(([path, status]) => [
      path,
      isLifecycleStatusIndexable(status),
    ])
  );
}
