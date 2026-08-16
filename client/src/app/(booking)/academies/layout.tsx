import { Footer } from "@/components/layout/Footer";
import { Navigation } from "@/components/layout/Navigation";
import React from "react";

/**
 * Chrome for `/academies/[slug]`. See the note in `venues/layout.tsx` — the
 * `/academies` waitlist page is gone, /booking's Academies tab replaced it, and
 * the metadata that pointed every academy profile's canonical at that waitlist
 * went with it.
 */
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
