import type { NextConfig } from "next";

const isDevelopment = process.env.NODE_ENV === "development";

export function getAllowedHttpsOrigin(value: string | undefined) {
  if (!value) return "";

  try {
    const url = new URL(value);
    return url.protocol === "https:" ? url.origin : "";
  } catch {
    return "";
  }
}

const supabaseOrigin = getAllowedHttpsOrigin(process.env.NEXT_PUBLIC_SUPABASE_URL);
const contentSecurityPolicy = [
  "default-src 'self'",
  `script-src 'self' 'unsafe-inline'${isDevelopment ? " 'unsafe-eval'" : ""} https://www.googletagmanager.com`,
  `connect-src 'self'${supabaseOrigin ? ` ${supabaseOrigin}` : ""} https://www.google-analytics.com https://region1.google-analytics.com`,
  "img-src 'self' data: blob: https:",
  "style-src 'self' 'unsafe-inline'",
  "font-src 'self' data:",
  "frame-src https://tally.so",
  "object-src 'none'",
  "base-uri 'self'",
  "form-action 'self'",
  "frame-ancestors 'none'",
].join("; ");

const nextConfig: NextConfig = {
  async headers() {
    return [
      {
        source: "/(.*)",
        headers: [
          { key: "Content-Security-Policy", value: contentSecurityPolicy },
          { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
          { key: "X-Content-Type-Options", value: "nosniff" },
        ],
      },
    ];
  },
};

export default nextConfig;
