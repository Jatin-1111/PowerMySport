import { Footer } from "@/components/layout/Footer";
import { Navigation } from "@/components/layout/Navigation";
import { NOINDEX_METADATA } from "@/lib/seo";
import type { Metadata } from "next";
import React from "react";

/**
 * The booking flow itself — a per-user, stateful funnel, not a landing page.
 * It is disallowed in robots.txt and carries `noindex`, so the copy does not
 * need to sell anything.
 *
 * It is also now the ONLY discovery surface: the standalone `/venues`,
 * `/coaches` and `/academies` waitlist pages were removed and 308 here. Nothing
 * public and crawlable lists venues, coaches or academies any more — worth
 * knowing before assuming search can still reach them.
 */
export const metadata: Metadata = {
  title: "Booking",
  description: "Complete your venue, coach or academy booking.",
  ...NOINDEX_METADATA,
};

export default function BookingLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-screen flex-col">
      <Navigation sticky />
      <div className="h-16" aria-hidden />
      <main className="flex-1">{children}</main>
      <Footer />
    </div>
  );
}
