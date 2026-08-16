import { Footer } from "@/components/layout/Footer";
import { Navigation } from "@/components/layout/Navigation";
import React from "react";

/**
 * Chrome for `/venues/[venueId]`.
 *
 * `/venues` itself is gone — it was a "launching soon" waitlist, and /booking's
 * Venues tab is the real discovery surface — so this segment now has no page of
 * its own and the bare path 308s in next.config.
 *
 * Deliberately no `metadata` export. The old one described that waitlist and
 * carried `canonical: "/venues"`, which the detail route inherited: every venue
 * profile told Google it was a duplicate of a page that no longer exists. The
 * detail layout sets its own noindex title, and the root sets no canonical, so
 * there is nothing left to inherit wrongly.
 */
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
