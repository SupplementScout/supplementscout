import type { MetadataRoute } from "next";
import { supabase } from "./lib/supabase";

const siteUrl = "https://www.supplementscout.co.uk";
const staticLastModified = "2026-07-08";

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

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const { data: products } = await supabase
    .from("products")
    .select("slug, updated_at")
    .eq("is_active", true);

  const productPages =
    products
      ?.filter((product) => product.slug)
      .map((product) => ({
        url: `${siteUrl}/product/${product.slug}`,
        lastModified: product.updated_at || staticLastModified,
        changeFrequency: "daily" as const,
        priority: 0.8,
      })) || [];

  return [...staticPages, ...productPages];
}
