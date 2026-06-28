import type { MetadataRoute } from "next";
import { supabase } from "./lib/supabase";

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const { data: products } = await supabase
    .from("products")
    .select("slug");

  const productPages =
    products?.map((product) => ({
      url: `https://www.supplementscout.co.uk/product/${product.slug}`,
      lastModified: new Date(),
      changeFrequency: "daily" as const,
      priority: 0.8,
    })) || [];

  return [
    {
      url: "https://www.supplementscout.co.uk",
      lastModified: new Date(),
      changeFrequency: "daily",
      priority: 1,
    },
    ...productPages,
  ];
}