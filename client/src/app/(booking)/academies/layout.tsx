import { Footer } from "@/components/layout/Footer";
import { Navigation } from "@/components/layout/Navigation";
import type { Metadata } from "next";
import React from "react";

// Copy matches what the page actually is today — a waitlist. The previous
// "Explore and join the best sports academies" promised a directory that does
// not exist yet, which reads as a bait-and-switch to anyone arriving from
// search.
export const metadata: Metadata = {
  title: "Sports Academy Discovery — Launching Soon",
  description:
    "Verified sports academies with real programmes, fees and age groups are launching soon on PowerMySport. Join the waitlist to get notified when academies near you go live.",
  alternates: { canonical: "/academies" },
  openGraph: {
    title: "Sports Academy Discovery — Launching Soon",
    description:
      "Verified academy programmes are launching soon. Join the waitlist to hear first.",
  },
};

export default function AcademiesLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="flex flex-col min-h-screen">
      <Navigation sticky />
      <div className="h-16" aria-hidden />
      <main className="flex-1">{children}</main>
      <Footer />
    </div>
  );
}
