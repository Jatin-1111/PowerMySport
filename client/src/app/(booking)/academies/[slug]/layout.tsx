import { noindexMetadata } from "@/lib/seo";
import type { Metadata } from "next";
import React from "react";

/**
 * Orphaned while academy booking is on a waitlist: nothing links here, there is
 * no listing page feeding it, and the profiles behind it are not ready to be a
 * parent's first impression from a search result. `noindex` until `/academies`
 * is a real directory again — at which point this should become a
 * `generateMetadata` + `SportsActivityLocation` page, not just an index flip.
 */
export const metadata: Metadata = noindexMetadata("Academy");

export default function AcademyDetailLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <>{children}</>;
}
