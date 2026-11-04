import { Footer } from "@/components/layout/Footer";
import { Navigation } from "@/components/layout/Navigation";
import React from "react";

/**
 * Chrome for `/coaches/[coachId]`. See the note in `venues/layout.tsx` — the
 * `/coaches` waitlist page is gone, /booking's Coaches tab replaced it, and the
 * metadata that pointed every coach profile's canonical at that waitlist went
 * with it.
 */
export default function CoachesLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-screen flex-col">
      <Navigation variant="dark" sticky />
      <div className="h-16" aria-hidden />
      <main className="flex-1">{children}</main>
      <Footer />
    </div>
  );
}
