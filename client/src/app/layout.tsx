import { GuestAnalyticsTracker } from "@/components/analytics/GuestAnalyticsTracker";
import { CookieConsentBanner } from "@/components/layout/CookieConsentBanner";
import { HydrationBoundary } from "@/components/layout/HydrationBoundary";
import { NumericInputGuard } from "@/components/layout/NumericInputGuard";
import { FriendSocketProvider } from "@/hooks/useFriendSocket";
import type { Metadata } from "next";
import { Geist_Mono, Space_Grotesk, Syne } from "next/font/google";
import { Toaster } from "sonner";
import "./globals.css";

const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || "https://powermysport.com";
const siteDescription =
  "PowerMySport helps parents plan their child's sports Journey. Get AI-powered sport pathways, personalised guidance, and 1:1 sessions with verified experts — free to explore, state-specific for India.";

const spaceGrotesk = Space_Grotesk({
  variable: "--font-space-grotesk",
  subsets: ["latin"],
});

const syne = Syne({
  variable: "--font-syne",
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
  alternates: {
    canonical: "/",
  },
  openGraph: {
    type: "website",
    locale: "en_IN",
    url: siteUrl,
    siteName: "PowerMySport",
    title: "PowerMySport | Guiding Every Sporting Journey",
    description: siteDescription,
    images: [
      {
        url: "/og-image.png",
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
    images: ["/twitter-image.png"],
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
        className={`${spaceGrotesk.variable} ${syne.variable} ${geistMono.variable} antialiased`}
      >
        <NumericInputGuard />
        <GuestAnalyticsTracker />
        <HydrationBoundary>
          <FriendSocketProvider>{children}</FriendSocketProvider>
        </HydrationBoundary>
        <CookieConsentBanner />
        <Toaster richColors closeButton position="top-right" />
      </body>
    </html>
  );
}
