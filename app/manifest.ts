import type { MetadataRoute } from "next";

const backgroundColor = "#0f2a32";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "SupplementScout",
    short_name: "SupplementScout",
    description: "The UK’s smart supplement search engine.",
    start_url: "/",
    display: "standalone",
    background_color: backgroundColor,
    theme_color: backgroundColor,
    icons: [
      {
        src: "/favicon.ico",
        sizes: "16x16 32x32 48x48",
        type: "image/x-icon",
      },
      {
        src: "/icons/icon-192.png",
        sizes: "192x192",
        type: "image/png",
      },
      {
        src: "/icons/icon-512.png",
        sizes: "512x512",
        type: "image/png",
      },
    ],
  };
}
