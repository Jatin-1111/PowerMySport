import { Footer } from "@/components/layout/Footer";
import { Navigation } from "@/components/layout/Navigation";
import type { Metadata } from "next";
import React from "react";

export const metadata: Metadata = {
  title: "Sports Venue Booking — Launching Soon",
  description:
    "Turf, court, and field booking on PowerMySport is launching soon. Join the waitlist to get notified when sports venues near you go live.",
  alternates: {
    canonical: "/venues",
  },
  openGraph: {
    title: "Sports Venue Booking — Launching Soon",
    description:
      "Turf, court, and field booking is launching soon. Join the waitlist to hear first.",
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
