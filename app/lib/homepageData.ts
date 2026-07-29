import { unstable_cache } from "next/cache";
import { supabase } from "./supabase";

const HOMEPAGE_CATEGORY_FETCH_PAGE_SIZE = 1000;
const HOMEPAGE_REVALIDATE_SECONDS = 3600;

type CategoryRow = {
  category: string | null;
};

type LatestOfferCheckRow = {
  last_checked_at: string | null;
};

export type HomepageData = {
  categories: string[];
  latestOfferCheckAt: string | null;
  productCount: number | null;
  retailerCount: number | null;
};

async function fetchHomepageCategories() {
  const categories = new Set<string>();

  for (let from = 0; ; from += HOMEPAGE_CATEGORY_FETCH_PAGE_SIZE) {
    const { data, error } = await supabase
      .from("products")
      .select("category")
      .eq("is_active", true)
      .is("merged_into_product_id", null)
      .is("merged_at", null)
      .order("category")
      .order("id")
      .range(from, from + HOMEPAGE_CATEGORY_FETCH_PAGE_SIZE - 1);

    if (error) {
      throw error;
    }

    const rows = (data || []) as CategoryRow[];

    for (const row of rows) {
      const category = row.category?.trim();
      if (category) categories.add(category);
    }

    if (rows.length < HOMEPAGE_CATEGORY_FETCH_PAGE_SIZE) {
      break;
    }
  }

  return Array.from(categories).sort((left, right) =>
    left.localeCompare(right)
  );
}
async function fetchHomepageProductCount() {
  const { count, error } = await supabase
    .from("products")
    .select("*", { count: "exact", head: true })
    .eq("is_active", true)
    .is("merged_into_product_id", null)
    .is("merged_at", null);

  if (error) {
    throw error;
  }

  return count;
}

async function fetchHomepageRetailerCount() {
  const { count, error } = await supabase
    .from("retailers")
    .select("*", { count: "exact", head: true });

  if (error) {
    throw error;
  }

  return count;
}

async function fetchLatestOfferCheck() {
  const { data, error } = await supabase
    .from("offers")
    .select("last_checked_at")
    .not("last_checked_at", "is", null)
    .order("last_checked_at", { ascending: false })
    .limit(1);

  if (error) {
    throw error;
  }

  return ((data || []) as LatestOfferCheckRow[])[0]?.last_checked_at || null;
}

const getCachedHomepageCategories = unstable_cache(
  fetchHomepageCategories,
  ["homepage-categories-v1"],
  {
    revalidate: HOMEPAGE_REVALIDATE_SECONDS,
    tags: ["homepage-catalogue"],
  }
);

const getCachedHomepageProductCount = unstable_cache(
  fetchHomepageProductCount,
  ["homepage-product-count-v1"],
  {
    revalidate: HOMEPAGE_REVALIDATE_SECONDS,
    tags: ["homepage-catalogue"],
  }
);

const getCachedHomepageRetailerCount = unstable_cache(
  fetchHomepageRetailerCount,
  ["homepage-retailer-count-v1"],
  {
    revalidate: HOMEPAGE_REVALIDATE_SECONDS,
    tags: ["homepage-catalogue"],
  }
);

const getCachedLatestOfferCheck = unstable_cache(
  fetchLatestOfferCheck,
  ["homepage-latest-offer-check-v1"],
  {
    revalidate: HOMEPAGE_REVALIDATE_SECONDS,
    tags: ["homepage-catalogue"],
  }
);

function settledValue<T>(result: PromiseSettledResult<T>, fallback: T) {
  return result.status === "fulfilled" ? result.value : fallback;
}

export async function getHomepageData(): Promise<HomepageData> {
  const [categories, productCount, retailerCount, latestOfferCheckAt] =
    await Promise.allSettled([
      getCachedHomepageCategories(),
      getCachedHomepageProductCount(),
      getCachedHomepageRetailerCount(),
      getCachedLatestOfferCheck(),
    ]);

  return {
    categories: settledValue(categories, []),
    productCount: settledValue(productCount, null),
    retailerCount: settledValue(retailerCount, null),
    latestOfferCheckAt: settledValue(latestOfferCheckAt, null),
  };
}
