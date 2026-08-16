import { Footer } from "@/components/layout/Footer";
import { Navigation } from "@/components/layout/Navigation";
import { NOINDEX_METADATA } from "@/lib/seo";
import type { Metadata } from "next";
import React from "react";

/**
 * The booking flow itself — a per-user, stateful funnel, not a landing page.
 * It is disallowed in robots.txt and now carries `noindex` too, so the copy no
 * longer needs to sell anything; `/venues`, `/coaches` and `/academies` are the
 * public surfaces for that.
 */
export const metadata: Metadata = {
  title: "Booking",
  description: "Complete your venue, coach or academy booking.",
  ...NOINDEX_METADATA,
};

export default function BookingLayout({
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
