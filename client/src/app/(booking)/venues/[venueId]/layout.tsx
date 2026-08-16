import { noindexMetadata } from "@/lib/seo";
import type { Metadata } from "next";
import React from "react";

/**
 * Orphaned while venue booking is on a waitlist — see the note in
 * `coaches/[coachId]/layout.tsx`. When booking relaunches this wants
 * `generateMetadata` plus a `SportsActivityLocation` block with the real
 * address and opening hours.
 */
export const metadata: Metadata = noindexMetadata("Venue");

export default function VenueDetailLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <>{children}</>;
}
