import { noindexMetadata } from "@/lib/seo";
import type { Metadata } from "next";
import React from "react";

import ExpertLayoutShell from "./LayoutShell";

/**
 * The expert's own console — not to be confused with the public, indexable
 * `/experts/[expertId]` profile a parent books from.
 */
export const metadata: Metadata = noindexMetadata(
  "Expert Console",
  "Manage your sessions, pathways, availability and payouts."
);

export default function ExpertLayout({ children }: { children: React.ReactNode }) {
  return <ExpertLayoutShell>{children}</ExpertLayoutShell>;
}
