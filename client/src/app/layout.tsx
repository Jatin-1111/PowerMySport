import { HydrationBoundary } from "@/components/layout/HydrationBoundary";
import { FriendSocketProvider } from "@/hooks/useFriendSocket";
import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import { Toaster } from "sonner";
import "./globals.css";

const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || "https://powermysport.com";
const siteTitle = "PowerMySport";
const siteDescription =
  "Book sports venues, discover certified coaches, and manage your complete sports journey on PowerMySport.";

const geistSans = Geist({
  variable: "--font-geist-sans",
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
    default: `${siteTitle} | Sports Venue Booking & Coach Discovery`,
    template: `%s | ${siteTitle}`,
  },
  description: siteDescription,
  applicationName: siteTitle,
  keywords: [
    "sports venue booking",
    "book badminton court",
    "sports coaching",
    "coach booking",
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
    title: `${siteTitle} | Sports Venue Booking & Coach Discovery`,
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
    title: `${siteTitle} | Sports Venue Booking & Coach Discovery`,
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
        className={`${geistSans.variable} ${geistMono.variable} antialiased`}
      >
        <HydrationBoundary>
          <FriendSocketProvider>{children}</FriendSocketProvider>
        </HydrationBoundary>
        <Toaster richColors closeButton position="top-right" />
      </body>
    </html>
  );
}
