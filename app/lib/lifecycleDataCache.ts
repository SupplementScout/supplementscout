import { unstable_cache } from "next/cache";
import { assertLifecycleDataAvailable } from "./indexabilityLifecycle";

export const LIFECYCLE_DATA_CACHE_SECONDS = 3600;
const LIFECYCLE_DATA_CACHE_MS = LIFECYCLE_DATA_CACHE_SECONDS * 1000;

type LifecycleResult = { error: boolean };
type CachedReader<T> = (timeBucket: number) => Promise<T>;
type CacheFactory = <T>(
  read: (timeBucket: number) => Promise<T>,
  keyParts: string[],
  options: { revalidate: number; tags: string[] }
) => CachedReader<T>;

type LifecycleDataLoaderOptions = {
  now?: () => number;
  cacheFactory?: CacheFactory;
};

/**
 * Cache successful public-hub data across requests without caching failures.
 *
 * The hour bucket is part of the Next cache key. A new bucket therefore causes
 * a synchronous read rather than serving data older than one hour while a
 * background revalidation runs.
 */
export function createLifecycleDataLoader<T extends LifecycleResult>(
  path: string,
  queryVersion: string,
  load: () => Promise<T>,
  options: LifecycleDataLoaderOptions = {}
) {
  const now = options.now || Date.now;
  const cacheFactory: CacheFactory =
    options.cacheFactory ||
    ((read, keyParts, cacheOptions) =>
      unstable_cache(read, keyParts, cacheOptions));

  const readCached = cacheFactory(
    async (timeBucket) => {
      void timeBucket;
      const result = await load();
      assertLifecycleDataAvailable(result, path);
      return result;
    },
    ["lifecycle-hub-data-v1", path, queryVersion],
    {
      revalidate: LIFECYCLE_DATA_CACHE_SECONDS,
      tags: [`lifecycle-hub:${path}`],
    }
  );

  return () => readCached(Math.floor(now() / LIFECYCLE_DATA_CACHE_MS));
}
