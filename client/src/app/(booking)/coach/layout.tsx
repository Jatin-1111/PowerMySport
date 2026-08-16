import { noindexMetadata } from "@/lib/seo";
import type { Metadata } from "next";
import React from "react";

import CoachLayoutShell from "./LayoutShell";

/** Coach-only console. See the note in (player)/dashboard/layout.tsx. */
export const metadata: Metadata = noindexMetadata(
  "Coach Console",
  "Manage your schedule, clients, bookings and payouts.",
);

export default function CoachLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <CoachLayoutShell>{children}</CoachLayoutShell>;
}
