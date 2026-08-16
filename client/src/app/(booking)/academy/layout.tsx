import { noindexMetadata } from "@/lib/seo";
import type { Metadata } from "next";
import React from "react";

import AcademyLayoutShell from "./LayoutShell";

/**
 * The academy partner console and its onboarding funnel — not the public
 * `/academies` discovery surface.
 */
export const metadata: Metadata = noindexMetadata(
  "Academy Console",
  "Manage your academy profile, programmes, reviews and earnings.",
);

export default function AcademyLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <AcademyLayoutShell>{children}</AcademyLayoutShell>;
}
