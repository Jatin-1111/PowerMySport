import { Footer } from "@/components/layout/Footer";
import { Navigation } from "@/components/layout/Navigation";
import React from "react";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Sports Experts — Book 1:1 Guidance Sessions",
  description:
    "Browse verified Indian sports experts and book paid 1:1 sessions online or in person. Get personalised advice on your child's sport, level, and next steps from people who've actually played.",
  alternates: {
    canonical: "/experts",
  },
  openGraph: {
    title: "Sports Experts — Book 1:1 Guidance Sessions",
    description:
      "Verified sports experts available for 1:1 sessions. Book online or in person. PowerMySport.",
    images: [{ url: "/og-image.png", width: 1200, height: 630 }],
  },
  keywords: [
    "sports expert India",
    "book sports expert online India",
    "1:1 sports coaching India",
    "sports mentor for kids India",
    "verified sports coach India",
  ],
};

export default function ExpertsLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="flex min-h-screen flex-col">
      <Navigation variant="dark" sticky />
      <div className="h-16" aria-hidden />
      <main className="flex-1">{children}</main>
      <Footer />
    </div>
  );
}
