import { HydrationBoundary } from "@/components/layout/HydrationBoundary";
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
        url: "/icon.svg",
        width: 512,
        height: 512,
        alt: `${siteTitle} logo`,
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title: `${siteTitle} | Sports Venue Booking & Coach Discovery`,
    description: siteDescription,
    images: ["/icon.svg"],
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
        <HydrationBoundary>{children}</HydrationBoundary>
        <Toaster richColors closeButton position="top-right" />
      </body>
    </html>
  );
}
