import { Footer } from "@/components/layout/Footer";
import { Navigation } from "@/components/layout/Navigation";
import React from "react";

/**
 * Chrome for `/experts/[expertId]` and `/experts/sessions`.
 *
 * `/experts` itself is gone — /booking's Experts tab is the real discovery
 * surface — so this segment has no page of its own and the bare path 308s in
 * next.config, exactly as /venues, /coaches and /academies already do.
 *
 * Deliberately no `metadata` export. The old one carried `canonical: "/experts"`,
 * which the children inherited: `/experts/sessions` already had to override it
 * (see its layout), and pointing it at the new tab would only move the bug, since
 * /booking is noindex. The detail route sets its own canonical.
 */

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
