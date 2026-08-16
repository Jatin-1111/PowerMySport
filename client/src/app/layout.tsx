import { GuestAnalyticsTracker } from "@/components/analytics/GuestAnalyticsTracker";
import { CookieConsentBanner } from "@/components/layout/CookieConsentBanner";
import { HydrationBoundary } from "@/components/layout/HydrationBoundary";
import { NumericInputGuard } from "@/components/layout/NumericInputGuard";
import { FriendSocketProvider } from "@/hooks/useFriendSocket";
import {
  OG_IMAGE,
  SITE_DESCRIPTION as siteDescription,
  SITE_URL as siteUrl,
  TWITTER_IMAGE,
} from "@/lib/seo";
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
    "state-specific sports pathway",
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
    icon: [
      { url: "/favicon.png", type: "image/png" },
      { url: "/favicon-32x32.png", sizes: "32x32", type: "image/png" },
    ],
    shortcut: "/favicon.png",
    apple: [
      { url: "/apple-touch-icon.png", sizes: "180x180", type: "image/png" },
    ],
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
    images: [
      {
        url: OG_IMAGE,
        width: 1200,
        height: 630,
        alt: "PowerMySport | Guiding Every Sporting Journey",
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title: "PowerMySport — Guiding Every Sporting Journey",
    description: siteDescription,
    images: [TWITTER_IMAGE],
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
      <body
        className={`${spaceGrotesk.variable} ${geistMono.variable} antialiased`}
      >
        <NumericInputGuard />
        <GuestAnalyticsTracker />
        <HydrationBoundary>
          <FriendSocketProvider>{children}</FriendSocketProvider>
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
