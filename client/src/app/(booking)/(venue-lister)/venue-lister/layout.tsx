import { noindexMetadata } from "@/lib/seo";
import type { Metadata } from "next";
import React from "react";

import VendorLayoutShell from "./LayoutShell";

/** Partner-only console. See the note in (player)/dashboard/layout.tsx. */
export const metadata: Metadata = noindexMetadata(
  "Venue Partner Console",
  "Manage your venue listings, inventory, bookings and payouts.",
);

export default function VenueListerLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <VendorLayoutShell>{children}</VendorLayoutShell>;
}
