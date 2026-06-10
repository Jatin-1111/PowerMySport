import React from "react";
import { Footer } from "@/components/layout/Footer";
import { Navigation } from "@/components/layout/Navigation";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "PowerMySport | The #1 Sports Venue Booking Platform",
  description:
    "PowerMySport is the ultimate venue booking platform sports enthusiasts use to find turfs, courts, professional coaches, and top academies.",
  openGraph: {
    title: "PowerMySport | The #1 Sports Venue Booking Platform",
    description:
      "Find and book the best sports venues, certified coaches, and sports academies near you.",
  },
};


export default function MarketingLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="flex min-h-screen flex-col overflow-x-hidden">
      {/* Navigation Header */}
      <Navigation variant="light" sticky />

      {/* Main Content */}
      <main className="flex-1">{children}</main>

      {/* Footer */}
      <Footer />
    </div>
  );
}

