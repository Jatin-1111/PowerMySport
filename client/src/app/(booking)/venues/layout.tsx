import { Footer } from "@/components/layout/Footer";
import { Navigation } from "@/components/layout/Navigation";
import type { Metadata } from "next";
import React from "react";

export const metadata: Metadata = {
  title: "Sports Venue Booking | Book Turf & Courts Online",
  description:
    "Find and book the best sports venues near you. PowerMySport is the premium venue booking platform sports players use to book turf, courts, and fields instantly.",
  openGraph: {
    title: "Sports Venue Booking | Book Turf & Courts Online",
    description:
      "Find and book the best sports venues near you. Book turf, courts, and fields instantly.",
  },
};

export default function VenuesLayout({
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
