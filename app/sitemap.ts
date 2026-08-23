import type { MetadataRoute } from "next";
import { CREATINE_LAUNCH_STATUS } from "./lib/creatineLaunch";
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

  for (let from = 0; ; from += SITEMAP_PAGE_SIZE) {
    const { data, error } = await supabase
      .from("products")
      .select("id, slug, created_at, offers(last_checked_at)")
      .eq("is_active", true)
      .is("merged_into_product_id", null)
      .not("slug", "is", null)
      .order("id", { ascending: true })
      .range(from, from + SITEMAP_PAGE_SIZE - 1);

    if (error) {
      return { products: [] as SitemapProduct[], error };
    }

    const page = (data || []) as SitemapProduct[];
    products.push(...page);

    if (page.length < SITEMAP_PAGE_SIZE) {
      return { products, error: null };
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

const creatinePages: MetadataRoute.Sitemap = CREATINE_LAUNCH_STATUS.includeInSitemap
  ? [
      {
        url: `${siteUrl}/creatine`,
        changeFrequency: "daily",
        priority: 0.9,
      },
    ]
  : [];

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const [{ products, error }, indexability] = await Promise.all([
    loadActiveProducts(),
    getSitemapIndexability(),
  ]);

  if (error) {
    console.error("Unable to load product pages for sitemap.", error);
  }

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

  return [...readyStaticPages, ...creatinePages, ...productPages];
}
