import { CookieConsentBanner } from "@/components/layout/CookieConsentBanner";
import { HydrationBoundary } from "@/components/layout/HydrationBoundary";
import { NumericInputGuard } from "@/components/layout/NumericInputGuard";
import { FriendSocketProvider } from "@/hooks/useFriendSocket";
import type { Metadata } from "next";
import { Geist_Mono, Space_Grotesk, Syne } from "next/font/google";
import { Toaster } from "sonner";
import "./globals.css";

const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || "https://powermysport.com";
const siteTitle = "PowerMySport";
const siteDescription =
  "PowerMySport is organizing the unorganized sports sector. We solve the biggest problem for parents by providing a unified platform to discover athletic pathways, book venues, and find certified coaches.";

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
    default: `${siteTitle} | Organizing the Unorganized Sports Sector for Parents`,
    template: `%s | ${siteTitle}`,
  },
  description: siteDescription,
  applicationName: siteTitle,
  keywords: [
    "unorganized sports sector",
    "sports for parents",
    "youth sports pathway",
    "sports academy",
    "sports coach booking",
    "parent sports guide",
    "sports venue booking",
    "book turf online",
    "PowerMySport",
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
    siteName: siteTitle,
    title: `${siteTitle} | Organizing the Unorganized Sports Sector for Parents`,
    description: siteDescription,
    images: [
      {
        url: "/og-image.png",
        width: 1200,
        height: 630,
        alt: `${siteTitle} preview`,
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title: `${siteTitle} | Organizing the Unorganized Sports Sector for Parents`,
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
        <HydrationBoundary>
          <FriendSocketProvider>{children}</FriendSocketProvider>
        </HydrationBoundary>
        <CookieConsentBanner />
        <Toaster richColors closeButton position="top-right" />
      </body>
    </html>
  );
}
