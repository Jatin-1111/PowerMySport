import { GuestAnalyticsTracker } from "@/modules/analytics/components/GuestAnalyticsTracker";
import { CookieConsentBanner } from "@/components/layout/CookieConsentBanner";
import { HydrationBoundary } from "@/components/layout/HydrationBoundary";
import { NumericInputGuard } from "@/components/layout/NumericInputGuard";
import { FriendSocketProvider } from "@/hooks/useFriendSocket";
import { QueryProvider } from "@/lib/query/QueryProvider";
import { SITE_DESCRIPTION as siteDescription, SITE_URL as siteUrl } from "@/lib/seo";
import type { Metadata } from "next";
import { Geist_Mono, Space_Grotesk } from "next/font/google";
import { Toaster } from "sonner";
import "./globals.css";

const spaceGrotesk = Space_Grotesk({
  variable: "--font-space-grotesk",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  metadataBase: new URL(siteUrl),
  manifest: "/site.webmanifest",
  title: {
    default: "PowerMySport | Guiding Every Sporting Journey",
    template: "%s | PowerMySport",
  },
  description: siteDescription,
  applicationName: "PowerMySport",
  keywords: [
    // High-intent parent queries
    "sports pathway for kids India",
    "child sports journey planning",
    "which sport is right for my child",
    "youth sports guidance India",
    "sports roadmap for children",
    // Feature-specific
    "AI sports guidance",
    "personalised sports plan India",
    "sports expert consultation",
    "book sports expert India",
    // Rankings — high-intent and highest-volume of anything here. Parents search
    // the federation acronym and the age bracket, not "youth sports guidance".
    "AITA rankings",
    "AITA tennis ranking list",
    "tennis rankings India",
    "junior tennis ranking India",
    "AITA player registration number",
    // Brand
    "PowerMySport",
    "powermysport.com",
  ],
  category: "sports",
  icons: {
    // Sizes declared smallest-first so a browser picking by size gets the one
    // drawn for that size rather than downscaling a larger one itself.
    // `favicon.png` used to be a 1280x1280 copy of the full logo — 249KB
    // fetched by every visitor to paint a 16px square.
    icon: [
      { url: "/favicon-16x16.png", sizes: "16x16", type: "image/png" },
      { url: "/favicon-32x32.png", sizes: "32x32", type: "image/png" },
      { url: "/favicon.png", sizes: "48x48", type: "image/png" },
    ],
    shortcut: "/favicon.png",
    apple: [{ url: "/apple-touch-icon.png", sizes: "180x180", type: "image/png" }],
  },
  // NO `alternates.canonical` here, deliberately.
  //
  // Next.js merges metadata per top-level key, so a canonical set at the root
  // is inherited by every descendant that does not define its own. This layout
  // used to set `canonical: "/"`, which meant every route without its own
  // canonical — /shop/products/[id], /academies/[slug], /booking, all the
  // dashboards — told Google "I am a duplicate of the homepage". Each route now
  // declares its own; the homepage declares it in (marketing)/page.tsx.
  openGraph: {
    type: "website",
    locale: "en_IN",
    url: siteUrl,
    siteName: "PowerMySport",
    title: "PowerMySport | Guiding Every Sporting Journey",
    description: siteDescription,
    // `images` intentionally absent: `app/opengraph-image.tsx` and
    // `app/twitter-image.tsx` generate both, and a file convention in the same
    // segment overrides whatever is declared here. Listing them twice would
    // only create something to forget to update.
  },
  twitter: {
    card: "summary_large_image",
    title: "PowerMySport | Guiding Every Sporting Journey",
    description: siteDescription,
  },
  robots: {
    index: true,
    follow: true,
    googleBot: {
      index: true,
      follow: true,
      "max-image-preview": "large",
      "max-snippet": -1,
      "max-video-preview": -1,
    },
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body className={`${spaceGrotesk.variable} ${geistMono.variable} antialiased`}>
        <NumericInputGuard />
        <GuestAnalyticsTracker />
        <HydrationBoundary>
          {/* Inside HydrationBoundary: the query cache is scoped to the signed-in
              identity, so it has to be able to observe the restored session. */}
          <QueryProvider>
            <FriendSocketProvider>{children}</FriendSocketProvider>
          </QueryProvider>
        </HydrationBoundary>
        <CookieConsentBanner />
        <Toaster
          richColors
          closeButton
          position="top-right"
          toastOptions={{ style: { width: "fit-content", maxWidth: "420px" } }}
        />
      </body>
    </html>
  );
}
