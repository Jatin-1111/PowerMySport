import { noindexMetadata } from "@/lib/seo";
import type { Metadata } from "next";
import React from "react";

/**
 * Orphaned while coach booking is on a waitlist — `/coaches` is a waitlist page,
 * so nothing links here. It also used to inherit `/coaches`'s canonical, which
 * told Google every coach profile was a duplicate of the waitlist page.
 */
export const metadata: Metadata = noindexMetadata("Coach Profile");

export default function CoachDetailLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <>{children}</>;
}
