import type { MetadataRoute } from "next";
import { supabase } from "./lib/supabase";
import { getSitemapIndexability } from "./lib/sitemapReadiness";
import { isSitemapPathIndexable } from "./lib/sitemapIndexability";

const siteUrl = "https://www.supplementscout.co.uk";
const SITEMAP_PAGE_SIZE = 1000;

export const dynamic = "force-dynamic";

type SitemapProduct = {
  id: number | string;
  slug: string | null;
  created_at: string;
  offers:
    | {
        last_checked_at: string | null;
      }[]
    | null;
};

function productLastModified(product: SitemapProduct) {
  const timestamps = [
    product.created_at,
    ...(product.offers || []).map((offer) => offer.last_checked_at),
  ]
    .filter((value): value is string => Boolean(value))
    .map((value) => Date.parse(value))
    .filter(Number.isFinite);

  return timestamps.length > 0
    ? new Date(Math.max(...timestamps)).toISOString()
    : undefined;
}

async function loadActiveProducts() {
  const products: SitemapProduct[] = [];
  let expectedProductCount: number | null = null;

  for (let from = 0; ; from += SITEMAP_PAGE_SIZE) {
    const { data, error, count } = await supabase
      .from("products")
      .select("id, slug, created_at, offers(last_checked_at)", {
        count: "exact",
      })
      .eq("is_active", true)
      .is("merged_into_product_id", null)
      .not("slug", "is", null)
      .order("id", { ascending: true })
      .range(from, from + SITEMAP_PAGE_SIZE - 1);

    if (error) {
      throw new Error("Unable to load complete product sitemap data.");
    }

    if (count === null) {
      throw new Error("Unable to verify complete product sitemap data.");
    }

    if (expectedProductCount === null) {
      expectedProductCount = count;
    } else if (count !== expectedProductCount) {
      throw new Error("Product sitemap data changed during pagination.");
    }

    const page = (data || []) as SitemapProduct[];
    products.push(...page);

    if (page.length < SITEMAP_PAGE_SIZE) {
      if (products.length !== expectedProductCount) {
        throw new Error("Product sitemap data is incomplete.");
      }
      return products;
    }
  }
}

const staticPages: MetadataRoute.Sitemap = [
  {
    url: siteUrl,
    changeFrequency: "daily",
    priority: 1,
  },
  {
    url: `${siteUrl}/compare`,
    changeFrequency: "daily",
    priority: 0.9,
  },
  {
    url: `${siteUrl}/vitamins`,
    changeFrequency: "weekly",
    priority: 0.9,
  },
  {
    url: `${siteUrl}/magnesium`,
    changeFrequency: "weekly",
    priority: 0.9,
  },
  {
    url: `${siteUrl}/vitamin-d`,
    changeFrequency: "weekly",
    priority: 0.9,
  },
  {
    url: `${siteUrl}/omega-3`,
    changeFrequency: "weekly",
    priority: 0.9,
  },
  {
    url: `${siteUrl}/glucosamine`,
    changeFrequency: "weekly",
    priority: 0.9,
  },
  {
    url: `${siteUrl}/hydration`,
    changeFrequency: "daily",
    priority: 0.9,
  },
  {
    url: `${siteUrl}/whey-protein`,
    changeFrequency: "daily",
    priority: 0.9,
  },
  {
    url: `${siteUrl}/whey-isolate`,
    changeFrequency: "daily",
    priority: 0.9,
  },
  {
    url: `${siteUrl}/vegan-protein`,
    changeFrequency: "daily",
    priority: 0.9,
  },
  {
    url: `${siteUrl}/mass-gainer`,
    changeFrequency: "daily",
    priority: 0.9,
  },
  {
    url: `${siteUrl}/protein-bars`,
    changeFrequency: "daily",
    priority: 0.9,
  },
  {
    url: `${siteUrl}/deals`,
    changeFrequency: "daily",
    priority: 0.9,
  },
  {
    url: `${siteUrl}/multivitamins`,
    changeFrequency: "daily",
    priority: 0.9,
  },
  {
    url: `${siteUrl}/pre-workout`,
    changeFrequency: "daily",
    priority: 0.9,
  },
  {
    url: `${siteUrl}/amino-acids`,
    changeFrequency: "daily",
    priority: 0.9,
  },
  {
    url: `${siteUrl}/brands/applied-nutrition`,
    changeFrequency: "daily",
    priority: 0.8,
  },
  {
    url: `${siteUrl}/brands/per4m`,
    changeFrequency: "daily",
    priority: 0.8,
  },
  {
    url: `${siteUrl}/brands/biotech-usa`,
    changeFrequency: "daily",
    priority: 0.8,
  },
  {
    url: `${siteUrl}/retailers/ebay-uk`,
    changeFrequency: "daily",
    priority: 0.8,
  },
  {
    url: `${siteUrl}/creatine`,
    changeFrequency: "daily",
    priority: 0.9,
  },
  {
    url: `${siteUrl}/how-we-compare`,
    changeFrequency: "monthly",
    priority: 0.7,
  },
  {
    url: `${siteUrl}/data-freshness`,
    changeFrequency: "monthly",
    priority: 0.7,
  },
  {
    url: `${siteUrl}/about`,
    changeFrequency: "monthly",
    priority: 0.6,
  },
  {
    url: `${siteUrl}/affiliate-disclosure`,
    changeFrequency: "monthly",
    priority: 0.6,
  },
  {
    url: `${siteUrl}/contact`,
    changeFrequency: "monthly",
    priority: 0.6,
  },
];

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const [products, indexability] = await Promise.all([
    loadActiveProducts(),
    getSitemapIndexability(),
  ]);

  const productPages =
    products
      .filter((product) => product.slug)
      .map((product) => ({
        url: `${siteUrl}/product/${product.slug}`,
        lastModified: productLastModified(product),
        changeFrequency: "daily" as const,
        priority: 0.8,
      }));

  const readyStaticPages = staticPages.filter((page) => {
    const path = new URL(page.url).pathname;
    return isSitemapPathIndexable(path, indexability);
  });

  return [...readyStaticPages, ...productPages];
}
