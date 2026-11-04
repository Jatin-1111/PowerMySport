import { noindexMetadata } from "@/lib/seo";
import type { Metadata } from "next";
import React from "react";

/**
 * A one-shot check-in link for a specific booking. It carries no content worth
 * ranking and every URL is unique to one person, so it is `noindex` — it was
 * previously indexable and inherited the homepage canonical.
 */
export const metadata: Metadata = noindexMetadata("Check In");

export default function CheckInLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}
