import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import Script from "next/script";
import AnalyticsConsent from "./components/AnalyticsConsent";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  metadataBase: new URL("https://www.supplementscout.co.uk"),
  title: {
    default: "SupplementScout | Compare UK Supplement Prices",
    template: "%s | SupplementScout",
  },
  description:
    "Compare supplement prices from UK retailers. Check delivery costs, price history, cost per serving and find the best real price.",
  openGraph: {
    siteName: "SupplementScout",
    type: "website",
    locale: "en_GB",
    url: "https://www.supplementscout.co.uk",
    title: "SupplementScout | Compare UK Supplement Prices",
    description:
      "Compare supplement prices from UK retailers. Check delivery costs, price history, cost per serving and find the best real price.",
  },
  twitter: {
    card: "summary",
    title: "SupplementScout | Compare UK Supplement Prices",
    description:
      "Compare supplement prices from UK retailers. Check delivery costs, price history, cost per serving and find the best real price.",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const measurementId = process.env.NEXT_PUBLIC_GA_MEASUREMENT_ID || "";
  const analyticsEnabled = process.env.NODE_ENV === "production" && measurementId.length > 0;

  return (
    <html
      lang="en"
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col">
        {analyticsEnabled && (
          <Script id="google-consent-mode-defaults" strategy="beforeInteractive">
            {`window.dataLayer=window.dataLayer||[];window.gtag=window.gtag||function(){window.dataLayer.push(arguments)};window.__supplementScoutAnalyticsConsent="denied";window.gtag("consent","default",{analytics_storage:"denied",ad_storage:"denied",ad_user_data:"denied",ad_personalization:"denied",wait_for_update:500});`}
          </Script>
        )}
        {children}
        <AnalyticsConsent measurementId={measurementId} enabled={analyticsEnabled} />
      </body>
    </html>
  );
}
