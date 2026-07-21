import type { MetadataRoute } from "next";
import { CREATINE_LAUNCH_STATUS } from "./lib/creatineLaunch";
import { supabase } from "./lib/supabase";

const siteUrl = "https://www.supplementscout.co.uk";
const staticLastModified = "2026-07-08";

export const dynamic = "force-dynamic";

const staticPages: MetadataRoute.Sitemap = [
  {
    url: siteUrl,
    lastModified: staticLastModified,
    changeFrequency: "daily",
    priority: 1,
  },
  {
    url: `${siteUrl}/vitamins`,
    lastModified: staticLastModified,
    changeFrequency: "weekly",
    priority: 0.9,
  },
  {
    url: `${siteUrl}/magnesium`,
    lastModified: staticLastModified,
    changeFrequency: "weekly",
    priority: 0.9,
  },
  {
    url: `${siteUrl}/vitamin-d`,
    lastModified: staticLastModified,
    changeFrequency: "weekly",
    priority: 0.9,
  },
  {
    url: `${siteUrl}/omega-3`,
    lastModified: staticLastModified,
    changeFrequency: "weekly",
    priority: 0.9,
  },
  {
    url: `${siteUrl}/glucosamine`,
    lastModified: staticLastModified,
    changeFrequency: "weekly",
    priority: 0.9,
  },
  {
    url: `${siteUrl}/about`,
    lastModified: staticLastModified,
    changeFrequency: "monthly",
    priority: 0.6,
  },
  {
    url: `${siteUrl}/affiliate-disclosure`,
    lastModified: staticLastModified,
    changeFrequency: "monthly",
    priority: 0.6,
  },
  {
    url: `${siteUrl}/contact`,
    lastModified: staticLastModified,
    changeFrequency: "monthly",
    priority: 0.6,
  },
];

const creatinePages: MetadataRoute.Sitemap = CREATINE_LAUNCH_STATUS.includeInSitemap
  ? [
      {
        url: `${siteUrl}/creatine`,
        lastModified: staticLastModified,
        changeFrequency: "daily",
        priority: 0.9,
      },
    ]
  : [];

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const { data: products, error } = await supabase
    .from("products")
    .select("slug")
    .eq("is_active", true)
    .is("merged_into_product_id", null)
    .not("slug", "is", null);

  if (error) {
    console.error("Unable to load product pages for sitemap.", error);
  }

  const productPages =
    products
      ?.filter((product) => product.slug)
      .map((product) => ({
        url: `${siteUrl}/product/${product.slug}`,
        lastModified: staticLastModified,
        changeFrequency: "daily" as const,
        priority: 0.8,
      })) || [];

  return [...staticPages, ...creatinePages, ...productPages];
}
